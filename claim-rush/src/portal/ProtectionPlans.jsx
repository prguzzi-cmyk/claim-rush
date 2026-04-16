import { useState, useEffect } from "react";
import { C } from "./theme";
import { PROGRAMS } from "./shared/programs";
import EnrollmentDrawer from "./shared/EnrollmentDrawer";
import { useAxisContext } from "./AxisContext";

// ── MOCK DATA ────────────────────────────────────────────────────────────────

const MOCK_ENROLLMENTS = [
  { name: "Marcus Johnson", program: "We The People", tier: "Gold", agent: "Sarah Kim", amount: "$49/mo", status: "Active", date: "2026-03-28" },
  { name: "Linda Cortez", program: "LandlordShield", tier: "Pro", agent: "James Obi", amount: "$149/mo", status: "Active", date: "2026-03-27" },
  { name: "Robert Chen", program: "Business Shield", tier: "Enterprise", agent: "Sarah Kim", amount: "$399/mo", status: "Pending", date: "2026-03-26" },
  { name: "Diana Wells", program: "We The People", tier: "Standard", agent: "Marcus Lee", amount: "$19/mo", status: "Active", date: "2026-03-25" },
  { name: "Anthony Rivera", program: "LandlordShield", tier: "Standard", agent: "James Obi", amount: "$49/mo", status: "Active", date: "2026-03-24" },
  { name: "Karen Mitchell", program: "Business Shield", tier: "Pro", agent: "Marcus Lee", amount: "$199/mo", status: "Active", date: "2026-03-23" },
];

const KPIS = [
  { label: "Active Members", value: "1,247", change: "+12%", color: C.gold },
  { label: "New Members This Month", value: "89", change: "+23%", color: C.blue },
  { label: "Monthly Recurring Revenue", value: "$94,320", change: "+18%", color: C.green },
  { label: "Agent Commissions", value: "$14,148", change: "+18%", color: C.cream },
];

// ── STYLES ───────────────────────────────────────────────────────────────────

const glassPanel = {
  background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 10,
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
};

const mono = { fontFamily: "'Courier New', monospace" };

// ── MAIN PAGE ────────────────────────────────────────────────────────────────

function TerritoryBar() {
  const { territory } = useAxisContext();
  return (
    <div style={{
      padding: "14px 20px",
      background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)",
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 8,
      marginBottom: 32,
      display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      fontFamily: "'Courier New', monospace",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 600, letterSpacing: 1 }}>COVERAGE:</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: "#00E6A8" }} />
        <span style={{ fontSize: 12, color: "#00E6A8", fontWeight: 600 }}>Primary: {territory.primaryState}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: C.gold }} />
        <span style={{ fontSize: 12, color: C.gold, fontWeight: 600 }}>Expansion: {territory.expansionStates.join(", ")}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.35)" }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>
          All licensed: {territory.allLicensedStates.join(", ")}
        </span>
      </div>
    </div>
  );
}

