import { useState, useEffect, useCallback, useRef } from "react";
import { C } from "./theme";
import EnrollmentDrawer from "./shared/EnrollmentDrawer";
import { useAxisContext } from "./AxisContext";
import { launchOutreach, pauseFollowUp, resumeFollowUp, stopFollowUp } from "../system/leads/outreach";

const mono = { fontFamily: "'Courier New', monospace" };

const glassPanel = {
  background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 10,
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
};

// ── MOCK LEADS ───────────────────────────────────────────────────────────────

const INITIAL_LEADS = [
  { id: 1, name: "James Whitfield", phone: "(305) 555-0142", email: "jwhitfield@mail.com", address: "4521 Palm Creek Dr", state: "FL", type: "Homeowner", source: "Wildfire Alert", damage: "Roof & Exterior", date: "2026-03-28", status: "New", converted: false, outreach: null },
  { id: 2, name: "Maria Santos", phone: "(713) 555-0198", email: "msantos@mail.com", address: "889 Westpark Blvd", state: "TX", type: "Landlord", source: "Storm Tracker", damage: "Water Damage — 3 Units", date: "2026-03-27", status: "Contacted", converted: false, outreach: null },
  { id: 3, name: "Derek Okafor", phone: "(404) 555-0267", email: "dokafor@mail.com", address: "1200 Peachtree Industrial", state: "GA", type: "Business", source: "Hail Report", damage: "Commercial Roof", date: "2026-03-27", status: "New", converted: false, outreach: null },
  { id: 4, name: "Lisa Tran", phone: "(602) 555-0311", email: "ltran@mail.com", address: "7744 E Camelback Rd", state: "AZ", type: "Homeowner", source: "Wildfire Alert", damage: "Smoke & Ash Damage", date: "2026-03-26", status: "Qualified", converted: false, outreach: null },
  { id: 5, name: "Robert Vasquez", phone: "(214) 555-0455", email: "rvasquez@mail.com", address: "3310 Commerce St", state: "TX", type: "Landlord", source: "Wind Damage", damage: "Fence & Siding — 6 Units", date: "2026-03-25", status: "Contacted", converted: false, outreach: null },
  { id: 6, name: "Angela Brooks", phone: "(818) 555-0589", email: "abrooks@mail.com", address: "15602 Ventura Blvd", state: "CA", type: "Business", source: "Wildfire Alert", damage: "Business Interruption", date: "2026-03-24", status: "New", converted: false, outreach: null },
  { id: 7, name: "Kevin Park", phone: "(303) 555-0623", email: "kpark@mail.com", address: "2200 S Colorado Blvd", state: "CO", type: "Homeowner", source: "Hail Report", damage: "Roof & Windows", date: "2026-03-23", status: "Qualified", converted: false, outreach: null },
  { id: 8, name: "Natasha Williams", phone: "(504) 555-0744", email: "nwilliams@mail.com", address: "441 Magazine St", state: "LA", type: "Homeowner", source: "Storm Tracker", damage: "Flooding — Ground Floor", date: "2026-03-22", status: "Contacted", converted: false, outreach: null },
];

const STATUS_COLORS = {
  New: C.blue,
  Contacted: C.gold,
  Qualified: C.green,
  Converted: C.green,
  "Outreach Active": "#A855F7",
  "In Follow-Up": "#A855F7",
};

// ── FOLLOW-UP SEQUENCE ──────────────────────────────────────────────────────

const FOLLOWUP_SEQUENCE = [
  { day: 0, label: "Initial SMS + Call", type: "sms+call" },
  { day: 1, label: "Follow-up SMS", type: "sms" },
  { day: 3, label: "Second follow-up SMS", type: "sms" },
  { day: 5, label: "Final follow-up SMS", type: "sms" },
];

// For demo: 1 real day = 8 seconds so the sequence plays out visibly
const DEMO_DAY_MS = 8000;

// ── NEXT ACTION ENGINE ────────────────────────────────────────���─────────────

const NEXT_ACTIONS = {
  START_OUTREACH: { label: "Start Outreach", color: "#00E6A8", icon: "▶", priority: 1 },
  FOLLOWUP_ACTIVE: { label: "Follow-up in progress", color: "#A855F7", icon: "◎", priority: 3 },
  SEND_AGREEMENT: { label: "Send Agreement", color: "#00E6A8", icon: "📄", priority: 1 },
  FOLLOW_AGREEMENT: { label: "Follow up on agreement", color: C.gold, icon: "⏳", priority: 2 },
  COMPLETED: { label: "Completed", color: C.green, icon: "✓", priority: 4 },
};

function getNextAction(lead) {
  if (lead.converted) return NEXT_ACTIONS.COMPLETED;
  if (lead.agreement?.status === "sent") return NEXT_ACTIONS.FOLLOW_AGREEMENT;
  if (lead.responded === "yes") return NEXT_ACTIONS.SEND_AGREEMENT;
  if (lead.outreach && !lead.responded) return NEXT_ACTIONS.FOLLOWUP_ACTIVE;
  return NEXT_ACTIONS.START_OUTREACH;
}

const TYPE_ICONS = {
  Homeowner: "\u{1F3E0}",
  Landlord: "\u{1F3E2}",
  Business: "\u{1F3EA}",
};

// ── LEAD INTELLIGENCE BADGE ─────────────────────────────────────────────────

function getIntelBadge(confidence) {
  if (confidence >= 90) return {
    label: "AI VERIFIED",
    color: "#00E6A8",
    bg: "rgba(0,230,168,0.12)",
    border: "rgba(0,230,168,0.30)",
    tooltip: "High-confidence AI match — damage profile, location, and claim history verified against program criteria",
  };
  if (confidence >= 85) return {
    label: "AI ASSISTED",
    color: C.blue,
    bg: `${C.blue}12`,
    border: `${C.blue}30`,
    tooltip: "AI-enriched lead — program matched by damage type and property profile",
  };
  return {
    label: "MANUAL",
    color: "rgba(255,255,255,0.45)",
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.12)",
    tooltip: "Standard lead — not yet AI-verified. Open Deal Flow to enrich.",
  };
}

// ── AI RECOMMENDATION ENGINE (mock) ──────────────────────────────────────────

const PROGRAM_MAP = {
  Homeowner: "We The People",
  Landlord: "LandlordShield",
  Business: "Business Shield",
};

const PROGRAM_COLORS = {
  "We The People": C.gold,
  "LandlordShield": C.blue,
  "Business Shield": C.green,
};

function getAiRecommendation(lead) {
  const program = PROGRAM_MAP[lead.type];
  let confidence = lead.status === "Qualified" ? 94 : lead.status === "Contacted" ? 87 : 81;
  const damageLower = lead.damage.toLowerCase();
  if (damageLower.includes("unit") || damageLower.includes("interruption")) confidence += 3;
  if (damageLower.includes("roof") || damageLower.includes("flood")) confidence += 2;
  confidence = Math.min(confidence, 98);

  const reasons = {
    Homeowner: {
      "Roof & Exterior": "Structural fire damage, high underpayment risk on exterior claims",
      "Smoke & Ash Damage": "Smoke claims frequently undervalued, policy language disputes common",
      "Roof & Windows": "Hail impact on multiple surfaces, contractor fraud exposure is elevated",
      "Flooding — Ground Floor": "Flood claims face strict documentation requirements, coverage gaps likely",
    },
    Landlord: {
      "Water Damage — 3 Units": "Multi-unit water damage, tenant displacement risk, recurring claim exposure",
      "Fence & Siding — 6 Units": "Multi-unit property, wind damage across structures, lost rent recovery opportunity",
    },
    Business: {
      "Commercial Roof": "Commercial roof claims require specialized documentation, co-insurance penalty risk",
      "Business Interruption": "BI claims are complex and time-sensitive, cash-flow protection critical",
    },
  };

  const reason = reasons[lead.type]?.[lead.damage]
    || `${lead.type} property with ${lead.damage.toLowerCase()}, protection plan reduces claim risk`;

  return { program, confidence, reason };
}

function getSalesScript(lead) {
  const rec = getAiRecommendation(lead);
  const firstName = lead.name.split(" ")[0];
  const damageLC = lead.damage.toLowerCase();

  const scripts = {
    "We The People": `Hi ${firstName}, I noticed your property at ${lead.address} recently experienced ${damageLC}. Most homeowners in ${lead.state} dealing with this type of damage end up with underpaid claims or contractor disputes they didn't see coming.\n\nOur We The People plan gives you direct access to LEX AI for policy guidance, plus claim review support so nothing gets missed. It's $19 to $99 a month depending on coverage level — and it pays for itself on the first claim.\n\nWould you like me to walk you through the tiers?`,
    "LandlordShield": `Hi ${firstName}, I'm reaching out about the ${damageLC} at your property on ${lead.address}. Managing damage claims across rental units is a different challenge — you've got tenant displacement, lost rent, and documentation across multiple structures.\n\nLandlordShield is built specifically for this. We handle move-in/move-out inspections, tenant damage claim filing, and lost rent recovery. Plans start at $49 per unit per month.\n\nDo you have a few minutes to go over how this would work for your portfolio?`,
    "Business Shield": `Hi ${firstName}, I saw the ${damageLC} report for ${lead.address}. Business claims are some of the most complex — especially around interruption losses and co-insurance penalties.\n\nBusiness Shield covers cash-out policy review, business interruption claims, and co-insurance protection so you're not leaving money on the table. Plans range from $79 to $399 per month.\n\nCan I show you how this maps to your current exposure?`,
  };

  return scripts[rec.program] || scripts["We The People"];
}

function getOutreachSms(lead) {
  const firstName = lead.name.split(" ")[0];
  const damageLC = lead.damage.toLowerCase();
  const messages = {
    Homeowner: `Hi ${firstName}, we noticed your property at ${lead.address} may have experienced ${damageLC}. We help homeowners protect their claims and avoid underpayments. Would you like a quick review? — Unified Public Advocacy`,
    Landlord: `Hi ${firstName}, we saw the ${damageLC} report for your property at ${lead.address}. We help landlords file tenant damage claims and recover lost rent. Can we set up a quick call? — Unified Public Advocacy`,
    Business: `Hi ${firstName}, we flagged ${damageLC} at ${lead.address}. Business claims are time-sensitive — we help protect against co-insurance penalties and interruption losses. Want a free review? — Unified Public Advocacy`,
  };
  return messages[lead.type] || messages.Homeowner;
}

function getOutreachEmail(lead) {
  const firstName = lead.name.split(" ")[0];
  const damageLC = lead.damage.toLowerCase();
  const rec = getAiRecommendation(lead);
  return `Subject: Protecting your property after ${damageLC}\n\nHi ${firstName},\n\nWe recently identified ${damageLC} affecting your property at ${lead.address}, ${lead.state}. Based on our analysis, properties like yours face a high risk of underpaid claims and coverage disputes.\n\nOur ${rec.program} plan is designed specifically for ${lead.type.toLowerCase()}s in this situation — giving you access to claim review support, policy guidance, and protection from contractor fraud.\n\nWould you be open to a quick 10-minute call this week?\n\nBest,\nUnified Public Advocacy`;
}

// ── KPI DATA ─────────────────────────────────────────────────────────────────

function getKpis(leads) {
  const total = leads.length;
  const converted = leads.filter(l => l.converted).length;
  const needsAction = leads.filter(l => {
    const a = getNextAction(l);
    return a.priority <= 2; // START_OUTREACH, SEND_AGREEMENT, FOLLOW_AGREEMENT
  }).length;
  const followUp = leads.filter(l => l.followUp && !l.followUp.paused && !l.converted).length;
  return [
    { label: "Total Leads", value: total.toString(), color: C.gold },
    { label: "Needs Action", value: needsAction.toString(), color: "#00E6A8" },
    { label: "In Follow-Up", value: followUp.toString(), color: "#A855F7" },
    { label: "Converted", value: converted.toString(), color: C.green },
  ];
}

// ── SALES SCRIPT MODAL ───────────────────────────────────────────────────────

function ScriptModal({ open, lead, onClose }) {
  if (!open || !lead) return null;
  const script = getSalesScript(lead);
  const rec = getAiRecommendation(lead);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          zIndex: 1000, opacity: open ? 1 : 0, transition: "opacity 0.2s",
        }}
      />
      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 520, maxHeight: "80vh",
        background: C.navy,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        zIndex: 1001,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }}>
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                display: "inline-block", padding: "3px 8px",
                background: `${C.blue}18`, border: `1px solid ${C.blue}40`,
                borderRadius: 4, fontSize: 12, color: C.blue,
                letterSpacing: 1, fontWeight: 600, ...mono,
              }}>
                AXIS
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.white, ...mono, letterSpacing: 1 }}>
                SALES SCRIPT
              </span>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4, ...mono }}>
              {lead.name} — {rec.program}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", padding: 4, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
          <div style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "20px 24px",
          }}>
            {script.split("\n\n").map((para, i) => (
              <p key={i} style={{
                fontSize: 14, color: C.cream, lineHeight: 1.7, ...mono,
                margin: i === 0 ? 0 : "14px 0 0 0",
              }}>
                {para}
              </p>
            ))}
          </div>
          <div style={{ marginTop: 20, padding: "14px 18px", background: `${C.gold}0a`, border: `1px solid ${C.gold}20`, borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: C.gold, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, ...mono, fontWeight: 600 }}>
              TALKING POINTS
            </div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, ...mono }}>
              ✦ Lead came from: {lead.source}<br />
              ✦ Damage type: {lead.damage}<br />
              ✦ Confidence score: {rec.confidence}% match<br />
              ✦ Recommended tier: Start mid-tier, upsell if multi-claim
            </div>
          </div>
        </div>
        <div style={{
          padding: "14px 24px",
          borderTop: `1px solid ${C.border}`,
          display: "flex", justifyContent: "flex-end",
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 24px", background: C.panel2, border: `1px solid ${C.border}`,
              borderRadius: 6, color: C.cream, fontSize: 13, fontWeight: 600,
              letterSpacing: 1, cursor: "pointer", ...mono, transition: "all 0.2s",
            }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </>
  );
}

// ── OUTREACH MODAL ───────────────────────────────────────────────────────────

const PURPLE = "#A855F7";
const PURPLE_DIM = "#7C3AED";

