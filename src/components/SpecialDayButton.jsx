import { useState, useEffect } from "react";
import { Z } from "../lib/zLayers.js";

const MESSAGES = [
  "¿Curiosidad? ✨",
  "¡A que no me aprietas! 😏",
  "¡Hola! 👋",
  "Yo sólo estoy de paso 🌟",
  "¿Deberías apretarme? 🤔",
  "¡Cucu! 🎊",
];

// Fixed positions that cycle over time (mix of corners/edges)
const POSITIONS = [
  { bottom: 140, left: 16 },
  { bottom: 230, right: 20 },
  { top: 128, right: 16 },
  { top: 205, left: 18 },
  { bottom: 168, right: 64 },
  { top: 162, left: 52 },
];

export default function SpecialDayButton({ onReplay }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % MESSAGES.length), 26000);
    return () => clearInterval(t);
  }, []);

  const pos = POSITIONS[idx % POSITIONS.length];
  const msg = MESSAGES[idx];

  return (
    <>
      <style>{`
        @keyframes sdb-in {
          from { opacity:0; transform:scale(0.65); }
          to   { opacity:1; transform:scale(1); }
        }
      `}</style>
      <button
        key={idx}
        onClick={onReplay}
        style={{
          position: "fixed",
          zIndex: Z.FAB,
          ...pos,
          background: "linear-gradient(135deg, #6b4f08, #c8910e 45%, #f5d769 80%, #c8910e)",
          border: "1.5px solid rgba(245,215,105,0.55)",
          borderRadius: 22,
          padding: "9px 15px",
          color: "#1a0e00",
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "'Fraunces', serif",
          cursor: "pointer",
          maxWidth: 175,
          lineHeight: 1.35,
          textAlign: "center",
          userSelect: "none",
          letterSpacing: 0.2,
          // Solo la entrada. El latido era `box-shadow` en bucle INFINITO y este
          // botón está en pantalla las 24h del cumple/aniversario: repintaba
          // cada frame todo el día, y además competía con el contenido.
          animation: "sdb-in 0.35s cubic-bezier(0.22,1,0.36,1) both",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {msg}
      </button>
    </>
  );
}
