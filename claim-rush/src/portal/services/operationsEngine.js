/**
 * operationsEngine.js
 *
 * Pure rules engine that converts intelligence (Opportunity Network +
 * memory + pipeline + operator roster) into OperationalActions —
 * concrete things the deployment network should do next.
 *
 * Architecture:
 *
 *   - Pure function: `generateActions(input)` is deterministic. Same
 *     inputs → same actions with the same IDs. Re-runs every time the
 *     surface mounts; the merge step preserves state from persisted
 *     actions so user transitions (Deploy / Snooze / Archive) survive.
 *
 *   - Stable action IDs. Each rule emits a dedupe key derived from
 *     (kind, target/region/lead). Re-fusing the same opportunity does
 *     NOT generate a duplicate action — the persisted state on the
 *     existing action is what wins.
 *
 *   - Backend-ready execution. Each action kind has a `proposed_workflow`
 *     hint; when the real voice / SMS / campaign APIs ship, the
 *     "Deploy" handler in OperationsCommand calls the matching API
 *     keyed by `proposed_workflow`. Until then, "Deploy" is a pure
 *     state transition. The schema doesn't change.
 *
 *   - Auto-archive: actions that haven't been touched in >24h and
 *     whose underlying target no longer appears in the fusion run
 *     drop to ARCHIVED. Keeps the queue current without the operator
 *     having to clean up stale items.
 */

const KEY = "rin_ops_actions_v1";
const SCHEMA_VERSION = 1;
const STALE_HOURS = 24;
const CAP_ACTIONS = 200;

// ── Action kinds ────────────────────────────────────────────────────
//
// Names match the spec verbatim. Ordering here drives ranking when
// priority ties — earlier kinds outrank later ones at the same score.
export const ACTION_KIND = {
  ESCALATE_SURGE_ZONE:      "ESCALATE_SURGE_ZONE",
  RECOMMEND_STAFFING:       "RECOMMEND_STAFFING",
  ASSIGN_OPERATOR:          "ASSIGN_OPERATOR",
  TRIGGER_VOICE_WORKFLOW:   "TRIGGER_VOICE_WORKFLOW",
  AUTO_CREATE_CAMPAIGN:     "AUTO_CREATE_CAMPAIGN",
  SCHEDULE_SMS_EMAIL:       "SCHEDULE_SMS_EMAIL",
  PRIORITIZE_ROUTING:       "PRIORITIZE_ROUTING",
  CREATE_OUTREACH_QUEUE:    "CREATE_OUTREACH_QUEUE",
  // Phase 2 (2026-05-17) — practical operational follow-ups
  // generated from existing live data, no synthetic input.
  UNCONTACTED_FIRE_LEADS:   "UNCONTACTED_FIRE_LEADS",
  STALE_OUTREACH_FOLLOWUP:  "STALE_OUTREACH_FOLLOWUP",
  INACTIVE_SIGNED_CLAIM:    "INACTIVE_SIGNED_CLAIM",
};

// ── Reserve estimate per action kind (Phase 2) ──────────────────────
// Centralised cost-per-unit table aligned with the Phase 1 cheat-sheet
// values published in the Operational Reserve UI on rin.aciunited.com.
// Numbers here are ESTIMATES — they preview what the action would cost
// IF deployed, never the actual debit. Real consumption happens later
// when execution wires through to the backend wallet gates.
const RESERVE_ESTIMATE_PER_UNIT = {
  ESCALATE_SURGE_ZONE:     3_000,   // mixed-channel surge (rough avg)
  RECOMMEND_STAFFING:          0,   // operational change, no platform spend
  ASSIGN_OPERATOR:             0,   // routing change, no platform spend
  TRIGGER_VOICE_WORKFLOW:  2_500,   // matches AI Voice Call cheat-sheet
  AUTO_CREATE_CAMPAIGN:      120,   // SMS-first
  SCHEDULE_SMS_EMAIL:        120,   // SMS cheat-sheet value
  PRIORITIZE_ROUTING:          0,
  CREATE_OUTREACH_QUEUE:     240,   // blended SMS + skip trace
  UNCONTACTED_FIRE_LEADS:    240,   // skip trace + SMS first contact
  STALE_OUTREACH_FOLLOWUP:   120,   // SMS nudge
  INACTIVE_SIGNED_CLAIM:   2_500,   // AI voice follow-up
};

/** Compute the reserve-estimate for a partial action. Reads:
 *    - kind  (required)
 *    - meta.leadCount / meta.targetCount / meta.activeSignalCount
 *  Falls back to 1 unit when no count is supplied. Returns 0 for
 *  operational changes that don't touch platform tools. */
function estimateReserveCost(partial) {
  const perUnit = RESERVE_ESTIMATE_PER_UNIT[partial?.kind] ?? 0;
  if (perUnit === 0) return 0;
  const meta = partial?.meta || {};
  const units = Number(
    meta.leadCount
    ?? meta.targetCount
    ?? meta.incidentCount
    ?? meta.activeSignalCount
    ?? 1
  );
  return Math.max(0, Math.round(perUnit * units));
}

const ACTION_KIND_RANK = Object.keys(ACTION_KIND).reduce((acc, k, i) => {
  acc[ACTION_KIND[k]] = i; return acc;
}, {});

// ── Action states ───────────────────────────────────────────────────
export const ACTION_STATE = {
  QUEUED:     "QUEUED",
  DEPLOYED:   "DEPLOYED",
  MONITORING: "MONITORING",
  EXECUTED:   "EXECUTED",
  ESCALATED:  "ESCALATED",
  FAILED:     "FAILED",
  ARCHIVED:   "ARCHIVED",
};

// Allowed state transitions. Used by the surface to guard the buttons.
export const STATE_TRANSITIONS = {
  QUEUED:     ["DEPLOYED", "ESCALATED", "ARCHIVED"],
  DEPLOYED:   ["MONITORING", "EXECUTED", "FAILED", "ESCALATED", "ARCHIVED"],
  MONITORING: ["EXECUTED", "FAILED", "ESCALATED", "ARCHIVED"],
  EXECUTED:   ["ARCHIVED"],
  ESCALATED:  ["DEPLOYED", "EXECUTED", "ARCHIVED"],
  FAILED:     ["DEPLOYED", "ARCHIVED"],
  ARCHIVED:   [],
};

