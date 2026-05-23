const TUTORIAL_STEPS = [
  { id:"welcome",      icon:"💞", title:"¡Bienvenido/a a Shared Calendar!", desc:"Tu espacio para planear la vida juntos. Te mostramos cada sección en 2 minutos — después podrás volver al tutorial desde ⚙️.", tab:null },
  { id:"home-rings",   icon:"📊", title:"Scorecards de pareja", desc:"Tu foto y el porcentaje de tareas completadas en las últimas 2 semanas. Toca el anillo para ver el desglose.", tab:"home" },
  { id:"home-events",  icon:"🗒️", title:"Tira de días y actividades", desc:"Las actividades de la semana ordenadas por día. Toca cualquier tarjeta para editar o cambiar su estado rápidamente.", tab:"home" },
  { id:"current-week", icon:"🎯", title:"Semana actual — el corazón", desc:"Añade tareas ✅ y eventos 📅 con los botones arriba a la derecha. Toca el estado para avanzarlo: TBC → ASAP → En curso → Hecho.", tab:"current" },
  { id:"calendar",     icon:"🗓️", title:"Calendario mensual", desc:"Vista de cuadrícula del mes. Los eventos multi-día se extienden visualmente. Toca cualquier día para ver el detalle.", tab:"calendar" },
  { id:"stats",        icon:"📈", title:"Estadísticas de pareja", desc:"Gráficos de completado, análisis de equidad, hábito ancla y más. Exporta la vista como imagen PNG.", tab:"stats" },
  { id:"chat",         icon:"💬", title:"Chat en tiempo real", desc:"Mensajes con tu pareja sincronizados al instante. Perfectos para coordinarse sin salir de la app.", tab:"chat" },
  { id:"nav-menu",     icon:"☰",  title:"Menú de navegación", desc:"Toca el botón ☰ arriba a la izquierda para acceder a Pendientes, Histórico, Metas, Gastos, Links y más secciones.", tab:"home" },
  { id:"settings",     icon:"⚙️", title:"Perfil y personalización", desc:"Toca ⚙️ arriba a la derecha para cambiar foto, nombre, tema visual (14 temas) y tipografía. Son ajustes personales.", tab:null },
  { id:"done",         icon:"🚀", title:"¡Todo listo!", desc:"Ya conoces Shared Calendar. Empieza añadiendo algo a esta semana. Puedes repasar el tutorial desde ⚙️ → Mi perfil.", tab:"home", isFinal:true },
];

export { TUTORIAL_STEPS };

export default function TutorialOverlay({ step, onNext, onBack, onSkip, onFinish }) {
  const s = TUTORIAL_STEPS[step];
  const total = TUTORIAL_STEPS.length;
  const isFirst = step === 0;
  const isLast = step === total - 1;
  const pct = (step / (total - 1)) * 100;

  return (
    <div style={{ position:"fixed", inset:0, zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{`@keyframes tut-pop { from { opacity:0; transform:scale(0.94) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>

      {/* Backdrop — tap to skip */}
      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(4px)", WebkitBackdropFilter:"blur(4px)" }} onClick={onSkip} />

      {/* Card */}
      <div key={step} style={{
        position:"relative", zIndex:1,
        background:"rgba(18,12,36,0.98)",
        border:"1px solid rgba(167,139,250,0.2)",
        borderRadius:24,
        width:"100%", maxWidth:340,
        padding:"0 0 24px",
        animation:"tut-pop 0.28s cubic-bezier(0.34,1.2,0.64,1) both",
        boxShadow:"0 24px 60px rgba(0,0,0,0.7), 0 2px 12px rgba(124,58,237,0.15)",
        overflow:"hidden",
      }}>
        {/* Progress bar */}
        <div style={{ height:3, background:"rgba(167,139,250,0.12)" }}>
          <div style={{ height:"100%", width:`${pct}%`, background:"linear-gradient(90deg,#7c3aed,#a855f7)", transition:"width 0.35s ease", borderRadius:"0 3px 3px 0" }} />
        </div>

        {/* Skip */}
        {!isLast && (
          <button onClick={onSkip} style={{ position:"absolute", top:14, right:14, background:"none", border:"none", cursor:"pointer", fontSize:11, color:"rgba(167,139,250,0.38)", fontFamily:"inherit", padding:"4px 8px", borderRadius:6, zIndex:2 }}>
            Saltar
          </button>
        )}

        {/* Body */}
        <div style={{ padding:"24px 24px 0" }}>
          {/* Icon */}
          <div style={{ width:52, height:52, borderRadius:14, background:"rgba(124,58,237,0.14)", border:"1px solid rgba(124,58,237,0.22)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, marginBottom:14 }}>
            {s.icon}
          </div>

          <div style={{ fontSize:17, fontWeight:700, color:"#f0eaff", marginBottom:8, lineHeight:1.3, paddingRight:40 }}>{s.title}</div>
          <div style={{ fontSize:14, color:"#a89dce", lineHeight:1.72, marginBottom:20 }}>{s.desc}</div>

          {/* Step dots */}
          <div style={{ display:"flex", gap:5, marginBottom:20, alignItems:"center" }}>
            {TUTORIAL_STEPS.map((_,i) => (
              <div key={i} style={{ height:4, width:i===step?20:4, borderRadius:99, background:i===step?"#7c3aed":i<step?"rgba(124,58,237,0.45)":"rgba(167,139,250,0.14)", transition:"all 0.3s" }} />
            ))}
          </div>

          {/* Navigation */}
          <div style={{ display:"flex", gap:8 }}>
            {!isFirst && (
              <button onClick={onBack} style={{ padding:"10px 16px", borderRadius:12, border:"1px solid rgba(167,139,250,0.18)", background:"rgba(167,139,250,0.07)", color:"rgba(167,139,250,0.65)", fontSize:14, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>
                ← Atrás
              </button>
            )}
            <button
              onClick={isLast ? onFinish : onNext}
              style={{ flex:1, padding:"11px 0", borderRadius:12, border:"none", background:"linear-gradient(135deg,#7c3aed 0%,#a855f7 100%)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit", letterSpacing:0.2, transition:"opacity 0.1s" }}
              onMouseDown={e=>e.currentTarget.style.opacity="0.85"}
              onMouseUp={e=>e.currentTarget.style.opacity="1"}
              onTouchStart={e=>e.currentTarget.style.opacity="0.85"}
              onTouchEnd={e=>e.currentTarget.style.opacity="1"}
            >
              {isLast ? "¡Empezar! 🚀" : isFirst ? "Comenzar →" : "Siguiente →"}
            </button>
          </div>

          <div style={{ textAlign:"center", fontSize:11, color:"rgba(167,139,250,0.28)", marginTop:10 }}>{step+1} de {total}</div>
        </div>
      </div>
    </div>
  );
}
