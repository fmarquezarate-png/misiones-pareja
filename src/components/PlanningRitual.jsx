import { useState } from "react";
import { RITUAL_STEPS } from "../lib/ritual.js";

// Banner + modal del ritual de planificación conjunta. El componente decide
// cuándo mostrarse lo resuelve el caller (shouldShowPlanningRitual); aquí solo
// se maneja el "ahora no" de la sesión y el flujo del modal.
export default function PlanningRitual({ onComplete, onNotifyPartner }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [checked, setChecked] = useState({});
  const [notified, setNotified] = useState(false);
  if (dismissed) return null;

  const doneCount = RITUAL_STEPS.filter(s => checked[s.id]).length;
  const toggle = id => setChecked(c => ({ ...c, [id]: !c[id] }));
  const finish = () => { onComplete?.(); setOpen(false); setDismissed(true); };
  const notify = () => { if (notified) return; onNotifyPartner?.(); setNotified(true); };

  return (
    <>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, margin: "0 0 16px",
        padding: "14px 16px", borderRadius: 16,
        background: "linear-gradient(135deg, rgba(167,139,250,0.16), rgba(96,165,250,0.12))",
        border: "1px solid rgba(167,139,250,0.32)",
      }}>
        <span style={{ fontSize: 26, flexShrink: 0 }}>🗓️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t-text,#f0e8ff)" }}>Ritual de planificación</div>
          <div style={{ fontSize: 12, color: "var(--t-text-muted,#8b7fa8)", marginTop: 2 }}>Un momento para planificar la semana juntos</div>
        </div>
        <button onClick={() => setOpen(true)} style={{
          flexShrink: 0, padding: "8px 14px", borderRadius: 99, cursor: "pointer", fontFamily: "inherit",
          fontSize: 13, fontWeight: 600, color: "#fff", border: "none",
          background: "linear-gradient(135deg,#a78bfa,#8b5cf6)",
        }}>Empezar</button>
        <button onClick={() => setDismissed(true)} aria-label="Ahora no" title="Ahora no" style={{
          flexShrink: 0, width: 26, height: 26, borderRadius: 99, cursor: "pointer", fontFamily: "inherit",
          fontSize: 13, color: "var(--t-text-muted,#8b7fa8)", background: "transparent", border: "none",
        }}>✕</button>
      </div>

      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 420, maxHeight: "88vh", overflowY: "auto",
            background: "var(--t-menu-bg,#0f0a1e)", border: "1px solid rgba(167,139,250,0.3)",
            borderRadius: 20, padding: "22px 20px", boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
          }}>
            <div style={{ textAlign: "center", marginBottom: 4, fontSize: 30 }}>🗓️</div>
            <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, textAlign: "center", color: "var(--t-text,#f0e8ff)" }}>Planifiquen la semana</h2>
            <p style={{ margin: "0 0 18px", fontSize: 13, textAlign: "center", color: "var(--t-text-muted,#8b7fa8)", lineHeight: 1.5 }}>
              Un momento juntos para arrancar la semana alineados. Vayan marcando lo que hagan.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              {RITUAL_STEPS.map(s => {
                const on = !!checked[s.id];
                return (
                  <button key={s.id} onClick={() => toggle(s.id)} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12,
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%",
                    background: on ? "rgba(52,211,153,0.12)" : "rgba(128,128,128,0.06)",
                    border: `1px solid ${on ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.08)"}`,
                    transition: "background 0.15s, border-color 0.15s",
                  }}>
                    <span style={{
                      flexShrink: 0, width: 24, height: 24, borderRadius: 99, display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 13, color: "#fff",
                      background: on ? "#34d399" : "transparent",
                      border: on ? "none" : "2px solid rgba(255,255,255,0.2)",
                    }}>{on ? "✓" : ""}</span>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{s.emoji}</span>
                    <span style={{ fontSize: 13, color: "var(--t-text,#f0e8ff)", lineHeight: 1.4 }}>{s.text}</span>
                  </button>
                );
              })}
            </div>

            <button onClick={notify} disabled={notified} style={{
              width: "100%", padding: "11px", borderRadius: 12, marginBottom: 8, fontFamily: "inherit",
              fontSize: 13, fontWeight: 600, cursor: notified ? "default" : "pointer",
              color: notified ? "#34d399" : "#60a5fa",
              background: notified ? "rgba(52,211,153,0.1)" : "rgba(96,165,250,0.1)",
              border: `1px solid ${notified ? "rgba(52,211,153,0.3)" : "rgba(96,165,250,0.3)"}`,
            }}>{notified ? "✓ Invitación enviada" : "👉 Avisar a mi pareja"}</button>

            <button onClick={finish} style={{
              width: "100%", padding: "12px", borderRadius: 12, fontFamily: "inherit",
              fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#fff", border: "none",
              background: "linear-gradient(135deg,#a78bfa,#8b5cf6)",
            }}>🎉 Terminar ritual{doneCount ? ` (${doneCount}/${RITUAL_STEPS.length})` : ""}</button>

            <button onClick={() => setOpen(false)} style={{
              width: "100%", padding: "10px", marginTop: 6, borderRadius: 12, fontFamily: "inherit",
              fontSize: 13, cursor: "pointer", color: "var(--t-text-muted,#8b7fa8)",
              background: "transparent", border: "none",
            }}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  );
}
