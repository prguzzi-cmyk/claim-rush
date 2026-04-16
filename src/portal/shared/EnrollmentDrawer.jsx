import { useState, useEffect } from "react";
import { C } from "../theme";
import { PROGRAMS, getProgramByLeadType } from "./programs";

const mono = { fontFamily: "'Courier New', monospace" };

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  background: C.panel2,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  color: C.white,
  fontSize: 14,
  ...mono,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
};

const labelStyle = {
  display: "block",
  fontSize: 12,
  color: C.muted,
  letterSpacing: 1,
  textTransform: "uppercase",
  marginBottom: 6,
  ...mono,
};

/**
 * Shared enrollment drawer.
 *
 * Props:
 *  - open: boolean
 *  - program: program object (optional — used when opening from Protection Plans cards)
 *  - prefill: { fullName, phone, email, address, state, leadType } (optional — used from Fire Leads)
 *  - onClose: () => void
 *  - onEnroll: (formData) => void (optional callback after successful enrollment)
 */
export default function EnrollmentDrawer({ open, program, prefill, onClose, onEnroll }) {
  const resolvedProgram = program || (prefill?.leadType ? getProgramByLeadType(prefill.leadType) : null);

  const [form, setForm] = useState({
    fullName: "", phone: "", email: "", address: "", state: "",
    leadType: "Homeowner",
    program: "",
    tier: "",
    agent: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prog = program || (prefill?.leadType ? getProgramByLeadType(prefill.leadType) : null);
    setForm({
      fullName: prefill?.fullName || "",
      phone: prefill?.phone || "",
      email: prefill?.email || "",
      address: prefill?.address || "",
      state: prefill?.state || "",
      leadType: prefill?.leadType || prog?.leadType || "Homeowner",
      program: prog?.name || "",
      tier: "",
      agent: "",
      notes: "",
    });
    setSubmitted(false);
  }, [open, program, prefill]);

  // When leadType changes, update recommended program
  useEffect(() => {
    if (submitted) return;
    const prog = getProgramByLeadType(form.leadType);
    setForm(f => ({ ...f, program: prog.name }));
  }, [form.leadType, submitted]);

  const currentProgram = PROGRAMS.find(p => p.name === form.program) || resolvedProgram;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (onEnroll) {
      onEnroll({ ...form });
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 998,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.3s ease",
        }}
      />
      {/* Drawer */}
      <div style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 440,
        background: C.navy,
        borderLeft: `1px solid ${C.border}`,
        zIndex: 999,
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          padding: "24px 28px 20px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.white, ...mono, letterSpacing: 1 }}>
              ENROLL MEMBER
            </div>
            <div style={{ fontSize: 13, color: currentProgram?.color || C.muted, marginTop: 4, ...mono }}>
              {currentProgram?.name || "Select a program"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: C.muted,
              fontSize: 22,
              cursor: "pointer",
              padding: 4,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: "24px 28px", flex: 1 }}>
          {submitted ? (
            <div style={{ textAlign: "center", paddingTop: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.green, ...mono, letterSpacing: 1 }}>
                MEMBER ENROLLED SUCCESSFULLY
              </div>
              <div style={{ fontSize: 14, color: C.muted, marginTop: 12, lineHeight: 1.6 }}>
                {form.fullName} has been enrolled in<br />
                <span style={{ color: currentProgram?.color }}>{form.program}</span>
              </div>
              <button
                onClick={onClose}
                style={{
                  marginTop: 32,
                  padding: "12px 32px",
                  background: C.gold,
                  color: C.black,
                  border: "none",
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: 1,
                  cursor: "pointer",
                  ...mono,
                }}
              >
                CLOSE
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input style={inputStyle} value={form.fullName} onChange={e => set("fullName", e.target.value)} required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} value={form.phone} onChange={e => set("phone", e.target.value)} required />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} type="email" value={form.email} onChange={e => set("email", e.target.value)} required />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Address</label>
                <input style={inputStyle} value={form.address} onChange={e => set("address", e.target.value)} required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>State</label>
                  <input style={inputStyle} value={form.state} onChange={e => set("state", e.target.value)} required />
                </div>
                <div>
                  <label style={labelStyle}>Lead Type</label>
                  <select
                    style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
                    value={form.leadType}
                    onChange={e => set("leadType", e.target.value)}
                  >
                    <option value="Homeowner">Homeowner</option>
                    <option value="Landlord">Landlord</option>
                    <option value="Business">Business</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Recommended Program</label>
                  <select
                    style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
                    value={form.program}
                    onChange={e => set("program", e.target.value)}
                  >
                    {PROGRAMS.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tier</label>
                  <select
                    style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
                    value={form.tier}
                    onChange={e => set("tier", e.target.value)}
                    required
                  >
                    <option value="">Select tier…</option>
                    {currentProgram?.tiers?.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Assigned Agent</label>
                <select
                  style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
                  value={form.agent}
                  onChange={e => set("agent", e.target.value)}
                  required
                >
                  <option value="">Select agent…</option>
                  <option value="Sarah Kim">Sarah Kim</option>
                  <option value="James Obi">James Obi</option>
                  <option value="Marcus Lee">Marcus Lee</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                  value={form.notes}
                  onChange={e => set("notes", e.target.value)}
                />
              </div>
              <button
                type="submit"
                style={{
                  marginTop: 8,
                  padding: "14px 0",
                  background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
                  color: C.black,
                  border: "none",
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: 1.5,
                  cursor: "pointer",
                  ...mono,
                  transition: "opacity 0.2s",
                }}
              >
                COMPLETE ENROLLMENT
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
