import { useState } from "react";
import { getWeekAndYear, isoWeekKey } from "../utils.js";
import { S } from "../styles.js";
import { getMCats } from "../constants.js";

export default function HistoryView({ weeks, wkey, globalPersonFilter, globalCatFilter, update, setActiveTab, setLightboxSrc, compressImage, downloadWeekICS, p1, p2 }) {
  const [histWeekRange, setHistWeekRange] = useState("all");

  const { week: _htw, year: _hty } = getWeekAndYear();
  const _htodayKey = isoWeekKey(_htw, _hty);
  const allHistSorted = Object.entries(weeks).filter(([key]) => key <= _htodayKey).sort((a,b) => b[0].localeCompare(a[0]));
  const histFiltered = histWeekRange === "all" ? allHistSorted : allHistSorted.slice(0, parseInt(histWeekRange));
  const filterHM = ms => ms.filter(m => (!globalPersonFilter.length || globalPersonFilter.includes(m.who)) && (!globalCatFilter.length || getMCats(m).some(c => globalCatFilter.includes(c))));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {/* Filter bar */}
      <div style={{ ...S.card, padding:"10px 14px" }}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <div>
            <div style={S.label}>Semanas</div>
            <div style={{ display:"flex", gap:3 }}>
              {[["all","Todas"],["1","Esta sem."],["4","4 últ."],["8","8 últ."]].map(([v,l]) => (
                <button key={v} onClick={() => setHistWeekRange(v)} style={{ background:histWeekRange===v?"var(--t-accent-soft,rgba(167,139,250,0.2))":"rgba(128,128,128,0.06)", border:`1px solid ${histWeekRange===v?"var(--t-accent,rgba(167,139,250,0.4))":"var(--t-card-border,rgba(255,255,255,0.08))"}`, borderRadius:7, color:histWeekRange===v?"var(--t-accent,#a78bfa)":"var(--t-text-dim,#6b5f88)", padding:"4px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Week cards */}
      {histFiltered.map(([key,w]) => {
        const filtMs = filterHM(w.missions||[]);
        const d = filtMs.filter(m => m.status==="DONE").length, t = filtMs.length, p = t>0?Math.round((d/t)*100):0, cur = key===wkey;
        return (
          <div key={key} style={{ ...S.card, borderColor:cur?"var(--t-accent,rgba(167,139,250,0.45))":"var(--t-card-border,rgba(167,139,250,0.1))", background:cur?"var(--t-accent-soft,rgba(167,139,250,0.12))":"var(--t-card,#1d1733)", padding:"12px 14px" }}>
            <div onClick={() => { const yr=parseInt(key.split("-W")[0])||w.year; update(s => ({...s,currentWeekNumber:w.weekNumber,currentYear:yr})); setActiveTab("current"); }} style={{ cursor:"pointer", marginBottom:w.epicObjective?5:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontFamily:"'Fraunces',serif", fontWeight:600, fontSize:18, display:"flex", alignItems:"center", gap:7 }}>
                  Semana {w.weekNumber}
                  {cur && <span style={{ fontSize:10, color:"var(--t-accent,#a78bfa)", background:"var(--t-accent-soft,rgba(167,139,250,0.15))", padding:"2px 7px", borderRadius:99, fontFamily:"inherit", fontWeight:600 }}>ACTUAL</span>}
                </div>
                <div style={{ fontSize:13, color:p===100?"#34d399":"var(--t-text-muted,#8b7fa8)", fontWeight:600 }}>{p===100?"🏆":""} {d}/{t}</div>
              </div>
              {w.epicObjective && <div style={{ fontSize:12, color:"var(--t-text-dim,#6b5f88)", marginTop:3, fontStyle:"italic", fontFamily:"'Fraunces',serif", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>"{w.epicObjective}"</div>}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }} onClick={e => e.stopPropagation()}>
              <div style={{ flex:1 }}>
                <div style={{ background:"rgba(128,128,128,0.10)", borderRadius:99, height:5, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${p}%`, borderRadius:99, background:p===100?"linear-gradient(90deg,#34d399,#60a5fa)":"linear-gradient(90deg,#f472b6,#a78bfa)", transition:"width 0.5s" }} />
                </div>
                <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", marginTop:3 }}>{p}%{globalPersonFilter.length?` (${globalPersonFilter.map(f=>f==="person1"?p1:f==="person2"?p2:"Juntos").join("+")})`:""}</div>
              </div>
              {w.photo
                ? <div style={{ position:"relative", flexShrink:0 }}>
                    <img src={w.photo} onClick={() => setLightboxSrc(w.photo)} style={{ width:44, height:44, borderRadius:8, objectFit:"cover", display:"block", border:"1px solid rgba(167,139,250,0.25)", cursor:"zoom-in" }} alt="foto" title="Ver foto completa" />
                    <button onClick={() => update(d => ({...d,weeks:{...d.weeks,[key]:{...d.weeks[key],photo:null}}}))}
                      style={{ position:"absolute", top:-5, right:-5, background:"var(--t-card,#1d1733)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.3))", borderRadius:99, color:"var(--t-text-muted,#8b7fa8)", fontSize:9, width:16, height:16, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>✕</button>
                  </div>
                : <div style={{ flexShrink:0, display:"flex", gap:4 }}>
                    <label style={{ width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(128,128,128,0.05)", border:"1px dashed rgba(167,139,250,0.18)", borderRadius:8, cursor:"pointer", fontSize:14 }} title="Tomar foto">
                      📷
                      <input type="file" accept="image/*" capture="environment" style={{ display:"none" }}
                        onChange={async e => { const f=e.target.files[0]; if(!f)return; const b64=await compressImage(f); update(d=>({...d,weeks:{...d.weeks,[key]:{...d.weeks[key],photo:b64}}})); e.target.value=""; }} />
                    </label>
                    <label style={{ width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(128,128,128,0.05)", border:"1px dashed rgba(167,139,250,0.18)", borderRadius:8, cursor:"pointer", fontSize:14 }} title="Elegir de galería">
                      🖼️
                      <input type="file" accept="image/*" style={{ display:"none" }}
                        onChange={async e => { const f=e.target.files[0]; if(!f)return; const b64=await compressImage(f); update(d=>({...d,weeks:{...d.weeks,[key]:{...d.weeks[key],photo:b64}}})); e.target.value=""; }} />
                    </label>
                  </div>
              }
            </div>
            {(w.missions||[]).some(m => m.date) && (
              <div style={{ marginTop:8 }}>
                <button onClick={() => downloadWeekICS(w, key, p1, p2)} style={{ ...S.btnSecondary, fontSize:11, padding:"4px 10px", borderColor:"rgba(52,211,153,0.25)", color:"#34d399", width:"100%" }}>📅 Importar semana {w.weekNumber} a Google Calendar (.ics)</button>
              </div>
            )}
            {w.photo && (
              <div style={{ marginTop:8, position:"relative", cursor:"zoom-in" }} onClick={() => setLightboxSrc(w.photo)}>
                <img src={w.photo} style={{ width:"100%", borderRadius:10, maxHeight:130, objectFit:"cover", display:"block" }} alt="foto semana" />
                <div style={{ position:"absolute", inset:0, borderRadius:10, background:"rgba(0,0,0,0)", display:"flex", alignItems:"flex-end", justifyContent:"flex-end", padding:6 }}>
                  <span style={{ background:"rgba(0,0,0,0.45)", borderRadius:6, fontSize:10, color:"#f8f4ff", padding:"2px 7px", backdropFilter:"blur(4px)" }}>🔍 Ver completa</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
