import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, forkJoin, of, timer, race } from 'rxjs';
import { catchError, filter, map, take, timeout } from 'rxjs/operators';

const LOG_PREFIX = '[OppEngine]';
import {
  AssignAgentResult,
  ClaimOpportunity,
  OpportunityMetrics,
  OpportunityPriority,
  RecommendedAction,
  DEFAULT_SCORING_WEIGHTS,
  PotentialClaimRow,
  GenerateLeadResult,
  ScoringFactorBreakdown,
} from '../models/claim-opportunity.model';
import { IncidentFeedService, NormalizedIncident } from 'src/app/services/incident-feed.service';
import { StormDataService } from 'src/app/services/storm-data.service';
import { StormEvent, StormFilterState } from 'src/app/models/storm-event.model';
import { CrimeDataService } from 'src/app/services/crime-data.service';
import { CrimeIncident } from 'src/app/models/crime-incident.model';
import { RoofIntelligenceService } from 'src/app/services/roof-intelligence.service';
import { RoofAnalysisRecord } from 'src/app/models/roof-intelligence.model';
import { PotentialClaimsService } from 'src/app/services/potential-claims.service';
import { PredictedClaimEvent } from 'src/app/models/potential-claims.model';

// ── Severity & insurance probability lookup tables ──────────────

const EVENT_SEVERITY: Record<string, number> = {
  hurricane: 1.0, tornado: 0.95, fire: 0.9, flooding: 0.8,
  hail: 0.7, wind: 0.6, lightning: 0.5, roof: 0.5, crime: 0.4,
};

const INSURANCE_PROB: Record<string, number> = {
  hurricane: 0.95, tornado: 0.90, fire: 0.85, flooding: 0.75,
  crime: 0.60, hail: 0.55, lightning: 0.50, wind: 0.45, roof: 0.35,
};

const SEVERITY_DAMAGE: Record<string, number> = {
  extreme: 0.95, severe: 0.85, high: 0.8, moderate: 0.5, low: 0.2,
};

// Location risk factor by state — higher = more claim-prone (weather exposure, property density)
const STATE_RISK: Record<string, number> = {
  TX: 0.95, FL: 0.92, LA: 0.90, OK: 0.88, AR: 0.85,
  MS: 0.84, AL: 0.83, GA: 0.82, SC: 0.80, NC: 0.78,
  TN: 0.77, MO: 0.76, IL: 0.75, KS: 0.74, IA: 0.72,
  NE: 0.70, IN: 0.68, OH: 0.65, VA: 0.63, MD: 0.60,
  CO: 0.62, MN: 0.60, WI: 0.58, PA: 0.55, NY: 0.52,
  CA: 0.70, WA: 0.55, HI: 0.50, ME: 0.45,
};

// Median home value proxy by state (in $) for estimated claim value variation
const STATE_MEDIAN_HOME: Record<string, number> = {
  CA: 750000, HI: 650000, WA: 550000, CO: 500000, MA: 480000,
  NY: 380000, MD: 370000, VA: 350000, NJ: 360000, FL: 380000,
  TX: 280000, GA: 280000, NC: 270000, SC: 250000, TN: 250000,
  IL: 240000, MO: 200000, OH: 190000, IN: 190000, AR: 150000,
  AL: 170000, MS: 150000, LA: 200000, OK: 170000, KS: 180000,
  IA: 175000, NE: 190000, MN: 280000, WI: 230000, PA: 230000,
  ME: 260000,
};

@Injectable({ providedIn: 'root' })
export class ClaimOpportunityEngineService {

  // ── Existing backend-driven API (unchanged) ───────────────────
  private readonly base = 'potential-claims';

  getHighProbabilityClaims(minScore = 60, limit = 50): Observable<PotentialClaimRow[]> {
    const params = new HttpParams()
      .set('min_score', minScore.toString())
      .set('limit', limit.toString());
    return this.http.get<PotentialClaimRow[]>(`${this.base}/high-probability`, { params });
  }

