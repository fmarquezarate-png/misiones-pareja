import { useState } from "react";
import { track } from "../lib/track.js";
import { useConfirm } from "./ConfirmModal.jsx";
import PillFilter from "./PillFilter.jsx";
import { S, badgeStyle } from "../styles.js";
import { STATUS, getMCats, CAT_MAP, DEFAULT_COLORS } from "../constants.js";

export default function PendingView({ weeks, currentWeekNumber, currentYear, globalPersonFilter, globalCatFilter, colors, p1, p2, cycleStatusGlobal, onDelete, setActiveTab, update, onSync, syncing }) {
  const [pendingTab, setPendingTab] = useState("pending");
  const [logrosPeopleFilter, setLogrosPeopleFilter] = useState([]);
  const [logrosCatFilter, setLogrosCatFilter] = useState([]);
  const { confirm, ConfirmDialog } = useConfirm();

  // ── Pendientes ──────────────────────────────────────────────────────────
  const carriedFromIds = new Set(Object.values(weeks).flatMap(w => (w.missions||[]).filter(m => m.carriedFrom && m.status!=="DONE").map(m => m.carriedFrom)));
  const pendingRaw = Object.entries(weeks)
    .sort((a,b) => a[0].localeCompare(b[0]))
    .flatMap(([key,w]) => (w.missions||[])
      .filter(m => m.status!=="DONE" && m.type!=="event" && !carriedFromIds.has(m.id))
      .map(m => ({...m, weekNumber:w.weekNumber, _yr:parseInt(key.split("-W")[0])||new Date().getFullYear(), _wkey:key})));
  const latestBySeries = {};
  for (const m of pendingRaw) { if (m.seriesId && (!latestBySeries[m.seriesId] || m._wkey > latestBySeries[m.seriesId]._wkey)) latestBySeries[m.seriesId] = m; }
  const pendingAll = pendingRaw.filter(m => !m.seriesId || latestBySeries[m.seriesId] === m);
  const pendingFiltered = pendingAll.filter(m =>
    (!globalPersonFilter.length || globalPersonFilter.includes(m.who)) &&
    (!globalCatFilter.length || getMCats(m).some(c => globalCatFilter.includes(c)))
  );

  // ── Logros ──────────────────────────────────────────────────────────────
  const logrosAll = Object.entries(weeks)
    .sort((a,b) => b[0].localeCompare(a[0]))
    .flatMap(([key,w]) => (w.missions||[])
      .filter(m => m.status==="DONE" && m.type!=="event")
      .map(m => ({...m, weekNumber:w.weekNumber, _yr:parseInt(key.split("-W")[0])||new Date().getFullYear(), _wkey:key})));
  const _seenSeries = new Set();
  const logrosDeduped = logrosAll.filter(m => {
    if (m.seriesId) {
      if (_seenSeries.has(m.seriesId)) return false;
      _seenSeries.add(m.seriesId);
    }
    return true;
  });
  const cwKey = `${currentYear}-W${String(currentWeekNumber).padStart(2,"0")}`;
  const logrosThisWeek = logrosAll.filter(m => m._wkey === cwKey).length;
  const logrosWithDate = logrosAll.filter(m => m.completedAt);
  const doneByDay = new Set(logrosWithDate.map(m => {
    if (typeof m.completedAt === 'string') return m.completedAt.slice(0,10);
    if (typeof m.completedAt === 'number') return new Date(m.completedAt).toISOString().slice(0,10);
    return null;
  }).filter(Boolean));
  let racha = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0,10);
    if (doneByDay.has(key)) racha++;
    else if (i > 0) break;
  }

  const subTabStyle = (active) => ({
    flex:1, padding:"7px 0", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit",
    fontSize:12, fontWeight:600,
    background: active ? "var(--t-accent-soft,rgba(167,139,250,0.14))" : "rgba(128,128,128,0.06)",
    color: active ? "var(--t-accent,#a78bfa)" : "var(--t-text-muted,#8b7fa8)",
    transition:"all .15s",
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {/* Toolbar */}
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <div style={{ display:"flex", flex:1, gap:4, background:"rgba(128,128,128,0.06)", borderRadius:10, padding:3 }}>
          <button onClick={() => setPendingTab("pending")} style={subTabStyle(pendingTab==="pending")}>📋 Pendientes <span style={{fontSize:10,opacity:0.7}}>({pendingFiltered.length})</span></button>
          <button onClick={() => { setPendingTab("logros"); track("logros_tab_viewed", { count: logrosDeduped.length }); }} style={subTabStyle(pendingTab==="logros")}>🏆 Logros <span style={{fontSize:10,opacity:0.7}}>({logrosDeduped.length})</span></button>
        </div>
        <button onClick={onSync} title="Sincronizar con Supabase" disabled={syncing}
          style={{ ...S.btnSecondary, padding:"7px 10px", fontSize:12, display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
          🔄 {syncing ? "…" : "Sync"}
        </button>
      </div>

      {/* Pendientes list */}
      {pendingTab==="pending" && (
        pendingFiltered.length===0
          ? <div style={{ ...S.card, textAlign:"center", color:"var(--t-text-dim,#3d3360)", fontStyle:"italic", padding:40 }}>
              <div style={{ fontSize:36, marginBottom:12 }}>🎉</div>
              <div>¡Sin pendientes! Todo al día.</div>
            </div>
          : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {pendingFiltered.map(m => {
                const whoColor = m.who==="person1"?colors?.person1||DEFAULT_COLORS.person1:m.who==="person2"?colors?.person2||DEFAULT_COLORS.person2:colors?.together||DEFAULT_COLORS.together;
                const isCarriedM = !!m.carriedFrom;
                const delayWeeks = (() => {
                  if (!isCarriedM) return 0;
                  let n=0, oid=m.carriedFrom, owk=m.carriedFromWeek;
                  while (oid && owk && n<20) { n++; const ow=weeks[owk]; if(!ow)break; const om=(ow.missions||[]).find(x=>x.id===oid); if(!om?.carriedFrom)break; oid=om.carriedFrom; owk=om.carriedFromWeek; }
                  return n;
                })();
                return (
                  <div key={m.id+m._wkey} style={{ ...S.card, padding:"10px 14px" }}>
                    {isCarriedM && <div style={{ fontSize:10, color:delayWeeks>=3?"#f87171":"#fb923c", letterSpacing:0.5, marginBottom:5, display:"flex", alignItems:"center", gap:4 }}>
                      {delayWeeks>=3?"⚠️":"🔁"} {delayWeeks>=3?`Arrastrada ${delayWeeks} semanas`:"Arrastrada"}
                    </div>}
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:22, flexShrink:0 }}>{m.emoji}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, color:"var(--t-text,#e2d9ff)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.title}</div>
                        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:3 }}>
                          <span style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)" }}>S{m.weekNumber} {m._yr}</span>
                          {m.date && <span style={{ fontSize:10, color:"var(--t-accent,#a78bfa)" }}>📆 {m.date}</span>}
                          {getMCats(m).map(ci => { const c=CAT_MAP[ci]; return c?<span key={ci} style={{ fontSize:10, color:c.color }}>{c.icon} {c.label}</span>:null; })}
                          <span style={{ fontSize:10, background:`${whoColor}18`, color:whoColor, border:`1px solid ${whoColor}40`, padding:"0 5px", borderRadius:99 }}>{m.who==="person1"?p1:m.who==="person2"?p2:"👫"}</span>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:4, flexShrink:0, alignItems:"center" }}>
                        <button onClick={() => cycleStatusGlobal(m.weekNumber,m._yr,m.id)} style={badgeStyle(m.status)}>{STATUS[m.status].icon}</button>
                        <button onClick={() => { update(s => ({...s,currentWeekNumber:m.weekNumber,currentYear:m._yr})); setActiveTab("current"); }} style={{ ...S.btnSecondary, fontSize:10, padding:"4px 8px" }}>→ S{m.weekNumber}</button>
                        <button onClick={() => confirm("Vas a eliminar esta tarea\n\nEsta acción no se puede deshacer. Desaparecerá para los dos.", () => onDelete(m.weekNumber,m._yr,m.id), {confirmLabel:"Sí, eliminar",cancelLabel:"Mejor no"})} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--t-text-dim,#4a4166)", fontSize:18, padding:"0 2px", lineHeight:1, flexShrink:0 }} title="Eliminar">×</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
      )}

      {/* Logros */}
      {pendingTab==="logros" && (() => {
        const peoplePills = [
          { id:"person1", label:p1, count:logrosDeduped.filter(m=>m.who==="person1").length, color:colors?.person1||DEFAULT_COLORS.person1 },
          { id:"person2", label:p2, count:logrosDeduped.filter(m=>m.who==="person2").length, color:colors?.person2||DEFAULT_COLORS.person2 },
          { id:"together", label:"Juntos", count:logrosDeduped.filter(m=>m.who==="together").length, color:colors?.together||DEFAULT_COLORS.together },
        ].filter(p => p.count>0);
        const catCounts = {};
        logrosDeduped.forEach(m => getMCats(m).forEach(c => { catCounts[c]=(catCounts[c]||0)+1; }));
        const catPills = Object.entries(catCounts).filter(([,n])=>n>0).map(([id,count])=>({ id, count, ...CAT_MAP[id] })).filter(c=>c.label);
        const logrosLocalFiltered = logrosDeduped.filter(m =>
          (!logrosPeopleFilter.length || logrosPeopleFilter.includes(m.who)) &&
          (!logrosCatFilter.length || getMCats(m).some(c => logrosCatFilter.includes(c)))
        );
        const byDay = {};
        logrosLocalFiltered.forEach(m => {
          const day = (typeof m.completedAt === 'string' ? m.completedAt.slice(0,10) : null) || m._wkey;
          if (!byDay[day]) byDay[day] = [];
          byDay[day].push(m);
        });
        const days = Object.entries(byDay).sort(([a],[b]) => b.localeCompare(a));
        return (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {/* Hero stats */}
            <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:2 }}>
              {[
                { icon:"🏆", value:logrosDeduped.length, label:"Totales" },
                { icon:"📅", value:logrosThisWeek, label:"Esta semana" },
                { icon:"🔥", value:racha, label:`Día${racha!==1?"s":""} de racha` },
              ].map(s => (
                <div key={s.label} style={{ flex:"0 0 auto", background:"rgba(167,139,250,0.08)", border:"1px solid rgba(167,139,250,0.18)", borderRadius:12, padding:"10px 16px", textAlign:"center", minWidth:90 }}>
                  <div style={{ fontSize:20 }}>{s.icon}</div>
                  <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, color:"#f8f4ff", fontWeight:700, lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:10, color:"#8b7fa8", marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {/* PillFilter */}
            <PillFilter
              people={peoplePills}
              categories={catPills}
              selectedPeople={logrosPeopleFilter}
              selectedCats={logrosCatFilter}
              onTogglePerson={id => setLogrosPeopleFilter(f => f.includes(id)?f.filter(x=>x!==id):[...f,id])}
              onToggleCat={id => setLogrosCatFilter(f => f.includes(id)?f.filter(x=>x!==id):[...f,id])}
            />
            {/* Timeline */}
            {logrosLocalFiltered.length===0
              ? <div style={{ ...S.card, textAlign:"center", color:"var(--t-text-dim,#3d3360)", fontStyle:"italic", padding:40 }}>
                  <div style={{ fontSize:36, marginBottom:12 }}>🏆</div>
                  <div>Todavía no hay logros registrados.</div>
                </div>
              : <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                  {days.map(([day,missions],di) => {
                    let dayLabel;
                    if (day.includes("-W")) {
                      const [yr,wn] = day.split("-W");
                      dayLabel = `Semana ${wn} · ${yr}`;
                    } else {
                      const d = new Date(day+"T12:00:00");
                      const todayStr = new Date().toISOString().slice(0,10);
                      const yesterStr = new Date(Date.now()-86400000).toISOString().slice(0,10);
                      dayLabel = day===todayStr?"Hoy":day===yesterStr?"Ayer":d.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"short"});
                    }
                    return (
                      <div key={day} style={{ opacity:0, animation:`fadeInUp 0.3s ease ${di*0.05}s forwards` }}>
                        <div style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:"var(--t-accent,#a78bfa)", fontWeight:600, marginBottom:6 }}>
                          {dayLabel} · {missions.length} logro{missions.length!==1?"s":""}
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                          {missions.map(m => {
                            const whoColor = m.who==="person1"?colors?.person1||DEFAULT_COLORS.person1:m.who==="person2"?colors?.person2||DEFAULT_COLORS.person2:colors?.together||DEFAULT_COLORS.together;
                            return (
                              <div key={m.id+m._wkey} style={{ ...S.card, padding:"9px 13px", borderLeft:`3px solid ${whoColor}`, opacity:0, animation:`fadeInUp 0.25s ease ${di*0.05+0.05}s forwards` }}>
                                <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                                  <span style={{ fontSize:20, flexShrink:0 }}>{m.emoji}</span>
                                  <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ fontSize:13, color:"var(--t-text,#e2d9ff)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.title}</div>
                                    <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:2 }}>
                                      <span style={{ fontSize:10, background:`${whoColor}18`, color:whoColor, border:`1px solid ${whoColor}40`, padding:"0 5px", borderRadius:99 }}>{m.who==="person1"?p1:m.who==="person2"?p2:"👫"}</span>
                                      {getMCats(m).map(ci => { const c=CAT_MAP[ci]; return c?<span key={ci} style={{ fontSize:10, color:c.color }}>{c.icon}</span>:null; })}
                                    </div>
                                  </div>
                                  <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                                    <span style={{ fontSize:18 }}>✅</span>
                                    <button onClick={() => confirm("Vas a eliminar este logro\n\nEsta acción no se puede deshacer. Desaparecerá del historial de los dos.", () => onDelete(m.weekNumber,m._yr,m.id), {confirmLabel:"Sí, eliminar",cancelLabel:"Mejor no"})} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--t-text-dim,#4a4166)", fontSize:16, padding:"0 2px", lineHeight:1 }} title="Eliminar">×</button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
          </div>
        );
      })()}

      <ConfirmDialog />
    </div>
  );
}
