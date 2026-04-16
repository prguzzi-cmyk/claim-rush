import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { Resend } from 'resend'

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIRE_LEADS_PATH = path.join(__dirname, 'data', 'fire_leads.json');

// Lead assignment + filtering from the role system
import { assignLead as assignLeadRole, sendLeadToAgent } from './src/system/leads/assignment.js';
import { getLeadsForUser } from './src/system/leads/filtering.js';
import { triggerOutreach, tickFollowUps } from './src/system/leads/outreach.js';

// Mock user roster — maps territories to default assignees
const MOCK_USERS = {
  agent: { id: 'agent-001', role: 'agent', territory: 'Bucks County, PA' },
  rvp: { id: 'rvp-001', role: 'rvp', territory: 'Pennsylvania', agentIds: ['agent-001'] },
  cp: { id: 'cp-001', role: 'cp', territory: 'Bucks County, PA' },
  home_office: { id: 'ho-001', role: 'home_office' },
};

/** Load persisted fire leads from disk on startup. */
function loadFireLeads() {
  try {
    if (fs.existsSync(FIRE_LEADS_PATH)) {
      const raw = fs.readFileSync(FIRE_LEADS_PATH, 'utf-8');
      const arr = JSON.parse(raw);
      console.log(`[STORE] Loaded ${arr.length} fire leads from ${FIRE_LEADS_PATH}`);
      return arr;
    }
  } catch (err) {
    console.warn(`[STORE] Failed to load fire_leads.json: ${err.message}`);
  }
  return [];
}

/** Append one lead to the persistent JSON file. */
function persistFireLead(lead) {
  try {
    const existing = fs.existsSync(FIRE_LEADS_PATH)
      ? JSON.parse(fs.readFileSync(FIRE_LEADS_PATH, 'utf-8'))
      : [];
    existing.push(lead);
    fs.writeFileSync(FIRE_LEADS_PATH, JSON.stringify(existing, null, 2));
    console.log(`[STORE] Lead saved to fire_leads.json (total: ${existing.length})`);
  } catch (err) {
    console.error(`[STORE] Failed to write fire_leads.json: ${err.message}`);
  }
}

/** In-memory stores — seeded from disk, kept in sync. */
const fireLeadsDisk = loadFireLeads();
const leadStore = [...fireLeadsDisk];
const incidentStore = [];

/**
 * Route a lead to the correct party based on available data.
 * Returns { assigned_to, reason }.
 * Future: lookup territory → CP mapping table, RVP fallback, round-robin.
 */
function assignLead(record) {
  if (record.territory && record.territory !== 'Direct') {
    return { assigned_to: 'chapter-president', reason: `territory: ${record.territory}` };
  }
  if (record.cp_name) {
    return { assigned_to: 'chapter-president', reason: `cp_name: ${record.cp_name}` };
  }
  return { assigned_to: 'unassigned', reason: 'no territory or cp_name' };
}

const CALL_SHEET_PATH = path.join(__dirname, 'data', 'all_fire_leads_call_sheet.csv');
const CALL_SHEET_RECIPIENTS = ['prguzzi@gmail.com'];

/**
 * Regenerate the master call sheet CSV from fire_leads.json and optionally email it.
 * Called automatically when new valid-phone leads are added.
 */
function regenerateCallSheet(emailUpdate = false) {
  try {
    const raw = JSON.parse(fs.readFileSync(FIRE_LEADS_PATH, 'utf-8'));
    const exclude = new Set(['district','city','county','department','llc','inc','company',
      'corp','corporation','association','authority','trust','estate',
      'church','school','university','hospital','foundation']);

    const seen = new Set();
    const rows = [];
    for (const l of raw) {
      const d = (l.phone || '').replace(/[^0-9]/g, '');
      let ph = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
      if (ph.length < 10) continue;
      const name = (l.owner_name || l.name || '').trim();
      if (!name || [...exclude].some(w => name.toLowerCase().includes(w))) continue;
      if (seen.has(ph)) continue;
      seen.add(ph);
      rows.push({ owner_name: name, phone: ph, address: l.address || '', city: l.city || '', state: l.state || '' });
    }

    // Write CSV
    const header = 'owner_name,phone,address,city,state';
    const csvRows = rows.map(r => {
      const esc = v => `"${(v || '').replace(/"/g, '""')}"`;
      return [esc(r.owner_name), esc(r.phone), esc(r.address), esc(r.city), esc(r.state)].join(',');
    });
    const csv = [header, ...csvRows].join('\n');
    fs.writeFileSync(CALL_SHEET_PATH, csv);
    console.log(`[CALLSHEET] Regenerated: ${rows.length} leads in ${CALL_SHEET_PATH}`);

    // Email if requested and API key available
    if (emailUpdate && rows.length > 0) {
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey) {
        const resend = new Resend(apiKey);
        for (const to of CALL_SHEET_RECIPIENTS) {
          resend.emails.send({
            from: 'ClaimRush <onboarding@resend.dev>',
            to,
            subject: `Fire Leads – Immediate`,
            text: `${rows.length} fire leads with valid homeowner phone numbers.\n\n⚠️ FORWARD THIS EMAIL AND ATTACHMENT TO: makmin@upaclaim.org\n\nGenerated: ${new Date().toISOString()}`,
            attachments: [{ filename: 'all_fire_leads_call_sheet.csv', content: Buffer.from(csv).toString('base64') }],
          }).then(() => console.log(`[CALLSHEET] ✅ Emailed to ${to}`))
            .catch(err => console.error(`[CALLSHEET] ❌ Email to ${to} failed:`, err?.message || err));
        }
      }
    }
    return rows.length;
  } catch (err) {
    console.error(`[CALLSHEET] Error: ${err.message}`);
    return 0;
  }
}

