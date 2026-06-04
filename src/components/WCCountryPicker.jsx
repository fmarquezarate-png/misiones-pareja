import { useState } from "react";

export default function WCCountryPicker({ teams, selected, onChange, onClose }) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? teams.filter(t => t.name.toLowerCase().includes(search.trim().toLowerCase()))
    : teams;

  const toggle = name => {
    const next = selected.includes(name)
      ? selected.filter(n => n !== name)
      : [...selected, name];
    onChange(next);
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:1600, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.6)" }} />

      {/* Sheet */}
      <div style={{ position:"relative", background:"var(--t-card,#1d1733)", borderRadius:"20px 20px 0 0", maxHeight:"75vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"16px 16px 10px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontSize:14, fontWeight:700, color:"var(--t-text,#e2d9ff)" }}>
              🌍 Equipos favoritos
              {selected.length > 0 && <span style={{ fontSize:11, color:"#34d399", marginLeft:6, fontWeight:400 }}>({selected.length} seleccionados)</span>}
            </span>
            <div style={{ display:"flex", gap:6 }}>
              {selected.length > 0 && (
                <button onClick={() => onChange([])} style={{ background:"rgba(244,114,182,0.1)", border:"1px solid rgba(244,114,182,0.3)", borderRadius:99, color:"#f472b6", fontSize:11, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit" }}>
                  Limpiar
                </button>
              )}
              <button onClick={onClose} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:99, color:"var(--t-text-dim,#6b5f88)", fontSize:11, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit" }}>
                Listo ✓
              </button>
            </div>
          </div>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar país…"
            style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"var(--t-text,#e2d9ff)", fontSize:13, padding:"6px 10px", fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
          />
        </div>

        {/* Team grid */}
        <div style={{ overflowY:"auto", padding:"12px 12px 24px", display:"flex", flexWrap:"wrap", gap:7, alignContent:"flex-start" }}>
          {filtered.length === 0 && (
            <div style={{ color:"var(--t-text-dim,#6b5f88)", fontSize:13, fontStyle:"italic", padding:"8px 4px" }}>Sin resultados</div>
          )}
          {filtered.map(({ name, flag }) => {
            const sel = selected.includes(name);
            return (
              <button key={name} onClick={() => toggle(name)} style={{
                background: sel ? "rgba(52,211,153,0.18)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${sel ? "rgba(52,211,153,0.55)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 99, color: sel ? "#34d399" : "var(--t-text-dim,#9991b8)",
                fontSize: 12, padding: "5px 11px", cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
                fontWeight: sel ? 600 : 400,
              }}>
                {flag || "🏳"} {name}
                {sel && <span style={{ fontSize:10 }}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
