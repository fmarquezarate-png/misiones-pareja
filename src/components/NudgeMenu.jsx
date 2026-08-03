import { useState } from "react";
import { NUDGE_INTENTS } from "../lib/nudge.js";

// Botón "dar un toque" + menú de intenciones. Al elegir una, llama onNudge(id);
// el caller manda el push con el tono correspondiente.
export default function NudgeMenu({ onNudge, align = "right" }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-block", flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} title="Dar un toque a tu pareja"
        aria-label="Dar un toque a tu pareja"
        style={{
          width: 24, height: 24, borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 13,
          background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.28)",
          color: "#60a5fa", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
        }}>👉</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
          <div style={{
            position: "absolute", bottom: "130%", [align]: 0, zIndex: 201,
            display: "flex", flexDirection: "column", gap: 2, minWidth: 178,
            background: "var(--t-card,#1d1733)", border: "1px solid rgba(96,165,250,0.3)",
            borderRadius: 12, padding: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}>
            {NUDGE_INTENTS.map(i => (
              <button key={i.id} onClick={() => { onNudge(i.id); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8,
                  cursor: "pointer", fontFamily: "inherit", fontSize: 13, textAlign: "left",
                  background: "rgba(128,128,128,0.06)", border: "1px solid rgba(255,255,255,0.06)",
                  color: "var(--t-text,#f0e8ff)", width: "100%",
                }}>
                <span style={{ fontSize: 16 }}>{i.emoji}</span>{i.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
