import { useState, useEffect } from "react";

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
        @keyframes sdb-pulse {
          0%,100% { box-shadow: 0 0 10px rgba(212,160,23,0.45), 0 4px 14px rgba(0,0,0,0.4); }
          50%      { box-shadow: 0 0 22px rgba(212,160,23,0.75), 0 6px 20px rgba(0,0,0,0.5); }
        }
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
          zIndex: 1200,
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
          animation: "sdb-in 0.35s cubic-bezier(0.22,1,0.36,1) both, sdb-pulse 2.8s ease-in-out 0.6s infinite",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {msg}
      </button>
    </>
  );
}
