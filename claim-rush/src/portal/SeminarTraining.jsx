import { useState, useEffect } from "react";

/**
 * Phase 17b — Seminar Training Center.
 * Module list, video progress, quiz, certification readiness.
 */

const NAVY = "#0A1628";
const GOLD = "#C9A84C";
const GREEN = "#00E6A8";
const mono = { fontFamily: "'Courier New', monospace" };

function getToken() {
  const raw = localStorage.getItem("access_token");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

function apiFetch(path) {
  const token = getToken();
  return fetch(`/v1/seminars${path}`, {
    headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : {},
  }).then(r => r.ok ? r.json() : null);
}

function apiPost(path, body) {
  const token = getToken();
  return fetch(`/v1/seminars${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(r => r.json());
}

export default function SeminarTraining() {
  const [modules, setModules] = useState([]);
  const [progress, setProgress] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [cert, setCert] = useState(null);
  const [quizModule, setQuizModule] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [quizResult, setQuizResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  function load() {
    setLoading(true);
    Promise.all([
      apiFetch("/training/modules"),
      apiFetch("/training/progress/me"),
      apiFetch("/training/readiness"),
      apiFetch("/certification/me"),
    ]).then(([m, p, r, c]) => {
      setModules(m || []);
      setProgress(p || []);
      setReadiness(r);
      setCert(c);
      setLoading(false);
    });
  }

  function markComplete(moduleId) {
    apiPost("/training/progress", { module_id: moduleId, completed: true }).then(() => load());
  }

  function openQuiz(mod) {
    const questions = mod.quiz_questions_json ? JSON.parse(mod.quiz_questions_json) : [];
    if (!questions.length) return;
    setQuizModule({ ...mod, questions });
    setQuizAnswers(new Array(questions.length).fill(-1));
    setQuizResult(null);
  }

  function submitQuiz() {
    apiPost("/training/quiz", { module_id: quizModule.id, answers: quizAnswers }).then(r => {
      setQuizResult(r);
      if (r.passed) setTimeout(load, 1500);
    });
  }

  function requestCert() {
    apiPost("/certification/request", {}).then(() => load());
  }

  function isCompleted(moduleId) {
    return progress.some(p => p.module_id === moduleId && p.completed_at);
  }

  if (loading) return <div style={{ color: "rgba(255,255,255,0.5)", padding: 40, ...mono }}>Loading training center...</div>;

  const certStatus = cert?.status || "none";

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ ...mono, fontSize: 22, color: "#fff", fontWeight: 700, marginBottom: 6 }}>Seminar Training Center</h1>
      <p style={{ ...mono, fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>Complete all modules and pass the quiz to become a Certified Seminar Host.</p>

      {/* Certification status banner */}
      <div style={{
        padding: "14px 20px", marginBottom: 24, borderRadius: 8,
        background: certStatus === "active" ? "rgba(0,230,168,0.1)" : certStatus === "pending" ? "rgba(201,168,76,0.1)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${certStatus === "active" ? "rgba(0,230,168,0.3)" : certStatus === "pending" ? "rgba(201,168,76,0.3)" : "rgba(255,255,255,0.08)"}`,
      }}>
        <div style={{ ...mono, fontSize: 13, fontWeight: 700, color: certStatus === "active" ? GREEN : certStatus === "pending" ? GOLD : "rgba(255,255,255,0.5)" }}>
          {certStatus === "active" ? `✅ Certified Seminar Host — ${cert.tier?.replace("_", " ").toUpperCase()}` :
           certStatus === "pending" ? "⏳ Certification Pending — Awaiting admin review" :
           "📋 Not yet certified — complete training to apply"}
        </div>
      </div>

      {/* Module cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {modules.map((mod, i) => {
          const done = isCompleted(mod.id);
          const hasQuiz = mod.quiz_questions_json && mod.quiz_questions_json !== "null";
          return (
            <div key={mod.id} style={{
              display: "flex", alignItems: "center", gap: 16, padding: "16px 20px",
              background: done ? "rgba(0,230,168,0.05)" : "#131A2E",
              border: `1px solid ${done ? "rgba(0,230,168,0.2)" : "#1F2742"}`, borderRadius: 8,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: done ? GREEN : "#1F2742",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, color: done ? NAVY : "rgba(255,255,255,0.4)", fontWeight: 700, ...mono,
              }}>
                {done ? "✓" : i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ ...mono, fontSize: 14, fontWeight: 600, color: "#fff" }}>{mod.title}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{mod.description?.slice(0, 80)}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {!done && (
                  <button onClick={() => markComplete(mod.id)} style={{
                    padding: "6px 14px", background: "rgba(42,112,208,0.1)", border: "1px solid rgba(42,112,208,0.3)",
                    borderRadius: 4, color: "#2A70D0", fontSize: 11, fontWeight: 700, cursor: "pointer", ...mono,
                  }}>Mark Complete</button>
                )}
                {hasQuiz && (
                  <button onClick={() => openQuiz(mod)} style={{
                    padding: "6px 14px", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)",
                    borderRadius: 4, color: GOLD, fontSize: 11, fontWeight: 700, cursor: "pointer", ...mono,
                  }}>Take Quiz</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Readiness + certification request */}
      {readiness && (
        <div style={{ padding: "16px 20px", background: "#131A2E", border: "1px solid #1F2742", borderRadius: 8, marginBottom: 24 }}>
          <div style={{ ...mono, fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 10 }}>Certification Readiness</div>
          <div style={{ display: "flex", gap: 20, fontSize: 13, ...mono, color: "rgba(255,255,255,0.7)" }}>
            <span>Modules: {readiness.completed_modules}/{readiness.total_modules} {readiness.all_modules_done ? "✅" : ""}</span>
            <span>Quiz: {readiness.quiz_passed ? `${readiness.quiz_score}% ✅` : "Not passed"}</span>
          </div>
          {readiness.ready_for_certification && certStatus === "none" && (
            <button onClick={requestCert} style={{
              marginTop: 12, padding: "10px 24px", background: GREEN, border: "none", borderRadius: 4,
              color: NAVY, fontSize: 13, fontWeight: 800, cursor: "pointer", ...mono,
            }}>Request Certification</button>
          )}
        </div>
      )}

      {/* Quiz modal */}
      {quizModule && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#131A2E", border: "1px solid #1F2742", borderRadius: 10, padding: 28, width: 600, maxHeight: "80vh", overflowY: "auto" }}>
            <h3 style={{ ...mono, fontSize: 16, color: "#fff", marginBottom: 16 }}>Compliance Quiz — {quizModule.title}</h3>

            {quizResult ? (
              <div style={{ textAlign: "center", padding: 20 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>{quizResult.passed ? "🎉" : "📝"}</div>
                <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: quizResult.passed ? GREEN : GOLD, marginBottom: 8 }}>
                  {quizResult.score}%
                </div>
                <div style={{ ...mono, fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 16 }}>{quizResult.message}</div>
                <button onClick={() => { setQuizModule(null); setQuizResult(null); }} style={{
                  padding: "8px 20px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 4, color: "#fff", cursor: "pointer", ...mono,
                }}>Close</button>
              </div>
            ) : (
              <>
                {quizModule.questions.map((q, qi) => (
                  <div key={qi} style={{ marginBottom: 16, padding: 12, background: "rgba(255,255,255,0.02)", borderRadius: 6 }}>
                    <div style={{ ...mono, fontSize: 13, color: "#fff", fontWeight: 600, marginBottom: 8 }}>{qi + 1}. {q.q}</div>
                    {q.choices.map((c, ci) => (
                      <div key={ci} onClick={() => { const a = [...quizAnswers]; a[qi] = ci; setQuizAnswers(a); }}
                        style={{
                          padding: "8px 12px", marginBottom: 4, borderRadius: 4, cursor: "pointer",
                          background: quizAnswers[qi] === ci ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${quizAnswers[qi] === ci ? "rgba(201,168,76,0.4)" : "rgba(255,255,255,0.06)"}`,
                          color: quizAnswers[qi] === ci ? GOLD : "rgba(255,255,255,0.6)",
                          fontSize: 13, ...mono,
                        }}>
                        {c}
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button onClick={() => setQuizModule(null)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, color: "#fff", cursor: "pointer", ...mono }}>Cancel</button>
                  <button onClick={submitQuiz} disabled={quizAnswers.some(a => a === -1)} style={{
                    padding: "8px 20px", background: GOLD, border: "none", borderRadius: 4,
                    color: NAVY, fontSize: 13, fontWeight: 700, cursor: "pointer", ...mono,
                    opacity: quizAnswers.some(a => a === -1) ? 0.4 : 1,
                  }}>Submit Quiz</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
