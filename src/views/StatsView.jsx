import { useState } from "react";
import { CATEGORIES, STATUS, STATUS_ORDER, DEFAULT_COLORS } from "../constants.js";
import { getMCats } from "../constants.js";
import { getWeekAndYear, isoWeekKey } from "../utils.js";
import { S } from "../styles.js";

// ─── CatStatsCard ─────────────────────────────────────────────────────────────
function CatStatsCard({ catStats }) {
  const [tab, setTab] = useState("act");
  const maxC       = Math.max(...catStats.map(x => x.count), 1);
  const lifeStats  = catStats.filter(c => c.id !== "trabajo");
  const workStat   = catStats.find(c => c.id === "trabajo");
  const maxLifeH   = Math.max(...lifeStats.map(c => c.dur), 0.1);

  return (
    <div style={S.card}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", fontWeight:600 }}>🏷️ Por categoría</span>
        <div style={{ display:"flex", gap:3 }}>
          {[["act","Actividades"],["h","Horas"]].map(([v, l]) => (
            <button key={v} onClick={()=>setTab(v)} style={{ background:tab===v?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.04)", border:`1px solid ${tab===v?"rgba(167,139,250,0.4)":"rgba(255,255,255,0.08)"}`, borderRadius:7, color:tab===v?"#c4b8ff":"#6b5f88", padding:"3px 10px", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
      </div>

      {tab === "act"
        ? catStats.map(c => {
            const cpct = c.count > 0 ? Math.round((c.done / c.count) * 100) : 0;
            return (
              <div key={c.id} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:12, color:c.color, fontWeight:600 }}>{c.icon} {c.label}</span>
                  <span style={{ fontSize:12, color:cpct===100?"#34d399":"#6b5f88", fontWeight:600 }}>{c.done}/{c.count} ({cpct}%)</span>
                </div>
                <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:99, height:6, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${(c.count/maxC)*100}%`, background:c.color, borderRadius:99, opacity:0.8 }} />
                </div>
              </div>
            );
          })
        : <>
            {lifeStats.filter(c => c.dur > 0).length > 0 && <>
              <div style={{ fontSize:10, color:"#4a4166", letterSpacing:1.5, marginBottom:8 }}>VIDA</div>
              {lifeStats.filter(c => c.dur > 0).map(c => (
                <div key={c.id} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, color:c.color, fontWeight:600 }}>{c.icon} {c.label}</span>
                    <span style={{ fontSize:12, color:"#60a5fa" }}>{c.dur}h</span>
                  </div>
                  <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:99, height:6, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${(c.dur/maxLifeH)*100}%`, background:c.color, borderRadius:99, opacity:0.8 }} />
                  </div>
                </div>
              ))}
            </>}
            {workStat && workStat.dur > 0 && <>
              <div style={{ borderTop:"1px dashed rgba(251,191,36,0.2)", marginTop:10, paddingTop:10, marginBottom:8 }}>
                <div style={{ fontSize:10, color:"#fbbf2488", letterSpacing:1.5 }}>TRABAJO <span style={{ color:"#4a4166", fontWeight:400 }}>(escala propia)</span></div>
              </div>
              <div style={{ marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:12, color:"#fbbf24", fontWeight:600 }}>💼 Trabajo</span>
                  <span style={{ fontSize:12, color:"#fbbf24", fontWeight:700 }}>{workStat.dur}h</span>
                </div>
                <div style={{ background:"rgba(251,191,36,0.08)", borderRadius:99, height:8, overflow:"hidden", border:"1px solid rgba(251,191,36,0.15)" }}>
                  <div style={{ height:"100%", width:"100%", background:"linear-gradient(90deg,#fbbf24,#f59e0b)", borderRadius:99, opacity:0.8 }} />
                </div>
              </div>
            </>}
            {!catStats.some(c => c.dur > 0) && <div style={{ textAlign:"center", color:"#4a4166", fontSize:12, padding:"20px 0" }}>Sin horas registradas aún.</div>}
          </>
      }
    </div>
  );
}

