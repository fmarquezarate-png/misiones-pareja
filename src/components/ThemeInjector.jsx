import { useEffect } from "react";
import { THEMES, FONTS, STATUS, CATEGORIES } from "../constants.js";
import { readableOn, AA_LARGE } from "../lib/contrast.js";

const DEFAULT_CLR = { person1: "#f472b6", person2: "#a78bfa", together: "#34d399" };

function hexToRgba(hex, a) {
  if (!hex?.startsWith?.("#") || hex.length < 7) return "rgba(128,128,128," + a + ")";
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function ThemeInjector({ themeId, fontId, colors }) {
  useEffect(() => {
    if (document.getElementById("global-cursor")) return;
    const s = document.createElement("style");
    s.id = "global-cursor";
    s.textContent = `*,*::before,*::after{user-select:none;-webkit-user-select:none}input,textarea,[contenteditable=true]{user-select:text;-webkit-user-select:text;cursor:text!important}button,a,select,label{cursor:pointer!important}`;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    const t = THEMES.find(x => x.id === themeId) || THEMES[0];
    const f = FONTS.find(x => x.id === fontId);
    const useCustomFont = f && f.id !== "auto";

    const LINK_ID = "theme-font";
    let link = document.getElementById(LINK_ID);
    const fontUrl = useCustomFont ? f.googleFonts : t.googleFonts;
    if (fontUrl) {
      if (!link) { link = document.createElement("link"); link.id = LINK_ID; link.rel = "stylesheet"; document.head.appendChild(link); }
      link.href = fontUrl;
    } else if (link) {
      link.href = "";
    }

    const r = document.documentElement.style;
    r.setProperty("--t-bg",          t.bg);
    r.setProperty("--t-bg-grad",     t.bgGrad);
    r.setProperty("--t-menu-bg",     t.menuBg);
    r.setProperty("--t-topbar-bg",   t.topBarBg);
    r.setProperty("--t-card",        t.card);
    r.setProperty("--t-card-border", t.cardBorder);
    r.setProperty("--t-btn-grad",    t.btnGrad);
    r.setProperty("--t-accent",      t.accent);
    r.setProperty("--t-accent-soft", t.accentSoft);
    r.setProperty("--t-font-body",   useCustomFont ? f.family : t.fontBody);
    r.setProperty("--t-text",        t.text      || "#f8f4ff");
    r.setProperty("--t-text-muted",  t.textMuted || "#8b7fa8");
    r.setProperty("--t-text-dim",    t.textDim   || "#4a4166");
    r.setProperty("--t-error",       t.error     || "#f87171");
    r.setProperty("--t-input-bg",    t.dark === false ? "rgba(0,0,0,0.05)" : "rgba(128,128,128,0.10)");

    // ── Tintas legibles de los colores FIJOS ────────────────────────────────
    // Los colores de estado y categoría son los mismos en todos los temas y
    // nacieron para fondo oscuro: sobre las tarjetas casi blancas de los temas
    // claros daban 1.6–2.8:1 (el amarillo de "Trabajo", 1.64 — invisible).
    // Aquí se publica, por tema, la versión con la luminosidad ajustada hasta
    // cumplir; el tono se conserva, así que sigue siendo el mismo color.
    // El color original se mantiene para rellenos y bordes, que no son texto.
    for (const [id, s] of Object.entries(STATUS)) {
      r.setProperty(`--t-ink-status-${id}`, readableOn(s.color, t.card, AA_LARGE, t.bg));
    }
    for (const c of CATEGORIES) {
      r.setProperty(`--t-ink-cat-${c.id}`, readableOn(c.color, t.card, AA_LARGE, t.bg));
    }

    document.documentElement.style.background = t.bg;
    try {
      const vars = {
        "--t-bg": t.bg, "--t-bg-grad": t.bgGrad, "--t-menu-bg": t.menuBg,
        "--t-topbar-bg": t.topBarBg, "--t-card": t.card, "--t-card-border": t.cardBorder,
        "--t-btn-grad": t.btnGrad, "--t-accent": t.accent, "--t-accent-soft": t.accentSoft,
        "--t-font-body": useCustomFont ? f.family : t.fontBody,
        "--t-text": t.text || "#f8f4ff", "--t-text-muted": t.textMuted || "#8b7fa8",
        "--t-text-dim": t.textDim || "#4a4166", "--t-error": t.error || "#f87171",
        "--t-input-bg": t.dark === false ? "rgba(0,0,0,0.05)" : "rgba(128,128,128,0.10)",
      };
      localStorage.setItem("mp_theme", JSON.stringify(vars));
      localStorage.setItem("mp-quick-bg", t.bg);
    } catch {}
  }, [themeId, fontId]);

  useEffect(() => {
    const p1  = colors?.person1  || DEFAULT_CLR.person1;
    const p2  = colors?.person2  || DEFAULT_CLR.person2;
    const tog = colors?.together || DEFAULT_CLR.together;
    const t = THEMES.find(x => x.id === themeId) || THEMES[0];
    const r = document.documentElement.style;
    r.setProperty("--t-p1",          p1);
    r.setProperty("--t-p2",          p2);
    r.setProperty("--t-together",    tog);
    // Versión legible como TEXTO de los colores de cada persona (los de arriba
    // se siguen usando tal cual para rellenos, orbes y raíles de color).
    r.setProperty("--t-p1-ink",       readableOn(p1,  t.card, AA_LARGE, t.bg));
    r.setProperty("--t-p2-ink",       readableOn(p2,  t.card, AA_LARGE, t.bg));
    r.setProperty("--t-together-ink", readableOn(tog, t.card, AA_LARGE, t.bg));
    r.setProperty("--t-thread",      `linear-gradient(135deg,${p1},${p2})`);
    r.setProperty("--t-p1-10",       hexToRgba(p1,  0.10));
    r.setProperty("--t-p1-15",       hexToRgba(p1,  0.15));
    r.setProperty("--t-p2-10",       hexToRgba(p2,  0.10));
    r.setProperty("--t-p2-15",       hexToRgba(p2,  0.15));
    r.setProperty("--t-together-10", hexToRgba(tog, 0.10));
  }, [themeId, colors?.person1, colors?.person2, colors?.together]);

  return null;
}
