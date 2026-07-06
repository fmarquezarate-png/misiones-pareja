import { useState, useEffect } from "react";
import { APP_VERSION, LAST_UPDATE } from "../constants.js";

const NAV_ITEMS = [
  { id:"home",     label:"Inicio",          icon:"🏠" },
  { id:"calendar", label:"Calendario",       icon:"📅" },
  { id:"current",  label:"Semana",           icon:"🎯" },
  { id:"pending",  label:"Pendientes",       icon:"📋" },
  { id:"goals",    label:"Metas",            icon:"🏅" },
  { id:"stats",    label:"Stats",            icon:"📊" },
  { id:"history",  label:"Histórico",        icon:"🗂️" },
  { id:"wishlist",   label:"Lista de compras", icon:"🛍️" },
  { id:"mood",       label:"Ánimo",            icon:"🧠" },
  { id:"gastos",   label:"Gastos",           icon:"💸" },
  { id:"chat",     label:"Chat",             icon:"💬" },
  { id:"links",      label:"Links de Interés", icon:"🔗" },
  { id:"birthdays",  label:"Cumpleaños",       icon:"🎂" },
  { id:"timecapsule", label:"Cápsula del tiempo", icon:"✉️" },
];

export default function SideMenu({ open, onClose, activeTab, onNavigate, couplePhoto, coupleEmoji, p1, p2, syncMsg, onShowProfile, chatUnread = 0 }) {
  const [showChangelog, setShowChangelog] = useState(false);
  // ~100KB de texto (historial de versiones) — separado del bundle inicial.
  // Se descarga solo la primera vez que se abre "Ver cambios", no en cada
  // arranque de la app (impacto directo en el tiempo de carga en iOS).
  const [changelog, setChangelog] = useState(null);
  useEffect(() => {
    if (showChangelog && !changelog) {
      import("../data/changelogData.js").then(m => setChangelog(m.CHANGELOG));
    }
  }, [showChangelog, changelog]);

  return (
    <>
      {/* Backdrop */}
      {open && <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:90, backdropFilter:"blur(3px)", WebkitBackdropFilter:"blur(3px)" }} />}

      {/* Slide-out panel */}
      <div style={{ position:"fixed", top:0, left:0, bottom:0, width:248, background:"var(--t-menu-bg,rgba(12,8,26,0.97))", borderRight:"1px solid var(--t-card-border,rgba(167,139,250,0.1))", zIndex:100, transform:open?"translateX(0)":"translateX(-100%)", transition:"transform 0.26s cubic-bezier(0.4,0,0.2,1)", display:"flex", flexDirection:"column", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)" }}>
        {/* Header — clickable, abre el perfil */}
        <button
          onClick={onShowProfile}
          aria-label="Abrir mi perfil"
          className="sc-menu-header"
          style={{ paddingTop:"calc(18px + env(safe-area-inset-top))", paddingLeft:20, paddingRight:16, paddingBottom:16, borderBottom:"1px solid var(--t-card-border,rgba(167,139,250,0.07))", display:"flex", alignItems:"center", gap:12, background:"linear-gradient(135deg, var(--t-accent-soft,rgba(167,139,250,0.10)), transparent 80%)", border:"none", borderRadius:0, cursor:"pointer", fontFamily:"inherit", textAlign:"left", width:"100%", transition:"background 0.18s" }}>
          {couplePhoto
            ? <img src={couplePhoto} style={{ width:48, height:48, borderRadius:99, objectFit:"cover", border:"2px solid var(--t-accent,#a78bfa)", flexShrink:0, boxShadow:"0 0 0 3px var(--t-accent-soft,rgba(167,139,250,0.12))" }} alt="pareja" />
            : <div style={{ width:48, height:48, borderRadius:99, background:"var(--t-accent-soft,rgba(167,139,250,0.1))", border:"2px solid var(--t-accent,#a78bfa)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0, boxShadow:"0 0 0 3px var(--t-accent-soft,rgba(167,139,250,0.12))" }}>{coupleEmoji||"💞"}</div>
          }
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, color:"var(--t-text,#f8f4ff)", fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p1} & {p2}</div>
            <div style={{ fontSize:10.5, color:"var(--t-accent,#a78bfa)", marginTop:2, display:"flex", alignItems:"center", gap:4, fontWeight:500 }}>
              <span aria-hidden="true">✏️</span> Editar perfil
            </div>
          </div>
          <span aria-hidden="true" style={{ fontSize:14, color:"var(--t-text-dim,#4a4166)", flexShrink:0 }}>›</span>
        </button>

        {/* Nav items */}
        <nav aria-label="Navegación principal" style={{ flex:1, padding:"10px 8px", display:"flex", flexDirection:"column", gap:2, overflowY:"auto" }}>
          {NAV_ITEMS.map(n => (
            <button key={n.id} onClick={() => onNavigate(n.id)}
              aria-label={n.label} aria-current={activeTab===n.id ? "page" : undefined}
              className="sc-nav-btn"
              style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:10, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:activeTab===n.id?600:400, background:activeTab===n.id?"var(--t-accent-soft,rgba(167,139,250,0.14))":"transparent", color:activeTab===n.id?"var(--t-accent,#c4b8ff)":"var(--t-text-muted,#6b5f88)", textAlign:"left", width:"100%", transition:"all 0.15s" }}>
              <span aria-hidden="true" style={{ fontSize:17, lineHeight:1 }}>{n.icon}</span>
              <span style={{ flex:1 }}>{n.label}</span>
              {n.id==="chat" && chatUnread > 0 && (
                <span style={{ background:"#f43f5e", color:"#fff", fontSize:10, fontWeight:700, borderRadius:99, minWidth:18, height:18, padding:"0 5px", boxSizing:"border-box", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {chatUnread > 99 ? "99+" : chatUnread}
                </span>
              )}
              {activeTab===n.id && <span aria-hidden="true" style={{ width:5, height:5, borderRadius:99, background:"var(--t-accent,#a78bfa)", flexShrink:0 }} />}
            </button>
          ))}
        </nav>

        {/* Footer — version + changelog trigger */}
        <div style={{ padding:"12px 16px", borderTop:"1px solid var(--t-card-border,rgba(167,139,250,0.07))", flexShrink:0 }}>
          {syncMsg && <div style={{ fontSize:10, color:syncMsg.startsWith("⚠")?"#fb923c":syncMsg.startsWith("✓")?"#34d399":"#60a5fa", marginBottom:6, lineHeight:1.4 }}>{syncMsg}</div>}
          <button onClick={() => setShowChangelog(true)}
            style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 0", display:"flex", gap:8, alignItems:"center", width:"100%" }}>
            <span style={{ fontSize:11, fontWeight:700, color:"#fbbf24", letterSpacing:0.5, textShadow:"0 0 8px rgba(251,191,36,0.35)" }}>v{APP_VERSION}</span>
            <span style={{ fontSize:10, color:"var(--t-text-dim,#3d3360)" }}>{LAST_UPDATE}</span>
            <span style={{ fontSize:10, color:"var(--t-text-dim,#3d3360)", marginLeft:"auto" }}>Ver cambios →</span>
          </button>
        </div>
      </div>

      {/* Changelog modal — only ever opened from here */}
      {showChangelog && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={() => setShowChangelog(false)}>
          <div style={{ background:"var(--t-card,#1d1733)", border:"1px solid rgba(251,191,36,0.3)", borderRadius:18, padding:24, width:"100%", maxWidth:420, maxHeight:"80vh", overflowY:"auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <span style={{ fontFamily:"'Fraunces',serif", fontSize:20, color:"var(--t-accent,#fbbf24)" }}>📋 Changelog</span>
              <button onClick={() => setShowChangelog(false)} style={{ background:"none", border:"none", color:"var(--t-text-muted,#6b5f88)", fontSize:20, cursor:"pointer" }}>×</button>
            </div>
            {!changelog ? (
              <div style={{ textAlign:"center", padding:"20px 0", color:"var(--t-text-muted,#8b7fa8)", fontSize:13 }}>Cargando…</div>
            ) : changelog.map(c => (
              <div key={c.v} style={{ marginBottom:16 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"var(--t-accent,#fbbf24)" }}>v{c.v}</span>
                  <span style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)" }}>{c.date}</span>
                </div>
                <ul style={{ margin:0, padding:"0 0 0 16px" }}>
                  {c.notes.map((n,i) => <li key={i} style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)", marginBottom:3 }}>{n}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