/**
 * Skip trace a lead by address via SkipSherpa beta6 Property Lookup.
 * PUT {SKIPSHERPA_BASE_URL}/api/beta6/properties
 * Auth: API-Key header
 *
 * Matches the exact format used in upa-portal/backend/app/utils/skip_trace.py
 *
 * Only runs for source_type === 'rin-fire'.
 * Mutates the lead record in place (async).
 * Never throws — logs errors and marks low-quality on failure.
 */
function _parseAddressComponents(address) {
  const parts = address.split(',').map((s) => s.trim());
  const result = { street: '', city: '', state: '', zipcode: '' };
  if (parts.length >= 3) {
    result.street = parts[0];
    result.city = parts[1];
    const szParts = parts[2].split(/\s+/);
    if (szParts.length >= 2) { result.state = szParts[0]; result.zipcode = szParts[1]; }
    else if (szParts.length === 1) { result.state = szParts[0]; }
    if (parts.length >= 4) result.zipcode = parts[3].trim();
  } else if (parts.length === 2) {
    result.street = parts[0];
    const szParts = parts[1].split(/\s+/);
    if (szParts.length >= 3) { result.city = szParts[0]; result.state = szParts[1]; result.zipcode = szParts[2]; }
    else if (szParts.length >= 2) { result.state = szParts[0]; result.zipcode = szParts[1]; }
  } else {
    result.street = address;
  }
  return result;
}

async function skipTraceLead(record) {
  if (record.source_type !== 'rin-fire') return;
  if (!record.address) {
    record.lead_quality = 'low';
    console.log(`[SKIP] No address to trace — marked low-quality: ${record.id}`);
    return;
  }

  const apiKey = process.env.SKIPSHERPA_API_KEY;
  const baseUrl = (process.env.SKIPSHERPA_BASE_URL || 'https://skipsherpa.com').replace(/\/+$/, '');
  if (!apiKey) {
    record.lead_quality = 'low';
    console.warn('[SKIP] SKIPSHERPA_API_KEY not set — skipping trace');
    return;
  }

  // Build address components — prefer explicit city/state fields on record,
  // fall back to parsing the address string
  let street = record.address || '';
  let city = record.city || '';
  let state = record.state || '';
  let zipcode = '';

  if (!city && !state) {
    const parsed = _parseAddressComponents(record.address);
    street = parsed.street;
    city = parsed.city;
    state = parsed.state;
    zipcode = parsed.zipcode;
  }

  const url = `${baseUrl}/api/beta6/properties`;
  const payload = {
    property_lookups: [{
      property_address_lookup: { street, city, state, zipcode },
      success_criteria: 'owner-name',
    }],
  };

  console.log(`[SKIP] Running SkipSherpa beta6 for: ${street}, ${city}, ${state}`);

  try {
    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // SkipSherpa returns 404 for "not found" — that's valid, not an error.
    if (resp.status >= 500) {
      console.error(`[SKIP ERROR] API returned ${resp.status}: ${resp.statusText}`);
      record.skip_traced = true;
      record.skip_traced_at = new Date().toISOString();
      record.lead_quality = 'low';
      return;
    }

    const data = await resp.json();
    console.log(`[SKIP RAW]:`, JSON.stringify(data, null, 2));

    // Parse response — exact same structure as upa-portal skip_trace.py
    const propertyResults = data.property_results || [];
    if (!propertyResults.length) {
      console.log(`[SKIP] No property_results — marked low-quality`);
      record.skip_traced = true;
      record.skip_traced_at = new Date().toISOString();
      record.lead_quality = 'low';
      return;
    }

    const phones = [];
    const emails = [];
    let ownerName = null;

    for (const pr of propertyResults) {
      const prop = pr.property;
      if (!prop) continue;
      for (const ownerObj of (prop.owners || [])) {
        const person = ownerObj.person;
        if (person) {
          if (!ownerName) {
            const pn = person.person_name || {};
            ownerName = person.name
              || [pn.first_name, pn.middle_name, pn.last_name].filter(Boolean).join(' ')
              || null;
          }
          for (const ph of (person.phone_numbers || [])) {
            const num = ph.local_format || ph.e164_format || '';
            if (num) phones.push(num.replace(/[^0-9]/g, ''));
          }
          for (const em of (person.emails || [])) {
            if (em.email_address) emails.push(em.email_address);
          }
        }
        const biz = ownerObj.business;
        if (biz && !person) {
          if (!ownerName) ownerName = biz.name || null;
          for (const ph of (biz.phone_numbers || [])) {
            const num = ph.local_format || '';
            if (num) phones.push(num.replace(/[^0-9]/g, ''));
          }
          for (const em of (biz.emails || [])) {
            if (em.email_address) emails.push(em.email_address);
          }
        }
      }
    }

    const uniquePhones = [...new Set(phones)].slice(0, 5);
    const uniqueEmails = [...new Set(emails)].slice(0, 3);

    record.name = ownerName;
    record.phone = uniquePhones[0] || null;
    record.phones_all = uniquePhones;
    record.email = uniqueEmails[0] || null;
    record.skip_traced = true;
    record.skip_traced_at = new Date().toISOString();
    record.lead_quality = uniquePhones.length > 0 ? 'high' : 'low';

    if (record.name) console.log(`[SKIP] Lead enriched: ${record.name}`);
    else console.log(`[SKIP] Owner name not found`);
    if (record.phone) console.log(`[SKIP]   Phone: ${record.phone}${uniquePhones.length > 1 ? ` (+${uniquePhones.length - 1} more)` : ''}`);
    else console.log(`[SKIP]   No phone found`);
    if (record.email) console.log(`[SKIP]   Email: ${record.email}`);
    console.log(`[SKIP]   Quality: ${record.lead_quality}`);

  } catch (err) {
    console.error(`[SKIP ERROR] ${err.message}`);
    record.skip_traced = true;
    record.skip_traced_at = new Date().toISOString();
    record.lead_quality = 'low';
  }
}

