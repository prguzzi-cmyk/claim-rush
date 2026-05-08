/**
 * Storm Intel — operational claim-intelligence service layer.
 *
 * The seam between the UI and the eventual real-time storm intelligence
 * backend (NOAA + storm-trigger services + predictive models). Today
 * synthesizes nationwide events deterministically + enriches the legacy
 * /seminars/storm-triggers/alerts/me territorial alerts with operational
 * scoring on top. Flip USE_REAL_API when /v1/storm-intel/events ships.
 *
 * Schema (the contract the UI consumes):
 *
 *   StormEvent = {
 *     id:             string,
 *     event_type:     "hail"|"tornado"|"hurricane"|"flood"|"wildfire"|
 *                     "wind"|"lightning"|"thunderstorm",
 *     severity:       "extreme"|"severe"|"moderate"|"low",
 *     triggered_at:   string,    // ISO
 *     expires_at:     string,    // ISO — when alert auto-archives
 *     hours_ago:      number,    // pre-computed for UI scan-density
 *     location: {
 *       state:        string,
 *       states:       string[],   // for multi-state events
 *       counties:     string[],
 *       cities:       string[],
 *       lat:          number,
 *       lng:          number,
 *     },
 *     metrics: {
 *       affected_population_est:  number,
 *       property_density_est:     number,   // 0-100 normalized
 *       impact_radius_miles:      number,
 *       event_intensity:          number,   // 0-100 raw severity
 *     },
 *     scoring: {
 *       severity_score:        number,   // 0-100
 *       population_score:      number,   // 0-100
 *       property_density_score:number,   // 0-100
 *       recency_score:         number,   // 0-100 with decay
 *       claim_likelihood:      number,   // 0-100 composite
 *       response_priority:     number,   // 0-100 final operational score
 *       confidence:            number,   // 0-100
 *       urgency:               "critical"|"high"|"medium"|"low",
 *     },
 *     recommendation: {
 *       action: "TARGET_NOW"|"SURGE_ZONE"|"DEPLOY"|"MONITOR"|"WAIT"|
 *               "ESCALATE"|"ARCHIVE",
 *       reason: string,
 *     },
 *     territory_impact: {
 *       severity_by_state:       { [stateCode: string]: number }, // 0-100
 *       recommended_operators:   number,
 *     },
 *   }
 */

import { apiFetch } from "../../lib/api";

// Toggle to true when /v1/storm-intel/events ships. Until then, the
// service synthesizes nationwide events + optionally enriches legacy
// territorial alerts from /seminars/storm-triggers/alerts/me.
const USE_REAL_API = false;
const TRY_LEGACY_BACKEND = true;
const LEGACY_PATH = "/seminars/storm-triggers/alerts/me";

// ── Event-type intelligence — base intensity + claim-relevance weights.
// Reflects real-world claim potential per peril, not arbitrary tiers.
const EVENT_PROFILES = {
  hail:           { base: 78, claim_weight: 1.00, prop_weight: 1.00 },
  tornado:        { base: 92, claim_weight: 0.95, prop_weight: 1.10 },
  hurricane:      { base: 96, claim_weight: 0.98, prop_weight: 1.15 },
  flood:          { base: 84, claim_weight: 0.90, prop_weight: 1.05 },
  wildfire:       { base: 88, claim_weight: 0.92, prop_weight: 1.10 },
  wind:           { base: 62, claim_weight: 0.78, prop_weight: 0.95 },
  lightning:      { base: 48, claim_weight: 0.55, prop_weight: 0.85 },
  thunderstorm:   { base: 56, claim_weight: 0.65, prop_weight: 0.90 },
};

const SEVERITY_FROM_INTENSITY = (i) =>
  i >= 90 ? "extreme" : i >= 75 ? "severe" : i >= 55 ? "moderate" : "low";

const URGENCY_FROM_PRIORITY = (p) =>
  p >= 90 ? "critical" : p >= 75 ? "high" : p >= 55 ? "medium" : "low";

