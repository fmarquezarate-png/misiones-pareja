import { useEffect, useRef, useState } from "react";

const GREENS  = ["#22c55e","#16a34a","#4ade80","#86efac","#bbf7d0"];
const WHITES  = ["#ffffff","#f0fdf4","#dcfce7"];
const GOLD    = ["#fbbf24","#f59e0b"];
const ALL_COLORS = [...GREENS, ...GREENS, ...WHITES, ...GOLD];

const STYLE_ID = "mp-match-day-theme";
const N_PARTICLES = 38;
const BALLS = [
  { emoji:"⚽", x: 5  },
  { emoji:"⚽", x: 18 },
  { emoji:"🏆", x: 33 },
  { emoji:"⚽", x: 48 },
  { emoji:"⚽", x: 63 },
  { emoji:"🎽", x: 78 },
  { emoji:"⚽", x: 92 },
];

function mkParticle(cw, ch, initial = false) {
  const color = ALL_COLORS[Math.floor(Math.random() * ALL_COLORS.length)];
  return {
    x: Math.random() * cw,
    y: initial ? Math.random() * ch : -20,
    w: 5 + Math.random() * 9, h: 3 + Math.random() * 5,
    color, rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.13,
    dx: (Math.random() - 0.5) * 1.6,
    dy: 1.0 + Math.random() * 2.2,
    alpha: 0.5 + Math.random() * 0.4,
    isCircle: Math.random() > 0.58,
  };
}

export default function MatchDayTheme() {
  const canvasRef = useRef(null);
  const [balls] = useState(() =>
    BALLS.map((b, i) => ({
      ...b,
      fontSize: 24 + Math.floor(Math.random() * 18),
      duration: 8 + Math.random() * 6,
      delay: -(i * 2.1 + Math.random() * 1.4),
    }))
  );

  useEffect(() => {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      :root {
        --t-accent: #22c55e !important;
        --t-accent-soft: rgba(34,197,94,0.15) !important;
        --t-btn-grad: linear-gradient(135deg, #14532d, #16a34a, #4ade80, #16a34a) !important;
        --t-card-border: rgba(34,197,94,0.28) !important;
        --t-thread: linear-gradient(135deg, #16a34a, #4ade80) !important;
        --t-together: #22c55e !important;
      }
    `;
    document.head.appendChild(style);

    const canvas = canvasRef.current;
    let raf, removeResize = null, removeVisibility = null;

    if (canvas) {
      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      let cw = window.innerWidth, ch = window.innerHeight;
      const setSize = () => {
        cw = window.innerWidth; ch = window.innerHeight;
        canvas.width = cw * dpr; canvas.height = ch * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      setSize();

      const particles = Array.from({ length: N_PARTICLES }, () => mkParticle(cw, ch, true));
      let last = 0;
      const FRAME = 1000 / 32;

      const tick = t => {
        raf = requestAnimationFrame(tick);
        if (t - last < FRAME) return;
        last = t;
        ctx.clearRect(0, 0, cw, ch);
        for (const p of particles) {
          p.y += p.dy; p.x += p.dx; p.rot += p.rotSpeed;
          if (p.y > ch + 20) Object.assign(p, mkParticle(cw, ch, false));
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          if (p.isCircle) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
          else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      };
      raf = requestAnimationFrame(tick);

      const onVis = () => { if (document.hidden) cancelAnimationFrame(raf); else { last = 0; raf = requestAnimationFrame(tick); } };
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
        @keyframes mp-ball {
          0%   { transform: translateY(0)      rotate(-5deg) scale(0.9); opacity: 0;   }
          7%   {                                                           opacity: 0.9; }
          35%  { transform: translateY(-35vh)  rotate( 4deg) scale(1);                 }
          65%  { transform: translateY(-68vh)  rotate(-4deg) scale(0.95);              }
          92%  { transform: translateY(-105vh) rotate( 2deg);             opacity: 0.7;}
          100% { transform: translateY(-115vh) rotate( 0deg) scale(0.85); opacity: 0;  }
        }
      `}</style>
      <canvas ref={canvasRef} style={{ position:"fixed", inset:0, width:"100vw", height:"100vh", zIndex:450, pointerEvents:"none" }} />
      <div style={{ position:"fixed", inset:0, zIndex:451, pointerEvents:"none", overflow:"hidden" }}>
        {balls.map((b, i) => (
          <span key={i} style={{
            position:"absolute", bottom:-70, left:`${b.x}%`,
            fontSize:b.fontSize, lineHeight:1, display:"block", userSelect:"none",
            animationName:"mp-ball", animationDuration:`${b.duration}s`,
            animationDelay:`${b.delay}s`, animationTimingFunction:"ease-in-out",
            animationIterationCount:"infinite", animationFillMode:"both",
          }}>{b.emoji}</span>
        ))}
      </div>
    </>
  );
}
