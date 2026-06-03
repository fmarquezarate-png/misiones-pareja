import { useEffect } from "react";

const GOLD   = ["#f5d769","#d4a017","#c8910e","#fff4b2","#ffe87a","#f0c040"];
const SILVER = ["#e8e8e8","#c0c0c0","#a8a8a8","#f5f5f5","#d0d0d0","#b8b8b8"];
const STYLE_ID = "mp-special-day-theme";

function spawnSparkle(x, y) {
  const COUNT = 8;
  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement("div");
    const palette = Math.random() > 0.38 ? GOLD : SILVER;
    const color = palette[Math.floor(Math.random() * palette.length)];
    const size = 3 + Math.random() * 7;
    const angle = (i / COUNT) * 360 + Math.random() * 22;
    const dist = 22 + Math.random() * 52;
    const rad = (angle * Math.PI) / 180;
    const tx = Math.cos(rad) * dist;
    const ty = Math.sin(rad) * dist;
    el.style.cssText = [
      "position:fixed",
      `left:${x}px`,
      `top:${y}px`,
      `width:${size}px`,
      `height:${size}px`,
      "border-radius:50%",
      `background:${color}`,
      `box-shadow:0 0 ${Math.round(size * 2)}px ${color}99`,
      "pointer-events:none",
      "z-index:9999",
      "transform:translate(-50%,-50%)",
      `--tx:${tx}px`,
      `--ty:${ty}px`,
      "animation:mp-spk 0.65s ease-out forwards",
    ].join(";");
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 720);
  }
}

export default function SpecialDayTheme() {
  useEffect(() => {
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
      @keyframes mp-spk {
        0%   { opacity:1; transform:translate(-50%,-50%) translate(0,0) scale(1); }
        60%  { opacity:0.7; }
        100% { opacity:0; transform:translate(-50%,-50%) translate(var(--tx),var(--ty)) scale(0.15); }
      }
    `;
    document.head.appendChild(style);
    const handleClick = e => spawnSparkle(e.clientX, e.clientY);
    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.getElementById(STYLE_ID)?.remove();
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, []);
  return null;
}
