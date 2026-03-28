import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, of, interval } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';

/** PulsePoint call types that qualify as fire leads. */
const FIRE_LEAD_CALL_TYPES = new Set([
  'SF', 'CF', 'RF', 'WSF', 'WCF', 'WRF', 'FIRE', 'FULL', 'EXP', 'ELF',
  'FA', 'BA',
]);

/** Call types classified as high severity (vs moderate). */
const HIGH_SEVERITY_CALL_TYPES = new Set([
  'SF', 'CF', 'RF', 'WSF', 'WCF', 'WRF', 'FIRE', 'FULL', 'EXP',
]);

export interface IntelligenceLead {
  id: string;
  opportunityId?: string;
  incidentType: string;
  address: string;
  city: string;
  state: string;
  dateDetected: string;
  leadStatus: string;
  assignedAgent: string;
  assignedAgentId: string;
  estimatedValue: number;
  opportunityScore: number;
  damageProbability: number;
  source: string;
  territoryName: string;
  assignmentReason: string;
  /** Backend lead UUID — set after backend creation */
  backendLeadId?: string;
  /** Outreach tracking */
  outreachStatus?: 'none' | 'pending' | 'in-progress' | 'completed';
  lastContactAttempt?: string;
  /** Compliance */
  consentStatus?: 'yes' | 'no' | 'unknown';
  dncChecked?: boolean;
  dncStatus?: 'clear' | 'listed' | 'unknown';
  outreachBlockedReason?: string | null;
  /** Lead scoring */
  leadScore?: number;
  leadScoreTier?: 'HIGH' | 'STRONG' | 'MEDIUM' | 'LOW';
}

const STORAGE_KEY = 'upa_lead_intelligence_v2';

@Injectable({ providedIn: 'root' })
export class LeadIntelligenceService {
  private leads$ = new BehaviorSubject<IntelligenceLead[]>([]);

  /** Emits after a lead is created in the backend via POST /leads.
   *  The Leads page subscribes to this to refresh its table. */
  leadCreatedInBackend$ = new Subject<string>();

  constructor(private http: HttpClient) {
    try { localStorage.removeItem('upa_lead_intelligence'); } catch {}
    this.loadFromStorage();
    this.fetchFromBackend();
    this.ingestFireIncidents();

    // Re-ingest fire incidents every 60s to stay in sync with polling
    interval(60_000).pipe(
      switchMap(() => this.fetchAndIngestFire()),
    ).subscribe();
  }

  getLeads(): Observable<IntelligenceLead[]> {
    return this.leads$.asObservable();
  }

  getSnapshot(): IntelligenceLead[] {
    return this.leads$.getValue();
  }

  // ── Create lead in backend + local state ─────────────────────

