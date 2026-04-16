import { useState, useRef, useEffect } from "react";
import { C } from "./theme";
import { useAxisContext } from "./AxisContext";

const mono = { fontFamily: "'Courier New', monospace" };
const PURPLE = "#A855F7";
const PURPLE_DIM = "#7C3AED";
const INNER_GOLD = "#D4A853";
const INNER_GOLD_DIM = "#B8922F";

// ── AXIS RESPONSE ENGINE (mock) ──────────────────────────────────────────────

const COACH_RESPONSES = {
  "not_interested": {
    match: ["not interested", "no thanks", "don't need", "don't want", "pass"],
    response: `**STATE:**\nThey're reacting to what they think you're selling. Not to you. Not to the value. Stay steady.\n\n**STRATEGY:**\nReframe in 10 seconds. Make inaction more expensive than action. Then go silent.\n\n**SCRIPT:**\n*"I hear you. Most homeowners say the same thing — until they find out their claim was underpaid by $12,000. I'm not selling anything. I'm telling you there's money on the table. Five minutes to find out. If I'm wrong, I'll tell you first."*\n\n**STANDARD:**\nYou're not asking for permission. You're offering clarity. That's the frame — stay in it.`,
  },
  "call_later": {
    match: ["call me later", "call back", "not a good time", "busy right now", "maybe later", "let me think"],
    response: `**STATE:**\nThis is a stall, not a rejection. Don't treat it like one. Stay in control of the timeline.\n\n**STRATEGY:**\nPin the callback to a specific time. Open-ended callbacks die. Two-choice close on the calendar.\n\n**SCRIPT:**\n*"Absolutely — would later today at 4 work, or is tomorrow morning better? I want to make sure we connect before the filing window starts to close."*\n\n**STANDARD:**\nThe agent who locks the time wins. The agent who says "sure, whenever" never talks to them again.`,
  },
  "just_looking": {
    match: ["just looking", "just browsing", "thinking about it", "researching", "shopping around"],
    response: `**STATE:**\nThey're already in motion. They wouldn't be talking to you otherwise. This is not resistance — it's an opening.\n\n**STRATEGY:**\nValidate, then redirect. Don't fight the frame — upgrade it with a stat.\n\n**SCRIPT:**\n*"Smart — you should be looking into this. Quick question: is anyone reviewing your claim against what your policy actually covers? Because 73% of claims in your area get underpaid on the first offer. I can tell you where you stand in 5 minutes."*\n\n**STANDARD:**\nPeople who are "just looking" are the easiest to close. They've already started the process. Your job is to finish it.`,
  },
  "already_have": {
    match: ["already have someone", "already working with", "have a guy", "got someone", "already handled", "have an adjuster"],
    response: `**STATE:**\nThis is the strongest objection and the biggest opportunity. Their current person is probably leaving money on the table.\n\n**STRATEGY:**\nDon't compete. Position as a second set of eyes. Non-threatening, impossible to refuse.\n\n**SCRIPT:**\n*"Good — you're taking this seriously. Has your person done a line-by-line policy review against the damage report? That's where we find $5,000 to $20,000 that gets missed. I'm not replacing anyone — just a second set of eyes. Ten minutes."*\n\n**STANDARD:**\nYou don't fight for the seat. You pull up a bigger table.`,
  },
  "insurance_handle": {
    match: ["insurance will handle", "insurance covers", "adjuster", "insurance company", "already filed", "claim is filed"],
    response: `**STATE:**\nThey believe the system works for them. It doesn't. One fact changes this entire conversation.\n\n**STRATEGY:**\nEducate, don't argue. Drop the truth bomb and let it land.\n\n**SCRIPT:**\n*"Glad you filed — that's step one. Here's what most people don't know: the adjuster works for the insurance company, not for you. Their job is to close your claim for as little as possible. Average underpayment is 30 to 40 percent. I make sure their number matches what you're actually owed. Five minutes."*\n\n**STANDARD:**\nYou have information they don't. That's not a pitch — that's a public service.`,
  },
  "objection": {
    match: ["objection", "pushback", "too expensive", "no budget", "can't afford"],
    response: `**STATE:**\nEvery objection is a buying signal wrapped in uncertainty. Don't retreat. Unwrap it.\n\n**STRATEGY:**\nGet specific. Vague objections get vague responses. Pin it down, then reframe with math.\n\n**SCRIPT:**\n*"The damage already happened. The claim is in play. The question is whether you recover what you're owed or the insurance company keeps it. Members recover $12,000 more on average. The plan is $19 a month. What's holding you back specifically?"*\n\n**STANDARD:**\nYou're not convincing anyone. You're removing the one thing between them and a decision they already want to make.`,
  },
  "close": {
    match: ["close", "closing", "seal the deal", "get them to sign", "commit", "final push"],
    response: `**STATE:**\nStop trying to close. If you're "trying," you already lost the frame. The close is a natural next step.\n\n**STRATEGY:**\nAssume the enrollment. Move past the decision. Ask for logistics, not permission.\n\n**SCRIPT:**\n*"Here's what happens next — I'm setting up your enrollment now, we'll assign your claim reviewer, and you'll have policy guidance within 24 hours. What email should I send the confirmation to?"*\n\n**STANDARD:**\nClosing isn't something you do to someone. It's something you do for someone. Believe that and your tone changes.`,
  },
  "fire": {
    match: ["fire", "wildfire", "burn", "smoke", "ash"],
    response: `**STATE:**\nFire leads are in crisis. They need command, not a pitch. You have a 48-hour window. Move.\n\n**STRATEGY:**\nReference the specific damage zone. Sound like you've done this 500 times. Two-choice close on the calendar.\n\n**SCRIPT:**\n*"Your property was flagged in the fire zone. Insurance adjusters are already out and their first offers run 30 to 40 percent low. I'm calling to make sure that doesn't happen to you. Five minutes — now or later today?"*\n\n**STANDARD:**\nFire leads close fast or go cold. Speed is the strategy. You're the expert in the room — act like it.`,
  },
  "storm": {
    match: ["storm", "hail", "wind", "hurricane", "flood", "water damage"],
    response: `**STATE:**\nStorm leads respond to specificity. Generic calls get ignored. Specific calls get callbacks.\n\n**STRATEGY:**\nName the storm, the area, and the damage pattern. Prove you're informed, not cold-calling.\n\n**SCRIPT:**\n*"The storm that hit your area caused a damage pattern we've seen hundreds of times — and insurance companies consistently underpay on this. I'm calling because your property fits the profile. Can we do a 10-minute review?"*\n\n**STANDARD:**\nBe the first expert they talk to, not the fifth. The agent who owns the urgency owns the deal.`,
  },
  "landlord": {
    match: ["landlord", "rental", "tenant", "units", "property manager", "multi-unit"],
    response: `**STATE:**\nLandlords think in numbers. Emotion won't work. Lead with ROI and let them do the math.\n\n**STRATEGY:**\nFrame it as a portfolio problem. Embed the close inside the question.\n\n**SCRIPT:**\n*"Each undocumented claim across your units is $3,000 to $10,000 you'll never recover. LandlordShield handles documentation, filing, and recovery. $49 per unit — one claim pays for the year. How many units are we setting up?"*\n\n**STANDARD:**\nLandlords respect operators. Be the operator who makes them money. That's the entire pitch.`,
  },
  "commercial": {
    match: ["business", "commercial", "interruption", "co-insurance", "enterprise"],
    response: `**STATE:**\nBusiness owners have been pitched a thousand times. Don't pitch. Diagnose.\n\n**STRATEGY:**\nAsk about their current claim status. That one question separates you from every other call.\n\n**SCRIPT:**\n*"Business interruption claims are where owners lose the most — 80% don't realize it until the offer comes in 40% low. What's your current claim status? Filed? Pending? Still documenting?"*\n\n**STANDARD:**\nYou're not selling protection. You're preventing a six-figure mistake. Say it like you mean it.`,
  },
  "motivation": {
    match: ["motivation", "confidence", "struggling", "tough day", "not closing", "losing deals", "frustrated", "slump"],
    response: `**STATE:**\nYou don't need motivation. You need your next rep. One deal changes the entire day.\n\n**STRATEGY:**\nPick the highest-confidence lead on the board. Open the script. Dial. Deliver the first two lines exactly as written.\n\n**SCRIPT:**\n*Read your opening line out loud right now. Don't think about outcome — think about execution. The reps build the results.*\n\n**STANDARD:**\nEvery person you're calling has real damage and a real problem. You're not interrupting — you're the only one calling who can actually help.`,
  },
  "script": {
    match: ["script", "what do i say", "how to start", "opening line", "intro", "first call"],
    response: `**STATE:**\nYour opening line is your first close. The frame you set in 10 seconds determines the next 10 minutes.\n\n**STRATEGY:**\nName their address, name the damage, state your value. Under 15 seconds. No preamble.\n\n**SCRIPT:**\n*"Hi [Name], this is [Your Name]. I'm calling about the damage report at [address] — your property was flagged for [damage type] and I help owners in [state] make sure their claims don't get underpaid. Takes 5 minutes. Are you available right now?"*\n\n**STANDARD:**\nThe opening line is not a request. It's a statement of intent followed by a micro-commitment. You set the tone. They follow it.`,
  },
  "follow-up": {
    match: ["follow up", "follow-up", "no response", "ghosted", "didn't answer", "callback", "voicemail"],
    response: `**STATE:**\n80% of deals close between the 3rd and 7th contact. Most agents quit after one. That's your edge.\n\n**STRATEGY:**\nDay 1: Call + SMS. Day 3: Email with damage reference. Day 5: Call, different time. Day 7: Final SMS with deadline frame.\n\n**SCRIPT:**\n*"[Name] — following up on the damage at [address]. We've been helping others in your area file before the documentation window closes. After this week I can't guarantee review availability. Are you free tomorrow?"*\n\n**STANDARD:**\nEvery follow-up adds new information. Don't repeat the pitch — give them a reason to respond this time.`,
  },
  "pricing": {
    match: ["price", "pricing", "cost", "expensive", "worth it", "afford", "money"],
    response: `**STATE:**\nThey brought up price. That means they see value — they just need the math to justify it.\n\n**STRATEGY:**\nNever defend the price. Reframe it against the cost of not having it. Let the numbers close.\n\n**SCRIPT:**\n*"The plan is $19 a month. The average underpayment without it is $12,000. You tell me which number matters more."*\n\n**STANDARD:**\nYou're not asking them to spend money. You're showing them how to stop losing it.`,
  },
};

