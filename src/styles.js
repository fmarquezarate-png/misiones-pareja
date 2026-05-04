import { CAT_MAP } from "./constants.js";

// ─────────────────────────────────────────────────────────────────────────────
// styles.js — v3.0.0
// Conserva todos los exports de v2.5 (S, badgeStyle, catBadgeStyle) +
// añade T (tokens) y nuevas helper styles para v3.
// ─────────────────────────────────────────────────────────────────────────────

export const T = {
  pink:    "#f472b6",
  purple:  "#a78bfa",
  green:   "#34d399",
  blue:    "#60a5fa",
  orange:  "#fb923c",
  red:     "#f87171",
  yellow:  "#fbbf24",
  bg:      "#080512",
  card:    "#1d1733",
  fg1:     "#f8f4ff",
  fg2:     "#f0e8ff",
  fg3:     "#c4b8ff",
  muted:   "#8b7fa8",
  dim:     "#6b5f88",
  faint:   "#4a4166",
  ghost:   "#3d3360",
  hairline:"rgba(167,139,250,0.18)",
  fontDisplay: "'Fraunces', Georgia, serif",
};

export const whoHex = (who, colors) => {
  const c = colors || { person1: T.pink, person2: T.purple, together: T.green };
  return who === "person1" ? c.person1 : who === "person2" ? c.person2 : c.together;
};

// ─── Original v2.5 exports — unchanged ────────────────────────────────────
export const S = {
  card:      { background:"#1d1733", border:"1px solid rgba(167,139,250,0.12)", borderRadius:14, padding:"14px 16px" },
  input:     { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(167,139,250,0.25)", borderRadius:8, padding:"8px 12px", color:"#f8f4ff", fontSize:14, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" },
  inputSm:   { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(167,139,250,0.2)", borderRadius:7, padding:"5px 8px", color:"#f8f4ff", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" },
  btnNav:    { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(167,139,250,0.2)", borderRadius:8, color:"#a78bfa", fontSize:22, width:38, height:38, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit", lineHeight:1, flexShrink:0 },
  btnPrimary:   { background:"linear-gradient(135deg,#f472b6,#a78bfa)", border:"none", borderRadius:8, color:"#fff", padding:"7px 14px", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"inherit" },
  btnSecondary: { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#8b7fa8", padding:"7px 14px", cursor:"pointer", fontSize:13, fontFamily:"inherit" },
  label:     { fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", fontWeight:600, marginBottom:6, display:"block" },
};

export const badgeStyle = s => ({
  background: s === "TBC" ? "rgba(148,163,184,0.12)" : s === "ASAP" ? "rgba(251,146,60,0.12)" : s === "IN_PROGRESS" ? "rgba(96,165,250,0.12)" : "rgba(52,211,153,0.12)",
  color:      s === "TBC" ? "#94a3b8"                : s === "ASAP" ? "#fb923c"                : s === "IN_PROGRESS" ? "#60a5fa"                : "#34d399",
  border:    `1px solid ${s === "TBC" ? "rgba(148,163,184,0.3)" : s === "ASAP" ? "rgba(251,146,60,0.3)" : s === "IN_PROGRESS" ? "rgba(96,165,250,0.3)" : "rgba(52,211,153,0.3)"}`,
  padding: "3px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600, fontFamily: "inherit",
  letterSpacing: 0.3, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4,
});

export const catBadgeStyle = catId => {
  const c = CAT_MAP[catId];
  if (!c) return {};
  return { background:`${c.color}18`, color:c.color, border:`1px solid ${c.color}40`, padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600, display:"flex", alignItems:"center", gap:3, whiteSpace:"nowrap" };
};

// ─── v3 additions ──────────────────────────────────────────────────────────

export const cardV3 = (whoColor) => ({
  background:"#1d1733",
  border:"1px solid rgba(167,139,250,0.12)",
  borderLeft: whoColor ? `3px solid ${whoColor}` : "1px solid rgba(167,139,250,0.12)",
  borderRadius: 14,
  padding: "12px 14px",
});

export const weekHero = {
  background: "linear-gradient(135deg, rgba(167,139,250,0.10), rgba(244,114,182,0.06))",
  border: "1px solid rgba(167,139,250,0.30)",
  borderRadius: 16,
  padding: 14,
  display: "flex",
  gap: 14,
  alignItems: "center",
};

export const homeHero = {
  background: "linear-gradient(135deg, rgba(244,114,182,0.10), rgba(167,139,250,0.10))",
  border: "1px solid rgba(244,114,182,0.25)",
  borderRadius: 16,
  padding: 14,
  display: "flex",
  gap: 12,
  alignItems: "center",
};

export const widget = {
  background: "#1d1733",
  border: "1px solid rgba(167,139,250,0.18)",
  borderRadius: 12,
  padding: 11,
  cursor: "pointer",
  transition: "all .15s ease",
};

export const pill = (active = false, color = T.purple) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 11px",
  borderRadius: 99,
  fontSize: 11.5,
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
  border: `1px solid ${active ? color : "rgba(255,255,255,0.08)"}`,
  background: active ? `${color}22` : "rgba(255,255,255,0.04)",
  color: active ? color : "#8b7fa8",
  transition: "all .15s",
});

export const eyebrow = {
  fontSize: 10,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: T.dim,
  fontWeight: 700,
};
