/**
 * Roof Intel — operational targeting service layer.
 *
 * This module is the seam between the UI and the real backend that will
 * eventually power Roof Intel (parcel APIs, satellite imagery, weather
 * overlays, hail-strike services). Today every call resolves through
 * a deterministic mock that returns the same shape the real backend
 * will return; flip USE_REAL_API to true when /v1/roof-intel ships and
 * the UI continues working unchanged.
 *
 * Schema (the contract the UI consumes):
 *
 *   IntelResult = {
 *     id:            string,           // stable hash of the address
 *     address:       string,           // input address as entered
 *     city:          string,
 *     state:         string,           // 2-letter
 *     zip:           string,
 *     lat:           number,           // approximate, not survey grade
 *     lng:           number,
 *     parcel: {
 *       parcel_id:        string,
 *       lot_area_sqft:    number,
 *       year_built:       number,
 *       structures:       number,
 *     },
 *     roof: {
 *       age_estimated_years:  number,
 *       material_estimate:    "asphalt"|"metal"|"tile"|"wood"|"other",
 *       area_sqft:            number,
 *       last_replaced_est:    string|null,   // year or null
 *       condition_estimate:   "good"|"fair"|"poor",
 *     },
 *     hail: {
 *       events_5yr:        number,
 *       max_severity:      "low"|"moderate"|"high"|"extreme",
 *       last_event_date:   string|null,
 *       cumulative_strikes:number,
 *       exposure_score:    number,         // 0-100
 *     },
 *     storm: {
 *       major_events_5yr:  number,
 *       last_major_event:  string|null,
 *       overlap_score:     number,         // 0-100
 *     },
 *     financial: {
 *       replacement_cost_estimate: number, // USD
 *       claim_potential_low:       number,
 *       claim_potential_high:      number,
 *     },
 *     scoring: {
 *       opportunity_score:  number,        // 0-100 composite
 *       claim_likelihood:   number,        // 0-100
 *       confidence:         number,        // 0-100
 *       urgency:            "critical"|"high"|"medium"|"low",
 *     },
 *     recommendation: {
 *       action: "TARGET_NOW"|"WATCH"|"ARCHIVE",
 *       reason: string,
 *     },
 *     analyzed_at: string,                 // ISO timestamp
 *   }
 */

import { apiFetch } from "../../lib/api";

// Toggle to true when the real /v1/roof-intel/analyze endpoint ships.
// Until then, all calls use the deterministic mock pipeline below.
const USE_REAL_API = false;

const CACHE_KEY = "rin_roof_intel_targets";
const CACHE_LIMIT = 24;              // keep most-recent N analyses
const SCAN_LATENCY_MS = 1800;        // mock scan delay
const SEED_MOD_PRIMES = [97, 89, 83, 79, 73, 71, 67, 61, 59, 53];

// ── Deterministic seeding ────────────────────────────────────────────
// Same address → same intel output. Cheap djb2-style hash.
function seedFrom(s) {
  let h = 5381;
  const str = (s || "").toUpperCase();
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return Math.abs(h);
}

// Pick a deterministic value in [min, max] from a seed + dimension index.
function pick(seed, dim, min, max) {
  const p = SEED_MOD_PRIMES[dim % SEED_MOD_PRIMES.length];
  const v = (seed * (dim + 1)) % p;
  const norm = v / (p - 1);                   // 0..1
  return min + norm * (max - min);
}

function pickInt(seed, dim, min, max) {
  return Math.round(pick(seed, dim, min, max));
}

// Try to extract a US state abbreviation from a free-text address.
// Falls back to "FL" so demo addresses always have a plausible state.
const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
function parseState(address) {
  const up = (address || "").toUpperCase();
  for (const s of US_STATES) {
    const re = new RegExp(`\\b${s}\\b`);
    if (re.test(up)) return s;
  }
  return "FL";
}

function parseCity(address) {
  // Last comma-delimited segment before the state token, if present.
  const parts = (address || "").split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2] || "Unknown";
  return "Unknown";
}

function parseZip(seed) {
  return String(10000 + (seed % 89999)).padStart(5, "0");
}

// State centroids for the satellite canvas (normalized 0–100).
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

// ── Pure scoring functions (UI-callable) ────────────────────────────

// Composite opportunity score out of 100, weighted from sub-signals.
// The UI surfaces this as the headline number on every target card.
export function computeOpportunityScore({ hail, storm, roof, financial }) {
  const hailComp   = hail.exposure_score          * 0.40;
  const storyComp  = storm.overlap_score          * 0.15;
  const ageComp    = Math.min(100, roof.age_estimated_years * 4) * 0.25;
  const valueComp  = Math.min(100,
    (financial.replacement_cost_estimate / 600)) * 0.10;
  const condComp   = (roof.condition_estimate === "poor" ? 100
                    : roof.condition_estimate === "fair" ? 60
                    : 30) * 0.10;
  return Math.round(hailComp + storyComp + ageComp + valueComp + condComp);
}

function computeClaimLikelihood({ hail, roof, storm }) {
  // Higher hail + older roof + higher storm overlap = higher likelihood
  const base = (hail.exposure_score * 0.5) + (storm.overlap_score * 0.2);
  const ageMult = Math.min(1.6, 0.6 + roof.age_estimated_years / 25);
  return Math.round(Math.min(100, base * ageMult));
}

function computeConfidence({ parcel, hail, storm }) {
  // Real version derives this from data-source coverage; mock derives
  // from how many input signals are non-zero.
  let s = 60;
  if (parcel.year_built > 0) s += 10;
  if (hail.events_5yr > 0)   s += 12;
  if (storm.major_events_5yr > 0) s += 10;
  if (parcel.lot_area_sqft > 1000) s += 8;
  return Math.min(100, s);
}