// ── Persistence ─────────────────────────────────────────────────────

function _emptyState() {
  return {
    version: SCHEMA_VERSION,
    actions: {}, // id → OperationalAction
    meta: { firstWriteAt: null, lastWriteAt: null },
  };
}

function _load() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (!raw) return _emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return _emptyState();
    if (!parsed.version) return Object.assign(_emptyState(), parsed, { version: SCHEMA_VERSION });
    return parsed;
  } catch {
    return _emptyState();
  }
}

function _save(state) {
  try {
    state.meta.lastWriteAt = new Date().toISOString();
    if (!state.meta.firstWriteAt) state.meta.firstWriteAt = state.meta.lastWriteAt;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(KEY, JSON.stringify(state));
    }
  } catch {
    // Quota / private mode → swallow.
  }
}

// ── Operator roster fallback ────────────────────────────────────────
//
// Mirrors the OPERATOR_ROSTER in leadConversion.js so the rules engine
// has a working roster even before the memory layer has recorded any
// operator activity. Source of truth long-term: server-side roster.

export const FALLBACK_ROSTER = [
  { id: "op_garza",   name: "J. Garza",    region: "SOUTH",   states: ["FL","GA","SC","NC","AL","TN","MS","LA","TX"] },
  { id: "op_chen",    name: "M. Chen",     region: "WEST",    states: ["CA","OR","WA","NV","AZ","UT","ID","HI","AK"] },
  { id: "op_oneill",  name: "S. O'Neill",  region: "MOUNTAIN",states: ["CO","NM","WY","MT","UT"] },
  { id: "op_byrne",   name: "K. Byrne",    region: "NORTHEAST",states: ["NY","NJ","PA","CT","MA","RI","NH","VT","ME","MD","DE","DC","WV","VA"] },
  { id: "op_diaz",    name: "R. Diaz",     region: "MIDWEST", states: ["IL","IN","OH","MI","WI","MN","IA","MO","KS","NE","ND","SD","KY","AR","OK"] },
];

function operatorsForState(state) {
  const upper = (state || "").toUpperCase();
  return FALLBACK_ROSTER.filter(op => op.states.includes(upper));
}

// ── Operator routing intelligence ───────────────────────────────────
//
// Picks the best operator for a target given:
//   - territory match (must cover the state)
//   - signal-type fit (operator with most leads in this dominant source)
//   - current workload (penalty for ≥5 active actions)
//
// Returns { operator, score, reason } where `score` is a 0-100 fit
// rating used to populate the action's confidence field.
export function recommendOperator({ state, dominantSource, memory, currentActions = [], effectiveness = null }) {
  if (!state) return null;
  const candidates = operatorsForState(state);
  if (candidates.length === 0) return null;

  const opMemory = memory?.operators || {};
  const opEff    = effectiveness?.byOperator || {};
  const workload = {};
  currentActions.forEach(a => {
    if (a.state !== "QUEUED" && a.state !== "DEPLOYED" && a.state !== "MONITORING") return;
    const op = a.proposed_operator?.name;
    if (!op) return;
    workload[op] = (workload[op] || 0) + 1;
  });

  let best = null;
  let bestScore = -1;
  let bestReason = "";

  for (const op of candidates) {
    const m = opMemory[op.name];
    const eff = opEff[op.name];
    const leadsThisSignal = m?.leadsBySignal?.[dominantSource] || 0;
    const leadsThisRegion = (m?.leadsByRegion?.[state]) || 0;
    const totalLeads = m?.leadsAssigned || 0;
    const wl = workload[op.name] || 0;

    // Response velocity (avg time-to-response in ms). Faster operators
    // get a small bonus; slower operators take a small penalty. We cap
    // both directions so velocity never dominates the territory + fit
    // signals — it's a tiebreaker, not the primary driver.
    const avgRespMs = eff?.avgTimeToResponseMs || null;
    let velocityBonus = 0;
    let velocityNote  = "";
    if (avgRespMs != null) {
      // <15min response → +10, <60min → +5, >4h → -5.
      if (avgRespMs <= 15 * 60_000)      { velocityBonus = 10; velocityNote = "fast responder"; }
      else if (avgRespMs <= 60 * 60_000) { velocityBonus =  5; velocityNote = "responsive"; }
      else if (avgRespMs >= 4 * 3600_000){ velocityBonus = -5; velocityNote = "slow responder"; }
    }

    // Score: weight signal-fit highest, then region depth, then total
    // throughput, minus a workload penalty, plus velocity tiebreaker.
    let score = 30; // baseline territory match
    score += Math.min(35, leadsThisSignal * 6);
    score += Math.min(20, leadsThisRegion * 4);
    score += Math.min(10, totalLeads);
    score -= Math.min(25, Math.max(0, wl - 2) * 6);
    score += velocityBonus;
    score = Math.max(0, Math.min(100, score));

    let reason;
    if (leadsThisSignal >= 3) {
      reason = `Top closer for ${dominantSource?.toLowerCase() || "signal"} leads in ${state} (${leadsThisSignal} prior).`;
    } else if (leadsThisRegion >= 2) {
      reason = `Established ${state} territory presence (${leadsThisRegion} prior leads).`;
    } else if (totalLeads >= 1) {
      reason = `${op.region} regional coverage; ${totalLeads} total assignments.`;
    } else {
      reason = `${op.region} regional coverage; territory match for ${state}.`;
    }
    if (velocityNote) reason += ` ${velocityNote.charAt(0).toUpperCase() + velocityNote.slice(1)}.`;
    if (wl >= 5) {
      reason += ` Note: ${wl} actions in flight — workload penalty applied.`;
    }

    if (score > bestScore) {
      best = op;
      bestScore = score;
      bestReason = reason;
    }
  }

  return best ? { operator: best, score: bestScore, reason: bestReason } : null;
}

// ── Rules ───────────────────────────────────────────────────────────
//
// Each rule is a function: `(input) => OperationalAction[]`. The
// orchestrator concatenates and dedupes by id. Rules don't mutate;
// they emit pure descriptors.

