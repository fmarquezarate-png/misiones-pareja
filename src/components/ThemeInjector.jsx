import { useEffect } from "react";
import { THEMES, FONTS } from "../constants.js";

export default function ThemeInjector({ themeId, fontId }) {
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

  return null;
}
