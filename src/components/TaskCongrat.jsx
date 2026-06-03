import { useEffect, useState } from "react";

const TIERS = [
  { min: 80, msgs: [
    "Tú ya sé que sabes 😌",
    "Como siempre. Un 10 🤌",
    "Eso. Sin más ✦",
    "Sabías que ibas a llegar aquí, ¿verdad? 🏆",
    "Semana completísima 👑",
    "No me sorprende. Para nada 😏",
  ]},
  { min: 55, msgs: [
    "Gran semana hasta ahora ✨",
    "¡La recta final! Ya casi 🏁",
    "Estás en racha. Que no pare 🌟",
    "Qué semana más sólida 🔥",
    "La constancia tiene nombre: el tuyo 🎯",
    "Ya se nota la rutina. Bonito eso 💪",
  ]},
  { min: 28, msgs: [
    "¡Vas bien! No pares ahora ⚡",
    "Mitad del camino. Sigue así 🎯",
    "Buen ritmo. ¡Que continúe! 🔥",
    "Ya se ve el rumbo. ¡Adelante! 🚀",
    "Cada tarea suma. Esta también 💡",
    "El camino está tomado forma 🌱",
  ]},
  { min: 0, msgs: [
    "¡Primer paso! Así se empieza 💪",
    "¡Ahí vamos! Cada tarea cuenta 🌱",
    "¡Arrancamos! El inicio es lo más difícil 🚀",
    "¡Bien! Empieza a rodar 🎯",
    "El camino empieza aquí ✨",
    "Todo gran récord empezó con uno ⭐",
  ]},
];

function pickMsg(pct) {
  const tier = TIERS.find(t => pct >= t.min) || TIERS[TIERS.length - 1];
  return tier.msgs[Math.floor(Math.random() * tier.msgs.length)];
}

export default function TaskCongrat({ info, onDone }) {
  const [phase, setPhase] = useState(0);           // 0=entering, 1=visible, 2=fading
  const [barPct, setBarPct] = useState(info.beforePct);
  const [msg] = useState(() => pickMsg(info.afterPct));

  useEffect(() => {
    const ts = [
      setTimeout(() => setPhase(1), 30),
      setTimeout(() => setBarPct(info.afterPct), 80),  // animate bar after slide-in
      setTimeout(() => setPhase(2), 3800),
      setTimeout(() => onDone?.(), 4350),
    ];
    return () => ts.forEach(clearTimeout);
  }, [onDone, info.afterPct]);

  const { mission, afterPct, delta, color } = info;
  const title = (mission.emoji ? `${mission.emoji} ` : "") + (mission.title || "Tarea completada");
  const deltaLabel = delta > 0 ? `+${delta}%` : `${delta}%`;

  return (
    <>
      <style>{`
        @keyframes tc-slide {
          from { transform: translateX(-50%) translateY(28px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
      `}</style>
      <div
        onClick={() => { setPhase(2); setTimeout(() => onDone?.(), 400); }}
        style={{
          position: "fixed",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          width: "calc(100% - 28px)",
          maxWidth: 380,
          zIndex: 600,
          background: "rgba(18,12,36,0.97)",
          border: `1px solid ${color}44`,
          borderLeft: `3px solid ${color}`,
          borderRadius: 14,
          padding: "12px 14px 12px 16px",
          boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px ${color}18`,
          cursor: "pointer",
          animation: "tc-slide 0.32s cubic-bezier(0.22,1,0.36,1) both",
          opacity: phase < 2 ? 1 : 0,
          transition: "opacity 0.55s ease",
          userSelect: "none",
        }}
      >
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: "#f8f4ff",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1,
          }}>
            {title}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
            color, flexShrink: 0,
            background: `${color}1a`, borderRadius: 8, padding: "2px 8px",
          }}>
            {deltaLabel} · al {afterPct}%
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          height: 4, borderRadius: 99, background: "rgba(255,255,255,0.07)", marginBottom: 9, overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 99,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            width: `${barPct}%`,
            transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)",
          }} />
        </div>

        {/* Message */}
        <div style={{
          fontSize: 12, color: "rgba(248,244,255,0.6)",
          fontStyle: "italic", lineHeight: 1.4,
        }}>
          {msg}
        </div>
      </div>
    </>
  );
}