function urgencyFromScore(score) {
  if (score >= 90) return "critical";
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function recommendationFor(intel) {
  const s = intel.scoring.opportunity_score;
  const c = intel.scoring.confidence;
  if (s >= 85 && c >= 70) {
    return {
      action: "TARGET_NOW",
      reason: `${intel.scoring.claim_likelihood}% claim likelihood with ${intel.hail.events_5yr} hail events tracked.`,
    };
  }
  if (s >= 60) {
    return {
      action: "WATCH",
      reason: "Watch list — moderate exposure profile, surface again if storm activity escalates.",
    };
  }
  return {
    action: "ARCHIVE",
    reason: "Below targeting threshold for current operations.",
  };
}

// ── Mock intel pipeline ──────────────────────────────────────────────
function mockIntelFor(address) {
  const seed = seedFrom(address);
  const state = parseState(address);
  const city = parseCity(address);
  const zip = parseZip(seed);
  const [sx, sy] = STATE_LL[state] || STATE_LL.FL;

  // Position jitter within the state bucket so multiple addresses in
  // the same state spread out on the canvas.
  const jx = pick(seed, 0, -6, 6);
  const jy = pick(seed, 1, -6, 6);

  const parcel = {
    parcel_id: `P-${String(seed).slice(-7)}`,
    lot_area_sqft: pickInt(seed, 2, 4500, 22000),
    year_built: pickInt(seed, 3, 1950, 2018),
    structures: pickInt(seed, 4, 1, 2),
  };

  const ageYears = 2026 - parcel.year_built;
  const condition = ageYears > 25 ? "poor" : ageYears > 15 ? "fair" : "good";
  const materialOpts = ["asphalt", "asphalt", "asphalt", "tile", "metal", "wood"];
  const roof = {
    age_estimated_years: ageYears,
    material_estimate: materialOpts[pickInt(seed, 5, 0, materialOpts.length - 1)],
    area_sqft: Math.round(parcel.lot_area_sqft * pick(seed, 6, 0.20, 0.45)),
    last_replaced_est: ageYears > 18 ? null : String(parcel.year_built + pickInt(seed, 7, 12, 24)),
    condition_estimate: condition,
  };

  const hailEvents = pickInt(seed, 8, 0, 14);
  const sevTier = hailEvents >= 10 ? "extreme" : hailEvents >= 6 ? "high" : hailEvents >= 3 ? "moderate" : "low";
  const hail = {
    events_5yr: hailEvents,
    max_severity: sevTier,
    last_event_date: hailEvents > 0
      ? new Date(Date.now() - pickInt(seed, 9, 14, 720) * 86400000).toISOString().slice(0, 10)
      : null,
    cumulative_strikes: pickInt(seed, 10, 0, 240),
    exposure_score: Math.min(100, hailEvents * 9 + pickInt(seed, 11, 0, 18)),
  };

  const stormEvents = pickInt(seed, 12, 0, 6);
  const storm = {
    major_events_5yr: stormEvents,
    last_major_event: stormEvents > 0
      ? new Date(Date.now() - pickInt(seed, 13, 30, 900) * 86400000).toISOString().slice(0, 10)
      : null,
    overlap_score: Math.min(100, stormEvents * 18 + pickInt(seed, 14, 0, 12)),
  };

  const replacement = pickInt(seed, 15, 14000, 42000);
  const financial = {
    replacement_cost_estimate: replacement,
    claim_potential_low: Math.round(replacement * 0.45),
    claim_potential_high: Math.round(replacement * 1.05),
  };

  const oppScore = computeOpportunityScore({ hail, storm, roof, financial });
  const intel = {
    id: `ri_${String(seed).slice(-10)}`,
    address: (address || "").trim(),
    city,
    state,
    zip,
    lat: parseFloat((25 + sy / 4).toFixed(4)),
    lng: parseFloat((-125 + sx / 1.4 + jx / 5).toFixed(4)),
    parcel,
    roof,
    hail,
    storm,
    financial,
    scoring: {
      opportunity_score: oppScore,
      claim_likelihood: computeClaimLikelihood({ hail, roof, storm }),
      confidence: computeConfidence({ parcel, hail, storm }),
      urgency: urgencyFromScore(oppScore),
    },
    // Canvas position — used by the UI to drop the target onto the
    // satellite scan grid. Pre-computed so the UI doesn't hard-code
    // geographic logic.
    canvas: {
      x: Math.max(2, Math.min(98, sx + jx)),
      y: Math.max(2, Math.min(98, sy + jy)),
    },
    analyzed_at: new Date().toISOString(),
  };
  intel.recommendation = recommendationFor(intel);
  return intel;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Run a roof intelligence analysis on an address.
 * Resolves to an IntelResult (see schema above).
 */
export async function analyzeAddress(address) {
  if (USE_REAL_API) {
    return apiFetch("/v1/roof-intel/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    }).then(r => r.json());
  }
  // Mock path — same shape the real API will return.
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockIntelFor(address)), SCAN_LATENCY_MS);
  });
}

/** Persist a recently-analyzed target. De-dupes by `id`. Newest first. */
export function saveTarget(intel) {
  try {
    const cur = loadTargets();
    const filtered = cur.filter(t => t.id !== intel.id);
    const next = [intel, ...filtered].slice(0, CACHE_LIMIT);
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return loadTargets();
  }
}

/** Load all cached targets (newest first). Empty array on parse failure. */
export function loadTargets() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Remove a target from cache by id. */
export function removeTarget(id) {
  const cur = loadTargets();
  const next = cur.filter(t => t.id !== id);
  localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  return next;
}

/** Clear all cached targets — used by demo-reset CTA if added later. */
export function clearTargets() {
  localStorage.removeItem(CACHE_KEY);
}
