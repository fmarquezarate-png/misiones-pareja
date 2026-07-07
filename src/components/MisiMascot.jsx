import { useEffect, useState } from "react";

// Misi — la mascota de la app. Vive como una burbuja flotante que se puede
// tocar para abrir el chat. 4 emociones expresadas con overlays/animación CSS
// sobre UNA sola imagen base (mismo patrón que StatusOrb: nada de sprites por
// estado todavía) — así, cuando llegue el arte final, alcanza con cambiar
// MISI_IMG sin tocar el resto del componente.
//
// TODO(usuario): reemplazar MISI_IMG por /misi.png una vez que el archivo esté
// en public/. Mientras tanto se dibuja un placeholder con CSS puro.
const MISI_IMG = null; // ej: "/misi.png" — null = usa el placeholder dibujado

const EMOTIONS = {
  alegre:     { label: "Alegre",     cue: "✦" },
  leyendo:    { label: "Leyendo",    cue: "📖" },
  escribiendo:{ label: "Escribiendo",cue: "✏️" },
  durmiendo:  { label: "Durmiendo",  cue: "💤" },
};

// Placeholder dibujado con CSS — dos "ojos" tipo carrete cobre, cuerpo esférico,
// evocando el diseño real sin depender del PNG. Se reemplaza solo con MISI_IMG.
function MisiPlaceholder({ emotion }) {
  const eyesClosed = emotion === "durmiendo";
  const eyeGlow = emotion === "alegre" ? "0 0 14px rgba(255,255,255,0.55)" : "0 0 8px rgba(255,255,255,0.25)";
  return (
    <div style={{ position: "relative", width: 46, height: 46 }}>
      {/* Cuerpo */}
      <div style={{
        position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: 30, height: 22, borderRadius: "50% 50% 46% 46%",
        background: "linear-gradient(160deg,#e8a06a,#b5652f)",
      }} />
      {/* Ojos gemelos */}
      <div style={{ position: "absolute", top: 2, left: "50%", transform: "translateX(-50%)", display: "flex" }}>
        {[0, 1].map(i => (
          <div key={i} style={{
            width: 22, height: 22, borderRadius: "50%", marginLeft: i ? -6 : 0,
            background: "linear-gradient(155deg,#f0b482,#a85a28)",
            border: "2px solid #7a3e1a",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "inset 0 0 4px rgba(0,0,0,0.4)",
          }}>
            <div style={{
              width: 12, height: eyesClosed ? 2 : 12, borderRadius: eyesClosed ? 2 : "50%",
              background: "#0a0714", transition: "height 0.25s ease",
              boxShadow: eyesClosed ? "none" : eyeGlow,
            }} />
          </div>
        ))}
      </div>
    </div>
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
        background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.12), transparent 60%), linear-gradient(160deg,#d98a4f,#8a4420)",
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
      {MISI_IMG ? <img src={MISI_IMG} alt="Misi" style={{ width: 42, height: 42, objectFit: "contain" }} /> : <MisiPlaceholder emotion={emotion} />}
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
