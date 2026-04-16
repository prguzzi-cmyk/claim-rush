/**
 * Unified outreach + follow-up engine for RIN / ClaimRush.
 *
 * SINGLE SOURCE OF TRUTH — manual button and auto-pipeline both use
 * launchOutreach(). Follow-up cadence runs on top via advanceFollowUp().
 *
 * State fields on a lead:
 *   lead.outreach              = { sms, email, voice } | null
 *   lead.status                = "New" | "In Follow-Up" | "Contacted" | "Converted"
 *   lead.followUp              = { startedAt, currentStep, paused, stopped, log, nextAt }
 *   lead.outreach_started_at   = ISO timestamp
 *   lead.sms_sent_count        = number
 *   lead.email_sent_count      = number
 *   lead.voice_sent_count      = number
 *   lead.last_outreach_at      = ISO timestamp
 */

// ── Global toggle ────────────────────────────────────────
let AUTO_OUTREACH_ENABLED = true;
export function setAutoOutreach(enabled) { AUTO_OUTREACH_ENABLED = !!enabled; }
export function getAutoOutreach() { return AUTO_OUTREACH_ENABLED; }

// ── Quiet hours ──────────────────────────────────────────
const QUIET_START = 20;
const QUIET_END = 8;
const outreachQueue = [];
let queueTimerStarted = false;

function isQuietHours() {
  const hour = new Date().getHours();
  return hour >= QUIET_START || hour < QUIET_END;
}

function startQueueFlushTimer() {
  if (queueTimerStarted) return;
  queueTimerStarted = true;
  setInterval(() => {
    if (!isQuietHours() && outreachQueue.length > 0) {
      console.log(`[OUTREACH] Flushing ${outreachQueue.length} queued items`);
      while (outreachQueue.length > 0) outreachQueue.shift().fn();
    }
  }, 5 * 60 * 1000);
  console.log('[OUTREACH] Queue flush timer started');
}

// ── Follow-up cadence ────────────────────────────────────
const DAY = 86400000;
const FOLLOWUP_CADENCE = [
  { step: 0, delay: 0,       label: 'Initial outreach',   channels: { sms: true, email: true, voice: false } },
  { step: 1, delay: 1 * DAY, label: 'Day 1 follow-up',    channels: { sms: true, email: true, voice: false } },
  { step: 2, delay: 3 * DAY, label: 'Day 3 follow-up',    channels: { sms: true, email: true, voice: false } },
  { step: 3, delay: 5 * DAY, label: 'Day 5 final follow-up', channels: { sms: true, email: true, voice: false } },
];

// ── Send helpers (respect quiet hours for SMS/voice) ─────
function sendChannels(lead, channels, deps) {
  const now = new Date().toISOString();

  if (channels.email && (lead.phone || lead.email)) {
    console.log(`[FOLLOWUP] EMAIL: sending`);
    if (deps?.sendEmail) deps.sendEmail(lead);
    lead.email_sent_count = (lead.email_sent_count || 0) + 1;
  }

  if (channels.sms && lead.phone) {
    if (isQuietHours()) {
      console.log(`[FOLLOWUP] SMS: queued (quiet hours)`);
      outreachQueue.push({ type: 'sms', lead_id: lead.id, phone: lead.phone, fn: () => {
        console.log(`[FOLLOWUP] SMS: sending queued to ${lead.phone}`);
        lead.sms_sent_count = (lead.sms_sent_count || 0) + 1;
        lead.last_outreach_at = new Date().toISOString();
      }});
      startQueueFlushTimer();
    } else {
      console.log(`[FOLLOWUP] SMS: sending to ${lead.phone}`);
      lead.sms_sent_count = (lead.sms_sent_count || 0) + 1;
    }
  }

  if (channels.voice && lead.phone) {
    if (isQuietHours()) {
      console.log(`[FOLLOWUP] VOICE: queued (quiet hours)`);
      outreachQueue.push({ type: 'voice', lead_id: lead.id, phone: lead.phone, fn: () => {
        console.log(`[FOLLOWUP] VOICE: calling queued ${lead.phone}`);
        lead.voice_sent_count = (lead.voice_sent_count || 0) + 1;
        lead.last_outreach_at = new Date().toISOString();
      }});
      startQueueFlushTimer();
    } else {
      console.log(`[FOLLOWUP] VOICE: calling ${lead.phone}`);
      lead.voice_sent_count = (lead.voice_sent_count || 0) + 1;
    }
  }

  lead.last_outreach_at = now;
}

