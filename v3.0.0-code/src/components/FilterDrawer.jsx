// FilterDrawer.jsx — v3.0.0
// Reemplaza la fila de chips de filtro inline por un drawer inferior con
// sections "¿Quién?" y "Categoría". Botón único en el header con contador.
//
// Props:
//   open: bool
//   onClose: () => void
//   filters: { who: string[], cat: string[] }
//   setFilters: updater
//   persons: [{ id:'p1', name:'Pololo', color:'#f472b6' }, ...]
//   categories: [{ id, label, emoji, color }, ...]

import { S } from "../styles.js";

export default function FilterDrawer({
  open, onClose,
  filters, setFilters,
  persons, categories,
}) {
  const togglePerson = id =>
    setFilters(f => ({ ...f, who: f.who.includes(id) ? f.who.filter(x=>x!==id) : [...f.who, id] }));
  const toggleCat = id =>
    setFilters(f => ({ ...f, cat: f.cat.includes(id) ? f.cat.filter(x=>x!==id) : [...f.cat, id] }));
  const clearAll = () => setFilters({ who:[], cat:[] });

  const isOnPerson = id => filters.who.includes(id);
  const isOnCat = id => filters.cat.includes(id);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:90,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition:"opacity .25s",
        }}
      />
      {/* Drawer */}
      <div style={{
        position:"fixed", left:0, right:0, bottom:0, zIndex:100,
        background:"rgba(8,5,18,0.98)",
        borderTop:"1px solid rgba(167,139,250,0.3)",
        borderRadius:"18px 18px 0 0",
        padding:"16px 18px 28px",
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition:"transform .3s cubic-bezier(.2,.9,.3,1.2)",
        maxWidth:560, margin:"0 auto",
      }}>
        <div style={{ width:32, height:3, background:"#4a4166", borderRadius:99, margin:"0 auto 14px" }} />

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h4 style={{ fontFamily:"'Fraunces',serif", fontSize:18, margin:0, fontWeight:600 }}>Filtros</h4>
          <button
            onClick={clearAll}
            style={{ background:"none", border:"none", fontSize:12, color:"#a78bfa", fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}
          >
            Limpiar todo
          </button>
        </div>

        {/* ¿Quién? */}
        <div style={{ marginBottom:14 }}>
          <span style={S.label}>¿Quién?</span>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:8 }}>
            {persons.map(p => {
              const on = isOnPerson(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePerson(p.id)}
                  style={{
                    fontSize:11, fontWeight:600, padding:"4px 10px", borderRadius:99,
                    border:`1px solid ${on ? p.color : "rgba(255,255,255,0.1)"}`,
                    background: on ? `${p.color}40` : "rgba(255,255,255,0.03)",
                    color: on ? "#fff" : "#8b7fa8",
                    cursor:"pointer", fontFamily:"inherit",
                  }}
                >
                  {on ? "✓ " : ""}{p.emoji || "🙋"} {p.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Categoría */}
        <div style={{ marginBottom:18 }}>
          <span style={S.label}>Categoría</span>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:8 }}>
            {categories.map(c => {
              const on = isOnCat(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCat(c.id)}
                  style={{
                    fontSize:11, fontWeight:600, padding:"4px 10px", borderRadius:99,
                    border:`1px solid ${on ? c.color : "rgba(255,255,255,0.1)"}`,
                    background: on ? `${c.color}40` : "rgba(255,255,255,0.03)",
                    color: on ? "#fff" : "#8b7fa8",
                    cursor:"pointer", fontFamily:"inherit",
                  }}
                >
                  {on ? "✓ " : ""}{c.emoji} {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <button onClick={onClose} style={{ ...S.btnPrimary, width:"100%", padding:"11px" }}>
          Aplicar filtros
        </button>
      </div>
    </>
  );
}

// Botón compacto que abre el drawer. Reemplaza la fila de chips inline.
export function FilterButton({ count, onClick }) {
  const active = count > 0;
  return (
    <button
      onClick={onClick}
      style={{
        display:"inline-flex", alignItems:"center", gap:6,
        background:"rgba(167,139,250,0.12)",
        border:"1px solid rgba(167,139,250,0.4)",
        color:"#a78bfa",
        padding:"7px 14px", borderRadius:99,
        fontSize:12, fontWeight:600, cursor:"pointer",
        fontFamily:"inherit", position:"relative",
      }}
    >
      ⚙ Filtros
      {count > 0 && (
        <span style={{
          background:"#a78bfa", color:"#080512",
          borderRadius:99, width:18, height:18,
          fontSize:10, fontWeight:700,
          display:"inline-flex", alignItems:"center", justifyContent:"center",
        }}>{count}</span>
      )}
      {active && (
        <span style={{
          position:"absolute", top:5, right:5, width:6, height:6,
          borderRadius:99, background:"#34d399",
          boxShadow:"0 0 0 2px #080512",
        }} />
      )}
    </button>
  );
}
