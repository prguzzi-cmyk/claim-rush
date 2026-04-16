/**
 * Lead assignment and escalation logic for RIN / ClaimRush.
 *
 * When a lead is created, it is assigned to the lowest available role (agent)
 * and can be escalated up the chain: agent → rvp → cp → home_office
 */

let _resend = null;
function getResend() {
  if (_resend) return _resend;
  const key = typeof process !== 'undefined' && process.env?.RESEND_API_KEY;
  if (!key) return null;
  try {
    const { Resend } = require('resend');
    _resend = new Resend(key);
    return _resend;
  } catch { return null; }
}

const ESCALATION_CHAIN = ['agent', 'rvp', 'cp', 'home_office'];

/**
 * Assign a lead to the initial handler.
 * Mutates the lead object in place and returns it.
 */
export function assignLead(lead) {
  lead.assigned_role = lead.assigned_role || 'agent';
  lead.assigned_user_id = lead.assigned_user_id || null;
  lead.escalation_level = 1;
  lead.status = lead.status || 'new';

  if (lead.assigned_role === 'agent') {
    sendLeadToAgent(lead);
  }

  return lead;
}

/**
 * Delivery trigger — fires when a lead is assigned to an agent.
 * Sends real email via Resend if phone exists.
 */
export function sendLeadToAgent(lead) {
  if (!lead.phone) {
    console.log(`[DELIVER] Skipped — no phone: ${lead.address || '(no address)'}`);
    return;
  }

  console.log(`[DELIVER] Sending lead to agent: ${lead.address || '?'} | ${lead.phone}`);

  const resend = getResend();
  if (!resend) {
    console.warn('[DELIVER] RESEND_API_KEY not available — email skipped');
    return;
  }

  const lines = [];
  if (lead.address) lines.push(`Address: ${lead.address}`);
  if (lead.city) lines.push(`City: ${lead.city}`);
  if (lead.state) lines.push(`State: ${lead.state}`);
  if (lead.name || lead.owner_name) lines.push(`Owner: ${lead.name || lead.owner_name}`);
  if (lead.phone) lines.push(`Phone: ${lead.phone}`);
  if (lead.incident_type) lines.push(`Incident: ${lead.incident_type}`);

  const body = `New fire lead assigned to you.\n\n${lines.join('\n')}\n\n⚠️ FORWARD TO: makmin@upaclaim.org`;

  resend.emails.send({
    from: 'ClaimRush <onboarding@resend.dev>',
    to: 'prguzzi@gmail.com',
    subject: '🔥 New Fire Lead - Immediate Action',
    text: body,
  }).then(() => {
    console.log(`[DELIVER] EMAIL SENT: ${lead.address} | ${lead.phone}`);
  }).catch((err) => {
    console.error(`[DELIVER] EMAIL FAILED:`, err?.message || err);
  });
}

/**
 * Escalate a lead one level up the chain.
 * Returns true if escalated, false if already at top.
 */
export function escalateLead(lead) {
  const current = ESCALATION_CHAIN.indexOf(lead.assigned_role);
  if (current < 0 || current >= ESCALATION_CHAIN.length - 1) return false;
  lead.assigned_role = ESCALATION_CHAIN[current + 1];
  lead.escalation_level = current + 2;
  lead.assigned_user_id = null;
  return true;
}

export { ESCALATION_CHAIN };