// ── Core launch (step 0) ─────────────────────────────────
export function launchOutreach(lead, channels = { sms: true, email: true, voice: false }, deps = {}) {
  if (!lead) return false;

  if (lead.outreach && lead.status === 'In Follow-Up') {
    console.log(`[OUTREACH] Skipped — already In Follow-Up: ${lead.id}`);
    return false;
  }

  const now = Date.now();
  lead.outreach = channels;
  lead.status = lead.converted ? lead.status : 'In Follow-Up';
  lead.outreach_started_at = new Date(now).toISOString();
  lead.sms_sent_count = lead.sms_sent_count || 0;
  lead.email_sent_count = lead.email_sent_count || 0;
  lead.voice_sent_count = lead.voice_sent_count || 0;

  const nextStep = FOLLOWUP_CADENCE[1];
  lead.followUp = {
    startedAt: now,
    currentStep: 0,
    paused: false,
    stopped: false,
    nextAt: nextStep ? new Date(now + nextStep.delay).toISOString() : null,
    log: [{ step: 0, label: FOLLOWUP_CADENCE[0].label, sentAt: now }],
  };

  console.log(`[OUTREACH] Launched for lead ${lead.id} (${lead.address || '?'})`);
  sendChannels(lead, channels, deps);

  if (lead.followUp.nextAt) {
    console.log(`[FOLLOWUP] Next: step 1 at ${lead.followUp.nextAt}`);
  }

  return true;
}

// ── Advance follow-up (steps 1–3) ───────────────────────
/**
 * Check if a lead is due for its next follow-up step and execute it.
 * Call this periodically (e.g. every 5 min) for all active leads.
 * Returns true if a step was executed.
 */
export function advanceFollowUp(lead, deps = {}) {
  if (!lead?.followUp) return false;
  const fu = lead.followUp;

  // Skip if paused, stopped, or converted
  if (fu.paused) { return false; }
  if (fu.stopped) { return false; }
  if (lead.converted || lead.status === 'Converted') {
    console.log(`[FOLLOWUP] Skipped — converted: ${lead.id}`);
    return false;
  }

  const nextStepIndex = fu.currentStep + 1;
  const cadenceEntry = FOLLOWUP_CADENCE[nextStepIndex];

  // No more steps — mark complete
  if (!cadenceEntry) {
    if (lead.status === 'In Follow-Up') {
      lead.status = 'Contacted';
      fu.stopped = true;
      console.log(`[FOLLOWUP] Cadence complete for ${lead.id} — marked Contacted`);
    }
    return false;
  }

  // Check if it's time
  const dueAt = fu.startedAt + cadenceEntry.delay;
  if (Date.now() < dueAt) return false;

  // Check if already sent this step
  if (fu.log.some(e => e.step === nextStepIndex)) {
    console.log(`[FOLLOWUP] Step ${nextStepIndex} already sent for ${lead.id}`);
    return false;
  }

  // Execute step
  console.log(`[FOLLOWUP] Executing step ${nextStepIndex} (${cadenceEntry.label}) for ${lead.id}`);
  sendChannels(lead, cadenceEntry.channels, deps);

  fu.currentStep = nextStepIndex;
  fu.log.push({ step: nextStepIndex, label: cadenceEntry.label, sentAt: Date.now() });

  // Schedule next
  const nextNext = FOLLOWUP_CADENCE[nextStepIndex + 1];
  fu.nextAt = nextNext ? new Date(fu.startedAt + nextNext.delay).toISOString() : null;

  if (fu.nextAt) {
    console.log(`[FOLLOWUP] Next: step ${nextStepIndex + 1} at ${fu.nextAt}`);
  } else {
    lead.status = 'Contacted';
    fu.stopped = true;
    console.log(`[FOLLOWUP] Cadence complete for ${lead.id} — marked Contacted`);
  }

  return true;
}

// ── Manual controls ──────────────────────────────────────
export function pauseFollowUp(lead) {
  if (!lead?.followUp) return;
  lead.followUp.paused = true;
  console.log(`[FOLLOWUP] Paused: ${lead.id}`);
}

export function resumeFollowUp(lead) {
  if (!lead?.followUp) return;
  lead.followUp.paused = false;
  console.log(`[FOLLOWUP] Resumed: ${lead.id}`);
}

export function stopFollowUp(lead) {
  if (!lead?.followUp) return;
  lead.followUp.stopped = true;
  lead.followUp.nextAt = null;
  console.log(`[FOLLOWUP] Stopped: ${lead.id}`);
}

// ── Auto-trigger wrapper ─────────────────────────────────
export function triggerOutreach(lead, deps = {}) {
  if (!AUTO_OUTREACH_ENABLED) {
    console.log(`[OUTREACH] Skipped — global disabled`);
    return;
  }
  if (deps.agent?.auto_outreach === false) {
    console.log(`[OUTREACH] Skipped — auto disabled (agent)`);
    return;
  }
  launchOutreach(lead, { sms: true, email: true, voice: false }, deps);
}

// ── Tick — call periodically to advance all leads ────────
/**
 * Process follow-ups for an array of leads.
 * Call this on a timer (e.g. every 5 min).
 */
export function tickFollowUps(leads, deps = {}) {
  let advanced = 0;
  for (const lead of leads) {
    if (advanceFollowUp(lead, deps)) advanced++;
  }
  if (advanced > 0) {
    console.log(`[FOLLOWUP] Tick: ${advanced} lead(s) advanced`);
  }
  return advanced;
}

export { FOLLOWUP_CADENCE, outreachQueue, isQuietHours };
