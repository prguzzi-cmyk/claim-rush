/**
 * Crime Intel — neighborhood / property-threat intelligence service.
 *
 * The seam between the UI and the eventual urban incident intelligence
 * backend (open-data crime feeds, predictive clustering, neighborhood
 * tier maps). Today synthesizes neighborhood incidents deterministically
 * with real cluster + scoring + recommendation logic. Flip USE_REAL_API
 * when /v1/crime-intel/incidents ships.
 *
 * Schema (the contract the UI consumes):
 *
 *   CrimeIncident = {
 *     id:           string,
 *     event_type:   "burglary"|"theft"|"vandalism"|"break_in"|"arson"|
 *                   "auto"|"property_damage"|"civil_unrest"|
 *                   "suspicious_activity",
 *     severity:     "critical"|"high"|"moderate"|"low",
 *     reported_at:  string,    // ISO
 *     hours_ago:    number,
 *     location: {
 *       address:        string|null,
 *       neighborhood:   string,
 *       city:           string,
 *       state:          string,
 *       canvas_x:       number,    // 0-100 normalized for heat map
 *       canvas_y:       number,
 *     },
 *     metrics: {
 *       repeat_incidents_30d:        number,   // same neighborhood, last 30d
 *       cluster_size:                number,   // recent incidents in 1mi
 *       property_density_est:        number,   // 0-100 urban concentration
 *       last_incident_in_zone_hours: number,
 *       incident_intensity:          number,   // 0-100 raw
 *     },
 *     scoring: {
 *       severity_score:       number,    // 0-100
 *       cluster_score:        number,    // 0-100
 *       property_relevance:   number,    // 0-100
 *       recency_score:        number,    // 0-100 (decay)
 *       repeat_score:         number,    // 0-100
 *       claim_likelihood:     number,    // 0-100
 *       targeting_priority:   number,    // 0-100 — final operational score
 *       confidence:           number,    // 0-100
 *       urgency:              "critical"|"high"|"medium"|"low",
 *     },
 *     recommendation: {
 *       action: "TARGET_NOW"|"HIGH_PROPERTY_RISK"|"WATCH_ZONE"|
 *               "MONITOR"|"ESCALATE"|"ARCHIVE",
 *       reason: string,
 *     },
 *     zone_impact: {
 *       cluster_classification:        "ISOLATED"|"EMERGING"|"ACTIVE"|"SURGING",
 *       properties_at_risk_est:        number,
 *       recommended_outreach_radius_mi:number,
 *     },
 *   }
 */

import { apiFetch } from "../../lib/api";

const USE_REAL_API = false;

// ── Event-type intelligence — claim relevance, property weights ──────
// Reflects how each crime type maps to insurance-claim opportunity.
const EVENT_PROFILES = {
  burglary:           { base: 78, claim_weight: 0.95, prop_weight: 1.00 },
  break_in:           { base: 76, claim_weight: 0.92, prop_weight: 1.00 },
  arson:              { base: 96, claim_weight: 0.98, prop_weight: 1.10 },
  property_damage:    { base: 72, claim_weight: 0.95, prop_weight: 1.05 },
  vandalism:          { base: 58, claim_weight: 0.85, prop_weight: 0.95 },
  theft:              { base: 52, claim_weight: 0.70, prop_weight: 0.85 },
  auto:               { base: 48, claim_weight: 0.70, prop_weight: 0.80 },
  civil_unrest:       { base: 84, claim_weight: 0.85, prop_weight: 1.00 },
  suspicious_activity:{ base: 32, claim_weight: 0.40, prop_weight: 0.65 },
};

const SEVERITY_FROM_INTENSITY = (i) =>
  i >= 90 ? "critical" : i >= 75 ? "high" : i >= 50 ? "moderate" : "low";

const URGENCY_FROM_PRIORITY = (p) =>
  p >= 90 ? "critical" : p >= 75 ? "high" : p >= 55 ? "medium" : "low";

const CLUSTER_FROM_SIZE = (n) =>
  n >= 10 ? "SURGING" : n >= 5 ? "ACTIVE" : n >= 2 ? "EMERGING" : "ISOLATED";

// ── Pure scoring functions (UI-callable) ─────────────────────────────

export function computeSeverityScore(intensity, eventType) {
  const profile = EVENT_PROFILES[eventType] || EVENT_PROFILES.theft;
  return Math.round(Math.min(100, intensity * profile.claim_weight));
}