// State centroids on normalized 0–100 grid (matches Roof Intel canvas
// system). Used by the radar overlay to drop event dots roughly where
// the affected region sits on a continental map.
const STATE_LL = {
  AL: [62, 72], AK: [10, 92], AZ: [22, 62], AR: [50, 65], CA: [8, 48],
  CO: [30, 50], CT: [88, 30], DE: [84, 40], FL: [75, 84], GA: [70, 70],
  HI: [18, 90], ID: [22, 28], IL: [56, 45], IN: [62, 45], IA: [50, 38],
  KS: [42, 55], KY: [64, 53], LA: [50, 78], ME: [92, 16], MD: [82, 42],
  MA: [88, 25], MI: [64, 32], MN: [50, 25], MS: [56, 72], MO: [50, 52],
  MT: [28, 20], NE: [40, 42], NV: [16, 43], NH: [88, 20], NJ: [86, 34],
  NM: [30, 63], NY: [82, 26], NC: [76, 58], ND: [40, 20], OH: [68, 42],
  OK: [44, 62], OR: [12, 26], PA: [78, 35], RI: [90, 28], SC: [74, 65],
  SD: [40, 30], TN: [62, 60], TX: [42, 78], UT: [22, 46], VT: [86, 20],
  VA: [78, 50], WA: [16, 16], WV: [74, 47], WI: [56, 30], WY: [30, 34],
};

// ── Pure scoring functions (UI-callable) ─────────────────────────────

export function computeSeverityScore(intensity, eventType) {
  const profile = EVENT_PROFILES[eventType] || EVENT_PROFILES.thunderstorm;
  return Math.round(Math.min(100, intensity * profile.claim_weight));
}

export function computePopulationScore(populationEst) {
  // Log-scaled normalization: 1k = 20, 10k = 40, 100k = 60, 1M = 80, 10M+ = 100.
  if (populationEst <= 0) return 0;
  const v = Math.log10(populationEst);
  return Math.round(Math.min(100, Math.max(0, (v - 2) * 20 + 20)));
}

export function computePropertyDensityScore(density) {
  // Property density already 0-100. Apply mild boost for urban concentration.
  return Math.round(Math.min(100, density * 1.05));
}

export function computeRecencyScore(hoursAgo) {
  // 0h = 100, 24h = 80, 72h = 50, 168h (7d) = 20, 720h (30d) = 0.
  if (hoursAgo <= 0) return 100;
  const decay = Math.exp(-hoursAgo / 96);   // half-life ~67h
  return Math.round(Math.min(100, decay * 100));
}

export function computeResponsePriority({ severity_score, population_score, property_density_score, recency_score }) {
  // Composite operational score — what the operator actually targets on.
  const sev   = severity_score          * 0.40;
  const pop   = population_score        * 0.25;
  const prop  = property_density_score  * 0.15;
  const rec   = recency_score           * 0.20;
  return Math.round(sev + pop + prop + rec);
}

function computeClaimLikelihood({ severity_score, recency_score, property_density_score }) {
  // Likelihood that affected properties will file claims. Heavily
  // weighted by severity and recency; less by population (population
  // matters for volume, not per-property likelihood).
  return Math.round(Math.min(100, severity_score * 0.55 + recency_score * 0.25 + property_density_score * 0.20));
}

function computeConfidence({ event_type, recency_score, has_real_source }) {
  // Real-source events score higher confidence than synthesized ones.
  // Fresh events score higher than stale.
  const base = has_real_source ? 80 : 65;
  const rec = recency_score * 0.15;
  const profileBonus = (EVENT_PROFILES[event_type]?.claim_weight || 0.6) * 10;
  return Math.round(Math.min(100, base + rec + profileBonus - 6));
}