  /**
   * Create a lead in the backend database AND update local state.
   *
   * IMPORTANT: This always POSTs to the backend even if the lead already
   * exists in local state (leads$).  Local-only leads (from fire ingestion)
   * must be persisted to the backend so they appear in the main Leads table.
   * The backend deduplicates by ref_number, not by our local ID.
   */
  createLead(lead: IntelligenceLead): Observable<IntelligenceLead> {
    if (!this.isValid(lead)) return of(lead);

    // Skip if we already created this lead in the backend (has a backend UUID)
    if (lead.backendLeadId) {
      console.log('[LeadIntel] createLead skipped — already has backendLeadId:', lead.backendLeadId);
      return of(lead);
    }

    // Build the backend LeadCreate payload
    // Backend requires 'callback' as entry status (LeadStatusCreate enum)
    const payload = {
      peril: this.mapPeril(lead.incidentType),
      status: 'callback',
      source_info: lead.source.includes('intelligence') ? lead.source : `${lead.source}-intelligence`,
      instructions_or_notes:
        `Created from ${lead.source} Intelligence\n` +
        `Event: ${lead.incidentType} | Score: ${lead.opportunityScore}\n` +
        `Damage Prob: ${Math.round(lead.damageProbability * 100)}%\n` +
        `Est Value: $${Math.round(lead.estimatedValue).toLocaleString()}\n` +
        `Location: ${lead.address}, ${lead.city}, ${lead.state}`,
      contact: {
        full_name: 'Property Owner',
        phone_number: 'N/A',
        address_loss: lead.address || lead.city,
        city_loss: lead.city,
        state_loss: lead.state,
      },
    };

    // If an agent was assigned via rotation, include in the backend lead
    if (lead.assignedAgentId) {
      (payload as any).assigned_to = lead.assignedAgentId;
    }

    console.log('[LeadIntel] createLead POST /leads:', {
      type: lead.incidentType, state: lead.state, peril: payload.peril,
      assigned_to: lead.assignedAgentId || 'none',
    });

    return this.http.post<any>('leads', payload).pipe(
      tap(response => {
        const backendId = response?.id || response?.lead?.id;
        lead.backendLeadId = backendId;

        // Only set defaults for fields that haven't been set by the caller
        if (!lead.leadStatus || lead.leadStatus === 'new') lead.leadStatus = 'new';
        if (!lead.outreachStatus) lead.outreachStatus = 'none';
        if (!lead.consentStatus) lead.consentStatus = 'unknown';
        if (lead.dncChecked === undefined) lead.dncChecked = false;
        if (!lead.dncStatus) lead.dncStatus = 'unknown';
        lead.outreachBlockedReason = lead.outreachBlockedReason ?? null;
        this.scoreLead(lead);

        // Update the lead in the existing array (don't prepend a duplicate)
        const leads = this.leads$.getValue();
        const idx = leads.findIndex(l => l.id === lead.id);
        if (idx !== -1) {
          leads[idx] = { ...lead };
        } else {
          leads.unshift({ ...lead });
        }
        this.leads$.next([...leads]);
        this.saveToStorage(leads);

        console.log(
          '[LeadIntel] Lead created in backend: id=%s backendId=%s type=%s agent=%s | leads array length=%d',
          lead.id, backendId, lead.incidentType, lead.assignedAgent || 'none', leads.length,
        );

        // Notify Leads page to refresh
        this.leadCreatedInBackend$.next(backendId);
      }),
      map(() => lead),
      catchError(err => {
        console.warn('[LeadIntel] Backend POST /leads failed:', err?.status, err?.error?.detail || err?.message);
        // Still update local state so Lead Intelligence shows it
        this.updateLeadLocal(lead);
        return of(lead);
      }),
    );
  }

  /**
   * Queue a lead for outreach (SMS/voice/email).
   * Updates local state immediately and persists.
   */
  queueOutreach(leadId: string): Observable<IntelligenceLead | null> {
    const leads = this.leads$.getValue();
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return of(null);

    // Update local state immediately
    lead.outreachStatus = 'pending';
    lead.lastContactAttempt = new Date().toISOString();
    this.leads$.next([...leads]);
    this.saveToStorage(leads);

    console.log('[Outreach] Lead queued:', leadId, lead.incidentType, lead.city, lead.state);

    // If we have a backend lead ID, update the backend too
    const backendId = lead.backendLeadId || lead.id;
    return this.http.put<any>(`leads/${backendId}`, {
      status: 'callback',
      instructions_or_notes:
        (lead as any).raw_notes || '' +
        `\n--- Activated at ${new Date().toISOString()} ---`,
    }).pipe(
      map(() => lead),
      catchError(() => {
        // Backend update failed, local state is already updated
        return of(lead);
      }),
    );
  }

  /**
   * Update a lead in local state and persist. Replaces the lead object
   * in the array with a shallow copy so Angular change detection picks
   * up the mutation.
   */
  updateLeadLocal(lead: IntelligenceLead): void {
    const leads = this.leads$.getValue();
    const idx = leads.findIndex(l => l.id === lead.id);
    if (idx !== -1) {
      leads[idx] = { ...lead };
    }
    const updated = [...leads];
    this.leads$.next(updated);
    this.saveToStorage(updated);
  }

  // ── Lead Scoring ──────────────────────────────────────────────

