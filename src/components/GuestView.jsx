import { useState, useEffect } from "react";
import { fetchSharedView } from "../supabase.js";
import { isoWeekKey } from "../utils.js";
import { STATUS, DEFAULT_COLORS } from "../constants.js";

// dismissSplash vive también en App.jsx — duplicado a propósito (no importado)
// porque GuestView es una rama de render totalmente aparte del flujo con
// sesión, y nada en AppWithAuth/CoupleMissions llega a montarse para este caso.
function dismissSplash() {
  const splash = document.getElementById("mp-splash");
  if (!splash) return;
  splash.classList.add("mp-hidden");
  setTimeout(() => splash.remove(), 380);
}

// Vista de solo lectura para un tercero (familiar, cuidadora) que recibió un
// enlace de "Compartir" desde Perfil. No pasa por auth — se resuelve entero
// contra la Edge Function get-shared-view. Sin botones de editar/borrar/ciclar
// estado: es una foto del plan, no una sesión de la pareja.
export default function GuestView({ coupleId, token }) {
  const [state, setState] = useState("loading"); // loading | error | ready
  const [view, setView] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);

  // Sin esto, el splash pre-React (index.html, z-index 9999) se queda pegado
  // para siempre — nada en el flujo con sesión lo dismissea porque esta rama
  // nunca monta AppWithAuth/CoupleMissions.
  useEffect(() => { dismissSplash(); }, []);

  useEffect(() => {
    fetchSharedView(coupleId, token).then(data => {
      if (!data) { setState("error"); return; }
      setView(data);
      setState("ready");
    });
  }, [coupleId, token]);

  if (state === "loading") {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0a0714", color:"#8b7fa8", fontFamily:"system-ui" }}>
        Cargando el plan…
      </div>
    );
  }

  if (state === "error") {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0a0714", color:"#f8f4ff", fontFamily:"system-ui", padding:24, textAlign:"center" }}>
        <div>
          <div style={{ fontSize:44, marginBottom:14 }}>🔒</div>
          <div style={{ fontSize:16, fontWeight:600, marginBottom:8 }}>Este enlace no es válido</div>
          <div style={{ fontSize:13, color:"#8b7fa8", lineHeight:1.6 }}>Puede que haya sido revocado, o que la pareja haya generado uno nuevo.<br/>Pide un enlace actualizado.</div>
        </div>
      </div>
    );
  }

  const clr = { ...DEFAULT_COLORS, ...(view.settings?.colors||{}) };
  const p1 = view.settings?.person1 || "Persona 1";
  const p2 = view.settings?.person2 || "Persona 2";
  const whoLabel = who => who === "person1" ? p1 : who === "person2" ? p2 : "Juntos";
  const whoColor = who => who === "person1" ? clr.person1 : who === "person2" ? clr.person2 : clr.together;

  // Semana base = la "actual" del blob, navegable ±N con prev/next (sin editar nada)
  const baseWn = view.currentWeekNumber, baseYr = view.currentYear;
  const targetIso = addWeeksIso(baseYr, baseWn, weekOffset);
  const wkey = isoWeekKey(targetIso.wn, targetIso.yr);
  const week = view.weeks?.[wkey];
  const missions = [...(week?.missions || [])].sort((a, b) => {
    const da = a.date ? a.date + (a.time||"") : "9999";
    const db = b.date ? b.date + (b.time||"") : "9999";
    return da.localeCompare(db);
  });

  return (
    <div style={{ minHeight:"100vh", background:"#0a0714", color:"#f8f4ff", fontFamily:"system-ui", paddingBottom:40 }}>
      <div style={{ position:"sticky", top:0, background:"rgba(10,7,20,0.95)", backdropFilter:"blur(10px)", borderBottom:"1px solid rgba(167,139,250,0.12)", padding:"calc(14px + env(safe-area-inset-top)) 16px 12px", textAlign:"center" }}>
        <div style={{ fontSize:11, color:"#6b5f88", letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>👀 Solo lectura</div>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:19, fontWeight:700 }}>{p1} & {p2}</div>
      </div>

      <div style={{ maxWidth:520, margin:"0 auto", padding:"18px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <button onClick={() => setWeekOffset(o => o - 1)} style={{ background:"rgba(128,128,128,0.08)", border:"1px solid rgba(167,139,250,0.2)", borderRadius:8, color:"#a78bfa", width:36, height:36, cursor:"pointer", fontSize:18 }}>‹</button>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:16, fontWeight:700 }}>Semana {targetIso.wn}</div>
            <div style={{ fontSize:11, color:"#6b5f88" }}>{targetIso.yr}{weekOffset===0?" · esta semana":""}</div>
          </div>
          <button onClick={() => setWeekOffset(o => o + 1)} style={{ background:"rgba(128,128,128,0.08)", border:"1px solid rgba(167,139,250,0.2)", borderRadius:8, color:"#a78bfa", width:36, height:36, cursor:"pointer", fontSize:18 }}>›</button>
        </div>

        {missions.length === 0 ? (
          <div style={{ textAlign:"center", padding:"50px 20px", color:"#6b5f88", fontSize:13 }}>Sin actividades registradas esta semana.</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {missions.map(m => {
              const st = STATUS[m.status] || STATUS.TBC;
              return (
                <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"11px 14px", opacity:m.status==="DONE"?0.6:1 }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>{m.emoji || (m.type==="event"?"📅":"🎯")}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:500, textDecoration:m.status==="DONE"?"line-through":"none" }}>{m.title}</div>
                    <div style={{ display:"flex", gap:8, marginTop:3, fontSize:11, flexWrap:"wrap" }}>
                      <span style={{ color:whoColor(m.who), fontWeight:600 }}>{whoLabel(m.who)}</span>
                      {m.date && <span style={{ color:"#4a4166" }}>📆 {m.date}{m.time?` · ${m.time}`:""}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize:10, fontWeight:700, color:st.color, flexShrink:0 }}>{st.label}</span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ textAlign:"center", marginTop:32, fontSize:11, color:"#4a4166" }}>
          Enlace de solo lectura · Misiones de Pareja
        </div>
      </div>
    </div>
  );
}

function addWeeksIso(year, weekNumber, offset) {
  // ISO week arithmetic vía la fecha del lunes de esa semana + offset*7 días
  const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
  const dow = simple.getDay() || 7;
  const monday = new Date(simple);
  monday.setDate(simple.getDate() - dow + 1 + offset * 7);
  const target = new Date(monday);
  target.setDate(monday.getDate() + 3); // jueves de esa semana ISO
  const yr = target.getFullYear();
  const oneJan = new Date(yr, 0, 1);
  const wn = Math.ceil((((target - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
  return { wn, yr };
}
