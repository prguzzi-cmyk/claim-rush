import { useState, useEffect } from "react";
import { C } from "./theme";
// NOTE: Route-level protection via RequireRole in App.jsx.
// home_office sees all territories. CP sees only their assigned territories.
// Server-side: GET /api/territories must filter by user.role and user.territory_ids.

const mono = { fontFamily: "'Courier New', monospace" };
const PURPLE = "#A855F7";

// ── MOCK DATA ───────────────────────────────────────────────────────────────

const TERRITORIES = [
  { code: "FL", name: "Florida", cp: "Sarah Kim", rvps: 2, agents: 8, licensingRev: 14000, productionRev: 28400, collected: 13200, pastDue: 800, walletCredits: 375, commPaid: 4200, growth: 18, health: 92 },
  { code: "TX", name: "Texas", cp: "James Obi", rvps: 3, agents: 12, licensingRev: 20000, productionRev: 34200, collected: 18500, pastDue: 1500, walletCredits: 150, commPaid: 5800, growth: 14, health: 85 },
  { code: "GA", name: "Georgia", cp: "Marcus Lee", rvps: 1, agents: 4, licensingRev: 5000, productionRev: 9800, collected: 4800, pastDue: 200, walletCredits: 0, commPaid: 1400, growth: 22, health: 78 },
  { code: "CA", name: "California", cp: "Sarah Kim", rvps: 3, agents: 14, licensingRev: 23000, productionRev: 41000, collected: 21500, pastDue: 1500, walletCredits: 200, commPaid: 7200, growth: 12, health: 88 },
  { code: "LA", name: "Louisiana", cp: "James Obi", rvps: 1, agents: 3, licensingRev: 4500, productionRev: 6200, collected: 4200, pastDue: 300, walletCredits: 75, commPaid: 980, growth: 8, health: 65 },
  { code: "AZ", name: "Arizona", cp: "Marcus Lee", rvps: 1, agents: 5, licensingRev: 6500, productionRev: 11200, collected: 6000, pastDue: 500, walletCredits: 0, commPaid: 1800, growth: 15, health: 74 },
  { code: "CO", name: "Colorado", cp: "Marcus Lee", rvps: 1, agents: 3, licensingRev: 4500, productionRev: 7800, collected: 4500, pastDue: 0, walletCredits: 0, commPaid: 1200, growth: 10, health: 70 },
  { code: "NC", name: "N. Carolina", cp: "Alex Chen", rvps: 1, agents: 4, licensingRev: 5000, productionRev: 8400, collected: 4600, pastDue: 400, walletCredits: 50, commPaid: 1100, growth: 20, health: 76 },
  { code: "TN", name: "Tennessee", cp: "Nina Patel", rvps: 2, agents: 6, licensingRev: 9000, productionRev: 14600, collected: 8400, pastDue: 600, walletCredits: 200, commPaid: 2400, growth: 16, health: 80 },
  { code: "AL", name: "Alabama", cp: "James Obi", rvps: 0, agents: 2, licensingRev: 2000, productionRev: 3200, collected: 1800, pastDue: 200, walletCredits: 0, commPaid: 480, growth: 4, health: 45 },
  { code: "NV", name: "Nevada", cp: null, rvps: 0, agents: 0, licensingRev: 0, productionRev: 0, collected: 0, pastDue: 0, walletCredits: 0, commPaid: 0, growth: 0, health: 0 },
  { code: "SC", name: "S. Carolina", cp: null, rvps: 0, agents: 0, licensingRev: 0, productionRev: 0, collected: 0, pastDue: 0, walletCredits: 0, commPaid: 0, growth: 0, health: 0 },
];