// ─── WeekDetailList ───────────────────────────────────────────────────────────
function WeekDetailList({ allW, onGoToWeek }) {
  const [open, setOpen] = useState(false);
  const rows = [...allW].reverse().map(w => {
    const ms  = w.missions || [];
    const d   = ms.filter(m => m.status === "DONE").length;
    const t   = ms.length;
    const pct = t > 0 ? Math.round((d / t) * 100) : 0;
    return { w, d, t, pct, color: pct===100?"#34d399":pct>=60?"#fbbf24":"#f472b6" };
  }).filter(r => r.t > 0);

  if (!rows.length) return null;

  return (
    <div style={S.card}>
      <button onClick={()=>setOpen(o=>!o)} style={{ width:"100%", background:"none", border:"none", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", padding:0, fontFamily:"inherit" }}>
        <span style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", fontWeight:600 }}>📋 Detalle por semana</span>
        <span style={{ fontSize:12, color:"#4a4166", transition:"transform 0.2s", display:"inline-block", transform:open?"rotate(180deg)":"rotate(0deg)" }}>▾</span>
      </button>

      {open && (
        <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:0 }}>
          {rows.map(({ w, d, t, pct, color }, i) => (
            <div key={w.weekNumber} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderTop:i>0?"1px solid rgba(255,255,255,0.04)":"none" }}>
              <div style={{ minWidth:34, height:34, borderRadius:9, background:`${color}18`, border:`1px solid ${color}40`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span style={{ fontSize:9, color, fontWeight:700, lineHeight:1 }}>S{w.weekNumber}</span>
                <span style={{ fontSize:8, color:"#4a4166", lineHeight:1.2 }}>{w._yr}</span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                {w.epicObjective && <div style={{ fontSize:11, color:"#8b7fa8", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginBottom:3 }}>{w.epicObjective}</div>}
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ flex:1, background:"rgba(255,255,255,0.06)", borderRadius:99, height:5, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:99, transition:"width 0.4s" }} />
                  </div>
                  <span style={{ fontSize:11, color, fontWeight:600, flexShrink:0, minWidth:36, textAlign:"right" }}>{d}/{t}</span>
                </div>
              </div>
              {onGoToWeek && (
                <button onClick={()=>onGoToWeek(w.weekNumber, w._yr)} style={{ background:"rgba(167,139,250,0.1)", border:"1px solid rgba(167,139,250,0.2)", borderRadius:8, color:"#a78bfa", fontSize:11, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>→ Ir</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── StatsView ────────────────────────────────────────────────────────────────
export default function StatsView({ weeks, p1, p2, colors, onGoToWeek }) {
  const clr = { ...DEFAULT_COLORS, ...(colors || {}) };
  const [stWho,         setStWho]         = useState("all");
  const [stRange,       setStRange]       = useState("all");
  const [showPartInfo,  setShowPartInfo]  = useState(false);

  const { week: _tw, year: _ty } = getWeekAndYear();
  const todayKey    = isoWeekKey(_tw, _ty);
  const sortedAll   = Object.entries(weeks).filter(([key]) => key <= todayKey).sort((a, b) => a[0].localeCompare(b[0]));
  const rangedEntries = stRange === "all" ? sortedAll : sortedAll.slice(-parseInt(stRange));
  const allW = rangedEntries.map(([key, w]) => {
    const ms = stWho === "all" ? (w.missions||[]) : (w.missions||[]).filter(m => m.who === stWho);
    return { ...w, missions:ms, _yr: parseInt(key.split("-W")[0]) || new Date().getFullYear() };
  });
  const allM     = allW.flatMap(w => w.missions || []);
  const total    = allM.length;
  const done     = allM.filter(m => m.status === "DONE").length;
  const pct      = total > 0 ? Math.round((done / total) * 100) : 0;
  const wc       = allW.length;

  let bestStreak = 0, currStreak = 0, currStreakNow = 0;
  for (const w of allW) {
    const d = w.missions?.filter(m => m.status==="DONE").length || 0, t = w.missions?.length || 0;
    if (t > 0 && d === t) { currStreak++; bestStreak = Math.max(bestStreak, currStreak); currStreakNow = currStreak; } else currStreak = 0;
  }

  const bySt    = STATUS_ORDER.map(s => ({ s, count: allM.filter(m => m.status===s).length }));
  const maxSt   = Math.max(...bySt.map(x => x.count), 1);
  const catStats = CATEGORIES.map(c => {
    const ms = allM.filter(m => getMCats(m).includes(c.id));
    return { ...c, dur:ms.reduce((s,m)=>s+(m.duration||m.estimatedHours||0),0), count:ms.length, done:ms.filter(m=>m.status==="DONE").length };
  }).filter(c => c.count > 0).sort((a, b) => b.count - a.count);

  const rawAllM  = rangedEntries.flatMap(([, w]) => w.missions || []);
  const ph       = key => { const ms = rawAllM.filter(m=>m.who===key); return { count:ms.length, done:ms.filter(m=>m.status==="DONE").length }; };
  const ph1 = ph("person1"), ph2 = ph("person2"), phT = ph("together");
  const totalWork1 = allW.reduce((s, w) => s + (w.workHours?.person1 || 0), 0);
  const totalWork2 = allW.reduce((s, w) => s + (w.workHours?.person2 || 0), 0);
  const series     = allW.map(w => {
    const d = w.missions?.filter(m=>m.status==="DONE").length || 0, t = w.missions?.length || 0;
    return { label:`S${w.weekNumber}`, pct:t>0?Math.round((d/t)*100):0, durH:(w.missions||[]).reduce((s,m)=>s+(m.duration||m.estimatedHours||0),0), total:t, done:d, weekNumber:w.weekNumber, year:w._yr };
  });

  const pctColor      = pct >= 80 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#f472b6";
  const barPersonColor = stWho==="person1"?clr.person1:stWho==="person2"?clr.person2:stWho==="together"?clr.together:null;
  const filterLabel   = (stRange!=="all"?`Últ. ${stRange} sem.`:"Historial completo") + (stWho!=="all"?" · "+(stWho==="person1"?p1:stWho==="person2"?p2:"Juntos"):"");

  // ── AI Insights ──────────────────────────────────────────────────────────────
  const insights = [];
  if (series.length >= 3) {
    const last3 = series.slice(-3), prev3 = series.slice(-6, -3);
    const avgL = last3.reduce((s,w)=>s+w.pct,0)/last3.length;
    const avgP = prev3.length>0?prev3.reduce((s,w)=>s+w.pct,0)/prev3.length:avgL;
    const lastW = last3[last3.length-1];
    if (avgL > avgP+12) insights.push({icon:"🚀",title:`Momento imparable: +${Math.round(avgL-avgP)}pts en 3 semanas`,desc:`De ${Math.round(avgP)}% a ${Math.round(avgL)}% de media. ¡Seguid así!`,weekNumber:lastW?.weekNumber,year:lastW?.year});
    else if (avgL < avgP-12) insights.push({icon:"📉",title:"Bajada de ritmo detectada",desc:`De ${Math.round(avgP)}% bajasteis a ${Math.round(avgL)}%. Esta semana es la oportunidad de remontar.`,weekNumber:lastW?.weekNumber,year:lastW?.year});
    else insights.push({icon:"➡️",title:`Consistencia sólida al ${Math.round(avgL)}%`,desc:`Lleváis 3 semanas sin grandes altibajos. Consistencia = progreso real 💪`});
  }
  const weekScores = allW.filter(w=>isoWeekKey(w.weekNumber,w._yr)<todayKey).map(w=>{const d2=w.missions?.filter(m=>m.status==="DONE").length||0,t2=w.missions?.length||0;return{p:t2>0?d2/t2:null,wn:w.weekNumber,yr:w._yr,obj:w.epicObjective,t:t2,d:d2};}).filter(w=>w.p!==null&&w.t>=3);
  if (weekScores.length >= 2) {
    const bW = weekScores.reduce((a,b)=>b.p>a.p?b:a);
    const wW = weekScores.reduce((a,b)=>b.p<a.p?b:a);
    insights.push({icon:"🏆",title:`Mejor semana: S${bW.wn}${bW.obj?` — "${bW.obj}"`:""}`,desc:`${bW.d}/${bW.t} completadas (${Math.round(bW.p*100)}%). ¡Vuestra semana récord!`,weekNumber:bW.wn,year:bW.yr});
    if (wW.wn!==bW.wn&&Math.round(wW.p*100)<40) insights.push({icon:"💡",title:`Semana floja: S${wW.wn} (${Math.round(wW.p*100)}%)`,desc:`Solo ${wW.d}/${wW.t} completadas. Explorad qué pasó para no repetirlo.`,weekNumber:wW.wn,year:wW.yr});
  }
  if (catStats.length > 1) {
    const sorted = [...catStats].sort((a,b)=>(b.done/Math.max(b.count,1))-(a.done/Math.max(a.count,1)));
    const best = sorted[0], weak = sorted[sorted.length-1];
    if (best.count>1) insights.push({icon:best.icon,title:`${best.label}: vuestra categoría estrella`,desc:`${Math.round((best.done/best.count)*100)}% de completitud en ${best.count} misiones.`});
    if (weak.count>1&&Math.round((weak.done/weak.count)*100)<50) insights.push({icon:"⚠️",title:`${weak.label}: categoría con margen de mejora`,desc:`Solo ${Math.round((weak.done/weak.count)*100)}% completadas.`});
  }
  const p1c = ph("person1").count, p2c = ph("person2").count;
  if (p1c+p2c > 0) {
    const diff = Math.abs(p1c-p2c);
    if (diff>3) insights.push({icon:"⚖️",title:`${p1c>p2c?p1:p2} lleva ${diff} misiones más`,desc:`${p1}: ${p1c} propias · ${p2}: ${p2c} propias.`});
    else insights.push({icon:"🤝",title:"Reparto equilibrado del trabajo",desc:`${p1}: ${p1c} · ${p2}: ${p2c}.`});
  }
  if (catStats.length>0) {
    const workC = catStats.find(c=>c.id==="trabajo");
    const lifeTotal = catStats.filter(c=>c.id!=="trabajo").reduce((s,c)=>s+c.count,0);
    if (workC&&lifeTotal>0) {
      const ratio = workC.count/(workC.count+lifeTotal)*100;
      if (ratio>60) insights.push({icon:"💼",title:`Trabajo ocupa el ${Math.round(ratio)}% de las misiones`,desc:`¿Estáis dedicando suficiente tiempo a pareja y ocio?`});
      else if (ratio<20&&workC.count>0) insights.push({icon:"🌈",title:"Gran equilibrio vida-trabajo",desc:`Solo ${Math.round(ratio)}% de misiones son de trabajo.`});
    }
  }
  if (currStreakNow>=2) insights.push({icon:"🔥",title:`Racha activa: ${currStreakNow} semana${currStreakNow>1?"s":""} perfectas`,desc:`Lleváis ${currStreakNow} semanas al 100%.`});
  if (wc>=4) { const avgMpW=(total/wc).toFixed(1); insights.push({icon:"📊",title:`Media de ${avgMpW} misiones/semana`,desc:`Con ${total} misiones en ${wc} semanas.`}); }

  if (total === 0) return (
    <div style={{ textAlign:"center", color:"#3d3360", padding:50 }}>
      <div style={{ fontSize:40, marginBottom:12 }}>📊</div>
      <div style={{ fontStyle:"italic" }}>Sin datos aún.</div>
    </div>
  );

  const donutTotal    = bySt.reduce((s,x)=>s+x.count, 0);
  let donutOffset     = 0;
  const donutSegments = bySt.filter(x=>x.count>0).map(({ s, count }) => {
    const pct2 = (count/donutTotal)*100;
    const seg  = { s, pct:pct2, offset:donutOffset };
    donutOffset += pct2;
    return seg;
  });

  const whoOpts   = [{ id:"all", label:"Todos", color:"#8b7fa8" },{ id:"person1", label:p1, color:clr.person1 },{ id:"person2", label:p2, color:clr.person2 },{ id:"together", label:"Juntos", color:clr.together }];
  const rangeOpts = [{ id:"all", label:"Siempre" },{ id:"1", label:"Esta sem." },{ id:"4", label:"4 sem." },{ id:"8", label:"8 sem." },{ id:"12", label:"12 sem." }];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Filtros */}
      <div style={{ ...S.card, padding:"10px 12px", display:"flex", flexDirection:"column", gap:9 }}>
        <div style={{ display:"flex", gap:5, alignItems:"center" }}>
          <span style={{ fontSize:10, color:"#4a4166", textTransform:"uppercase", letterSpacing:1.2, flexShrink:0, width:40 }}>Quién</span>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {whoOpts.map(o => <button key={o.id} onClick={()=>setStWho(o.id)}
              style={{ background:stWho===o.id?`${o.color}22`:"rgba(255,255,255,0.03)", border:`1px solid ${stWho===o.id?o.color:"rgba(255,255,255,0.08)"}`, borderRadius:99, color:stWho===o.id?o.color:"#4a4166", padding:"3px 11px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:stWho===o.id?600:400 }}>{o.label}</button>)}
          </div>
        </div>
        <div style={{ display:"flex", gap:5, alignItems:"center" }}>
          <span style={{ fontSize:10, color:"#4a4166", textTransform:"uppercase", letterSpacing:1.2, flexShrink:0, width:40 }}>Rango</span>
          <div style={{ display:"flex", gap:4 }}>
            {rangeOpts.map(o => <button key={o.id} onClick={()=>setStRange(o.id)}
              style={{ background:stRange===o.id?"rgba(167,139,250,0.18)":"rgba(255,255,255,0.03)", border:`1px solid ${stRange===o.id?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:99, color:stRange===o.id?"#c4b8ff":"#4a4166", padding:"3px 11px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:stRange===o.id?600:400 }}>{o.label}</button>)}
          </div>
        </div>
      </div>

      {/* AI Insights */}
      {insights.length > 0 && (
        <div style={{ ...S.card, borderColor:"rgba(244,114,182,0.25)", background:"linear-gradient(135deg,rgba(167,139,250,0.07),rgba(244,114,182,0.04))" }}>
          <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#f472b6", marginBottom:12, fontWeight:600 }}>✨ Análisis inteligente</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", paddingBottom:i<insights.length-1?10:0, borderBottom:i<insights.length-1?"1px solid rgba(167,139,250,0.1)":"none" }}>
                <span style={{ fontSize:18, lineHeight:1, flexShrink:0, marginTop:1 }}>{ins.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:2 }}>
                    <span style={{ fontSize:13, color:"#e2d9ff", fontWeight:600 }}>{ins.title}</span>
                    {ins.weekNumber && onGoToWeek && <button onClick={()=>onGoToWeek(ins.weekNumber, ins.year||new Date().getFullYear())}
                      style={{ background:"rgba(167,139,250,0.15)", border:"1px solid rgba(167,139,250,0.3)", borderRadius:99, color:"#a78bfa", fontSize:10, padding:"2px 9px", cursor:"pointer", fontFamily:"inherit" }}>→ S{ins.weekNumber}</button>}
                  </div>
                  <div style={{ fontSize:12, color:"#8b7fa8", lineHeight:1.5 }}>{ins.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:7 }}>
          <span style={{ fontSize:10, color:"#4a4166", background:"rgba(167,139,250,0.08)", border:"1px solid rgba(167,139,250,0.15)", borderRadius:99, padding:"2px 10px" }}>{filterLabel}</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8 }}>
          {[
            { label:"Semanas",    value:wc,      icon:"📅", color:null },
            { label:"Misiones",   value:total,   icon:"📝", color:null },
            { label:"Completadas",value:`${pct}%`,icon:"🏆", color:pctColor },
            { label:"Racha récord",value:bestStreak>0?`${bestStreak}🔥`:"—",icon:"⚡",color:bestStreak>=3?"#fbbf24":null },
          ].map(s => (
            <div key={s.label} style={{ ...S.card, textAlign:"center", padding:"14px 6px", borderColor:s.color?`${s.color}55`:undefined }}>
              <div style={{ fontSize:22, marginBottom:3 }}>{s.icon}</div>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:700, color:s.color||"#f8f4ff", lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:9, color:"#6b5f88", textTransform:"uppercase", letterSpacing:1, marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Status donut + bars */}
      <div style={S.card}>
        <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", marginBottom:14, fontWeight:600 }}>📊 Distribución de estados</div>
        <div style={{ display:"flex", gap:16, alignItems:"center" }}>
          <div style={{ flexShrink:0 }}>
            <svg viewBox="0 0 36 36" width={90} height={90} style={{ transform:"rotate(-90deg)" }}>
              <circle cx="18" cy="18" r="15.9155" strokeWidth="3.8" fill="none" stroke="rgba(255,255,255,0.05)"/>
              {donutSegments.map(({ s, pct: p, offset }) => (
                <circle key={s} cx="18" cy="18" r="15.9155" fill="none" strokeWidth="3.8"
                  stroke={STATUS[s].color} strokeDasharray={`${p} ${100-p}`} strokeDashoffset={-offset} style={{ opacity:0.85 }} />
              ))}
            </svg>
          </div>
          <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
            {bySt.filter(x=>x.count>0).map(({ s, count }) => (
              <div key={s} style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:78, fontSize:12, color:STATUS[s].color, fontWeight:600, flexShrink:0 }}>{STATUS[s].icon} {STATUS[s].label}</div>
                <div style={{ flex:1, background:"rgba(255,255,255,0.06)", borderRadius:99, height:7, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${(count/maxSt)*100}%`, background:STATUS[s].color, borderRadius:99, opacity:0.85, transition:"width 0.5s" }} />
                </div>
                <div style={{ fontSize:12, color:"#8b7fa8", width:24, textAlign:"right", flexShrink:0 }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Barras por semana */}
      {series.length > 1 && (() => {
        const baseColor = barPersonColor || "#f472b6";
        const BAR_MAX   = 72;
        return (
          <div style={S.card}>
            <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", marginBottom:12, fontWeight:600 }}>✅ Progreso semana a semana</div>
            <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:BAR_MAX+28 }}>
              {series.map((w, i) => {
                const isLast = i === series.length-1;
                const barH   = w.total>0 ? Math.max(Math.round(w.pct/100*BAR_MAX), 3) : 3;
                const barBg  = w.pct===100 ? "linear-gradient(0deg,#34d399,#60a5fa)" : isLast ? `linear-gradient(0deg,${baseColor},${baseColor}cc)` : `linear-gradient(0deg,${baseColor}88,${baseColor}44)`;
                return (
                  <div key={w.label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                    <div style={{ fontSize:9, color:isLast?baseColor:"#6b5f88", fontWeight:isLast?700:400, height:14, display:"flex", alignItems:"flex-end" }}>{w.total>0?`${w.pct}%`:""}</div>
                    <div style={{ width:"100%", borderRadius:"3px 3px 0 0", height:barH, background:barBg, opacity:isLast?1:0.8, boxShadow:isLast?`0 0 6px ${baseColor}55`:"none", transition:"height 0.4s" }} />
                    <div style={{ fontSize:9, color:isLast?baseColor:"#4a4166", fontWeight:isLast?700:400 }}>{w.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Participación por persona */}
      <div style={S.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:showPartInfo?8:14 }}>
          <span style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", fontWeight:600 }}>👥 Participación por persona</span>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            {stWho!=="all" && <span style={{ fontSize:10, color:"#4a4166", fontStyle:"italic" }}>distribución real del rango</span>}
            <button onClick={()=>setShowPartInfo(v=>!v)} title="¿Qué mide esto?" style={{ background:showPartInfo?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.05)", border:`1px solid ${showPartInfo?"rgba(167,139,250,0.45)":"rgba(255,255,255,0.1)"}`, borderRadius:99, color:showPartInfo?"#c4b8ff":"#6b5f88", fontSize:11, padding:"1px 7px", cursor:"pointer", fontFamily:"inherit", lineHeight:1.6 }}>ℹ</button>
          </div>
        </div>
        {showPartInfo && (
          <div style={{ marginBottom:12, padding:"8px 10px", background:"rgba(167,139,250,0.06)", border:"1px solid rgba(167,139,250,0.15)", borderRadius:8, fontSize:12, color:"#8b7fa8", lineHeight:1.6 }}>
            Muestra cuántas actividades tiene asignadas cada persona en el período seleccionado y qué porcentaje completó. No mide quién hizo más trabajo, sino cómo están distribuidas las responsabilidades.
          </div>
        )}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[{ name:p1, h:ph1, color:clr.person1 },{ name:p2, h:ph2, color:clr.person2 },{ name:"Juntos", h:phT, color:clr.together }].map(({ name, h, color }) => {
            const tot = ph1.count + ph2.count + phT.count || 1;
            return (
              <div key={name} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:64, fontSize:12, color, fontWeight:600, flexShrink:0 }}>{name}</div>
                <div style={{ flex:1, background:"rgba(255,255,255,0.06)", borderRadius:99, height:8, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${(h.count/tot)*100}%`, background:color, borderRadius:99, opacity:0.8 }} />
                </div>
                <div style={{ fontSize:12, color:"#8b7fa8", flexShrink:0, width:60, textAlign:"right" }}>
                  {h.count} <span style={{ color, fontWeight:600 }}>{h.count>0?`(${Math.round((h.done/h.count)*100)}%✓)`:""}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Categorías */}
      {catStats.length > 0 && <CatStatsCard catStats={catStats} />}

      {/* Horas laborales */}
      {(totalWork1 > 0 || totalWork2 > 0) && (
        <div style={S.card}>
          <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#fbbf24", marginBottom:14, fontWeight:600 }}>💼 Horas laborales totales</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[[p1,totalWork1],[p2,totalWork2]].map(([name, h]) => (
              <div key={name} style={{ background:"rgba(251,191,36,0.07)", border:"1px solid rgba(251,191,36,0.15)", borderRadius:10, padding:"12px", textAlign:"center" }}>
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:28, fontWeight:700, color:"#fbbf24" }}>{h}h</div>
                <div style={{ fontSize:12, color:"#8b7fa8", marginTop:2 }}>{name}</div>
              </div>
            ))}
          </div>
          {totalWork1>0&&totalWork2>0&&(
            <div style={{ marginTop:10, fontSize:12, color:"#8b7fa8", textAlign:"center" }}>
              {Math.abs(totalWork1-totalWork2)<5?"⚖️ Carga laboral muy equilibrada":totalWork1>totalWork2?`⚡ ${p1} trabajó ${totalWork1-totalWork2}h más esta temporada`:`⚡ ${p2} trabajó ${totalWork2-totalWork1}h más esta temporada`}
            </div>
          )}
        </div>
      )}

      <WeekDetailList allW={allW} onGoToWeek={onGoToWeek} />
    </div>
  );
}
