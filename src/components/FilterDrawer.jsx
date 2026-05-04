import { useState, useEffect } from "react";
import { S } from "../styles.js";

export default function FilterDrawer({
  open, onClose,
  filters, setFilters,
  persons, categories,
}) {
  // Local draft state — changes only apply when user taps "Aplicar"
  const [draft, setDraft] = useState(filters);

  // Reset draft when drawer opens
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePerson = id =>
    setDraft(d => ({ ...d, who: d.who.includes(id) ? d.who.filter(x=>x!==id) : [...d.who, id] }));
  const toggleCat = id =>
    setDraft(d => ({ ...d, cat: d.cat.includes(id) ? d.cat.filter(x=>x!==id) : [...d.cat, id] }));
  const clearAll = () => setDraft({ who:[], cat:[] });

  const apply = () => { setFilters(draft); onClose(); };

  const activeCount = draft.who.length + draft.cat.length;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:90,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition:"opacity .25s",
        }}
      />
      <div style={{
        position:"fixed", left:0, right:0, bottom:0, zIndex:100,
        background:"rgba(8,5,18,0.98)",
        borderTop:"1px solid rgba(167,139,250,0.3)",
        borderRadius:"18px 18px 0 0",
        padding:"16px 18px calc(28px + env(safe-area-inset-bottom))",
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition:"transform .3s cubic-bezier(.2,.9,.3,1.2)",
        maxHeight:"80vh", overflowY:"auto",
      }}>
        <div style={{ width:32, height:3, background:"#4a4166", borderRadius:99, margin:"0 auto 14px" }} />

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h4 style={{ fontFamily:"'Fraunces',serif", fontSize:18, margin:0, fontWeight:600 }}>
            Filtros {activeCount > 0 && <span style={{ fontSize:13, color:"#a78bfa" }}>({activeCount})</span>}
          </h4>
          <button
            onClick={clearAll}
            style={{ background:"none", border:"none", fontSize:12, color:"#a78bfa", fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}
          >
            Limpiar todo
          </button>
        </div>

        <div style={{ marginBottom:6 }}>
          <span style={S.label}>¿Quién?</span>
          <p style={{ fontSize:11, color:"#6b5f88", margin:"4px 0 8px" }}>Puedes combinar: ej. Persona 1 + Juntos</p>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {persons.map(p => {
              const on = draft.who.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePerson(p.id)}
                  style={{
                    fontSize:12, fontWeight:600, padding:"6px 13px", borderRadius:99,
                    border:`1px solid ${on ? p.color : "rgba(255,255,255,0.12)"}`,
                    background: on ? `${p.color}30` : "rgba(255,255,255,0.04)",
                    color: on ? p.color : "#8b7fa8",
                    cursor:"pointer", fontFamily:"inherit", transition:"all .15s",
                  }}
                >
                  {on ? "✓ " : ""}{p.emoji || "🙋"} {p.name}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom:18, marginTop:14 }}>
          <span style={S.label}>Categoría</span>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:8 }}>
            {categories.map(c => {
              const on = draft.cat.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCat(c.id)}
                  style={{
                    fontSize:11, fontWeight:600, padding:"5px 11px", borderRadius:99,
                    border:`1px solid ${on ? c.color : "rgba(255,255,255,0.1)"}`,
                    background: on ? `${c.color}30` : "rgba(255,255,255,0.03)",
                    color: on ? c.color : "#8b7fa8",
                    cursor:"pointer", fontFamily:"inherit", transition:"all .15s",
                  }}
                >
                  {on ? "✓ " : ""}{c.emoji} {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <button onClick={apply} style={{ ...S.btnPrimary, width:"100%", padding:"12px", fontSize:14 }}>
          Aplicar filtros {activeCount > 0 ? `(${activeCount})` : ""}
        </button>
      </div>
    </>
  );
}

export function FilterButton({ count, onClick }) {
  const active = count > 0;
  return (
    <button
      onClick={onClick}
      style={{
        display:"inline-flex", alignItems:"center", gap:6,
        background: active ? "rgba(167,139,250,0.18)" : "rgba(167,139,250,0.08)",
        border:`1px solid ${active ? "rgba(167,139,250,0.55)" : "rgba(167,139,250,0.3)"}`,
        color:"#a78bfa",
        padding:"7px 14px", borderRadius:99,
        fontSize:12, fontWeight:600, cursor:"pointer",
        fontFamily:"inherit",
      }}
    >
      ⚙ Filtros
      {count > 0 && (
        <span style={{
          background:"#a78bfa", color:"#080512",
          borderRadius:99, padding:"1px 7px",
          fontSize:10, fontWeight:700,
        }}>{count}</span>
      )}
    </button>
  );
}
