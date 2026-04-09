import { useState } from "react";
import { CATEGORIES, STATUS, STATUS_ORDER, DEFAULT_COLORS } from "../constants.js";
import { getMCats, CAT_MAP } from "../constants.js";
import { googleCalendarUrl } from "../utils.js";
import { S, badgeStyle, catBadgeStyle } from "../styles.js";
import EmojiSelect from "./EmojiSelect.jsx";

export default function MissionCard({ mission, onCycleStatus, onDelete, onPatch, p1, p2, colors, goals }) {
  const [expanded, setExpanded] = useState(false);
  const isDone = mission.status === "DONE";
  const isCarried = !!mission.carriedFrom;
  const mCats = getMCats(mission).map(id => CAT_MAP[id]).filter(Boolean);
  const clr = colors || DEFAULT_COLORS;
  const whoColor = mission.who === "person1" ? clr.person1 : mission.who === "person2" ? clr.person2 : clr.together;
  const WHO = [{ id:"together", label:"Juntos", icon:"👫" }, { id:"person1", label:p1, icon:"🙋" }, { id:"person2", label:p2, icon:"🙋" }];
  const gcalUrl = googleCalendarUrl(mission, p1, p2);
  const isEvent = mission.type === "event";
  const firstCat = mCats[0];
  const cardBorder = isDone ? "rgba(52,211,153,0.15)" : isCarried ? "rgba(251,146,60,0.2)" : isEvent ? "rgba(96,165,250,0.3)" : firstCat ? `${firstCat.color}30` : `${whoColor}22`;

  return (
    <div style={{ ...S.card, borderColor:cardBorder, opacity:isDone?0.78:1, transition:"all 0.25s" }}>
      {isCarried && !isDone && <div style={{ fontSize:10, color:"#fb923c", letterSpacing:1, marginBottom:6 }}>🔁 Arrastrada</div>}
      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
        <EmojiSelect value={mission.emoji} onChange={e=>onPatch({ emoji:e })} />
        <div style={{ flex:1, minWidth:0, cursor:"pointer" }} onClick={()=>setExpanded(v=>!v)}>
          <div style={{ fontSize:14, fontWeight:500, lineHeight:1.4, color:isDone?"#6b5f88":"#f0e8ff", textDecoration:isDone?"line-through":"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={mission.title}>
            {mission.title}
          </div>
          <div style={{ display:"flex", gap:4, marginTop:4, flexWrap:"wrap" }}>
            {mCats.map(cat => <span key={cat.id} style={catBadgeStyle(cat.id)}>{cat.icon} {cat.label}</span>)}
            {mission.who === "together" && <span style={{ background:`${clr.together}18`, color:clr.together, border:`1px solid ${clr.together}40`, padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600 }}>👫 Juntos</span>}
            {mission.who === "person1"  && <span style={{ background:`${clr.person1}18`, color:clr.person1, border:`1px solid ${clr.person1}40`, padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600 }}>🙋 {p1}</span>}
            {mission.who === "person2"  && <span style={{ background:`${clr.person2}18`, color:clr.person2, border:`1px solid ${clr.person2}40`, padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600 }}>🙋 {p2}</span>}
            {(mission.duration || mission.estimatedHours) && <span style={{ background:"rgba(96,165,250,0.08)", color:"#60a5fa", border:"1px solid rgba(96,165,250,0.2)", padding:"2px 7px", borderRadius:99, fontSize:11 }}>⏱ {mission.duration || mission.estimatedHours}h</span>}
            {mission.date && <span style={{ background:"rgba(255,255,255,0.05)", color:"#6b5f88", border:"1px solid rgba(255,255,255,0.08)", padding:"2px 7px", borderRadius:99, fontSize:11 }}>📆 {mission.date}{mission.time ? ` · 🕐 ${mission.time}` : ""}</span>}
            {isEvent && <span style={{ background:"rgba(96,165,250,0.12)", color:"#60a5fa", border:"1px solid rgba(96,165,250,0.25)", padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600 }}>📅 Evento</span>}
            {mission.seriesPattern && <span style={{ background:"rgba(52,211,153,0.1)", color:"#34d399", border:"1px solid rgba(52,211,153,0.25)", padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600 }}>🔁 {mission.seriesPattern === "weekly" ? "Semanal" : "Mensual"}</span>}
            {mission.goalId && (() => { const g = (goals||[]).find(x=>x.id===mission.goalId); return g ? <span style={{ background:"rgba(167,139,250,0.12)", color:"#a78bfa", border:"1px solid rgba(167,139,250,0.25)", padding:"2px 7px", borderRadius:99, fontSize:11 }}>{g.emoji} {g.title}</span> : null; })()}
          </div>
        </div>
        <button onClick={onCycleStatus} style={badgeStyle(mission.status)}>{STATUS[mission.status].icon}</button>
        <button onClick={onDelete} style={{ background:"none", border:"none", cursor:"pointer", color:"#3d3360", fontSize:18, padding:"0 2px", lineHeight:1, flexShrink:0 }}
          onMouseEnter={e=>e.currentTarget.style.color="#f472b6"} onMouseLeave={e=>e.currentTarget.style.color="#3d3360"}>×</button>
      </div>

      {expanded && (
        <div style={{ marginTop:12, borderTop:"1px solid rgba(167,139,250,0.12)", paddingTop:12 }}>
          <div style={{ marginBottom:10 }}><label style={S.label}>Título</label><input value={mission.title} onChange={e=>onPatch({ title:e.target.value })} style={S.input} /></div>

          <div style={{ marginBottom:10 }}>
            <label style={S.label}>Tipo</label>
            <div style={{ display:"flex", gap:4 }}>
              {[{ id:"task", label:"✅ Tarea" }, { id:"event", label:"📅 Evento" }].map(t => {
                const sel = (mission.type || "task") === t.id;
                const ac = t.id === "event" ? "rgba(96,165,250,0.5)" : "rgba(167,139,250,0.5)";
                const tc = t.id === "event" ? "#60a5fa" : "#c4b8ff";
                return <button key={t.id} onClick={()=>onPatch({ type:t.id })} style={{ flex:1, background:sel?(t.id==="event"?"rgba(96,165,250,0.15)":"rgba(167,139,250,0.15)"):"rgba(255,255,255,0.03)", border:`1px solid ${sel?ac:"rgba(255,255,255,0.08)"}`, borderRadius:7, color:sel?tc:"#4a4166", padding:"4px 8px", cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:sel?600:400 }}>{t.label}</button>;
              })}
            </div>
          </div>

          <div style={{ marginBottom:10 }}>
            <label style={S.label}>Categoría (multi)</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {CATEGORIES.map(c => {
                const curCats = getMCats(mission), sel = curCats.includes(c.id);
                return <button key={c.id} onClick={()=>onPatch({ categories:sel?curCats.filter(x=>x!==c.id):[...curCats,c.id], category:null })}
                  style={{ ...catBadgeStyle(c.id), cursor:"pointer", border:`1px solid ${c.color}${sel?"":"20"}`, opacity:sel||!curCats.length?1:0.4 }}>{c.icon} {c.label}</button>;
              })}
            </div>
          </div>

          <div style={{ marginBottom:10 }}>
            <label style={S.label}>¿Quién?</label>
            <div style={{ display:"flex", gap:5 }}>
              {WHO.map(w => {
                const wc = w.id === "person1" ? clr.person1 : w.id === "person2" ? clr.person2 : clr.together;
                const sel = mission.who === w.id;
                return <button key={w.id} onClick={()=>onPatch({ who:w.id })} style={{ background:sel?`${wc}22`:"rgba(255,255,255,0.04)", border:`1px solid ${sel?wc+"60":"rgba(255,255,255,0.08)"}`, borderRadius:8, color:sel?wc:"#6b5f88", padding:"5px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>{w.icon} {w.label}</button>;
              })}
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <div><label style={S.label}>📆 Fecha</label><input type="date" value={mission.date||""} onChange={e=>onPatch({ date:e.target.value||null })} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
            <div><label style={S.label}>🕐 Hora</label><input type="time" value={mission.time||""} onChange={e=>onPatch({ time:e.target.value||null })} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
          </div>
          <div style={{ marginBottom:8 }}><label style={S.label}>⏱ Duración (h)</label><input type="number" min="0" step="0.5" value={mission.duration||""} onChange={e=>onPatch({ duration:parseFloat(e.target.value)||null })} placeholder="1" style={S.inputSm} /></div>

          {(goals||[]).filter(g=>g.active!==false).length > 0 && (
            <div style={{ marginBottom:8 }}>
              <label style={S.label}>🏅 ¿Cuenta para alguna meta?</label>
              <select value={mission.goalId||""} onChange={e=>onPatch({ goalId:e.target.value||null })} style={{ ...S.input, fontSize:13, colorScheme:"dark" }}>
                <option value="">— Sin meta —</option>
                {(goals||[]).filter(g=>g.active!==false).map(g=><option key={g.id} value={g.id}>{g.emoji} {g.title}</option>)}
              </select>
            </div>
          )}
          {gcalUrl && <a href={gcalUrl} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, color:"#34d399", background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:7, padding:"5px 10px", textDecoration:"none", marginTop:4 }}>📅 Añadir a Google Calendar</a>}
        </div>
      )}
    </div>
  );
}