const HELP_RESPONSES = {
  // ── FIRST DEAL FLOW ────────────────────────────────────────────────────
  "deal_flow": {
    match: ["deal flow", "first deal", "close a deal", "how to close", "close my first", "guided", "workflow", "step by step"],
    response: `**First Deal Flow — 5-step guided close:**\n\n1. **Click any lead name** on Fire Leads to open the Deal Flow panel\n2. **Step 1 — Review Script:** Read the AI-generated sales script personalized for the lead's damage, address, and program match\n3. **Step 2 — Start Outreach:** Hit "SEND NOW" to fire SMS + Email simultaneously. This also starts the automated follow-up sequence\n4. **Step 3 — Client Response:** Mark YES if the client responded. The system shows live follow-up progress while you wait\n5. **Step 4 — Send Agreement:** Send UPASign enrollment agreement to the client's email\n6. **Step 5 — Converted:** Mark the lead as converted. Follow-ups auto-cancel\n\n**Tip:** You don't need to complete all steps in one session. The follow-up system works while you move to other leads.`,
  },
  "deal_flow_script": {
    match: ["script", "what do i say", "sales script", "opening line", "call script", "how to start the call"],
    response: `**AI Sales Script (Deal Flow Step 1):**\n\nThe script is auto-generated from the lead's data:\n- Their **name, address, and damage type**\n- The **recommended program** (We The People, LandlordShield, or Business Shield)\n- **Key talking points** with confidence score\n\n**How to use it:**\n1. Click the lead name to open Deal Flow\n2. Read the script — it's your opening pitch\n3. Note the Key Points section for objection handling\n4. When ready, click "READY → START OUTREACH"\n\n**Tip:** Don't read it word-for-word. Use it as structure. Your voice + their specific situation = the close.`,
  },

  // ── OUTREACH + FOLLOW-UP ───────────��───────────────────────────────────
  "outreach": {
    match: ["outreach", "sms", "email", "send message", "contact", "reach out", "start outreach"],
    response: `**Outreach System — two ways to launch:**\n\n**Via Deal Flow (recommended):**\n1. Click lead name → Step 2 → "SEND NOW"\n2. Sends SMS + Email instantly\n3. Auto-starts follow-up sequence\n\n**Via Outreach Modal:**\n1. Click "START AI OUTREACH" on any lead card\n2. Toggle channels: SMS, Email, AI Voice Call\n3. Edit messages if needed\n4. Click "START OUTREACH"\n\nBoth methods trigger the same automated follow-up. The lead status changes to **"In Follow-Up"** and the system takes over.`,
  },
  "follow_up": {
    match: ["follow up", "follow-up", "automated", "sequence", "day 1", "day 3", "day 5", "auto", "automatic"],
    response: `**Automated Follow-Up Sequence:**\n\nTriggered automatically when outreach is sent:\n\n- **Day 0:** Initial SMS + Call attempt\n- **Day 1:** Follow-up SMS\n- **Day 3:** Second follow-up SMS\n- **Day 5:** Final follow-up SMS\n\n**Controls (on the lead card):**\n- **PAUSE** — Freezes the timer, resumes where it left off\n- **STOP** — Cancels the sequence, reverts status\n\n**Auto-cancels when:**\n- Lead is marked "Converted"\n- Lead is enrolled via Protection Plans\n\n**Visible in:** Purple progress bar on the lead card showing D0/D1/D3/D5 + current step + next step timing.\n\n**Tip:** The system works while you sleep. Focus on leads that respond — let automation handle the rest.`,
  },
  "pause_stop": {
    match: ["pause", "stop", "cancel", "halt", "disable", "turn off"],
    response: `**Pause or Stop Follow-Up:**\n\nOn any lead card with active follow-up, you'll see two buttons:\n\n- **PAUSE** — Freezes the sequence timer. The lead shows "FOLLOW-UP PAUSED" in gold. Click "RESUME" to continue from where it stopped.\n- **STOP** — Cancels the entire sequence. Lead reverts to "Outreach Active" status. Cannot be resumed — you'd need to launch outreach again.\n\n**When to pause:** Client asked you to call back at a specific time.\n**When to stop:** Client explicitly said no, or you're handling them manually.`,
  },

  // ── AGREEMENT / CONVERSION ─────────────────────────────────────────────
  "agreement": {
    match: ["agreement", "upasign", "sign", "signature", "contract", "send agreement", "enrollment agreement", "pending"],
    response: `**UPASign Agreement System:**\n\n**Sending:**\n1. Client responds YES in Deal Flow Step 3\n2. Click **"REVIEW & SEND AGREEMENT"** → Agreement Modal opens\n3. Review recipient, program, property details\n4. Click **"SEND AGREEMENT"** → status becomes "Agreement Sent"\n\n**AXIS tracks all pending agreements automatically:**\n- The AXIS Live panel shows **"X AGREEMENTS PENDING"** with urgency levels\n- Click to expand → see each lead, time waiting, and urgency\n- **One-click actions:** SMS reminder, Email reminder, AI Call, Resend agreement\n\n**Urgency escalation:**\n- Recently sent → PENDING (purple) — monitor\n- 24h+ unsigned → FOLLOW UP (gold) — send reminder SMS\n- 48h+ unsigned → URGENT (red) — trigger AI call\n\n**Auto-conversion:** When signed, lead auto-converts + all follow-ups stop.\n\n**Controls in Agreement Modal:** Resend, Cancel, View status.\n\n**Tip:** Send the agreement while on the phone. Then let AXIS handle the follow-up.`,
  },
  "convert": {
    match: ["convert", "enroll", "enrollment", "close", "mark converted", "sign up", "new member"],
    response: `**Converting a Lead — two paths:**\n\n**Path 1: Deal Flow (recommended)**\n1. Click lead name → go through all 5 steps\n2. At Step 5, click "MARK AS CONVERTED"\n3. Lead status → Converted, follow-ups auto-cancel\n\n**Path 2: Direct enrollment**\n1. Click "CONVERT TO PROTECTION PLAN" on any lead card\n2. Enrollment drawer opens with pre-filled data\n3. Select tier + agent → "COMPLETE ENROLLMENT"\n4. Lead tagged Converted, appears in Protection Plans table\n\n**Both paths:** Cancel active follow-ups, update KPI metrics, sync AXIS context.`,
  },

  // ── LEAD STATUSES ──────────────���───────────────────────���───────────────
  "status": {
    match: ["status", "statuses", "lead status", "what does", "new", "contacted", "qualified", "converted", "outreach active"],
    response: `**Lead Statuses:**\n\n- **New** (blue) — Just imported, no action taken\n- **Contacted** (gold) — Agent has reached out but no outreach system active\n- **Qualified** (green) — High-confidence lead, ready for conversion\n- **In Follow-Up** (purple) — Automated follow-up sequence running\n- **Outreach Active** (purple) — Outreach sent, follow-up stopped or complete\n- **Converted** (green) — Enrolled in a protection plan\n\n**Status auto-updates when:** Outreach is launched, follow-up starts/stops, or lead is converted.\n\n**Next best action by status:**\n- New → Open Deal Flow, review script\n- Contacted → Launch outreach\n- Qualified → Convert directly or Deal Flow\n- In Follow-Up → Wait for response, check progress\n- Converted → Done — appears in Protection Plans`,
  },

  // ── DASHBOARD + METRICS ────────────��───────────────────────────────────
  "metrics": {
    match: ["metrics", "kpi", "numbers", "dashboard", "stats", "performance", "how am i doing"],
    response: `**KPI Metrics (Fire Leads top bar):**\n\n- **Total Leads** — All leads in your pipeline\n- **New This Week** — Leads imported in last 7 days\n- **Qualified** — High-confidence leads (94%+ match)\n- **In Follow-Up** — Leads with active (non-paused) follow-up sequences\n- **Converted** — Successfully enrolled members\n\n**Protection Plans metrics:**\n- Active Members / New This Month / MRR / Agent Commissions\n\n**What to watch:** If "In Follow-Up" is high but "Converted" is low, check your Step 3 responses. If "Qualified" is high, those leads are ready — open Deal Flow.`,
  },

  // ── AI RECOMMENDATION ───────���──────────────────────────────────────────
  "recommendation": {
    match: ["recommendation", "ai recommendation", "confidence", "match", "program match", "why this program"],
    response: `**AI Recommendation Engine:**\n\nEvery lead card shows an AI recommendation block with:\n\n- **Program:** Auto-matched from lead type (Homeowner → We The People, Landlord → LandlordShield, Business → Business Shield)\n- **Confidence %:** Calculated from lead status + damage type\n  - Qualified: 94% base\n  - Contacted: 87% base\n  - New: 81% base\n  - +3% for multi-unit or business interruption\n  - +2% for roof or flood damage\n  - Cap: 98%\n- **Reason:** Specific explanation why this lead matches\n\n**Use it:** Reference the confidence % and reason in your pitch. "Based on your damage profile, you're a 94% match for our coverage."`,
  },

  // ── PRE-CALL LOCK-IN ──────────��─────────────────────────��──────────────
  "precall": {
    match: ["pre-call", "precall", "lock-in", "before calling", "prepare for call", "elite frame"],
    response: `**Pre-Call Lock-In:**\n\nA coaching modal that prepares you before dialing:\n\n1. Click **"PRE-CALL LOCK-IN"** on any lead card\n2. Shows: Lead snapshot (name, damage, address, program, confidence)\n3. **Identity affirmation** — centering statement\n4. **Elite Frame** — Script + State + Strategy + Standard\n5. **Opening Line** — Copy-ready first words (with COPY button)\n6. **Quick Triggers** — Switch frames: Objection, Control, Confidence, Close, Distrust, Voicemail, Pricing\n7. **START CALL** — Marks lead as pre-call used\n\n**When to use it:** Before every call. Especially on high-confidence leads. The 60 seconds you spend here changes the next 10 minutes.`,
  },

  // ── PROTECTION PLANS ───────────���───────────────────────────────────────
  "plans": {
    match: ["protection plan", "program", "tier", "pricing", "we the people", "landlordshield", "business shield", "plans"],
    response: `**Three Protection Plans:**\n\n**We The People** (Homeowners) — $19–$99/mo\n- Standard ($19) / Gold ($49) / Platinum ($99)\n- Policy guidance via LEX AI, claim review, contractor fraud protection\n\n**LandlordShield** (Landlords) — $49–$249/mo per unit\n- Standard ($49) / Pro ($149) / Enterprise ($249)\n- Inspections, tenant damage claims, lost rent recovery\n\n**Business Shield** (Commercial) — $79–$399/mo\n- Standard ($79) / Pro ($199) / Enterprise ($399)\n- Cash-out policy review, BI claims, co-insurance protection\n\n**Auto-match:** Programs match to lead type. Override manually in enrollment drawer.\n**Enroll from:** Protection Plans page → "ENROLL MEMBER" on any card, or Fire Leads → "CONVERT TO PROTECTION PLAN"`,
  },

  // ── NAVIGATION ───���─────────────────────────────────────────────────────
  "navigate": {
    match: ["navigate", "where", "find", "how do i", "page", "sidebar", "portal"],
    response: `**Portal Navigation:**\n\n- **Dashboard** — Overview (coming soon)\n- **Fire Leads** — Your main workspace: leads, AI scripts, outreach, Deal Flow, follow-up tracking\n- **Storm Intel** — Storm tracking and lead sourcing (coming soon)\n- **Protection Plans** — View programs, enroll members, track MRR and commissions\n\n**Quick access:**\n- Sidebar left → switch pages\n- Click any lead name → opens Deal Flow panel\n- AXIS button (bottom-right) → Coach / Inner Game / Help\n\n**Fire Leads is where you work.** Start there.`,
  },

  // ── WHAT SHOULD I DO NEXT ────────────��─────────────────────────────────
  "next_action": {
    match: ["what should i do", "next", "what now", "where to start", "first thing", "getting started", "begin", "stuck"],
    response: "__DYNAMIC_NEXT_ACTION__",
  },

  // ── SKIPPED STEP WARNING ─────────────���─────────────────────────────────
  "skip": {
    match: ["skip", "skipped", "jump ahead", "can i skip", "shortcut"],
    response: `**Don't skip steps.**\n\nThe Deal Flow is sequenced for a reason:\n\n- **Skip the script?** You go in cold. Leads hear hesitation and hang up.\n- **Skip outreach?** No touchpoint = no follow-up engine. The system can't help you.\n- **Skip the agreement?** Verbal "yes" without a signature isn't a close.\n- **Skip to convert?** You can — via "CONVERT TO PROTECTION PLAN" button — but you miss the automated follow-up safety net.\n\n**The system is designed to catch deals you'd otherwise lose.** Every step adds a layer of automation. The agents who follow the flow close more.`,
  },

  // ── INCOMPLETE WORKFLOW ───────────��────────────────────────────────────
  "incomplete": {
    match: ["incomplete", "unfinished", "forgot", "left open", "didn't finish", "pending", "reminder"],
    response: `**Check for incomplete workflows:**\n\n1. **Leads with outreach but no follow-up?** Shouldn't happen — follow-up auto-starts. If you stopped it manually, consider re-launching outreach.\n2. **Leads "In Follow-Up" for 5+ days?** The sequence is complete. Open Deal Flow → Step 3 → mark response.\n3. **Client said YES but not converted?** Open Deal Flow → Step 4 → send agreement → Step 5 → mark converted.\n4. **Deal Flow panel still open?** Close it with ✕ and pick the next lead.\n\n**Rule:** Never leave a qualified lead without outreach. The follow-up system only works if you start it.`,
  },

  // ── AXIS MODES ─────────────────────────────────────────────────────────
  "axis_modes": {
    match: ["axis", "coach", "inner game", "modes", "what can axis do", "help mode"],
    response: `**AXIS has 3 modes:**\n\n**Coach Mode** — Sales technique and objection handling\n- Give it an objection ("not interested", "too expensive") and get exact scripts\n- Covers: fire leads, storm leads, landlord, commercial, closing, follow-up, pricing\n\n**Inner Game Mode** — Mindset and presence\n- Pre-call centering, confidence, rejection recovery, burnout, fear, detachment\n- Slower, more deliberate responses\n\n**Help Mode** (you're here) — Platform operator guidance\n- Every screen, button, and workflow explained\n- Next-best-action recommendations\n- Workflow completion checks\n\n**Switch modes** using the COACH | INNER | HELP toggle at the top.`,
  },
};

