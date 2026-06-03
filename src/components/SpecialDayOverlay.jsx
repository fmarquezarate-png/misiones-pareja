import { useEffect, useState } from "react";

const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  angle: (i * 360) / 14,
  dist: 55 + (i % 3) * 25,
  size: 4 + (i % 4),
  delay: i * 60,
}));

function Particle({ angle, dist, size, delay }) {
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * dist;
  const y = Math.sin(rad) * dist;
  return (
    <div style={{
      position: "absolute", left: "50%", top: "50%",
      width: 0, height: 0,
      transform: `rotate(${angle}deg)`,
      pointerEvents: "none",
    }}>
      <div style={{
        position: "absolute",
        width: size, height: size, borderRadius: 99,
        background: `linear-gradient(135deg, #f5d769, #d4a017)`,
        boxShadow: `0 0 ${size * 2}px #d4a01788`,
        transform: "translate(-50%, -50%)",
        animation: `sdp-fly 1.2s ease-out ${delay}ms both`,
        "--tx": `${x}px`, "--ty": `${y}px`,
      }} />
    </div>
  );
}

export default function SpecialDayOverlay({ event, p1, p2, onDone }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const ts = [
      setTimeout(() => setPhase(1), 40),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => setPhase(3), 1200),
      setTimeout(() => setPhase(4), 5000),
      setTimeout(() => onDone?.(), 5500),
    ];
    return () => ts.forEach(clearTimeout);
  }, [onDone]);

  const isAnniversary = event.type === "anniversary";

  const emoji = isAnniversary ? "💍" : "🎂";
  const title = isAnniversary
    ? event.years ? `¡${event.years} años juntos! 💑` : "¡Feliz Aniversario! 💑"
    : `¡Feliz Cumpleaños, ${event.name}!`;
  const subtitle = isAnniversary
    ? `${p1} & ${p2} · Un día para celebrar`
    : "Que sea un día lleno de alegría y amor";

  const dismiss = () => { setPhase(4); setTimeout(() => onDone?.(), 500); };

  return (
    <div onClick={dismiss} style={{
      position: "fixed", inset: 0, zIndex: 2100,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "#050300",
      opacity: phase < 4 ? 1 : 0,
      transition: "opacity 0.5s ease",
      cursor: "pointer", userSelect: "none", overflow: "hidden",
    }}>
      <style>{`
        @keyframes sdp-fly {
          0%   { opacity: 1; transform: translate(-50%,-50%) translate(0,0) scale(1); }
          80%  { opacity: 0.7; }
          100% { opacity: 0; transform: translate(-50%,-50%) translate(var(--tx),var(--ty)) scale(0.4); }
        }
        @keyframes sdp-glow {
          0%,100% { box-shadow: 0 0 40px #d4a01766, 0 0 80px #d4a01733; }
          50%      { box-shadow: 0 0 60px #d4a017aa, 0 0 120px #d4a01755; }
        }
        @keyframes sdp-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes sdp-in {
          from { opacity: 0; transform: translateY(24px) scale(0.92); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes sdp-float {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        @keyframes sdp-stars {
          0%,100% { opacity: 0.2; transform: scale(0.8); }
          50%      { opacity: 1; transform: scale(1.2); }
        }
      `}</style>

      {/* Background shimmer bars */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(135deg, transparent 30%, rgba(212,160,23,0.04) 50%, transparent 70%)",
        backgroundSize: "200% 200%",
        animation: "sdp-shimmer 3s linear infinite",
        pointerEvents: "none",
      }} />

      {/* Decorative corner stars */}
      {["top:20px;left:20px", "top:20px;right:20px", "bottom:60px;left:20px", "bottom:60px;right:20px"].map((pos, i) => (
        <div key={i} style={{
          position: "absolute",
          ...Object.fromEntries(pos.split(";").map(p => p.split(":"))),
          fontSize: 14, color: "#d4a017",
          opacity: 0.5,
          animation: `sdp-stars 2s ease-in-out ${i * 300}ms infinite`,
        }}>✦</div>
      ))}

      {/* Main emoji with glow ring */}
      <div style={{ position: "relative", marginBottom: 32 }}>
        {/* Glow ring */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          width: 120, height: 120, borderRadius: 99,
          background: "transparent",
          border: "2px solid rgba(212,160,23,0.4)",
          transform: "translate(-50%,-50%)",
          animation: "sdp-glow 2s ease-in-out infinite",
        }} />
        {/* Emoji */}
        <div style={{
          fontSize: 64,
          animation: "sdp-float 3s ease-in-out infinite",
          display: "block", lineHeight: 1,
          filter: "drop-shadow(0 0 16px rgba(212,160,23,0.6))",
        }}>
          {emoji}
        </div>
        {/* Particles */}
        {phase >= 2 && PARTICLES.map((p, i) => <Particle key={i} {...p} />)}
      </div>

      {/* Text */}
      {phase >= 3 && (
        <div style={{
          textAlign: "center", padding: "0 32px",
          animation: "sdp-in 0.5s cubic-bezier(0.22,1,0.36,1) both",
        }}>
          {/* Gold shimmer title */}
          <div style={{
            fontSize: 26, fontWeight: 800,
            fontFamily: "'Fraunces', serif",
            letterSpacing: -0.5, lineHeight: 1.2,
            background: "linear-gradient(90deg, #c8910e, #f5d769, #d4a017, #f5d769, #c8910e)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            animation: "sdp-shimmer 2.5s linear infinite",
            marginBottom: 10,
          }}>
            {title}
          </div>
          <div style={{
            fontSize: 14, color: "rgba(212,160,23,0.65)",
            fontStyle: "italic", lineHeight: 1.6, maxWidth: 280, margin: "0 auto 20px",
          }}>
            {subtitle}
          </div>

          {/* Gold divider */}
          <div style={{
            height: 1, width: 60, margin: "0 auto 20px",
            background: "linear-gradient(90deg, transparent, #d4a017, transparent)",
          }} />

          <div style={{ fontSize: 11, color: "rgba(212,160,23,0.35)", letterSpacing: 1.5, textTransform: "uppercase" }}>
            toca para continuar
          </div>
        </div>
      )}

      {/* Bottom gold border */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, transparent, #d4a017, transparent)",
      }} />
    </div>
  );
}