function OutreachModal({ open, lead, onClose, onLaunch }) {
  const [smsOn, setSmsOn] = useState(true);
  const [emailOn, setEmailOn] = useState(true);
  const [voiceOn, setVoiceOn] = useState(false);
  const [smsText, setSmsText] = useState("");
  const [emailText, setEmailText] = useState("");
  const [tab, setTab] = useState("sms");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open && lead) {
      setSmsText(getOutreachSms(lead));
      setEmailText(getOutreachEmail(lead));
      setSmsOn(true);
      setEmailOn(true);
      setVoiceOn(false);
      setTab("sms");
      setSending(false);
      setSent(false);
    }
  }, [open, lead]);

  if (!open || !lead) return null;

  const rec = getAiRecommendation(lead);

  const handleLaunch = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
      const channels = { sms: smsOn, email: emailOn, voice: voiceOn };
      setTimeout(() => {
        onLaunch(lead.id, channels);
        onClose();
      }, 1200);
    }, 1500);
  };

  const toggleStyle = (on) => ({
    width: 40, height: 22, borderRadius: 11,
    background: on ? PURPLE : C.panel2,
    border: `1px solid ${on ? PURPLE_DIM : C.border}`,
    position: "relative", cursor: "pointer",
    transition: "all 0.2s ease", flexShrink: 0,
  });

  const toggleKnob = (on) => ({
    position: "absolute", top: 2, left: on ? 20 : 2,
    width: 16, height: 16, borderRadius: 8,
    background: on ? "#fff" : C.muted,
    transition: "all 0.2s ease",
  });

  const channelRow = (label, icon, on, toggle) => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 14px",
      background: on ? `${PURPLE}08` : "transparent",
      border: `1px solid ${on ? `${PURPLE}25` : C.border}`,
      borderRadius: 6, transition: "all 0.2s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 14, color: on ? C.white : C.muted, fontWeight: 600, ...mono, letterSpacing: 0.5 }}>
          {label}
        </span>
      </div>
      <div style={toggleStyle(on)} onClick={toggle}>
        <div style={toggleKnob(on)} />
      </div>
    </div>
  );

  const textareaStyle = {
    width: "100%", minHeight: 120, padding: "14px 16px",
    background: C.panel2, border: `1px solid ${C.border}`,
    borderRadius: 6, color: C.cream, fontSize: 14,
    lineHeight: 1.6, ...mono, outline: "none",
    resize: "vertical", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          zIndex: 1000, transition: "opacity 0.2s",
        }}
      />
      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 560, maxHeight: "85vh",
        background: C.navy,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        zIndex: 1001,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                display: "inline-block", padding: "3px 8px",
                background: `${PURPLE}18`, border: `1px solid ${PURPLE}40`,
                borderRadius: 4, fontSize: 12, color: PURPLE,
                letterSpacing: 1, fontWeight: 600, ...mono,
              }}>
                AXIS
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.white, ...mono, letterSpacing: 1 }}>
                LAUNCH AI OUTREACH
              </span>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4, ...mono }}>
              {lead.name} — {rec.program} — {rec.confidence}% match
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", padding: 4, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
          {sent ? (
            <div style={{ textAlign: "center", paddingTop: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: PURPLE, ...mono, letterSpacing: 1 }}>
                OUTREACH LAUNCHED
              </div>
              <div style={{ fontSize: 14, color: C.muted, marginTop: 12, lineHeight: 1.6, ...mono }}>
                {[smsOn && "SMS Sent", emailOn && "Email Sent", voiceOn && "Call Scheduled"].filter(Boolean).join(" · ")}
              </div>
            </div>
          ) : (
            <>
              {/* Channels */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10, ...mono, fontWeight: 600 }}>
                  OUTREACH CHANNELS
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {channelRow("SMS Message", "\u{1F4F1}", smsOn, () => setSmsOn(v => !v))}
                  {channelRow("Email", "\u{1F4E7}", emailOn, () => setEmailOn(v => !v))}
                  {channelRow("AI Voice Call", "\u{1F4DE}", voiceOn, () => setVoiceOn(v => !v))}
                </div>
              </div>

              {/* Message Preview */}
              <div>
                <div style={{ fontSize: 12, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10, ...mono, fontWeight: 600 }}>
                  MESSAGE PREVIEW
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", gap: 0, marginBottom: 12 }}>
                  {[
                    { key: "sms", label: "SMS", enabled: smsOn },
                    { key: "email", label: "EMAIL", enabled: emailOn },
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => t.enabled && setTab(t.key)}
                      style={{
                        padding: "8px 18px",
                        background: tab === t.key ? `${PURPLE}18` : "transparent",
                        border: `1px solid ${tab === t.key ? `${PURPLE}50` : C.border}`,
                        borderRadius: t.key === "sms" ? "6px 0 0 6px" : "0 6px 6px 0",
                        color: !t.enabled ? `${C.muted}60` : tab === t.key ? PURPLE : C.muted,
                        fontSize: 12, fontWeight: 600, letterSpacing: 1,
                        cursor: t.enabled ? "pointer" : "default",
                        ...mono, transition: "all 0.2s",
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {tab === "sms" && smsOn && (
                  <textarea
                    style={textareaStyle}
                    value={smsText}
                    onChange={e => setSmsText(e.target.value)}
                  />
                )}
                {tab === "email" && emailOn && (
                  <textarea
                    style={{ ...textareaStyle, minHeight: 180 }}
                    value={emailText}
                    onChange={e => setEmailText(e.target.value)}
                  />
                )}
                {((tab === "sms" && !smsOn) || (tab === "email" && !emailOn)) && (
                  <div style={{
                    padding: "30px 0", textAlign: "center",
                    fontSize: 13, color: C.muted, ...mono,
                  }}>
                    Channel disabled
                  </div>
                )}
              </div>

              {voiceOn && (
                <div style={{
                  marginTop: 16, padding: "12px 16px",
                  background: `${PURPLE}08`, border: `1px solid ${PURPLE}20`,
                  borderRadius: 6,
                }}>
                  <div style={{ fontSize: 12, color: PURPLE, ...mono, fontWeight: 600, letterSpacing: 0.5 }}>
                    AI VOICE CALL
                  </div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 1.5, ...mono }}>
                    LEX AI will call {lead.phone} using the sales script above. Call will be scheduled within 15 minutes of launch.
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!sent && (
          <div style={{
            padding: "16px 24px",
            borderTop: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ fontSize: 12, color: C.muted, ...mono }}>
              {[smsOn && "SMS", emailOn && "Email", voiceOn && "Voice"].filter(Boolean).join(" + ") || "No channels selected"}
            </div>
            <button
              onClick={handleLaunch}
              disabled={sending || (!smsOn && !emailOn && !voiceOn)}
              style={{
                padding: "12px 28px",
                background: (!smsOn && !emailOn && !voiceOn) ? C.panel2 : sending ? `${PURPLE}80` : `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DIM})`,
                border: "none", borderRadius: 6,
                color: (!smsOn && !emailOn && !voiceOn) ? C.muted : "#fff",
                fontSize: 14, fontWeight: 700, letterSpacing: 1.5,
                cursor: (!smsOn && !emailOn && !voiceOn) ? "default" : "pointer",
                ...mono, transition: "all 0.2s",
                opacity: sending ? 0.8 : 1,
              }}
            >
              {sending ? "SENDING..." : "START OUTREACH"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── PRE-CALL LOCK-IN MODAL ───────────────────────────────────────────────────

const INNER_GOLD = "#D4A853";

const ELITE_FRAMES = {
  default: (lead, rec) => ({
    state: rec.confidence >= 92
      ? "This is a high-probability close. Settle in. No rush."
      : rec.confidence >= 85
      ? "Solid lead. They know the damage is real. You're here to move them to action."
      : "Early-stage lead. Earn credibility in the first 10 seconds. Be specific.",
    strategy: rec.confidence >= 92
      ? "Lead with concern, not product. Ask one question about their claim status. Then listen."
      : rec.confidence >= 85
      ? "Make inaction feel more expensive than action. Use the underpayment stat."
      : "Reference their exact damage and address within the first sentence. Prove you're informed.",
    script: rec.confidence >= 92
      ? `"${lead.name.split(" ")[0]}, quick question — has your insurance given you a full breakdown on the ${lead.damage.toLowerCase()} yet?"`
      : rec.confidence >= 85
      ? `"Most homeowners in ${lead.state} dealing with ${lead.damage.toLowerCase()} end up underpaid by $8,000 to $15,000. I want to make sure that doesn't happen to you."`
      : `"I'm calling about the damage report at ${lead.address} — your property was flagged and I help owners make sure their claims don't get underpaid."`,
    standard: "You're not here to convince. You're here to uncover.",
  }),
  objection: () => ({
    state: "They pushed back. That's a buying signal, not a wall. Stay steady.",
    strategy: "Ask a question instead of answering the objection. Redirect, don't defend.",
    script: "\"I hear you. Quick question — has your adjuster given you a written breakdown yet?\"",
    standard: "Questions create control. Stay in command.",
  }),
  control: () => ({
    state: "Slow down. You control the pace of this conversation.",
    strategy: "Drop your voice 10%. Pause before responding. The person who controls the silence controls the call.",
    script: "\"Take your time. I just want to make sure nothing gets missed on your end.\"",
    standard: "Tempo is authority. Own the silence.",
  }),
  confidence: () => ({
    state: "Reset. You are not your last call. You are not your numbers today.",
    strategy: "Stop second-guessing. Deliver the first two lines exactly as written. Execution over analysis.",
    script: "\"I help property owners in [state] make sure their claims don't get underpaid. Takes five minutes.\"",
    standard: "The lead needs certainty. You are the certainty.",
  }),
  close: () => ({
    state: "The case is built. Stop building. Move to the close.",
    strategy: "Assume the enrollment. Ask for logistics, not permission. No pause. No hesitation.",
    script: "\"Here's what happens next — I'm setting up your enrollment now. What email should I send the confirmation to?\"",
    standard: "Closing is not something you do to someone. It's something you do for someone.",
  }),
  distrust: () => ({
    state: "They don't trust the process yet. That's normal. Don't take it personally.",
    strategy: "Lower the commitment. Offer a no-cost review. Remove risk from the equation entirely.",
    script: "\"No commitment at all. I'll review your claim for free — if everything looks right, I'll be the first to tell you.\"",
    standard: "Trust is built in small commitments. Offer the smallest one.",
  }),
  voicemail: () => ({
    state: "No answer. That's not rejection — it's timing. Stay in the sequence.",
    strategy: "Leave a 20-second voicemail. Reference their address and damage. Follow with an SMS within 60 seconds.",
    script: "\"Hi [Name], this is [You] — calling about the damage report at [address]. Want to make sure your claim doesn't get underpaid. I'll shoot you a text.\"",
    standard: "Persistence is professionalism when you're genuinely trying to help. Follow up like you mean it.",
  }),
  pricing: () => ({
    state: "They brought up price. That means they see value. They just need the math.",
    strategy: "Never defend the price. Reframe it against the cost of not having it.",
    script: "\"The plan is $19 a month. The average underpayment without it is $12,000. You tell me which number matters more.\"",
    standard: "You're not asking them to spend money. You're showing them how to stop losing it.",
  }),
};

function getOpeningLine(lead) {
  const firstName = lead.name.split(" ")[0];
  const damageLC = lead.damage.toLowerCase();

  const lines = {
    Homeowner: `Hey ${firstName}, quick question — were you fully taken care of on that ${damageLC} claim, or are things still unresolved?`,
    Landlord: `${firstName}, I'm looking at the ${damageLC} report for your property on ${lead.address}. Have your tenants been taken care of, or is that still open?`,
    Business: `${firstName}, quick one — the ${damageLC} at ${lead.address}. Has your insurance given you a full breakdown yet, or is that still pending?`,
  };

  return lines[lead.type] || lines.Homeowner;
}

function PreCallModal({ lead, onClose, onStartCall }) {
  const [trigger, setTrigger] = useState("default");
  const [copied, setCopied] = useState(false);

  if (!lead) return null;

  const rec = getAiRecommendation(lead);
  const progColor = PROGRAM_COLORS[rec.program] || C.gold;
  const openingLine = getOpeningLine(lead);
  const frameFn = ELITE_FRAMES[trigger] || ELITE_FRAMES.default;
  const frame = trigger === "default" ? frameFn(lead, rec) : frameFn();

  const handleCopy = () => {
    navigator.clipboard.writeText(openingLine);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartCall = () => {
    if (onStartCall) onStartCall(lead.id);
    onClose();
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
          zIndex: 1000, transition: "opacity 0.2s",
        }}
      />
      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 580, maxHeight: "88vh",
        background: C.navy,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        zIndex: 1001,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 60px ${PURPLE}08`,
        animation: "flFadeUp 0.35s ease both",
      }}>

        {/* ── A. HEADER ─────────────────────────────────────────── */}
        <div style={{
          padding: "20px 28px 16px",
          borderBottom: `1px solid ${C.border}`,
          background: `linear-gradient(180deg, ${PURPLE}08 0%, transparent 100%)`,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DIM})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 900, color: "#fff", ...mono, letterSpacing: 0.5,
                }}>AX</div>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.white, ...mono, letterSpacing: 1.5 }}>
                  PRE-CALL LOCK-IN
                </span>
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 5, ...mono, letterSpacing: 0.5 }}>
                Control the call before it starts.
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", padding: 4, lineHeight: 1 }}
            >✕</button>
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "20px 28px 24px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* ── B. LEAD SNAPSHOT ───────────────────────────────────── */}
          <div style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "16px 20px",
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px",
          }}>
            <div>
              <div style={{ fontSize: 12, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", ...mono, marginBottom: 3 }}>NAME</div>
              <div style={{ fontSize: 14, color: C.white, fontWeight: 700, ...mono }}>{lead.name}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", ...mono, marginBottom: 3 }}>DAMAGE</div>
              <div style={{ fontSize: 14, color: C.cream, ...mono }}>{lead.damage}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", ...mono, marginBottom: 3 }}>ADDRESS</div>
              <div style={{ fontSize: 13, color: C.cream, ...mono }}>{lead.address}, {lead.state}</div>
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", ...mono, marginBottom: 3 }}>PROGRAM</div>
                <div style={{ fontSize: 14, color: progColor, fontWeight: 700, ...mono }}>{rec.program}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", ...mono, marginBottom: 3 }}>CONFIDENCE</div>
                <div style={{ fontSize: 14, color: rec.confidence >= 90 ? C.green : C.gold, fontWeight: 700, ...mono }}>{rec.confidence}%</div>
              </div>
            </div>
          </div>

          {/* ── C. IDENTITY LINE ──────────────────────────────────── */}
          <div style={{
            padding: "14px 20px",
            background: `${PURPLE}06`,
            border: `1px solid ${PURPLE}15`,
            borderRadius: 8,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 14, color: C.cream, lineHeight: 1.7, ...mono, fontStyle: "italic" }}>
              "You are the professional in this conversation.
            </div>
            <div style={{ fontSize: 14, color: C.cream, lineHeight: 1.7, ...mono, fontStyle: "italic" }}>
              They are looking for clarity — not deciding your value."
            </div>
          </div>

          {/* ── D. ELITE FRAME ────────────────────────────────────── */}
          <div style={{
            display: "flex", flexDirection: "column", gap: 0,
          }}>
            {/* Header */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: PURPLE, letterSpacing: 3, textTransform: "uppercase", ...mono, fontWeight: 700 }}>
                ELITE FRAME
              </div>
            </div>

            {/* SCRIPT — PRIMARY, shown first visually for instant scan */}
            <div style={{
              background: C.panel,
              border: `1px solid ${PURPLE}35`,
              borderLeft: `3px solid ${PURPLE}`,
              borderRadius: 8,
              padding: "18px 22px",
              marginBottom: 14,
              boxShadow: `0 2px 16px ${PURPLE}08`,
            }}>
              <div style={{
                fontSize: 12, color: PURPLE, letterSpacing: 2.5, textTransform: "uppercase",
                ...mono, fontWeight: 700, marginBottom: 10,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ fontSize: 12 }}>▸</span> SCRIPT
              </div>
              <div style={{
                fontSize: 15, color: C.white, lineHeight: 1.7, ...mono,
                fontStyle: "italic", fontWeight: 500,
              }}>
                {frame.script}
              </div>
            </div>

            {/* STATE — muted, grounding */}
            <div style={{
              padding: "12px 20px",
              marginBottom: 8,
              borderRadius: 6,
              background: `${C.panel}80`,
            }}>
              <div style={{
                fontSize: 12, color: `${C.muted}aa`, letterSpacing: 2.5, textTransform: "uppercase",
                ...mono, fontWeight: 600, marginBottom: 5,
              }}>
                STATE
              </div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, ...mono }}>
                {frame.state}
              </div>
            </div>

            {/* STRATEGY — clear, direct */}
            <div style={{
              padding: "12px 20px",
              marginBottom: 8,
              borderRadius: 6,
              background: `${C.panel}80`,
            }}>
              <div style={{
                fontSize: 12, color: `${C.muted}aa`, letterSpacing: 2.5, textTransform: "uppercase",
                ...mono, fontWeight: 600, marginBottom: 5,
              }}>
                STRATEGY
              </div>
              <div style={{ fontSize: 14, color: C.cream, lineHeight: 1.6, ...mono }}>
                {frame.strategy}
              </div>
            </div>

            {/* STANDARD — gold accent, final truth */}
            <div style={{
              padding: "14px 20px",
              borderRadius: 6,
              background: `${INNER_GOLD}08`,
              borderLeft: `2px solid ${INNER_GOLD}50`,
            }}>
              <div style={{
                fontSize: 12, color: INNER_GOLD, letterSpacing: 2.5, textTransform: "uppercase",
                ...mono, fontWeight: 700, marginBottom: 5,
              }}>
                STANDARD
              </div>
              <div style={{
                fontSize: 14, color: INNER_GOLD, lineHeight: 1.5, ...mono,
                fontWeight: 600, letterSpacing: 0.3,
              }}>
                {frame.standard}
              </div>
            </div>
          </div>

          {/* ── E. OPENING LINE ────────────────────────────────────── */}
          <div style={{
            background: C.panel,
            border: `1px solid ${PURPLE}30`,
            borderRadius: 8,
            padding: "16px 20px",
            position: "relative",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: C.muted, letterSpacing: 2, textTransform: "uppercase", ...mono, fontWeight: 700 }}>
                OPENING LINE
              </div>
              <button
                onClick={handleCopy}
                style={{
                  padding: "3px 10px",
                  background: copied ? `${C.green}18` : `${PURPLE}12`,
                  border: `1px solid ${copied ? `${C.green}40` : `${PURPLE}30`}`,
                  borderRadius: 4,
                  color: copied ? C.green : PURPLE,
                  fontSize: 12, fontWeight: 600, letterSpacing: 0.8,
                  cursor: "pointer", ...mono, transition: "all 0.2s",
                }}
              >
                {copied ? "COPIED" : "COPY"}
              </button>
            </div>
            <div style={{
              fontSize: 14, color: C.white, lineHeight: 1.7, ...mono,
              fontStyle: "italic",
            }}>
              "{openingLine}"
            </div>
          </div>

          {/* ── F. QUICK TRIGGERS ──────────────────────────────────── */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { key: "default", label: "Default" },
              { key: "objection", label: "Objection" },
              { key: "control", label: "Stay in control" },
              { key: "confidence", label: "Confidence" },
              { key: "close", label: "Close strong" },
              { key: "distrust", label: "Distrust" },
              { key: "voicemail", label: "Voicemail" },
              { key: "pricing", label: "Price push" },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTrigger(t.key)}
                style={{
                  padding: "5px 12px",
                  background: trigger === t.key ? `${PURPLE}18` : `${PURPLE}06`,
                  border: `1px solid ${trigger === t.key ? `${PURPLE}50` : `${PURPLE}18`}`,
                  borderRadius: 5,
                  color: trigger === t.key ? PURPLE : C.muted,
                  fontSize: 12, fontWeight: 600, letterSpacing: 0.6,
                  cursor: "pointer", ...mono, transition: "all 0.2s",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── G. FOOTER ───────────────────────────────────────────── */}
        <div style={{
          padding: "16px 28px",
          borderTop: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 24px", background: C.panel2,
              border: `1px solid ${C.border}`, borderRadius: 6,
              color: C.cream, fontSize: 13, fontWeight: 600,
              letterSpacing: 1, cursor: "pointer", ...mono, transition: "all 0.2s",
            }}
          >
            CLOSE
          </button>
          <button
            onClick={handleStartCall}
            style={{
              padding: "12px 32px",
              background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DIM})`,
              border: "none", borderRadius: 6,
              color: "#fff", fontSize: 14, fontWeight: 700,
              letterSpacing: 1.5, cursor: "pointer",
              ...mono, transition: "all 0.2s",
              boxShadow: `0 4px 20px ${PURPLE}30`,
            }}
          >
            START CALL
          </button>
        </div>
      </div>
    </>
  );
}

// ── AGREEMENT MODAL ─────────────────────────────────────────────────────────

function AgreementModal({ open, lead, onClose, onSend, onResend, onCancel, onSimulateSign }) {
  const [sending, setSending] = useState(false);

  useEffect(() => { setSending(false); }, [lead?.id, open]);

  if (!open || !lead) return null;

  const rec = getAiRecommendation(lead);
  const progColor = PROGRAM_COLORS[rec.program] || C.gold;
  const agr = lead.agreement;
  const isSent = agr?.status === "sent";

  const handleSend = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      onSend(lead.id, rec.program);
    }, 1200);
  };

  const handleResend = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      onResend(lead.id);
    }, 800);
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        zIndex: 1000, transition: "opacity 0.2s",
      }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 500, maxHeight: "80vh",
        background: "#0C1222",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 12, zIndex: 1001,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        animation: "flFadeUp 0.25s ease both",
        fontFamily: "'Courier New', monospace",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", letterSpacing: 0.5 }}>
              {isSent ? "AGREEMENT STATUS" : "SEND AGREEMENT"}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 3 }}>
              UPASign · Digital Enrollment
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.65)",
            fontSize: 20, cursor: "pointer", padding: 4, lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
          {/* Recipient Card */}
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, padding: "18px 20px", marginBottom: 20,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>RECIPIENT</div>
                <div style={{ fontSize: 14, color: "#FFFFFF", fontWeight: 600 }}>{lead.name}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>EMAIL</div>
                <div style={{ fontSize: 14, color: "#FFFFFF", fontWeight: 500 }}>{lead.email}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>PROGRAM</div>
                <div style={{ fontSize: 14, color: progColor, fontWeight: 700 }}>{rec.program}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>PROPERTY</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>{lead.address}, {lead.state}</div>
              </div>
            </div>
          </div>

          {/* Agreement Details */}
          <div style={{
            background: `${progColor}08`,
            border: `1px solid ${progColor}20`,
            borderRadius: 8, padding: "16px 20px", marginBottom: 20,
          }}>
            <div style={{ fontSize: 12, color: progColor, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>
              AGREEMENT CONTENTS
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, fontWeight: 500 }}>
              ✦ {rec.program} Protection Plan enrollment<br />
              ✦ Coverage for: {lead.damage}<br />
              ✦ Property: {lead.address}, {lead.state}<br />
              ✦ Digital signature via UPASign
            </div>
          </div>

          {/* Status section — when sent */}
          {isSent && (
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, padding: "16px 20px", marginBottom: 20,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 4,
                  background: C.gold, display: "inline-block",
                  boxShadow: `0 0 6px ${C.gold}60`,
                  animation: "flPulse 2s ease infinite",
                }} />
                <span style={{ fontSize: 13, color: C.gold, fontWeight: 600, letterSpacing: 0.5 }}>
                  AWAITING SIGNATURE
                </span>
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, fontWeight: 500 }}>
                Sent to {lead.email}<br />
                {agr.sentAt && <>Sent {new Date(agr.sentAt).toLocaleString()}</>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px",
          borderBottom: "none",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: isSent ? "space-between" : "flex-end",
          gap: 10,
        }}>
          {isSent ? (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => onCancel(lead.id)} style={{
                  padding: "8px 16px", background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6,
                  color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'Courier New', monospace",
                  transition: "all 0.2s",
                }}>CANCEL</button>
                <button onClick={handleResend} disabled={sending} style={{
                  padding: "8px 16px", background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${C.gold}40`, borderRadius: 6,
                  color: C.gold, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'Courier New', monospace",
                  transition: "all 0.2s",
                }}>{sending ? "SENDING..." : "RESEND"}</button>
              </div>
              {/* Demo: simulate signature */}
              <button onClick={() => onSimulateSign(lead.id)} style={{
                padding: "10px 20px",
                background: "linear-gradient(90deg, #00C896, #00E6A8)",
                border: "none", borderRadius: 8,
                color: "#002018", fontSize: 13, fontWeight: 700,
                letterSpacing: 1, cursor: "pointer",
                fontFamily: "'Courier New', monospace",
                boxShadow: "0 0 14px rgba(0,230,168,0.3)",
                transition: "all 0.2s ease",
              }}>SIMULATE SIGN ✓</button>
            </>
          ) : (
            <button onClick={handleSend} disabled={sending} style={{
              padding: "12px 32px",
              background: sending ? "rgba(0,230,168,0.5)" : "linear-gradient(90deg, #00C896, #00E6A8)",
              border: "none", borderRadius: 8,
              color: "#002018", fontSize: 14, fontWeight: 700,
              letterSpacing: 1, cursor: sending ? "default" : "pointer",
              fontFamily: "'Courier New', monospace",
              boxShadow: "0 0 14px rgba(0,230,168,0.3)",
              transition: "all 0.2s ease",
            }}>
              {sending ? "SENDING..." : "SEND AGREEMENT"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── AI VOICE CALL PANEL ─────────────────────────────────────────────────────

const CALL_OUTCOMES = [
  { key: "positive", label: "Interested — start close", color: "#00E6A8", icon: "✓" },
  { key: "callback", label: "Call back later", color: C.gold, icon: "📅" },
  { key: "noanswer", label: "No answer", color: "rgba(255,255,255,0.45)", icon: "✕" },
  { key: "declined", label: "Not interested", color: "#E05050", icon: "✕" },
];

const AI_TRANSCRIPT_LINES = [
  { speaker: "ai", text: "Hi, this is LEX calling on behalf of Unified Public Advocacy about the damage report at your property.", delay: 0 },
  { speaker: "ai", text: "We help property owners make sure their insurance claims aren't underpaid.", delay: 3000 },
  { speaker: "client", text: "Oh, okay. Yeah we had some damage from the storm.", delay: 6000 },
  { speaker: "ai", text: "I understand. Most claims in your area get underpaid by 30-40%. Our team can do a free review.", delay: 9000 },
  { speaker: "client", text: "How does that work?", delay: 13000 },
  { speaker: "ai", text: "I'll send you a secure link right now — takes 60 seconds. Your agent is standing by to walk you through it.", delay: 16000 },
  { speaker: "client", text: "Sure, go ahead.", delay: 20000 },
];

function AICallPanel({ lead, onClose, onOutcome, onTakeOver }) {
  const [callStatus, setCallStatus] = useState("idle"); // idle|dialing|ringing|connected|ended
  const [transcript, setTranscript] = useState([]);
  const [outcome, setOutcome] = useState(null);
  const [agentJoined, setAgentJoined] = useState(false);
  const timerRef = useRef(null);
  const transcriptTimers = useRef([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    setCallStatus("idle");
    setTranscript([]);
    setOutcome(null);
    setAgentJoined(false);
    return () => {
      clearTimeout(timerRef.current);
      transcriptTimers.current.forEach(t => clearTimeout(t));
    };
  }, [lead?.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript]);

  if (!lead) return null;

  const rec = getAiRecommendation(lead);
  const progColor = PROGRAM_COLORS[rec.program] || C.gold;

  const startCall = () => {
    setCallStatus("dialing");
    setTranscript([]);
    setOutcome(null);
    timerRef.current = setTimeout(() => {
      setCallStatus("ringing");
      timerRef.current = setTimeout(() => {
        setCallStatus("connected");
        // Start simulated transcript
        AI_TRANSCRIPT_LINES.forEach((line, i) => {
          const t = setTimeout(() => {
            setTranscript(prev => [...prev, { speaker: line.speaker, text: line.text, time: new Date().toLocaleTimeString() }]);
          }, line.delay);
          transcriptTimers.current.push(t);
        });
      }, 3000);
    }, 2000);
  };

  const endCall = () => {
    setCallStatus("ended");
    transcriptTimers.current.forEach(t => clearTimeout(t));
  };

  const handleOutcome = (key) => {
    setOutcome(key);
    if (onOutcome) onOutcome(lead.id, key, transcript);
  };

  const handleTakeOver = () => {
    setAgentJoined(true);
    transcriptTimers.current.forEach(t => clearTimeout(t));
    setTranscript(prev => [...prev, { speaker: "system", text: "Agent joined the call.", time: new Date().toLocaleTimeString() }]);
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        zIndex: 1000, transition: "opacity 0.2s",
      }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 520, maxHeight: "85vh",
        background: "#0C1222",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 12, zIndex: 1001,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        animation: "flFadeUp 0.25s ease both",
        fontFamily: "'Courier New', monospace",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: `1px solid ${callStatus === "connected" ? "rgba(0,230,168,0.20)" : "rgba(255,255,255,0.08)"}`,
          background: callStatus === "connected" ? "rgba(0,230,168,0.03)" : "transparent",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 4,
                  background: callStatus === "connected" ? "#00E6A8"
                    : callStatus === "dialing" || callStatus === "ringing" ? C.gold
                    : callStatus === "ended" ? "rgba(255,255,255,0.25)"
                    : "rgba(255,255,255,0.35)",
                  boxShadow: callStatus === "connected" ? "0 0 8px rgba(0,230,168,0.5)"
                    : callStatus === "dialing" || callStatus === "ringing" ? `0 0 8px ${C.gold}60` : "none",
                  animation: callStatus === "dialing" || callStatus === "ringing" || callStatus === "connected" ? "flPulse 1.5s ease infinite" : "none",
                }} />
                <span style={{
                  fontSize: 13, fontWeight: 700, letterSpacing: 1,
                  color: callStatus === "connected" ? "#00E6A8" : callStatus === "ended" ? "rgba(255,255,255,0.65)" : "#FFFFFF",
                }}>
                  {callStatus === "idle" ? "AI VOICE CALL" : callStatus === "dialing" ? "DIALING..." : callStatus === "ringing" ? "RINGING..." : callStatus === "connected" ? "CONNECTED" : "CALL ENDED"}
                </span>
              </div>
              <div style={{ fontSize: 15, color: "#FFFFFF", fontWeight: 700 }}>{lead.name}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
                {lead.phone} · {rec.program}
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "none", border: "none", color: "rgba(255,255,255,0.65)",
              fontSize: 20, cursor: "pointer", padding: 4, lineHeight: 1,
            }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {/* Pre-call: AXIS suggestion */}
          {callStatus === "idle" && (
            <div>
              <div style={{
                background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)",
                borderRadius: 8, padding: "14px 16px", marginBottom: 20,
              }}>
                <div style={{ fontSize: 11, color: PURPLE, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>AXIS</div>
                <div style={{ fontSize: 13, color: "#FFFFFF", lineHeight: 1.6, fontWeight: 500, fontStyle: "italic" }}>
                  AI will introduce the program, reference their damage at {lead.address}, and gauge interest. If positive, you can take over or trigger Assisted Close.
                </div>
              </div>
              <div style={{
                background: `${progColor}08`, border: `1px solid ${progColor}20`,
                borderRadius: 8, padding: "14px 16px", marginBottom: 20,
              }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>CALL SCRIPT</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, fontWeight: 500 }}>
                  ✦ Introduce as LEX from Unified Public Advocacy<br />
                  ✦ Reference damage: {lead.damage}<br />
                  ✦ Mention 30-40% underpayment stat<br />
                  ✦ Offer free review + enrollment link
                </div>
              </div>
              <button onClick={startCall} style={{
                width: "100%", padding: "14px 0",
                background: "linear-gradient(90deg, #00C896, #00E6A8)",
                border: "none", borderRadius: 8,
                color: "#002018", fontSize: 14, fontWeight: 700,
                letterSpacing: 1, cursor: "pointer",
                boxShadow: "0 0 14px rgba(0,230,168,0.35)",
                transition: "all 0.2s ease",
              }}>
                START AI CALL
              </button>
            </div>
          )}

          {/* Dialing / Ringing */}
          {(callStatus === "dialing" || callStatus === "ringing") && (
            <div style={{ textAlign: "center", paddingTop: 30 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 32, margin: "0 auto 16px",
                background: `${C.gold}15`, border: `1px solid ${C.gold}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28,
                animation: "flPulse 1.5s ease infinite",
              }}>
                📞
              </div>
              <div style={{ fontSize: 16, color: "#FFFFFF", fontWeight: 700, marginBottom: 4 }}>
                {callStatus === "dialing" ? "Dialing..." : "Ringing..."}
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>
                {lead.phone}
              </div>
              <button onClick={endCall} style={{
                marginTop: 24, padding: "10px 24px",
                background: "rgba(224,80,80,0.15)", border: "1px solid rgba(224,80,80,0.30)",
                borderRadius: 8, color: "#E05050", fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "'Courier New', monospace",
                transition: "all 0.2s",
              }}>
                CANCEL CALL
              </button>
            </div>
          )}

          {/* Connected: live transcript */}
          {callStatus === "connected" && (
            <div>
              <div ref={scrollRef} style={{
                maxHeight: 260, overflowY: "auto",
                marginBottom: 16,
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                {transcript.map((line, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 10, alignItems: "flex-start",
                    animation: "flFadeUp 0.2s ease both",
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                      color: line.speaker === "ai" ? PURPLE : line.speaker === "client" ? "#00E6A8" : C.gold,
                      minWidth: 42,
                      paddingTop: 2,
                    }}>
                      {line.speaker === "ai" ? "LEX" : line.speaker === "client" ? "CLIENT" : "SYSTEM"}
                    </span>
                    <span style={{
                      fontSize: 13, color: "#FFFFFF", lineHeight: 1.5, fontWeight: 500,
                    }}>
                      {line.text}
                    </span>
                  </div>
                ))}
              </div>
              {/* Controls */}
              <div style={{ display: "flex", gap: 8 }}>
                {!agentJoined && (
                  <button onClick={handleTakeOver} style={{
                    flex: 1, padding: "10px 0",
                    background: "rgba(168,85,247,0.10)", border: `1px solid ${PURPLE}35`,
                    borderRadius: 8, color: PURPLE, fontSize: 12, fontWeight: 700,
                    letterSpacing: 1, cursor: "pointer", fontFamily: "'Courier New', monospace",
                    transition: "all 0.2s",
                  }}>
                    JOIN CALL
                  </button>
                )}
                <button onClick={endCall} style={{
                  flex: 1, padding: "10px 0",
                  background: "rgba(224,80,80,0.10)", border: "1px solid rgba(224,80,80,0.25)",
                  borderRadius: 8, color: "#E05050", fontSize: 12, fontWeight: 700,
                  letterSpacing: 1, cursor: "pointer", fontFamily: "'Courier New', monospace",
                  transition: "all 0.2s",
                }}>
                  END CALL
                </button>
              </div>
            </div>
          )}

          {/* Ended: outcome selection */}
          {callStatus === "ended" && !outcome && (
            <div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 14, fontWeight: 600 }}>
                CALL OUTCOME
              </div>
              {transcript.length > 0 && (
                <div style={{
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8, padding: "12px 16px", marginBottom: 16,
                  maxHeight: 120, overflowY: "auto",
                }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>SUMMARY</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.5, fontWeight: 500 }}>
                    {transcript.length} exchanges · {agentJoined ? "Agent joined" : "AI handled"} · {lead.name}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {CALL_OUTCOMES.map(o => (
                  <button
                    key={o.key}
                    onClick={() => handleOutcome(o.key)}
                    style={{
                      padding: "12px 16px",
                      background: `${o.color}08`,
                      border: `1px solid ${o.color}25`,
                      borderRadius: 8,
                      color: o.color, fontSize: 13, fontWeight: 600,
                      cursor: "pointer", fontFamily: "'Courier New', monospace",
                      textAlign: "left",
                      transition: "all 0.2s",
                      display: "flex", alignItems: "center", gap: 10,
                    }}
                  >
                    <span>{o.icon}</span> {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Outcome logged */}
          {callStatus === "ended" && outcome && (
            <div style={{ textAlign: "center", paddingTop: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 28, margin: "0 auto 16px",
                background: outcome === "positive" ? "rgba(0,230,168,0.12)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${outcome === "positive" ? "rgba(0,230,168,0.3)" : "rgba(255,255,255,0.10)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, color: outcome === "positive" ? "#00E6A8" : "rgba(255,255,255,0.45)",
              }}>
                {outcome === "positive" ? "✓" : outcome === "callback" ? "📅" : "✕"}
              </div>
              <div style={{ fontSize: 15, color: "#FFFFFF", fontWeight: 700, marginBottom: 6 }}>
                {outcome === "positive" ? "POSITIVE RESPONSE" : outcome === "callback" ? "CALLBACK SCHEDULED" : outcome === "noanswer" ? "NO ANSWER" : "NOT INTERESTED"}
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, fontWeight: 500, marginBottom: 20 }}>
                {outcome === "positive" ? "Client is interested. Open Assisted Close to send the enrollment link now."
                  : outcome === "callback" ? "Call back logged. Follow-up sequence continues."
                  : outcome === "noanswer" ? "No answer logged. Follow-up sequence continues automatically."
                  : "Declined. Lead remains in pipeline for future outreach."}
              </div>
              {outcome === "positive" && (
                <button onClick={() => { onTakeOver(lead.id); onClose(); }} style={{
                  width: "100%", padding: "12px 0",
                  background: "linear-gradient(90deg, #00C896, #00E6A8)",
                  border: "none", borderRadius: 8,
                  color: "#002018", fontSize: 14, fontWeight: 700,
                  letterSpacing: 1, cursor: "pointer",
                  boxShadow: "0 0 14px rgba(0,230,168,0.3)",
                  transition: "all 0.2s ease",
                  fontFamily: "'Courier New', monospace",
                }}>
                  ⚡ OPEN ASSISTED CLOSE
                </button>
              )}
              {outcome !== "positive" && (
                <button onClick={onClose} style={{
                  width: "100%", padding: "10px 0",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 8, color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'Courier New', monospace",
                  transition: "all 0.2s",
                }}>
                  CLOSE
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── ASSISTED CLOSE PANEL ────────────────────────────────────────────────────

const CLOSE_COACHING = {
  idle: {
    script: "\"I'm going to send you a secure link right now — it'll come to your phone and email.\"",
    tip: "Confirm their phone number before sending.",
  },
  linkSent: {
    script: "\"I just sent the link — you should see it on your phone now. Go ahead and tap it.\"",
    tip: "If they don't see it: \"Check your text messages — it's from our secure enrollment system.\"",
    nudge: "\"Sometimes it takes a moment. Check your texts — do you see a message from us?\"",
  },
  linkOpened: {
    script: "\"Perfect, you should see the enrollment form. I'll stay on the line and walk you through it.\"",
    tip: "Let them read. Don't rush. Silence is fine.",
    nudge: "\"Take your time reading through it — I'm right here if you have any questions.\"",
  },
  formStarted: {
    script: "\"You're almost there — just the payment info and signature left.\"",
    tip: "If they hesitate on payment: \"This locks in your rate. You can cancel anytime in the first 30 days.\"",
    nudge: "\"Any questions on what you're seeing? Happy to clarify anything.\"",
  },
  paymentEntered: {
    script: "\"Last step — just tap the signature box at the bottom and you're all set.\"",
    tip: "Don't add new information. Let them finish.",
    nudge: "\"Just the signature left — tap the box at the bottom of the screen.\"",
  },
  signed: {
    script: "\"You're all set. Your coverage is now active. I'll send you a confirmation email shortly.\"",
    tip: "Congratulate them. Confirm next steps.",
  },
};

// Demo timing: how long each stage takes to auto-advance (ms)
const STAGE_TIMINGS = { sent: 5000, opened: 6000, form: 7000, payment: 5000 };
// Nudge threshold: show nudge prompt after this % of the stage timing
const NUDGE_THRESHOLD = 0.6;

// ── DEAL RECOVERY ───────────────────────────────────────────────────────────
// Demo: 1 "recovery minute" = 3 real seconds so the sequence plays out visibly

const RECOVERY_TICK = 3000;

const RECOVERY_MESSAGES = {
  opened: [
    { delayTicks: 2, label: "5-min nudge", msg: (n) => `Just making sure the link opened for you ${n.split(" ")[0]} 👍 Let me know if you need anything.` },
    { delayTicks: 6, label: "1-hour follow-up", msg: (n) => `Hi ${n.split(" ")[0]}, wanted to follow up — the enrollment link is still ready for you whenever you are.` },
    { delayTicks: 12, label: "Next-day follow-up", msg: (n) => `${n.split(" ")[0]}, your enrollment link is still active. Just takes 60 seconds to complete. Any questions?` },
  ],
  form: [
    { delayTicks: 2, label: "5-min nudge", msg: (n) => `Hey ${n.split(" ")[0]}, looks like you started the form — you're almost done! Just finish the last step.` },
    { delayTicks: 6, label: "1-hour follow-up", msg: (n) => `Hi ${n.split(" ")[0]}, you're 80% through the enrollment. Just payment info and signature left.` },
    { delayTicks: 12, label: "Next-day follow-up", msg: (n) => `${n.split(" ")[0]}, your enrollment is waiting right where you left off. Takes under 60 seconds to finish.` },
  ],
  payment: [
    { delayTicks: 2, label: "5-min nudge", msg: (n) => `You're right there ${n.split(" ")[0]} — just hit submit and you're covered! 🎯` },
    { delayTicks: 5, label: "30-min follow-up", msg: (n) => `Hi ${n.split(" ")[0]}, one last tap and your coverage is active. The link is still open.` },
    { delayTicks: 10, label: "Next-day follow-up", msg: (n) => `${n.split(" ")[0]}, your enrollment is 95% complete. Just the final submit left whenever you're ready.` },
  ],
};

function AssistedClosePanel({ lead, onClose, onSendLink, onMarkConverted }) {
  const [linkStatus, setLinkStatus] = useState("idle");
  const [stageStartTime, setStageStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [showNudge, setShowNudge] = useState(false);
  const timerRef = useRef(null);
  const elapsedRef = useRef(null);

  useEffect(() => {
    if (lead?.liveClose) {
      setLinkStatus(lead.liveClose.status || "idle");
    } else {
      setLinkStatus("idle");
    }
    return () => { clearTimeout(timerRef.current); clearInterval(elapsedRef.current); };
  }, [lead?.id, lead?.liveClose?.status]);

  // Track elapsed time per stage + nudge detection
  useEffect(() => {
    if (linkStatus !== "idle" && linkStatus !== "signed") {
      setStageStartTime(Date.now());
      setShowNudge(false);
      setElapsed(0);
      elapsedRef.current = setInterval(() => {
        const e = Math.floor((Date.now() - Date.now()) / 1000); // will be recalculated below
        setElapsed(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(elapsedRef.current);
      setElapsed(0);
    }
    return () => clearInterval(elapsedRef.current);
  }, [linkStatus]);

  // Nudge trigger
  useEffect(() => {
    const timing = STAGE_TIMINGS[linkStatus];
    if (timing && elapsed * 1000 > timing * NUDGE_THRESHOLD) {
      setShowNudge(true);
    }
  }, [elapsed, linkStatus]);

  // Demo: simulate client progress — updates lead state so recovery engine can track
  useEffect(() => {
    const timing = STAGE_TIMINGS[linkStatus];
    if (timing) {
      timerRef.current = setTimeout(() => {
        const next = linkStatus === "sent" ? "opened" : linkStatus === "opened" ? "form" : linkStatus === "form" ? "payment" : "signed";
        setLinkStatus(next);
        if (onSendLink) onSendLink(lead.id, next);
      }, timing);
    }
    return () => clearTimeout(timerRef.current);
  }, [linkStatus]);

  if (!lead) return null;

  const rec = getAiRecommendation(lead);
  const progColor = PROGRAM_COLORS[rec.program] || C.gold;
  const prog = { "We The People": { price: "$19–$99/mo", start: "$19" }, LandlordShield: { price: "$49–$249/mo", start: "$49" }, "Business Shield": { price: "$79–$399/mo", start: "$79" } }[rec.program] || { price: "$19–$99/mo", start: "$19" };

  const STAGES = [
    { key: "sent", label: "Link Sent", icon: "📱" },
    { key: "opened", label: "Link Opened", icon: "👁" },
    { key: "form", label: "Form Started", icon: "📝" },
    { key: "payment", label: "Payment Entered", icon: "💳" },
    { key: "signed", label: "Signed", icon: "✓" },
  ];
  const stageIdx = STAGES.findIndex(s => s.key === linkStatus);

  const handleSendLink = () => {
    setLinkStatus("sent");
    if (onSendLink) onSendLink(lead.id, "sent");
  };

  const handleComplete = () => {
    onMarkConverted(lead.id);
    onClose();
  };

  const coachingKey = linkStatus === "form" ? "formStarted" : linkStatus === "payment" ? "paymentEntered" : linkStatus === "sent" ? "linkSent" : linkStatus === "opened" ? "linkOpened" : linkStatus === "signed" ? "signed" : "idle";

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: 380,
      background: "linear-gradient(180deg, #111926 0%, #0D1420 100%)",
      borderLeft: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "-8px 0 32px rgba(0,0,0,0.4)",
      zIndex: 800,
      display: "flex", flexDirection: "column",
      fontFamily: "'Courier New', monospace",
      animation: "flFadeUp 0.25s ease both",
    }}>
      {/* Header */}
      <div style={{
        padding: "20px 24px 16px",
        borderBottom: "1px solid rgba(0,230,168,0.15)",
        background: "rgba(0,230,168,0.03)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4,
                background: linkStatus === "signed" ? "#00E6A8" : linkStatus === "idle" ? "rgba(255,255,255,0.35)" : "#00E6A8",
                boxShadow: linkStatus !== "idle" && linkStatus !== "signed" ? "0 0 8px rgba(0,230,168,0.5)" : "none",
                animation: linkStatus !== "idle" && linkStatus !== "signed" ? "flPulse 1.5s ease infinite" : "none",
              }} />
              <span style={{ fontSize: 13, color: "#00E6A8", letterSpacing: 1, fontWeight: 700 }}>
                ASSISTED CLOSE
              </span>
            </div>
            <div style={{ fontSize: 15, color: "#FFFFFF", fontWeight: 700 }}>{lead.name}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
              {rec.program} · {prog.price}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.65)",
            fontSize: 20, cursor: "pointer", padding: 4, lineHeight: 1,
          }}>✕</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {/* Plan Summary */}
        <div style={{
          background: `${progColor}08`, border: `1px solid ${progColor}20`,
          borderRadius: 8, padding: "14px 16px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 14, color: progColor, fontWeight: 700, marginBottom: 6 }}>{rec.program}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, fontWeight: 500 }}>
            ✦ Starting at {prog.start}/month<br />
            ✦ Coverage: {lead.damage}<br />
            ✦ {rec.confidence}% confidence match
          </div>
        </div>

        {/* AXIS Coaching Prompt */}
        {(() => {
          const coaching = CLOSE_COACHING[coachingKey];
          return (
            <div style={{
              background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)",
              borderRadius: 8, padding: "14px 16px", marginBottom: 20,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: PURPLE, fontWeight: 700, letterSpacing: 1 }}>AXIS</span>
                  {linkStatus !== "idle" && linkStatus !== "signed" && (
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>
                      {elapsed}s
                    </span>
                  )}
                </div>
                {linkStatus !== "idle" && linkStatus !== "signed" && (
                  <span style={{
                    width: 6, height: 6, borderRadius: 3, background: PURPLE,
                    animation: "flPulse 1.5s ease infinite",
                  }} />
                )}
              </div>
              <div style={{ fontSize: 13, color: "#FFFFFF", lineHeight: 1.6, fontWeight: 500, fontStyle: "italic" }}>
                {showNudge && coaching.nudge ? coaching.nudge : coaching.script}
              </div>
              {coaching.tip && (
                <div style={{
                  marginTop: 8, paddingTop: 8,
                  borderTop: "1px solid rgba(168,85,247,0.10)",
                  fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5, fontWeight: 500,
                }}>
                  {coaching.tip}
                </div>
              )}
            </div>
          );
        })()}

        {/* Send Link or Progress */}
        {linkStatus === "idle" ? (
          <div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>
              SEND SECURE LINK
            </div>
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, padding: "14px 16px", marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, fontWeight: 500 }}>
                Sends a mobile-friendly link to:<br />
                <span style={{ color: "#FFFFFF" }}>📱 {lead.phone}</span><br />
                <span style={{ color: "#FFFFFF" }}>📧 {lead.email}</span>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 8, fontWeight: 500 }}>
                Link includes: plan selection, payment form, digital signature
              </div>
            </div>
            <button onClick={handleSendLink} style={{
              width: "100%", padding: "14px 0",
              background: "linear-gradient(90deg, #00C896, #00E6A8)",
              border: "none", borderRadius: 8,
              color: "#002018", fontSize: 14, fontWeight: 700,
              letterSpacing: 1, cursor: "pointer",
              boxShadow: "0 0 14px rgba(0,230,168,0.35)",
              transition: "all 0.2s ease",
            }}>
              SEND SECURE LINK
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 14, fontWeight: 600 }}>
              {linkStatus === "signed" ? "COMPLETED" : "LIVE STATUS"}
            </div>
            {/* Progress tracker */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {STAGES.map((s, i) => {
                const done = i <= stageIdx;
                const active = i === stageIdx;
                const future = i > stageIdx;
                return (
                  <div key={s.key} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 28 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 14,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: active ? 14 : 12,
                        background: done ? (s.key === "signed" ? "#00E6A8" : "rgba(0,230,168,0.15)") : "rgba(255,255,255,0.04)",
                        color: done ? (s.key === "signed" ? "#002018" : "#00E6A8") : "rgba(255,255,255,0.25)",
                        border: active ? "1px solid rgba(0,230,168,0.4)" : "1px solid transparent",
                        boxShadow: active ? "0 0 10px rgba(0,230,168,0.2)" : "none",
                        transition: "all 0.3s ease",
                      }}>
                        {done ? (s.key === "signed" ? "✓" : s.icon) : s.icon}
                      </div>
                      {i < STAGES.length - 1 && (
                        <div style={{
                          width: 2, height: 20,
                          background: done && !future ? "rgba(0,230,168,0.25)" : "rgba(255,255,255,0.06)",
                          transition: "all 0.3s ease",
                        }} />
                      )}
                    </div>
                    <div style={{
                      paddingTop: 5,
                      fontSize: 13,
                      color: active ? "#FFFFFF" : done ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.25)",
                      fontWeight: active ? 700 : 500,
                      transition: "all 0.3s ease",
                    }}>
                      {s.label}
                      {active && linkStatus !== "signed" && (
                        <>
                          <span style={{
                            display: "inline-block", marginLeft: 8,
                            width: 6, height: 6, borderRadius: 3,
                            background: "#00E6A8", verticalAlign: "middle",
                            animation: "flPulse 1.5s ease infinite",
                          }} />
                          <span style={{
                            marginLeft: 6, fontSize: 11,
                            color: showNudge ? C.gold : "rgba(255,255,255,0.35)",
                            fontWeight: 500,
                          }}>
                            {elapsed}s
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Completion */}
            {linkStatus === "signed" && (
              <div style={{ marginTop: 20 }}>
                <div style={{
                  padding: "14px 16px", textAlign: "center",
                  background: "rgba(0,230,168,0.08)",
                  border: "1px solid rgba(0,230,168,0.20)",
                  borderRadius: 8,
                  fontSize: 14, color: "#00E6A8", fontWeight: 700,
                  marginBottom: 12,
                }}>
                  ✓ ENROLLMENT COMPLETE
                </div>
                {!lead.converted && (
                  <button onClick={handleComplete} style={{
                    width: "100%", padding: "12px 0",
                    background: "linear-gradient(90deg, #00C896, #00E6A8)",
                    border: "none", borderRadius: 8,
                    color: "#002018", fontSize: 14, fontWeight: 700,
                    letterSpacing: 1, cursor: "pointer",
                    boxShadow: "0 0 14px rgba(0,230,168,0.3)",
                    transition: "all 0.2s ease",
                  }}>
                    MARK AS CONVERTED
                  </button>
                )}
              </div>
            )}

            {/* Deal Recovery Status */}
            {lead.liveClose?.recovery && linkStatus !== "signed" && (
              <div style={{
                marginTop: 16,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, padding: "14px 16px",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: lead.liveClose.recovery.log.length > 0 ? 10 : 0,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: 3,
                      background: lead.liveClose.recovery.paused ? C.gold : "#A855F7",
                      animation: lead.liveClose.recovery.paused ? "none" : "flPulse 2s ease infinite",
                    }} />
                    <span style={{
                      fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
                      color: lead.liveClose.recovery.paused ? C.gold : "#A855F7",
                    }}>
                      {lead.liveClose.recovery.paused ? "RECOVERY PAUSED" : "RECOVERY ACTIVE"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => {
                        const paused = lead.liveClose.recovery.paused;
                        onSendLink && onSendLink(lead.id, linkStatus);
                        // Toggle pause by updating liveClose directly
                        if (lead.liveClose?.recovery) {
                          lead.liveClose.recovery.paused = !paused;
                          if (!paused) lead.liveClose.recovery.pausedAt = Date.now();
                          else lead.liveClose.recovery.startedAt += (Date.now() - (lead.liveClose.recovery.pausedAt || Date.now()));
                        }
                      }}
                      style={{
                        padding: "2px 8px", background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.10)", borderRadius: 4,
                        color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: 600,
                        cursor: "pointer", fontFamily: "'Courier New', monospace",
                      }}
                    >
                      {lead.liveClose.recovery.paused ? "RESUME" : "PAUSE"}
                    </button>
                    <button
                      onClick={() => {
                        if (lead.liveClose) lead.liveClose.recovery = null;
                        onSendLink && onSendLink(lead.id, linkStatus);
                      }}
                      style={{
                        padding: "2px 8px", background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.10)", borderRadius: 4,
                        color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 600,
                        cursor: "pointer", fontFamily: "'Courier New', monospace",
                      }}
                    >
                      STOP
                    </button>
                  </div>
                </div>
                {/* Recovery log */}
                {lead.liveClose.recovery.log.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {lead.liveClose.recovery.log.map((entry, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "flex-start", gap: 8,
                        padding: "6px 10px",
                        background: "rgba(168,85,247,0.04)",
                        border: "1px solid rgba(168,85,247,0.10)",
                        borderRadius: 5,
                      }}>
                        <span style={{ fontSize: 12, color: "#00E6A8", flexShrink: 0 }}>✓</span>
                        <div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 600, marginBottom: 2 }}>
                            {entry.label}
                          </div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.4, fontWeight: 500 }}>
                            {entry.msg}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Next recovery message preview */}
                {(() => {
                  const msgs = RECOVERY_MESSAGES[linkStatus];
                  const sentCount = lead.liveClose.recovery.sentCount || 0;
                  if (!msgs || sentCount >= msgs.length || lead.liveClose.recovery.paused) return null;
                  const next = msgs[sentCount];
                  return (
                    <div style={{
                      marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 500,
                    }}>
                      Next: {next.label}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Stay on call reminder */}
            {linkStatus !== "signed" && !lead.liveClose?.recovery?.log?.length && (
              <div style={{
                marginTop: 16, padding: "10px 14px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6,
                fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 500, lineHeight: 1.5,
              }}>
                Stay on the line. Guide them through each step. Silence is okay — they're reading.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── DEAL FLOW PANEL ─────────────────────────────────────────────────────────

function DealFlowPanel({ lead, onClose, onOutreach, onConvert, onMarkConverted, onUpdateLead, onOpenAgreement }) {
  const [step, setStep] = useState(1);

  // Derive step from lead state
  useEffect(() => {
    if (lead) {
      if (lead.converted) setStep(5);
      else if (lead.agreement?.status === "sent") setStep(4);
      else if (lead.responded === "yes") setStep(4);
      else if (lead.outreach) setStep(3);
      else setStep(1);
    }
  }, [lead?.id, lead?.outreach, lead?.responded, lead?.agreement?.status, lead?.converted]);

  if (!lead) return null;

  const rec = getAiRecommendation(lead);
  const script = getSalesScript(lead);
  const progColor = PROGRAM_COLORS[rec.program] || C.gold;

  const STEPS = [
    { num: 1, label: "Review Script" },
    { num: 2, label: "Start Outreach" },
    { num: 3, label: "Client Response" },
    { num: 4, label: "Send Agreement" },
    { num: 5, label: "Converted" },
  ];

  const handleOutreach = () => {
    onOutreach(lead.id, { sms: true, email: true, voice: false });
  };

  const handleResponse = (answer) => {
    onUpdateLead(lead.id, { responded: answer });
  };

  const handleOpenAgreement = () => {
    if (onOpenAgreement) onOpenAgreement(lead);
  };

  const handleMarkConverted = () => {
    onMarkConverted(lead.id);
    onClose();
  };

  const stepDone = (n) => n < step || (n === step && n === 5 && lead.converted);
  const stepActive = (n) => n === step;

  return (
    <div style={{
      position: "fixed",
      top: 0, right: 0, bottom: 0,
      width: 360,
      background: "linear-gradient(180deg, #111926 0%, #0D1420 100%)",
      borderLeft: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "-8px 0 32px rgba(0,0,0,0.4)",
      zIndex: 800,
      display: "flex", flexDirection: "column",
      fontFamily: "'Courier New', monospace",
      animation: "flFadeUp 0.25s ease both",
    }}>
      {/* Header */}
      <div style={{
        padding: "20px 24px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, color: "#00E6A8", letterSpacing: 1, fontWeight: 700, marginBottom: 4 }}>
              FIRST DEAL FLOW
            </div>
            <div style={{ fontSize: 15, color: "#FFFFFF", fontWeight: 700 }}>
              {lead.name}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
              {rec.program} · {rec.confidence}%
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: "rgba(255,255,255,0.65)",
              fontSize: 20, cursor: "pointer", padding: 4, lineHeight: 1,
            }}
          >✕</button>
        </div>
      </div>

      {/* Step Indicator */}
      <div style={{
        padding: "16px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column", gap: 0,
      }}>
        {STEPS.map((s, i) => (
          <div key={s.num} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 24 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
                background: stepDone(s.num)
                  ? "#00E6A8"
                  : stepActive(s.num)
                  ? "rgba(0,230,168,0.15)"
                  : "rgba(255,255,255,0.06)",
                color: stepDone(s.num)
                  ? "#002018"
                  : stepActive(s.num)
                  ? "#00E6A8"
                  : "rgba(255,255,255,0.35)",
                border: stepActive(s.num) ? "1px solid rgba(0,230,168,0.4)" : "1px solid transparent",
                transition: "all 0.2s ease",
              }}>
                {stepDone(s.num) ? "✓" : s.num}
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  width: 1, height: 14,
                  background: stepDone(s.num) ? "rgba(0,230,168,0.3)" : "rgba(255,255,255,0.08)",
                  transition: "all 0.2s ease",
                }} />
              )}
            </div>
            <div style={{
              fontSize: 13,
              color: stepActive(s.num) ? "#FFFFFF" : stepDone(s.num) ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.35)",
              fontWeight: stepActive(s.num) ? 600 : 500,
              paddingTop: 3,
              transition: "all 0.2s ease",
            }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

        {/* Step 1: Review Script */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>
              YOUR SCRIPT
            </div>
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              padding: "16px 18px",
              marginBottom: 20,
            }}>
              {script.split("\n\n").map((para, i) => (
                <p key={i} style={{
                  fontSize: 13, color: "#FFFFFF", lineHeight: 1.7,
                  margin: i === 0 ? 0 : "12px 0 0 0", fontWeight: 500,
                }}>
                  {para}
                </p>
              ))}
            </div>
            <div style={{
              padding: "12px 16px",
              background: `${progColor}10`,
              border: `1px solid ${progColor}25`,
              borderRadius: 6,
              marginBottom: 20,
            }}>
              <div style={{ fontSize: 12, color: progColor, fontWeight: 600, marginBottom: 4 }}>
                KEY POINTS
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, fontWeight: 500 }}>
                ✦ {lead.source} · {lead.damage}<br />
                ✦ {rec.confidence}% confidence match<br />
                ✦ {rec.reason.split(",")[0]}
              </div>
            </div>
            <button
              onClick={() => setStep(2)}
              style={{
                width: "100%", padding: "12px 0",
                background: "linear-gradient(90deg, #00C896, #00E6A8)",
                border: "none", borderRadius: 8,
                color: "#002018", fontSize: 14, fontWeight: 700,
                letterSpacing: 1, cursor: "pointer",
                boxShadow: "0 0 14px rgba(0,230,168,0.3)",
                transition: "all 0.2s ease",
              }}
            >
              READY → START OUTREACH
            </button>
          </div>
        )}

        {/* Step 2: Start Outreach */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>
              LAUNCH OUTREACH
            </div>
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              padding: "16px 18px",
              marginBottom: 16,
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              {[
                { icon: "📱", label: "SMS to " + lead.phone, active: true },
                { icon: "📧", label: "Email to " + lead.email, active: true },
              ].map((ch, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px",
                  background: "rgba(0,230,168,0.06)",
                  border: "1px solid rgba(0,230,168,0.15)",
                  borderRadius: 6,
                }}>
                  <span style={{ fontSize: 16 }}>{ch.icon}</span>
                  <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 500 }}>{ch.label}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "#00E6A8", fontWeight: 600 }}>READY</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleOutreach}
              style={{
                width: "100%", padding: "12px 0",
                background: "linear-gradient(90deg, #00C896, #00E6A8)",
                border: "none", borderRadius: 8,
                color: "#002018", fontSize: 14, fontWeight: 700,
                letterSpacing: 1, cursor: "pointer",
                boxShadow: "0 0 14px rgba(0,230,168,0.3)",
                transition: "all 0.2s ease",
              }}
            >
              SEND NOW
            </button>
            <button
              onClick={() => setStep(1)}
              style={{
                width: "100%", padding: "10px 0", marginTop: 8,
                background: "none", border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 8, color: "rgba(255,255,255,0.65)",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              ← BACK TO SCRIPT
            </button>
          </div>
        )}

        {/* Step 3: Client Response */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>
              CLIENT RESPONSE
            </div>
            <div style={{
              padding: "16px 18px",
              background: "rgba(0,230,168,0.06)",
              border: "1px solid rgba(0,230,168,0.15)",
              borderRadius: 8,
              marginBottom: 12,
              fontSize: 13, color: "#00E6A8", fontWeight: 600,
            }}>
              ✓ Outreach sent via SMS + Email
            </div>

            {/* Live follow-up status */}
            {lead.followUp && !lead.followUp.paused && (
              <div style={{
                padding: "12px 16px",
                background: "rgba(168,85,247,0.06)",
                border: "1px solid rgba(168,85,247,0.15)",
                borderRadius: 8,
                marginBottom: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: 3,
                    background: "#A855F7", display: "inline-block",
                    animation: "flPulse 2s ease infinite",
                  }} />
                  <span style={{ fontSize: 12, color: "#A855F7", fontWeight: 600, letterSpacing: 0.5, ...mono }}>
                    FOLLOW-UP ACTIVE — DAY {FOLLOWUP_SEQUENCE[lead.followUp.currentStep]?.day || 0}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 3 }}>
                  {FOLLOWUP_SEQUENCE.map((s, idx) => (
                    <div key={idx} style={{
                      flex: 1, height: 3, borderRadius: 2,
                      background: idx <= lead.followUp.currentStep ? "#A855F7" : "rgba(255,255,255,0.08)",
                      transition: "all 0.4s ease",
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 6, ...mono, fontWeight: 500 }}>
                  ✓ {lead.followUp.log[lead.followUp.log.length - 1]?.label} sent
                  {lead.followUp.currentStep < FOLLOWUP_SEQUENCE.length - 1 && (
                    <span style={{ color: "rgba(255,255,255,0.35)" }}> · next auto-send: Day {FOLLOWUP_SEQUENCE[lead.followUp.currentStep + 1]?.day}</span>
                  )}
                </div>
              </div>
            )}
            {lead.followUp && lead.followUp.paused && (
              <div style={{
                padding: "12px 16px",
                background: "rgba(201,168,76,0.06)",
                border: "1px solid rgba(201,168,76,0.15)",
                borderRadius: 8,
                marginBottom: 12,
                fontSize: 12, color: C.gold, fontWeight: 600, ...mono,
              }}>
                ⏸ Follow-up paused
              </div>
            )}

            <div style={{ fontSize: 14, color: "#FFFFFF", fontWeight: 600, marginBottom: 16 }}>
              Did the client respond?
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => handleResponse("yes")}
                style={{
                  flex: 1, padding: "14px 0",
                  background: lead.responded === "yes" ? "#00E6A8" : "rgba(0,230,168,0.08)",
                  border: lead.responded === "yes" ? "none" : "1px solid rgba(0,230,168,0.25)",
                  borderRadius: 8,
                  color: lead.responded === "yes" ? "#002018" : "#00E6A8",
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                YES
              </button>
              <button
                onClick={() => handleResponse("no")}
                style={{
                  flex: 1, padding: "14px 0",
                  background: lead.responded === "no" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 8,
                  color: lead.responded === "no" ? "#FFFFFF" : "rgba(255,255,255,0.65)",
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                NOT YET
              </button>
            </div>
            {lead.responded === "no" && (
              <div style={{
                marginTop: 16, padding: "14px 16px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, fontWeight: 500,
              }}>
                Follow up in 24 hours. AXIS will remind you. The first outreach rarely closes — persistence is the system.
              </div>
            )}
          </div>
        )}

        {/* Step 4: Send Agreement */}
        {step === 4 && (
          <div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>
              SEND AGREEMENT
            </div>
            <div style={{
              padding: "16px 18px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              marginBottom: 20,
            }}>
              <div style={{ fontSize: 14, color: "#FFFFFF", fontWeight: 600, marginBottom: 8 }}>
                {rec.program} — Protection Plan
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, fontWeight: 500 }}>
                Send enrollment agreement to <span style={{ color: "#FFFFFF" }}>{lead.name}</span> via UPASign.
              </div>
              <div style={{
                marginTop: 12, display: "flex", alignItems: "center", gap: 8,
                fontSize: 13, color: progColor, fontWeight: 600,
              }}>
                <span>📄</span> {lead.email}
              </div>
            </div>
            {!lead.agreement ? (
              <button
                onClick={handleOpenAgreement}
                style={{
                  width: "100%", padding: "12px 0",
                  background: "linear-gradient(90deg, #00C896, #00E6A8)",
                  border: "none", borderRadius: 8,
                  color: "#002018", fontSize: 14, fontWeight: 700,
                  letterSpacing: 1, cursor: "pointer",
                  boxShadow: "0 0 14px rgba(0,230,168,0.3)",
                  transition: "all 0.2s ease",
                }}
              >
                REVIEW & SEND AGREEMENT
              </button>
            ) : (
              <div>
                <div style={{
                  padding: "12px 16px",
                  background: "rgba(201,168,76,0.08)",
                  border: `1px solid ${C.gold}25`,
                  borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: 4, background: C.gold,
                      boxShadow: `0 0 6px ${C.gold}60`,
                      animation: "flPulse 2s ease infinite",
                    }} />
                    <span style={{ fontSize: 13, color: C.gold, fontWeight: 600 }}>
                      Awaiting signature
                    </span>
                  </div>
                  <button onClick={handleOpenAgreement} style={{
                    padding: "3px 10px", background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${C.gold}30`, borderRadius: 4,
                    color: C.gold, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    fontFamily: "'Courier New', monospace", transition: "all 0.2s",
                  }}>VIEW</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Converted */}
        {step === 5 && (
          <div style={{ textAlign: "center", paddingTop: 20 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 28, margin: "0 auto 16px",
              background: "rgba(0,230,168,0.12)",
              border: "1px solid rgba(0,230,168,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, color: "#00E6A8",
            }}>
              ✓
            </div>
            <div style={{ fontSize: 16, color: "#FFFFFF", fontWeight: 700, marginBottom: 6 }}>
              DEAL CLOSED
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, fontWeight: 500, marginBottom: 24 }}>
              {lead.name} enrolled in {rec.program}
            </div>
            {!lead.converted && (
              <button
                onClick={handleMarkConverted}
                style={{
                  width: "100%", padding: "12px 0",
                  background: "linear-gradient(90deg, #00C896, #00E6A8)",
                  border: "none", borderRadius: 8,
                  color: "#002018", fontSize: 14, fontWeight: 700,
                  letterSpacing: 1, cursor: "pointer",
                  boxShadow: "0 0 14px rgba(0,230,168,0.3)",
                  transition: "all 0.2s ease",
                }}
              >
                MARK AS CONVERTED
              </button>
            )}
            {lead.converted && (
              <div style={{
                fontSize: 13, color: "#00E6A8", fontWeight: 600,
              }}>
                ✓ Lead converted successfully
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function FireLeads() {
  const [leads, setLeads] = useState(INITIAL_LEADS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPrefill, setDrawerPrefill] = useState(null);
  const [convertingLeadId, setConvertingLeadId] = useState(null);
  const [scriptLead, setScriptLead] = useState(null);
  const [outreachLead, setOutreachLead] = useState(null);
  const [preCallLead, setPreCallLead] = useState(null);
  const [dealFlowLeadId, setDealFlowLeadId] = useState(null);
  const [agreementLeadId, setAgreementLeadId] = useState(null);
  const [assistedCloseLeadId, setAssistedCloseLeadId] = useState(null);
  const [aiCallLeadId, setAiCallLeadId] = useState(null);
  const [dncStatus, setDncStatus] = useState({}); // { [leadId]: "clear" | "flagged" | "checking" }
  const [filter, setFilter] = useState("all"); // "all" | "action" | "followup" | "converted"
  const [stateFilter, setStateFilter] = useState("all"); // "all" | "primary" | "expansion"
  const [mounted, setMounted] = useState(false);
  const { setLiveContext, territory, getLeadTerritory, getAdjuster } = useAxisContext();

  useEffect(() => { setMounted(true); }, []);

  // ── FOLLOW-UP ENGINE ────────────────────────────────────────────────────
  // Runs on an interval, checks each lead's followUp state, advances sequence
  useEffect(() => {
    const timer = setInterval(() => {
      setLeads(prev => prev.map(lead => {
        if (!lead.followUp || lead.followUp.paused || lead.converted) return lead;

        const elapsed = Date.now() - lead.followUp.startedAt;
        const currentStep = lead.followUp.currentStep;

        // Find next step that should fire
        const nextIdx = currentStep + 1;
        if (nextIdx >= FOLLOWUP_SEQUENCE.length) return lead; // sequence complete

        const nextStep = FOLLOWUP_SEQUENCE[nextIdx];
        const nextFireAt = nextStep.day * DEMO_DAY_MS;

        if (elapsed >= nextFireAt) {
          return {
            ...lead,
            followUp: {
              ...lead.followUp,
              currentStep: nextIdx,
              log: [
                ...lead.followUp.log,
                { step: nextIdx, label: nextStep.label, sentAt: Date.now() },
              ],
            },
          };
        }
        return lead;
      }));
    }, 2000); // check every 2s

    return () => clearInterval(timer);
  }, []);

  // ── DEAL RECOVERY ENGINE ──────────────────────────────────────────────────
  // Detects stalled assisted close stages, auto-sends recovery messages
  useEffect(() => {
    const timer = setInterval(() => {
      setLeads(prev => prev.map(lead => {
        if (!lead.liveClose || lead.converted) return lead;
        const st = lead.liveClose.status;
        if (st === "signed" || st === "idle" || st === "sent") return lead;

        const msgs = RECOVERY_MESSAGES[st];
        if (!msgs) return lead;

        const recovery = lead.liveClose.recovery || { startedAt: Date.now(), sentCount: 0, log: [], paused: false };
        if (recovery.paused) return lead;
        if (recovery.sentCount >= msgs.length) return lead; // sequence complete

        const elapsedTicks = Math.floor((Date.now() - recovery.startedAt) / RECOVERY_TICK);
        const nextMsg = msgs[recovery.sentCount];
        if (elapsedTicks >= nextMsg.delayTicks) {
          return {
            ...lead,
            liveClose: {
              ...lead.liveClose,
              recovery: {
                ...recovery,
                sentCount: recovery.sentCount + 1,
                log: [...recovery.log, { label: nextMsg.label, sentAt: Date.now(), msg: nextMsg.msg(lead.name) }],
              },
            },
          };
        }
        return lead;
      }));
    }, RECOVERY_TICK);
    return () => clearInterval(timer);
  }, []);

  // Auto-start follow-up when outreach is launched
  const startFollowUp = useCallback((leadId) => {
    setLeads(prev => prev.map(l => {
      if (l.id !== leadId) return l;
      return {
        ...l,
        followUp: {
          startedAt: Date.now(),
          currentStep: 0,
          paused: false,
          log: [{ step: 0, label: FOLLOWUP_SEQUENCE[0].label, sentAt: Date.now() }],
        },
        status: l.converted ? l.status : "In Follow-Up",
      };
    }));
  }, []);

  const toggleFollowUpPause = useCallback((leadId) => {
    setLeads(prev => prev.map(l => {
      if (l.id !== leadId || !l.followUp) return l;
      const wasPaused = l.followUp.paused;
      return {
        ...l,
        followUp: {
          ...l.followUp,
          paused: !wasPaused,
          // Shift startedAt forward by pause duration to preserve timing
          startedAt: wasPaused
            ? l.followUp.startedAt + (Date.now() - (l.followUp.pausedAt || Date.now()))
            : l.followUp.startedAt,
          pausedAt: wasPaused ? null : Date.now(),
        },
      };
    }));
  }, []);

  const stopFollowUp = useCallback((leadId) => {
    setLeads(prev => prev.map(l => {
      if (l.id !== leadId) return l;
      return {
        ...l,
        followUp: null,
        status: l.converted ? l.status : l.outreach ? "Outreach Active" : "Contacted",
      };
    }));
  }, []);

  // Update AXIS Live context when modals/leads change
  const updateLiveContext = useCallback((lead, extras = {}) => {
    if (lead) {
      const rec = getAiRecommendation(lead);
      setLiveContext(prev => ({
        ...prev,
        activeLead: lead.name,
        confidence: rec.confidence,
        outreachActive: !!lead.outreach,
        preCallUsed: !!lead.preCallUsed,
        ...extras,
      }));
    } else {
      setLiveContext(prev => ({ ...prev, activeLead: null, confidence: 0, outreachActive: false, preCallUsed: false }));
    }
  }, [setLiveContext]);

  // Sync context with active modals / deal flow
  useEffect(() => {
    const activeLead = preCallLead || scriptLead || outreachLead;
    if (activeLead) {
      updateLiveContext(activeLead);
    } else if (dealFlowLeadId) {
      const lead = leads.find(l => l.id === dealFlowLeadId);
      if (lead) updateLiveContext(lead);
    } else if (convertingLeadId) {
      const lead = leads.find(l => l.id === convertingLeadId);
      if (lead) updateLiveContext(lead);
    } else {
      updateLiveContext(null);
    }
  }, [preCallLead, scriptLead, outreachLead, dealFlowLeadId, convertingLeadId, leads, updateLiveContext]);

  const kpis = getKpis(leads);

  const openConvert = (lead) => {
    setConvertingLeadId(lead.id);
    setDrawerPrefill({
      fullName: lead.name,
      phone: lead.phone,
      email: lead.email,
      address: lead.address,
      state: lead.state,
      leadType: lead.type,
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => {
      setDrawerPrefill(null);
      setConvertingLeadId(null);
    }, 350);
  };

  const handleEnroll = () => {
    if (convertingLeadId) {
      setLeads(prev => prev.map(l =>
        l.id === convertingLeadId
          ? { ...l, converted: true, status: "Converted", followUp: null }
          : l
      ));
    }
  };

  const handleStartCall = (leadId) => {
    // Future hook: track pre-call usage, mark lead as "Pre-Call Used"
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, preCallUsed: true } : l
    ));
  };

  const handleOutreachLaunch = (leadId, channels) => {
    setLeads(prev => prev.map(l => {
      if (l.id !== leadId) return l;
      const updated = { ...l };
      launchOutreach(updated, channels);
      return updated;
    }));
  };

  const handleDealFlowConvert = (leadId) => {
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, converted: true, status: "Converted", followUp: null } : l
    ));
  };

  const handleUpdateLead = useCallback((leadId, updates) => {
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, ...updates } : l
    ));
  }, []);

  const handleSendAgreement = useCallback((leadId, program) => {
    setLeads(prev => prev.map(l =>
      l.id === leadId ? {
        ...l,
        agreement: { status: "sent", sentAt: Date.now(), program },
      } : l
    ));
  }, []);

  const handleResendAgreement = useCallback((leadId) => {
    setLeads(prev => prev.map(l =>
      l.id === leadId && l.agreement ? {
        ...l,
        agreement: { ...l.agreement, sentAt: Date.now() },
      } : l
    ));
  }, []);

  const handleCancelAgreement = useCallback((leadId) => {
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, agreement: null } : l
    ));
    setAgreementLeadId(null);
  }, []);

  const handleCallOutcome = useCallback((leadId, outcome, transcript) => {
    setLeads(prev => prev.map(l => {
      if (l.id !== leadId) return l;
      const callLog = { outcome, transcript: transcript?.length || 0, time: Date.now() };
      const calls = [...(l.aiCalls || []), callLog];
      if (outcome === "positive") {
        return { ...l, aiCalls: calls, responded: "yes" };
      }
      return { ...l, aiCalls: calls };
    }));
  }, []);

  const handleCallToAssistedClose = useCallback((leadId) => {
    setAiCallLeadId(null);
    setAssistedCloseLeadId(leadId);
  }, []);

  const handleLiveCloseUpdate = useCallback((leadId, status) => {
    setLeads(prev => prev.map(l => {
      if (l.id !== leadId) return l;
      if (status === "signed") {
        return { ...l, liveClose: { status: "signed" }, converted: true, status: "Converted", followUp: null };
      }
      // Start recovery tracking for stall-able stages
      const hasRecoveryMsgs = !!RECOVERY_MESSAGES[status];
      return {
        ...l,
        liveClose: {
          status,
          sentAt: l.liveClose?.sentAt || Date.now(),
          recovery: hasRecoveryMsgs ? { startedAt: Date.now(), sentCount: 0, log: [], paused: false } : null,
        },
      };
    }));
  }, []);

  const handleSimulateSign = useCallback((leadId) => {
    setLeads(prev => prev.map(l =>
      l.id === leadId ? {
        ...l,
        converted: true,
        status: "Converted",
        agreement: { ...l.agreement, status: "signed", signedAt: Date.now() },
        followUp: null,
      } : l
    ));
    setAgreementLeadId(null);
  }, []);

  // ── DNC CHECK ────────────────────────────────────────────────────────
  const handleDncCheck = useCallback((leadId) => {
    setDncStatus(prev => ({ ...prev, [leadId]: "checking" }));
    // Simulate API check — 1.2s delay, random result
    setTimeout(() => {
      const result = Math.random() > 0.2 ? "clear" : "flagged";
      setDncStatus(prev => ({ ...prev, [leadId]: result }));
    }, 1200);
  }, []);

  const dealFlowLead = dealFlowLeadId ? leads.find(l => l.id === dealFlowLeadId) : null;

  // Sync action summary + pending agreements + dashboard stats to AXIS context
  useEffect(() => {
    const actionable = leads.filter(l => getNextAction(l).priority <= 2);
    const pending = leads.filter(l => l.agreement?.status === "sent" && !l.converted);
    const converted = leads.filter(l => l.converted);
    const inFollowUp = leads.filter(l => l.followUp && !l.followUp.paused && !l.converted);
    const contacted = leads.filter(l => l.outreach);
    const summary = {
      needsAction: actionable.length,
      startOutreach: actionable.filter(l => getNextAction(l) === NEXT_ACTIONS.START_OUTREACH).length,
      sendAgreement: actionable.filter(l => getNextAction(l) === NEXT_ACTIONS.SEND_AGREEMENT).length,
      followAgreement: actionable.filter(l => getNextAction(l) === NEXT_ACTIONS.FOLLOW_AGREEMENT).length,
      converted: converted.length,
      total: leads.length,
    };
    const pendingAgreements = pending.map(l => ({
      id: l.id, name: l.name, email: l.email, phone: l.phone,
      program: l.agreement.program, sentAt: l.agreement.sentAt,
    }));
    // Actionable leads for dashboard
    const actionableLeads = actionable.map(l => {
      const rec = getAiRecommendation(l);
      const action = getNextAction(l);
      return { id: l.id, name: l.name, phone: l.phone, program: rec.program, confidence: rec.confidence, damage: l.damage, action: action.label, actionColor: action.color, priority: action.priority };
    }).sort((a, b) => a.priority - b.priority);
    // Dashboard stats
    const dashboardStats = {
      newToday: leads.filter(l => l.status === "New").length,
      contactsMade: contacted.length,
      inFollowUp: inFollowUp.length,
      agreementsSent: pending.length,
      closedDeals: converted.length,
      total: leads.length,
      conversionRate: leads.length > 0 ? Math.round((converted.length / leads.length) * 100) : 0,
      totalCalls: leads.reduce((sum, l) => sum + (l.aiCalls?.length || 0), 0),
    };
    setLiveContext(prev => ({ ...prev, actionSummary: summary, pendingAgreements, actionableLeads, dashboardStats }));
  }, [leads, setLiveContext]);

  return (
    <div style={{ maxWidth: 1200, overflowX: "auto", paddingRight: 16 }}>
      <style>{`
        @keyframes flFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes flPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .fl-card:hover {
          border-color: rgba(255,255,255,0.16) !important;
          box-shadow: 0 12px 36px rgba(0,0,0,0.55), 0 0 1px rgba(255,255,255,0.14) !important;
          transform: translateY(-2px);
        }
        .fl-convert-btn:hover {
          background: linear-gradient(90deg, #00E6A8, #00FFB8) !important;
          color: #001A12 !important;
          box-shadow: 0 0 18px rgba(0,230,168,0.5), 0 4px 16px rgba(0,0,0,0.3) !important;
          transform: translateY(-2px);
        }
        .fl-script-btn:hover {
          background: ${C.blue}30 !important;
          border-color: ${C.blue} !important;
          box-shadow: 0 0 14px rgba(42,112,208,0.3) !important;
          transform: translateY(-1px);
        }
        .fl-outreach-btn:hover {
          background: #A855F7 !important;
          color: ${C.black} !important;
          border-color: #A855F7 !important;
          box-shadow: 0 0 18px rgba(168,85,247,0.4) !important;
          transform: translateY(-1px);
        }
        .fl-precall-btn:hover {
          background: #A855F720 !important;
          border-color: #A855F7 !important;
          box-shadow: 0 0 18px rgba(168,85,247,0.3) !important;
          transform: translateY(-1px);
        }
        .fl-dnc-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.08) !important;
          border-color: rgba(255,255,255,0.25) !important;
          transform: translateY(-1px);
        }
        .fl-assist-btn:hover {
          background: rgba(0,230,168,0.15) !important;
          border-color: #00E6A8 !important;
          box-shadow: 0 0 18px rgba(0,230,168,0.3) !important;
          transform: translateY(-1px);
        }
        .fl-aicall-btn:hover {
          background: rgba(201,168,76,0.15) !important;
          border-color: ${C.gold} !important;
          box-shadow: 0 0 14px rgba(201,168,76,0.3) !important;
          transform: translateY(-1px);
        }
        input:focus, select:focus, textarea:focus {
          border-color: ${C.gold} !important;
        }
      `}</style>

      {/* Header */}
      <div style={{
        marginBottom: 32,
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(16px)",
        transition: "all 0.5s ease",
      }}>
        <h1 style={{ ...mono, fontSize: 22, color: C.white, fontWeight: 700, margin: 0, letterSpacing: 0.5 }}>
          FIRE LEADS
        </h1>
        <p style={{ color: C.muted, fontSize: 15, marginTop: 8, ...mono, lineHeight: 1.5 }}>
          Active fire and storm damage leads — convert to protection plan members
        </p>
      </div>

      {/* ── KPI BAR ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 20,
        marginBottom: 48,
      }}>
        {kpis.map((kpi, i) => {
          const kpiFilter = kpi.label === "Needs Action" ? "action"
            : kpi.label === "In Follow-Up" ? "followup"
            : kpi.label === "Converted" ? "converted"
            : null;
          const isActiveKpi = kpiFilter && filter === kpiFilter;
          return (
          <div
            key={kpi.label}
            onClick={() => kpiFilter && setFilter(f => f === kpiFilter ? "all" : kpiFilter)}
            style={{
              background: isActiveKpi ? "#1A2A42" : "#162238",
              border: isActiveKpi ? `1px solid ${kpi.color}40` : "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              boxShadow: isActiveKpi ? `0 8px 28px rgba(0,0,0,0.4), 0 0 12px ${kpi.color}20` : "0 8px 28px rgba(0,0,0,0.4)",
              padding: "26px 26px",
              animation: mounted ? `flFadeUp 0.5s ease ${i * 0.1}s both` : "none",
              cursor: kpiFilter ? "pointer" : "default",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", letterSpacing: 1.5, textTransform: "uppercase", ...mono, fontWeight: 600 }}>
              {kpi.label}
            </div>
            <div style={{ marginTop: 10 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: "#FFFFFF", ...mono, letterSpacing: 1, textShadow: `0 0 12px ${kpi.color}50` }}>
                {kpi.value}
              </span>
            </div>
          </div>
          );
        })}
      </div>

      {/* ── ACTION SUMMARY BAR ──────────────────────────────────────────────── */}
      {(() => {
        const actionable = leads.filter(l => getNextAction(l).priority <= 2);
        if (actionable.length === 0) return null;
        return (
          <div
            onClick={() => setFilter(f => f === "action" ? "all" : "action")}
            style={{
              padding: "14px 20px",
              background: filter === "action" ? "rgba(0,230,168,0.10)" : "rgba(0,230,168,0.06)",
              border: filter === "action" ? "1px solid rgba(0,230,168,0.30)" : "1px solid rgba(0,230,168,0.15)",
              borderRadius: 8,
              marginBottom: 20,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4,
                background: "#00E6A8", display: "inline-block",
                boxShadow: "0 0 8px rgba(0,230,168,0.5)",
                animation: "flPulse 2s ease infinite",
              }} />
              <span style={{ fontSize: 14, color: "#FFFFFF", fontWeight: 600, ...mono }}>
                {actionable.length} lead{actionable.length !== 1 ? "s" : ""} need{actionable.length === 1 ? "s" : ""} action
              </span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", ...mono, fontWeight: 500 }}>
                — {actionable.filter(l => getNextAction(l) === NEXT_ACTIONS.START_OUTREACH).length} outreach, {actionable.filter(l => getNextAction(l) === NEXT_ACTIONS.SEND_AGREEMENT).length} agreements, {actionable.filter(l => getNextAction(l) === NEXT_ACTIONS.FOLLOW_AGREEMENT).length} follow-ups
              </span>
            </div>
            <span style={{ fontSize: 12, color: filter === "action" ? "#00E6A8" : "rgba(255,255,255,0.35)", ...mono, fontWeight: 600 }}>
              {filter === "action" ? "SHOWING ✕" : "FILTER →"}
            </span>
          </div>
        );
      })()}

      {/* ── FILTER CHIPS ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        {[
          { key: "all", label: "All", count: leads.length },
          { key: "action", label: "Needs Action", count: leads.filter(l => getNextAction(l).priority <= 2).length, color: "#00E6A8" },
          { key: "followup", label: "In Follow-Up", count: leads.filter(l => l.followUp && !l.followUp.paused && !l.converted).length, color: "#A855F7" },
          { key: "converted", label: "Converted", count: leads.filter(l => l.converted).length, color: C.green },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: "6px 14px",
              background: filter === f.key ? (f.color ? `${f.color}15` : "rgba(255,255,255,0.08)") : "rgba(255,255,255,0.03)",
              border: `1px solid ${filter === f.key ? (f.color ? `${f.color}40` : "rgba(255,255,255,0.16)") : "rgba(255,255,255,0.08)"}`,
              borderRadius: 6,
              color: filter === f.key ? (f.color || "#FFFFFF") : "rgba(255,255,255,0.55)",
              fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
              cursor: "pointer", ...mono,
              transition: "all 0.2s ease",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {f.label}
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: filter === f.key ? (f.color || "#FFFFFF") : "rgba(255,255,255,0.35)",
            }}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── TERRITORY FILTER ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", ...mono, fontWeight: 600, marginRight: 4 }}>TERRITORY:</span>
        {[
          { key: "all", label: `All States`, count: leads.length },
          { key: "primary", label: territory.primaryState, count: leads.filter(l => getLeadTerritory(l.state) === "primary").length, color: "#00E6A8" },
          { key: "expansion", label: "Expansion", count: leads.filter(l => getLeadTerritory(l.state) === "expansion").length, color: C.gold },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setStateFilter(f.key)}
            style={{
              padding: "4px 10px",
              background: stateFilter === f.key ? (f.color ? `${f.color}12` : "rgba(255,255,255,0.06)") : "transparent",
              border: `1px solid ${stateFilter === f.key ? (f.color ? `${f.color}35` : "rgba(255,255,255,0.12)") : "rgba(255,255,255,0.06)"}`,
              borderRadius: 5,
              color: stateFilter === f.key ? (f.color || "#FFFFFF") : "rgba(255,255,255,0.45)",
              fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
              cursor: "pointer", ...mono,
              transition: "all 0.2s ease",
              display: "flex", alignItems: "center", gap: 5,
            }}
          >
            {f.label}
            <span style={{ fontSize: 10, fontWeight: 700, color: stateFilter === f.key ? (f.color || "#FFFFFF") : "rgba(255,255,255,0.25)" }}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {leads.filter(lead => {
          // Territory filter
          const terr = getLeadTerritory(lead.state);
          if (terr === "outside") return false; // never show leads outside licensed states
          if (stateFilter === "primary" && terr !== "primary") return false;
          if (stateFilter === "expansion" && terr !== "expansion") return false;
          // Status filter
          if (filter === "all") return true;
          if (filter === "action") return getNextAction(lead).priority <= 2;
          if (filter === "followup") return lead.followUp && !lead.followUp.paused && !lead.converted;
          if (filter === "converted") return lead.converted;
          return true;
        }).map((lead, i) => {
          const statusColor = STATUS_COLORS[lead.status] || C.muted;
          const rec = getAiRecommendation(lead);
          const progColor = PROGRAM_COLORS[rec.program] || C.gold;

          return (
            <div
              key={lead.id}
              className="fl-card"
              style={{
                ...glassPanel,
                padding: "24px 28px",
                display: "grid",
                gridTemplateColumns: "1fr 280px",
                minWidth: 860,
                gap: 24,
                alignItems: "start",
                transition: "all 0.2s ease",
                animation: mounted ? `flFadeUp 0.5s ease ${0.15 + i * 0.06}s both` : "none",
                position: "relative",
                outline: dealFlowLeadId === lead.id
                  ? "2px solid rgba(0,230,168,0.4)"
                  : !lead.converted ? "1px solid rgba(0,230,168,0.15)" : "none",
              }}
            >
              {/* ── Left: Lead Info ──────────────────────────────────── */}
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "center" }}>
                  {/* Col 1: Name + Contact */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 15, flexShrink: 0 }}>{TYPE_ICONS[lead.type]}</span>
                      <span
                        onClick={() => setDealFlowLeadId(lead.id)}
                        style={{
                          fontSize: 15, fontWeight: 700, color: "#FFFFFF", ...mono,
                          cursor: "pointer", borderBottom: "1px solid transparent",
                          transition: "border-color 0.2s", whiteSpace: "nowrap",
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderBottomColor = "#00E6A8"}
                        onMouseLeave={e => e.currentTarget.style.borderBottomColor = "transparent"}
                      >
                        {lead.name}
                      </span>
                      {lead.converted ? (
                        <span style={{
                          padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0,
                          background: `${C.green}18`, border: `1px solid ${C.green}40`,
                          borderRadius: 4, fontSize: 11, color: C.green,
                          letterSpacing: 1, fontWeight: 600, ...mono,
                        }}>
                          CONVERTED
                        </span>
                      ) : (() => {
                        const badge = getIntelBadge(rec.confidence);
                        return (
                          <span
                            title={badge.tooltip}
                            style={{
                              padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0,
                              background: badge.bg, border: `1px solid ${badge.border}`,
                              borderRadius: 4, fontSize: 11, color: badge.color,
                              letterSpacing: 1, fontWeight: 600, ...mono,
                              cursor: "default",
                            }}
                          >
                            {badge.label}
                          </span>
                        );
                      })()}
                      {lead.outreach && !lead.converted && (
                        <span style={{
                          padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0,
                          background: `${PURPLE}15`, border: `1px solid ${PURPLE}35`,
                          borderRadius: 4, fontSize: 11, color: PURPLE,
                          letterSpacing: 1, fontWeight: 600, ...mono,
                          animation: "flPulse 2s ease infinite",
                        }}>
                          OUTREACH
                        </span>
                      )}
                      {lead.agreement?.status === "sent" && !lead.converted && (
                        <span
                          title="Enrollment agreement sent — awaiting signature"
                          onClick={(e) => { e.stopPropagation(); setAgreementLeadId(lead.id); }}
                          style={{
                            padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0,
                            background: `${C.gold}12`, border: `1px solid ${C.gold}30`,
                            borderRadius: 4, fontSize: 11, color: C.gold,
                            letterSpacing: 1, fontWeight: 600, ...mono,
                            cursor: "pointer",
                          }}
                        >
                          AGREEMENT SENT
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", ...mono, fontWeight: 500, lineHeight: 1.8 }}>
                      {lead.phone}<br />
                      {lead.email}
                    </div>
                  </div>

                  {/* Col 2: Location + Damage + Territory */}
                  {(() => {
                    const terr = getLeadTerritory(lead.state);
                    const adjuster = terr === "expansion" ? getAdjuster(lead.state) : null;
                    const terrColor = terr === "primary" ? "#00E6A8" : terr === "expansion" ? C.gold : "rgba(255,255,255,0.35)";
                    return (
                      <div>
                        <div style={{ fontSize: 14, color: "#FFFFFF", ...mono, fontWeight: 500, marginBottom: 4 }}>
                          {lead.address}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: adjuster ? 4 : 0 }}>
                          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", ...mono, fontWeight: 500 }}>
                            {lead.state} — {lead.damage}
                          </span>
                          <span title={terr === "primary" ? "Your primary territory" : terr === "expansion" ? "Expansion territory" : "Licensed state"} style={{
                            padding: "1px 6px", borderRadius: 3,
                            background: `${terrColor}12`, border: `1px solid ${terrColor}25`,
                            fontSize: 10, color: terrColor, fontWeight: 700, letterSpacing: 0.5, ...mono,
                            cursor: "default",
                          }}>
                            {terr === "primary" ? "PRIMARY" : terr === "expansion" ? "EXPANSION" : "LICENSED"}
                          </span>
                        </div>
                        {adjuster && (
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", ...mono, fontWeight: 500 }}>
                            Servicing: {adjuster.name} · {adjuster.license}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Col 3: Source + Status + Date */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 500, marginBottom: 6 }}>
                        {lead.source}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          display: "inline-block", padding: "3px 10px",
                          borderRadius: 4, fontSize: 12, letterSpacing: 1,
                          ...mono, fontWeight: 600,
                          background: `${statusColor}18`, color: statusColor,
                          border: `1px solid ${statusColor}40`,
                        }}>
                          {lead.status.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", ...mono, fontWeight: 500 }}>{lead.date}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Next Action Badge */}
                {(() => {
                  const action = getNextAction(lead);
                  if (action === NEXT_ACTIONS.COMPLETED) return null;
                  return (
                    <div style={{
                      marginTop: 10, paddingTop: 10,
                      borderTop: `1px solid ${C.border}`,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: 4,
                        background: action.color, display: "inline-block",
                        boxShadow: `0 0 6px ${action.color}60`,
                        animation: action.priority <= 2 ? "flPulse 2s ease infinite" : "none",
                      }} />
                      <span style={{
                        fontSize: 12, color: action.color, fontWeight: 600,
                        letterSpacing: 0.5, ...mono,
                      }}>
                        NEXT: {action.label.toUpperCase()}
                      </span>
                      {action.priority <= 1 && (
                        <button
                          onClick={() => setDealFlowLeadId(lead.id)}
                          style={{
                            marginLeft: "auto", padding: "3px 10px",
                            background: `${action.color}15`,
                            border: `1px solid ${action.color}35`,
                            borderRadius: 4, color: action.color,
                            fontSize: 11, fontWeight: 700, cursor: "pointer",
                            ...mono, transition: "all 0.2s",
                          }}
                        >
                          GO →
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Outreach channel statuses */}
                {lead.outreach && (
                  <div style={{ display: "flex", gap: 10, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                    {lead.outreach.sms && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: C.green, display: "inline-block" }} />
                        <span style={{ fontSize: 12, color: C.green, ...mono, fontWeight: 600, letterSpacing: 0.5 }}>SMS Sent</span>
                      </div>
                    )}
                    {lead.outreach.email && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: C.green, display: "inline-block" }} />
                        <span style={{ fontSize: 12, color: C.green, ...mono, fontWeight: 600, letterSpacing: 0.5 }}>Email Sent</span>
                      </div>
                    )}
                    {lead.outreach.voice && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: C.gold, display: "inline-block", animation: "flPulse 1.5s ease infinite" }} />
                        <span style={{ fontSize: 12, color: C.gold, ...mono, fontWeight: 600, letterSpacing: 0.5 }}>Call Scheduled</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Follow-up sequence status */}
                {lead.followUp && !lead.converted && (
                  <div style={{
                    marginTop: lead.outreach ? 8 : 12,
                    paddingTop: lead.outreach ? 8 : 10,
                    borderTop: lead.outreach ? "none" : `1px solid ${C.border}`,
                  }}>
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      marginBottom: 8,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: 3,
                          background: lead.followUp.paused ? C.gold : "#A855F7",
                          display: "inline-block",
                          animation: lead.followUp.paused ? "none" : "flPulse 2s ease infinite",
                        }} />
                        <span style={{
                          fontSize: 12, fontWeight: 600, letterSpacing: 0.5, ...mono,
                          color: lead.followUp.paused ? C.gold : "#A855F7",
                        }}>
                          {lead.followUp.paused ? "FOLLOW-UP PAUSED" : `FOLLOW-UP DAY ${FOLLOWUP_SEQUENCE[lead.followUp.currentStep]?.day || 0}`}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFollowUpPause(lead.id); }}
                          style={{
                            padding: "2px 8px",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.10)",
                            borderRadius: 4,
                            color: "rgba(255,255,255,0.65)",
                            fontSize: 11, fontWeight: 600, cursor: "pointer", ...mono,
                            transition: "all 0.2s",
                          }}
                        >
                          {lead.followUp.paused ? "RESUME" : "PAUSE"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); stopFollowUp(lead.id); }}
                          style={{
                            padding: "2px 8px",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.10)",
                            borderRadius: 4,
                            color: "rgba(255,255,255,0.45)",
                            fontSize: 11, fontWeight: 600, cursor: "pointer", ...mono,
                            transition: "all 0.2s",
                          }}
                        >
                          STOP
                        </button>
                      </div>
                    </div>
                    {/* Step progress */}
                    <div style={{ display: "flex", gap: 4 }}>
                      {FOLLOWUP_SEQUENCE.map((s, idx) => {
                        const done = idx <= lead.followUp.currentStep;
                        const active = idx === lead.followUp.currentStep;
                        return (
                          <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                            <div style={{
                              height: 3, borderRadius: 2,
                              background: done ? "#A855F7" : "rgba(255,255,255,0.08)",
                              transition: "all 0.4s ease",
                            }} />
                            <span style={{
                              fontSize: 10,
                              color: active ? "#FFFFFF" : done ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.25)",
                              fontWeight: active ? 600 : 500, ...mono,
                            }}>
                              D{s.day}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {/* Latest action */}
                    {lead.followUp.log.length > 0 && (
                      <div style={{
                        marginTop: 6, fontSize: 12,
                        color: "rgba(255,255,255,0.65)", ...mono, fontWeight: 500,
                      }}>
                        ✓ {lead.followUp.log[lead.followUp.log.length - 1].label} sent
                        {lead.followUp.currentStep < FOLLOWUP_SEQUENCE.length - 1 && !lead.followUp.paused && (
                          <span style={{ color: "rgba(255,255,255,0.35)" }}>
                            {" "}· next: Day {FOLLOWUP_SEQUENCE[lead.followUp.currentStep + 1].day}
                          </span>
                        )}
                        {lead.followUp.currentStep >= FOLLOWUP_SEQUENCE.length - 1 && (
                          <span style={{ color: C.gold }}> · sequence complete</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Right: AI Recommendation + Actions ──────────────── */}
              <div style={{
                display: "flex", flexDirection: "column", gap: 10,
                borderLeft: `1px solid ${C.border}`,
                paddingLeft: 20, flexShrink: 0,
                minHeight: "100%",
              }}>
                {/* AI Recommendation Block */}
                {!lead.converted && (
                  <div style={{
                    background: "rgba(12, 18, 30, 0.96)",
                    border: `1px solid ${progColor}30`,
                    borderRadius: 6,
                    padding: "12px 14px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: "#FFFFFF", letterSpacing: 1.5, textTransform: "uppercase", ...mono, fontWeight: 600 }}>
                        AI RECOMMENDATION
                      </span>
                      <span style={{
                        fontSize: 14, fontWeight: 700, color: rec.confidence >= 90 ? C.green : C.gold,
                        ...mono,
                      }}>
                        {rec.confidence}%
                      </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: progColor, ...mono, marginBottom: 4 }}>
                      {rec.program}
                    </div>
                    <div style={{ fontSize: 13, color: "#FFFFFF", lineHeight: 1.5, ...mono, fontWeight: 500 }}>
                      {rec.reason}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {lead.converted ? (
                    <div style={{
                      padding: "10px 0", fontSize: 13, color: C.green,
                      ...mono, fontWeight: 600, letterSpacing: 1,
                      textAlign: "center",
                    }}>
                      ✓ ENROLLED
                    </div>
                  ) : (
                    <>
                      <button
                        className="fl-precall-btn"
                        onClick={() => setPreCallLead(lead)}
                        style={{
                          padding: "10px 16px",
                          background: lead.preCallUsed ? `${PURPLE}0c` : C.panel2,
                          border: `1px solid ${PURPLE}35`, borderRadius: 8,
                          color: PURPLE, fontSize: 12, fontWeight: 700,
                          letterSpacing: 1.2, cursor: "pointer", ...mono,
                          transition: "all 0.25s ease", whiteSpace: "nowrap",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        }}
                      >
                        <span style={{ fontSize: 13, lineHeight: 1 }}>◉</span>
                        PRE-CALL LOCK-IN
                      </button>
                      <button
                        className="fl-assist-btn"
                        onClick={() => setAssistedCloseLeadId(lead.id)}
                        style={{
                          padding: "10px 16px",
                          background: "rgba(0,230,168,0.06)",
                          border: "1px solid rgba(0,230,168,0.25)", borderRadius: 8,
                          color: "#00E6A8", fontSize: 12, fontWeight: 700,
                          letterSpacing: 1.2, cursor: "pointer", ...mono,
                          transition: "all 0.25s ease", whiteSpace: "nowrap",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        }}
                      >
                        <span style={{ fontSize: 13, lineHeight: 1 }}>⚡</span>
                        ASSISTED CLOSE
                      </button>
                      <button
                        className="fl-convert-btn"
                        onClick={() => openConvert(lead)}
                        style={{
                          padding: "12px 16px",
                          background: "linear-gradient(90deg, #00C896, #00E6A8)",
                          border: "none", borderRadius: 8,
                          color: "#002018", fontSize: 13, fontWeight: 700,
                          letterSpacing: 1, cursor: "pointer", ...mono,
                          transition: "all 0.2s ease", whiteSpace: "nowrap",
                          boxShadow: "0 0 14px rgba(0,230,168,0.35)",
                        }}
                      >
                        CONVERT TO PROTECTION PLAN
                      </button>
                      <button
                        className="fl-script-btn"
                        onClick={() => setScriptLead(lead)}
                        style={{
                          padding: "10px 16px", background: `${C.blue}14`,
                          border: `1px solid ${C.blue}40`, borderRadius: 8,
                          color: C.blue, fontSize: 12, fontWeight: 600,
                          letterSpacing: 1, cursor: "pointer", ...mono,
                          transition: "all 0.2s ease", whiteSpace: "nowrap",
                        }}
                      >
                        VIEW AI SALES SCRIPT
                      </button>
                      <button
                        className="fl-outreach-btn"
                        onClick={() => setOutreachLead(lead)}
                        style={{
                          padding: "10px 16px",
                          background: lead.outreach ? `${PURPLE}14` : "transparent",
                          border: `1px solid ${PURPLE}50`, borderRadius: 8,
                          color: PURPLE, fontSize: 12, fontWeight: 600,
                          letterSpacing: 1, cursor: "pointer", ...mono,
                          transition: "all 0.2s ease", whiteSpace: "nowrap",
                        }}
                      >
                        {lead.outreach ? "UPDATE OUTREACH" : "START AI OUTREACH"}
                      </button>
                      <button
                        className="fl-aicall-btn"
                        onClick={() => setAiCallLeadId(lead.id)}
                        style={{
                          padding: "10px 16px",
                          background: `${C.gold}08`,
                          border: `1px solid ${C.gold}25`, borderRadius: 8,
                          color: C.gold, fontSize: 12, fontWeight: 700,
                          letterSpacing: 1.2, cursor: "pointer", ...mono,
                          transition: "all 0.25s ease", whiteSpace: "nowrap",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        }}
                      >
                        <span style={{ fontSize: 13, lineHeight: 1 }}>📞</span>
                        CALL VIA AI
                      </button>
                      {/* DNC Check */}
                      {(() => {
                        const status = dncStatus[lead.id];
                        const isChecking = status === "checking";
                        const isClear = status === "clear";
                        const isFlagged = status === "flagged";
                        return (
                          <button
                            className="fl-dnc-btn"
                            onClick={() => !isChecking && handleDncCheck(lead.id)}
                            disabled={isChecking}
                            style={{
                              padding: "10px 16px",
                              background: isFlagged ? "rgba(239,68,68,0.10)" : isClear ? "rgba(0,230,168,0.06)" : "rgba(255,255,255,0.03)",
                              border: `1px solid ${isFlagged ? "rgba(239,68,68,0.40)" : isClear ? "rgba(0,230,168,0.25)" : "rgba(255,255,255,0.12)"}`,
                              borderRadius: 8,
                              color: isFlagged ? "#EF4444" : isClear ? "#00E6A8" : "rgba(255,255,255,0.65)",
                              fontSize: 12, fontWeight: 600,
                              letterSpacing: 1, cursor: isChecking ? "wait" : "pointer", ...mono,
                              transition: "all 0.2s ease", whiteSpace: "nowrap",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                              flexShrink: 0,
                            }}
                          >
                            {isChecking ? (
                              <>
                                <span style={{ animation: "flPulse 1s ease infinite", fontSize: 13, lineHeight: 1 }}>◎</span>
                                CHECKING DNC...
                              </>
                            ) : isFlagged ? (
                              <>
                                <span style={{ fontSize: 13, lineHeight: 1 }}>⛔</span>
                                DNC FLAGGED
                              </>
                            ) : isClear ? (
                              <>
                                <span style={{ fontSize: 13, lineHeight: 1 }}>✓</span>
                                DNC CLEAR
                              </>
                            ) : (
                              <>
                                <span style={{ fontSize: 13, lineHeight: 1 }}>🔍</span>
                                DNC CHECK
                              </>
                            )}
                          </button>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── ENROLLMENT DRAWER (shared) ──────────────────────────────────────── */}
      <EnrollmentDrawer
        open={drawerOpen}
        prefill={drawerPrefill}
        onClose={closeDrawer}
        onEnroll={handleEnroll}
      />

      {/* ── SALES SCRIPT MODAL ──────────────────────────────────────────────── */}
      <ScriptModal
        open={!!scriptLead}
        lead={scriptLead}
        onClose={() => setScriptLead(null)}
      />

      {/* ── OUTREACH MODAL ──────────────────────────────────────────────────── */}
      <OutreachModal
        open={!!outreachLead}
        lead={outreachLead}
        onClose={() => setOutreachLead(null)}
        onLaunch={handleOutreachLaunch}
      />

      {/* ── PRE-CALL LOCK-IN MODAL ─────────────────────────────────────────── */}
      <PreCallModal
        lead={preCallLead}
        onClose={() => setPreCallLead(null)}
        onStartCall={handleStartCall}
      />

      {/* ── DEAL FLOW PANEL ──────────────────────────────────────────────────── */}
      <DealFlowPanel
        lead={dealFlowLead}
        onClose={() => setDealFlowLeadId(null)}
        onOutreach={handleOutreachLaunch}
        onConvert={openConvert}
        onMarkConverted={handleDealFlowConvert}
        onUpdateLead={handleUpdateLead}
        onOpenAgreement={(lead) => setAgreementLeadId(lead.id)}
      />

      {/* ── AGREEMENT MODAL ──────────────────────────────────────────────────── */}
      <AgreementModal
        open={!!agreementLeadId}
        lead={agreementLeadId ? leads.find(l => l.id === agreementLeadId) : null}
        onClose={() => setAgreementLeadId(null)}
        onSend={handleSendAgreement}
        onResend={handleResendAgreement}
        onCancel={handleCancelAgreement}
        onSimulateSign={handleSimulateSign}
      />

      {/* ── AI CALL PANEL ──────────────────────────────────────────────────── */}
      <AICallPanel
        lead={aiCallLeadId ? leads.find(l => l.id === aiCallLeadId) : null}
        onClose={() => setAiCallLeadId(null)}
        onOutcome={handleCallOutcome}
        onTakeOver={handleCallToAssistedClose}
      />

      {/* ── ASSISTED CLOSE PANEL ─────────────────────────────────────────────── */}
      <AssistedClosePanel
        lead={assistedCloseLeadId ? leads.find(l => l.id === assistedCloseLeadId) : null}
        onClose={() => setAssistedCloseLeadId(null)}
        onSendLink={handleLiveCloseUpdate}
        onMarkConverted={handleDealFlowConvert}
      />
    </div>
  );
}
