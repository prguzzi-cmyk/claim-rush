import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import "./LeadsViewer.css";

export default function LeadsViewer() {
  const [leads, setLeads] = useState([]);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("claimrush_leads") || "[]");
      const sorted = raw.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setLeads(sorted);
      console.log(`[ClaimRush] LeadsViewer loaded with ${sorted.length} leads`);
    } catch (err) {
      console.warn("[ClaimRush] Failed to load leads:", err);
    }
  }, []);

  const cp = useMemo(() => {
    const first = leads.find((l) => l.chapter?.name);
    if (!first) return null;
    return first.chapter;
  }, [leads]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const newToday = leads.filter(
      (l) => new Date(l.createdAt).toDateString() === today
    ).length;
    const lastTime = leads.length > 0 ? leads[0].createdAt : null;
    return { total: leads.length, newToday, lastTime };
  }, [leads]);

  const fmt = (iso) => {
    try {
      return new Date(iso).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit",
      });
    } catch { return iso; }
  };

  const fmtRelative = (iso) => {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return fmt(iso);
  };

  return (
    <div className="lv">
      {/* ── HEADER ─────────────────────────────────────── */}
      <header className="lv-header">
        <div className="lv-wrap">
          <div className="lv-header-top">
            <h1 className="lv-title">Your Chapter Leads Dashboard</h1>
            <Link to="/file-a-claim" className="lv-back">← Back to form</Link>
          </div>
          {cp && (
            <div className="lv-header-cp">
              <span className="lv-header-cp-name">{cp.name}</span>
              {cp.territory && (
                <span className="lv-header-cp-territory">{cp.territory}</span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── BODY ───────────────────────────────────────── */}
      <main className="lv-body">
        <div className="lv-wrap">
          {leads.length === 0 ? (
            <div className="lv-empty">
              <p>No leads yet</p>
            </div>
          ) : (
            <>
              {/* ── EXCLUSIVE NOTICE ── */}
              <div className="lv-exclusive">
                These leads are exclusively assigned to your chapter.
              </div>

              {/* ── STAT BAR ── */}
              <div className="lv-stats">
                <div className="lv-stat">
                  <span className="lv-stat-value">{stats.total}</span>
                  <span className="lv-stat-label">Total Leads</span>
                </div>
                <div className="lv-stat">
                  <span className="lv-stat-value">{stats.newToday}</span>
                  <span className="lv-stat-label">New Today</span>
                </div>
                <div className="lv-stat">
                  <span className="lv-stat-value">{fmtRelative(stats.lastTime)}</span>
                  <span className="lv-stat-label">Last Lead</span>
                </div>
              </div>

              {/* ── LEAD LIST ── */}
              <div className="lv-list">
                {leads.map((l, i) => (
                  <div key={l.id} className={`lv-card${i === 0 ? " lv-card-new" : ""}`}>
                    <div className="lv-card-header">
                      <div className="lv-card-header-left">
                        <span className="lv-card-name">{l.lead?.name || "—"}</span>
                        {i === 0 && <span className="lv-badge-new">NEW</span>}
                      </div>
                      <span className="lv-card-time">{fmt(l.createdAt)}</span>
                    </div>

                    <div className="lv-card-grid">
                      <div className="lv-card-field">
                        <span className="lv-label">Phone</span>
                        <a
                          href={`tel:${(l.lead?.phone || "").replace(/[^0-9]/g, "")}`}
                          className="lv-card-link"
                        >
                          {l.lead?.phone || "—"}
                        </a>
                      </div>
                      <div className="lv-card-field">
                        <span className="lv-label">Email</span>
                        <a
                          href={`mailto:${l.lead?.email || ""}`}
                          className="lv-card-link"
                        >
                          {l.lead?.email || "—"}
                        </a>
                      </div>
                      <div className="lv-card-field lv-card-field-full">
                        <span className="lv-label">Address</span>
                        <span>{l.lead?.address || "—"}</span>
                      </div>
                      <div className="lv-card-field">
                        <span className="lv-label">Damage Type</span>
                        <span>{l.lead?.damageType || "—"}</span>
                      </div>
                    </div>

                    {/* ── ACTION BUTTONS ── */}
                    {(l.lead?.phone || l.lead?.email) && (
                      <div className="lv-card-actions">
                        {l.lead?.phone && (
                          <a
                            href={`tel:${l.lead.phone.replace(/[^0-9]/g, "")}`}
                            className="lv-action-btn lv-action-call"
                          >
                            📞 Call Now
                          </a>
                        )}
                        {l.lead?.email && (
                          <a
                            href={`mailto:${l.lead.email}`}
                            className="lv-action-btn lv-action-email"
                          >
                            ✉️ Email
                          </a>
                        )}
                      </div>
                    )}

                    {l.chapter?.name && (
                      <div className="lv-card-footer">
                        Handled by <strong>{l.chapter.name}</strong>
                        {l.chapter.territory ? ` · ${l.chapter.territory}` : ""}
                      </div>
                    )}

                    <div className="lv-card-source">
                      source: {l.source || "direct"} · {l.id}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