/**
 * Convert a fire incident into a lead and store it.
 * Deduplicates: skips if same address created a lead within 10 minutes.
 * Triggers skip trace + email notification.
 */
async function incidentToLead(incident, server) {
  // Deduplicate: same address within 10 minutes
  const tenMin = 10 * 60 * 1000;
  const isDupe = leadStore.some(
    (l) => l.source_type === 'rin-fire' && l.address === incident.address &&
           Date.now() - new Date(l.createdAt).getTime() < tenMin
  );
  if (isDupe) {
    console.log(`[FIRE → LEAD] Skipped duplicate for ${incident.address}`);
    return null;
  }

  const id = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const territory = incident.city && incident.state
    ? `${incident.city}, ${incident.state}`
    : 'Bucks County, PA';

  const record = {
    id,
    createdAt: new Date().toISOString(),
    name: null,
    phone: null,
    email: null,
    address: incident.address,
    city: incident.city || '',
    state: incident.state || '',
    damageType: 'fire',
    cp_name: null,
    territory,
    cp_phone: null,
    cp_email: null,
    source: 'rin',
    source_type: 'rin-fire',
    incident_type: incident.incident_type || 'fire',
    severity_score: incident.severity_score ?? null,
    damage_probability: incident.damage_probability ?? null,
    incident_id: incident.id,
  };

  const routing = assignLead(record);
  record.assigned_to = routing.assigned_to;

  // Role-based assignment — assign to agent first
  assignLeadRole(record);
  record.assigned_user_id = MOCK_USERS.agent.id;

  // Skip trace before storing (async — awaited so lead is enriched before email)
  await skipTraceLead(record);

  leadStore.push(record);

  // Persist to disk — append only, never overwrite
  persistFireLead({
    id: record.id,
    address: record.address,
    city: incident.city || '',
    state: incident.state || '',
    incident_type: record.incident_type,
    owner_name: record.name || null,
    phone: record.phone || null,
    phones_all: record.phones_all || [],
    email: record.email || null,
    lead_quality: record.lead_quality || 'unknown',
    territory: record.territory,
    assigned_to: record.assigned_to,
    timestamp: record.createdAt,
  });

  console.log(`[FIRE → LEAD] Created lead from incident ${incident.id}`);
  console.log(`[FIRE → LEAD]   Address: ${record.address}`);
  console.log(`[FIRE → LEAD]   Owner: ${record.name || '(unknown)'}`);
  console.log(`[FIRE → LEAD]   Phone: ${record.phone || '(none)'}`);
  console.log(`[FIRE → LEAD]   Territory: ${record.territory}`);
  console.log(`[FIRE → LEAD]   Assigned to: ${record.assigned_to}`);
  console.log(`[FIRE → LEAD]   Quality: ${record.lead_quality || 'unknown'}`);
  console.log(`[FIRE → LEAD]   Lead ID: ${record.id}`);

  // Auto-trigger outreach after skip trace
  triggerOutreach(record, { sendEmail: sendLeadToAgent });

  // Regenerate call sheet (no email — batched email handled separately)
  if (record.phone) {
    regenerateCallSheet(false);
  }

  return record;
}