function recommendationFor(scoring, eventType) {
  const p = scoring.response_priority;
  const sev = scoring.severity_score;
  if (p >= 92 && sev >= 88) {
    return {
      action: "TARGET_NOW",
      reason: `${scoring.claim_likelihood}% claim likelihood with critical severity. Deploy operators to affected zones immediately.`,
    };
  }
  if (p >= 85) {
    return {
      action: "SURGE_ZONE",
      reason: `Surge-zone activity detected. Concentrate outreach within next 48h while damage is fresh and adjusters are slow.`,
    };
  }
  if (p >= 72) {
    return {
      action: "DEPLOY",
      reason: `Operational priority — assign territory operators and begin lead generation pipeline.`,
    };
  }
  if (p >= 55) {
    return {
      action: "MONITOR",
      reason: `Active event in ops radius. Watch for severity escalation or storm-path drift.`,
    };
  }
  if (p >= 35) {
    return {
      action: "WAIT",
      reason: `Below deployment threshold today; remains in feed for 7-day decay window.`,
    };
  }
  return {
    action: "ARCHIVE",
    reason: `Event has decayed below operational relevance.`,
  };
}

function recommendedOperators(priority, populationScore) {
  // Rough operator count to deploy based on priority + reachable
  // population. Real deployment logic ships when CRM workflow lands.
  if (priority >= 90) return Math.max(8, Math.round(populationScore / 8));
  if (priority >= 75) return Math.max(4, Math.round(populationScore / 14));
  if (priority >= 55) return Math.max(2, Math.round(populationScore / 22));
  return 0;
}

// ── Deterministic seeding (same as Roof Intel) ──────────────────────
function seedFrom(s) {
  let h = 5381;
  const str = (s || "").toUpperCase();
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return Math.abs(h);
}

const DEMO_EVENTS_SEED_BASE = "STORM_INTEL_NATIONAL_FEED";

// Demo event templates — varied geographies, event types, ages. The
// service blends these into a national feed when no real data exists.
// Each template's `state` drives canvas placement; ages are now-relative.
const DEMO_TEMPLATES = [
  { event_type: "tornado",     state: "OK", states: ["OK", "TX"], cities: ["Norman", "Moore"],         counties: ["Cleveland", "McClain"],                    age_h: 3,   intensity: 96, pop: 285000  },
  { event_type: "hail",        state: "CO", states: ["CO"],       cities: ["Denver", "Aurora"],         counties: ["Denver", "Arapahoe", "Adams"],             age_h: 7,   intensity: 84, pop: 720000  },
  { event_type: "hurricane",   state: "FL", states: ["FL", "GA"], cities: ["Miami", "Fort Lauderdale"], counties: ["Miami-Dade", "Broward", "Palm Beach"],     age_h: 14,  intensity: 91, pop: 4800000 },
  { event_type: "wildfire",    state: "CA", states: ["CA"],       cities: ["Riverside", "San Bernardino"], counties: ["Riverside", "San Bernardino"],          age_h: 28,  intensity: 87, pop: 380000  },
  { event_type: "flood",       state: "LA", states: ["LA", "MS"], cities: ["Baton Rouge", "Lafayette"], counties: ["East Baton Rouge", "Lafayette"],           age_h: 48,  intensity: 79, pop: 540000  },
  { event_type: "hail",        state: "TX", states: ["TX"],       cities: ["Dallas", "Plano"],          counties: ["Dallas", "Collin"],                        age_h: 11,  intensity: 73, pop: 920000  },
  { event_type: "wind",        state: "IL", states: ["IL", "IN"], cities: ["Chicago", "Gary"],          counties: ["Cook", "Lake (IN)"],                        age_h: 64,  intensity: 58, pop: 410000  },
  { event_type: "thunderstorm",state: "TN", states: ["TN", "KY"], cities: ["Nashville"],                counties: ["Davidson", "Williamson"],                   age_h: 96,  intensity: 51, pop: 240000  },
];

