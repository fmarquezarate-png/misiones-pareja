// v3.0.0: today ring (not fill), density bars per person, ICS/PDF moved to OverflowMenu
import { useState } from "react";
import { CATEGORIES, STATUS, STATUS_ORDER, DEFAULT_COLORS, getMCats, CAT_MAP } from "../constants.js";
import { S, badgeStyle, catBadgeStyle } from "../styles.js";
import { useConfirm } from "../components/ConfirmModal.jsx";

export default function CalendarView({
  allDatedMissions, week, wkey, p1, p2, weeks, colors,
  onAddForDay, onDownloadICS, onDownloadPDF, onGoToWeek,
  onCycleStatus, onPatchMission, onDeleteMission,
  personFilter = "all", catFilter = [], goals = []
}) {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [editingMission, setEditingMission] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const DAYS = ["L","M","X","J","V","S","D"];
  const clrC = colors || DEFAULT_COLORS;

  const prevM = () => { if (calMonth===0) { setCalMonth(11); setCalYear(y=>y-1); } else setCalMonth(m=>m-1); setSelectedDay(null); };
  const nextM = () => { if (calMonth===11) { setCalMonth(0); setCalYear(y=>y+1); } else setCalMonth(m=>m+1); setSelectedDay(null); };

  const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  const daysInM = new Date(calYear, calMonth + 1, 0).getDate();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  const applyFilters = ms => ms.filter(m => (personFilter==="all" || m.who===personFilter) && (!catFilter.length || getMCats(m).some(c=>catFilter.includes(c))));
  const byDate = {};
  applyFilters(allDatedMissions).forEach(m => { if (!m.date) return; if (!byDate[m.date]) byDate[m.date]=[]; byDate[m.date].push(m); });

  const cells = [...Array(firstDow).fill(null), ...Array.from({ length:daysInM }, (_, i) => i + 1)];
  const selStr = selectedDay ? `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(selectedDay).padStart(2,"0")}` : null;
  const selMs = selStr ? (byDate[selStr] || []) : [];

  const onDragStart = (e, m) => { e.dataTransfer.effectAllowed="move"; e.dataTransfer.setData("text/plain", JSON.stringify({ id:m.id, wn:m.weekNumber, yr:m._yr })); };
  const onDropDay = (e, dateStr) => {
    e.preventDefault(); setDragOver(null);
    try {
      const { id, wn, yr } = JSON.parse(e.dataTransfer.getData("text/plain"));
      // Find the mission to check if it's a multi-day event
      const mission = allDatedMissions.find(m => m.id === id);
      const patch = { date: dateStr };
      if (mission?.endDate && mission.date) {
        // Shift endDate by the same delta as startDate
        const delta = new Date(dateStr) - new Date(mission.date);
        const newEnd = new Date(new Date(mission.endDate).getTime() + delta);
        patch.endDate = `${newEnd.getFullYear()}-${String(newEnd.getMonth()+1).padStart(2,"0")}-${String(newEnd.getDate()).padStart(2,"0")}`;
      }
      onPatchMission && onPatchMission(wn, yr, id, patch);
    } catch(err) { console.warn("drop err", err); }
  };

  const openEdit = m => setEditingMission({ mission:m, wn:m.weekNumber, yr:m._yr });
  const closeEdit = () => setEditingMission(null);
  const patchEditing = patch => {
    if (!editingMission) return;
    onPatchMission && onPatchMission(editingMission.wn, editingMission.yr, editingMission.mission.id, patch);
    setEditingMission(p => ({ ...p, mission:{ ...p.mission, ...patch } }));
  };

  return (
    <div>
      <div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginBottom:16 }}>
          <button onClick={prevM} style={S.btnNav}>‹</button>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:600, minWidth:160, textAlign:"center" }}>{MONTHS[calMonth]} {calYear}</div>
          <button onClick={nextM} style={S.btnNav}>›</button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:3 }}>
          {DAYS.map(d => <div key={d} style={{ textAlign:"center", fontSize:10, color:"#4a4166", fontWeight:600, padding:"3px 0" }}>{d}</div>)}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} />;
            const ds = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const ms = byDate[ds] || [];
            const isTd = ds === todayStr;
            const isSel = day === selectedDay;
            const isDO = dragOver === ds;

            // v3: today marked with ring on number, not bg fill
            const cellBg = isDO ? "rgba(167,139,250,0.3)"
                          : isSel ? "rgba(167,139,250,0.22)"
                          : ms.length>0 ? "rgba(167,139,250,0.06)"
                          : "rgba(255,255,255,0.02)";
            const cellBorder = isDO ? "1px solid rgba(167,139,250,0.7)"
                              : isSel ? "1px solid rgba(167,139,250,0.55)"
                              : "1px solid rgba(255,255,255,0.04)";

            const counts = { person1:0, person2:0, together:0 };
            ms.forEach(m => { if (counts[m.who] != null) counts[m.who]++; });

            return (
              <div key={day} onClick={()=>setSelectedDay(isSel ? null : day)}
                onDragEnter={e=>{ e.preventDefault(); setDragOver(ds); }}
                onDragOver={e=>e.preventDefault()}
                onDragLeave={e=>{ if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }}
                onDrop={e=>onDropDay(e, ds)}
                style={{
                  borderRadius:8, minHeight:50, padding:"4px 3px 6px", cursor:"pointer",
                  background: cellBg, border: cellBorder, transition:"all 0.12s",
                  position:"relative",
                }}>
                {/* v3: today ring on number, not bg */}
                <div style={{ display:"flex", justifyContent:"center", marginBottom:2 }}>
                  <div style={{
                    fontSize:10, fontWeight:600, textAlign:"center",
                    color: isTd ? "#f472b6" : isSel ? "#c4b8ff" : "#4a4166",
                    width: 18, height: 18, borderRadius: 99,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    border: isTd ? "1.5px solid #f472b6" : "1.5px solid transparent",
                    lineHeight: 1,
                  }}>{day}</div>
                </div>

                <div style={{ display:"flex", flexWrap:"wrap", gap:2, justifyContent:"center" }}>
                  {ms.slice(0, 3).map(m => {
                    const bg = m.who==="person1" ? clrC.person1 : m.who==="person2" ? clrC.person2 : clrC.together;
                    return <span key={m.id} draggable
                      onDragStart={e=>{ e.stopPropagation(); onDragStart(e, m); }}
                      onDragEnd={()=>setDragOver(null)}
                      title={m.title}
                      style={{ fontSize:11, lineHeight:1, background:`${bg}30`, border:`1px solid ${bg}55`, borderRadius:3, padding:"1px 2px", opacity:m.status==="DONE"?0.4:1, cursor:"grab" }}>
                      {m.emoji}
                    </span>;
                  })}
                  {ms.length > 3 && <span style={{ fontSize:8, color:"#4a4166" }}>+{ms.length-3}</span>}
                </div>

                {/* v3: density bar per person */}
                {ms.length > 0 && (
                  <div style={{
                    position:"absolute", bottom:2, left:3, right:3, height:2,
                    borderRadius:99, display:"flex", gap:1, overflow:"hidden",
                  }}>
                    {counts.person1 > 0 && <i style={{ background: clrC.person1, flex: counts.person1, height:"100%" }} />}
                    {counts.person2 > 0 && <i style={{ background: clrC.person2, flex: counts.person2, height:"100%" }} />}
                    {counts.together > 0 && <i style={{ background: clrC.together, flex: counts.together, height:"100%" }} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectedDay && (
          <div style={{ ...S.card, marginTop:12, borderColor:"rgba(167,139,250,0.3)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"#a78bfa", fontWeight:600 }}>{selectedDay} de {MONTHS[calMonth]}</div>
              {onAddForDay && <button onClick={()=>onAddForDay(selStr)} style={{ ...S.btnPrimary, fontSize:11, padding:"5px 10px" }}>+ Añadir</button>}
            </div>
            {selMs.length === 0
              ? <div style={{ color:"#3d3360", fontStyle:"italic", fontSize:13 }}>Sin misiones para este día</div>
              : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {selMs.map(m => {
                    const whoColor = m.who==="person1" ? clrC.person1 : m.who==="person2" ? clrC.person2 : clrC.together;
                    return <div key={m.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:"1px solid rgba(167,139,250,0.08)" }}>
                      <span style={{ fontSize:20, flexShrink:0 }}>{m.emoji}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, color:m.status==="DONE"?"#4d4566":"#e2d9ff", textDecoration:m.status==="DONE"?"line-through":"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.title}</div>
                        <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:2 }}>
                          {m.time && <span style={{ fontSize:10, color:"#a78bfa" }}>🕐 {m.time}</span>}
                          {getMCats(m).map(ci => { const c = CAT_MAP[ci]; return c ? <span key={ci} style={{ fontSize:10, color:c.color }}>{c.icon}</span> : null; })}
                          <span style={{ fontSize:10, background:`${whoColor}18`, color:whoColor, border:`1px solid ${whoColor}40`, padding:"0 5px", borderRadius:99 }}>{m.who==="person1"?p1:m.who==="person2"?p2:"👫"}</span>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                        <button onClick={()=>onCycleStatus && onCycleStatus(m.weekNumber, m._yr, m.id)} style={badgeStyle(m.status)}>{STATUS[m.status].icon}</button>
                        <button onClick={()=>openEdit(m)} style={{ background:"rgba(167,139,250,0.12)", border:"1px solid rgba(167,139,250,0.25)", borderRadius:7, color:"#a78bfa", fontSize:11, padding:"4px 8px", cursor:"pointer", fontFamily:"inherit" }}>✏️</button>
                      </div>
                    </div>;
                  })}
                </div>
            }
          </div>
        )}
      </div>

      {editingMission && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={closeEdit}>
          <div style={{ background:"#1d1733", border:"1px solid rgba(167,139,250,0.35)", borderRadius:16, padding:20, width:"100%", maxWidth:420, maxHeight:"90vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <span style={{ fontSize:13, fontWeight:600, color:"#c4b8ff" }}>✏️ Editar actividad</span>
              <button onClick={closeEdit} style={{ background:"none", border:"none", color:"#6b5f88", fontSize:20, cursor:"pointer" }}>×</button>
            </div>
            <div style={{ marginBottom:10 }}><label style={S.label}>Título</label><input value={editingMission.mission.title} onChange={e=>patchEditing({ title:e.target.value })} style={S.input} /></div>
            <div style={{ marginBottom:10 }}>
              <label style={S.label}>Categoría (multi)</label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                {CATEGORIES.map(c => {
                  const sel = getMCats(editingMission.mission).includes(c.id);
                  return <button key={c.id} onClick={()=>{ const cur=getMCats(editingMission.mission); patchEditing({ categories:sel?cur.filter(x=>x!==c.id):[...cur,c.id], category:null }); }}
                    style={{ ...catBadgeStyle(c.id), cursor:"pointer", border:`1px solid ${c.color}${sel?"":"20"}`, opacity:sel||!getMCats(editingMission.mission).length?1:0.4 }}>{c.icon} {c.label}</button>;
                })}
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              <div><label style={S.label}>📆 Fecha</label><input type="date" value={editingMission.mission.date||""} onChange={e=>patchEditing({ date:e.target.value||null })} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
              <div><label style={S.label}>🕐 Hora</label><input type="time" value={editingMission.mission.time||""} onChange={e=>patchEditing({ time:e.target.value||null })} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={S.label}>Estado</label>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {STATUS_ORDER.map(s => <button key={s} onClick={()=>patchEditing({ status:s, completedAt:s==="DONE"?Date.now():null })} style={{ ...badgeStyle(s), opacity:editingMission.mission.status===s?1:0.35 }}>{STATUS[s].icon} {STATUS[s].label}</button>)}
              </div>
            </div>
            {goals.filter(g=>g.active!==false).length > 0 && (
              <div style={{ marginBottom:10 }}>
                <label style={S.label}>🏅 Meta</label>
                <select value={editingMission.mission.goalId||""} onChange={e=>patchEditing({ goalId:e.target.value||null })} style={{ ...S.input, fontSize:13, colorScheme:"dark" }}>
                  <option value="">— Sin meta —</option>
                  {goals.filter(g=>g.active!==false).map(g => <option key={g.id} value={g.id}>{g.emoji} {g.title}</option>)}
                </select>
              </div>
            )}
            <div style={{ display:"flex", gap:8, justifyContent:"space-between", marginTop:14 }}>
              <button onClick={()=>{ confirm("¿Eliminar esta actividad?", () => { onDeleteMission && onDeleteMission(editingMission.wn, editingMission.yr, editingMission.mission.id); closeEdit(); }); }} style={{ ...S.btnSecondary, color:"#f472b6", borderColor:"rgba(244,114,182,0.3)" }}>🗑 Eliminar</button>
              <button onClick={closeEdit} style={S.btnPrimary}>Listo ✓</button>
            </div>
          </div>
        </div>
      )}
    </div>
    <ConfirmDialog />
  );
}