  generateLead(claimId: string): Observable<GenerateLeadResult> {
    return this.http.post<GenerateLeadResult>(`${this.base}/${claimId}/generate-lead`, {});
  }

  dismissClaim(claimId: string): Observable<any> {
    return this.http.post<any>(`${this.base}/${claimId}/dismiss`, {});
  }

  assignAgent(opp: ClaimOpportunity): Observable<AssignAgentResult> {
    return this.http.post<AssignAgentResult>(`${this.base}/assign-agent`, {
      event_type: opp.event_type,
      address: opp.address,
      city: opp.city,
      state: opp.state,
      county: opp.address, // address often contains county for storm data
      estimated_claim_value: opp.estimated_claim_value,
      opportunity_score: opp.opportunity_score,
      damage_probability: opp.damage_probability,
      source: opp.source,
    });
  }

  // ── Opportunity Intelligence Engine ───────────────────────────

  private opportunities$ = new BehaviorSubject<ClaimOpportunity[]>([]);
  private pollSub: Subscription | null = null;
  private pollTimer: any = null;

  constructor(
    private http: HttpClient,
    private incidentFeed: IncidentFeedService,
    private stormData: StormDataService,
    private crimeData: CrimeDataService,
    private roofIntel: RoofIntelligenceService,
    private potentialClaims: PotentialClaimsService,
  ) {}

  getOpportunities(): Observable<ClaimOpportunity[]> {
    return this.opportunities$.asObservable();
  }

  getSnapshot(): ClaimOpportunity[] {
    return this.opportunities$.getValue();
  }