export default function ProtectionPlans() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const openEnroll = (program) => {
    setSelectedProgram(program);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setSelectedProgram(null), 350);
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* CSS animations */}
      <style>{`
        @keyframes ppFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pp-card:hover {
          transform: translateY(-3px) !important;
          box-shadow: 0 16px 48px rgba(0,0,0,0.55), 0 0 1px rgba(255,255,255,0.16) !important;
          border-color: rgba(255,255,255,0.16) !important;
        }
        .pp-btn:hover {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 0 18px rgba(0,255,180,0.5), 0 4px 16px rgba(0,0,0,0.3) !important;
        }
        .pp-row:hover {
          background: ${C.panel2} !important;
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
          PROTECTION PLANS
        </h1>
        <p style={{ color: C.muted, fontSize: 15, marginTop: 8, ...mono, lineHeight: 1.5 }}>
          Monetization layer — convert leads into recurring monthly memberships
        </p>
      </div>

      {/* Territory Coverage */}
      <TerritoryBar />

      {/* ── KPI BAR ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 20,
        marginBottom: 48,
      }}>
        {KPIS.map((kpi, i) => (
          <div
            key={kpi.label}
            style={{
              background: "#162238",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              boxShadow: "0 8px 28px rgba(0,0,0,0.4)",
              padding: "26px 26px",
              animation: mounted ? `ppFadeUp 0.5s ease ${i * 0.1}s both` : "none",
            }}
          >
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", letterSpacing: 1.5, textTransform: "uppercase", ...mono, fontWeight: 600 }}>
              {kpi.label}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 10 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: "#FFFFFF", ...mono, letterSpacing: 1, textShadow: `0 0 12px ${kpi.color}50` }}>
                {kpi.value}
              </span>
              <span style={{ fontSize: 14, color: C.green, ...mono, fontWeight: 600 }}>
                {kpi.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── PROGRAM CARDS ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 52 }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 28, ...mono, fontWeight: 600 }}>
          PROGRAMS
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {PROGRAMS.map((prog, i) => (
            <div
              key={prog.id}
              className="pp-card"
              style={{
                ...glassPanel,
                padding: 0,
                overflow: "hidden",
                transition: "all 0.3s ease",
                animation: mounted ? `ppFadeUp 0.6s ease ${0.2 + i * 0.12}s both` : "none",
                cursor: "default",
              }}
            >
              {/* Color accent bar */}
              <div style={{
                height: 3,
                background: `linear-gradient(90deg, ${prog.color}, ${prog.color}66)`,
              }} />

              <div style={{ padding: "28px 30px 30px" }}>
                {/* Badge */}
                <div style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  background: `${prog.color}18`,
                  border: `1px solid ${prog.color}40`,
                  borderRadius: 4,
                  fontSize: 12,
                  color: prog.color,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  ...mono,
                  marginBottom: 16,
                }}>
                  {prog.audience}
                </div>

                {/* Title */}
                <div style={{ fontSize: 22, fontWeight: 700, color: C.white, ...mono, letterSpacing: 1, marginBottom: 4 }}>
                  {prog.name}
                </div>
                <div style={{ fontSize: 14, color: C.muted, ...mono, marginBottom: 6 }}>
                  {prog.subtitle}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: prog.color, ...mono, marginBottom: 22, textShadow: `0 0 12px ${prog.color}25` }}>
                  {prog.price}
                </div>

                {/* Benefits */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
                  {prog.benefits.map(b => (
                    <div key={b} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ color: prog.color, fontSize: 14, marginTop: 1, flexShrink: 0 }}>✦</span>
                      <span style={{ fontSize: 14, color: C.cream, lineHeight: 1.6, ...mono }}>{b}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button
                  className="pp-btn"
                  onClick={() => openEnroll(prog)}
                  style={{
                    width: "100%",
                    padding: "14px 0",
                    background: `linear-gradient(90deg, ${prog.color}, ${prog.color}cc)`,
                    color: C.black,
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 14,
                    letterSpacing: 1.5,
                    cursor: "pointer",
                    ...mono,
                    transition: "all 0.2s ease",
                    boxShadow: `0 0 14px ${prog.color}30`,
                  }}
                >
                  ENROLL MEMBER
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RECENT ENROLLMENTS TABLE ────────────────────────────────────────── */}
      <div style={{
        ...glassPanel,
        padding: 0,
        overflow: "hidden",
        animation: mounted ? "ppFadeUp 0.7s ease 0.5s both" : "none",
      }}>
        <div style={{
          padding: "20px 28px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600 }}>
            RECENT ENROLLMENTS
          </div>
          <div style={{ fontSize: 14, color: C.muted, ...mono }}>
            {MOCK_ENROLLMENTS.length} records
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Name", "Program", "Tier", "Agent", "Monthly Amount", "Status", "Date"].map(h => (
                <th key={h} style={{
                  textAlign: "left",
                  padding: "14px 20px",
                  fontSize: 12,
                  color: C.muted,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  borderBottom: `1px solid ${C.border}`,
                  ...mono,
                  fontWeight: 600,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_ENROLLMENTS.map((row, i) => (
              <tr key={i} className="pp-row" style={{ transition: "background 0.15s" }}>
                <td style={{ padding: "14px 20px", fontSize: 14, color: C.white, ...mono, fontWeight: 600 }}>
                  {row.name}
                </td>
                <td style={{ padding: "14px 20px", fontSize: 14, color: C.cream, ...mono }}>
                  {row.program}
                </td>
                <td style={{ padding: "14px 20px", fontSize: 14, color: C.muted, ...mono }}>
                  {row.tier}
                </td>
                <td style={{ padding: "14px 20px", fontSize: 14, color: C.muted, ...mono }}>
                  {row.agent}
                </td>
                <td style={{ padding: "14px 20px", fontSize: 14, color: C.green, ...mono, fontWeight: 600 }}>
                  {row.amount}
                </td>
                <td style={{ padding: "14px 20px" }}>
                  <span style={{
                    display: "inline-block",
                    padding: "3px 10px",
                    borderRadius: 4,
                    fontSize: 12,
                    letterSpacing: 1,
                    ...mono,
                    fontWeight: 600,
                    background: row.status === "Active" ? `${C.green}18` : `${C.gold}18`,
                    color: row.status === "Active" ? C.green : C.gold,
                    border: `1px solid ${row.status === "Active" ? C.green : C.gold}40`,
                  }}>
                    {row.status.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: "14px 20px", fontSize: 14, color: C.muted, ...mono }}>
                  {row.date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── ENROLLMENT DRAWER ───────────────────────────────────────────────── */}
      <EnrollmentDrawer
        open={drawerOpen}
        program={selectedProgram}
        onClose={closeDrawer}
      />
    </div>
  );
}