export function computeClusterScore(clusterSize) {
  // Diminishing returns above 10. Single incident scores low; SURGING
  // territory scores high.
  if (clusterSize <= 1) return 18;
  if (clusterSize <= 4) return 35 + clusterSize * 8;
  if (clusterSize <= 9) return 70 + (clusterSize - 5) * 4;
  return Math.min(100, 90 + (clusterSize - 10) * 2);
}

export function computePropertyRelevance(intensity, eventType, propertyDensity) {
  const profile = EVENT_PROFILES[eventType] || EVENT_PROFILES.theft;
  const base = profile.claim_weight * 100;
  const densityBoost = Math.min(20, propertyDensity / 5);
  return Math.round(Math.min(100, base * 0.85 + densityBoost));
}

export function computeRecencyScore(hoursAgo) {
  // Crime recency decays faster than weather (operational window
  // ~72h to react before damage stabilizes / claims close).
  if (hoursAgo <= 0) return 100;
  const decay = Math.exp(-hoursAgo / 60);   // half-life ~42h
  return Math.round(Math.min(100, decay * 100));
}

export function computeRepeatScore(repeatIncidents30d) {
  // Same neighborhood activity in last 30 days. Heavy non-linear curve:
  // 0 = 10, 1 = 30, 3 = 60, 5 = 80, 8+ = 95.
  const r = Math.max(0, repeatIncidents30d || 0);
  return Math.round(Math.min(95, 10 + Math.sqrt(r) * 28));
}

export function computeTargetingPriority({
  severity_score, cluster_score, property_relevance, recency_score, repeat_score,
}) {
  // Composite score reflecting how operationally interesting this
  // incident is for property-claim outreach.
  const sev   = severity_score      * 0.30;
  const clus  = cluster_score       * 0.25;
  const prop  = property_relevance  * 0.20;
  const rec   = recency_score       * 0.15;
  const rep   = repeat_score        * 0.10;
  return Math.round(sev + clus + prop + rec + rep);
}

function computeClaimLikelihood({ severity_score, property_relevance, recency_score }) {
  return Math.round(Math.min(100,
    severity_score * 0.45 + property_relevance * 0.40 + recency_score * 0.15
  ));
}

function computeConfidence({ has_real_source, recency_score, cluster_score }) {
  const base = has_real_source ? 80 : 65;
  const rec  = recency_score * 0.12;
  const clus = cluster_score * 0.08;
  return Math.round(Math.min(100, base + rec + clus - 4));
}

function recommendationFor(scoring, zoneCluster) {
  const p = scoring.targeting_priority;
  if (p >= 90 && zoneCluster === "SURGING") {
    return {
      action: "TARGET_NOW",
      reason: `Surging cluster with ${scoring.claim_likelihood}% claim relevance. Operator outreach window is open — concentrate within 72h.`,
    };
  }
  if (p >= 85 && (zoneCluster === "ACTIVE" || zoneCluster === "SURGING")) {
    return {
      action: "HIGH_PROPERTY_RISK",
      reason: `Active cluster signals elevated property-damage exposure. Property owners in radius are likely to be receptive.`,
    };
  }
  if (p >= 70) {
    return {
      action: "WATCH_ZONE",
      reason: `Watch zone — ${scoring.cluster_score >= 60 ? "cluster forming" : "operational signal building"}. Re-evaluate as repeat activity decays.`,
    };
  }
  if (p >= 55) {
    return {
      action: "MONITOR",
      reason: `Monitor for escalation. Single-incident signal below deployment threshold today.`,
    };
  }
  if (p >= 35) {
    return {
      action: "ESCALATE",
      reason: `Insufficient cluster signal. Escalate for human review if multiple incidents stack in this zone.`,
    };
  }
  return {
    action: "ARCHIVE",
    reason: `Below operational targeting threshold.`,
  };
}

function recommendedRadius(priority, propertyDensity) {
  // Outreach radius — denser areas need a smaller radius to reach
  // operationally meaningful number of properties.
  if (priority >= 85) return propertyDensity >= 70 ? 0.5 : 1.0;
  if (priority >= 70) return propertyDensity >= 70 ? 0.75 : 1.5;
  return propertyDensity >= 70 ? 1.0 : 2.0;
}

