import { useEffect, useState } from "react";

// Misi — la mascota de la app. Vive como una burbuja flotante que se puede
// tocar para abrir el chat. Arte real (3 poses recibidas): alegre (saludando),
// neutral (reutilizada para leyendo/escribiendo, diferenciadas por animación)
// y durmiendo. Fondo casi blanco en el botón para que el blanco de estudio de
// las fotos se funda sin costura visible contra el fondo oscuro de la app.
const IMG_BY_EMOTION = {
  alegre: "/misi-alegre.jpg",
  leyendo: "/misi-neutral.jpg",
  escribiendo: "/misi-neutral.jpg",
  durmiendo: "/misi-durmiendo.jpg",
};

// Encuadre por pose — cada foto centra al robot distinto (la de dormir está
// acostado, más ancho) así que el zoom/posición se ajustan por emoción.
// Zoom bajo a propósito: con más scale se recortaban los ojos contra el
// borde circular — mejor ver el cuerpo completo tipo sticker.
const FRAME_BY_EMOTION = {
  alegre: { scale: 1.05, pos: "center 30%" },
  leyendo: { scale: 1.05, pos: "center 28%" },
  escribiendo: { scale: 1.05, pos: "center 28%" },
  durmiendo: { scale: 1.1, pos: "48% 45%" },
};

const EMOTIONS = {
  alegre:     { label: "Alegre",     cue: "✦" },
  leyendo:    { label: "Leyendo",    cue: "📖" },
  escribiendo:{ label: "Escribiendo",cue: "✏️" },
  durmiendo:  { label: "Durmiendo",  cue: "💤" },
};

// La imagen real de Misi + un pequeño motor de vida propia: al cambiar de
// emoción hace un crossfade corto, y mientras está en una emoción tiene una
// micro-animación continua distinta (respirar, asentir, tiritar de energía,
// dormir) — así nunca se ve como una foto estática pegada en un botón.
function MisiArt({ emotion }) {
  const [shown, setShown] = useState(emotion);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (emotion === shown) return;
    setFading(true);
    const t = setTimeout(() => { setShown(emotion); setFading(false); }, 160);
    return () => clearTimeout(t);
  }, [emotion, shown]);

  const motion = shown === "durmiendo" ? "misi-breathe-slow 3.2s ease-in-out infinite"
    : shown === "escribiendo" ? "misi-wiggle 0.55s ease-in-out infinite"
    : shown === "leyendo" ? "misi-nod 2.6s ease-in-out infinite"
    : "misi-breathe 2.4s ease-in-out infinite";

  const frame = FRAME_BY_EMOTION[shown];

  return (
    <img
      src={IMG_BY_EMOTION[shown]}
      alt="Misi"
      style={{
        width: 60, height: 60, borderRadius: "50%", objectFit: "cover", objectPosition: frame.pos,
        "--misi-s": frame.scale,
        transform: `scale(${frame.scale})`,
        opacity: fading ? 0 : 1,
        transition: "opacity 0.16s ease",
        animation: motion,
      }}
    />
  );
}

// Icono de la emoción actual, animado, en la esquina de la burbuja
function EmotionBadge({ emotion }) {
  const e = EMOTIONS[emotion];
  const anim = emotion === "escribiendo" ? "misi-bounce 0.6s ease-in-out infinite"
    : emotion === "leyendo" ? "misi-pulse 1.4s ease-in-out infinite"
    : emotion === "durmiendo" ? "misi-float-slow 3s ease-in-out infinite"
    : "misi-pulse 2s ease-in-out infinite";
  return (
    <span aria-hidden="true" style={{
      position: "absolute", top: -4, right: -4, fontSize: 14, lineHeight: 1,
      animation: anim, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
    }}>{e.cue}</span>
  );
}

export default function MisiMascot({ emotion = "alegre", unread = 0, onClick, liftForTabBar = false }) {
  const [bump, setBump] = useState(false);
  useEffect(() => {
    if (unread > 0) { setBump(true); const t = setTimeout(() => setBump(false), 600); return () => clearTimeout(t); }
  }, [unread]);

  return (
    <button
      onClick={onClick}
      aria-label={`Abrir chat con Misi — ${EMOTIONS[emotion]?.label ?? ""}`}
      title="Misi"
      style={{
        position: "fixed", right: 16, bottom: liftForTabBar ? 168 : 100, zIndex: 350,
        width: 60, height: 60, borderRadius: "50%", border: "none", cursor: "pointer",
        overflow: "hidden",
        background: "radial-gradient(circle at 35% 28%, #ffffff, #fbf8f2 65%, #f0ece2)",
        boxShadow: "0 6px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08) inset",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: bump ? "misi-bump 0.5s ease" : "misi-float 3.4s ease-in-out infinite",
      }}
    >
      <style>{`
        @keyframes misi-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes misi-float-slow { 0%,100% { transform: translateY(0); opacity:0.85; } 50% { transform: translateY(-2px); opacity:1; } }
        @keyframes misi-bump { 0%,100% { transform: scale(1); } 30% { transform: scale(1.18); } 60% { transform: scale(0.95); } }
        @keyframes misi-pulse { 0%,100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes misi-bounce { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-3px) rotate(-8deg); } }
        @keyframes misi-breathe { 0%,100% { transform: scale(var(--misi-s,1.05)); } 50% { transform: scale(calc(var(--misi-s,1.05) * 1.03)); } }
        @keyframes misi-breathe-slow { 0%,100% { transform: scale(var(--misi-s,1.1)) translateY(0); opacity: 0.92; } 50% { transform: scale(var(--misi-s,1.1)) translateY(1px); opacity: 1; } }
        @keyframes misi-nod { 0%,100% { transform: scale(var(--misi-s,1.05)) rotate(0deg); } 50% { transform: scale(var(--misi-s,1.05)) rotate(-3deg); } }
        @keyframes misi-wiggle { 0%,100% { transform: scale(var(--misi-s,1.05)) rotate(-4deg); } 50% { transform: scale(var(--misi-s,1.05)) rotate(4deg); } }
      `}</style>
      <MisiArt emotion={emotion} />
      <EmotionBadge emotion={emotion} />
      {unread > 0 && (
        <span style={{
          position: "absolute", top: -2, left: -2, background: "#f43f5e", color: "#fff",
          fontSize: 10, fontWeight: 700, borderRadius: 99, minWidth: 17, height: 17, padding: "0 4px",
          display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--t-bg,#0a0714)",
        }}>{unread > 9 ? "9+" : unread}</span>
      )}
    </button>
  );
}