  startPolling(ms = 60000): void {
    // Delay initial refresh to let other services populate data first
    setTimeout(() => this.refresh(), 3000);
    this.stopPolling();
    this.pollTimer = setInterval(() => this.refresh(), ms);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  refresh(): void {
    const defaultFilters: StormFilterState = {
      dateRange: '7d',
      eventTypes: [],
      state: '',
      county: '',
      minSeverity: '',
    };

    forkJoin({
      incidents: race(
        this.incidentFeed.getIncidents().pipe(filter(l => l.length > 0), take(1)),
        timer(5000).pipe(map(() => this.incidentFeed.getSnapshot()))
      ).pipe(
        catchError(() => of([] as NormalizedIncident[]))
      ),
      storms: this.stormData.getStormEvents(defaultFilters).pipe(
        catchError(() => of([] as StormEvent[]))
      ),
      crimes: this.crimeData.getIncidents({ limit: 100 }).pipe(
        map(resp => resp.items),
        catchError(() => of([] as CrimeIncident[]))
      ),
      roofs: this.roofIntel.getAnalyses({ limit: 100 }).pipe(
        map(resp => resp.items),
        catchError(() => of([] as RoofAnalysisRecord[]))
      ),
      claims: this.potentialClaims.getEvents(168).pipe(
        catchError(() => of([] as PredictedClaimEvent[]))
      ),
    }).pipe(
      timeout(45000),
      catchError(err => {
        console.error(LOG_PREFIX, 'forkJoin timeout/error:', err?.message || err);
        return of({ incidents: [] as NormalizedIncident[], storms: [] as StormEvent[], crimes: [] as CrimeIncident[], roofs: [] as RoofAnalysisRecord[], claims: [] as PredictedClaimEvent[] });
      }),
    ).subscribe({
      next: ({ incidents, storms, crimes, roofs, claims }) => {
      const rawCount = incidents.length + storms.length + crimes.length + roofs.length + claims.length;
      let opps: ClaimOpportunity[] = [];

      // 1. Incidents (fire, hail, wind, lightning, crime, tornado, hurricane)
      opps.push(...incidents.map(i => this.fromIncident(i)));

      // 2. Storms
      opps.push(...storms.map(s => this.fromStorm(s)));

      // 3. Crime
      opps.push(...crimes.map(c => this.fromCrime(c)));

      // 4. Roof Intelligence
      opps.push(...roofs.map(r => this.fromRoof(r)));

      // 5. Potential Claims
      opps.push(...claims.map(c => this.fromPredictedClaim(c)));

      // Deduplicate, normalize, score, sort, cap at 100
      opps = this.deduplicate(opps);
      opps.forEach(o => {
        // Normalize damage_probability to 0–1 (some sources provide 0–100)
        if (o.damage_probability > 1) o.damage_probability = o.damage_probability / 100;
        const { score, factors } = this.computeScore(o);
        o.opportunity_score = score;
        o.scoring_factors = factors;
        o.priority = this.classifyPriority(score);
        o.recommended_action = this.deriveAction(score);
      });
      opps.sort((a, b) => b.opportunity_score - a.opportunity_score);
      opps = opps.slice(0, 100);

      console.log(LOG_PREFIX, `refresh: ${rawCount} raw → ${opps.length} scored (deduped, capped at 100)`);
      this.opportunities$.next(opps);
    },
      error: (err: any) => console.error(LOG_PREFIX, 'forkJoin error:', err),
    });
  }

  computeMetrics(opps: ClaimOpportunity[]): OpportunityMetrics {
    const stateCounts: Record<string, number> = {};
    let critical = 0, high = 0, medium = 0, low = 0, totalVal = 0, scoreSum = 0;
    let aa = 0, out = 0, mon = 0;

    for (const o of opps) {
      if (o.priority === 'critical') critical++;
      else if (o.priority === 'high') high++;
      else if (o.priority === 'medium') medium++;
      else low++;
      totalVal += o.estimated_claim_value;
      scoreSum += o.opportunity_score;
      stateCounts[o.state] = (stateCounts[o.state] || 0) + 1;
      if (o.recommended_action === 'assign_agent') aa++;
      else if (o.recommended_action === 'outreach') out++;
      else mon++;
    }

    const topStates = Object.entries(stateCounts)
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      total: opps.length,
      critical, high, medium, low,
      totalEstimatedValue: totalVal,
      avgScore: opps.length > 0 ? Math.round(scoreSum / opps.length) : 0,
      topStates,
      actionBreakdown: { assign_agent: aa, outreach: out, monitor: mon },
    };
  }

  // ── Scoring ───────────────────────────────────────────────────

  private computeScore(o: ClaimOpportunity): { score: number; factors: ScoringFactorBreakdown } {
    const w = DEFAULT_SCORING_WEIGHTS;

    // ── Factor 1: Event severity (base from type + boost from damage_probability)
    const baseSev = EVENT_SEVERITY[o.event_type] ?? 0.4;
    const dmgRaw = Math.min(o.damage_probability, 1.0);
    // Blend: 50% base type severity + 50% actual damage probability
    const severityNorm = Math.min(baseSev * 0.5 + dmgRaw * 0.5, 1.0);

    // ── Factor 2: Property value (estimated value vs. state median)
    const stateHome = STATE_MEDIAN_HOME[o.state?.toUpperCase()] ?? 220000;
    // Use a lower denominator so more values reach high range
    const propNorm = Math.min(o.estimated_claim_value / (stateHome * 0.3), 1.0);

    // ── Factor 3: Insurance likelihood (base + location risk)
    const baseInsurance = INSURANCE_PROB[o.event_type] ?? 0.4;
    const locationRisk = STATE_RISK[o.state?.toUpperCase()] ?? 0.55;
    // Blend: 55% base insurance + 45% location risk for more state-driven variation
    const insuranceNorm = Math.min(baseInsurance * 0.55 + locationRisk * 0.45, 1.0);

    // ── Factor 4: Damage probability + recency
    const hoursAgo = Math.max(0, (Date.now() - new Date(o.timestamp).getTime()) / 3600000);
    // Gentle decay: 1.0 at 0h, ~0.85 at 24h, ~0.65 at 72h, ~0.5 at 168h
    const recency = Math.max(0.5, 1.0 - (hoursAgo / 336));
    const dmgWithRecency = dmgRaw * recency;

    // ── Factor 5: Claim size (value * severity * location risk)
    const claimSizeRaw = o.estimated_claim_value * severityNorm * locationRisk;
    // Use 150k denominator so tornado/hurricane in high-risk states can saturate
    const claimSizeNorm = Math.min(claimSizeRaw / 150_000, 1.0);

    const rawScore = (severityNorm * w.event_severity)
                   + (propNorm * w.property_value)
                   + (insuranceNorm * w.insurance_probability)
                   + (dmgWithRecency * w.damage_probability)
                   + (claimSizeNorm * w.claim_size);

    return {
      score: Math.min(Math.round(rawScore * 100), 100),
      factors: {
        event_severity: severityNorm,
        property_value: propNorm,
        insurance_likelihood: insuranceNorm,
        damage_probability: dmgWithRecency,
        claim_size_estimate: claimSizeNorm,
      },
    };
  }

