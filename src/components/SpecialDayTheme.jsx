import { useEffect, useRef, useState } from "react";

// ── Palettes ──────────────────────────────────────────────────────────────────
const GOLD   = ["#f5d769","#d4a017","#c8910e","#fff4b2","#f0c040","#fde68a"];
const SILVER = ["#e8e8e8","#c0c0c0","#b0b0b0","#f0f0f0","#d4d4d4"];
const FIESTA = ["#f472b6","#a78bfa","#34d399","#fb923c","#38bdf8"];
const ALL_COLORS = [...GOLD, ...GOLD, ...SILVER, ...FIESTA];

const STYLE_ID = "mp-special-day-theme";
const N_PARTICLES = 42;
const BALLOONS = [
  { emoji:"🎈", x: 6  },
  { emoji:"🎈", x: 21 },
  { emoji:"🎉", x: 37 },
  { emoji:"🎈", x: 53 },
  { emoji:"🎊", x: 68 },
  { emoji:"🎈", x: 82 },
  { emoji:"🎈", x: 94 },
];

// ── Confetti particle factory ────────────────────────────────────────────────
function mkParticle(cw, ch, initial = false) {
  const color = ALL_COLORS[Math.floor(Math.random() * ALL_COLORS.length)];
  return {
    x: Math.random() * cw,
    y: initial ? Math.random() * ch : -20,
    w: 5 + Math.random() * 10,
    h: 3 + Math.random() * 6,
    color,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.13,
    dx: (Math.random() - 0.5) * 1.8,
    dy: 1.0 + Math.random() * 2.4,
    alpha: 0.5 + Math.random() * 0.4,
    isCircle: Math.random() > 0.62,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SpecialDayTheme() {
  const canvasRef = useRef(null);

  // Balloon positions + timing (stable across renders)
  const [balloons] = useState(() =>
    BALLOONS.map((b, i) => ({
      ...b,
      fontSize: 26 + Math.floor(Math.random() * 20),
      duration: 9 + Math.random() * 7,
      delay: -(i * 2.3 + Math.random() * 1.5),
    }))
  );

  useEffect(() => {
    // 1. Gold CSS variable overrides
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      :root {
        --t-accent: #d4a017 !important;
        --t-accent-soft: rgba(212,160,23,0.15) !important;
        --t-btn-grad: linear-gradient(135deg, #7a5c0a, #c8910e, #f5d769, #c8910e) !important;
        --t-card-border: rgba(212,160,23,0.28) !important;
        --t-thread: linear-gradient(135deg, #d4a017, #f5d769) !important;
        --t-together: #d4a017 !important;
      }
    `;
    document.head.appendChild(style);

    // 2. Canvas confetti
    const canvas = canvasRef.current;
    let raf;
    let removeResize = null;
    let removeVisibility = null;

    if (canvas) {
      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;

      let cw = window.innerWidth;
      let ch = window.innerHeight;
      const setSize = () => {
        cw = window.innerWidth;
        ch = window.innerHeight;
        canvas.width  = cw * dpr;
        canvas.height = ch * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      setSize();

      const particles = Array.from({ length: N_PARTICLES }, () =>
        mkParticle(cw, ch, true)
      );

      let last = 0;
      const FRAME = 1000 / 32; // ~32fps — smooth but battery-friendly

      const tick = t => {
        raf = requestAnimationFrame(tick);
        if (t - last < FRAME) return;
        last = t;
        ctx.clearRect(0, 0, cw, ch);
        for (const p of particles) {
          p.y += p.dy;
          p.x += p.dx;
          p.rot += p.rotSpeed;
          if (p.y > ch + 20) Object.assign(p, mkParticle(cw, ch, false));
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          if (p.isCircle) {
            ctx.beginPath();
            ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          }
          ctx.restore();
        }
      };
      raf = requestAnimationFrame(tick);

      // Pause when hidden to save battery
      const onVis = () => {
        if (document.hidden) { cancelAnimationFrame(raf); }
        else { last = 0; raf = requestAnimationFrame(tick); }
      };
      document.addEventListener("visibilitychange", onVis);
      removeVisibility = () => document.removeEventListener("visibilitychange", onVis);

      const onResize = () => setSize();
      window.addEventListener("resize", onResize);
      removeResize = () => window.removeEventListener("resize", onResize);
    }

    return () => {
      document.getElementById(STYLE_ID)?.remove();
      if (raf) cancelAnimationFrame(raf);
      removeResize?.();
      removeVisibility?.();
    };
  }, []);

  return (
    <>
      <style>{`
        @keyframes mp-balloon {
          0%   { transform: translateY(0)      rotate(-5deg) scale(0.9); opacity: 0;   }
          7%   {                                                           opacity: 0.9; }
          35%  { transform: translateY(-35vh)  rotate( 4deg) scale(1);                 }
          65%  { transform: translateY(-68vh)  rotate(-4deg) scale(0.95);              }
          92%  { transform: translateY(-105vh) rotate( 2deg);             opacity: 0.7;}
          100% { transform: translateY(-115vh) rotate( 0deg) scale(0.85); opacity: 0;  }
        }
      `}</style>

      {/* Confetti canvas — behind all UI but visible */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed", inset: 0,
          width: "100vw", height: "100vh",
          zIndex: 450, pointerEvents: "none",
        }}
      />

      {/* Rising balloons */}
      <div style={{
        position: "fixed", inset: 0,
        zIndex: 451, pointerEvents: "none", overflow: "hidden",
      }}>
        {balloons.map((b, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              bottom: -75,
              left: `${b.x}%`,
              fontSize: b.fontSize,
              lineHeight: 1,
              display: "block",
              userSelect: "none",
              animationName: "mp-balloon",
              animationDuration: `${b.duration}s`,
              animationDelay: `${b.delay}s`,
              animationTimingFunction: "ease-in-out",
              animationIterationCount: "infinite",
              animationFillMode: "both",
            }}
          >
            {b.emoji}
          </span>
        ))}
      </div>
    </>
  );
}
