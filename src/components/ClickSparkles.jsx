import { useEffect, useRef } from "react";

const STYLE_ID = "mp-sparkle-kf";

function injectKeyframe() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `@keyframes mp-spk {
    0%   { opacity:1; transform:translate(-50%,-50%) translate(0,0) scale(1); }
    60%  { opacity:0.7; }
    100% { opacity:0; transform:translate(-50%,-50%) translate(var(--tx),var(--ty)) scale(0.15); }
  }`;
  document.head.appendChild(s);
}

// Tope de destellos vivos a la vez: tocar rápido llegaba a acumular decenas de
// divs animados en <body>, cada uno con su box-shadow. Con el tope, un toque
// nuevo simplemente no añade más hasta que los anteriores se retiran.
const MAX_LIVE = 21;
let live = 0;

function spawnSparkle(x, y, palette) {
  const COUNT = 7;
  if (live + COUNT > MAX_LIVE) return;
  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement("div");
    const color = palette[Math.floor(Math.random() * palette.length)];
    const size = 3 + Math.random() * 7;
    const angle = (i / COUNT) * 360 + Math.random() * 22;
    const dist = 22 + Math.random() * 52;
    const rad = (angle * Math.PI) / 180;
    el.style.cssText = [
      "position:fixed",
      `left:${x}px`, `top:${y}px`,
      `width:${size}px`, `height:${size}px`,
      "border-radius:50%",
      `background:${color}`,
      `box-shadow:0 0 ${Math.round(size * 2)}px ${color}99`,
      "pointer-events:none", "z-index:9999",
      "transform:translate(-50%,-50%)",
      `--tx:${Math.cos(rad) * dist}px`,
      `--ty:${Math.sin(rad) * dist}px`,
      "animation:mp-spk 0.65s ease-out forwards",
    ].join(";");
    document.body.appendChild(el);
    live++;
    setTimeout(() => { el.remove(); live--; }, 720);
  }
}

// Couple-color sparkles — always active, updates when colors change
export default function ClickSparkles({ colors }) {
  const paletteRef = useRef([]);

  // Rebuild palette when couple colors change
  useEffect(() => {
    const p1 = colors?.person1 || "#a78bfa";
    const p2 = colors?.person2 || "#f472b6";
    const tg = colors?.together || "#34d399";
    // Weight toward p1 and p2 (their colors dominate)
    paletteRef.current = [p1, p1, p2, p2, p1, p2, tg];
  }, [colors]);

  // Register once — reads palette via ref so no re-registration needed
  useEffect(() => {
    // Con "reducir movimiento" activado no se generan destellos en absoluto.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    injectKeyframe();
    const handleClick = e => spawnSparkle(e.clientX, e.clientY, paletteRef.current);
    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      document.getElementById(STYLE_ID)?.remove();
    };
  }, []);

  return null;
}