// ── INNER GAME RESPONSES ─────────────────────────────────────────────────────

const INNER_GAME_RESPONSES = {
  "rejection": {
    match: ["rejection", "rejected", "they said no", "got a no", "turned down", "hung up", "rude"],
    response: `**STATE:**\nA "no" just passed through you. Notice it. It landed on the surface — it doesn't belong inside.\n\n**STRATEGY:**\nOne breath. Release the call. It's information, not evidence against you. The agent who is grounded hears "no" as data. Nothing more.\n\n**SCRIPT:**\n*Three seconds. Eyes closed. One full exhale. The last call is finished. Completely.*\n\n**STANDARD:**\nYou are not your last result. You are the presence you bring to the next conversation.`,
  },
  "composure": {
    match: ["composure", "composed", "calm", "nervous", "anxious", "stressed", "tense", "pressure", "overwhelmed", "handle pressure"],
    response: `**STATE:**\nFeet on the floor. Feel them. You are here. Not in the last call. Not in the next one. Here.\n\n**STRATEGY:**\nSlow your voice by 10%. Drop your tone. Pause before you respond. The person who controls the tempo controls the room.\n\n**SCRIPT:**\n*"I will be fully present for this conversation." — Set that intention. 10 seconds. Three breaths.*\n\n**STANDARD:**\nSlow down. Control the frame. The frame controls everything.`,
  },
  "approval": {
    match: ["approval", "need them to like me", "people pleasing", "validation", "self-worth", "not good enough", "imposter"],
    response: `**STATE:**\nYou don't need anything from the person on the other end of this call. Your value was established before you picked up the phone.\n\n**STRATEGY:**\nMove from *"I hope they say yes"* to *"I'm offering something real. They get to decide."* That shift changes everything — tone, words, presence.\n\n**SCRIPT:**\n*Notice when you start over-explaining or softening. That's the signal. Pull back. Fewer words. Steadier voice.*\n\n**STANDARD:**\nYou don't chase approval. You extend an offer. That's all.`,
  },
  "service": {
    match: ["service", "purpose", "why am i doing this", "meaning", "ethical", "integrity", "helping", "genuine", "authentic"],
    response: `**STATE:**\nBe still. Remember why you're here. Not the quota. Not the board. The person on the other end who has real damage.\n\n**STRATEGY:**\nEvery call is an act of service. Every follow-up is persistence in someone else's interest. Every close is protection they didn't have before. Sell from that place.\n\n**SCRIPT:**\n*Ask yourself before the dial: "Do I believe this helps people?" The answer is yes. Let that be the energy behind every word.*\n\n**STANDARD:**\nThe highest form of selling is service. And service is unshakeable.`,
  },
  "detachment": {
    match: ["detachment", "detach", "let go", "letting go", "outcome", "attached", "desperate", "needy", "chasing"],
    response: `**STATE:**\nRelease your grip. Not your standards — your grip. Detachment is not indifference. It's the deepest form of professional confidence.\n\n**STRATEGY:**\nSay what needs to be said. Ask the question. Then wait. Count to five silently. Don't fill the space. Let them come to you.\n\n**SCRIPT:**\n*Deliver your value statement. Ask your closing question. Then silence. Five full seconds. Trust what you've presented.*\n\n**STANDARD:**\nYou don't chase outcomes. You create certainty. The rest follows.`,
  },
  "energy": {
    match: ["energy", "burnout", "tired", "exhausted", "drained", "low energy", "fatigue"],
    response: `**STATE:**\nPause. Your energy is the first thing a lead perceives — before words, before the offer. If you're depleted, no technique compensates.\n\n**STRATEGY:**\nBody: stand, walk, water. Mind: release the last call — it's finished. Purpose: reconnect to the person who needs help, not the number on the board.\n\n**SCRIPT:**\n*60 seconds between calls. Conscious release. One breath. Reconnect to purpose. Then dial.*\n\n**STANDARD:**\nRest is not the opposite of performance. It's the foundation of it.`,
  },
  "self_concept": {
    match: ["self concept", "self-concept", "identity", "who am i", "believe in myself", "self image", "mindset", "confidence boost"],
    response: `**STATE:**\nBefore the next call — who are you? Not what you do. Who you are. That answer determines everything.\n\n**STRATEGY:**\nDefine it in one sentence. Embody it for 10 seconds before each dial. Let results confirm it — not create it. Identity comes first.\n\n**SCRIPT:**\n*"I am a claims protection expert who helps property owners recover what they're owed." — Say it. Mean it. Dial from that place.*\n\n**STANDARD:**\nDecide who you are. The calls will reflect it.`,
  },
  "fear": {
    match: ["fear", "afraid", "scared", "worry", "what if", "doubt", "uncertain"],
    response: `**STATE:**\nNotice the fear. Don't obey it. It's a signal you're at the edge of growth — not a signal to stop.\n\n**STRATEGY:**\nNotice it. Name it — rejection, judgment, failure. Once named, it gets smaller. Then act from the part of you that isn't afraid. It's always there.\n\n**SCRIPT:**\n*"There's fear here." — Say it to yourself. Acknowledge it. Then dial anyway. That's the practice.*\n\n**STANDARD:**\nCourage is not the absence of fear. It's clarity in the presence of it.`,
  },
  "reset": {
    match: ["reset", "reset before call", "pre-call", "prepare", "center", "ground", "ready"],
    response: `**STATE:**\nClose your eyes. Breathe in — 4 seconds. Hold — 4 seconds. Out — 6 seconds. Twice more.\n\n**STRATEGY:**\nFeet flat. Release the last call — it's done. Release the board — it has no power here. Set one intention for the next conversation.\n\n**SCRIPT:**\n*"I will be fully present. I will offer value. I will let the other person decide." — That's it. Open your eyes. Dial.*\n\n**STANDARD:**\nYou're not under pressure. You're in control.`,
  },
};

