import { useState, lazy, Suspense, useMemo } from "react";
import { EMOTIONS } from "../constants.js";
import { dlBlob } from "../utils.js";
import { getUserPrefs, saveUserPrefs } from "../lib/userPrefs.js";
import { filterMoods, aggregateMoods, summarizePoints } from "../lib/moodAnalysis.js";
import MoodTimelineChart from "./MoodTimelineChart.jsx";

const MoodReport = lazy(() => import("./MoodReport.jsx"));

const EMOTION_BY_ID = Object.fromEntries(EMOTIONS.map(e => [e.id, e]));

const PERIODS = [["7d","Semana"],["30d","Mes"],["365d","Año"],["all","Todo"]];

export default function MoodView({ moods = [], p1, p2, colors, onAddMood, onEditMood, onDeleteMood, sessionPersonId, sessionUserId, lightTheme = false }) {
  const [period,     setPeriod]     = useState("30d");
  const [who,        setWho]        = useState(sessionPersonId || "person1");
  const [showTable,  setShowTable]  = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [notifEnabled, setNotifEnabled] = useState(() => getUserPrefs(sessionUserId).moodNotifEnabled !== false);

  const toggleNotif = () => {
    const next = !notifEnabled;
    setNotifEnabled(next);
    if (sessionUserId) saveUserPrefs(sessionUserId, { moodNotifEnabled: next });
  };

  const filtered = filterMoods(moods, period, who, sessionPersonId);
  const varianceStats = useMemo(() => summarizePoints(aggregateMoods(filtered).points), [filtered]);
  const { avgScore, posCount, negCount } = useMemo(() => {
    if (filtered.length === 0) return { avgScore: null, posCount: 0, negCount: 0 };
    const { sum, pos, neg } = filtered.reduce((acc, m) => {
      const s = m.valence * m.intensity;
      return { sum: acc.sum + s, pos: acc.pos + (m.valence > 0 ? 1 : 0), neg: acc.neg + (m.valence < 0 ? 1 : 0) };
    }, { sum: 0, pos: 0, neg: 0 });
    return { avgScore: (sum / filtered.length).toFixed(1), posCount: pos, negCount: neg };
  }, [filtered]); // filtered is the only real dep; p1/p2 are string props that don't affect computation

  // Per-person stats for comparativa (always uses full period, both people)
  const personStats = useMemo(() => {
    const all = filterMoods(moods, period, "all", sessionPersonId);
    const calc = (personId) => {
      const entries = all.filter(m => m.who === personId);
      if (entries.length === 0) return { avg: null, pos: 0, neg: 0, last: null, count: 0 };
      const sum = entries.reduce((s, m) => s + m.valence * m.intensity, 0);
      return {
        avg: (sum / entries.length).toFixed(1),
        pos: entries.filter(m => m.valence > 0).length,
        neg: entries.filter(m => m.valence < 0).length,
        last: entries[0], // already sorted desc by ts
        count: entries.length,
      };
    };
    return { p1: calc("person1"), p2: calc("person2") };
  }, [moods, period, sessionPersonId]);

  const personName = (who) => who === "person1" ? p1 : p2;

  const exportCSV = () => {
    const header = ["fecha","quien","emocion","valencia","intensidad","puntuacion","nota"];
    const rows = [...filtered].sort((a,b) => a.ts-b.ts).map(m => [
      m.date,
      `"${(personName(m.who)||"").replace(/"/g,'""')}"`,
      EMOTION_BY_ID[m.emotion]?.label || m.emotion,
      m.valence > 0 ? "positiva" : "negativa",
      m.intensity,
      m.valence * m.intensity,
      `"${(m.note||"").replace(/"/g,'""')}"`,
    ]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    dlBlob(new Blob(["﻿" + csv], { type:"text/csv;charset=utf-8" }), "animo-export.csv");
  };

  const notifToggle = (
    <button onClick={toggleNotif}
      title={notifEnabled ? "Recordatorio diario activado — toca para desactivar" : "Recordatorio diario desactivado — toca para activar"}
      style={{ background: notifEnabled ? "rgba(167,139,250,0.14)" : "rgba(128,128,128,0.08)", border:`1px solid ${notifEnabled?"rgba(167,139,250,0.35)":"rgba(255,255,255,0.1)"}`, borderRadius:12, color: notifEnabled ? "#c4b8ff" : "var(--t-text-muted,#6b5f88)", padding:"7px 10px", cursor:"pointer", fontSize:15, lineHeight:1 }}>
      {notifEnabled ? "🔔" : "🔕"}
    </button>
  );

  if (moods.length === 0) {
    return (
      <div style={{ textAlign:"center", padding:"56px 20px" }}>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:-12 }}>{notifToggle}</div>
        <div style={{ fontSize:52, marginBottom:14 }}>🧠</div>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:700, marginBottom:10, color:"var(--t-text,#f8f4ff)" }}>Seguimiento de ánimo</div>
        <div style={{ fontSize:13, color:"var(--t-text-muted,#8b7fa8)", lineHeight:1.7, marginBottom:28, maxWidth:300, margin:"0 auto 28px" }}>
          Cada día a las <strong>18:00</strong> aparece un popup automático (si lo tienes activado con {notifEnabled ? "🔔" : "🔕"} arriba).<br />
          También puedes registrar en cualquier momento. Por defecto tus registros son privados — solo los compartes si lo marcas al guardar.
        </div>
        <button onClick={onAddMood}
          style={{ background:"var(--t-btn-grad,linear-gradient(135deg,#f472b6,#a78bfa))", border:"none", borderRadius:14, color:"#fff", padding:"13px 32px", cursor:"pointer", fontFamily:"inherit", fontSize:15, fontWeight:700 }}>
          ✍️ Primer registro
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:700, color:"var(--t-text,#f8f4ff)" }}>🧠 Ánimo</div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {notifToggle}
          <button onClick={onAddMood}
            style={{ background:"var(--t-btn-grad,linear-gradient(135deg,#f472b6,#a78bfa))", border:"none", borderRadius:12, color:"#fff", padding:"8px 16px", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600 }}>
            + Registrar
          </button>
        </div>
      </div>

      {/* Period filter */}
      <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:10 }}>
        {PERIODS.map(([k,l]) => (
          <button key={k} onClick={() => setPeriod(k)}
            style={{ background: period===k?"rgba(167,139,250,0.18)":"rgba(128,128,128,0.07)", border:`1px solid ${period===k?"rgba(167,139,250,0.4)":"rgba(255,255,255,0.07)"}`, borderRadius:99, color: period===k?"#c4b8ff":"var(--t-text-muted,#6b5f88)", padding:"4px 12px", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight: period===k?600:400 }}>
            {l}
          </button>
        ))}
      </div>

      {/* Who filter */}
      <div style={{ display:"flex", gap:7, marginBottom:16 }}>
        {[["person1",p1,colors.person1],["person2",p2,colors.person2]].map(([k,l,c]) => {
          const active = who === k;
          return (
            <button key={k} onClick={() => setWho(k)}
              style={{ background:active?`${c}22`:"rgba(128,128,128,0.07)", border:`1px solid ${active?c:"rgba(255,255,255,0.07)"}`, borderRadius:99, color:active?c:"var(--t-text-muted,#6b5f88)", padding:"4px 12px", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:active?600:400 }}>
              {l}
            </button>
          );
        })}
      </div>

      {/* Stats strip */}
      {filtered.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
          {[
            { label:"Promedio", value: avgScore, color: Number(avgScore) >= 0 ? "#34d399" : "#f43f5e", bg:"rgba(255,255,255,0.04)" },
            { label:"Positivos", value: posCount, color:"#34d399", bg:"rgba(52,211,153,0.08)" },
            { label:"Negativos", value: negCount, color:"#f43f5e", bg:"rgba(244,63,94,0.08)" },
          ].map(s => (
            <div key={s.label} style={{ background:s.bg, borderRadius:14, padding:"10px 8px", textAlign:"center" }}>
              <div style={{ fontSize:22, fontFamily:"'Fraunces',serif", fontWeight:700, color:s.color, lineHeight:1 }}>{s.value !== null ? (Number(s.value) > 0 && s.label==="Promedio" ? `+${s.value}` : s.value) : "—"}</div>
              <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", marginTop:4, textTransform:"uppercase", letterSpacing:0.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Variabilidad */}
      {filtered.length > 0 && varianceStats.label !== "—" && (
        <div style={{ fontSize:11.5, color:"var(--t-text-muted,#8b7fa8)", marginBottom:10, lineHeight:1.6 }}>
          <div><strong style={{ color:"var(--t-text,#f8f4ff)" }}>Variabilidad:</strong> {varianceStats.label} (desviación {varianceStats.std.toFixed(1)} pts)</div>
          <div><strong style={{ color:"var(--t-text,#f8f4ff)" }}>Mayor cambio entre períodos:</strong> {varianceStats.biggestChange > 0 ? "+" : ""}{varianceStats.biggestChange.toFixed(1)} pts</div>
        </div>
      )}

      {/* Chart */}
      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, padding:"12px 8px 8px", marginBottom:14 }}>
        <MoodTimelineChart moods={filtered} light={lightTheme} />
      </div>

      {/* Comparativa */}
      {moods.some(m => m.who === "person1") && moods.some(m => m.who === "person2") && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Comparativa</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {[["person1", p1, colors.person1, personStats.p1], ["person2", p2, colors.person2, personStats.p2]].map(([pid, pname, pcolor, st]) => {
              const avgNum = Number(st.avg);
              const barPct = st.avg !== null ? Math.round(((avgNum + 10) / 20) * 100) : 50;
              const lastEm = st.last ? EMOTION_BY_ID[st.last.emotion] : null;
              return (
                <div key={pid} style={{ background:`${pcolor}0a`, border:`1px solid ${pcolor}25`, borderRadius:16, padding:"12px 14px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
                    <span style={{ width:10, height:10, borderRadius:"50%", background:pcolor, flexShrink:0, display:"inline-block" }} />
                    <span style={{ fontSize:13, fontWeight:700, color:pcolor }}>{pname}</span>
                    {st.count > 0 && <span style={{ fontSize:10, color:"rgba(255,255,255,0.25)", marginLeft:"auto" }}>{st.count} reg.</span>}
                  </div>
                  {st.avg === null ? (
                    <div style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)", textAlign:"center", padding:"8px 0" }}>Sin datos</div>
                  ) : (
                    <>
                      <div style={{ fontSize:28, fontFamily:"'Fraunces',serif", fontWeight:700, color: avgNum >= 0 ? "#34d399" : "#f43f5e", lineHeight:1, marginBottom:6 }}>
                        {avgNum > 0 ? "+" : ""}{st.avg}
                      </div>
                      {/* Score bar */}
                      <div style={{ height:4, borderRadius:99, background:"rgba(255,255,255,0.07)", marginBottom:8, position:"relative", overflow:"hidden" }}>
                        <div style={{ position:"absolute", left:"50%", top:0, width:1, height:"100%", background:"rgba(255,255,255,0.15)" }} />
                        <div style={{ position:"absolute", top:0, height:"100%", left: avgNum < 0 ? `${barPct}%` : "50%", right: avgNum >= 0 ? `${100-barPct}%` : "50%", background: avgNum >= 0 ? "#34d399" : "#f43f5e", borderRadius:99 }} />
                      </div>
                      <div style={{ display:"flex", gap:8, fontSize:10, color:"rgba(255,255,255,0.35)" }}>
                        <span>😊 {st.pos}</span>
                        <span>😔 {st.neg}</span>
                        {lastEm && <span style={{ marginLeft:"auto" }}>Últ: {lastEm.emoji}</span>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display:"flex", gap:10, marginBottom:12, alignItems:"center" }}>
        <button onClick={() => setShowTable(!showTable)}
          style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"var(--t-text-muted,#8b7fa8)", padding:"6px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>
          {showTable ? "▲ Ocultar tabla" : "▼ Ver registros"}
        </button>
        <button onClick={() => setShowReport(true)}
          style={{ background:"rgba(167,139,250,0.1)", border:"1px solid rgba(167,139,250,0.28)", borderRadius:10, color:"#c4b8ff", padding:"6px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:12, marginLeft:"auto" }}>
          📄 Generar reporte
        </button>
        <button onClick={exportCSV}
          style={{ background:"rgba(96,165,250,0.08)", border:"1px solid rgba(96,165,250,0.22)", borderRadius:10, color:"#60a5fa", padding:"6px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>
          ↓ Exportar CSV
        </button>
      </div>

      {/* Table */}
      {showTable && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.length === 0
            ? <div style={{ textAlign:"center", padding:"24px 0", color:"var(--t-text-muted,#8b7fa8)", fontSize:13 }}>Sin registros en este período</div>
            : filtered.map(m => {
                const em     = EMOTION_BY_ID[m.emotion];
                const score  = m.valence * m.intensity;
                const pColor = m.who === "person1" ? colors.person1 : colors.person2;
                const pLabel = personName(m.who);
                const key    = m.id || m.ts;
                const isConfirming = confirmDeleteId === key;
                return (
                  <div key={key} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"10px 14px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:22, flexShrink:0 }}>{em?.emoji}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                          <span style={{ fontWeight:600, fontSize:14, color: score >= 0 ? "#34d399" : "#f43f5e" }}>{em?.label}</span>
                          <span style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>×{m.intensity}</span>
                          <span style={{ fontSize:11, fontWeight:700, color: score >= 0 ? "#34d399" : "#f43f5e" }}>{score > 0 ? "+" : ""}{score}</span>
                        </div>
                        <div style={{ display:"flex", gap:10, marginTop:3 }}>
                          <span style={{ fontSize:11, color:pColor, fontWeight:600 }}>{pLabel}{m.shared === false && " 🔒"}</span>
                          <span style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)" }}>{m.date}</span>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                        {onEditMood && (
                          <button onClick={() => onEditMood(m)}
                            style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"var(--t-text-muted,#8b7fa8)", cursor:"pointer", fontSize:13, padding:"3px 8px", fontFamily:"inherit" }}>✏️</button>
                        )}
                        {onDeleteMood && (
                          isConfirming
                            ? <button onClick={() => { onDeleteMood(m.id || m.ts); setConfirmDeleteId(null); }}
                                style={{ background:"rgba(244,63,94,0.15)", border:"1px solid rgba(244,63,94,0.4)", borderRadius:8, color:"#f43f5e", cursor:"pointer", fontSize:12, padding:"3px 8px", fontFamily:"inherit", fontWeight:600 }}>¿Borrar?</button>
                            : <button onClick={() => setConfirmDeleteId(key)}
                                style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"var(--t-text-muted,#8b7fa8)", cursor:"pointer", fontSize:13, padding:"3px 8px", fontFamily:"inherit" }}>🗑️</button>
                        )}
                      </div>
                    </div>
                    {m.note ? <div style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)", marginTop:8, paddingTop:8, borderTop:"1px solid rgba(255,255,255,0.05)", lineHeight:1.55 }}>{m.note}</div> : null}
                  </div>
                );
              })
          }
        </div>
      )}

      {showReport && (
        <Suspense fallback={
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:150, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ color:"var(--t-text-muted,#8b7fa8)", fontSize:13 }}>Cargando…</div>
          </div>
        }>
          <MoodReport moods={moods} p1={p1} p2={p2} colors={colors} initialPeriod={period} initialWho={who} onClose={() => setShowReport(false)} />
        </Suspense>
      )}
    </div>
  );
}
