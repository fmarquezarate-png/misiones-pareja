import { useState, useMemo } from "react";
import { filterMoods, aggregateMoods, summarizePoints } from "../lib/moodAnalysis.js";
import MoodTimelineChart from "./MoodTimelineChart.jsx";

const PERIODS = [["7d","Semana"],["30d","Mes"],["365d","Año"],["all","Todo"]];

// Imprime solo el contenido del reporte — el resto de la página (overlay,
// controles, app de fondo) se oculta. "Guardar como PDF" en el diálogo de
// impresión del navegador produce un PDF con texto nítido, sin libs nuevas.
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .mp-report-root, .mp-report-root * { visibility: visible !important; }
  .mp-report-root { position: absolute !important; inset: 0 !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; border: none !important; background: #fff !important; }
  .mp-report-noprint { display: none !important; }
  @page { margin: 14mm; size: A4; }
}
`;

export default function MoodReport({ moods, p1, p2, colors, initialPeriod = "30d", initialWho = "all", onClose }) {
  const [period, setPeriod] = useState(initialPeriod);
  const [who,    setWho]    = useState(initialWho);

  const filtered = useMemo(() => filterMoods(moods, period, who), [moods, period, who]);
  const stats = useMemo(() => summarizePoints(aggregateMoods(filtered).points), [filtered]);

  const avgScore = filtered.length ? filtered.reduce((s, m) => s + m.valence * m.intensity, 0) / filtered.length : null;
  const posCount = filtered.filter(m => m.valence > 0).length;
  const negCount = filtered.filter(m => m.valence < 0).length;

  const periodLabel = PERIODS.find(([k]) => k === period)?.[1] || period;
  const whoLabel = who === "all" ? "Ambos" : who === "person1" ? p1 : p2;
  const today = new Date();
  const generatedStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", zIndex:2100, display:"flex", alignItems:"center", justifyContent:"center", padding:16, overflowY:"auto" }}>
      <style>{PRINT_CSS}</style>
      <div onClick={e => e.stopPropagation()} className="mp-report-root"
        style={{ background:"#15101f", border:"1px solid rgba(167,139,250,0.22)", borderRadius:22, padding:"22px", width:"100%", maxWidth:560, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,0.6)" }}>

        <div className="mp-report-noprint" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:18, fontWeight:700, color:"#f8f4ff" }}>📄 Reporte de Ánimo</div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.06)", border:"none", borderRadius:8, color:"#8b7fa8", fontSize:18, cursor:"pointer", lineHeight:1, padding:"4px 8px" }}>×</button>
        </div>

        <div className="mp-report-noprint" style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:8 }}>
          {PERIODS.map(([k, l]) => (
            <button key={k} onClick={() => setPeriod(k)}
              style={{ background: period===k?"rgba(167,139,250,0.18)":"rgba(128,128,128,0.07)", border:`1px solid ${period===k?"rgba(167,139,250,0.4)":"rgba(255,255,255,0.07)"}`, borderRadius:99, color: period===k?"#c4b8ff":"#6b5f88", padding:"4px 12px", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight: period===k?600:400 }}>
              {l}
            </button>
          ))}
        </div>
        <div className="mp-report-noprint" style={{ display:"flex", gap:7, marginBottom:18 }}>
          {[["all","Ambos",null],["person1",p1,colors.person1],["person2",p2,colors.person2]].map(([k, l, c]) => {
            const active = who === k;
            return (
              <button key={k} onClick={() => setWho(k)}
                style={{ background: active ? (c?`${c}22`:"rgba(167,139,250,0.18)") : "rgba(128,128,128,0.07)", border:`1px solid ${active?(c||"rgba(167,139,250,0.4)"):"rgba(255,255,255,0.07)"}`, borderRadius:99, color: active?(c||"#c4b8ff"):"#6b5f88", padding:"4px 12px", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:active?600:400 }}>
                {l}
              </button>
            );
          })}
        </div>

        {/* Contenido imprimible */}
        <div style={{ background:"#fff", borderRadius:14, padding:"22px 18px", color:"#1a1530" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4, gap:10 }}>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:21, fontWeight:700 }}>🧠 Reporte de Ánimo</div>
            <div style={{ fontSize:11, color:"#6b6480", whiteSpace:"nowrap" }}>Generado el {generatedStr}</div>
          </div>
          <div style={{ fontSize:12, color:"#6b6480", marginBottom:18 }}>
            Período: {periodLabel} · Persona: {whoLabel} · {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:"32px 0", color:"#9a93b0" }}>Sin registros en este período</div>
          ) : (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:16 }}>
                {[
                  { label:"Promedio", value: avgScore !== null ? avgScore.toFixed(1) : "—", color: avgScore >= 0 ? "#0f9d6e" : "#d23556" },
                  { label:"Positivos", value: posCount, color:"#0f9d6e" },
                  { label:"Negativos", value: negCount, color:"#d23556" },
                ].map(s => (
                  <div key={s.label} style={{ background:"#f3f1f8", borderRadius:12, padding:"10px 8px", textAlign:"center" }}>
                    <div style={{ fontSize:19, fontFamily:"'Fraunces',serif", fontWeight:700, color:s.color }}>
                      {typeof s.value === "string" && Number(s.value) > 0 && s.label === "Promedio" ? `+${s.value}` : s.value}
                    </div>
                    <div style={{ fontSize:9, color:"#6b6480", marginTop:3, textTransform:"uppercase", letterSpacing:0.5 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize:11.5, color:"#4a4166", marginBottom:14, lineHeight:1.7 }}>
                <div><strong>Variabilidad:</strong> {stats.label} (desviación {stats.std.toFixed(1)} pts)</div>
                <div><strong>Mayor cambio entre períodos consecutivos:</strong> {stats.biggestChange > 0 ? "+" : ""}{stats.biggestChange.toFixed(1)} pts</div>
              </div>

              <div style={{ border:"1px solid #e5e1f0", borderRadius:12, padding:"10px 6px 4px", marginBottom:14, background:"#fafaff" }}>
                <MoodTimelineChart moods={filtered} light />
              </div>

              <div style={{ fontSize:9.5, color:"#9a93b0", lineHeight:1.6 }}>
                Cada punto representa el promedio de ánimo (valencia × intensidad, escala −10 a +10) del período correspondiente.
                La banda sombreada indica la variabilidad local; los círculos punteados marcan cambios bruscos o días que se desvían de la tendencia.
                Datos auto-reportados en la app Misiones de Pareja — no constituyen un diagnóstico clínico.
              </div>
            </>
          )}
        </div>

        <div className="mp-report-noprint" style={{ display:"flex", gap:10, marginTop:18 }}>
          <button onClick={() => window.print()}
            style={{ flex:1, background:"var(--t-btn-grad,linear-gradient(135deg,#f472b6,#a78bfa))", border:"none", borderRadius:12, color:"#fff", padding:"11px", cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:700 }}>
            🖨️ Imprimir / Guardar como PDF
          </button>
          <button onClick={onClose}
            style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:12, color:"#8b7fa8", padding:"11px 18px", cursor:"pointer", fontFamily:"inherit", fontSize:14 }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
