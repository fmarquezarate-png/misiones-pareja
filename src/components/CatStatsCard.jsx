import { useState } from "react";
import { S } from "../styles.js";

export default function CatStatsCard({ catStats }) {
  const [tab, setTab] = useState("act");
  const maxC = Math.max(...catStats.map(x=>x.count),1);
  const lifeStats = catStats.filter(c=>c.id!=="trabajo");
  const workStat = catStats.find(c=>c.id==="trabajo");
  const maxLifeH = Math.max(...lifeStats.map(c=>c.dur),0.1);
  return (
    <div style={S.card}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600 }}>🏷️ Por categoría</span>
        <div style={{ display:"flex", gap:3 }}>
          {[["act","Actividades"],["h","Horas"]].map(([v,l])=>(
            <button key={v} onClick={()=>setTab(v)} style={{ background:tab===v?"rgba(167,139,250,0.2)":"rgba(128,128,128,0.06)", border:`1px solid ${tab===v?"rgba(167,139,250,0.4)":"rgba(255,255,255,0.08)"}`, borderRadius:7, color:tab===v?"#c4b8ff":"#6b5f88", padding:"3px 10px", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
      </div>
      {tab==="act"?catStats.map(c=>{ const cpct=c.count>0?Math.round((c.done/c.count)*100):0; return (
        <div key={c.id} style={{ marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span style={{ fontSize:12, color:c.color, fontWeight:600 }}>{c.icon} {c.label}</span>
            <span style={{ fontSize:12, color:cpct===100?"#34d399":"#6b5f88", fontWeight:600 }}>{c.done}/{c.count} ({cpct}%)</span>
          </div>
          <div style={{ background:"rgba(128,128,128,0.10)", borderRadius:99, height:6, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${(c.count/maxC)*100}%`, background:c.color, borderRadius:99, opacity:0.8 }} />
          </div>
        </div>
      );}):(<>
        {lifeStats.filter(c=>c.dur>0).length>0&&<>
          <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", letterSpacing:1.5, marginBottom:8 }}>VIDA</div>
          {lifeStats.filter(c=>c.dur>0).map(c=>(
            <div key={c.id} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:12, color:c.color, fontWeight:600 }}>{c.icon} {c.label}</span>
                <span style={{ fontSize:12, color:"#60a5fa" }}>{Math.round(c.dur/60*10)/10}h</span>
              </div>
              <div style={{ background:"rgba(128,128,128,0.10)", borderRadius:99, height:6, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${(c.dur/maxLifeH)*100}%`, background:c.color, borderRadius:99, opacity:0.8 }} />
              </div>
            </div>
          ))}
        </>}
        {workStat&&workStat.dur>0&&<>
          <div style={{ borderTop:"1px dashed rgba(251,191,36,0.2)", marginTop:10, paddingTop:10, marginBottom:8 }}>
            <div style={{ fontSize:10, color:"#fbbf2488", letterSpacing:1.5 }}>TRABAJO <span style={{ color:"var(--t-text-dim,#4a4166)", fontWeight:400 }}>(escala propia)</span></div>
          </div>
          <div style={{ marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:12, color:"#fbbf24", fontWeight:600 }}>💼 Trabajo</span>
              <span style={{ fontSize:12, color:"#fbbf24", fontWeight:700 }}>{Math.round(workStat.dur/60*10)/10}h</span>
            </div>
            <div style={{ background:"rgba(251,191,36,0.08)", borderRadius:99, height:8, overflow:"hidden", border:"1px solid rgba(251,191,36,0.15)" }}>
              <div style={{ height:"100%", width:"100%", background:"linear-gradient(90deg,#fbbf24,#f59e0b)", borderRadius:99, opacity:0.8 }} />
            </div>
          </div>
        </>}
        {!catStats.some(c=>c.dur>0)&&<div style={{ textAlign:"center", color:"var(--t-text-dim,#4a4166)", fontSize:12, padding:"20px 0" }}>Sin horas registradas aún.</div>}
      </>)}
    </div>
  );
}