function generateDemoEvents() {
  const now = Date.now();
  return DEMO_TEMPLATES.map((tmpl, i) => {
    const id = `evt_${seedFrom(DEMO_EVENTS_SEED_BASE + tmpl.state + tmpl.event_type + i).toString().slice(-10)}`;
    const triggered_at = new Date(now - tmpl.age_h * 3600000).toISOString();
    const expires_at = new Date(now + (168 - tmpl.age_h) * 3600000).toISOString();
    const [sx, sy] = STATE_LL[tmpl.state] || STATE_LL.FL;
    return enrichEvent({
      id,
      event_type: tmpl.event_type,
      triggered_at,
      expires_at,
      hours_ago: tmpl.age_h,
      location: {
        state: tmpl.state,
        states: tmpl.states,
        counties: tmpl.counties,
        cities: tmpl.cities,
        lat: parseFloat((25 + sy / 4).toFixed(4)),
        lng: parseFloat((-125 + sx / 1.4).toFixed(4)),
      },
      metrics: {
        affected_population_est: tmpl.pop,
        property_density_est: Math.min(100, Math.round(40 + (tmpl.pop / 100000))),
        impact_radius_miles: Math.round(20 + tmpl.intensity / 4),
        event_intensity: tmpl.intensity,
      },
      _has_real_source: false,
    });
  });
}

// Convert the legacy /seminars/storm-triggers/alerts/me row into a
// StormEvent. The legacy shape has: id, event_type, severity,
// affected_states[], affected_counties[], triggered_at, alert_sent,
// metadata_json{total_events}.
function enrichLegacyAlert(alert) {
  const profile = EVENT_PROFILES[alert.event_type] || EVENT_PROFILES.thunderstorm;
  const triggered = alert.triggered_at ? new Date(alert.triggered_at) : new Date();
  const age_h = Math.max(0, Math.round((Date.now() - triggered.getTime()) / 3600000));
  const stateCode = (alert.affected_states || ["FL"])[0];
  const [sx, sy] = STATE_LL[stateCode] || STATE_LL.FL;
  // Legacy severity is a string; map to intensity.
  const sevIntensity = alert.severity === "extreme" ? 92
                     : alert.severity === "severe" ? 78
                     : alert.severity === "high"   ? 64
                     : alert.severity === "moderate" ? 50
                     : 38;
  const intensity = Math.round((sevIntensity + profile.base) / 2);
  // Legacy doesn't carry population. Estimate from county count.
  const counties = alert.affected_counties || [];
  const pop = Math.max(8000, counties.length * 32000);
  return enrichEvent({
    id: `legacy_${alert.id}`,
    event_type: alert.event_type,
    triggered_at: triggered.toISOString(),
    expires_at: new Date(triggered.getTime() + 168 * 3600000).toISOString(),
    hours_ago: age_h,
    location: {
      state: stateCode,
      states: alert.affected_states || [stateCode],
      counties,
      cities: [],
      lat: parseFloat((25 + sy / 4).toFixed(4)),
      lng: parseFloat((-125 + sx / 1.4).toFixed(4)),
    },
    metrics: {
      affected_population_est: pop,
      property_density_est: Math.min(100, Math.round(35 + counties.length * 5)),
      impact_radius_miles: Math.round(15 + sevIntensity / 4),
      event_intensity: intensity,
    },
    _has_real_source: true,
    _legacy: { alert_sent: !!alert.alert_sent, total_events: alert.metadata_json ? safeParse(alert.metadata_json)?.total_events : null },
  });
}

function safeParse(json) {
  try { return JSON.parse(json); } catch { return null; }
}