function urgencyForScore(score) {
  if (score >= 88) return "critical";
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function makeAction(partial) {
  const now = new Date().toISOString();
  const merged = {
    state: ACTION_STATE.QUEUED,
    created_at: now,
    state_changed_at: now,
    deployed_at: null, // first DEPLOYED transition timestamp — drives time-to-response math
    meta: {},
    target_ref: null,
    lead_ref: null,
    proposed_operator: null,
    proposed_workflow: null,
    region: { state: null, city: null },
    base_confidence: null,         // pre-learning confidence (set by applyLearningWeights)
    learned_lift: null,             // confidence adjustment applied by learning layer
    outcomes: _emptyOutcomes(),
    audit_log: [],                  // append-only execution + transition trail
    retry_count: 0,
    ...partial,
  };
  // Phase 2: stamp reserve estimate AFTER the spread so every newly
  // generated action surfaces the same shape. Existing rules that
  // already set meta.leadCount / meta.targetCount automatically get
  // an accurate estimate; rules with no count get the base per-unit
  // value (which is honest — the surface labels it as an estimate).
  merged.reserve_estimate = estimateReserveCost(merged);
  return merged;
}

// ── Audit log primitives ────────────────────────────────────────────
//
// Every state change and every outreach dispatch appends one entry.
// The log is capped at 30 entries per action so a chatty workflow
// doesn't bloat localStorage; older entries roll off (we keep the
// most recent execution + transition records, which is what the
// trust layer needs).
const AUDIT_CAP_PER_ACTION = 30;

function _ringPushAudit(arr, entry) {
  arr.push(entry);
  while (arr.length > AUDIT_CAP_PER_ACTION) arr.shift();
}

/**
 * Append an audit entry to a persisted action. Idempotent in the sense
 * that it never errors if the action is missing — caller can call
 * blindly. Used by setActionState + the surface's outreach handler.
 */
export function appendAudit(actionId, entry) {
  if (!actionId || !entry) return null;
  const state = _load();
  const action = state.actions?.[actionId];
  if (!action) return null;
  if (!Array.isArray(action.audit_log)) action.audit_log = [];
  const stamped = { ts: new Date().toISOString(), ...entry };
  _ringPushAudit(action.audit_log, stamped);
  if (entry.kind === "execution" && entry.result === "failed") {
    action.retry_count = (action.retry_count || 0) + 1;
  }
  state.actions[actionId] = action;
  _save(state);
  return action;
}

function _emptyOutcomes() {
  return {
    contacted: false, contactedAt: null,
    responded: false, respondedAt: null,
    converted: false, convertedAt: null,
    signed: false,    signedAt: null,    // future signal (CRM)
    closedWon: false, closedWonAt: null, // future signal (CRM)
    ignored: false,   ignoredAt: null,   // operator never engaged
    reassigned: false,
    failed: false,    failedAt: null,
    timeToResponseMs:   null,
    timeToConversionMs: null,
  };
}

/**
 * Idempotent outcome recorder. Merges partial outcome state into an
 * action's `outcomes` object; never downgrades a true→false flag,
 * never overwrites a timestamp once set.
 *
 * Called by the operations-learning sweep + the surface's
 * "Mark Contacted / Mark Responded" micro-buttons.
 */
export function recordOutcome(actionId, partial) {
  if (!partial) return null;
  const state = _load();
  const action = state.actions?.[actionId];
  if (!action) return null;

  const cur = action.outcomes || _emptyOutcomes();
  const next = { ...cur };

  for (const key of ["contacted", "responded", "converted", "signed", "closedWon", "ignored", "reassigned", "failed"]) {
    if (partial[key] === true && !cur[key]) {
      next[key] = true;
      const ts = partial[`${key}At`] || new Date().toISOString();
      next[`${key}At`] = ts;
    }
  }

  // Derive timing metrics from the deploy timestamp.
  const deployedAt = action.deployed_at ? new Date(action.deployed_at).getTime() : null;
  if (deployedAt) {
    if (next.responded && next.respondedAt && next.timeToResponseMs == null) {
      next.timeToResponseMs = Math.max(0, new Date(next.respondedAt).getTime() - deployedAt);
    }
    if (next.converted && next.convertedAt && next.timeToConversionMs == null) {
      next.timeToConversionMs = Math.max(0, new Date(next.convertedAt).getTime() - deployedAt);
    }
  }

  state.actions[actionId] = { ...action, outcomes: next };
  _save(state);
  return state.actions[actionId];
}

// ── Rule 1: ESCALATE_SURGE_ZONE ─────────────────────────────────────
//
// Triggers when a region has ≥3 active signals AND opportunity score
// ≥80. Memory-confirmed regions (prior conversions in this region)
// boost confidence further — that's the "we know this zone produces"
// signal that separates a hot opportunity from a known goldmine.
function ruleEscalateSurge({ unifiedTargets, memory }) {
  const out = [];
  for (const t of unifiedTargets) {
    if (t.opportunityScore < 80) continue;
    if (t.activeSignalCount < 3) continue;
    const priorConv = (() => {
      const targets = memory?.targets || {};
      let n = 0;
      for (const tt of Object.values(targets)) {
        if (!tt.convertedToLead) continue;
        if (tt.region?.state === t.region.state && (tt.region?.city || null) === (t.region.city || null)) n += 1;
      }
      return n;
    })();
    const confidence = Math.min(99, 70 + (t.activeSignalCount - 3) * 5 + priorConv * 6);
    const sources = (t.sourceSignals || []).map(s => s.source).join(" + ").toLowerCase();
    const reasoning =
      `${t.label} shows ${t.activeSignalCount}-signal convergence (${sources}) ` +
      `at opportunity score ${t.opportunityScore}.` +
      (priorConv > 0 ? ` Memory confirms ${priorConv} prior conversion${priorConv === 1 ? "" : "s"} in this region.` : "") +
      ` Engine recommends declaring SURGE ZONE and concentrating outreach capacity here.`;
    out.push(makeAction({
      id: `ESCALATE_SURGE__${t.id}`,
      kind: ACTION_KIND.ESCALATE_SURGE_ZONE,
      title: `Escalate surge zone · ${t.label}`,
      reasoning,
      priority: Math.min(100, t.opportunityScore + 2),
      urgency: "critical",
      confidence,
      region: t.region,
      target_ref: t.id,
      proposed_workflow: "surge",
      meta: { activeSignalCount: t.activeSignalCount, priorConv, sources },
    }));
  }
  return out;
}

// ── Rule 2: RECOMMEND_STAFFING ──────────────────────────────────────
//
// Per-state: when ≥3 surge-class targets land in the same state but
// the operator roster shows ≤1 operator with active leads there, the
// region is operationally understaffed for the inbound volume.
function ruleStaffing({ unifiedTargets, memory }) {
  const byState = {};
  for (const t of unifiedTargets) {
    if (!["TARGET_NOW", "SURGE_ZONE", "DEPLOY"].includes(t.recommendation.action)) continue;
    const s = t.region.state;
    if (!s) continue;
    if (!byState[s]) byState[s] = [];
    byState[s].push(t);
  }
  const out = [];
  const opMem = memory?.operators || {};
  for (const [state, list] of Object.entries(byState)) {
    if (list.length < 3) continue;
    // Operators with at least one historical lead in this state.
    const activeOps = Object.values(opMem).filter(op => (op.leadsByRegion?.[state] || 0) > 0).length;
    if (activeOps > 1) continue;
    const top = [...list].sort((a, b) => b.opportunityScore - a.opportunityScore)[0];
    const reasoning =
      `${state} has ${list.length} surge-class opportunit${list.length === 1 ? "y" : "ies"} ` +
      `(top: ${top.label} at score ${top.opportunityScore}) ` +
      `but only ${activeOps} operator${activeOps === 1 ? "" : "s"} with active assignments in territory. ` +
      `Engine recommends staffing increase or temporary cross-region detail.`;
    out.push(makeAction({
      id: `STAFFING__${state}`,
      kind: ACTION_KIND.RECOMMEND_STAFFING,
      title: `Staffing increase recommended · ${state}`,
      reasoning,
      priority: 84,
      urgency: "high",
      confidence: 78 + Math.min(15, (list.length - 3) * 4),
      region: { state, city: null },
      proposed_workflow: "staffing",
      meta: { surgeCount: list.length, activeOps },
    }));
  }
  return out;
}

// ── Rule 3: ASSIGN_OPERATOR ─────────────────────────────────────────
//
// Every TARGET_NOW / DEPLOY / SURGE_ZONE target without an
// established operator assignment → emit one ASSIGN action.
function ruleAssignOperator({ unifiedTargets, memory, persistedActions, effectiveness }) {
  const out = [];
  for (const t of unifiedTargets) {
    if (!["TARGET_NOW", "SURGE_ZONE", "DEPLOY"].includes(t.recommendation.action)) continue;
    const dom = t.dominant_signal;
    const dominantSource = dom?.source || "STORM";
    const rec = recommendOperator({
      state: t.region.state,
      dominantSource,
      memory,
      currentActions: Object.values(persistedActions || {}),
      effectiveness: effectiveness || null,
    });
    if (!rec) continue;
    const reasoning =
      `${t.label} requires operator assignment (${t.recommendation.action.replace(/_/g, " ")} at score ${t.opportunityScore}). ` +
      rec.reason +
      ` Dominant signal · ${dominantSource}.`;
    out.push(makeAction({
      id: `ASSIGN_OPERATOR__${t.id}`,
      kind: ACTION_KIND.ASSIGN_OPERATOR,
      title: `Assign ${rec.operator.name} · ${t.label}`,
      reasoning,
      priority: Math.min(99, t.opportunityScore + 1),
      urgency: urgencyForScore(t.opportunityScore),
      confidence: rec.score,
      region: t.region,
      target_ref: t.id,
      proposed_operator: { id: rec.operator.id, name: rec.operator.name },
      proposed_workflow: "assignment",
      meta: { dominantSource },
    }));
  }
  return out;
}

// ── Rule 4: TRIGGER_VOICE_WORKFLOW ──────────────────────────────────
//
// Every CRITICAL urgency target with a property-level address — these
// are the "call now" properties Marcus (the AI voice agent) handles.
function ruleVoiceWorkflow({ unifiedTargets }) {
  const out = [];
  for (const t of unifiedTargets) {
    if (t.urgency !== "critical") continue;
    const dom = t.dominant_signal;
    if (dom?.source !== "ROOF" || !dom?.raw?.address) continue;
    const addr = dom.raw.address;
    const reasoning =
      `${addr} is a critical-urgency property target ` +
      `(opportunity ${t.opportunityScore} · confidence ${t.confidence}%). ` +
      `Engine recommends triggering Marcus voice outreach within 30 minutes — ` +
      `time-decay model shows critical contacts have a ~70% callback rate within the first hour.`;
    out.push(makeAction({
      id: `VOICE_WORKFLOW__${t.id}`,
      kind: ACTION_KIND.TRIGGER_VOICE_WORKFLOW,
      title: `Voice outreach · ${addr}`,
      reasoning,
      priority: Math.min(100, t.opportunityScore + 3),
      urgency: "critical",
      confidence: Math.min(99, t.confidence + 4),
      region: t.region,
      target_ref: t.id,
      proposed_workflow: "voice",
      meta: { agent: "marcus", address: addr },
    }));
  }
  return out;
}

// ── Rule 5: AUTO_CREATE_CAMPAIGN ────────────────────────────────────
//
// Triggers when ≥5 targets in the same state share a signal signature
// (e.g. five ROOF+STORM targets in TX). That's a campaign-shaped
// pattern, not a one-off lead.
function ruleAutoCampaign({ unifiedTargets }) {
  const buckets = {};
  for (const t of unifiedTargets) {
    if (t.opportunityScore < 60) continue;
    const sources = (t.sourceSignals || []).map(s => s.source).sort().join("+");
    const key = `${t.region.state}|${sources}`;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(t);
  }
  const out = [];
  for (const [key, list] of Object.entries(buckets)) {
    if (list.length < 5) continue;
    const [state, sig] = key.split("|");
    const sigPretty = sig.split("+").join(" + ").toLowerCase();
    const reasoning =
      `${list.length} ${state} opportunit${list.length === 1 ? "y" : "ies"} share the same signal signature (${sigPretty}). ` +
      `Pattern is campaign-shaped, not lead-shaped. ` +
      `Engine recommends auto-creating an outreach campaign keyed to ${sigPretty} — ` +
      `unified messaging will outperform one-off touches.`;
    out.push(makeAction({
      id: `CAMPAIGN__${state}__${sig}`,
      kind: ACTION_KIND.AUTO_CREATE_CAMPAIGN,
      title: `Campaign · ${state} · ${sigPretty}`,
      reasoning,
      priority: 76,
      urgency: "high",
      confidence: 72 + Math.min(20, list.length * 2),
      region: { state, city: null },
      proposed_workflow: "campaign",
      meta: { signature: sig, count: list.length },
    }));
  }
  return out;
}

// ── Rule 6: SCHEDULE_SMS_EMAIL ──────────────────────────────────────
//
// Every HIGH urgency target gets a 3-touch sequence proposed.
function ruleSmsEmail({ unifiedTargets }) {
  const out = [];
  for (const t of unifiedTargets) {
    if (t.urgency !== "high") continue;
    if (!["TARGET_NOW", "SURGE_ZONE", "DEPLOY", "WATCH"].includes(t.recommendation.action)) continue;
    const reasoning =
      `${t.label} is a high-urgency target (score ${t.opportunityScore}). ` +
      `Engine recommends a 3-touch SMS + email sequence over 72 hours: ` +
      `T+0 SMS warm-open, T+24h email with damage-recovery context, T+48h SMS callback prompt.`;
    out.push(makeAction({
      id: `SMS_EMAIL__${t.id}`,
      kind: ACTION_KIND.SCHEDULE_SMS_EMAIL,
      title: `Schedule SMS + email sequence · ${t.label}`,
      reasoning,
      priority: Math.max(50, t.opportunityScore - 5),
      urgency: "high",
      confidence: Math.min(95, t.confidence),
      region: t.region,
      target_ref: t.id,
      proposed_workflow: "sms_email",
      meta: { sequence: ["sms_t0", "email_t24", "sms_t48"] },
    }));
  }
  return out;
}

// ── Rule 7: PRIORITIZE_ROUTING ──────────────────────────────────────
//
// Pipeline leads in GENERATED state whose region maps to a critical
// unified target → bump to OUTREACH_READY priority routing.
function rulePrioritizeRouting({ unifiedTargets, pipeline }) {
  const out = [];
  const criticalRegions = new Set(
    unifiedTargets
      .filter(t => t.urgency === "critical")
      .map(t => `${t.region.city || ""}|${t.region.state || ""}`)
  );
  for (const lead of pipeline) {
    if (lead.operational_stage !== "GENERATED") continue;
    const k = `${lead.property?.city || ""}|${lead.property?.state || ""}`;
    if (!criticalRegions.has(k)) continue;
    out.push(makeAction({
      id: `ROUTING_PRIORITY__${lead.id}`,
      kind: ACTION_KIND.PRIORITIZE_ROUTING,
      title: `Priority-route · ${lead.property?.city || lead.property?.state}`,
      reasoning:
        `Lead ${lead.id} sits in a critical-urgency region but is still in GENERATED stage. ` +
        `Engine recommends bumping to OUTREACH_READY and front-loading the operator queue.`,
      priority: 70,
      urgency: "high",
      confidence: 88,
      region: { state: lead.property?.state || null, city: lead.property?.city || null },
      lead_ref: lead.id,
      proposed_workflow: "routing",
      meta: {},
    }));
  }
  return out;
}

// ── Rule 8: CREATE_OUTREACH_QUEUE ───────────────────────────────────
//
// When ≥3 leads in the same state are in the pipeline, propose a
// regional outreach queue so they ship as a coordinated batch.
function ruleOutreachQueue({ pipeline }) {
  const byState = {};
  for (const lead of pipeline) {
    if (lead.operational_stage === "ARCHIVED" || lead.operational_stage === "CONVERTED") continue;
    const s = lead.property?.state || lead.territory?.state;
    if (!s) continue;
    if (!byState[s]) byState[s] = [];
    byState[s].push(lead);
  }
  const out = [];
  for (const [state, list] of Object.entries(byState)) {
    if (list.length < 3) continue;
    out.push(makeAction({
      id: `OUTREACH_QUEUE__${state}`,
      kind: ACTION_KIND.CREATE_OUTREACH_QUEUE,
      title: `Create regional outreach queue · ${state}`,
      reasoning:
        `${list.length} active leads pending in ${state}. ` +
        `Engine recommends bundling into a regional outreach queue — coordinated deployment ` +
        `outperforms individual sends and reduces operator context-switching.`,
      priority: 60,
      urgency: "medium",
      confidence: 80,
      region: { state, city: null },
      proposed_workflow: "queue",
      meta: { leadCount: list.length },
    }));
  }
  return out;
}

// ── Rule 9: UNCONTACTED_FIRE_LEADS ──────────────────────────────────
//
// Counts live fire incidents that have no matching lead in the
// pipeline yet, grouped by city/state. Surfaces a "first-contact"
// suggested play when ≥3 unmatched incidents stack up in one region.
// Pure read of existing fireIncidents + pipeline; no synthetic data.
function ruleUncontactedFireLeads({ fireIncidents = [], pipeline = [] }) {
  if (!Array.isArray(fireIncidents) || fireIncidents.length === 0) return [];
  // Build a set of (state|city) keys that already have a pipeline lead.
  const covered = new Set();
  for (const lead of pipeline) {
    const k = `${(lead.property?.state || lead.territory?.state || "").toLowerCase()}|`
            + `${(lead.property?.city || lead.territory?.city || "").toLowerCase()}`;
    covered.add(k);
  }
  // Bucket fire incidents by region; skip ones already covered by a
  // pipeline lead in the same city — those have an operator on them.
  const buckets = {};
  for (const inc of fireIncidents) {
    const state = inc.state || inc.region?.state || inc.address?.state || null;
    const city  = inc.city  || inc.region?.city  || inc.address?.city  || null;
    if (!state) continue;
    const k = `${state.toLowerCase()}|${(city || "").toLowerCase()}`;
    if (covered.has(k)) continue;
    if (!buckets[k]) buckets[k] = { state, city, items: [] };
    buckets[k].items.push(inc);
  }
  const out = [];
  for (const [, b] of Object.entries(buckets)) {
    if (b.items.length < 3) continue;
    const cityLabel = b.city ? `${b.city}, ${b.state}` : b.state;
    out.push(makeAction({
      id: `UNCONTACTED_FIRE__${b.state}__${b.city || "ANY"}`.toUpperCase(),
      kind: ACTION_KIND.UNCONTACTED_FIRE_LEADS,
      title: `${b.items.length} uncontacted structure-fire leads · ${cityLabel}`,
      reasoning:
        `${b.items.length} active fire incidents in ${cityLabel} have no matching ` +
        `lead in the pipeline yet. Engine recommends a first-contact batch ` +
        `(skip trace + SMS) to convert the cluster into qualified opportunities ` +
        `before they cool.`,
      priority: Math.min(95, 60 + b.items.length * 2),
      urgency: b.items.length >= 8 ? "high" : "medium",
      confidence: Math.min(92, 70 + b.items.length * 2),
      region: { state: b.state, city: b.city },
      proposed_workflow: "first_contact_batch",
      meta: { incidentCount: b.items.length },
    }));
  }
  return out;
}

// ── Rule 10: STALE_OUTREACH_FOLLOWUP ────────────────────────────────
//
// Pipeline leads sitting in early-stage states (GENERATED, OUTREACH_READY)
// with no contact activity in >24h. Bundles them per state into a
// "follow-up nudge" play. Threshold deliberately permissive — 1 stale
// lead is enough since dormancy compounds.
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;
function ruleStaleOutreachFollowup({ pipeline = [] }) {
  if (!Array.isArray(pipeline) || pipeline.length === 0) return [];
  const now = Date.now();
  const buckets = {};
  for (const lead of pipeline) {
    const stage = lead.operational_stage;
    if (stage !== "GENERATED" && stage !== "OUTREACH_READY") continue;
    const lastTouchIso =
      lead.last_outreach_at
      || lead.last_contact_at
      || lead.last_attempted_at
      || lead.created_at
      || null;
    if (!lastTouchIso) continue;
    const lastTouchMs = Date.parse(lastTouchIso);
    if (!Number.isFinite(lastTouchMs)) continue;
    if (now - lastTouchMs < STALE_THRESHOLD_MS) continue;
    const state = lead.property?.state || lead.territory?.state;
    if (!state) continue;
    if (!buckets[state]) buckets[state] = [];
    buckets[state].push(lead);
  }
  const out = [];
  for (const [state, list] of Object.entries(buckets)) {
    out.push(makeAction({
      id: `STALE_FOLLOWUP__${state}`,
      kind: ACTION_KIND.STALE_OUTREACH_FOLLOWUP,
      title: `${list.length} lead${list.length === 1 ? "" : "s"} awaiting outreach > 24h · ${state}`,
      reasoning:
        `${list.length} active lead${list.length === 1 ? " is" : "s are"} sitting in ` +
        `early-stage outreach for >24 hours without a recorded contact attempt in ${state}. ` +
        `Engine recommends an SMS nudge batch to re-engage before the cluster ages out ` +
        `of high-intent.`,
      priority: 55 + Math.min(20, list.length * 2),
      urgency: list.length >= 5 ? "high" : "medium",
      confidence: 82,
      region: { state, city: null },
      proposed_workflow: "sms_nudge_batch",
      meta: { leadCount: list.length },
    }));
  }
  return out;
}

// ── Rule 11: INACTIVE_SIGNED_CLAIM ──────────────────────────────────
//
// Leads that crossed into SIGNED / CONVERTED state but show no
// activity in 7+ days. AI voice follow-up is the suggested play.
// This is the "make sure your won deals aren't stalling" guard.
const INACTIVE_CLAIM_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
function ruleInactiveSignedClaim({ pipeline = [] }) {
  if (!Array.isArray(pipeline) || pipeline.length === 0) return [];
  const now = Date.now();
  const buckets = {};
  for (const lead of pipeline) {
    const stage = lead.operational_stage;
    if (stage !== "SIGNED" && stage !== "CONVERTED" && stage !== "WON") continue;
    const lastTouchIso =
      lead.last_activity_at
      || lead.last_contact_at
      || lead.signed_at
      || lead.converted_at
      || null;
    if (!lastTouchIso) continue;
    const lastTouchMs = Date.parse(lastTouchIso);
    if (!Number.isFinite(lastTouchMs)) continue;
    if (now - lastTouchMs < INACTIVE_CLAIM_THRESHOLD_MS) continue;
    const state = lead.property?.state || lead.territory?.state || "UNKNOWN";
    if (!buckets[state]) buckets[state] = [];
    buckets[state].push(lead);
  }
  const out = [];
  for (const [state, list] of Object.entries(buckets)) {
    out.push(makeAction({
      id: `INACTIVE_SIGNED_CLAIM__${state}`,
      kind: ACTION_KIND.INACTIVE_SIGNED_CLAIM,
      title: `${list.length} signed claim${list.length === 1 ? "" : "s"} missing follow-up · ${state}`,
      reasoning:
        `${list.length} signed-state lead${list.length === 1 ? " has" : "s have"} shown no ` +
        `activity in 7+ days in ${state}. Won deals stall when they go quiet; engine recommends ` +
        `an AI voice follow-up to re-confirm status and unblock anything outstanding.`,
      priority: 75,
      urgency: list.length >= 3 ? "high" : "medium",
      confidence: 85,
      region: { state, city: null },
      proposed_workflow: "ai_voice_followup",
      meta: { leadCount: list.length },
    }));
  }
  return out;
}

// ── Orchestrator ────────────────────────────────────────────────────

export function generateActions(input = {}) {
  const persisted = _load();
  const persistedActions = persisted.actions || {};
  const params = { ...input, persistedActions };

  const all = [
    ...ruleEscalateSurge(params),
    ...ruleStaffing(params),
    ...ruleAssignOperator(params),
    ...ruleVoiceWorkflow(params),
    ...ruleAutoCampaign(params),
    ...ruleSmsEmail(params),
    ...rulePrioritizeRouting(params),
    ...ruleOutreachQueue(params),
    // Phase 2 — practical follow-up rules driven by real intel + pipeline state.
    ...ruleUncontactedFireLeads(params),
    ...ruleStaleOutreachFollowup(params),
    ...ruleInactiveSignedClaim(params),
  ];

  // Dedupe within this run by id (rules can theoretically collide).
  const dedup = {};
  for (const a of all) {
    if (!dedup[a.id]) dedup[a.id] = a;
  }
  return Object.values(dedup);
}

/**
 * Wraps an in-memory action with a learning-adjusted confidence value.
 * The pre-adjustment number lives on `base_confidence` so the surface
 * can show "↑12 learned" / "↓6 learned" deltas — operator-visible
 * proof that the engine is updating itself.
 *
 * Called by callers that have an `eff` snapshot from the
 * operations-learning service. If `multiplier` is null/1, this is a
 * no-op clone.
 */
export function withLearnedConfidence(action, multiplier) {
  if (!multiplier || multiplier === 1) {
    return { ...action, base_confidence: action.confidence, learned_lift: 0 };
  }
  const base = action.confidence;
  const adjusted = Math.max(0, Math.min(99, Math.round(base * multiplier)));
  const lift = adjusted - base;
  return { ...action, base_confidence: base, confidence: adjusted, learned_lift: lift };
}

// ── Merge generated actions with persisted state ────────────────────
//
// Rules:
//   1. If the action id already exists in storage, keep the persisted
//      record (state + state_changed_at + meta) but refresh the
//      computed fields (priority, confidence, reasoning, title).
//   2. New action ids are inserted as QUEUED.
//   3. Persisted actions whose id no longer appears in the generated
//      set AND that are stale (>24h since state change, in QUEUED or
//      EXECUTED state) drop to ARCHIVED.
//
// This is what gives the surface its "live but persistent" behavior.
export function mergeAndPersist(generated) {
  const state = _load();
  const before = state.actions || {};
  const generatedById = {};
  generated.forEach(a => { generatedById[a.id] = a; });

  const next = {};

  // Pass 1 — keep / update persisted entries.
  for (const [id, prior] of Object.entries(before)) {
    if (generatedById[id]) {
      const fresh = generatedById[id];
      next[id] = {
        ...prior,
        // Refresh computed fields, preserve operator state.
        title:      fresh.title,
        reasoning:  fresh.reasoning,
        priority:   fresh.priority,
        urgency:    fresh.urgency,
        confidence: fresh.confidence,
        meta:       { ...prior.meta, ...fresh.meta },
        // proposed_operator can drift — keep operator as locked in if user
        // already moved past QUEUED.
        proposed_operator: ["QUEUED"].includes(prior.state) ? fresh.proposed_operator : (prior.proposed_operator || fresh.proposed_operator),
      };
    } else {
      // Action no longer generated. Stale-archive logic:
      const stateChangedHours = (Date.now() - new Date(prior.state_changed_at).getTime()) / 3_600_000;
      if (stateChangedHours > STALE_HOURS && (prior.state === "QUEUED" || prior.state === "EXECUTED")) {
        next[id] = {
          ...prior,
          state: ACTION_STATE.ARCHIVED,
          state_changed_at: new Date().toISOString(),
          meta: { ...prior.meta, auto_archived: true },
        };
      } else {
        next[id] = prior;
      }
    }
  }

  // Pass 2 — insert brand-new actions.
  for (const [id, fresh] of Object.entries(generatedById)) {
    if (!next[id]) next[id] = fresh;
  }

  // Cap total payload — drop oldest archived first if we're over.
  const ids = Object.keys(next);
  if (ids.length > CAP_ACTIONS) {
    const archivedSorted = ids
      .filter(id => next[id].state === "ARCHIVED")
      .sort((a, b) => new Date(next[a].state_changed_at) - new Date(next[b].state_changed_at));
    const overflow = ids.length - CAP_ACTIONS;
    archivedSorted.slice(0, overflow).forEach(id => { delete next[id]; });
  }

  state.actions = next;
  _save(state);
  return Object.values(next);
}

// ── Load / mutate ───────────────────────────────────────────────────

export function loadActions() {
  const state = _load();
  return Object.values(state.actions || {});
}

export function setActionState(actionId, newState, patch = {}) {
  if (!ACTION_STATE[newState]) return null;
  const state = _load();
  const action = state.actions?.[actionId];
  if (!action) return null;
  if (!STATE_TRANSITIONS[action.state]?.includes(newState) && action.state !== newState) {
    // Allow it anyway for ARCHIVED — explicit operator override.
    if (newState !== ACTION_STATE.ARCHIVED) return null;
  }
  const nowIso = new Date().toISOString();
  const updated = {
    ...action,
    ...patch,
    state: newState,
    state_changed_at: nowIso,
  };

  // Stamp deployed_at on the *first* DEPLOYED transition so the
  // learning layer has a stable anchor for time-to-response math.
  if (newState === ACTION_STATE.DEPLOYED && !updated.deployed_at) {
    updated.deployed_at = nowIso;
  }

  // Auto-derive outcomes from state. Voice / SMS / email workflows
  // imply contact when they reach DEPLOYED. EXECUTED implies the
  // action ran to completion. FAILED captures the negative outcome.
  // Explicit Mark Contacted / Mark Responded buttons in the surface
  // refine these for higher fidelity.
  const outcomes = updated.outcomes || _emptyOutcomes();
  const wf = updated.proposed_workflow;
  const contactingWorkflow = wf === "voice" || wf === "sms_email" || wf === "campaign";
  if (newState === ACTION_STATE.DEPLOYED && contactingWorkflow && !outcomes.contacted) {
    outcomes.contacted = true;
    outcomes.contactedAt = nowIso;
  }
  if (newState === ACTION_STATE.EXECUTED && !outcomes.contacted && contactingWorkflow) {
    outcomes.contacted = true;
    outcomes.contactedAt = updated.deployed_at || nowIso;
  }
  if (newState === ACTION_STATE.FAILED && !outcomes.failed) {
    outcomes.failed = true;
    outcomes.failedAt = nowIso;
  }
  updated.outcomes = outcomes;

  // Append transition to the audit trail so the trust layer can
  // surface the full path the action took (and the surface can show
  // "queued → assigned → executing" badges).
  if (!Array.isArray(updated.audit_log)) updated.audit_log = [];
  _ringPushAudit(updated.audit_log, {
    ts: nowIso,
    kind: "transition",
    from: action.state,
    to: newState,
  });

  state.actions[actionId] = updated;
  _save(state);
  return updated;
}

export function archiveAction(actionId) {
  return setActionState(actionId, ACTION_STATE.ARCHIVED);
}

/**
 * Upsert a single action into the persisted store WITHOUT running
 * the rule-engine merge / auto-archive sweep. Used by surfaces that
 * need to materialize a tracked action outside the normal generation
 * cycle (e.g. fire-flow direct execution).
 *
 * If the action id already exists, the prior fields are preserved
 * and the new fields shallow-overlaid on top. Caller is responsible
 * for stamping `created_at` / `state_changed_at` if it wants new
 * timestamps.
 */
export function persistAction(action) {
  if (!action || !action.id) return null;
  const state = _load();
  const prior = state.actions?.[action.id];
  state.actions[action.id] = prior ? { ...prior, ...action } : action;
  _save(state);
  return state.actions[action.id];
}

/**
 * Reassign an action's proposed operator. Logs the swap in the audit
 * trail so the trust layer can show "K. Byrne ← J. Garza" history.
 * The state machine is left alone — reassignment doesn't reset
 * progress, just swaps the human owner.
 */
export function reassignAction(actionId, newOperator) {
  if (!actionId || !newOperator?.name) return null;
  const state = _load();
  const action = state.actions?.[actionId];
  if (!action) return null;
  const prior = action.proposed_operator?.name || null;
  action.proposed_operator = { id: newOperator.id || newOperator.name, name: newOperator.name };
  if (!Array.isArray(action.audit_log)) action.audit_log = [];
  _ringPushAudit(action.audit_log, {
    ts: new Date().toISOString(),
    kind: "reassignment",
    from: prior, to: newOperator.name,
  });
  state.actions[actionId] = action;
  _save(state);
  return action;
}

// ── Aggregate metrics for the surface KPI strip ─────────────────────

export function aggregateOpsMetrics(actions) {
  const counts = {
    total: actions.length,
    queued: 0, deployed: 0, monitoring: 0, executed: 0,
    escalated: 0, failed: 0, archived: 0,
  };
  let surgeZones = 0;
  let activeWorkflows = 0;
  for (const a of actions) {
    counts[a.state.toLowerCase()] = (counts[a.state.toLowerCase()] || 0) + 1;
    if (a.kind === ACTION_KIND.ESCALATE_SURGE_ZONE && a.state !== "ARCHIVED") surgeZones += 1;
    if (a.state === "DEPLOYED" || a.state === "MONITORING") activeWorkflows += 1;
  }
  return { ...counts, surgeZones, activeWorkflows };
}

// ── Sort: live actions first, then by priority desc, then kind rank
export function sortActionsForQueue(actions) {
  const stateRank = {
    DEPLOYED: 0, MONITORING: 1, ESCALATED: 2, QUEUED: 3, FAILED: 4, EXECUTED: 5, ARCHIVED: 6,
  };
  return [...actions].sort((a, b) => {
    const sa = stateRank[a.state] ?? 9;
    const sb = stateRank[b.state] ?? 9;
    if (sa !== sb) return sa - sb;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return (ACTION_KIND_RANK[a.kind] ?? 99) - (ACTION_KIND_RANK[b.kind] ?? 99);
  });
}

// ── UI metadata helpers ─────────────────────────────────────────────

export const KIND_META = {
  ESCALATE_SURGE_ZONE:      { label: "Surge Zone",          color: "#E05050", icon: "▲" },
  RECOMMEND_STAFFING:       { label: "Staffing",            color: "#FF6D00", icon: "★" },
  ASSIGN_OPERATOR:          { label: "Assign Operator",     color: "#3B82F6", icon: "→" },
  TRIGGER_VOICE_WORKFLOW:   { label: "Voice Workflow",      color: "#A855F7", icon: "📞" },
  AUTO_CREATE_CAMPAIGN:     { label: "Auto Campaign",       color: "#D4A853", icon: "◆" },
  SCHEDULE_SMS_EMAIL:       { label: "SMS / Email",         color: "#00E6A8", icon: "✦" },
  PRIORITIZE_ROUTING:       { label: "Priority Route",      color: "#C9A84C", icon: "▸" },
  CREATE_OUTREACH_QUEUE:    { label: "Outreach Queue",      color: "#3B82F6", icon: "≡" },
  UNCONTACTED_FIRE_LEADS:   { label: "First Contact · Fire",color: "#FF6D00", icon: "🔥" },
  STALE_OUTREACH_FOLLOWUP:  { label: "Stale Outreach",      color: "#D4A853", icon: "⏱" },
  INACTIVE_SIGNED_CLAIM:    { label: "Signed Claim F/U",    color: "#A855F7", icon: "📝" },
};

export const STATE_META = {
  QUEUED:     { color: "#C9A84C", pulse: false, label: "Queued" },
  DEPLOYED:   { color: "#FF6D00", pulse: true,  label: "Deployed" },
  MONITORING: { color: "#00E6A8", pulse: true,  label: "Monitoring" },
  EXECUTED:   { color: "#A855F7", pulse: false, label: "Executed" },
  ESCALATED:  { color: "#E05050", pulse: true,  label: "Escalated" },
  FAILED:     { color: "#E05050", pulse: false, label: "Failed" },
  ARCHIVED:   { color: "rgba(255,255,255,0.40)", pulse: false, label: "Archived" },
};

export const URGENCY_COLOR = {
  critical: "#E05050",
  high:     "#FF6D00",
  medium:   "#C9A84C",
  low:      "rgba(255,255,255,0.55)",
};

// ── Diagnostics ─────────────────────────────────────────────────────

export function _resetActionState() {
  if (typeof localStorage !== "undefined") {
    try { localStorage.removeItem(KEY); } catch { /* noop */ }
  }
}
