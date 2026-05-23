import { useState } from "react";
import Brand from "./Brand.jsx";
import OverflowMenu, { OverflowButton } from "./OverflowMenu.jsx";

export default function Topbar({
  activeTab, setActiveTab, setMenuOpen,
  currentWeekNumber, savingState, onForcePush,
  isDark, onToggleDark,
  onCheckUpdate, onSmartSync, syncing,
  onDownloadICS, onDownloadPDF,
  onShowProfile, onExport, importFileRef, onSignOut,
  colors,
}) {
  const [popOpen,      setPopOpen]      = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div style={{ position:"sticky", top:0, zIndex:80, background:"var(--t-topbar-bg,rgba(10,7,20,0.9))", backdropFilter:"blur(14px)", WebkitBackdropFilter:"blur(14px)", borderBottom:"1px solid var(--t-card-border,rgba(167,139,250,0.08))", paddingTop:"env(safe-area-inset-top)" }}>
    <div style={{ height:52, display:"flex", alignItems:"center", gap:8, paddingLeft:12, paddingRight:12 }}>

      {/* Hamburger */}
      <button onClick={() => setMenuOpen(v => !v)} aria-label="Menú"
        style={{ background:"none", border:"none", cursor:"pointer", color:"var(--t-text-muted,#8b7fa8)", padding:"8px 6px", display:"flex", flexDirection:"column", gap:4, alignItems:"center", justifyContent:"center", flexShrink:0, borderRadius:8 }}>
        <span style={{ display:"block", width:18, height:1.5, background:"currentColor", borderRadius:99 }} />
        <span style={{ display:"block", width:13, height:1.5, background:"currentColor", borderRadius:99 }} />
        <span style={{ display:"block", width:18, height:1.5, background:"currentColor", borderRadius:99 }} />
      </button>

      {/* Home */}
      <button onClick={() => setActiveTab("home")} aria-label="Inicio"
        style={{ background:"none", border:"none", cursor:"pointer", color:activeTab==="home"?"#c4b8ff":"#4a4166", fontSize:18, padding:"6px 5px", lineHeight:1, borderRadius:8, flexShrink:0, transition:"color 0.15s" }}>🏠</button>

      {/* Page title */}
      <div style={{ flex:1, textAlign:"center" }}>
        {activeTab==="home"
          ? <Brand size={22} wordmark colors={colors} />
          : <span style={{ fontSize:13, fontWeight:500, color:"var(--t-text-muted,#8b7fa8)" }}>
              {activeTab==="current"  ? `🎯 Semana ${currentWeekNumber}`
              :activeTab==="pending"  ? "📋 Pendientes"
              :activeTab==="calendar" ? "Calendario"
              :activeTab==="history"  ? "🗂️ Histórico"
              :activeTab==="goals"    ? "🏅 Metas"
              :activeTab==="stats"    ? "📊 Stats"
              :activeTab==="gastos"   ? "💸 Gastos Compartidos"
              :activeTab==="chat"     ? "💬 Chat"
              :activeTab==="links"    ? "🔗 Links de Interés"
              : ""}
            </span>
        }
      </div>

      {/* Saving indicator dot */}
      {savingState !== "idle" && (
        <div
          role={savingState === "error" ? "button" : undefined}
          onClick={savingState === "error" ? onForcePush : undefined}
          title={savingState === "saving" ? "Guardando…" : savingState === "saved" ? "Guardado ✓" : "Error al guardar — toca para reintentar"}
          aria-label={savingState === "saving" ? "Guardando…" : savingState === "saved" ? "Guardado" : "Error al guardar — toca para reintentar"}
          style={{
            width:savingState==="error"?20:7, height:savingState==="error"?20:7, borderRadius:99, flexShrink:0,
            cursor:savingState==="error"?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center",
            background: savingState==="saving"?"#a78bfa":savingState==="saved"?"#34d399":"rgba(248,113,113,0.15)",
            border: savingState==="error"?"1.5px solid #f87171":"none",
            animation: savingState==="saving"?"sc-dot-pulse 1s ease-in-out infinite":savingState==="saved"?"sc-saved-fade 2s ease-out 0.5s forwards":"none",
            boxShadow: savingState==="saving"?"0 0 6px rgba(167,139,250,0.6)":savingState==="saved"?"0 0 6px rgba(52,211,153,0.6)":"0 0 4px rgba(248,113,113,0.4)",
          }}>
          {savingState === "error" && <span style={{ fontSize:11, color:"#f87171", lineHeight:1 }}>!</span>}
        </div>
      )}

      {/* Dark/light toggle */}
      <button onClick={onToggleDark} aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
        title={isDark ? "Modo claro" : "Modo oscuro"}
        style={{ background:"none", border:"none", cursor:"pointer", color:"var(--t-text-muted,#8b7fa8)", fontSize:16, padding:"6px 5px", lineHeight:1, borderRadius:8, flexShrink:0 }}>
        <span aria-hidden="true">{isDark ? "☀️" : "🌙"}</span>
      </button>

      {/* Overflow menu ⋯ */}
      <div style={{ position:"relative", flexShrink:0 }}>
        <OverflowButton onClick={() => setPopOpen(o => !o)} />
        <OverflowMenu open={popOpen} onClose={() => setPopOpen(false)} items={[
          { icon:"↻", label:"Actualizar versión", onClick: onCheckUpdate },
          { icon:"🔄", label: syncing ? "Sincronizando…" : "Sincronizar datos", onClick: () => { onSmartSync(); setPopOpen(false); } },
          { divider: true },
          { icon:"📅", label:"Exportar a Google Calendar (.ics)", onClick: () => { onDownloadICS(); setPopOpen(false); } },
          { icon:"🖨", label:"Imprimir / PDF", onClick: () => { onDownloadPDF(); setPopOpen(false); } },
        ]} />
      </div>

      {/* Settings dropdown ⚙️ */}
      <div style={{ position:"relative", flexShrink:0 }}>
        <button onClick={() => setSettingsOpen(v => !v)} aria-label="Ajustes"
          style={{ background:"rgba(128,128,128,0.06)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.15))", borderRadius:8, color:"var(--t-text-dim,#6b5f88)", width:34, height:34, cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>⚙️</button>
        {settingsOpen && <>
          <div onClick={() => setSettingsOpen(false)} style={{ position:"fixed", inset:0, zIndex:110 }} />
          <div style={{ position:"absolute", top:40, right:0, background:"var(--t-menu-bg,rgba(12,8,26,0.98))", border:"1px solid var(--t-card-border,rgba(167,139,250,0.15))", borderRadius:12, padding:"6px 0", zIndex:120, minWidth:180, backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", boxShadow:"0 8px 32px rgba(0,0,0,0.5)" }}>
            {[
              { icon:"👤", label:"Mi perfil",  action:() => { onShowProfile(); setSettingsOpen(false); } },
              { icon:"📥", label:"Exportar",   action:() => { onExport(); setSettingsOpen(false); } },
              { icon:"📤", label:"Importar",   action:() => { importFileRef.current?.click(); setSettingsOpen(false); } },
              { icon:"🔄", label:syncing?"Sincronizando…":"Sincronizar datos", action:() => { onSmartSync(); setSettingsOpen(false); } },
            ].map((item,i) => (
              <button key={i} onClick={item.action}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 16px", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, color:"#c4b8ff", width:"100%", textAlign:"left", transition:"background 0.12s" }}
                onMouseEnter={e => e.currentTarget.style.background="var(--t-accent-soft,rgba(167,139,250,0.1))"}
                onMouseLeave={e => e.currentTarget.style.background="none"}>
                <span style={{ fontSize:15 }}>{item.icon}</span>{item.label}
              </button>
            ))}
            <div style={{ height:1, background:"var(--t-card-border,rgba(167,139,250,0.1))", margin:"4px 0" }} />
            <button onClick={() => { onSignOut(); setSettingsOpen(false); }}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 16px", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, color:"#f472b6", width:"100%", textAlign:"left" }}
              onMouseEnter={e => e.currentTarget.style.background="rgba(244,114,182,0.08)"}
              onMouseLeave={e => e.currentTarget.style.background="none"}>
              <span style={{ fontSize:15 }}>🚪</span>Cerrar sesión
            </button>
          </div>
        </>}
      </div>

    </div></div>
  );
}
