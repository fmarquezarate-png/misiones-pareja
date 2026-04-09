import { CATEGORIES, STATUS_ORDER, STATUS } from "../constants.js";
import { uid } from "../utils.js";
import { S, badgeStyle, catBadgeStyle } from "../styles.js";
import EmojiSelect from "./EmojiSelect.jsx";

export default function AddMissionForm({ newM, setNewM, onAdd, onCancel, p1, p2, goals }) {
  const WHO = [{ id:"together", label:"Juntos", icon:"👫" }, { id:"person1", label:p1, icon:"🙋" }, { id:"person2", label:p2, icon:"🙋" }];
  const activeGoals = (goals || []).filter(g => g.active !== false);
  const isEvent = newM.type === "event";

  return (
    <div style={{ ...S.card, borderColor: isEvent ? "rgba(96,165,250,0.35)" : "rgba(167,139,250,0.3)" }}>
      {/* Tipo */}
      <div style={{ display:"flex", gap:4, marginBottom:10 }}>
        {[{ id:"task", label:"✅ Tarea" }, { id:"event", label:"📅 Evento" }].map(t => (
          <button key={t.id} onClick={()=>setNewM(p=>({ ...p, type:t.id }))}
            style={{ flex:1, background:newM.type===t.id?(t.id==="event"?"rgba(96,165,250,0.18)":"rgba(167,139,250,0.18)"):"rgba(255,255,255,0.03)", border:`1px solid ${newM.type===t.id?(t.id==="event"?"rgba(96,165,250,0.5)":"rgba(167,139,250,0.5)"):"rgba(255,255,255,0.08)"}`, borderRadius:8, color:newM.type===t.id?(t.id==="event"?"#60a5fa":"#c4b8ff"):"#4a4166", padding:"5px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:newM.type===t.id?600:400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Emoji + título */}
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10 }}>
        <EmojiSelect value={newM.emoji} onChange={e=>setNewM(p=>({ ...p, emoji:e }))} />
        <input autoFocus value={newM.title} onChange={e=>setNewM(p=>({ ...p, title:e.target.value }))}
          onKeyDown={e=>e.key==="Enter" && onAdd()}
          placeholder={isEvent ? "Nombre del evento..." : "Nombre de la misión..."}
          style={S.input} />
      </div>

      {/* Categorías */}
      <div style={{ marginBottom:10 }}>
        <label style={S.label}>Categoría (multi)</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
          {CATEGORIES.map(c => {
            const sel = (newM.categories || []).includes(c.id);
            return <button key={c.id} onClick={()=>setNewM(p=>{ const cats=p.categories||[]; return { ...p, categories:sel?cats.filter(x=>x!==c.id):[...cats,c.id] }; })}
              style={{ ...catBadgeStyle(c.id), cursor:"pointer", border:`1px solid ${c.color}${sel?"":"20"}`, opacity:sel||!(newM.categories||[]).length?1:0.4 }}>
              {c.icon} {c.label}
            </button>;
          })}
        </div>
      </div>

      {/* Quién */}
      <div style={{ marginBottom:10 }}>
        <label style={S.label}>¿Quién?</label>
        <div style={{ display:"flex", gap:5 }}>
          {WHO.map(w => (
            <button key={w.id} onClick={()=>setNewM(p=>({ ...p, who:w.id }))}
              style={{ background:newM.who===w.id?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.04)", border:`1px solid ${newM.who===w.id?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:8, color:newM.who===w.id?"#c4b8ff":"#6b5f88", padding:"5px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
              {w.icon} {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fecha / hora */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
        <div><label style={S.label}>📆 Fecha</label><input type="date" value={newM.date} onChange={e=>setNewM(p=>({ ...p, date:e.target.value }))} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
        <div><label style={S.label}>🕐 Hora</label><input type="time" value={newM.time} onChange={e=>setNewM(p=>({ ...p, time:e.target.value }))} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
      </div>
      <div style={{ marginBottom:10 }}>
        <label style={S.label}>⏱ Duración (h)</label>
        <input type="number" min="0" step="0.5" value={newM.duration} onChange={e=>setNewM(p=>({ ...p, duration:e.target.value }))} placeholder="1" style={S.inputSm} />
      </div>

      {/* Meta */}
      {activeGoals.length > 0 && (
        <div style={{ marginBottom:10 }}>
          <label style={S.label}>🏅 ¿Cuenta para alguna meta?</label>
          <select value={newM.goalId || ""} onChange={e=>setNewM(p=>({ ...p, goalId:e.target.value||null }))} style={{ ...S.input, fontSize:13, colorScheme:"dark" }}>
            <option value="">— Sin meta —</option>
            {activeGoals.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.title}</option>)}
          </select>
        </div>
      )}

      {/* Recurrencia */}
      {newM.type === "task" && (
        <div style={{ marginBottom:10 }}>
          <label style={S.label}>🔁 Tarea recurrente</label>
          <div style={{ display:"flex", gap:4 }}>
            {[{ id:"", label:"Una vez" }, { id:"weekly", label:"Semanal" }, { id:"monthly", label:"Mensual" }].map(o => (
              <button key={o.id} onClick={()=>setNewM(p=>({ ...p, seriesPattern:o.id, seriesId:o.id?p.seriesId||uid():undefined }))}
                style={{ flex:1, background:newM.seriesPattern===o.id?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.04)", border:`1px solid ${newM.seriesPattern===o.id?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:7, color:newM.seriesPattern===o.id?"#c4b8ff":"#6b5f88", padding:"5px 6px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:newM.seriesPattern===o.id?600:400 }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Status + botones */}
      <div style={{ display:"flex", gap:6, justifyContent:"space-between", alignItems:"center", flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {STATUS_ORDER.map(s => (
            <button key={s} onClick={()=>setNewM(p=>({ ...p, status:s }))} style={{ ...badgeStyle(s), opacity:newM.status===s?1:0.35 }}>
              {STATUS[s].icon} {STATUS[s].label}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={onCancel} style={S.btnSecondary}>Cancelar</button>
          <button onClick={onAdd} style={S.btnPrimary}>Añadir ✨</button>
        </div>
      </div>
    </div>
  );
}