// ── Enrichment pipeline (event with metrics → fully scored StormEvent)
function enrichEvent(ev) {
  const severity_score        = computeSeverityScore(ev.metrics.event_intensity, ev.event_type);
  const population_score      = computePopulationScore(ev.metrics.affected_population_est);
  const property_density_score= computePropertyDensityScore(ev.metrics.property_density_est);
  const recency_score         = computeRecencyScore(ev.hours_ago);
  const response_priority     = computeResponsePriority({ severity_score, population_score, property_density_score, recency_score });
  const claim_likelihood      = computeClaimLikelihood({ severity_score, recency_score, property_density_score });
  const confidence            = computeConfidence({ event_type: ev.event_type, recency_score, has_real_source: ev._has_real_source });
  const urgency               = URGENCY_FROM_PRIORITY(response_priority);

  const scoring = { severity_score, population_score, property_density_score, recency_score, claim_likelihood, response_priority, confidence, urgency };
  const recommendation = recommendationFor(scoring, ev.event_type);

  // Territory impact — distribute severity across affected states.
  // Weight the originating state higher; spread the rest evenly.
  const states = ev.location.states || [ev.location.state];
  const severity_by_state = {};
  states.forEach((s, idx) => {
    severity_by_state[s] = idx === 0
      ? severity_score
      : Math.round(severity_score * 0.65);
  });

  return {
    id: ev.id,
    event_type: ev.event_type,
    severity: SEVERITY_FROM_INTENSITY(severity_score),
    triggered_at: ev.triggered_at,
    expires_at: ev.expires_at,
    hours_ago: ev.hours_ago,
    location: ev.location,
    metrics: ev.metrics,
    scoring,
    recommendation,
    territory_impact: {
      severity_by_state,
      recommended_operators: recommendedOperators(response_priority, population_score),
    },
    _has_real_source: ev._has_real_source,
    _legacy: ev._legacy,
  };
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Fetch the active national event feed. Source priority:
 *   1. /v1/storm-intel/events when USE_REAL_API
 *   2. Legacy /seminars/storm-triggers/alerts/me + demo blend
 *   3. Demo-only fallback
 */
export async function fetchActiveEvents() {
  if (USE_REAL_API) {
    return apiFetch("/v1/storm-intel/events").then(r => r.ok ? r.json() : []);
  }
  let legacy = [];
  if (TRY_LEGACY_BACKEND) {
    try {
      const r = await apiFetch(LEGACY_PATH);
      if (r.ok) {
        const arr = await r.json();
        if (Array.isArray(arr)) legacy = arr.map(enrichLegacyAlert);
      }
    } catch {
      // Network or auth failure — silently fall back to demo only.
    }
  }
  const demo = generateDemoEvents();
  // Merge: legacy events get precedence (real territorial alerts), then
  // backfill with demo events not duplicated by legacy event_type+state.
  const seen = new Set(legacy.map(e => `${e.event_type}_${e.location.state}`));
  const filtered = demo.filter(d => !seen.has(`${d.event_type}_${d.location.state}`));
  const all = [...legacy, ...filtered];
  // Sort by response_priority desc (most operationally urgent first).
  all.sort((a, b) => b.scoring.response_priority - a.scoring.response_priority);
  return all;
}

/**
 * Schedule a seminar against a legacy alert. Pass-through to the
 * existing backend. No-op for synthesized events (returns failure).
 */
export async function scheduleSeminar(eventId) {
  if (!eventId.startsWith("legacy_")) {
    return { ok: false, reason: "Event has no scheduling backend (synthesized)." };
  }
  const realId = eventId.slice("legacy_".length);
  return apiFetch(`/seminars/storm-triggers/${realId}/schedule-seminar`, { method: "POST" })
    .then(r => r.ok ? r.json().then(d => ({ ok: true, data: d })) : ({ ok: false, reason: `HTTP ${r.status}` }))
    .catch(e => ({ ok: false, reason: e?.message || "Network error" }));
}

/**
 * Aggregate operational metrics from an event list — used by the UI's
 * Operational Status strip without recomputing per-render.
 */
export function aggregateMetrics(events) {
  const total = events.length;
  const surgeZones = events.filter(e =>
    e.recommendation.action === "SURGE_ZONE" || e.recommendation.action === "TARGET_NOW"
  ).length;
  const totalPopulation = events.reduce((s, e) => s + (e.metrics.affected_population_est || 0), 0);
  const totalOperators = events.reduce((s, e) => s + (e.territory_impact.recommended_operators || 0), 0);
  const avgPriority = total
    ? Math.round(events.reduce((s, e) => s + e.scoring.response_priority, 0) / total)
    : 0;
  const states = new Set();
  events.forEach(e => (e.location.states || [e.location.state]).forEach(s => states.add(s)));
  return {
    total,
    surgeZones,
    statesAffected: states.size,
    totalPopulation,
    totalOperators,
    avgPriority,
  };
}
