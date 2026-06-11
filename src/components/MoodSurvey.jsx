import { useState } from "react";
import { EMOTIONS } from "../constants.js";

// 4-step popup: 0=who, 1=emotion, 2=intensity, 3=note+submit
export default function MoodSurvey({ p1, p2, colors, prefillWho = null, onSave, onClose }) {
  const [step, setStep]           = useState(prefillWho ? 1 : 0);
  const [who, setWho]             = useState(prefillWho || null);
  const [emotion, setEmotion]     = useState(null);
  const [intensity, setIntensity] = useState(5);
  const [note, setNote]           = useState("");

  const selectedEmotion = EMOTIONS.find(e => e.id === emotion);
  const whoColor  = who === "person1" ? colors.person1 : colors.person2;
  const whoLabel  = who === "person1" ? p1 : p2;
  const isPositive = selectedEmotion?.valence > 0;
  const accentClr  = isPositive ? "#34d399" : "#f43f5e";

  const handleSubmit = () => {
    if (!who || !emotion) return;
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    onSave({ who, emotion, valence: selectedEmotion.valence, intensity, note: note.trim(), date: dateStr, ts: Date.now() });
  };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.78)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:"var(--t-card,#1d1733)", border:"1px solid rgba(167,139,250,0.22)", borderRadius:20, padding:24, width:"100%", maxWidth:380, maxHeight:"90vh", overflowY:"auto" }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
          <div>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, color:"var(--t-text,#f8f4ff)" }}>🧠 ¿Cómo estás?</div>
            <div style={{ fontSize:12, color: who ? whoColor : "var(--t-text-muted,#8b7fa8)", marginTop:3 }}>
              {who ? `${whoLabel} · Paso ${step + 1} de 4` : "Registro de ánimo diario"}
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--t-text-muted,#8b7fa8)", fontSize:22, cursor:"pointer", lineHeight:1, padding:0 }}>×</button>
        </div>

        {/* Progress bar */}
        <div style={{ display:"flex", gap:5, marginBottom:20 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ height:4, borderRadius:99, flex: i === step ? 2 : 1, background: i <= step ? "var(--t-accent,#a78bfa)" : "rgba(255,255,255,0.08)", transition:"all 0.2s" }} />
          ))}
        </div>

        {/* ── STEP 0: Who ── */}
        {step === 0 && (
          <div>
            <div style={{ fontSize:14, color:"var(--t-text-muted,#8b7fa8)", textAlign:"center", marginBottom:16 }}>¿Quién está rellenando esto?</div>
            <div style={{ display:"flex", gap:12 }}>
              {[["person1", p1, colors.person1], ["person2", p2, colors.person2]].map(([id, name, color]) => (
                <button key={id} onClick={() => { setWho(id); setStep(1); }}
                  style={{ flex:1, padding:"18px 12px", borderRadius:16, border:`2px solid ${color}40`, background:`${color}12`, color, cursor:"pointer", fontFamily:"inherit", fontSize:15, fontWeight:600, transition:"all 0.18s", display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}
                  onMouseEnter={e => { e.currentTarget.style.border=`2px solid ${color}`; e.currentTarget.style.background=`${color}22`; }}
                  onMouseLeave={e => { e.currentTarget.style.border=`2px solid ${color}40`; e.currentTarget.style.background=`${color}12`; }}>
                  <span style={{ fontSize:32 }}>🧑</span>
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 1: Emotion ── */}
        {step === 1 && (
          <div>
            <div style={{ fontSize:13, color:"var(--t-text-muted,#8b7fa8)", textAlign:"center", marginBottom:14 }}>¿Cómo te sientes ahora mismo?</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:7 }}>
              {EMOTIONS.map(e => {
                const sel = emotion === e.id;
                const clr = e.valence > 0 ? "#34d399" : "#f43f5e";
                return (
                  <button key={e.id} onClick={() => setEmotion(e.id)}
                    style={{ padding:"10px 4px", borderRadius:12, border:`2px solid ${sel ? clr : "rgba(255,255,255,0.07)"}`, background: sel ? `${clr}18` : "rgba(255,255,255,0.03)", cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s", display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                    <span style={{ fontSize:22 }}>{e.emoji}</span>
                    <span style={{ fontSize:9.5, color: sel ? clr : "var(--t-text-muted,#8b7fa8)", lineHeight:1.2, textAlign:"center" }}>{e.label}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16 }}>
              <button onClick={() => setStep(2)} disabled={!emotion}
                style={{ background: emotion ? "var(--t-btn-grad,linear-gradient(135deg,#f472b6,#a78bfa))" : "rgba(255,255,255,0.08)", border:"none", borderRadius:12, color: emotion ? "#fff" : "rgba(255,255,255,0.3)", padding:"10px 24px", cursor: emotion ? "pointer" : "not-allowed", fontFamily:"inherit", fontSize:14, fontWeight:600 }}>
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Intensity ── */}
        {step === 2 && selectedEmotion && (
          <div>
            <div style={{ textAlign:"center", marginBottom:16 }}>
              <span style={{ fontSize:44 }}>{selectedEmotion.emoji}</span>
              <div style={{ fontSize:16, fontWeight:700, color: accentClr, marginTop:6 }}>{selectedEmotion.label}</div>
              <div style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)", marginTop:4 }}>¿Con qué intensidad lo sientes?</div>
            </div>
            <div style={{ textAlign:"center", fontSize:48, fontFamily:"'Fraunces',serif", fontWeight:700, color: accentClr, marginBottom:10, lineHeight:1 }}>{intensity}</div>
            <input type="range" min="1" max="10" value={intensity} onChange={e => setIntensity(Number(e.target.value))}
              style={{ width:"100%", accentColor: accentClr, cursor:"pointer", marginBottom:6 }} />
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--t-text-dim,#4a4166)", marginBottom:22 }}>
              <span>1 · Muy leve</span>
              <span>10 · Muy intenso</span>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setStep(1)} style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, color:"var(--t-text-muted,#8b7fa8)", padding:"10px", cursor:"pointer", fontFamily:"inherit", fontSize:14 }}>← Atrás</button>
              <button onClick={() => setStep(3)} style={{ flex:2, background:"var(--t-btn-grad,linear-gradient(135deg,#f472b6,#a78bfa))", border:"none", borderRadius:12, color:"#fff", padding:"10px 24px", cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:600 }}>Siguiente →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Note + Submit ── */}
        {step === 3 && selectedEmotion && (
          <div>
            <div style={{ textAlign:"center", marginBottom:14 }}>
              <span style={{ fontSize:32 }}>{selectedEmotion.emoji}</span>
              <span style={{ fontSize:20, marginLeft:6, color: accentClr, fontWeight:700 }}>×{intensity}</span>
              <div style={{ fontSize:13, color:"var(--t-text-muted,#8b7fa8)", marginTop:6 }}>¿Quieres añadir una nota? <span style={{ opacity:0.6 }}>(opcional)</span></div>
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="¿Por qué te sientes así? ¿Qué ha pasado hoy?"
              maxLength={500} rows={4}
              style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(167,139,250,0.2)", borderRadius:12, color:"var(--t-text,#f8f4ff)", fontSize:14, padding:"12px", fontFamily:"inherit", resize:"vertical", outline:"none", boxSizing:"border-box", marginBottom:4 }} />
            <div style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)", textAlign:"right", marginBottom:16 }}>{note.length}/500</div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setStep(2)} style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, color:"var(--t-text-muted,#8b7fa8)", padding:"10px", cursor:"pointer", fontFamily:"inherit", fontSize:14 }}>← Atrás</button>
              <button onClick={handleSubmit} style={{ flex:2, background:"linear-gradient(135deg,#34d399,#059669)", border:"none", borderRadius:12, color:"#fff", padding:"12px 24px", cursor:"pointer", fontFamily:"inherit", fontSize:15, fontWeight:700 }}>✓ Guardar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
