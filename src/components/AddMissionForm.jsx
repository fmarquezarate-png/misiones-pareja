import { useState } from "react";
import { S, badgeStyle, catBadgeStyle } from "../styles.js";
import { CATEGORIES, STATUS, STATUS_ORDER } from "../constants.js";
import { uid } from "../utils.js";
import EmojiSelect from "./EmojiSelect.jsx";

export default function AddMissionForm({ newM, setNewM, onAdd, onCancel, p1, p2, goals, templates = [], onSaveTemplate, onDeleteTemplate }) {
  const WHO = [{ id:"together",label:"Juntos",icon:"👫"},{id:"person1",label:p1,icon:"🙋"},{id:"person2",label:p2,icon:"🙋"}];
  const goalMatchesWho = (g, who) => who === "together" || g.who === "together" || !g.who || g.who === who;
  const activeGoals = (goals||[]).filter(g => g.active!==false && goalMatchesWho(g, newM.who));
  const isEvent = newM.type==="event";
  const [endMode, setEndMode] = useState("duration");
  const [tplEdit, setTplEdit] = useState(false);

  // Plantillas: eventos reiterados pero sin cadencia fija (liga de pádel, terapia…).
  // Aplican todos los campos menos la fecha — el usuario solo elige día/hora.
  const applyTemplate = t => {
    setNewM(p => ({
      ...p,
      emoji: t.emoji || p.emoji, title: t.title,
      type: t.type || "event", who: t.who || "together",
      categories: [...(t.categories || [])],
      duration: t.duration || 0,
      time: t.time || p.time,
      reminder: t.reminder || "none",
      goalId: t.goalId || null,
    }));
  };
  const saveTemplate = () => {
    if (!newM.title.trim() || !onSaveTemplate) return;
    onSaveTemplate({
      id: uid(), emoji: newM.emoji, title: newM.title.trim(),
      type: newM.type, who: newM.who, categories: [...(newM.categories || [])],
      duration: newM.duration || 0, time: newM.time || "",
      reminder: newM.reminder || "none", goalId: newM.goalId || null,
    });
  };

  const computeEnd = (date, time, durMin) => {
    if (!date || !time || !durMin || durMin<=0) return { endDate:"", endTime:"" };
    const e = new Date(new Date(date+"T"+time).getTime() + durMin*60000);
    return { endDate:`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`, endTime:`${String(e.getHours()).padStart(2,"0")}:${String(e.getMinutes()).padStart(2,"0")}` };
  };
  const computeDur = (d, t, ed, et) => {
    if (!d||!t||!ed||!et) return null;
    const diff = Math.round((new Date(ed+"T"+et) - new Date(d+"T"+t)) / 60000);
    return diff > 0 ? diff : null;
  };
  const durLabel = min => !min ? "" : min>=60 ? `${Math.floor(min/60)}h${min%60?` ${min%60}m`:""}` : `${min}m`;

  const { endDate:calcEndDate, endTime:calcEndTime } = computeEnd(newM.date, newM.time, newM.duration);
  const calcDurMin = computeDur(newM.date, newM.time, newM.endDate, newM.endTime);

  return (
    <div style={{ ...S.card, borderColor:isEvent?"rgba(96,165,250,0.35)":"rgba(167,139,250,0.3)" }}>
      {templates.length > 0 && (
        <div style={{ marginBottom:12, paddingBottom:10, borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:7 }}>
            <span style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600 }}>⚡ Plantillas</span>
            <button onClick={()=>setTplEdit(v=>!v)}
              style={{ background:"none", border:"none", cursor:"pointer", fontSize:10, color:tplEdit?"#f472b6":"var(--t-text-dim,#4a4166)", fontFamily:"inherit", padding:"2px 4px" }}>
              {tplEdit ? "✓ Listo" : "✏️ Editar"}
            </button>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {templates.map(t => (
              <button key={t.id} onClick={() => tplEdit ? onDeleteTemplate?.(t.id) : applyTemplate(t)}
                title={tplEdit ? "Eliminar plantilla" : `Rellenar con «${t.title}»`}
                style={{ display:"flex", alignItems:"center", gap:5, background:tplEdit?"rgba(244,63,94,0.08)":"rgba(167,139,250,0.1)", border:`1px solid ${tplEdit?"rgba(244,63,94,0.35)":"rgba(167,139,250,0.3)"}`, borderRadius:99, color:tplEdit?"#f43f5e":"#c4b8ff", padding:"5px 12px", cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:500 }}>
                <span>{t.emoji}</span><span>{t.title}</span>
                {tplEdit && <span style={{ fontWeight:700 }}>×</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display:"flex", gap:4, marginBottom:10 }}>
        {[{id:"task",label:"✅ Tarea"},{id:"event",label:"📅 Evento"}].map(t=>(
          <button key={t.id} onClick={()=>setNewM(p=>({...p,type:t.id}))}
            style={{ flex:1, background:newM.type===t.id?(t.id==="event"?"rgba(96,165,250,0.18)":"rgba(167,139,250,0.18)"):"rgba(128,128,128,0.05)", border:`1px solid ${newM.type===t.id?(t.id==="event"?"rgba(96,165,250,0.5)":"rgba(167,139,250,0.5)"):"rgba(255,255,255,0.08)"}`, borderRadius:8, color:newM.type===t.id?(t.id==="event"?"#60a5fa":"#c4b8ff"):"#4a4166", padding:"5px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:newM.type===t.id?600:400 }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10 }}>
        <EmojiSelect value={newM.emoji} onChange={e=>setNewM(p=>({...p,emoji:e}))} />
        <input autoFocus value={newM.title} onChange={e=>setNewM(p=>({...p,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&onAdd()} placeholder={isEvent?"Nombre del evento...":"Nombre de la misión..."} style={S.input} />
      </div>
      <div style={{ marginBottom:10 }}>
        <label style={S.label}>Categoría (multi)</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
          {CATEGORIES.map(c=>{
            const sel=(newM.categories||[]).includes(c.id);
            return <button key={c.id} onClick={()=>setNewM(p=>{const cats=p.categories||[];return {...p,categories:sel?cats.filter(x=>x!==c.id):[...cats,c.id]};})}
              style={{ ...catBadgeStyle(c.id), cursor:"pointer", border:`1px solid ${c.color}${sel?"":"20"}`, opacity:sel||!(newM.categories||[]).length?1:0.4 }}>
              {c.icon} {c.label}
            </button>;
          })}
        </div>
      </div>
      <div style={{ marginBottom:10 }}>
        <label style={S.label}>¿Quién?</label>
        <div style={{ display:"flex", gap:5 }}>
          {WHO.map(w=>(
            <button key={w.id} onClick={()=>setNewM(p=>({...p,who:w.id}))}
              style={{ background:newM.who===w.id?"rgba(167,139,250,0.2)":"rgba(128,128,128,0.06)", border:`1px solid ${newM.who===w.id?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:8, color:newM.who===w.id?"#c4b8ff":"#6b5f88", padding:"5px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
              {w.icon} {w.label}
            </button>
          ))}
        </div>
      </div>
      {isEvent&&<>
        <div style={{ background:"rgba(167,139,250,0.06)", border:"1px solid rgba(167,139,250,0.15)", borderRadius:10, padding:"10px 12px", marginBottom:8 }}>
          <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>📅 Inicio</div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input type="date" value={newM.date} onChange={e=>{const d=e.target.value;if(endMode==="duration"){const {endDate,endTime}=computeEnd(d,newM.time,newM.duration);setNewM(p=>({...p,date:d,endDate,endTime}));}else{const dur=computeDur(d,newM.time,newM.endDate,newM.endTime);setNewM(p=>({...p,date:d,...(dur!==null?{duration:dur}:{})}));}}} style={{ ...S.inputSm, colorScheme:"dark", flex:1, padding:"9px 10px", fontSize:14, minHeight:40 }} />
            <input type="time" value={newM.time} onChange={e=>{const t=e.target.value;if(endMode==="duration"){const {endDate,endTime}=computeEnd(newM.date,t,newM.duration);setNewM(p=>({...p,time:t,endDate,endTime}));}else{const dur=computeDur(newM.date,t,newM.endDate,newM.endTime);setNewM(p=>({...p,time:t,...(dur!==null?{duration:dur}:{})}));}}} style={{ ...S.inputSm, colorScheme:"dark", width:108, flexShrink:0, padding:"9px 8px", fontSize:14, minHeight:40, textAlign:"center" }} />
          </div>
        </div>
        <div style={{ display:"flex", gap:4, marginBottom:8 }}>
          {[{id:"duration",label:"⏱ Duración"},{id:"endtime",label:"🏁 Hora fin"}].map(m=>(
            <button key={m.id} onClick={()=>setEndMode(m.id)}
              style={{ flex:1, background:endMode===m.id?"rgba(96,165,250,0.18)":"rgba(128,128,128,0.05)", border:`1px solid ${endMode===m.id?"rgba(96,165,250,0.45)":"rgba(255,255,255,0.08)"}`, borderRadius:7, color:endMode===m.id?"#60a5fa":"#4a4166", padding:"4px 8px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:endMode===m.id?600:400 }}>
              {m.label}
            </button>
          ))}
        </div>
        {endMode==="duration"
          ?<div style={{ marginBottom:10 }}>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input type="number" min="0" step="15" value={newM.duration||""} onChange={e=>{const dur=parseInt(e.target.value)||0;const {endDate,endTime}=computeEnd(newM.date,newM.time,dur);setNewM(p=>({...p,duration:dur,endDate,endTime}));}} placeholder="90" style={{ ...S.inputSm, flex:1 }} />
              <span style={{ fontSize:12, color:"var(--t-text-dim,#6b5f88)", flexShrink:0 }}>min {newM.duration>0&&<span style={{color:"#60a5fa"}}>({durLabel(newM.duration)})</span>}</span>
            </div>
            {calcEndDate&&<div style={{ fontSize:11, color:"#60a5fa", marginTop:4 }}>🏁 Termina: {calcEndDate!==newM.date?calcEndDate+" ":""}{calcEndTime}</div>}
          </div>
          :<div style={{ background:"rgba(167,139,250,0.06)", border:"1px solid rgba(167,139,250,0.15)", borderRadius:10, padding:"10px 12px", marginBottom:10 }}>
            <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>🏁 Fin</div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input type="date" value={newM.endDate||""} onChange={e=>{const ed=e.target.value;const safeEt=newM.endTime||(ed?"23:59":"");const safeT=newM.time||(ed?"00:00":"");const dur=computeDur(newM.date,safeT,ed,safeEt);setNewM(p=>({...p,endDate:ed,endTime:safeEt,time:safeT,...(dur!==null?{duration:dur}:{})}))} } style={{ ...S.inputSm, colorScheme:"dark", flex:1, padding:"9px 10px", fontSize:14, minHeight:40 }} />
              <input type="time" value={newM.endTime||""} onChange={e=>{const et=e.target.value;const safeEd=newM.endDate||(et?newM.date:"");const safeT=newM.time||(et?"00:00":"");const dur=computeDur(newM.date,safeT,safeEd,et);setNewM(p=>({...p,endTime:et,endDate:safeEd,time:safeT,...(dur!==null?{duration:dur}:{})}))} } style={{ ...S.inputSm, colorScheme:"dark", width:108, flexShrink:0, padding:"9px 8px", fontSize:14, minHeight:40, textAlign:"center" }} />
            </div>
            {calcDurMin!==null&&<div style={{ fontSize:11, color:"#60a5fa", marginTop:6 }}>⏱ Duración: {durLabel(calcDurMin)}</div>}
          </div>
        }
        {newM.time&&<div style={{ marginBottom:8 }}>
          <label style={S.label}>🔔 Recordatorio</label>
          <select value={newM.reminder||"none"} onChange={e=>setNewM(p=>({...p,reminder:e.target.value}))} style={{ ...S.inputSm, colorScheme:"dark", fontSize:12 }}>
            <option value="none">Sin recordatorio</option>
            <option value="ontime">En el momento</option>
            <option value="15min">15 min antes</option>
            <option value="30min">30 min antes</option>
            <option value="1h">1 hora antes</option>
            <option value="1day">1 día antes</option>
          </select>
        </div>}
      </>}
      {activeGoals.length>0&&<div style={{ marginBottom:10 }}>
        <label style={S.label}>🏅 ¿Cuenta para alguna meta?</label>
        <select value={newM.goalId||""} onChange={e=>setNewM(p=>({...p,goalId:e.target.value||null}))} style={{ ...S.input, fontSize:13, colorScheme:"dark", background:"var(--t-card,rgba(16,10,32,0.95))", color:"var(--t-text,#f8f4ff)" }}>
          <option value="">— Sin meta —</option>
          {activeGoals.map(g=><option key={g.id} value={g.id}>{g.emoji} {g.title}</option>)}
        </select>
      </div>}
      {!isEvent&&<div style={{ marginBottom:10 }}>
        <label style={S.label}>🔁 Tarea recurrente</label>
        <div style={{ display:"flex", gap:4 }}>
          {[{id:"",label:"Una vez"},{id:"weekly",label:"Semanal"},{id:"biweekly",label:"Bisemanal"},{id:"monthly",label:"Mensual"}].map(o=>(
            <button key={o.id} onClick={()=>setNewM(p=>({...p,seriesPattern:o.id,seriesEndDate:"",seriesId:o.id?p.seriesId||uid():undefined}))}
              style={{ flex:1, background:newM.seriesPattern===o.id?"rgba(167,139,250,0.2)":"rgba(128,128,128,0.06)", border:`1px solid ${newM.seriesPattern===o.id?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:7, color:newM.seriesPattern===o.id?"#c4b8ff":"#6b5f88", padding:"5px 6px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:newM.seriesPattern===o.id?600:400 }}>{o.label}</button>
          ))}
        </div>
        {newM.seriesPattern && <div style={{ marginTop:8 }}>
          <label style={S.label}>📅 Repetir hasta (opcional)</label>
          <input type="date" value={newM.seriesEndDate||""} onChange={e=>setNewM(p=>({...p,seriesEndDate:e.target.value}))} style={{...S.inputSm,colorScheme:"dark"}} />
        </div>}
      </div>}
      <div style={{ display:"flex", gap:6, justifyContent:"space-between", alignItems:"center", flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {STATUS_ORDER.map(s=><button key={s} onClick={()=>setNewM(p=>({...p,status:s}))} style={{ ...badgeStyle(s), opacity:newM.status===s?1:0.35 }}>{STATUS[s].icon} {STATUS[s].label}</button>)}
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {onSaveTemplate && newM.title.trim() && (
            <button onClick={saveTemplate} title="Guardar como plantilla para reutilizar"
              style={{ background:"rgba(251,191,36,0.08)", border:"1px solid rgba(251,191,36,0.3)", borderRadius:10, color:"#fbbf24", padding:"8px 12px", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>☆ Plantilla</button>
          )}
          <button onClick={onCancel} style={S.btnSecondary}>Cancelar</button>
          <button onClick={onAdd} style={S.btnPrimary}>Añadir ✨</button>
        </div>
      </div>
    </div>
  );
}