function getAxisResponse(input, mode, liveCtx) {
  const lower = input.toLowerCase();
  const bank = mode === "coach" ? COACH_RESPONSES : mode === "inner" ? INNER_GAME_RESPONSES : HELP_RESPONSES;

  // Check all response categories
  for (const [, entry] of Object.entries(bank)) {
    for (const keyword of entry.match) {
      if (lower.includes(keyword)) {
        let response = entry.response;

        // Dynamic "next action" in help mode
        if (response === "__DYNAMIC_NEXT_ACTION__" && mode === "help") {
          if (liveCtx && liveCtx.activeLead) {
            const conf = liveCtx.confidence || 0;
            if (liveCtx.outreachActive) {
              response = `**You have ${liveCtx.activeLead} active (${conf}% confidence). Outreach is running.**\n\n**Your next move:**\n1. Check Deal Flow Step 3 — has the client responded?\n2. If YES → send the agreement immediately (Step 4)\n3. If NOT YET → let the follow-up system work. Move to the next lead.\n\n**Meanwhile:** Open another qualified lead and start a parallel Deal Flow. Multiple deals in flight = faster close rate.`;
            } else if (conf >= 90) {
              response = `**You have ${liveCtx.activeLead} active — ${conf}% confidence. This is a high-value lead.**\n\n**Your next move:**\n1. You're in the Deal Flow — review the script if you haven't\n2. Hit "SEND NOW" to launch outreach\n3. The follow-up system activates automatically\n4. If they're high-confidence, consider a Pre-Call Lock-In first for frame control\n\n**Don't wait on this one.** ${conf}% leads close fastest when you act within 24 hours.`;
            } else {
              response = `**You have ${liveCtx.activeLead} active (${conf}% confidence).**\n\n**Your next move:**\n1. Review the AI sales script — it's personalized for their damage profile\n2. Launch outreach via Deal Flow Step 2\n3. The automated follow-up will handle persistence\n\n**Tip:** Lower confidence leads benefit from Pre-Call Lock-In coaching. Click "PRE-CALL LOCK-IN" on the lead card first.`;
            }
          } else {
            // Use action summary if available
            const s = liveCtx?.actionSummary;
            if (s && s.needsAction > 0) {
              response = `**You have ${s.needsAction} lead${s.needsAction !== 1 ? "s" : ""} needing action right now.**\n\n`;
              if (s.startOutreach > 0) response += `▸ **${s.startOutreach}** need outreach — click lead name → Deal Flow → Send\n`;
              if (s.sendAgreement > 0) response += `▸ **${s.sendAgreement}** responded YES — send the agreement NOW\n`;
              if (s.followAgreement > 0) response += `▸ **${s.followAgreement}** have agreements pending signature — follow up\n`;
              response += `\n**${s.converted}/${s.total}** leads converted so far.\n\n**Your move:** ${s.sendAgreement > 0 ? "Send agreements first — those are closest to revenue." : s.startOutreach > 0 ? "Start outreach on qualified leads. One click starts the automation." : "Follow up on pending agreements. A quick call closes them."}`;
            } else {
              response = `**No lead currently active.**\n\n**Your next move:**\n1. Go to **Fire Leads**\n2. Look for the highest confidence % lead — Qualified leads close fastest\n3. **Click the lead name** to open Deal Flow\n4. Read the script (Step 1) → Send outreach (Step 2) → system takes over\n\n**One click starts the machine.** Pick a lead and go.`;
            }
          }
          return response;
        }

        // Append context-aware guidance in help mode
        if (mode === "help" && liveCtx) {
          if (liveCtx.activeLead && !lower.includes("what should")) {
            response += `\n\n---\n**Current context:** You have **${liveCtx.activeLead}** active (${liveCtx.confidence}% confidence).${liveCtx.outreachActive ? " Outreach is running." : " No outreach yet — consider launching."}`;
          }
        }
        return response;
      }
    }
  }

  // Fallback for coach mode
  if (mode === "coach") {
    return `**STATE:**\nYou're here. That means there's a situation. Give me the details.\n\n**STRATEGY:**\nTell me the objection, the lead type, or the stage you're at. The more specific, the sharper the play.\n\n**SCRIPT:**\n*Say "not interested," "call me later," "closing," "fire lead," "follow-up," or "script" — and I'll give you the exact words.*\n\n**STANDARD:**\nThe agent who prepares wins. You're preparing right now.`;
  }

  // Fallback for inner game mode
  if (mode === "inner") {
    return `**STATE:**\nPause. Be honest with yourself for a moment. What's present?\n\n**STRATEGY:**\nName it — rejection, pressure, doubt, low energy, disconnection from purpose. Naming it is the first step to releasing it.\n\n**SCRIPT:**\n*Say "reset" for a pre-call centering. Or tell me what you're feeling — no wrong answer here.*\n\n**STANDARD:**\nThe outer game always follows the inner game. Always.`;
  }

  // Fallback for help mode
  return `**I know every part of this platform.**\n\nAsk me about:\n- **"First Deal Flow"** — the 5-step guided close\n- **"Start outreach"** — SMS, email, and follow-up automation\n- **"Follow-up system"** — Day 0/1/3/5 automated sequence\n- **"Send agreement"** — UPASign digital signatures\n- **"Lead statuses"** — what each status means + next action\n- **"What should I do next"** — your highest-priority move\n- **"Metrics"** — KPI definitions and what to watch\n- **"Pre-call"** — Elite frame coaching system\n- **"Protection plans"** — programs, tiers, pricing\n- **"Skip"** — why you shouldn't skip steps\n- **"Incomplete"** — check for unfinished workflows\n\nBe specific. I'll give you the exact steps.`;
}