const CP_DATA = [
  { name: "Sarah Kim", territories: ["FL", "CA"], fee: 2000, rvps: 5, agents: 22, licensingOverrides: 625, productionOverrides: 1840, totalEarnings: 2465, health: 90, status: "active" },
  { name: "James Obi", territories: ["TX", "LA", "AL"], fee: 2000, rvps: 4, agents: 17, licensingOverrides: 480, productionOverrides: 1320, totalEarnings: 1800, health: 72, status: "active" },
  { name: "Marcus Lee", territories: ["GA", "AZ", "CO"], fee: 2000, rvps: 3, agents: 12, licensingOverrides: 340, productionOverrides: 980, totalEarnings: 1320, health: 74, status: "active" },
  { name: "Alex Chen", territories: ["NC"], fee: 2000, rvps: 1, agents: 4, licensingOverrides: 120, productionOverrides: 420, totalEarnings: 540, health: 76, status: "active" },
  { name: "Nina Patel", territories: ["TN"], fee: 2000, rvps: 2, agents: 6, licensingOverrides: 200, productionOverrides: 580, totalEarnings: 780, health: 80, status: "active" },
];

function healthColor(h) {
  if (h >= 80) return "#00E6A8";
  if (h >= 60) return C.gold;
  if (h > 0) return "#E05050";
  return "rgba(255,255,255,0.25)";
}

function healthLabel(h) {
  if (h >= 80) return "Strong";
  if (h >= 60) return "Developing";
  if (h > 0) return "Weak";
  return "Inactive";
}

// ── COMPONENT ───────────────────────────────────────────────────────────────

