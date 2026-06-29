import { useState, useEffect } from "react";
import { EMOTIONS } from "../constants.js";
import { localDateStr } from "../utils.js";

const ANIM_CSS = `
@keyframes mood-slide-up {
  from { opacity:0; transform:translateY(28px) scale(0.97); }
  to   { opacity:1; transform:translateY(0)    scale(1);    }
}
@keyframes mood-step-in {
  from { opacity:0; transform:translateX(12px); }
  to   { opacity:1; transform:translateX(0);    }
}
@keyframes mood-pulse-ring {
  0%   { box-shadow: 0 0 0 0px var(--ring-clr); }
  70%  { box-shadow: 0 0 0 8px transparent; }
  100% { box-shadow: 0 0 0 0px transparent; }
}
`;

// 4-step popup: 0=who, 1=emotion, 2=intensity, 3=note+submit
export default function MoodSurvey({ p1, p2, colors, prefillWho = null, onSave, onClose }) {
  const [phase,     setPhase]     = useState(0); // 0=entering, 1=visible
  const [step,      setStep]      = useState(prefillWho ? 1 : 0);
  const [who,       setWho]       = useState(prefillWho || null);
  const [emotion,   setEmotion]   = useState(null);
  const [intensity, setIntensity] = useState(5);
  const [note,      setNote]      = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => { const t = setTimeout(() => setPhase(1), 30); return () => clearTimeout(t); }, []);

  const selectedEmotion = EMOTIONS.find(e => e.id === emotion);
  const whoColor  = who === "person1" ? colors.person1 : colors.person2;
  const whoLabel  = who === "person1" ? p1 : p2;
  const accentClr = selectedEmotion?.color ?? (selectedEmotion?.valence > 0 ? "#34d399" : "#f43f5e");

  const handleSubmit = () => {
    if (!who || !emotion || !selectedEmotion || submitted) return;
    setSubmitted(true);
    onSave({ who, emotion, valence: selectedEmotion.valence, intensity, note: note.trim(), date: localDateStr(), ts: Date.now() });
  };

  const totalSteps  = prefillWho ? 3 : 4;
  const stepDisplay = prefillWho ? step : step + 1;
  const barSteps    = prefillWho ? [1,2,3] : [0,1,2,3];

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <style>{ANIM_CSS}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:"var(--t-card,#1d1733)",
          border:"1px solid rgba(167,139,250,0.22)",
          borderRadius:22,
          padding:24,
          width:"100%", maxWidth:390, maxHeight:"90vh", overflowY:"auto",
          animation: phase === 0 ? "none" : "mood-slide-up 0.34s cubic-bezier(0.16,1,0.3,1) both",
          boxShadow:"0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(167,139,250,0.1)",
        }}
      >
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
          <div>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, color:"var(--t-text,#f8f4ff)", display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:24 }}>🧠</span> ¿Cómo estás?
            </div>
            <div style={{ fontSize:12, color: who ? whoColor : "var(--t-text-muted,#8b7fa8)", marginTop:3, transition:"color 0.2s" }}>
              {who ? `${whoLabel} · Paso ${stepDisplay} de ${totalSteps}` : "Registro de ánimo diario"}
            </div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.06)", border:"none", borderRadius:8, color:"var(--t-text-muted,#8b7fa8)", fontSize:18, cursor:"pointer", lineHeight:1, padding:"4px 8px" }}>×</button>
        </div>

        {/* Progress bar */}
        <div style={{ display:"flex", gap:4, marginBottom:22 }}>
          {barSteps.map(i => (
            <div key={i} style={{
              height:3, borderRadius:99, flex: i === step ? 2.5 : 1,
              background: i < step ? accentClr : i === step ? accentClr : "rgba(255,255,255,0.08)",
              opacity: i < step ? 0.5 : 1,
              transition:"all 0.3s cubic-bezier(0.16,1,0.3,1)",
            }} />
          ))}
        </div>

        {/* ── STEP 0: Who ── */}
        {step === 0 && (
          <div style={{ animation:"mood-step-in 0.25s ease both" }}>
            <div style={{ fontSize:13, color:"var(--t-text-muted,#8b7fa8)", textAlign:"center", marginBottom:18 }}>¿Quién está rellenando esto?</div>
            <div style={{ display:"flex", gap:12 }}>
              {[["person1", p1, colors.person1], ["person2", p2, colors.person2]].map(([id, name, color]) => (
                <button key={id} onClick={() => { setWho(id); setStep(1); }}
                  style={{ flex:1, padding:"20px 12px", borderRadius:18, border:`2px solid ${color}30`, background:`${color}0e`, color, cursor:"pointer", fontFamily:"inherit", fontSize:15, fontWeight:700, transition:"all 0.2s cubic-bezier(0.16,1,0.3,1)", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}
                  onMouseEnter={e => { e.currentTarget.style.border=`2px solid ${color}90`; e.currentTarget.style.background=`${color}20`; e.currentTarget.style.transform="scale(1.03)"; }}
                  onMouseLeave={e => { e.currentTarget.style.border=`2px solid ${color}30`; e.currentTarget.style.background=`${color}0e`; e.currentTarget.style.transform="scale(1)"; }}>
                  <span style={{ fontSize:36, width:52, height:52, borderRadius:"50%", background:`${color}20`, display:"flex", alignItems:"center", justifyContent:"center" }}>🧑</span>
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 1: Emotion ── */}
        {step === 1 && (
          <div style={{ animation:"mood-step-in 0.25s ease both" }}>
            <div style={{ fontSize:13, color:"var(--t-text-muted,#8b7fa8)", textAlign:"center", marginBottom:14 }}>¿Cómo te sientes ahora mismo?</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:6 }}>
              {EMOTIONS.map(e => {
                const sel = emotion === e.id;
                return (
                  <button key={e.id} onClick={() => setEmotion(e.id)}
                    style={{
                      padding:"10px 4px 8px", borderRadius:14,
                      border:`2px solid ${sel ? e.color : "rgba(255,255,255,0.07)"}`,
                      background: sel ? `${e.color}20` : "rgba(255,255,255,0.03)",
                      cursor:"pointer", fontFamily:"inherit", transition:"all 0.18s",
                      display:"flex", flexDirection:"column", alignItems:"center", gap:4,
                      "--ring-clr": e.color,
                      animation: sel ? "mood-pulse-ring 0.5s ease" : "none",
                    }}>
                    <span style={{ fontSize:24 }}>{e.emoji}</span>
                    <span style={{ fontSize:9, color: sel ? e.color : "var(--t-text-muted,#8b7fa8)", lineHeight:1.2, textAlign:"center", fontWeight: sel ? 700 : 400 }}>{e.label}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16 }}>
              <button onClick={() => setStep(2)} disabled={!emotion}
                style={{ background: emotion ? `linear-gradient(135deg,${selectedEmotion?.color ?? "#a78bfa"},${selectedEmotion?.color ?? "#f472b6"}88)` : "rgba(255,255,255,0.08)", border:"none", borderRadius:12, color: emotion ? "#fff" : "rgba(255,255,255,0.3)", padding:"10px 28px", cursor: emotion ? "pointer" : "not-allowed", fontFamily:"inherit", fontSize:14, fontWeight:600, transition:"all 0.2s", boxShadow: emotion ? `0 4px 16px ${selectedEmotion?.color ?? "#a78bfa"}44` : "none" }}>
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Intensity ── */}
        {step === 2 && selectedEmotion && (
          <div style={{ animation:"mood-step-in 0.25s ease both" }}>
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <div style={{ fontSize:52, marginBottom:8, filter:`drop-shadow(0 0 16px ${accentClr}66)` }}>{selectedEmotion.emoji}</div>
              <div style={{ fontSize:17, fontWeight:700, color: accentClr, marginBottom:4 }}>{selectedEmotion.label}</div>
              <div style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)" }}>¿Con qué intensidad lo sientes?</div>
            </div>
            <div style={{ textAlign:"center", fontSize:56, fontFamily:"'Fraunces',serif", fontWeight:700, color: accentClr, marginBottom:8, lineHeight:1, textShadow:`0 0 32px ${accentClr}55`, transition:"all 0.15s" }}>{intensity}</div>
            {/* Gradient track visual */}
            <div style={{ position:"relative", marginBottom:6 }}>
              <div style={{ height:6, borderRadius:99, background:`linear-gradient(90deg, ${accentClr}22, ${accentClr})`, marginBottom:8, position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${(intensity-1)/9*100}%`, background:accentClr, borderRadius:99, transition:"width 0.15s" }} />
              </div>
              <input type="range" min="1" max="10" value={intensity} onChange={e => setIntensity(Number(e.target.value))}
                style={{ position:"absolute", top:0, left:0, width:"100%", opacity:0, height:22, cursor:"pointer", margin:0 }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--t-text-dim,#4a4166)", marginBottom:22 }}>
              <span>1 · Muy leve</span><span>10 · Muy intenso</span>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setStep(1)} style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, color:"var(--t-text-muted,#8b7fa8)", padding:"10px", cursor:"pointer", fontFamily:"inherit", fontSize:14 }}>← Atrás</button>
              <button onClick={() => setStep(3)} style={{ flex:2, background:`linear-gradient(135deg,${accentClr},${accentClr}aa)`, border:"none", borderRadius:12, color:"#fff", padding:"10px 24px", cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:600, boxShadow:`0 4px 16px ${accentClr}44` }}>Siguiente →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Note + Submit ── */}
        {step === 3 && selectedEmotion && (
          <div style={{ animation:"mood-step-in 0.25s ease both" }}>
            <div style={{ textAlign:"center", marginBottom:16 }}>
              <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:`${accentClr}14`, borderRadius:99, padding:"8px 16px", border:`1px solid ${accentClr}30` }}>
                <span style={{ fontSize:24 }}>{selectedEmotion.emoji}</span>
                <span style={{ fontWeight:700, color: accentClr }}>{selectedEmotion.label}</span>
                <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>·</span>
                <span style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:700, color: accentClr }}>×{intensity}</span>
              </div>
              <div style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)", marginTop:12 }}>¿Quieres añadir una nota? <span style={{ opacity:0.5 }}>(opcional)</span></div>
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="¿Por qué te sientes así? ¿Qué ha pasado hoy?"
              maxLength={500} rows={4}
              style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${accentClr}30`, borderRadius:12, color:"var(--t-text,#f8f4ff)", fontSize:14, padding:"12px", fontFamily:"inherit", resize:"vertical", outline:"none", boxSizing:"border-box", marginBottom:4, transition:"border-color 0.2s" }}
              onFocus={e => e.target.style.borderColor = accentClr}
              onBlur={e => e.target.style.borderColor = `${accentClr}30`}
            />
            <div style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)", textAlign:"right", marginBottom:16 }}>{note.length}/500</div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setStep(2)} style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, color:"var(--t-text-muted,#8b7fa8)", padding:"10px", cursor:"pointer", fontFamily:"inherit", fontSize:14 }}>← Atrás</button>
              <button onClick={handleSubmit} disabled={submitted} style={{ flex:2, background:`linear-gradient(135deg,${accentClr},${accentClr}bb)`, border:"none", borderRadius:12, color:"#fff", padding:"12px 24px", cursor:submitted?"default":"pointer", fontFamily:"inherit", fontSize:15, fontWeight:700, boxShadow:`0 6px 20px ${accentClr}44`, opacity:submitted?0.6:1 }}>{submitted ? "Guardando…" : "✓ Guardar"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
