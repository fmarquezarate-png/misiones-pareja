import { useState } from "react";
import { S } from "../styles.js";
import { STATUS_ORDER, STATUS, CATEGORIES, DEFAULT_COLORS, getMCats } from "../constants.js";
import { getWeekAndYear, isoWeekKey, dlBlob } from "../utils.js";
import { generateInsights } from "../lib/insights.js";
import { isEnabled } from "../lib/flags.js";
import CatStatsCard from "./CatStatsCard.jsx";
import WeekDetailList from "./WeekDetailList.jsx";

export default function StatsView({ weeks, p1, p2, colors, onGoToWeek }) {
  const clr = { ...DEFAULT_COLORS, ...(colors||{}) };
  const [stWho,        setStWho]        = useState("all");
  const [stRange,      setStRange]      = useState("all");
  const [showPartInfo, setShowPartInfo] = useState(false);
  const [exportModal,  setExportModal]  = useState(false);
  const [exportSecs,   setExportSecs]   = useState({ progress:true, personas:true, categorias:true, insights:false });

  const { week: _tw, year: _ty } = getWeekAndYear();
  const todayKey = isoWeekKey(_tw, _ty);
  const sortedAll = Object.entries(weeks).filter(([key]) => key <= todayKey).sort((a,b)=>a[0].localeCompare(b[0]));
  const rangedEntries = stRange==="all" ? sortedAll : sortedAll.slice(-parseInt(stRange));
  const allW = rangedEntries.map(([key,w]) => {
    const ms = stWho==="all" ? (w.missions||[]) : (w.missions||[]).filter(m=>m.who===stWho);
    const _yr = parseInt(key.split("-W")[0]) || new Date().getFullYear();
    return { ...w, missions:ms, _yr };
  });
  const allM = allW.flatMap(w=>w.missions||[]);
  const total=allM.length, done=allM.filter(m=>m.status==="DONE"&&!m.completedLate).length;
  const pct=total>0?Math.round((done/total)*100):0, wc=allW.length;

  let bestStreak=0, currStreak=0, currStreakNow=0;
  for (const w of allW) {
    const d=w.missions?.filter(m=>m.status==="DONE").length||0, t=w.missions?.length||0;
    if (t>0 && d===t) { currStreak++; bestStreak=Math.max(bestStreak,currStreak); currStreakNow=currStreak; } else { currStreak=0; }
  }

  const bySt = STATUS_ORDER.map(s => ({ s, count:allM.filter(m=>m.status===s).length }));
  const maxSt = Math.max(...bySt.map(x=>x.count), 1);
  const catStats = CATEGORIES.map(c => {
    const ms=allM.filter(m=>getMCats(m).includes(c.id));
    return { ...c, dur:ms.reduce((s,m)=>s+(m.duration||0),0), count:ms.length, done:ms.filter(m=>m.status==="DONE").length };
  }).filter(c=>c.count>0).sort((a,b)=>b.count-a.count);
  const rawAllM = rangedEntries.flatMap(([,w]) => w.missions||[]);
  const ph = key => { const ms=rawAllM.filter(m=>m.who===key); return { count:ms.length, done:ms.filter(m=>m.status==="DONE").length }; };
  const ph1=ph("person1"), ph2=ph("person2"), phT=ph("together");
  const totalWork1=allW.reduce((s,w)=>s+(w.workHours?.person1||0),0), totalWork2=allW.reduce((s,w)=>s+(w.workHours?.person2||0),0);
  const series=allW.map(w=>{ const d=w.missions?.filter(m=>m.status==="DONE"&&!m.completedLate).length||0,t=w.missions?.length||0; return { label:`S${w.weekNumber}`, pct:t>0?Math.round((d/t)*100):0, durH:(w.missions||[]).reduce((s,m)=>s+(m.duration||0),0), total:t, done:d, weekNumber:w.weekNumber, year:w._yr }; });

  const pctColor = pct>=80?"#34d399":pct>=50?"#fbbf24":"#f472b6";
  const barPersonColor = stWho==="person1"?clr.person1:stWho==="person2"?clr.person2:stWho==="together"?clr.together:null;
  const filterLabel = (stRange!=="all"?`Últ. ${stRange} sem.`:"Historial completo") + (stWho!=="all"?" · "+(stWho==="person1"?p1:stWho==="person2"?p2:"Juntos"):"");

  const analysisSeries = series.filter(s => isoWeekKey(s.weekNumber, s.year) < todayKey);
  const insights = [];
  if (analysisSeries.length>=3) {
    const last3=analysisSeries.slice(-3),prev3=analysisSeries.slice(-6,-3);
    const avgL=last3.reduce((s,w)=>s+w.pct,0)/last3.length;
    const avgP=prev3.length>0?prev3.reduce((s,w)=>s+w.pct,0)/prev3.length:avgL;
    const lastW=last3[last3.length-1];
    const wRange=`S${last3[0].weekNumber}–S${lastW.weekNumber}`;
    if (avgL>avgP+12) insights.push({icon:"🚀",title:`Tendencia al alza (${wRange}): +${Math.round(avgL-avgP)} puntos`,desc:`Habéis subido de ${Math.round(avgP)}% (3 sem. anteriores) a ${Math.round(avgL)}% (últimas 3 sem.). Ritmo excelente, mantened el plan.`,weekNumber:lastW?.weekNumber,year:lastW?.year});
    else if (avgL<avgP-12) insights.push({icon:"📉",title:`Bajada de ritmo (${wRange}): −${Math.round(avgP-avgL)} puntos`,desc:`Bajasteis de ${Math.round(avgP)}% a ${Math.round(avgL)}%. Revisad si las misiones son demasiado ambiciosas o si algo externo os está afectando.`,weekNumber:lastW?.weekNumber,year:lastW?.year});
    else insights.push({icon:"➡️",title:`Ritmo estable al ${Math.round(avgL)}% (${wRange})`,desc:`Lleváis 3 semanas con una variación menor de 12 puntos. La consistencia es más valiosa que los picos. Seguid igual.`});
  }
  const weekScores=allW.filter(w=>isoWeekKey(w.weekNumber,w._yr)<todayKey).map(w=>{const d=w.missions?.filter(m=>m.status==="DONE"&&!m.completedLate).length||0,t=w.missions?.length||0;return{p:t>0?d/t:null,wn:w.weekNumber,yr:w._yr,obj:w.epicObjective,t,d};}).filter(w=>w.p!==null&&w.t>=5);
  if (weekScores.length>=2){
    const bW=weekScores.reduce((a,b)=>b.p>a.p?b:a);
    const wW=weekScores.reduce((a,b)=>b.p<a.p?b:a);
    if (Math.round(bW.p*100)>=60) insights.push({icon:"🏆",title:`Semana récord: S${bW.wn} con ${Math.round(bW.p*100)}%${bW.obj?` — "${bW.obj}"`:""}`,desc:`${bW.d} de ${bW.t} misiones completadas. ¿Qué hicisteis diferente esa semana? Intentad replicarlo.`,weekNumber:bW.wn,year:bW.yr});
    if (wW.wn!==bW.wn&&Math.round(wW.p*100)<40) insights.push({icon:"💡",title:`Semana más difícil: S${wW.wn} (${Math.round(wW.p*100)}%, ${wW.d}/${wW.t})`,desc:`Fue la semana con menor completitud del periodo. Analizar qué la hizo difícil puede ayudar a prevenir caídas similares.`,weekNumber:wW.wn,year:wW.yr});
  }
  if (catStats.length>1){
    const sorted=[...catStats].sort((a,b)=>b.done/Math.max(b.count,1)-a.done/Math.max(a.count,1));
    const best=sorted[0],weak=sorted[sorted.length-1];
    if (best.count>1) insights.push({icon:best.icon,title:`${best.label}: categoría estrella (${Math.round((best.done/best.count)*100)}% en ${best.count} misiones)`,desc:`${best.done} de ${best.count} completadas. Es donde sois más eficaces como equipo. Considerad ampliar misiones en esta área.`});
    if (weak.count>1&&Math.round((weak.done/weak.count)*100)<50) insights.push({icon:"⚠️",title:`${weak.label}: categoría pendiente (${Math.round((weak.done/weak.count)*100)}% en ${weak.count} misiones)`,desc:`Solo ${weak.done} de ${weak.count} completadas. Puede indicar que las misiones son poco concretas o que necesitan más tiempo del planificado.`});
  }
  const p1c=ph("person1").count,p2c=ph("person2").count;
  if (p1c+p2c>=6){
    const diff=Math.abs(p1c-p2c);
    const diffPct=Math.round((diff/(p1c+p2c))*100);
    if (diffPct>=25) insights.push({icon:"⚖️",title:`${p1c>p2c?p1:p2} concentra el ${Math.round(p1c>p2c?p1c/(p1c+p2c)*100:p2c/(p1c+p2c)*100)}% de las misiones individuales`,desc:`${p1}: ${p1c} misiones · ${p2}: ${p2c} misiones. Una diferencia del ${diffPct}% puede indicar desequilibrio. Valorad redistribuir.`});
    else insights.push({icon:"🤝",title:`Reparto equilibrado: ${p1} ${p1c} − ${p2} ${p2c} (diferencia ${diffPct}%)`,desc:`Menos del 25% de diferencia en misiones individuales. El trabajo se distribuye de forma saludable entre los dos.`});
  }
  if (catStats.length>0){
    const workC=catStats.find(c=>c.id==="trabajo");
    const lifeTotal=catStats.filter(c=>c.id!=="trabajo").reduce((s,c)=>s+c.count,0);
    if (workC&&lifeTotal>0){
      const ratio=(workC.count/(workC.count+lifeTotal)*100);
      if (ratio>60) insights.push({icon:"💼",title:`Trabajo ocupa el ${Math.round(ratio)}% de las misiones`,desc:`Las misiones de trabajo dominan el plan. ¿Estáis dedicando suficiente tiempo a pareja y ocio?`});
      else if (ratio<20&&workC.count>0) insights.push({icon:"🌈",title:"Gran equilibrio vida-trabajo",desc:`Solo ${Math.round(ratio)}% de misiones son de trabajo. Tiempo de calidad bien aprovechado.`});
    }
  }
  if (currStreakNow>=2) insights.push({icon:"🔥",title:`Racha activa: ${currStreakNow} semana${currStreakNow>1?"s":""} al 100%`,desc:`Lleváis ${currStreakNow} semanas completando todas las misiones. Cada semana que mantenéis la racha refuerza el hábito. ¡A por la siguiente!`});
  if (wc>=4){const avgMpW=(total/wc).toFixed(1);const advice=avgMpW<3?"Poco volumen — podéis añadir más misiones para aprovechar el ritmo":avgMpW>8?"Ritmo intenso — revisad si todas las misiones son realmente necesarias o si podéis simplificar":"Volumen saludable y sostenible";insights.push({icon:"📊",title:`Media de ${avgMpW} misiones/semana en ${wc} semanas`,desc:`${total} misiones planificadas en total. ${advice}.`});}

  const wrappedInsights = insights.length > 0
    ? insights
    : (isEnabled("stats_insights_enabled") ? generateInsights(weeks, p1, p2) : []);

  if(total===0) return <div style={{ textAlign:"center", color:"var(--t-text-dim,#3d3360)", padding:50 }}><div style={{ fontSize:40, marginBottom:12 }}>📊</div><div style={{ fontStyle:"italic" }}>Sin datos aún.</div></div>;

  const donutTotal = bySt.reduce((s,x)=>s+x.count,0);
  let donutOffset=0;
  const donutSegments = bySt.filter(x=>x.count>0).map(({s,count})=>{ const pct2=(count/donutTotal)*100; const seg={s,pct:pct2,offset:donutOffset}; donutOffset+=pct2; return seg; });

  const whoOpts = [
    { id:"all", label:"Todos", color:"var(--t-text-muted,#8b7fa8)" },
    { id:"person1", label:p1, color:clr.person1 },
    { id:"person2", label:p2, color:clr.person2 },
    { id:"together", label:"Juntos", color:clr.together },
  ];
  const rangeOpts = [
    { id:"all", label:"Siempre" },
    { id:"1", label:"Esta sem." },
    { id:"4", label:"4 sem." },
    { id:"8", label:"8 sem." },
    { id:"12", label:"12 sem." },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Filter bar */}
      <div style={{ ...S.card, padding:"10px 12px", display:"flex", flexDirection:"column", gap:9 }}>
        <div style={{ display:"flex", gap:5, alignItems:"center" }}>
          <span style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", textTransform:"uppercase", letterSpacing:1.2, flexShrink:0, width:40 }}>Quién</span>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {whoOpts.map(o=>{
              const active = stWho===o.id;
              return <button key={o.id} onClick={()=>setStWho(o.id)}
                style={{ background:active?`${o.color}22`:"rgba(128,128,128,0.05)", border:`1px solid ${active?o.color:"rgba(255,255,255,0.08)"}`, borderRadius:99, color:active?o.color:"var(--t-text-dim,#4a4166)", padding:"3px 11px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:active?600:400, transition:"all 0.15s" }}>
                {o.label}
              </button>;
            })}
          </div>
        </div>
        <div style={{ display:"flex", gap:5, alignItems:"center" }}>
          <span style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", textTransform:"uppercase", letterSpacing:1.2, flexShrink:0, width:40 }}>Rango</span>
          <div style={{ display:"flex", gap:4 }}>
            {rangeOpts.map(o=>{
              const active = stRange===o.id;
              return <button key={o.id} onClick={()=>setStRange(o.id)}
                style={{ background:active?"rgba(167,139,250,0.18)":"rgba(128,128,128,0.05)", border:`1px solid ${active?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:99, color:active?"#c4b8ff":"#4a4166", padding:"3px 11px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:active?600:400, transition:"all 0.15s" }}>
                {o.label}
              </button>;
            })}
          </div>
        </div>
      </div>

      {/* Insights — diseño Wrapped */}
      {wrappedInsights.length>0&&(()=>{
        const SC={
          positive:{bg:"rgba(52,211,153,0.07)",border:"rgba(52,211,153,0.22)",val:"#34d399"},
          negative:{bg:"rgba(244,114,182,0.07)",border:"rgba(244,114,182,0.22)",val:"#f472b6"},
          curious: {bg:"rgba(96,165,250,0.07)", border:"rgba(96,165,250,0.22)", val:"#60a5fa"},
          neutral: {bg:"rgba(167,139,250,0.07)",border:"rgba(167,139,250,0.22)",val:"#a78bfa"},
        };
        const sentimentOf=ins=>ins.sentiment||(ins.icon==="📉"||ins.icon==="⚠️"||ins.icon==="⚖️"?"negative":ins.icon==="🚀"||ins.icon==="🏆"||ins.icon==="🔥"||ins.icon==="🌈"||ins.icon==="🤝"?"positive":ins.icon==="💡"||ins.icon==="📊"?"curious":"neutral");
        return <div>
          <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:10, paddingLeft:2 }}>✨ Tu resumen</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {wrappedInsights.map((ins,i)=>{
              const s=sentimentOf(ins);
              const c=SC[s]||SC.neutral;
              const headline=ins.title||ins.label||"";
              const narrative=ins.desc||ins.detail||"";
              const heroValue=ins.value||ins.icon||"";
              const isValueCard=!!ins.value;
              return <div key={i} style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:14, padding:"14px 16px", opacity:0, animation:`fadeInUp 0.3s ease ${i*0.06}s forwards` }}>
                {isValueCard
                  ?<div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:6 }}>
                    <span style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:700, color:c.val, lineHeight:1 }}>{heroValue}</span>
                    <span style={{ fontSize:10, color:c.val, textTransform:"uppercase", letterSpacing:1.5, fontWeight:600 }}>{headline}</span>
                  </div>
                  :<div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:18, lineHeight:1, flexShrink:0 }}>{heroValue}</span>
                    <span style={{ fontSize:13, color:"var(--t-text,#e2d9ff)", fontWeight:600, flex:1 }}>{headline}</span>
                    {ins.weekNumber&&onGoToWeek&&<button onClick={()=>onGoToWeek(ins.weekNumber,ins.year||new Date().getFullYear())} style={{ background:"rgba(167,139,250,0.15)", border:"1px solid rgba(167,139,250,0.3)", borderRadius:99, color:"#a78bfa", fontSize:10, padding:"2px 9px", cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>→ S{ins.weekNumber}</button>}
                  </div>
                }
                <div style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)", lineHeight:1.55 }}>{narrative}</div>
              </div>;
            })}
          </div>
      </div>;
      })()}

      {/* Deep Stats v2.0 */}
      {(()=>{
        const dsM=Object.values(weeks).flatMap(w=>w.missions||[]);
        if(dsM.length<5) return null;
        const dsW=Object.values(weeks).filter(w=>(w.missions||[]).length>0);

        const totDur=dsM.reduce((s,m)=>s+(m.duration||0),0);
        const togDur=dsM.filter(m=>m.who==="together").reduce((s,m)=>s+(m.duration||0),0);
        const workDur=dsM.filter(m=>getMCats(m).includes("trabajo")).reduce((s,m)=>s+(m.duration||0),0);
        const Sc=totDur-workDur>0?Math.round((togDur/(totDur-workDur))*100):null;

        const casaM=dsM.filter(m=>getMCats(m).includes("casa"));
        const cP1=casaM.filter(m=>m.who==="person1").length,cP2=casaM.filter(m=>m.who==="person2").length;
        const Ie=cP1+cP2>=4?Math.round((1-Math.abs(cP1-cP2)/(cP1+cP2))*100):null;

        const Gd=dsM.length>0?Math.round((dsM.filter(m=>m.goalId).length/dsM.length)*100):0;

        const byS={};
        dsM.filter(m=>m.seriesPattern&&m.seriesId).forEach(m=>{
          if(!byS[m.seriesId])byS[m.seriesId]={title:m.title,emoji:m.emoji,total:0,done:0};
          byS[m.seriesId].total++;if(m.status==="DONE")byS[m.seriesId].done++;
        });
        const anchSeries=Object.values(byS).filter(s=>s.total>=3);
        const anchor=anchSeries.length?[...anchSeries].sort((a,b)=>b.done/b.total-a.done/a.total)[0]:null;

        const wData=dsW.map(w=>{const ms=w.missions||[];return{n:ms.length,pct:ms.length?ms.filter(m=>m.status==="DONE").length/ms.length:0};});
        const highComp=wData.filter(w=>w.pct>=0.7).map(w=>w.n);
        const optLoad=highComp.length?Math.round(highComp.reduce((s,n)=>s+n,0)/highComp.length):null;

        const bk={morning:{l:"Mañana 6–12",d:0,t:0},afternoon:{l:"Tarde 12–17",d:0,t:0},evening:{l:"Tarde–noche 17–21",d:0,t:0},night:{l:"Noche 21+",d:0,t:0}};
        dsM.filter(m=>m.time).forEach(m=>{
          const h=parseInt(m.time)||0;
          const k=h>=6&&h<12?"morning":h>=12&&h<17?"afternoon":h>=17&&h<21?"evening":"night";
          bk[k].t++;if(m.status==="DONE")bk[k].d++;
        });
        const bestWin=Object.entries(bk).filter(([,b])=>b.t>=3).sort((a,b)=>b[1].d/b[1].t-a[1].d/a[1].t)[0]||null;

        const pct2col=(v,hi,lo,hiClr="#34d399",loClr="#f472b6")=>v===null?"—":(<><span style={{color:v>=hi?hiClr:v>=lo?"#fbbf24":loClr,fontWeight:700,fontSize:18}}>{v}%</span></>);
        const bar=(v,hi="#34d399")=><div style={{height:4,borderRadius:2,background:"rgba(128,128,128,0.10)",marginTop:4}}><div style={{height:4,borderRadius:2,width:v===null?"0%":Math.min(100,v)+"%",background:v>=70?hi:v>=40?"#fbbf24":"#f472b6",transition:"width 0.6s"}}/></div>;

        const cards=[
          Sc!==null&&{icon:"🔗",label:"Sincronía de pareja",value:pct2col(Sc,40,20),bar:bar(Sc),note:Sc>=40?"Gran tiempo compartido":Sc>=20?"Tiempo moderado juntos":"Pocas actividades conjuntas"},
          Ie!==null&&{icon:"⚖️",label:"Equidad en casa",value:pct2col(Ie,80,50),bar:bar(Ie),note:Ie>=80?"Reparto muy equilibrado":Ie>=50?"Hay algo de desequilibrio":`${cP1>cP2?p1:p2} carga más las tareas de casa`},
          {icon:"🎯",label:"Densidad de metas",value:pct2col(Gd,40,15),bar:bar(Gd),note:Gd>=40?"Alta orientación a metas":Gd>=15?"Moderado":"Pocas actividades vinculadas a metas"},
          anchor&&{icon:anchor.emoji,label:"Hábito ancla",value:<span style={{color:"var(--t-accent,#a78bfa)",fontWeight:700,fontSize:13}}>{anchor.title}</span>,bar:bar(Math.round(anchor.done/anchor.total*100)),note:`${Math.round(anchor.done/anchor.total*100)}% completitud en ${anchor.total} ocurrencias`},
          optLoad&&{icon:"🔋",label:"Carga óptima/semana",value:<span style={{color:"#34d399",fontWeight:700,fontSize:18}}>{optLoad}</span>,bar:null,note:`Semanas con ≥70% de éxito promedian ${optLoad} misiones`},
          bestWin&&{icon:"⏰",label:"Ventana óptima",value:<span style={{color:"#60a5fa",fontWeight:700,fontSize:13}}>{bestWin[1].l}</span>,bar:bar(Math.round(bestWin[1].d/bestWin[1].t*100),"#60a5fa"),note:`${Math.round(bestWin[1].d/bestWin[1].t*100)}% completitud en ese horario`},
        ].filter(Boolean);

        return <div style={{...S.card,borderColor:"rgba(96,165,250,0.2)",background:"linear-gradient(135deg,rgba(96,165,250,0.05),rgba(167,139,250,0.04))"}}>
          <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"#60a5fa",marginBottom:12,fontWeight:600}}>🧠 Deep Stats v2.0</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
            {cards.map((c,i)=>(
              <div key={i} style={{background:"rgba(128,128,128,0.05)",border:"1px solid var(--t-card-border,rgba(128,128,128,0.12))",borderRadius:10,padding:"10px 12px"}}>
                <div style={{fontSize:10,color:"var(--t-text-dim,#4a4166)",marginBottom:4}}>{c.icon} {c.label}</div>
                <div>{c.value}</div>
                {c.bar}
                <div style={{fontSize:10,color:"var(--t-text-dim,#6b5f88)",marginTop:5,lineHeight:1.4}}>{c.note}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:9,color:"var(--t-text-dim,#3d3360)",marginTop:10,textAlign:"right"}}>Basado en {dsM.length} actividades totales · Filtros de quién/rango no aplican</div>
        </div>;
      })()}

      {/* KPIs */}
      <div>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:7 }}>
          <span style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", background:"rgba(167,139,250,0.08)", border:"1px solid rgba(167,139,250,0.15)", borderRadius:99, padding:"2px 10px" }}>{filterLabel}</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8 }}>
          {[
            {label:"Semanas",value:wc,icon:"📅",color:null},
            {label:"Misiones",value:total,icon:"📝",color:null},
            {label:"Completadas",value:`${pct}%`,icon:"🏆",color:pctColor},
            {label:"Racha récord",value:bestStreak>0?`${bestStreak}🔥`:"—",icon:"⚡",color:bestStreak>=3?"#fbbf24":null},
          ].map(s=>(
            <div key={s.label} style={{ ...S.card, textAlign:"center", padding:"14px 6px", borderColor:s.color?`${s.color}55`:undefined }}>
              <div style={{ fontSize:22, marginBottom:3 }}>{s.icon}</div>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:700, color:s.color||"var(--t-text,#f8f4ff)", lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:9, color:"var(--t-text-dim,#6b5f88)", textTransform:"uppercase", letterSpacing:1, marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Status donut + bars */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", marginBottom:14, fontWeight:600 }}>📊 Distribución de estados</div>
        <div style={{ display:"flex", gap:16, alignItems:"center" }}>
          <div style={{ flexShrink:0 }}>
            <svg viewBox="0 0 36 36" width={90} height={90} style={{ transform:"rotate(-90deg)" }}>
              <circle cx="18" cy="18" r="15.9155" strokeWidth="3.8" fill="none" stroke="rgba(128,128,128,0.08)"/>
              {donutSegments.map(({s,pct:p,offset})=>(
                <circle key={s} cx="18" cy="18" r="15.9155" fill="none" strokeWidth="3.8"
                  stroke={STATUS[s].color}
                  strokeDasharray={`${p} ${100-p}`}
                  strokeDashoffset={-offset}
                  style={{ opacity:0.85 }} />
              ))}
            </svg>
          </div>
          <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
            {bySt.filter(x=>x.count>0).map(({s,count})=>(
              <div key={s} style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:78, fontSize:12, color:STATUS[s].color, fontWeight:600, flexShrink:0 }}>{STATUS[s].icon} {STATUS[s].label}</div>
                <div style={{ flex:1, background:"rgba(128,128,128,0.10)", borderRadius:99, height:7, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${(count/maxSt)*100}%`, background:STATUS[s].color, borderRadius:99, opacity:0.85, transition:"width 0.5s" }} />
                </div>
                <div style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)", width:24, textAlign:"right", flexShrink:0 }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly progress bars */}
      {series.length>1&&(()=>{
        const baseColor=barPersonColor||"#f472b6";
        const BAR_MAX=72;
        const displaySeries=series.slice(-12);
        return <div style={S.card}>
          <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", marginBottom:12, fontWeight:600 }}>✅ Progreso semana a semana</div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:BAR_MAX+28 }}>
            {displaySeries.map((w,i)=>{
              const isLast=i===displaySeries.length-1;
              const barH=w.total>0?Math.max(Math.round(w.pct/100*BAR_MAX),3):3;
              const barBg=w.pct===100?"linear-gradient(0deg,#34d399,#60a5fa)":isLast?`linear-gradient(0deg,${baseColor},${baseColor}cc)`:`linear-gradient(0deg,${baseColor}88,${baseColor}44)`;
              return <div key={w.label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                <div style={{ fontSize:9, color:isLast?baseColor:"#6b5f88", fontWeight:isLast?700:400, height:14, display:"flex", alignItems:"flex-end" }}>{w.total>0?`${w.pct}%`:""}</div>
                <div style={{ width:"100%", borderRadius:"3px 3px 0 0", height:barH, background:barBg, opacity:isLast?1:0.8, boxShadow:isLast?`0 0 6px ${baseColor}55`:"none", transition:"height 0.4s" }} />
                <div style={{ fontSize:9, color:isLast?baseColor:"#4a4166", fontWeight:isLast?700:400 }}>{w.label}</div>
              </div>;
            })}
          </div>
        </div>;
      })()}

      {/* Participation */}
      <div style={S.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:showPartInfo?8:14 }}>
          <span style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600 }}>👥 Participación por persona</span>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            {stWho!=="all"&&<span style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", fontStyle:"italic" }}>distribución real del rango</span>}
            <button onClick={()=>setShowPartInfo(v=>!v)} title="¿Qué mide esto?" style={{ background:showPartInfo?"rgba(167,139,250,0.2)":"rgba(128,128,128,0.08)", border:`1px solid ${showPartInfo?"rgba(167,139,250,0.45)":"rgba(255,255,255,0.1)"}`, borderRadius:99, color:showPartInfo?"#c4b8ff":"#6b5f88", fontSize:11, padding:"1px 7px", cursor:"pointer", fontFamily:"inherit", lineHeight:1.6 }}>ℹ</button>
          </div>
        </div>
        {showPartInfo&&<div style={{ marginBottom:12, padding:"8px 10px", background:"rgba(167,139,250,0.06)", border:"1px solid rgba(167,139,250,0.15)", borderRadius:8, fontSize:12, color:"var(--t-text-muted,#8b7fa8)", lineHeight:1.6 }}>Muestra cuántas actividades tiene asignadas cada persona en el período seleccionado y qué porcentaje completó. No mide quién hizo más trabajo, sino cómo están distribuidas las responsabilidades.</div>}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[{name:p1,h:ph1,color:clr.person1},{name:p2,h:ph2,color:clr.person2},{name:"Juntos",h:phT,color:clr.together}].map(({name,h,color})=>{
            const tot=ph1.count+ph2.count+phT.count||1;
            return <div key={name} style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:64, fontSize:12, color, fontWeight:600, flexShrink:0 }}>{name}</div>
              <div style={{ flex:1, background:"rgba(128,128,128,0.10)", borderRadius:99, height:8, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${(h.count/tot)*100}%`, background:color, borderRadius:99, opacity:0.8 }} />
              </div>
              <div style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)", flexShrink:0, width:60, textAlign:"right" }}>
                {h.count} <span style={{ color:color, fontWeight:600 }}>{h.count>0?`(${Math.round((h.done/h.count)*100)}%✓)`:""}</span>
              </div>
            </div>;
          })}
        </div>
      </div>

      {catStats.length>0&&<CatStatsCard catStats={catStats} />}

      {/* Work hours */}
      {(totalWork1>0||totalWork2>0)&&<div style={S.card}>
        <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-accent,#fbbf24)", marginBottom:14, fontWeight:600 }}>💼 Horas de trabajo registradas</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[[p1,totalWork1],[p2,totalWork2]].filter(([,h])=>h>0).map(([name,h])=>{
            const weeksWithHours = allW.filter(w=>w.workHours?.[name===p1?"person1":"person2"]>0).length;
            const avg = weeksWithHours>0 ? (h/weeksWithHours).toFixed(1) : h;
            return (
              <div key={name} style={{ background:"rgba(251,191,36,0.07)", border:"1px solid rgba(251,191,36,0.18)", borderRadius:10, padding:"12px", textAlign:"center" }}>
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:700, color:"#fbbf24" }}>{avg}h</div>
                <div style={{ fontSize:10, color:"var(--t-text-muted,#8b7fa8)", marginTop:1 }}>prom/semana</div>
                <div style={{ fontSize:11, color:"var(--t-text,#f8f4ff)", marginTop:3, fontWeight:600 }}>{name}</div>
              </div>
            );
          })}
        </div>
        {totalWork1>0&&totalWork2>0&&<div style={{ marginTop:10, fontSize:12, color:"var(--t-text-muted,#8b7fa8)", textAlign:"center" }}>
          {Math.abs(totalWork1-totalWork2)<5?"⚖️ Carga laboral muy equilibrada"
            :totalWork1>totalWork2?`⚡ ${p1} trabajó ${(totalWork1-totalWork2).toFixed(1)}h más en total`
            :`⚡ ${p2} trabajó ${(totalWork2-totalWork1).toFixed(1)}h más en total`}
        </div>}
      </div>}

      <WeekDetailList allW={allW} onGoToWeek={onGoToWeek} />

      <button onClick={()=>setExportModal(true)} style={{...S.btnSecondary,width:"100%",textAlign:"center",padding:"11px",display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:4}}>
        🖼 Exportar stats como imagen…
      </button>

      {exportModal && (
        <>
          <div onClick={()=>setExportModal(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:190}}/>
          <div style={{position:"fixed",left:0,right:0,bottom:0,zIndex:200,background:"var(--t-card,#1d1733)",border:"1px solid var(--t-card-border,rgba(167,139,250,0.25))",borderRadius:"18px 18px 0 0",padding:"20px 20px calc(28px + env(safe-area-inset-bottom))"}}>
            <div style={{width:32,height:3,background:"var(--t-card-border,#4a4166)",borderRadius:99,margin:"0 auto 16px"}}/>
            <div style={{fontSize:15,fontWeight:600,color:"var(--t-text,#f8f4ff)",marginBottom:4}}>🖼 Exportar imagen de stats</div>
            <div style={{fontSize:12,color:"var(--t-text-muted,#8b7fa8)",marginBottom:14}}>Elige qué secciones incluir:</div>
            {[["progress","📊 Progreso global (% completado)"],["personas","👥 Desglose por persona"],["categorias","🏷️ Top categorías"],["insights","💡 Análisis automático"]].map(([k,label])=>(
              <label key={k} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid var(--t-card-border,rgba(255,255,255,0.05))",cursor:"pointer"}}>
                <input type="checkbox" checked={!!exportSecs[k]} onChange={e=>setExportSecs(s=>({...s,[k]:e.target.checked}))}
                  style={{width:16,height:16,accentColor:"var(--t-accent,#a78bfa)",cursor:"pointer"}}/>
                <span style={{fontSize:13,color:"var(--t-text,#f0e8ff)"}}>{label}</span>
              </label>
            ))}
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button onClick={()=>setExportModal(false)} style={{...S.btnSecondary,flex:1,padding:"10px"}}>Cancelar</button>
              <button onClick={()=>{
                setExportModal(false);
                const secs=exportSecs;
                const cs=getComputedStyle(document.documentElement);
                const bg=cs.getPropertyValue("--t-bg").trim()||"#0a0714";
                const acc=cs.getPropertyValue("--t-accent").trim()||"#a78bfa";
                const txtColor=cs.getPropertyValue("--t-text").trim()||"#f8f4ff";
                const mutedColor=cs.getPropertyValue("--t-text-muted").trim()||"#8b7fa8";
                const dimColor=cs.getPropertyValue("--t-text-dim").trim()||"#4a4166";
                let H=80;
                if(secs.progress) H+=130;
                if(secs.personas) H+=90;
                if(secs.categorias) H+=70+Math.ceil(catStats.slice(0,6).length/3)*28;
                if(secs.insights) H+=20+insights.slice(0,3).length*52;
                H+=48;
                const W=600, DPR=2;
                const cv=document.createElement("canvas"); cv.width=W*DPR; cv.height=H*DPR;
                const cx=cv.getContext("2d"); cx.scale(DPR,DPR);
                cx.fillStyle=bg; cx.fillRect(0,0,W,H);
                const g1=cx.createRadialGradient(W,0,0,W,0,W*0.65); g1.addColorStop(0,`${acc}33`); g1.addColorStop(1,"transparent"); cx.fillStyle=g1; cx.fillRect(0,0,W,H);
                cx.fillStyle=`${acc}18`; cx.fillRect(0,0,W,56);
                cx.font="600 12px system-ui"; cx.fillStyle=acc; cx.fillText("📅 SHARED CALENDAR · STATS",20,35);
                cx.font="11px system-ui"; cx.fillStyle=dimColor; const fl=filterLabel; cx.fillText(fl,W-cx.measureText(fl).width-20,35);
                let y=72;
                const pctClr=pct>=80?"#34d399":pct>=50?"#fbbf24":"#f472b6";
                if(secs.progress){
                  cx.font="bold 72px 'Fraunces',Georgia,serif"; cx.fillStyle=pctClr; cx.fillText(`${pct}%`,20,y+72);
                  cx.font="600 15px system-ui"; cx.fillStyle=txtColor; cx.fillText(`${done} de ${total} actividades completadas`,20,y+100);
                  cx.fillStyle="rgba(255,255,255,0.08)"; cx.fillRect(20,y+112,W-40,7);
                  cx.fillStyle=pctClr; cx.fillRect(20,y+112,(W-40)*(pct/100),7);
                  y+=130;
                }
                if(secs.personas){
                  cx.strokeStyle=`${acc}30`; cx.lineWidth=1; cx.beginPath(); cx.moveTo(20,y); cx.lineTo(W-20,y); cx.stroke(); y+=16;
                  cx.font="10px system-ui"; cx.fillStyle=mutedColor; cx.fillText("PERSONAS",20,y); y+=16;
                  [[p1,ph1,clr.person1],[p2,ph2,clr.person2],["Juntos",phT,clr.together||"#34d399"]].forEach(([name,ph,color])=>{
                    const p2pct=ph.count>0?Math.round(ph.done/ph.count*100):0; const bw=W-180;
                    cx.font="600 12px system-ui"; cx.fillStyle=color; cx.fillText(name,20,y+12);
                    cx.fillStyle="rgba(255,255,255,0.07)"; cx.fillRect(130,y+4,bw,6);
                    cx.fillStyle=color; cx.fillRect(130,y+4,bw*(p2pct/100),6);
                    cx.font="11px system-ui"; cx.fillStyle=mutedColor; cx.fillText(`${ph.done}/${ph.count} · ${p2pct}%`,W-95,y+12); y+=24;
                  }); y+=10;
                }
                if(secs.categorias && catStats.length){
                  cx.strokeStyle=`${acc}30`; cx.lineWidth=1; cx.beginPath(); cx.moveTo(20,y); cx.lineTo(W-20,y); cx.stroke(); y+=16;
                  cx.font="10px system-ui"; cx.fillStyle=mutedColor; cx.fillText("CATEGORÍAS",20,y); y+=16;
                  const cols=3, colW=(W-40)/cols;
                  catStats.slice(0,6).forEach((c,i)=>{
                    const x=20+(i%cols)*colW, cy=y+Math.floor(i/cols)*28;
                    const cp=c.count>0?Math.round(c.done/c.count*100):0;
                    cx.font="12px system-ui"; cx.fillStyle=c.color; cx.fillText(`${c.icon} ${c.label}: ${cp}%`,x,cy+12);
                  });
                  y+=Math.ceil(catStats.slice(0,6).length/3)*28+10;
                }
                if(secs.insights && insights.length){
                  cx.strokeStyle=`${acc}30`; cx.lineWidth=1; cx.beginPath(); cx.moveTo(20,y); cx.lineTo(W-20,y); cx.stroke(); y+=16;
                  cx.font="10px system-ui"; cx.fillStyle=mutedColor; cx.fillText("ANÁLISIS",20,y); y+=16;
                  insights.slice(0,3).forEach(ins=>{
                    cx.font="600 12px system-ui"; cx.fillStyle=txtColor; cx.fillText(`${ins.icon} ${ins.title}`,20,y+12);
                    cx.font="11px system-ui"; cx.fillStyle=mutedColor;
                    const words=ins.desc.split(" "); let line=""; let ly=y+28;
                    words.forEach(w=>{
                      const test=line+w+" "; if(cx.measureText(test).width>W-40&&line){cx.fillText(line,20,ly);line=w+" ";ly+=16;}else{line=test;}
                    }); if(line) cx.fillText(line,20,ly);
                    y+=52;
                  });
                }
                cx.fillStyle=`${acc}10`; cx.fillRect(0,H-36,W,36);
                cx.font="11px system-ui"; cx.fillStyle=dimColor;
                cx.fillText(`${p1} & ${p2} · Shared Calendar`,20,H-14);
                const ds=new Date().toLocaleDateString("es-ES"); cx.fillText(ds,W-cx.measureText(ds).width-20,H-14);
                cv.toBlob(b=>dlBlob(b,`stats-${p1}-${p2}-${new Date().toISOString().slice(0,10)}.png`),"image/png");
              }} style={{...S.btnPrimary,flex:1,padding:"10px",textAlign:"center"}}>Exportar PNG</button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