function propertiesAtRisk(propertyDensity, radiusMi) {
  // Rough estimate: density × area × 4 properties per density unit.
  // Backend will replace with real parcel counts.
  const area = Math.PI * radiusMi * radiusMi;
  return Math.round(propertyDensity * area * 4);
}

// ── Deterministic seeding ────────────────────────────────────────────
function seedFrom(s) {
  let h = 5381;
  const str = (s || "").toUpperCase();
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return Math.abs(h);
}

// Demo incident templates — varied event types, cities, cluster sizes,
// ages. Canvas coords cluster around 4 fixed urban hot zones on the
// heat map (matches the existing CrimeIntel canvas design).
const DEMO_INCIDENTS = [
  // Hot Zone A — top-left quadrant (Westwood / Denver-style)
  { event_type: "burglary",        city: "Denver",     state: "CO", neighborhood: "Westwood",       address: "412 Linden Ave",     intensity: 84, repeat: 4, cluster: 6, age_h: 2,  density: 72, zone: "A" },
  { event_type: "vandalism",       city: "Denver",     state: "CO", neighborhood: "Westwood",       address: "228 Birch St",       intensity: 56, repeat: 3, cluster: 6, age_h: 18, density: 72, zone: "A" },
  // Hot Zone B — top-right (Atlanta Midtown)
  { event_type: "auto",            city: "Atlanta",    state: "GA", neighborhood: "Midtown North",  address: "8821 Magnolia Pkwy", intensity: 62, repeat: 2, cluster: 4, age_h: 4,  density: 78, zone: "B" },
  { event_type: "theft",           city: "Atlanta",    state: "GA", neighborhood: "Midtown North",  address: "1244 Peachtree Cir", intensity: 50, repeat: 2, cluster: 4, age_h: 22, density: 78, zone: "B" },
  // Hot Zone C — bottom-left (Houston Heights — high property)
  { event_type: "arson",           city: "Houston",    state: "TX", neighborhood: "Heights",        address: "3155 Elm St",        intensity: 96, repeat: 5, cluster: 11, age_h: 1,  density: 88, zone: "C" },
  { event_type: "property_damage", city: "Houston",    state: "TX", neighborhood: "Heights",        address: "3210 Oak Ave",       intensity: 72, repeat: 5, cluster: 11, age_h: 6,  density: 88, zone: "C" },
  { event_type: "burglary",        city: "Houston",    state: "TX", neighborhood: "Heights",        address: "3055 Pine St",       intensity: 78, repeat: 5, cluster: 11, age_h: 14, density: 88, zone: "C" },
  // Hot Zone D — bottom-right (Phoenix Downtown — moderate)
  { event_type: "civil_unrest",    city: "Phoenix",    state: "AZ", neighborhood: "Downtown",       address: "560 Mission Blvd",   intensity: 68, repeat: 1, cluster: 2, age_h: 8,  density: 65, zone: "D" },
  { event_type: "suspicious_activity", city: "Phoenix",state: "AZ", neighborhood: "Downtown",       address: "612 Mission Blvd",   intensity: 36, repeat: 1, cluster: 2, age_h: 26, density: 65, zone: "D" },
  // Outside hot zones — isolated incident, lower priority
  { event_type: "vandalism",       city: "Charleston", state: "SC", neighborhood: "Old Town",       address: "276 Beaufort St",    intensity: 50, repeat: 1, cluster: 1, age_h: 32, density: 60, zone: "E" },
];

const ZONE_SEEDS = {
  A: { cx: 26, cy: 28 },
  B: { cx: 74, cy: 30 },
  C: { cx: 28, cy: 72 },
  D: { cx: 74, cy: 72 },
  E: { cx: 50, cy: 50 },
};