  private deriveAction(score: number): RecommendedAction {
    if (score >= 75) return 'assign_agent';
    if (score >= 50) return 'outreach';
    return 'monitor';
  }

  private classifyPriority(score: number): OpportunityPriority {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  // ── Source normalizers ────────────────────────────────────────

  private fromIncident(i: NormalizedIncident): ClaimOpportunity {
    const stateHome = STATE_MEDIAN_HOME[i.state?.toUpperCase()] ?? 220000;
    const eventSev = EVENT_SEVERITY[i.type] ?? 0.5;
    const estValue = i.estimated_property_value ?? Math.round(stateHome * eventSev * 0.4);
    return {
      id: `inc-${i.id}`,
      event_type: i.type,
      address: i.address || '',
      city: i.city || '',
      state: i.state || '',
      zip: i.zip || '',
      latitude: i.latitude,
      longitude: i.longitude,
      damage_probability: eventSev * 0.7, // severity-proportional base damage
      estimated_claim_value: estValue,
      opportunity_score: 0,
      priority: 'medium',
      recommended_action: 'monitor',
      source: 'incident-feed',
      timestamp: i.timestamp,
      lead_status: i.lead_status || 'not_contacted',
      raw_event: i,
      source_incident_id: (i as any).pulsepoint_id || (i as any).external_id || i.id,
      merge_count: 1,
    };
  }

  private fromStorm(s: StormEvent): ClaimOpportunity {
    const dmg = SEVERITY_DAMAGE[s.severity] ?? 0.5;
    const stateHome = STATE_MEDIAN_HOME[s.state?.toUpperCase()] ?? 220000;

    // Vary estimated value by: state median home value * severity * magnitude factor
    let magFactor = 1.0;
    if (s.event_type === 'hail' && (s as any).hail_size_inches) {
      magFactor = Math.min((s as any).hail_size_inches / 1.5, 2.0); // 1.5" = 1.0x, 3" = 2.0x
    } else if (s.event_type === 'wind' && (s as any).wind_speed_mph) {
      magFactor = Math.min((s as any).wind_speed_mph / 70, 2.0); // 70mph = 1.0x, 140mph = 2.0x
    } else if (s.event_type === 'tornado') {
      magFactor = 1.5;
    }
    const estValue = Math.round(stateHome * dmg * magFactor * 0.4); // 40% of home value as claim

    return {
      id: `storm-${s.id}`,
      event_type: s.event_type,
      address: s.county || '',
      city: s.county || '',
      state: s.state || '',
      zip: s.zip_codes?.[0] || '',
      latitude: s.latitude,
      longitude: s.longitude,
      damage_probability: dmg,
      estimated_claim_value: estValue,
      opportunity_score: 0,
      priority: 'medium',
      recommended_action: 'monitor',
      source: 'storm-data',
      timestamp: s.reported_at ? new Date(s.reported_at).toISOString() : new Date().toISOString(),
      lead_status: 'not_contacted',
      raw_event: s,
      source_incident_id: (s as any).external_id || s.id?.toString(),
      merge_count: 1,
    };
  }

  private fromCrime(c: CrimeIncident): ClaimOpportunity {
    return {
      id: `crime-${c.id}`,
      event_type: 'crime',
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      zip: c.zip_code || '',
      latitude: c.latitude,
      longitude: c.longitude,
      damage_probability: c.claim_relevance_score ?? 0.4,
      estimated_claim_value: c.estimated_loss ?? 50000,
      opportunity_score: 0,
      priority: 'medium',
      recommended_action: 'monitor',
      source: 'crime-data',
      timestamp: c.occurred_at || c.reported_at || new Date().toISOString(),
      lead_status: 'not_contacted',
      raw_event: c,
      source_incident_id: (c as any).external_id || c.id?.toString(),
      merge_count: 1,
    };
  }

  private fromRoof(r: RoofAnalysisRecord): ClaimOpportunity {
    return {
      id: `roof-${r.id}`,
      event_type: 'roof',
      address: r.address || '',
      city: r.city || '',
      state: r.state || '',
      zip: r.zip_code || '',
      latitude: r.latitude,
      longitude: r.longitude,
      damage_probability: (r.damage_score ?? 0) / 100,
      estimated_claim_value: r.estimated_claim_value ?? 80000,
      opportunity_score: 0,
      priority: 'medium',
      recommended_action: 'monitor',
      source: 'roof-intelligence',
      timestamp: r.scan_timestamp || r.created_at || new Date().toISOString(),
      lead_status: r.outreach_status === 'contacted' ? 'contacted' : 'not_contacted',
      raw_event: r,
      source_incident_id: r.id?.toString(),
      merge_count: 1,
    };
  }

  private fromPredictedClaim(c: PredictedClaimEvent): ClaimOpportunity {
    const dmgProb = (c.claim_probability ?? 50) / 100;
    const stateHome = STATE_MEDIAN_HOME[c.state?.toUpperCase()] ?? 220000;
    const eventSev = EVENT_SEVERITY[c.event_type] ?? 0.5;
    // Estimated value: state median * damage prob * event severity * 40% claim ratio
    const estValue = Math.round(stateHome * dmgProb * eventSev * 0.4);

    return {
      id: `pred-${c.id}`,
      event_type: c.event_type || 'hail',
      address: (c as any).county || '',
      city: c.city || (c as any).county || '',
      state: c.state || '',
      zip: '',
      latitude: 0,
      longitude: 0,
      damage_probability: dmgProb,
      estimated_claim_value: estValue,
      opportunity_score: 0,
      priority: 'medium',
      recommended_action: 'monitor',
      source: 'potential-claims',
      timestamp: c.timestamp ? new Date(c.timestamp).toISOString() : new Date().toISOString(),
      lead_status: 'not_contacted',
      raw_event: c,
      source_incident_id: c.id,
      merge_count: 1,
    };
  }

  // ── Address normalization ──────────────────────────────────────

  private static readonly SUFFIX_MAP: Record<string, string> = {
    ROAD: 'RD', STREET: 'ST', AVENUE: 'AVE', BOULEVARD: 'BLVD',
    DRIVE: 'DR', LANE: 'LN', COURT: 'CT', PLACE: 'PL',
    CIRCLE: 'CIR', TRAIL: 'TRL', TERRACE: 'TER', PARKWAY: 'PKWY',
    HIGHWAY: 'HWY', EXPRESSWAY: 'EXPY', SUITE: 'STE', APARTMENT: 'APT',
    NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W',
    NORTHEAST: 'NE', NORTHWEST: 'NW', SOUTHEAST: 'SE', SOUTHWEST: 'SW',
  };

  private normalizeAddress(addr: string): string {
    if (!addr) return '';
    let norm = addr.toUpperCase().trim();
    // Remove punctuation except spaces and digits
    norm = norm.replace(/[^A-Z0-9\s]/g, '');
    // Collapse whitespace
    norm = norm.replace(/\s+/g, ' ').trim();
    // Replace common suffixes
    const words = norm.split(' ');
    const mapped = words.map(w => ClaimOpportunityEngineService.SUFFIX_MAP[w] || w);
    return mapped.join(' ');
  }

  // ── Time bucket: rounds timestamp to DEDUPE_WINDOW_HOURS ──────

  private static readonly DEDUPE_WINDOW_HOURS = 4;

  private timeBucket(ts: string): number {
    const ms = new Date(ts).getTime();
    const windowMs = ClaimOpportunityEngineService.DEDUPE_WINDOW_HOURS * 3600_000;
    return Math.floor(ms / windowMs);
  }

  // ── Dedupe key generation ──────────────────────────────────────

  private dedupeKey(o: ClaimOpportunity): string {
    // Composite key: normalized address + event type + time bucket + state.
    //
    // Why state instead of coords: the same real-world incident appears in
    // storm-data (with coords) and potential-claims (without coords). Using
    // coords would prevent cross-source dedup. The normalized county/address
    // + state is already specific enough (e.g. "CHRISTIAN|hail|123167|IL").
    const normAddr = this.normalizeAddress(o.address || o.city);
    const evtNorm = (o.event_type || 'unknown').toLowerCase();
    const bucket = this.timeBucket(o.timestamp);
    const stateKey = (o.state || 'XX').toUpperCase().trim();

    return `${normAddr}|${evtNorm}|${bucket}|${stateKey}`;
  }

  // ── Merge two opportunities: keep best data from each ─────────

  private mergeOpportunity(existing: ClaimOpportunity, incoming: ClaimOpportunity): ClaimOpportunity {
    const existingTs = new Date(existing.timestamp).getTime();
    const incomingTs = new Date(incoming.timestamp).getTime();
    const latest = incomingTs >= existingTs ? incoming : existing;
    const best = incoming.damage_probability >= existing.damage_probability ? incoming : existing;

    return {
      ...best,
      // Keep the latest timestamp
      timestamp: latest.timestamp,
      // Keep the higher damage probability
      damage_probability: Math.max(existing.damage_probability, incoming.damage_probability),
      // Keep the higher estimated value
      estimated_claim_value: Math.max(existing.estimated_claim_value, incoming.estimated_claim_value),
      // Increment merge count
      merge_count: (existing.merge_count ?? 1) + 1,
      // Preserve all raw events for audit
      merged_raw_events: [
        ...(existing.merged_raw_events || [existing.raw_event]),
        incoming.raw_event,
      ],
      // Keep the best source_incident_id
      source_incident_id: existing.source_incident_id || incoming.source_incident_id,
    };
  }

  // ── Deduplication with merge ───────────────────────────────────

  private deduplicate(opps: ClaimOpportunity[]): ClaimOpportunity[] {
    const map = new Map<string, ClaimOpportunity>();

    for (const o of opps) {
      const key = this.dedupeKey(o);
      const existing = map.get(key);
      if (existing) {
        map.set(key, this.mergeOpportunity(existing, o));
      } else {
        // Initialize merge tracking
        o.merge_count = o.merge_count ?? 1;
        o.merged_raw_events = o.merged_raw_events || [o.raw_event];
        map.set(key, o);
      }
    }

    const before = opps.length;
    const after = map.size;
    if (before !== after) {
      console.log(LOG_PREFIX, `deduplicate: ${before} → ${after} (merged ${before - after} duplicates)`);
    }
    return Array.from(map.values());
  }
}