  /**
   * Compute a 0-100 score for a lead based on weighted factors.
   * Automatically sets leadScore and leadScoreTier on the lead object.
   */
  scoreLead(lead: IntelligenceLead): number {
    let score = 0;

    // 1. Damage type (max 40)
    const type = (lead.incidentType || '').toLowerCase();
    if (type === 'fire' || type === 'arson') score += 40;
    else if (['hail', 'wind', 'tornado', 'hurricane', 'storm'].includes(type)) score += 30;
    else if (['water', 'flood', 'flooding'].includes(type)) score += 20;
    else if (['theft', 'vandalism', 'burglary', 'crime', 'break_in'].includes(type)) score += 15;
    else score += 10;

    // 2. Insurance status (max 25) — infer from consentStatus or source
    if (lead.consentStatus === 'yes') score += 25;
    else if (lead.consentStatus === 'unknown') score += 10;
    // 'no' = 0

    // 3. Property value proxy (max 20) — based on estimatedValue
    if (lead.estimatedValue >= 100000) score += 20;
    else if (lead.estimatedValue >= 30000) score += 10;
    else if (lead.estimatedValue > 0) score += 5;

    // 4. Urgency (max 15) — based on outreach status and lead status
    const outreach = lead.outreachStatus || 'none';
    if (outreach === 'pending' || outreach === 'in-progress') score += 15;
    else if (lead.leadStatus === 'new' || lead.leadStatus === 'callback') score += 10;
    else score += 5;

    // 5. Intake completeness (max 10) — based on opportunity score presence
    if (lead.opportunityScore > 0 && lead.address && lead.city) score += 10;
    else if (lead.opportunityScore > 0 || lead.address) score += 5;

    // Cap at 100
    score = Math.min(score, 100);

    // Set tier
    const tier: 'HIGH' | 'STRONG' | 'MEDIUM' | 'LOW' =
      score >= 80 ? 'HIGH' : score >= 60 ? 'STRONG' : score >= 40 ? 'MEDIUM' : 'LOW';

    lead.leadScore = score;
    lead.leadScoreTier = tier;
    return score;
  }

  /**
   * Score all leads in the current set.
   */
  scoreAllLeads(): void {
    const leads = this.leads$.getValue();
    for (const lead of leads) {
      this.scoreLead(lead);
    }
    this.leads$.next([...leads]);
    this.saveToStorage(leads);
  }

  /**
   * Check compliance before outreach. Returns null if allowed, or a block reason string.
   */
  checkCompliance(lead: IntelligenceLead): string | null {
    if (lead.consentStatus === 'no') return 'no consent';
    if (lead.consentStatus === 'unknown') return 'consent unknown';
    if (!lead.dncChecked) return 'DNC not checked';
    if (lead.dncStatus === 'listed') return 'number is on DNC list';
    return null;
  }