function generateDemoIncidents() {
  const now = Date.now();
  return DEMO_INCIDENTS.map((tmpl, i) => {
    const seed = seedFrom("CRIME_INTEL_" + tmpl.address + i);
    const zoneSeed = ZONE_SEEDS[tmpl.zone] || ZONE_SEEDS.E;
    // Cluster jitter inside the zone — spreads dots ~±8% around the seed.
    const jx = (seed % 17) - 8;
    const jy = ((seed >> 4) % 17) - 8;
    return enrichIncident({
      id: `inc_${seed.toString().slice(-10)}`,
      event_type: tmpl.event_type,
      reported_at: new Date(now - tmpl.age_h * 3600000).toISOString(),
      hours_ago: tmpl.age_h,
      location: {
        address: tmpl.address,
        neighborhood: tmpl.neighborhood,
        city: tmpl.city,
        state: tmpl.state,
        canvas_x: Math.max(2, Math.min(98, zoneSeed.cx + jx)),
        canvas_y: Math.max(2, Math.min(98, zoneSeed.cy + jy)),
      },
      metrics: {
        repeat_incidents_30d:        tmpl.repeat,
        cluster_size:                tmpl.cluster,
        property_density_est:        tmpl.density,
        last_incident_in_zone_hours: Math.max(1, tmpl.age_h - (seed % 6)),
        incident_intensity:          tmpl.intensity,
      },
      _has_real_source: false,
    });
  });
}

// ── Enrichment pipeline (incident with metrics → fully scored result)
function enrichIncident(inc) {
  const severity_score      = computeSeverityScore(inc.metrics.incident_intensity, inc.event_type);
  const cluster_score       = computeClusterScore(inc.metrics.cluster_size);
  const property_relevance  = computePropertyRelevance(inc.metrics.incident_intensity, inc.event_type, inc.metrics.property_density_est);
  const recency_score       = computeRecencyScore(inc.hours_ago);
  const repeat_score        = computeRepeatScore(inc.metrics.repeat_incidents_30d);
  const targeting_priority  = computeTargetingPriority({ severity_score, cluster_score, property_relevance, recency_score, repeat_score });
  const claim_likelihood    = computeClaimLikelihood({ severity_score, property_relevance, recency_score });
  const confidence          = computeConfidence({ has_real_source: inc._has_real_source, recency_score, cluster_score });
  const urgency             = URGENCY_FROM_PRIORITY(targeting_priority);

  const scoring = { severity_score, cluster_score, property_relevance, recency_score, repeat_score, claim_likelihood, targeting_priority, confidence, urgency };

  const cluster_classification = CLUSTER_FROM_SIZE(inc.metrics.cluster_size);
  const recommendation = recommendationFor(scoring, cluster_classification);
  const radius = recommendedRadius(targeting_priority, inc.metrics.property_density_est);
  const at_risk = propertiesAtRisk(inc.metrics.property_density_est, radius);

  return {
    id: inc.id,
    event_type: inc.event_type,
    severity: SEVERITY_FROM_INTENSITY(severity_score),
    reported_at: inc.reported_at,
    hours_ago: inc.hours_ago,
    location: inc.location,
    metrics: inc.metrics,
    scoring,
    recommendation,
    zone_impact: {
      cluster_classification,
      properties_at_risk_est:         at_risk,
      recommended_outreach_radius_mi: radius,
    },
    _has_real_source: inc._has_real_source,
  };
}

// ── Public API ───────────────────────────────────────────────────────

/** Fetch the active incident feed. Sorted by targeting_priority desc. */
export async function fetchActiveIncidents() {
  if (USE_REAL_API) {
    return apiFetch("/v1/crime-intel/incidents")
      .then(r => r.ok ? r.json() : [])
      .then(arr => Array.isArray(arr) ? arr : []);
  }
  const demo = generateDemoIncidents();
  demo.sort((a, b) => b.scoring.targeting_priority - a.scoring.targeting_priority);
  return demo;
}

/** Aggregate operational metrics for the Op Status strip. */
export function aggregateMetrics(incidents) {
  const total = incidents.length;
  const surgeClusters = incidents.filter(i =>
    i.zone_impact.cluster_classification === "SURGING" ||
    i.zone_impact.cluster_classification === "ACTIVE"
  ).length;
  const targetNow = incidents.filter(i => i.recommendation.action === "TARGET_NOW").length;
  const totalAtRisk = incidents.reduce((s, i) => s + (i.zone_impact.properties_at_risk_est || 0), 0);
  const avgPriority = total
    ? Math.round(incidents.reduce((s, i) => s + i.scoring.targeting_priority, 0) / total)
    : 0;
  const neighborhoods = new Set(incidents.map(i => i.location.neighborhood));
  return {
    total,
    surgeClusters,
    targetNow,
    totalAtRisk,
    avgPriority,
    neighborhoods: neighborhoods.size,
  };
}