export default function TerritoryRevenue() {
  const [mounted, setMounted] = useState(false);
  const [detailCode, setDetailCode] = useState(null);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("licensingRev");
  const [sortDir, setSortDir] = useState(-1);
  const [mapMode, setMapMode] = useState("combined"); // licensing|production|combined|health

  useEffect(() => { setMounted(true); }, []);

  const active = TERRITORIES.filter(t => t.health > 0);
  const underperforming = TERRITORIES.filter(t => t.health > 0 && t.health < 60);
  const totalLicensing = TERRITORIES.reduce((s, t) => s + t.licensingRev, 0);
  const totalProduction = TERRITORIES.reduce((s, t) => s + t.productionRev, 0);
  const totalRetained = TERRITORIES.reduce((s, t) => s + (t.collected - t.commPaid), 0);

  const filtered = TERRITORIES.filter(t => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.code.toLowerCase().includes(search.toLowerCase()) && !(t.cp || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol];
    if (typeof av === "number") return (av - bv) * sortDir;
    return String(av || "").localeCompare(String(bv || "")) * sortDir;
  });

  const doSort = (col) => { if (sortCol === col) setSortDir(d => -d); else { setSortCol(col); setSortDir(-1); } };
  const detail = detailCode ? TERRITORIES.find(t => t.code === detailCode) : null;

  // Map: simple grid of state cells
  const mapValue = (t) => mapMode === "licensing" ? t.licensingRev : mapMode === "production" ? t.productionRev : mapMode === "health" ? t.health : t.licensingRev + t.productionRev;
  const maxMapVal = Math.max(...TERRITORIES.map(t => mapValue(t)), 1);

  return (
    <div style={{ maxWidth: 1300, opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)", transition: "all 0.5s ease" }}>
      <style>{`@keyframes trFade { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ ...mono, fontSize: 22, color: C.white, fontWeight: 700, margin: 0, letterSpacing: 0.5 }}>TERRITORY REVENUE COMMAND CENTER</h1>
        <p style={{ color: C.muted, fontSize: 14, marginTop: 6, ...mono }}>Track revenue, billing, recruiting, production, and profitability across all territories.</p>
      </div>

      {/* National KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Revenue", value: `$${(totalLicensing + totalProduction).toLocaleString()}`, color: "#FFFFFF" },
          { label: "Licensing Rev", value: `$${totalLicensing.toLocaleString()}`, color: PURPLE },
          { label: "Production Rev", value: `$${totalProduction.toLocaleString()}`, color: "#00E6A8" },
          { label: "Company Retained", value: `$${totalRetained.toLocaleString()}`, color: "#00E6A8" },
          { label: "Active Territories", value: active.length, color: C.gold },
          { label: "Underperforming", value: underperforming.length, color: underperforming.length > 0 ? "#E05050" : "rgba(255,255,255,0.45)" },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: "#162238", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600 }}>{kpi.label}</div>
            <div style={{ fontSize: 22, color: "#FFFFFF", fontWeight: 700, ...mono, marginTop: 4, textShadow: `0 0 10px ${kpi.color}40` }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Territory Map */}
      <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", padding: "20px 24px", marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, ...mono, letterSpacing: 1 }}>TERRITORY MAP</span>
          <div style={{ display: "flex", gap: 0 }}>
            {[
              { key: "combined", label: "Combined" },
              { key: "licensing", label: "Licensing" },
              { key: "production", label: "Production" },
              { key: "health", label: "Health" },
            ].map((m, i) => (
              <button key={m.key} onClick={() => setMapMode(m.key)} style={{
                padding: "5px 14px",
                background: mapMode === m.key ? `${PURPLE}15` : "rgba(255,255,255,0.03)",
                border: `1px solid ${mapMode === m.key ? `${PURPLE}40` : "rgba(255,255,255,0.08)"}`,
                borderRadius: i === 0 ? "5px 0 0 5px" : i === 3 ? "0 5px 5px 0" : "0",
                borderLeft: i > 0 ? "none" : undefined,
                color: mapMode === m.key ? PURPLE : "rgba(255,255,255,0.55)",
                fontSize: 11, fontWeight: 700, cursor: "pointer", ...mono,
              }}>{m.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
          {TERRITORIES.map(t => {
            const val = mapValue(t);
            const pct = maxMapVal > 0 ? val / maxMapVal : 0;
            const bg = mapMode === "health"
              ? `${healthColor(t.health)}${Math.round(pct * 30 + 8).toString(16).padStart(2, "0")}`
              : `rgba(0,230,168,${(pct * 0.3 + 0.04).toFixed(2)})`;
            const borderC = mapMode === "health" ? `${healthColor(t.health)}35` : `rgba(0,230,168,${(pct * 0.3 + 0.08).toFixed(2)})`;
            return (
              <div key={t.code} onClick={() => setDetailCode(t.code)} style={{
                padding: "12px 10px", textAlign: "center", background: bg,
                border: `1px solid ${borderC}`, borderRadius: 8, cursor: "pointer",
                transition: "all 0.2s",
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.3)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ fontSize: 16, color: "#FFFFFF", fontWeight: 700, ...mono }}>{t.code}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", ...mono, fontWeight: 500, marginTop: 2 }}>
                  {mapMode === "health" ? `${t.health}%` : `$${(val / 1000).toFixed(0)}k`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: detailCode ? "1fr 360px" : "1fr", gap: 20, marginBottom: 24 }}>
        <div>
          {/* Territory table */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search territory or CP..." style={{ padding: "6px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: "#FFFFFF", fontSize: 12, ...mono, outline: "none", width: 220 }} />
            <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.35)", ...mono }}>{filtered.length} territories</span>
          </div>

          <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 950 }}>
                <thead>
                  <tr>
                    {[
                      { key: "code", label: "Territory" }, { key: "cp", label: "CP" },
                      { key: "rvps", label: "RVPs" }, { key: "agents", label: "Agents" },
                      { key: "licensingRev", label: "Licensing" }, { key: "productionRev", label: "Production" },
                      { key: "collected", label: "Collected" }, { key: "pastDue", label: "Past Due" },
                      { key: "growth", label: "Growth" }, { key: "health", label: "Health" },
                    ].map(col => (
                      <th key={col.key} onClick={() => doSort(col.key)} style={{
                        textAlign: "left", padding: "10px 12px", fontSize: 10,
                        color: sortCol === col.key ? "#FFFFFF" : "rgba(255,255,255,0.45)",
                        letterSpacing: 1, textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)",
                        ...mono, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                      }}>{col.label}{sortCol === col.key ? (sortDir === 1 ? " ▲" : " ▼") : ""}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.code} onClick={() => setDetailCode(t.code)} style={{
                      cursor: "pointer", transition: "background 0.15s",
                      background: detailCode === t.code ? `${PURPLE}08` : "transparent",
                    }}
                      onMouseEnter={e => { if (detailCode !== t.code) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                      onMouseLeave={e => { if (detailCode !== t.code) e.currentTarget.style.background = "transparent"; }}>
                      <td style={{ padding: "10px 12px", fontSize: 14, color: "#FFFFFF", ...mono, fontWeight: 700 }}>{t.code}</td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: t.cp ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.25)", ...mono, fontWeight: 500 }}>{t.cp || "—"}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{t.rvps}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{t.agents}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: PURPLE, ...mono, fontWeight: 600 }}>${t.licensingRev.toLocaleString()}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "#00E6A8", ...mono, fontWeight: 600 }}>${t.productionRev.toLocaleString()}</td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "rgba(255,255,255,0.65)", ...mono }}>${t.collected.toLocaleString()}</td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: t.pastDue > 0 ? "#E05050" : "rgba(255,255,255,0.25)", ...mono, fontWeight: t.pastDue > 0 ? 600 : 500 }}>{t.pastDue > 0 ? `$${t.pastDue}` : "—"}</td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: t.growth >= 15 ? "#00E6A8" : t.growth > 0 ? C.gold : "rgba(255,255,255,0.25)", ...mono, fontWeight: 600 }}>{t.growth > 0 ? `+${t.growth}%` : "—"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
                            <div style={{ width: `${t.health}%`, height: "100%", borderRadius: 2, background: healthColor(t.health), transition: "width 0.4s" }} />
                          </div>
                          <span style={{ fontSize: 11, color: healthColor(t.health), ...mono, fontWeight: 600 }}>{t.health || "—"}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ranked panels */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 20 }}>
            {[
              { title: "Top Revenue", data: [...active].sort((a, b) => (b.licensingRev + b.productionRev) - (a.licensingRev + a.productionRev)).slice(0, 3), fmt: t => `$${((t.licensingRev + t.productionRev) / 1000).toFixed(0)}k`, color: "#00E6A8" },
              { title: "Fastest Growing", data: [...active].sort((a, b) => b.growth - a.growth).slice(0, 3), fmt: t => `+${t.growth}%`, color: C.gold },
              { title: "Most Past Due", data: [...TERRITORIES].filter(t => t.pastDue > 0).sort((a, b) => b.pastDue - a.pastDue).slice(0, 3), fmt: t => `$${t.pastDue.toLocaleString()}`, color: "#E05050" },
            ].map(panel => (
              <div key={panel.title} style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600, marginBottom: 10 }}>{panel.title}</div>
                {panel.data.map((t, i) => (
                  <div key={t.code} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", ...mono, fontWeight: 700, width: 16 }}>{i + 1}</span>
                      <span style={{ fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{t.code}</span>
                    </div>
                    <span style={{ fontSize: 13, color: panel.color, ...mono, fontWeight: 700 }}>{panel.fmt(t)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* CP performance */}
          <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.4)", marginTop: 20 }}>
            <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: "#00E6A8" }} />
              <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, ...mono, letterSpacing: 1 }}>CP PERFORMANCE</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["CP", "Territories", "RVPs", "Agents", "License Ovr", "Prod Ovr", "Total", "Health"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)", ...mono, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CP_DATA.map(cp => (
                    <tr key={cp.name} style={{ transition: "background 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{cp.name}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "rgba(255,255,255,0.65)", ...mono }}>{cp.territories.join(", ")}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{cp.rvps}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 600 }}>{cp.agents}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: PURPLE, ...mono, fontWeight: 600 }}>${cp.licensingOverrides}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "#00E6A8", ...mono, fontWeight: 600 }}>${cp.productionOverrides}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: "#FFFFFF", ...mono, fontWeight: 700 }}>${cp.totalEarnings.toLocaleString()}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
                            <div style={{ width: `${cp.health}%`, height: "100%", borderRadius: 2, background: healthColor(cp.health) }} />
                          </div>
                          <span style={{ fontSize: 11, color: healthColor(cp.health), ...mono, fontWeight: 600 }}>{cp.health}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Detail drawer */}
        {detail && (
          <div style={{ background: "linear-gradient(180deg, #151D2E 0%, #111826 100%)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", position: "sticky", top: 24, alignSelf: "start", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 16, color: "#FFFFFF", fontWeight: 700, ...mono }}>{detail.code} — {detail.name}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", ...mono, marginTop: 2 }}>{detail.cp || "Unassigned"}</div>
              </div>
              <button onClick={() => setDetailCode(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              {/* Health */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", ...mono, fontWeight: 600 }}>TERRITORY HEALTH</span>
                  <span style={{ fontSize: 14, color: healthColor(detail.health), ...mono, fontWeight: 700 }}>{detail.health}% — {healthLabel(detail.health)}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
                  <div style={{ width: `${detail.health}%`, height: "100%", borderRadius: 3, background: healthColor(detail.health), transition: "width 0.4s", boxShadow: `0 0 8px ${healthColor(detail.health)}40` }} />
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                {[
                  { label: "RVPs", value: detail.rvps },
                  { label: "Agents", value: detail.agents },
                  { label: "Licensing Rev", value: `$${detail.licensingRev.toLocaleString()}`, color: PURPLE },
                  { label: "Production Rev", value: `$${detail.productionRev.toLocaleString()}`, color: "#00E6A8" },
                  { label: "Collected", value: `$${detail.collected.toLocaleString()}` },
                  { label: "Past Due", value: detail.pastDue > 0 ? `$${detail.pastDue}` : "—", color: detail.pastDue > 0 ? "#E05050" : undefined },
                  { label: "Wallet Credits", value: `$${detail.walletCredits}` },
                  { label: "Comm. Paid", value: `$${detail.commPaid.toLocaleString()}`, color: "#00E6A8" },
                  { label: "Growth", value: `+${detail.growth}%`, color: detail.growth >= 15 ? "#00E6A8" : C.gold },
                  { label: "Net Retained", value: `$${(detail.collected - detail.commPaid).toLocaleString()}` },
                ].map(r => (
                  <div key={r.label} style={{ padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", ...mono, fontWeight: 600 }}>{r.label}</div>
                    <div style={{ fontSize: 14, color: r.color || "#FFFFFF", ...mono, fontWeight: 700, marginTop: 2 }}>{r.value}</div>
                  </div>
                ))}
              </div>

              {/* Production breakdown */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600, marginBottom: 8 }}>REVENUE MIX</div>
                <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 1 }}>
                  <div style={{ width: `${Math.round((detail.licensingRev / (detail.licensingRev + detail.productionRev || 1)) * 100)}%`, background: PURPLE, transition: "width 0.4s" }} />
                  <div style={{ flex: 1, background: "#00E6A8", transition: "width 0.4s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: PURPLE, ...mono, fontWeight: 600 }}>Licensing {Math.round((detail.licensingRev / (detail.licensingRev + detail.productionRev || 1)) * 100)}%</span>
                  <span style={{ fontSize: 11, color: "#00E6A8", ...mono, fontWeight: 600 }}>Production {Math.round((detail.productionRev / (detail.licensingRev + detail.productionRev || 1)) * 100)}%</span>
                </div>
              </div>

              {/* Density */}
              <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1, ...mono, fontWeight: 600, marginBottom: 4 }}>DENSITY</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", ...mono, fontWeight: 500 }}>
                  {detail.agents > 0 ? `$${Math.round(detail.productionRev / detail.agents).toLocaleString()} production/agent` : "No agents"}{detail.rvps > 0 ? ` · ${(detail.agents / detail.rvps).toFixed(1)} agents/RVP` : ""}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
