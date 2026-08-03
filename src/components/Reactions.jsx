import { useState } from "react";

// Reacciones de pareja (kudos) reutilizables — se usan en tarjetas de tarea/
// evento y en mensajes de chat. El estado vive en el blob compartido
// (data.reactions[targetId] = { emoji: [personId...] }), así que se sincroniza
// solo por CAS/realtime como cualquier otro dato — sin tocar la base de datos.
export const REACTION_SET = ["👏", "❤️", "🔥", "😂", "🎉", "👍"];

export default function Reactions({ reactions, myPersonId, onToggle, align = "left" }) {
  const [picker, setPicker] = useState(false);
  const entries = Object.entries(reactions || {}).filter(([, who]) => who?.length);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginTop: 4, justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
      {entries.map(([emoji, who]) => {
        const mine = who.includes(myPersonId);
        return (
          <button key={emoji} onClick={() => onToggle(emoji)} title={`${who.length}`}
            style={{
              display: "flex", alignItems: "center", gap: 3, padding: "1px 7px", borderRadius: 99,
              cursor: "pointer", fontFamily: "inherit", fontSize: 12, lineHeight: 1.6,
              background: mine ? "rgba(167,139,250,0.22)" : "rgba(128,128,128,0.1)",
              border: `1px solid ${mine ? "rgba(167,139,250,0.5)" : "rgba(128,128,128,0.18)"}`,
              color: "var(--t-text,#f0e8ff)",
            }}>
            <span>{emoji}</span>
            {who.length > 1 && <span style={{ fontSize: 10, fontWeight: 700 }}>{who.length}</span>}
          </button>
        );
      })}
      <div style={{ position: "relative" }}>
        <button onClick={() => setPicker(p => !p)} aria-label="Reaccionar"
          style={{
            width: 22, height: 22, borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 12,
            background: "rgba(128,128,128,0.08)", border: "1px solid rgba(128,128,128,0.16)",
            color: "var(--t-text-muted,#8b7fa8)", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
          }}>{entries.length ? "+" : "☺"}</button>
        {picker && (
          <>
            <div onClick={() => setPicker(false)} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
            <div style={{
              position: "absolute", bottom: "130%", [align === "right" ? "right" : "left"]: 0, zIndex: 201,
              display: "flex", gap: 2, background: "var(--t-card,#1d1733)",
              border: "1px solid rgba(167,139,250,0.3)", borderRadius: 99, padding: "4px 6px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            }}>
              {REACTION_SET.map(e => (
                <button key={e} onClick={() => { onToggle(e); setPicker(false); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: "2px 3px", lineHeight: 1 }}>{e}</button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
