import { useState, useEffect } from "react";
import { DEFAULT_COLORS, STATUS_ORDER, STATUS, PERIOD_LABEL, PERIOD_EMOJI } from "../constants.js";
import { computeGoalProgress, computeGoalHistory } from "../utils.js";
import { S, badgeStyle } from "../styles.js";
import EmojiSelect from "../components/EmojiSelect.jsx";

// ─── GoalForm ─────────────────────────────────────────────────────────────────
function GoalForm({ form, setForm, onSave, onCancel, isEdit, p1, p2 }) {
  const WHO     = [{ id:"together", label:"Juntos", icon:"👫" }, { id:"person1", label:p1, icon:"🙋" }, { id:"person2", label:p2, icon:"🙋" }];
  const PERIODS = [{ id:"weekly", label:"Semanal" }, { id:"monthly", label:"Mensual" }, { id:"annual", label:"Anual" }];
  return (
    <div style={{ ...S.card, borderColor:"rgba(167,139,250,0.35)" }}>
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10 }}>
        <EmojiSelect value={form.emoji} onChange={e=>setForm(f=>({ ...f, emoji:e }))} />
        <input autoFocus value={form.title} onChange={e=>setForm(f=>({ ...f, title:e.target.value }))}
          onKeyDown={e=>e.key==="Enter" && onSave()} placeholder="Nombre de la meta..." style={S.input} />
      </div>

      <div style={{ marginBottom:10 }}>
        <label style={S.label}>¿Para quién?</label>
        <div style={{ display:"flex", gap:5 }}>
          {WHO.map(w => (
            <button key={w.id} onClick={()=>setForm(f=>({ ...f, who:w.id }))}
              style={{ background:form.who===w.id?"rgba(167,139,250,0.2)":"rgba(128,128,128,0.06)", border:`1px solid ${form.who===w.id?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:8, color:form.who===w.id?"#c4b8ff":"#6b5f88", padding:"5px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>
              {w.icon} {w.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10, marginBottom:12, alignItems:"end" }}>
        <div>
          <label style={S.label}>Periodicidad</label>
          <div style={{ display:"flex", gap:4 }}>
            {PERIODS.map(p => (
              <button key={p.id} onClick={()=>setForm(f=>({ ...f, period:p.id }))}
                style={{ flex:1, background:form.period===p.id?"rgba(167,139,250,0.2)":"rgba(128,128,128,0.06)", border:`1px solid ${form.period===p.id?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:7, color:form.period===p.id?"#c4b8ff":"#6b5f88", padding:"5px 6px", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ textAlign:"center" }}>
          <label style={S.label}>{(form.goalType || "min") === "min" ? "Mínimo" : "Máximo"}</label>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <button onClick={()=>setForm(f=>({ ...f, target:Math.max(1, f.target-1) }))} style={{ ...S.btnSecondary, padding:"4px 10px", fontSize:16 }}>−</button>
            <span style={{ fontFamily:"'Fraunces',serif", fontSize:22, color:"#f8f4ff", minWidth:20, textAlign:"center" }}>{form.target}</span>
            <button onClick={()=>setForm(f=>({ ...f, target:f.target+1 }))} style={{ ...S.btnSecondary, padding:"4px 10px", fontSize:16 }}>+</button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom:10 }}>
        <label style={S.label}>Tipo de límite</label>
        <div style={{ display:"flex", gap:4 }}>
          {[{ id:"min", label:"✅ Mínimo (hacer al menos X)" }, { id:"max", label:"🚫 Máximo (no más de X)" }].map(t => (
            <button key={t.id} onClick={()=>setForm(f=>({ ...f, goalType:t.id }))}
              style={{ flex:1, background:(form.goalType||"min")===t.id?"rgba(167,139,250,0.2)":"rgba(128,128,128,0.06)", border:`1px solid ${(form.goalType||"min")===t.id?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:7, color:(form.goalType||"min")===t.id?"#c4b8ff":"#6b5f88", padding:"5px 6px", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
        <div>
          <label style={S.label}>📅 Analizar desde (opcional)</label>
          <input type="date" value={form.startDate||""} onChange={e=>setForm(f=>({ ...f, startDate:e.target.value }))} style={{ ...S.inputSm, colorScheme:"dark" }} />
        </div>
        <div>
          <label style={S.label}>📅 Deadline (opcional)</label>
          <input type="date" value={form.deadline||""} onChange={e=>setForm(f=>({ ...f, deadline:e.target.value }))} style={{ ...S.inputSm, colorScheme:"dark" }} />
        </div>
      </div>

      <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
        <button onClick={onCancel} style={S.btnSecondary}>Cancelar</button>
        <button onClick={onSave} style={S.btnPrimary}>{isEdit ? "Guardar ✓" : "Crear meta ✨"}</button>
      </div>
    </div>
  );
}

// ─── GoalCard ─────────────────────────────────────────────────────────────────
function GoalCard({ goal, progress, history, weeks, p1, p2, colors, onEdit, onArchive }) {
  const clr      = colors || DEFAULT_COLORS;
  const whoColor = goal.who === "person1" ? clr.person1 : goal.who === "person2" ? clr.person2 : clr.together;
  const whoLabel = goal.who === "person1" ? p1 : goal.who === "person2" ? p2 : "Juntos";
  const whoIcon  = goal.who === "together" ? "👫" : "🙋";
  const isMax    = goal.goalType === "max";
  const met      = isMax ? progress.current <= progress.target : progress.current >= progress.target;
  const [tick, setTick] = useState(0);
  const [detailIdx, setDetailIdx] = useState(null);

  const getPeriodMissions = (h) => {
    if (!weeks || h.noData) return [];
    const allDone = Object.values(weeks).flatMap(w =>
      (w.missions || []).filter(m => m.goalId === goal.id && m.status === "DONE")
        .map(m => ({ ...m, _wn: w.weekNumber, _wy: w.year || new Date().getFullYear() }))
    );
    if (goal.period === "weekly") return allDone.filter(m => m._wn === h.wn && m._wy === h.wy);
    if (goal.period === "monthly") return allDone.filter(m => {
      if (m.date) { const d = new Date(m.date); return d.getMonth() === h.mo && d.getFullYear() === h.yr; }
      const approx = new Date(m._wy, 0, 1 + (m._wn - 1) * 7);
      return approx.getMonth() === h.mo && approx.getFullYear() === h.yr;
    });
    return allDone.filter(m => {
      if (m.date) return new Date(m.date).getFullYear() === h.yr;
      return m._wy === h.yr;
    });
  };

  useEffect(() => {
    if (!goal.deadline) return;
    const dl = new Date(goal.deadline); dl.setHours(23, 59, 59);
    if ((dl - new Date()) > 86400000) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [goal.deadline]);

  return (
    <div style={{ ...S.card, borderColor:met?`${clr.together}50`:"rgba(167,139,250,0.12)", transition:"border-color 0.3s" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <span style={{ fontSize:28 }}>{goal.emoji}</span>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:"var(--t-text,#f0e8ff)" }}>{goal.title}</div>
            <div style={{ display:"flex", gap:5, marginTop:3, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, background:`${whoColor}18`, color:whoColor, border:`1px solid ${whoColor}40`, padding:"1px 6px", borderRadius:99 }}>{whoIcon} {whoLabel}</span>
              <span style={{ fontSize:11, color:"var(--t-text-muted,#6b5f88)" }}>{PERIOD_EMOJI[goal.period]} {PERIOD_LABEL[goal.period]} · {isMax?"máx.":"mín."} {goal.target}×</span>
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:2 }}>
          <button onClick={onEdit} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--t-text-dim,#4a4166)", fontSize:15, padding:"3px 5px" }}
            onMouseEnter={e=>e.currentTarget.style.color="#a78bfa"} onMouseLeave={e=>e.currentTarget.style.color="#4a4166"}>✏️</button>
          <button onClick={onArchive} title="Archivar" style={{ background:"none", border:"none", cursor:"pointer", color:"var(--t-text-dim,#4a4166)", fontSize:13, padding:"3px 5px" }}
            onMouseEnter={e=>e.currentTarget.style.color="#fb923c"} onMouseLeave={e=>e.currentTarget.style.color="#4a4166"}>📦</button>
        </div>
      </div>

      {/* Progreso actual */}
      <div style={{ marginBottom:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:5 }}>
          <span style={{ color:"#8b7fa8" }}>{goal.period==="weekly"?"Esta semana":goal.period==="monthly"?"Este mes":"Este año"}</span>
          <span style={{ color:met?"#34d399":isMax&&progress.current>progress.target?"#f472b6":"var(--t-text,#f8f4ff)", fontWeight:600 }}>
            {met?"✅ ":isMax&&progress.current>progress.target?"❌ ":""}{progress.current}/{progress.target}{isMax?" (máx.)":""}
          </span>
        </div>
        <div style={{ background:"rgba(128,128,128,0.10)", borderRadius:99, height:8, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${progress.pct}%`, background:met?"linear-gradient(90deg,#34d399,#60a5fa)":isMax&&progress.current>progress.target?"linear-gradient(90deg,#f472b6,#fb923c)":`linear-gradient(90deg,${whoColor},${whoColor}99)`, borderRadius:99, transition:"width 0.5s" }} />
        </div>
      </div>

      {/* Countdown */}
      {goal.deadline && (() => {
        const dl = new Date(goal.deadline); dl.setHours(23, 59, 59);
        const msLeft = dl - new Date();
        const expired = msLeft < 0;
        const under24h = !expired && msLeft < 86400000;
        let label;
        if (expired) { const d = Math.floor(-msLeft/86400000); label = `💀 Venció hace ${d||1} día${d!==1?"s":""}`; }
        else if (under24h) { const h=Math.floor(msLeft/3600000),m=Math.floor((msLeft%3600000)/60000),s=Math.floor((msLeft%60000)/1000); label = `⏰ ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")} restantes`; }
        else { const d = Math.ceil(msLeft/86400000); label = `⏳ ${d} día${d!==1?"s":""} para el deadline`; }
        const urgent = !expired && msLeft < 7 * 86400000;
        return <div style={{ marginBottom:10, display:"flex", alignItems:"center", gap:6, background:expired?"rgba(244,114,182,0.1)":under24h?"rgba(244,114,182,0.08)":urgent?"rgba(251,146,60,0.08)":"rgba(167,139,250,0.06)", border:`1px solid ${expired||under24h?"rgba(244,114,182,0.3)":urgent?"rgba(251,146,60,0.25)":"rgba(167,139,250,0.15)"}`, borderRadius:8, padding:"6px 10px" }}>
          <span style={{ fontSize:12, color:expired||under24h?"#f472b6":urgent?"#fb923c":"#8b7fa8", fontWeight:600, fontFamily:under24h?"monospace":"inherit", letterSpacing:under24h?1:0 }}>{label}</span>
          <span style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)", marginLeft:"auto" }}>{goal.deadline}</span>
        </div>;
      })()}

      {/* Historial */}
      {history.length > 0 && (
        <div>
          <div style={{ fontSize:9, letterSpacing:1.5, textTransform:"uppercase", color:"var(--t-text-dim,#4a4166)", marginBottom:5 }}>Historial</div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {history.map((h, i) => {
              const failed  = !h.met && (h.count > 0 || h.isPast) && !h.noData;
              const noData  = !!h.noData;
              const selected = detailIdx === i;
              return <div key={i}
                onClick={() => !noData && setDetailIdx(selected ? null : i)}
                title={noData ? `${h.label}: sin datos` : `${h.label}: ${h.count}/${goal.target}`}
                style={{ minWidth:28, height:28, borderRadius:7, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontSize:10, gap:1,
                  background:selected?"rgba(167,139,250,0.22)":noData?"rgba(128,128,128,0.04)":failed?"rgba(244,114,182,0.18)":h.met?"rgba(52,211,153,0.15)":"rgba(128,128,128,0.06)",
                  border:`1px solid ${selected?"rgba(167,139,250,0.6)":noData?"rgba(128,128,128,0.10)":failed?"rgba(244,114,182,0.45)":h.met?"rgba(52,211,153,0.35)":"rgba(128,128,128,0.10)"}`,
                  color:selected?"#c4b8ff":noData?"var(--t-text-dim,#2d2450)":failed?"#f472b6":h.met?"#34d399":"var(--t-text-dim,#4a4166)",
                  padding:"0 4px", cursor:noData?"default":"pointer", transition:"background .15s,border .15s" }}>
                <span style={{ fontSize:11 }}>{noData ? "–" : failed ? "❌" : h.met ? "✅" : "·"}</span>
                <span style={{ fontSize:8 }}>{h.label}</span>
              </div>;
            })}
          </div>

          {detailIdx !== null && (() => {
            const h = history[detailIdx];
            const ms = getPeriodMissions(h);
            return (
              <div style={{ marginTop:8, background:"rgba(128,128,128,0.05)", border:"1px solid rgba(167,139,250,0.18)", borderRadius:8, padding:"8px 10px" }}>
                <div style={{ fontSize:10, fontWeight:600, color:"var(--t-accent,#a78bfa)", marginBottom:ms.length ? 6 : 0 }}>
                  {h.label} · {ms.length} actividad{ms.length !== 1 ? "es" : ""}
                </div>
                {ms.length === 0 ? (
                  <div style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)", fontStyle:"italic" }}>Sin actividades registradas</div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    {ms.map(m => {
                      const mc = m.who==="person1"?clr.person1:m.who==="person2"?clr.person2:clr.together;
                      return (
                        <div key={m.id} style={{ display:"flex", alignItems:"center", gap:7, padding:"4px 0", borderBottom:"1px solid rgba(128,128,128,0.08)" }}>
                          <span style={{ fontSize:14, flexShrink:0 }}>{m.emoji||"🎯"}</span>
                          <span style={{ flex:1, fontSize:12, color:"var(--t-text,#f0e8ff)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.title}</span>
                          {m.date && <span style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", flexShrink:0 }}>{m.date}</span>}
                          <span style={{ width:8, height:8, borderRadius:99, background:mc, flexShrink:0 }} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ─── GoalsView ────────────────────────────────────────────────────────────────
export default function GoalsView({ goals, weeks, cwn, cyr, p1, p2, colors, onAdd, onUpdate, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [form, setForm] = useState({ emoji:"🏅", title:"", who:"together", period:"monthly", target:1 });

  const openNew  = () => { setEditGoal(null); setForm({ emoji:"🏅", title:"", who:"together", period:"monthly", target:1, deadline:"", goalType:"min", startDate:"" }); setShowForm(true); };
  const openEdit = g  => { setEditGoal(g); setForm({ emoji:g.emoji, title:g.title, who:g.who, period:g.period, target:g.target, deadline:g.deadline||"", goalType:g.goalType||"min", startDate:g.startDate||"" }); setShowForm(true); };
  const cancel   = () => { setShowForm(false); setEditGoal(null); };
  const save     = () => {
    if (!form.title.trim()) return;
    if (editGoal) onUpdate(editGoal.id, form); else onAdd(form);
    setShowForm(false); setEditGoal(null);
  };

  const active   = (goals || []).filter(g => g.active !== false);
  const archived = (goals || []).filter(g => g.active === false);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#a78bfa", fontWeight:600 }}>🏅 Metas activas</div>
        {!showForm && <button onClick={openNew} style={S.btnPrimary}>+ Nueva meta</button>}
      </div>

      {showForm && <GoalForm form={form} setForm={setForm} onSave={save} onCancel={cancel} isEdit={!!editGoal} p1={p1} p2={p2} />}

      {active.map(g => {
        const prog = computeGoalProgress(g, weeks, cwn, cyr);
        const hist = computeGoalHistory(g, weeks);
        return <GoalCard key={g.id} goal={g} progress={prog} history={hist} weeks={weeks} p1={p1} p2={p2} colors={colors}
          onEdit={()=>openEdit(g)} onArchive={()=>onUpdate(g.id, { active:false })} />;
      })}

      {!active.length && !showForm && (
        <div style={{ textAlign:"center", padding:48, color:"var(--t-text-dim,#3d3360)" }}>
          <div style={{ fontSize:44, marginBottom:12 }}>🏅</div>
          <div style={{ fontStyle:"italic", fontSize:14 }}>Sin metas activas aún.<br/>¡Crea la primera!</div>
        </div>
      )}

      {archived.length > 0 && (
        <div>
          <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#4a4166)", fontWeight:600, marginBottom:8, marginTop:4 }}>Archivadas</div>
          {archived.map(g => (
            <div key={g.id} style={{ ...S.card, opacity:0.5, marginBottom:6, display:"flex", alignItems:"center", gap:10, padding:"10px 14px" }}>
              <span style={{ fontSize:20 }}>{g.emoji}</span>
              <div style={{ flex:1, fontSize:13, color:"var(--t-text-muted,#6b5f88)" }}>{g.title}</div>
              <button onClick={()=>onUpdate(g.id, { active:true })} style={{ ...S.btnSecondary, fontSize:11, padding:"3px 10px" }}>↺ Reactivar</button>
              <button onClick={()=>onDelete(g.id)} style={{ background:"none", border:"none", color:"var(--t-text-dim,#3d3360)", cursor:"pointer", fontSize:18, lineHeight:1, padding:"0 2px" }}
                onMouseEnter={e=>e.currentTarget.style.color="#f472b6"} onMouseLeave={e=>e.currentTarget.style.color="#3d3360"}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
