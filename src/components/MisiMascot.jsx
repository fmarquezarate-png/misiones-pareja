import { useEffect, useRef, useState } from "react";

// Misi — la mascota de la app. Vive como una burbuja flotante que se puede
// tocar para abrir el chat. Ahora ANIMADA: 3 videos cortos (loop, ~50KB c/u,
// optimizados desde los originales de 6MB) con fondo blanco de estudio que se
// funde con el botón. La foto JPG va de `poster`: se ve al instante mientras
// carga el video y actúa de fallback si el navegador no lo reproduce.
const VIDEO_BY_EMOTION = {
  alegre:      "/misi-alegre.mp4",
  leyendo:     "/misi-escribiendo.mp4", // atento / pensando cuando el chat está abierto
  escribiendo: "/misi-escribiendo.mp4",
  durmiendo:   "/misi-durmiendo.mp4",
};
// Poster estático (carga instantánea + fallback si el video no reproduce o si
// el usuario pidió "reducir movimiento").
const POSTER_BY_EMOTION = {
  alegre:      "/misi-alegre.jpg",
  leyendo:     "/misi-neutral.jpg",
  escribiendo: "/misi-neutral.jpg",
  durmiendo:   "/misi-durmiendo.jpg",
};

const EMOTIONS = {
  alegre:     { label: "Alegre",     cue: "✦" },
  leyendo:    { label: "Leyendo",    cue: "📖" },
  escribiendo:{ label: "Escribiendo",cue: "✏️" },
  durmiendo:  { label: "Durmiendo",  cue: "💤" },
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Misi animada. Al cambiar de emoción hace un crossfade corto (remonta el
// <video> con key para reiniciar el loop). Si el usuario pidió menos
// movimiento, muestra la foto estática en vez del video.
function MisiArt({ emotion }) {
  const [shown, setShown] = useState(emotion);
  const [fading, setFading] = useState(false);
  const vref = useRef(null);
  const reduce = prefersReducedMotion();

  useEffect(() => {
    if (emotion === shown) return;
    setFading(true);
    const t = setTimeout(() => { setShown(emotion); setFading(false); }, 160);
    return () => clearTimeout(t);
  }, [emotion, shown]);

  // Pausar el loop cuando la app está en segundo plano — no gastar batería
  // animando algo que nadie ve. Se reanuda al volver.
  useEffect(() => {
    if (reduce) return;
    const onVis = () => {
      const v = vref.current;
      if (!v) return;
      if (document.hidden) v.pause();
      else v.play?.().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [reduce]);

  const commonStyle = {
    width: 60, height: 60, borderRadius: "50%", objectFit: "cover",
    opacity: fading ? 0 : 1, transition: "opacity 0.16s ease",
  };

  if (reduce) {
    return <img src={POSTER_BY_EMOTION[shown]} alt="Misi" style={{ ...commonStyle, transform: "scale(1.05)" }} />;
  }

  return (
    <video
      key={shown}
      ref={vref}
      src={VIDEO_BY_EMOTION[shown]}
      poster={POSTER_BY_EMOTION[shown]}
      autoPlay loop muted playsInline
      aria-hidden="true"
      style={commonStyle}
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