// ── FORMAT MESSAGE ───────────────────────────────────────────────────────────

function FormatMessage({ text }) {
  // Simple markdown-like rendering: **bold**, *italic*, newlines
  const parts = text.split("\n");
  return (
    <div>
      {parts.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
        // Bold
        let formatted = line.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
        // Italic
        formatted = formatted.replace(/\*(.+?)\*/g, '<i style="color:#FFFFFF">$1</i>');
        return (
          <div
            key={i}
            style={{ marginBottom: 3 }}
            dangerouslySetInnerHTML={{ __html: formatted }}
          />
        );
      })}
    </div>
  );
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function AxisCoach({ open, onClose }) {
  const { dailyPoints, leaderboard, liveContext } = useAxisContext();
  const [mode, setMode] = useState("coach"); // "coach" | "help" | "inner"
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { from: "axis", text: "**AXIS online. Coach Mode active.**\n\nGive me the lead, the objection, or the situation — I'll give you the exact play, the script, and the close.\n\nNo theory. No fluff. Just what works.\n\nWhat are we working on?", mode: "coach" },
  ]);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || typing) return;

    setMessages(prev => [...prev, { from: "user", text: trimmed }]);
    setInput("");
    setTyping(true);

    // Simulate AI response delay (inner game is slower, more deliberate)
    const delay = mode === "inner" ? 1200 + Math.random() * 1000 : 600 + Math.random() * 800;
    setTimeout(() => {
      const response = getAxisResponse(trimmed, mode, liveContext);
      setMessages(prev => [...prev, { from: "axis", text: response, mode }]);
      setTyping(false);
    }, delay);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    const greetings = {
      coach: "**AXIS Coach Mode.** Scripts. Objections. Closes. Strategy.\n\nTell me what you're working and I'll tell you exactly how to win it.",
      help: "**AXIS Help Mode — Platform Operator.**\n\nI know every screen, every button, every workflow.\n\nAsk me about Deal Flow, outreach, follow-ups, agreements, lead statuses, metrics, or say **\"what should I do next\"** and I'll tell you your highest-priority move.",
      inner: "**AXIS Inner Game.**\n\nPresence. Clarity. Control.\n\nThe outer results reflect the inner state.\n\nTell me what's present for you — or say \"reset\" to center before your next call.\n\n**The work starts here.**",
    };
    setMessages(prev => [...prev, { from: "axis", text: greetings[newMode], mode: newMode }]);
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          zIndex: 997, transition: "opacity 0.2s",
        }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed",
        bottom: 24, right: 24,
        width: 420, height: 600,
        background: "rgba(12, 18, 30, 0.97)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 12,
        zIndex: 998,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: mode === "inner"
          ? `0 20px 60px rgba(0,0,0,0.5), 0 0 30px ${INNER_GOLD}10`
          : `0 20px 60px rgba(0,0,0,0.5), 0 0 30px ${PURPLE}10`,
        animation: "axisSlideUp 0.3s ease both",
      }}>
        <style>{`
          @keyframes axisSlideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes axisDot {
            0%, 80%, 100% { opacity: 0.3; }
            40% { opacity: 1; }
          }
          .axis-input {
            color: #FFFFFF !important;
          }
          .axis-input:focus {
            border-color: ${PURPLE} !important;
          }
          .axis-input::placeholder {
            color: rgba(255,255,255,0.5) !important;
          }
        `}</style>

        {/* Header */}
        <div style={{
          padding: "16px 20px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: mode === "inner"
                ? `linear-gradient(135deg, ${INNER_GOLD}, ${INNER_GOLD_DIM})`
                : `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DIM})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 900, color: mode === "inner" ? "#1a1206" : "#fff", ...mono,
              letterSpacing: 1,
              transition: "all 0.4s ease",
            }}>
              {mode === "inner" ? "\u25C9" : "AX"}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", ...mono, letterSpacing: 1 }}>
                AXIS
              </div>
              <div style={{ fontSize: 12, color: mode === "inner" ? INNER_GOLD : PURPLE, ...mono, letterSpacing: mode === "inner" ? 1.5 : 0.5, marginTop: 1 }}>
                {mode === "coach" ? "COACH MODE" : mode === "inner" ? "I N N E R   G A M E" : "HELP MODE"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Mode Toggle */}
            <div style={{ display: "flex", gap: 0 }}>
              {[
                { key: "coach", label: "COACH", accent: PURPLE },
                { key: "inner", label: "INNER", accent: INNER_GOLD },
                { key: "help", label: "HELP", accent: PURPLE },
              ].map((m, idx) => (
                <button
                  key={m.key}
                  onClick={() => mode !== m.key && switchMode(m.key)}
                  style={{
                    padding: "5px 10px",
                    background: mode === m.key ? `${m.accent}20` : "transparent",
                    border: `1px solid ${mode === m.key ? `${m.accent}50` : "rgba(255,255,255,0.08)"}`,
                    borderRadius: idx === 0 ? "5px 0 0 5px" : idx === 2 ? "0 5px 5px 0" : "0",
                    color: mode === m.key ? m.accent : "rgba(255,255,255,0.85)",
                    fontSize: 12, fontWeight: 700, letterSpacing: 0.8,
                    cursor: "pointer", ...mono, transition: "all 0.3s",
                    borderLeft: idx > 0 ? "none" : undefined,
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.85)", fontSize: 18, cursor: "pointer", padding: 2, lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Daily Score + Leaderboard */}
        <div style={{
          padding: "8px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "rgba(124,58,237,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", letterSpacing: 1.5, textTransform: "uppercase", ...mono, fontWeight: 600 }}>
              TODAY
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: PURPLE, ...mono }}>
              {dailyPoints}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", ...mono, letterSpacing: 0.5 }}>
              CP
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {leaderboard.slice(0, 3).map((a, i) => (
              <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, ...mono,
                  color: i === 0 ? C.gold : i === 1 ? "#C0C0C0" : "#CD7F32",
                }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", ...mono }}>
                  {a.name.split(" ")[0]}
                </span>
                <span style={{ fontSize: 12, color: "#FFFFFF", fontWeight: 700, ...mono }}>
                  {a.points}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1, overflowY: "auto", padding: "16px 16px 8px",
            display: "flex", flexDirection: "column", gap: 12,
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: msg.from === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div style={{
                maxWidth: "88%",
                padding: msg.from === "user" ? "10px 14px" : "12px 16px",
                borderRadius: msg.from === "user" ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                background: msg.from === "user"
                  ? (mode === "inner" ? "rgba(212,168,83,0.15)" : "rgba(124,58,237,0.2)")
                  : "rgba(18, 24, 38, 0.96)",
                border: `1px solid ${
                  msg.from === "user"
                    ? (mode === "inner" ? "rgba(212,168,83,0.3)" : "rgba(124,58,237,0.3)")
                    : "rgba(255,255,255,0.10)"
                }`,
                fontSize: 14, color: "#FFFFFF", fontWeight: 600,
                lineHeight: msg.mode === "inner" ? 1.8 : 1.6,
                ...mono,
              }}>
                {msg.from === "axis" ? (
                  <FormatMessage text={msg.text} />
                ) : (
                  msg.text
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {typing && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{
                padding: "10px 16px",
                borderRadius: "10px 10px 10px 2px",
                background: "rgba(18, 24, 38, 0.96)",
                border: "1px solid rgba(255,255,255,0.10)",
                display: "flex", gap: 4, alignItems: "center",
              }}>
                {[0, 1, 2].map(d => (
                  <div key={d} style={{
                    width: 6, height: 6, borderRadius: 3,
                    background: mode === "inner" ? INNER_GOLD : PURPLE,
                    animation: `axisDot ${mode === "inner" ? "1.8" : "1.2"}s ease ${d * (mode === "inner" ? 0.3 : 0.2)}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{
          padding: "8px 16px 4px",
          display: "flex", gap: 6, flexWrap: "wrap",
        }}>
          {(mode === "coach"
            ? ["Not interested", "Call me later", "Already have someone", "Insurance will handle it", "Closing script", "Fire lead strategy", "Follow-up plan", "Motivation"]
            : mode === "inner"
            ? ["Reset before call", "Confidence boost", "Handle pressure", "Let go of outcome", "Handling rejection", "Selling from service", "Low energy", "Fear and doubt"]
            : ["First Deal Flow", "Start outreach", "Follow-up system", "Send agreement", "Lead statuses", "What should I do next", "Protection plans", "AXIS modes"]
          ).map(q => {
            const chipAccent = mode === "inner" ? INNER_GOLD : PURPLE;
            return (
              <button
                key={q}
                onClick={() => {
                  setInput(q);
                  setTimeout(() => {
                    setMessages(prev => [...prev, { from: "user", text: q }]);
                    setInput("");
                    setTyping(true);
                    setTimeout(() => {
                      const response = getAxisResponse(q, mode, liveContext);
                      setMessages(prev => [...prev, { from: "axis", text: response, mode }]);
                      setTyping(false);
                    }, 800 + Math.random() * 1000);
                  }, 50);
                }}
                style={{
                  padding: "5px 12px",
                  background: `${chipAccent}25`, border: `1px solid ${chipAccent}40`,
                  borderRadius: 4, color: "#FFFFFF", fontSize: 12,
                  fontWeight: 600, letterSpacing: 0.5, cursor: "pointer",
                  ...mono, transition: "all 0.2s",
                }}
              >
                {q}
              </button>
            );
          })}
        </div>

        {/* Input */}
        <div style={{
          padding: "12px 16px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex", gap: 10, alignItems: "flex-end",
        }}>
          <textarea
            className="axis-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === "coach" ? "Describe the situation..." : mode === "inner" ? "What's present for you..." : "Ask about the platform..."}
            rows={1}
            style={{
              flex: 1, padding: "10px 14px",
              background: "rgba(6, 8, 16, 0.95)", border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 8, color: "#fff", fontSize: 14,
              ...mono, outline: "none", resize: "none",
              lineHeight: 1.5, maxHeight: 80,
              transition: "border-color 0.2s",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || typing}
            style={{
              padding: "10px 16px",
              background: (!input.trim() || typing) ? "rgba(20,26,40,0.8)"
                : mode === "inner" ? `linear-gradient(135deg, ${INNER_GOLD}, ${INNER_GOLD_DIM})`
                : `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DIM})`,
              border: "none", borderRadius: 8,
              color: (!input.trim() || typing) ? "rgba(255,255,255,0.5)" : "#FFFFFF",
              fontSize: 14, fontWeight: 700, letterSpacing: 1,
              cursor: (!input.trim() || typing) ? "default" : "pointer",
              ...mono, transition: "all 0.2s",
              flexShrink: 0,
            }}
          >
            ↑
          </button>
        </div>
      </div>
    </>
  );
}
