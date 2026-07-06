import { useState, useEffect } from "react";

// Overlay de apertura — mismo espíritu que SpecialDayOverlay (fade + partículas)
// pero con los colores de la pareja en vez de dorado, para no confundirse con
// el tema de cumpleaños/aniversario, y mostrando el contenido real: mensaje y foto.
export default function TimeCapsuleReveal({ capsule, p1, p2, colors, onClose }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const ts = [setTimeout(() => setPhase(1), 40), setTimeout(() => setPhase(2), 500)];
    return () => ts.forEach(clearTimeout);
  }, []);

  const personName = who => who === "person1" ? p1 : who === "person2" ? p2 : "Los dos";
  const accent = capsule.from === "person1" ? colors.person1 : capsule.from === "person2" ? colors.person2 : colors.together;

  const dismiss = () => { setPhase(0); setTimeout(onClose, 350); };

  return (
    <div onClick={dismiss} style={{
      position:"fixed", inset:0, zIndex:2100, background:"#050310",
      display:"flex", alignItems:"center", justifyContent:"center", padding:20,
      opacity:phase===0?0:1, transition:"opacity 0.35s ease", overflowY:"auto",
    }}>
      <style>{`
        @keyframes tcr-in { from{opacity:0;transform:translateY(20px) scale(0.95);} to{opacity:1;transform:translateY(0) scale(1);} }
        @keyframes tcr-glow { 0%,100%{box-shadow:0 0 40px ${accent}33, 0 0 80px ${accent}1a;} 50%{box-shadow:0 0 60px ${accent}55, 0 0 120px ${accent}22;} }
      `}</style>
      <div onClick={e => e.stopPropagation()} style={{
        maxWidth:420, width:"100%", background:"var(--t-card,#1d1733)", border:`1px solid ${accent}44`,
        borderRadius:22, padding:28, textAlign:"center",
        animation: phase>=1 ? "tcr-in 0.5s cubic-bezier(0.22,1,0.36,1) both, tcr-glow 3s ease-in-out infinite" : "none",
      }}>
        <div style={{ fontSize:44, marginBottom:14 }}>{phase>=2 ? "💌" : "🎁"}</div>
        {phase >= 2 && (
          <div style={{ animation:"tcr-in 0.4s ease both" }}>
            {capsule.title && (
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:700, color:accent, marginBottom:6 }}>{capsule.title}</div>
            )}
            <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:18 }}>
              Escrita por <strong style={{ color:accent }}>{personName(capsule.from)}</strong> · sellada el {new Date(capsule.createdAt).toISOString().slice(0,10)}
            </div>
            {capsule.photo && (
              <img src={capsule.photo} alt="" style={{ width:"100%", maxHeight:260, objectFit:"cover", borderRadius:14, marginBottom:18, border:`1px solid ${accent}30` }} />
            )}
            <div style={{ fontSize:15, color:"var(--t-text,#f0e8ff)", lineHeight:1.7, whiteSpace:"pre-wrap", textAlign:"left", marginBottom:22 }}>
              {capsule.message}
            </div>
            <button onClick={dismiss} style={{ background:`linear-gradient(135deg,${accent},${accent}bb)`, border:"none", borderRadius:12, color:"#fff", padding:"11px 28px", cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:700 }}>
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
