import { useState } from "react";
import { DATE_IDEAS, pickDateIdea } from "../lib/dateIdeas.js";

// Card "Nuestro momento": sugiere una idea de plan en pareja. "Otra" rota,
// "Añadir al plan" la manda al formulario de evento (onAdd).
export default function DateIdea({ onAdd, seed = 0 }) {
  const [index, setIndex] = useState(seed % DATE_IDEAS.length);
  const idea = pickDateIdea(index);
  if (!idea) return null;

  return (
    <div style={{
      margin: "0 0 4px", padding: "14px 16px", borderRadius: 16,
      background: "linear-gradient(135deg, rgba(52,211,153,0.12), rgba(96,165,250,0.10))",
      border: "1px solid rgba(52,211,153,0.26)",
    }}>
      <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, color: "var(--t-text-dim,#6b5f88)", marginBottom: 10 }}>
        💞 Nuestro momento
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 26, flexShrink: 0 }}>{idea.emoji}</span>
        <div style={{ flex: 1, minWidth: 0, fontSize: 15, color: "var(--t-text,#f0e8ff)", fontWeight: 500, fontFamily: "'Fraunces',serif" }}>
          {idea.title}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
        <button onClick={() => setIndex(i => i + 1)} style={{
          padding: "7px 14px", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 12,
          color: "var(--t-text-muted,#8b7fa8)", background: "rgba(128,128,128,0.1)", border: "none",
        }}>🔄 Otra idea</button>
        <button onClick={() => onAdd?.(idea)} style={{
          padding: "7px 16px", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
          color: "#fff", border: "none", background: "linear-gradient(135deg,#34d399,#10b981)",
        }}>Añadir al plan</button>
      </div>
    </div>
  );
}
