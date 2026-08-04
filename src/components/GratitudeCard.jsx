import { useState } from "react";
import { GRATITUDE_MAX } from "../lib/gratitude.js";

// Tarjeta de gratitud del día. Si aún no agradeciste, muestra el prompt; una vez
// enviado, se colapsa a una confirmación. Muestra también el "gracias" recibido
// de la pareja hoy. Se auto-oculta cuando no hay nada relevante que mostrar.
export default function GratitudeCard({ mine, received, partnerName, onSend }) {
  const [text, setText] = useState("");
  const [dismissed, setDismissed] = useState(false);

  const showPrompt = !mine && !dismissed;
  if (!showPrompt && !mine && !received) return null;

  const send = () => { const t = text.trim(); if (!t) return; onSend?.(t); setText(""); };

  return (
    <div style={{
      margin: "0 0 4px", padding: "14px 16px", borderRadius: 16,
      background: "linear-gradient(135deg, rgba(52,211,153,0.13), rgba(251,191,36,0.10))",
      border: "1px solid rgba(52,211,153,0.28)",
    }}>
      {received && (
        <div style={{ fontSize: 13, color: "var(--t-text,#f0e8ff)", lineHeight: 1.45, marginBottom: (mine || showPrompt) ? 12 : 0 }}>
          <span style={{ marginRight: 6 }}>💛</span>
          <b>{received.fromName || partnerName || "Tu pareja"}</b> te agradeció hoy: <i>«{received.text}»</i>
        </div>
      )}

      {mine ? (
        <div style={{ fontSize: 13, color: "var(--t-text-muted,#8b7fa8)" }}>
          <span style={{ marginRight: 6 }}>🙏</span>Hoy agradeciste: <i>«{mine.text}»</i>
        </div>
      ) : showPrompt ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t-text,#f0e8ff)" }}>🙏 ¿Qué le agradeces hoy a {partnerName || "tu pareja"}?</div>
            <button onClick={() => setDismissed(true)} aria-label="Ahora no" title="Ahora no" style={{
              width: 24, height: 24, flexShrink: 0, borderRadius: 99, cursor: "pointer", fontFamily: "inherit",
              fontSize: 12, color: "var(--t-text-muted,#8b7fa8)", background: "transparent", border: "none",
            }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={text} onChange={e => setText(e.target.value)} maxLength={GRATITUDE_MAX}
              onKeyDown={e => { if (e.key === "Enter") send(); }}
              placeholder="Un pequeño gesto, un detalle…"
              style={{
                flex: 1, minWidth: 0, boxSizing: "border-box", padding: "9px 12px", borderRadius: 10,
                fontFamily: "inherit", fontSize: 14, color: "var(--t-text,#f0e8ff)",
                background: "rgba(0,0,0,0.18)", border: "1px solid rgba(52,211,153,0.3)",
              }} />
            <button onClick={send} disabled={!text.trim()} style={{
              flexShrink: 0, padding: "9px 16px", borderRadius: 10, cursor: text.trim() ? "pointer" : "default",
              fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", border: "none",
              background: "linear-gradient(135deg,#34d399,#10b981)", opacity: text.trim() ? 1 : 0.5,
            }}>Enviar</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
