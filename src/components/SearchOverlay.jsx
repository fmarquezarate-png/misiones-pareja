import { useState, useMemo, useEffect, useRef } from "react";
import { STATUS, DEFAULT_COLORS } from "../constants.js";
import { weekStartDate } from "../lib/appUtils.js";

// Búsqueda insensible a mayúsculas y tildes ("cañeria" encuentra "Cañería")
const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const pad2 = n => String(n).padStart(2, "0");
const localYmd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export default function SearchOverlay({ weeks, p1, p2, colors, onClose, onGoToWeek }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  const clr = colors || DEFAULT_COLORS;

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    const nq = norm(q.trim());
    if (nq.length < 2) return null; // null = aún no se busca
    const out = [];
    for (const [key, w] of Object.entries(weeks || {})) {
      const wn = w.weekNumber ?? parseInt(key.split("-W")[1]);
      const yr = w.year ?? parseInt(key.split("-W")[0]);
      if (!wn || !yr) continue;
      for (const m of (w.missions || [])) {
        if (norm(m.title).includes(nq)) {
          out.push({ m, key, wn, yr, sortKey: m.date || localYmd(weekStartDate(wn, yr)) });
        }
      }
    }
    out.sort((a, b) => b.sortKey.localeCompare(a.sortKey)); // más recientes primero
    return out.slice(0, 50);
  }, [q, weeks]);

  const whoLabel = who => who === "person1" ? p1 : who === "person2" ? p2 : "Juntos";
  const whoColor = who => who === "person1" ? clr.person1 : who === "person2" ? clr.person2 : clr.together;

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", zIndex:180, display:"flex", flexDirection:"column", backdropFilter:"blur(4px)", WebkitBackdropFilter:"blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ maxWidth:640, width:"100%", margin:"0 auto", padding:"calc(16px + env(safe-area-inset-top)) 16px 16px", display:"flex", flexDirection:"column", flex:1, minHeight:0 }}>
        {/* Search input */}
        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:14 }}>
          <div style={{ flex:1, position:"relative" }}>
            <span aria-hidden="true" style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:15, pointerEvents:"none" }}>🔍</span>
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar tareas y eventos…"
              autoComplete="off"
              style={{ width:"100%", boxSizing:"border-box", background:"var(--t-card,#1d1733)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.3))", borderRadius:14, color:"var(--t-text,#f8f4ff)", fontSize:15, padding:"13px 14px 13px 40px", fontFamily:"inherit", outline:"none" }}
            />
          </div>
          <button onClick={onClose} aria-label="Cerrar búsqueda"
            style={{ background:"rgba(255,255,255,0.07)", border:"none", borderRadius:12, color:"var(--t-text-muted,#8b7fa8)", fontSize:19, width:44, height:44, cursor:"pointer", flexShrink:0, lineHeight:1 }}>×</button>
        </div>

        {/* Results */}
        <div style={{ flex:1, overflowY:"auto", minHeight:0, display:"flex", flexDirection:"column", gap:8, paddingBottom:"env(safe-area-inset-bottom)" }}>
          {results === null && (
            <div style={{ textAlign:"center", color:"var(--t-text-dim,#4a4166)", fontSize:13, padding:"36px 20px", lineHeight:1.7 }}>
              Escribe al menos 2 letras.<br />Busca en todas las semanas, pasadas y futuras.
            </div>
          )}
          {results !== null && results.length === 0 && (
            <div style={{ textAlign:"center", color:"var(--t-text-muted,#8b7fa8)", fontSize:13, padding:"36px 20px" }}>
              Sin resultados para «{q.trim()}»
            </div>
          )}
          {results !== null && results.length > 0 && (
            <>
              <div style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)", padding:"0 2px" }}>{results.length}{results.length === 50 ? "+" : ""} resultado{results.length !== 1 ? "s" : ""}</div>
              {results.map(({ m, key, wn, yr }) => {
                const st = STATUS[m.status] || STATUS.TBC;
                return (
                  <button key={`${key}-${m.id}`} onClick={() => onGoToWeek(wn, yr)}
                    style={{ display:"flex", alignItems:"center", gap:10, background:"var(--t-card,#1d1733)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.15))", borderRadius:12, padding:"11px 13px", cursor:"pointer", fontFamily:"inherit", textAlign:"left", width:"100%" }}>
                    <span style={{ fontSize:20, flexShrink:0 }}>{m.emoji || (m.type === "event" ? "📅" : "🎯")}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, color:"var(--t-text,#f8f4ff)", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textDecoration:m.status==="DONE"?"line-through":"none", opacity:m.status==="DONE"?0.65:1 }}>{m.title}</div>
                      <div style={{ display:"flex", gap:8, marginTop:3, fontSize:11, flexWrap:"wrap" }}>
                        <span style={{ color:whoColor(m.who), fontWeight:600 }}>{whoLabel(m.who)}</span>
                        <span style={{ color:"var(--t-text-dim,#4a4166)" }}>Semana {wn} · {yr}</span>
                        {m.date && <span style={{ color:"var(--t-text-dim,#4a4166)" }}>📆 {m.date}{m.time ? ` ${m.time}` : ""}</span>}
                      </div>
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, color:st.color, flexShrink:0, whiteSpace:"nowrap" }}>{st.label}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