  /**
   * Log a compliance audit event.
   */
  logComplianceAudit(leadId: string, action: string, allowed: boolean, reason?: string): void {
    const entry = {
      timestamp: new Date().toISOString(),
      leadId,
      action,
      allowed,
      blockedReason: reason || null,
    };
    if (allowed) {
      console.log('[Compliance] Outreach allowed for lead', leadId);
    } else {
      console.log('[Compliance] Outreach blocked for lead', leadId + ':', reason);
    }
    // Append to localStorage audit log
    try {
      const key = 'upa_compliance_audit';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push(entry);
      // Keep last 200 entries
      if (existing.length > 200) existing.splice(0, existing.length - 200);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch { /* non-critical */ }
  }

  /**
   * Add lead to local state only (used by Opportunity Scoring which
   * already creates the backend lead via assign-agent endpoint).
   */
  addLead(lead: IntelligenceLead): void {
    if (!this.isValid(lead)) {
      console.warn('[LeadIntel] addLead rejected (invalid):', {
        id: lead.id, type: lead.incidentType, state: lead.state,
        score: lead.opportunityScore, value: lead.estimatedValue,
        reason: !lead.id ? 'no id' : !lead.state ? 'no state' : !lead.incidentType ? 'no type' : 'no score/value',
      });
      return;
    }
    const current = this.leads$.getValue();
    if (this.isDuplicate(lead, current)) return;
    this.scoreLead(lead);
    const updated = [lead, ...current];
    this.leads$.next(updated);
    this.saveToStorage(updated);
  }

  hasLeadForOpportunity(opportunityId: string): boolean {
    if (!opportunityId) return false;
    return this.leads$.getValue().some(l => l.opportunityId === opportunityId);
  }

  // ── Fire incident ingestion ────────────────────────────────────

  /**
   * Fetch fire incidents from the backend API and ingest qualifying
   * ones as leads.  Runs on service init and every 60 s — independent
   * of which page the user is viewing.
   */
  private ingestFireIncidents(): void {
    this.fetchAndIngestFire().subscribe();
  }

  private fetchAndIngestFire(): Observable<void> {
    const dateFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const callTypes = Array.from(FIRE_LEAD_CALL_TYPES).join(',');

    const params = new HttpParams()
      .set('page', '1')
      .set('size', '500')
      .set('call_type', callTypes)
      .set('date_from', dateFrom);

    return this.http.get<any>('fire-incidents', { params }).pipe(
      map(resp => {
        const items: any[] = resp?.items || [];
        let ingested = 0;

        for (const fi of items) {
          if (!fi.id || !FIRE_LEAD_CALL_TYPES.has(fi.call_type)) continue;

          // State: agency.state is the reliable source
          const agencyState: string = fi.agency?.state || '';
          const parts = (fi.address || '').split(',').map((s: string) => s.trim());
          const street = parts[0] || fi.address || '';
          const city = parts.length >= 2 ? parts[parts.length - 2] : '';
          const addressState = parts.length >= 3 ? parts[parts.length - 1] : '';
          const state = agencyState || addressState;

          if (!state) continue;

          const isHigh = HIGH_SEVERITY_CALL_TYPES.has(fi.call_type);

          const lead: IntelligenceLead = {
            id: fi.id,
            incidentType: 'fire',
            address: street,
            city,
            state,
            dateDetected: fi.received_at ? fi.received_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
            leadStatus: 'new',
            assignedAgent: '',
            assignedAgentId: '',
            estimatedValue: isHigh ? 50000 : 15000,
            opportunityScore: isHigh ? 85 : 55,
            damageProbability: isHigh ? 0.9 : 0.5,
            source: 'fire-intelligence',
            territoryName: '',
            assignmentReason: fi.call_type_description || fi.call_type,
          };

          this.addLead(lead);
          ingested++;
        }

        const fireCount = this.leads$.getValue().filter(l => l.incidentType === 'fire').length;
        console.log(
          `[LeadIntel] Fire ingestion: ${items.length} fetched, ${ingested} processed, ` +
          `${fireCount} fire leads now in dataset`
        );

        if (ingested > 0) {
          const sample = this.leads$.getValue().find(l => l.incidentType === 'fire');
          if (sample) {
            console.log('[LeadIntel] Sample fire lead:', JSON.stringify({
              id: sample.id, type: sample.incidentType,
              address: sample.address, city: sample.city, state: sample.state,
              score: sample.leadScore, tier: sample.leadScoreTier,
              date: sample.dateDetected,
            }));
          }
        }
      }),
      catchError(err => {
        console.warn('[LeadIntel] Fire incident fetch failed:', err?.message);
        return of(undefined);
      }),
    );
  }

  // ── Peril mapping ──────────────────────────────────────────────

  private mapPeril(incidentType: string): string {
    const map: Record<string, string> = {
      // Fire types — all PulsePoint fire/alarm descriptions normalize to "fire"
      fire: 'fire', arson: 'fire',
      'structure fire': 'fire', 'commercial fire': 'fire', 'residential fire': 'fire',
      'fire alarm': 'fire', alarm: 'fire', 'building alarm': 'fire',
      'electrical fire': 'fire', 'working fire': 'fire',
      'confirmed structure fire': 'fire', 'working commercial fire': 'fire',
      'working residential fire': 'fire',
      // Storm types
      hail: 'hail', wind: 'wind', tornado: 'wind', hurricane: 'wind',
      flooding: 'flood', flood: 'flood',
      // Crime types
      theft: 'theft', burglary: 'theft', robbery: 'theft',
      vandalism: 'vandalism', property_damage: 'vandalism',
      break_in: 'theft', forced_entry: 'theft',
      crime: 'theft', roof: 'hail',
      lightning: 'lightning',
    };
    return map[incidentType?.toLowerCase()] || 'other';
  }

  // ── Validation ─────────────────────────────────────────────────

  private isValid(l: IntelligenceLead): boolean {
    if (!l.id) return false;
    if (!l.state) return false;
    if (!l.incidentType) return false;
    if (l.opportunityScore <= 0 && l.estimatedValue <= 0) return false;
    return true;
  }

  private isDuplicate(lead: IntelligenceLead, existing: IntelligenceLead[]): boolean {
    if (existing.some(l => l.id === lead.id)) return true;
    if (lead.opportunityId && existing.some(l => l.opportunityId === lead.opportunityId)) return true;
    const key = this.dedupeKey(lead);
    if (existing.some(l => this.dedupeKey(l) === key)) return true;
    return false;
  }

  private dedupeKey(l: IntelligenceLead): string {
    const addr = (l.address || l.city || '').toUpperCase().trim().replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ');
    const type = (l.incidentType || '').toLowerCase();
    const state = (l.state || '').toUpperCase();
    const date = l.dateDetected || '';
    return `${addr}|${type}|${state}|${date}`;
  }

  // ── Backend fetch ──────────────────────────────────────────────

  fetchFromBackend(): void {
    const params = new HttpParams()
      .set('page', '1')
      .set('size', '100')
      .set('sort_by', 'created_at')
      .set('order_by', 'desc');

    this.http.get<any>('leads', { params }).pipe(
      map((resp: any) => {
        const items = resp?.items || resp || [];
        return items
          .filter((l: any) => {
            const src = l.source_info || '';
            return src.includes('intelligence') || src.includes('opportunity-scoring');
          })
          .map((l: any) => this.mapBackendLead(l))
          .filter((l: IntelligenceLead) => this.isValid(l));
      }),
      catchError(() => of([])),
    ).subscribe((backendLeads: IntelligenceLead[]) => {
      if (backendLeads.length === 0) return;

      const local = this.leads$.getValue();
      const backendIds = new Set(backendLeads.map(l => l.id));
      const localOnly = local.filter(l => !backendIds.has(l.id));

      const merged: IntelligenceLead[] = [];
      const seenKeys = new Set<string>();

      for (const l of [...backendLeads, ...localOnly]) {
        const key = this.dedupeKey(l);
        if (seenKeys.has(key)) continue;
        if (merged.some(m => m.id === l.id)) continue;
        seenKeys.add(key);
        merged.push(l);
      }

      merged.sort((a, b) => new Date(b.dateDetected).getTime() - new Date(a.dateDetected).getTime());
      this.leads$.next(merged);
      this.saveToStorage(merged);
    });
  }

  private mapBackendLead(l: any): IntelligenceLead {
    const contact = l.contact || {};
    const notes: string = l.instructions_or_notes || '';

    const scoreMatch = notes.match(/Score:\s*(\d+)/);
    const valueMatch = notes.match(/Est Value:\s*\$?([\d,]+)/);
    const dmgMatch = notes.match(/Damage Prob:\s*(\d+)%/);
    const eventMatch = notes.match(/Event:\s*(\w+)/);

    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
    const value = valueMatch ? parseInt(valueMatch[1].replace(/,/g, ''), 10) : 0;
    const dmg = dmgMatch ? parseInt(dmgMatch[1], 10) / 100 : 0;

    const rawStatus = (l.status || 'new').toLowerCase();
    const status = rawStatus === 'callback' ? 'new' : rawStatus;
    const parsedEvent = eventMatch ? eventMatch[1].toLowerCase() : '';
    const incidentType = parsedEvent || l.peril || 'other';

    const agentName = l.assigned_user?.full_name
      || (l.assigned_user?.first_name && l.assigned_user?.last_name
          ? `${l.assigned_user.first_name} ${l.assigned_user.last_name}` : '')
      || '';

    // Determine source from source_info
    const srcInfo = l.source_info || '';
    const source = srcInfo.includes('crime') ? 'crime-intelligence'
      : srcInfo.includes('opportunity') ? 'opportunity-scoring'
      : srcInfo.includes('fire') ? 'fire-intelligence'
      : srcInfo;

    return {
      id: l.id,
      backendLeadId: l.id,
      incidentType,
      address: contact.address_loss || '',
      city: contact.city_loss || '',
      state: contact.state_loss || '',
      dateDetected: l.created_at ? l.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
      leadStatus: status,
      assignedAgent: agentName,
      assignedAgentId: l.assigned_to || '',
      estimatedValue: value,
      opportunityScore: score,
      damageProbability: dmg,
      source,
      territoryName: '',
      assignmentReason: '',
    };
  }

  // ── Persistence ────────────────────────────────────────────────

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as IntelligenceLead[];
      if (!Array.isArray(parsed)) return;

      const clean: IntelligenceLead[] = [];
      const seenIds = new Set<string>();
      const seenKeys = new Set<string>();

      for (const l of parsed) {
        if (!this.isValid(l)) continue;
        if (seenIds.has(l.id)) continue;
        const key = this.dedupeKey(l);
        if (seenKeys.has(key)) continue;
        seenIds.add(l.id);
        seenKeys.add(key);
        clean.push(l);
      }

      // Score any leads that don't have scores yet
      for (const l of clean) {
        if (l.leadScore === undefined) this.scoreLead(l);
      }

      this.leads$.next(clean);
      if (clean.length !== parsed.length) this.saveToStorage(clean);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private saveToStorage(leads: IntelligenceLead[]): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(leads)); } catch {}
  }
}
