import { CAT_MAP } from "./constants.js";

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