/** API plugin — handles /api/leads and /api/notify-lead during local dev. */
function mockApi() {
  return {
    name: 'mock-api',
    configureServer(server) {
      // 30-minute scheduled email — sends full CSV if new leads exist
      let lastEmailedCount = 0;
      setInterval(() => {
        try {
          const all = JSON.parse(fs.readFileSync(FIRE_LEADS_PATH, 'utf-8'));
          const withPhone = all.filter(l => l.phone).length;
          if (withPhone > lastEmailedCount) {
            console.log(`[SCHEDULER] ${withPhone} leads with phone (was ${lastEmailedCount}) — sending updated CSV`);
            regenerateCallSheet(true);
            lastEmailedCount = withPhone;
          } else {
            console.log(`[SCHEDULER] No new phone leads since last email (${withPhone} total)`);
          }
        } catch {}
      }, 30 * 60 * 1000); // 30 minutes
      console.log('[SCHEDULER] Email timer started — will check every 30 minutes');

      // Follow-up tick — advance cadence every 5 minutes
      setInterval(() => {
        tickFollowUps(leadStore, { sendEmail: sendLeadToAgent });
      }, 5 * 60 * 1000);
      console.log('[SCHEDULER] Follow-up tick started — checks every 5 minutes');

      // POST /api/notify-lead — structured lead notification handler
      server.middlewares.use('/api/notify-lead', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const id = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const record = {
              id,
              createdAt: new Date().toISOString(),
              name: data.lead_name || null,
              phone: data.phone || null,
              email: data.email || null,
              address: data.address || null,
              damageType: data.damageType || null,
              cp_name: data.cp_name || null,
              territory: data.territory || null,
            };

            const routing = assignLead(record);
            record.assigned_to = routing.assigned_to;
            assignLeadRole(record);
            record.assigned_user_id = MOCK_USERS.agent.id;

            leadStore.push(record);

            console.log('\n🚨 NEW LEAD STORED ON SERVER');
            console.log(`   ID:        ${record.id}`);
            if (record.name) console.log(`   Name:      ${record.name}`);
            if (record.phone) console.log(`   Phone:     ${record.phone}`);
            if (record.email) console.log(`   Email:     ${record.email}`);
            if (record.damageType) console.log(`   Damage:    ${record.damageType}`);
            if (record.cp_name) console.log(`   CP:        ${record.cp_name}`);
            if (record.territory) console.log(`   Territory: ${record.territory}`);
            console.log(`   Total leads in store: ${leadStore.length}`);

            // SMS placeholder (for future Twilio integration)
            const smsMessage = `NEW LEAD 🚨\nName: ${record.name}\nPhone: ${record.phone}\nTerritory: ${record.territory}\nSource: ${data.source_type || 'unknown'}`;
            console.log('[SMS CONTENT]');
            console.log(smsMessage);

            // Per-lead email DISABLED — only batched CSV emails are sent
            // (via regenerateCallSheet after batch completes or 30-min timer)
            console.log('[EMAIL] Per-lead email disabled — leads collected for batch CSV only');
            if (false) {
            }

            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 201;
            res.end(JSON.stringify({ ok: true, id, total: leadStore.length, message: 'Lead stored' }));
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
      });

      // GET /api/leads/export — only leads with phone numbers, clean for texting
      server.middlewares.use('/api/leads/export', (req, res) => {
        if (req.method !== 'GET') { res.statusCode = 405; res.end('{}'); return; }
        let all = [];
        try { if (fs.existsSync(FIRE_LEADS_PATH)) all = JSON.parse(fs.readFileSync(FIRE_LEADS_PATH, 'utf-8')); } catch {}
        for (const l of leadStore) { if (!all.some((d) => d.id === l.id)) all.push(l); }
        const withPhone = all.filter((l) => l.phone);
        const clean = withPhone.map((l) => ({
          name: l.owner_name || l.name || '(unknown)',
          phone: l.phone,
          address: l.address || '',
          city: l.city || '',
          state: l.state || '',
        }));
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ total: clean.length, leads: clean }));
      });

      // GET /api/leads/all — ALL stored leads (disk + memory)
      server.middlewares.use('/api/leads/all', (req, res) => {
        if (req.method !== 'GET') { res.statusCode = 405; res.end('{}'); return; }
        let all = [];
        try { if (fs.existsSync(FIRE_LEADS_PATH)) all = JSON.parse(fs.readFileSync(FIRE_LEADS_PATH, 'utf-8')); } catch {}
        for (const l of leadStore) { if (!all.some((d) => d.id === l.id)) all.push(l); }
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ total: all.length, leads: all }));
      });

      // GET /api/leads/email-export — email CSV of leads with phone numbers
      server.middlewares.use('/api/leads/email-export', (req, res) => {
        if (req.method !== 'GET') { res.statusCode = 405; res.end('{}'); return; }
        let all = [];
        try { if (fs.existsSync(FIRE_LEADS_PATH)) all = JSON.parse(fs.readFileSync(FIRE_LEADS_PATH, 'utf-8')); } catch {}
        const withPhone = all.filter((l) => l.phone);
        if (!withPhone.length) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ ok: true, message: 'No leads with phone numbers to export', total: 0 }));
          return;
        }
        const csvHeader = 'name,phone,address,city,state';
        const csvRows = withPhone.map((l) => {
          const esc = (v) => `"${(v || '').replace(/"/g, '""')}"`;
          return [esc(l.owner_name || l.name || ''), esc(l.phone), esc(l.address), esc(l.city), esc(l.state)].join(',');
        });
        const csv = [csvHeader, ...csvRows].join('\n');
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'your@email.com';
        if (!RESEND_API_KEY) {
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename="fire_leads_export.csv"');
          res.statusCode = 200;
          res.end(csv);
          return;
        }
        const resend = new Resend(RESEND_API_KEY);
        resend.emails.send({
          from: 'ClaimRush <onboarding@resend.dev>',
          to: NOTIFY_EMAIL,
          subject: `📋 Fire Leads Export — ${withPhone.length} leads with phone numbers`,
          text: `Attached: ${withPhone.length} fire leads ready for texting.\nGenerated: ${new Date().toISOString()}`,
          attachments: [{ filename: 'fire_leads_export.csv', content: Buffer.from(csv).toString('base64') }],
        }).then(() => console.log(`[EXPORT] ✅ CSV emailed to ${NOTIFY_EMAIL}`))
          .catch((err) => console.error(`[EXPORT] ❌ Email failed:`, err));
        console.log(`[EXPORT] CSV email queued to ${NOTIFY_EMAIL} (${withPhone.length} leads)`);
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true, message: `CSV with ${withPhone.length} leads emailed to ${NOTIFY_EMAIL}`, total: withPhone.length }));
      });

      // GET /api/leads — return in-memory leads
      // POST /api/leads — lead intake
      server.middlewares.use('/api/leads', (req, res) => {
        if (req.method === 'GET') {
          const url = new URL(req.url, 'http://localhost');
          const role = url.searchParams.get('role');
          const userId = url.searchParams.get('user_id');
          let filtered = leadStore;
          if (role && userId) {
            const user = MOCK_USERS[role] || {};
            filtered = getLeadsForUser(role, userId, leadStore, {
              territory: user.territory,
              agentIds: user.agentIds || [],
            });
          }
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ leads: filtered, total: filtered.length, filtered_by: role || 'none' }));
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const lead = JSON.parse(body);
            const id = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const sourceType = lead.source_type || 'manual';
            const record = {
              id,
              createdAt: new Date().toISOString(),
              // Core lead fields
              name: lead.name || null,
              phone: lead.phone || null,
              email: lead.email || null,
              address: lead.address || null,
              damageType: lead.damageType || null,
              // Chapter routing
              cp_name: lead.cp_name || null,
              territory: lead.territory || null,
              cp_phone: lead.cp_phone || null,
              cp_email: lead.cp_email || null,
              source: lead.source || null,
              // RIN intake fields
              source_type: sourceType,
              incident_type: lead.incident_type || null,
              severity_score: lead.severity_score ?? null,
              damage_probability: lead.damage_probability ?? null,
              incident_id: lead.incident_id || null,
            };

            leadStore.push(record);

            console.log('\n[API] POST /api/leads');
            console.log(`[API] SOURCE: ${sourceType}`);
            console.log(`[API] ${sourceType === 'rin' ? '🛰️' : '📝'} Lead stored:`, JSON.stringify(record, null, 2));
            console.log(`[API] Total leads in store: ${leadStore.length}`);

            // Routing
            const routing = assignLead(record);
            record.assigned_to = routing.assigned_to;

            console.log(`[ROUTING] Lead assigned to: ${routing.assigned_to}`);
            console.log(`[ROUTING] Reason: ${routing.reason}`);
            console.log(`[ROUTING] Territory: ${record.territory}`);
            console.log(`[ROUTING] Source: ${record.source_type}`);

            // Per-lead notification DISABLED — only batched CSV emails sent
            console.log('[NOTIFY] Per-lead notification disabled — batch CSV only');

            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 201;
            res.end(JSON.stringify({ ok: true, id, source_type: sourceType, assigned_to: routing.assigned_to, routing_reason: routing.reason, message: 'Lead accepted' }));
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
      });
      // ── Fire Incident Ingestion ───────────────────────────────
      // GET  /api/incidents/fire         — return stored incidents
      // POST /api/incidents/fire         — ingest from external source
      // GET  /api/incidents/fire/refresh — fetch from PulsePoint-style feed
      // POST /api/incidents/fire/test — inject ONE incident through the full pipeline
      // This is the endpoint to test: fire → lead → skip trace → email
      server.middlewares.use('/api/incidents/fire/test', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'POST only' }));
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const raw = JSON.parse(body);
            const id = `inc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const incident = {
              id,
              type: 'fire',
              incident_type: raw.incident_type || raw.type_desc || 'Structure Fire',
              address: raw.address,
              city: raw.city || '',
              state: raw.state || 'PA',
              lat: raw.lat ?? null,
              lng: raw.lng ?? null,
              timestamp: new Date().toISOString(),
              source: raw.source || 'pulsepoint',
              severity_score: raw.severity_score ?? 8,
              damage_probability: raw.damage_probability ?? 85,
            };

            // Deduplicate
            const isDupe = incidentStore.some(
              (i) => i.address === incident.address && i.incident_type === incident.incident_type &&
                     Date.now() - new Date(i.timestamp).getTime() < 3600000
            );
            if (isDupe) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true, skipped: true, reason: 'duplicate within 1hr' }));
              return;
            }

            incidentStore.push(incident);
            console.log(`\n[INCIDENT] 🔥 New fire detected: ${incident.address}, ${incident.city}, ${incident.state} (${incident.incident_type}, severity=${incident.severity_score})`);

            // Full pipeline: lead creation → skip trace → routing → email
            const lead = await incidentToLead(incident, server);

            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 201;
            res.end(JSON.stringify({ ok: true, incident, lead: lead || null }));
          } catch (err) {
            console.error('[TEST] Error:', err);
            res.statusCode = 400;
            res.end(JSON.stringify({ error: err.message || 'Invalid JSON' }));
          }
        });
      });

      // POST /api/incidents/fire/ingest-csv — ingest from the real RAW_FIRE_INCIDENTS CSV
      // Query params: ?limit=500 (default) &offset=0
      server.middlewares.use('/api/incidents/fire/ingest-csv', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'POST only' }));
          return;
        }

        const csvPath = path.join(__dirname, '..', '..', 'RAW_FIRE_INCIDENTS_2026-03-31.csv');
        if (!fs.existsSync(csvPath)) {
          // Try Desktop
          const alt = path.join(process.env.HOME || '', 'Desktop', 'RAW_FIRE_INCIDENTS_2026-03-31.csv');
          if (!fs.existsSync(alt)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'RAW_FIRE_INCIDENTS CSV not found' }));
            return;
          }
          // use alt below
        }
        const finalPath = fs.existsSync(csvPath) ? csvPath : path.join(process.env.HOME || '', 'Desktop', 'RAW_FIRE_INCIDENTS_2026-03-31.csv');

        const url = new URL(req.url, 'http://localhost');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '500', 10), 5000);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        const chunkSize = 50; // smaller chunks to not overload SkipSherpa

        // Parse CSV
        const raw = fs.readFileSync(finalPath, 'utf-8');
        const lines = raw.split('\n').filter((l) => l.trim());
        const header = lines[0].split(',');
        const rows = lines.slice(1 + offset, 1 + offset + limit);

        function parseCSVRow(line) {
          const values = [];
          let current = '';
          let inQuotes = false;
          for (const ch of line) {
            if (ch === '"') { inQuotes = !inQuotes; continue; }
            if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
            current += ch;
          }
          values.push(current.trim());
          return values;
        }

        const feed = rows.map((line) => {
          const v = parseCSVRow(line);
          return {
            incident_id: v[0] || '',
            full_address: v[1] || '',
            city: v[2] || '',
            state: v[3] || '',
            zip: v[4] || '',
            call_type: v[5] || '',
            description: v[6] || '',
            timestamp: v[7] || '',
            source: v[8] || 'pulsepoint',
          };
        }).filter((r) => r.full_address && ['SF', 'RF', 'WF'].includes(r.call_type));

        console.log(`\n[INGEST-CSV] Starting: ${feed.length} real incidents (offset=${offset}, limit=${limit}, chunks of ${chunkSize})`);
        console.log(`[INGEST-CSV] CSV total rows: ${lines.length - 1}`);

        (async () => {
          let created = 0, skipped = 0, skipTraced = 0, phonesFound = 0;
          const totalChunks = Math.ceil(feed.length / chunkSize);

          for (let c = 0; c < totalChunks; c++) {
            const chunk = feed.slice(c * chunkSize, (c + 1) * chunkSize);
            console.log(`[INGEST-CSV] Batch ${c + 1}/${totalChunks} — ${chunk.length} incidents`);

            for (const raw of chunk) {
              // Extract street from full_address (remove city/state suffix)
              const addrParts = raw.full_address.split(',').map((s) => s.trim());
              const street = addrParts[0] || raw.full_address;

              let severity_score = 5;
              let damage_probability = 50;
              if (raw.call_type === 'SF') { severity_score = 8; damage_probability = 85; }
              else if (raw.call_type === 'WF') { severity_score = 7; damage_probability = 75; }
              else if (raw.call_type === 'RF') { severity_score = 6; damage_probability = 65; }

              const incident = {
                id: raw.incident_id || `inc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                type: 'fire',
                incident_type: raw.description || 'Structure Fire',
                address: street,
                city: raw.city,
                state: raw.state,
                lat: null,
                lng: null,
                timestamp: raw.timestamp || new Date().toISOString(),
                source: 'pulsepoint',
                severity_score,
                damage_probability,
              };

              // Dedup by address within 10 min
              const isDupe = incidentStore.some(
                (i) => i.address === incident.address && i.city === incident.city &&
                       Date.now() - new Date(i.timestamp).getTime() < 600000
              );
              if (isDupe) { skipped++; continue; }

              incidentStore.push(incident);
              const lead = await incidentToLead(incident, server);
              if (lead) {
                created++;
                if (lead.skip_traced) skipTraced++;
                if (lead.phone) phonesFound++;
              } else {
                skipped++;
              }
            }

            console.log(`[INGEST-CSV] Batch ${c + 1} complete — created=${created} phones=${phonesFound}`);
          }

          // Read final file stats
          let fileLeads = [];
          try { fileLeads = JSON.parse(fs.readFileSync(FIRE_LEADS_PATH, 'utf-8')); } catch {}
          const totalWithPhone = fileLeads.filter((l) => l.phone).length;

          console.log(`\n[INGEST-CSV] ═══════════════════════════════════`);
          console.log(`[INGEST-CSV] COMPLETED`);
          console.log(`[INGEST-CSV]   Real incidents processed: ${feed.length}`);
          console.log(`[INGEST-CSV]   Leads created: ${created}`);
          console.log(`[INGEST-CSV]   Skip traces: ${skipTraced}`);
          console.log(`[INGEST-CSV]   Phones found: ${phonesFound}`);
          console.log(`[INGEST-CSV]   Skipped/dupes: ${skipped}`);
          console.log(`[INGEST-CSV]   Total in file: ${fileLeads.length}`);
          console.log(`[INGEST-CSV]   Total with phone: ${totalWithPhone}`);
          console.log(`[INGEST-CSV] ═══════════════════════════════════`);

          // Send ONE email with the full updated CSV
          if (phonesFound > 0) {
            regenerateCallSheet(true);
          }
        })();

        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 202;
        res.end(JSON.stringify({
          ok: true,
          message: `Ingesting ${feed.length} real PulsePoint incidents (offset=${offset}, limit=${limit}). Check server logs.`,
          csv_total: lines.length - 1,
          processing: feed.length,
          chunk_size: chunkSize,
        }));
      });

      // POST /api/incidents/fire/backfill — scalable batch processing (generated addresses)
      // Query params: ?limit=500 (default), processed in chunks of 100
      server.middlewares.use('/api/incidents/fire/backfill', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'POST only' }));
          return;
        }

        const url = new URL(req.url, `http://localhost`);
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '500', 10), 10000);
        const chunkSize = 100;

        // Generate realistic Bucks/Montgomery/Philadelphia fire incidents
        const streetPrefixes = ['N','S','E','W',''];
        const streetNames = [
          'Main','Oak','Elm','Pine','Maple','Cedar','Walnut','Birch','Spruce','Chestnut',
          'Willow','Ash','Hickory','Poplar','Sycamore','Laurel','Magnolia','Dogwood',
          'Cherry','Cypress','Beech','Alder','Hemlock','Sequoia','Fir','Linden','Holly',
          'Hazel','Ivy','Palm','Olive','Pecan','Aspen','Bayberry','Mulberry','Catalpa',
          'Buckeye','Sumac','Tamarack','Yew','Larch','Locust','Juniper','Redwood',
          'Buttonwood','Sassafras','Sweetgum','Cottonwood','Tulip','Persimmon',
        ];
        const streetTypes = ['St','Ave','Dr','Rd','Ln','Ct','Way','Blvd','Pl','Ter'];
        const cities = [
          { city:'Newtown', state:'PA', lat:40.229, lng:-74.937 },
          { city:'Doylestown', state:'PA', lat:40.310, lng:-75.130 },
          { city:'Warminster', state:'PA', lat:40.189, lng:-75.089 },
          { city:'Langhorne', state:'PA', lat:40.175, lng:-74.923 },
          { city:'Holland', state:'PA', lat:40.245, lng:-74.953 },
          { city:'Yardley', state:'PA', lat:40.245, lng:-74.840 },
          { city:'Morrisville', state:'PA', lat:40.207, lng:-74.789 },
          { city:'Bristol', state:'PA', lat:40.100, lng:-74.851 },
          { city:'Levittown', state:'PA', lat:40.155, lng:-74.829 },
          { city:'Abington', state:'PA', lat:40.114, lng:-75.118 },
          { city:'Bensalem', state:'PA', lat:40.107, lng:-74.951 },
          { city:'Quakertown', state:'PA', lat:40.441, lng:-75.341 },
          { city:'Perkasie', state:'PA', lat:40.372, lng:-75.257 },
          { city:'Chalfont', state:'PA', lat:40.288, lng:-75.210 },
          { city:'Hatboro', state:'PA', lat:40.176, lng:-75.107 },
        ];
        const types = ['Structure Fire','Working Fire','Residential Fire'];

        const feed = [];
        for (let i = 0; i < limit; i++) {
          const num = 10 + Math.floor(Math.random() * 2990);
          const pre = streetPrefixes[Math.floor(Math.random() * streetPrefixes.length)];
          const name = streetNames[Math.floor(Math.random() * streetNames.length)];
          const typ = streetTypes[Math.floor(Math.random() * streetTypes.length)];
          const street = `${num} ${pre ? pre + ' ' : ''}${name} ${typ}`.replace(/\s+/g, ' ');
          const loc = cities[Math.floor(Math.random() * cities.length)];
          feed.push({
            type_desc: types[Math.floor(Math.random() * types.length)],
            address: street, city: loc.city, state: loc.state,
            lat: loc.lat + (Math.random() - 0.5) * 0.03,
            lng: loc.lng + (Math.random() - 0.5) * 0.03,
            ts: Date.now() - Math.floor(Math.random() * 86400000),
          });
        }

        console.log(`\n[BACKFILL] Starting: ${feed.length} incidents in chunks of ${chunkSize}`);

        // Process in background — respond immediately
        (async () => {
          let created = 0, skipped = 0, skipTraced = 0, phonesFound = 0;
          const totalChunks = Math.ceil(feed.length / chunkSize);

          for (let c = 0; c < totalChunks; c++) {
            const chunk = feed.slice(c * chunkSize, (c + 1) * chunkSize);
            console.log(`[BACKFILL] Batch ${c + 1}/${totalChunks} — processing ${chunk.length} incidents`);

            for (const raw of chunk) {
              const id = `inc_${raw.ts}_${Math.random().toString(36).slice(2, 7)}`;
              let severity_score = 5;
              if (raw.type_desc === 'Structure Fire') severity_score = 8;
              else if (raw.type_desc === 'Working Fire') severity_score = 7;
              else if (raw.type_desc === 'Residential Fire') severity_score = 6;
              let damage_probability = 50;
              if (raw.type_desc === 'Structure Fire') damage_probability = 85;
              else if (raw.type_desc === 'Working Fire') damage_probability = 75;
              else if (raw.type_desc === 'Residential Fire') damage_probability = 65;

              const incident = {
                id, type: 'fire', incident_type: raw.type_desc,
                address: raw.address, city: raw.city, state: raw.state,
                lat: raw.lat, lng: raw.lng,
                timestamp: new Date(raw.ts).toISOString(),
                source: 'pulsepoint', severity_score, damage_probability,
              };

              const isDupe = incidentStore.some(
                (i) => i.address === incident.address && i.incident_type === incident.incident_type &&
                       Date.now() - new Date(i.timestamp).getTime() < 600000
              );
              if (isDupe) { skipped++; continue; }

              incidentStore.push(incident);
              const lead = await incidentToLead(incident, server);
              if (lead) {
                created++;
                if (lead.skip_traced) skipTraced++;
                if (lead.phone) phonesFound++;
              } else {
                skipped++;
              }
            }

            console.log(`[BACKFILL] Batch ${c + 1} complete — created=${created} skipped=${skipped} phones=${phonesFound}`);
          }

          console.log(`\n[BACKFILL] ═══════════════════════════════════`);
          console.log(`[BACKFILL] COMPLETED`);
          console.log(`[BACKFILL]   Incidents processed: ${feed.length}`);
          console.log(`[BACKFILL]   Leads created: ${created}`);
          console.log(`[BACKFILL]   Skip traces: ${skipTraced}`);
          console.log(`[BACKFILL]   Phones found: ${phonesFound}`);
          console.log(`[BACKFILL]   Skipped/dupes: ${skipped}`);
          console.log(`[BACKFILL] ═══════════════════════════════════`);

          if (phonesFound > 0) {
            regenerateCallSheet(true);
          }
        })();

        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 202;
        res.end(JSON.stringify({
          ok: true,
          message: `Backfill started: ${feed.length} incidents in ${Math.ceil(feed.length / chunkSize)} batches of ${chunkSize}. Check server logs.`,
          total_incidents: feed.length,
          chunk_size: chunkSize,
        }));
      });

      // GET /api/incidents/fire/refresh — batch ingest from PulsePoint-style feed
      server.middlewares.use('/api/incidents/fire/refresh', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        // PulsePoint mock feed — replace with real fetch() when API access is secured.
        const mockFeed = [
          { type_desc: 'Structure Fire', address: '247 State St', city: 'Newtown', state: 'PA', lat: 40.2290, lng: -74.9370, ts: Date.now() - 1200000 },
          { type_desc: 'Working Fire', address: '812 Buck Rd', city: 'Holland', state: 'PA', lat: 40.2455, lng: -74.9530, ts: Date.now() - 600000 },
          { type_desc: 'Residential Fire', address: '55 Cherry Ln', city: 'Doylestown', state: 'PA', lat: 40.3101, lng: -75.1299, ts: Date.now() - 180000 },
          { type_desc: 'Vehicle Fire', address: '100 Main St', city: 'Warrington', state: 'PA', lat: 40.2491, lng: -75.1345, ts: Date.now() - 90000 },
          { type_desc: 'Structure Fire', address: '1400 Old York Rd', city: 'Abington', state: 'PA', lat: 40.1145, lng: -75.1177, ts: Date.now() - 30000 },
        ];

        const validTypes = new Set(['Structure Fire', 'Working Fire', 'Residential Fire']);
        let ingested = 0;
        const leads = [];

        for (const raw of mockFeed) {
          if (!validTypes.has(raw.type_desc)) continue;

          const id = `inc_${raw.ts}_${Math.random().toString(36).slice(2, 7)}`;
          let severity_score = 5;
          if (raw.type_desc === 'Structure Fire') severity_score = 8;
          else if (raw.type_desc === 'Working Fire') severity_score = 7;
          else if (raw.type_desc === 'Residential Fire') severity_score = 6;

          let damage_probability = 50;
          if (raw.type_desc === 'Structure Fire') damage_probability = 85;
          else if (raw.type_desc === 'Working Fire') damage_probability = 75;
          else if (raw.type_desc === 'Residential Fire') damage_probability = 65;

          const incident = {
            id, type: 'fire', incident_type: raw.type_desc,
            address: raw.address, city: raw.city, state: raw.state,
            lat: raw.lat, lng: raw.lng,
            timestamp: new Date(raw.ts).toISOString(),
            source: 'pulsepoint', severity_score, damage_probability,
          };

          const isDupe = incidentStore.some(
            (i) => i.address === incident.address && i.incident_type === incident.incident_type &&
                   Date.now() - new Date(i.timestamp).getTime() < 3600000
          );
          if (isDupe) continue;

          incidentStore.push(incident);
          ingested++;
          console.log(`\n[INCIDENT] 🔥 New fire detected: ${incident.address}, ${incident.city}, ${incident.state} (${incident.incident_type}, severity=${incident.severity_score})`);

          // Full pipeline: await so skip trace completes before next incident
          const lead = await incidentToLead(incident, server);
          if (lead) leads.push(lead);
        }

        console.log(`\n[INCIDENT] Refresh complete: ${ingested} new incidents, ${leads.length} leads created, ${incidentStore.length} total incidents`);

        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true, ingested, leads_created: leads.length, total_incidents: incidentStore.length, leads }));
      });

      server.middlewares.use('/api/incidents/fire', (req, res) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ incidents: incidentStore, total: incidentStore.length }));
          return;
        }

        // POST — manual incident injection (for RIN pipeline or testing)
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              const id = `inc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              const incident = {
                id,
                type: 'fire',
                incident_type: data.incident_type || 'Structure Fire',
                address: data.address || null,
                city: data.city || null,
                state: data.state || null,
                lat: data.lat ?? null,
                lng: data.lng ?? null,
                timestamp: data.timestamp || new Date().toISOString(),
                source: data.source || 'manual',
                severity_score: data.severity_score ?? 5,
                damage_probability: data.damage_probability ?? 50,
              };
              incidentStore.push(incident);
              console.log(`[INCIDENT] 🔥 New fire detected: ${incident.address}, ${incident.city}, ${incident.state}`);

              // Full pipeline: lead → skip trace → email
              const lead = await incidentToLead(incident, server);

              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 201;
              res.end(JSON.stringify({ ok: true, id, incident, lead: lead || null }));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'Method not allowed' }));
      });

    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), mockApi()],
})
