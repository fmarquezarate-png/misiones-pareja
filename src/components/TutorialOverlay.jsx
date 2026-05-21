const TUTORIAL_STEPS = [
  { id:"welcome",      tab:null,       bubblePos:"center",  arrowType:null,
    title:"¡Bienvenido/a a Shared Calendar!",
    desc:"Tu espacio para planear la vida juntos. Te mostramos cada sección en 2 minutos — después podrás volver a este tutorial desde ⚙️." },
  { id:"home-rings",   tab:"home",     bubblePos:"top",     arrowType:"down-left",
    title:"Scorecards de pareja",
    desc:"Tu foto y el porcentaje de tareas completadas en las últimas 2 semanas. Toca el anillo para ver el desglose completo." },
  { id:"home-events",  tab:"home",     bubblePos:"top",     arrowType:"down-center",
    title:"Tira de días y actividades",
    desc:"Las actividades de la semana ordenadas por día. Toca cualquier tarjeta para editar o cambiar su estado rápidamente." },
  { id:"current-week", tab:"current",  bubblePos:"top",     arrowType:"down-right",
    title:"Semana actual — el corazón",
    desc:"Añade tareas ✅ y eventos 📅 con los botones de arriba a la derecha. Toca el estado para avanzarlo: TBC → ASAP → En curso → Hecho." },
  { id:"calendar",     tab:"calendar", bubblePos:"top",     arrowType:"down-center",
    title:"Calendario mensual",
    desc:"Vista de cuadrícula del mes. Los eventos multi-día se extienden visualmente. Toca cualquier día para ver el detalle." },
  { id:"stats",        tab:"stats",    bubblePos:"top",     arrowType:"down-center",
    title:"Estadísticas de pareja",
    desc:"Gráficos de completado por semana, análisis de equidad en tareas, hábito ancla y más. Exporta la vista como imagen PNG." },
  { id:"chat",         tab:"chat",     bubblePos:"top",     arrowType:"down-center",
    title:"Chat en tiempo real",
    desc:"Mensajes con tu pareja sincronizados al instante. Perfectos para coordinarse sin salir de la app." },
  { id:"nav-menu",     tab:"home",     bubblePos:"top-nav", arrowType:"up-left",
    title:"Menú de navegación ☰",
    desc:"Toca el botón de menú arriba a la izquierda para acceder a Pendientes, Histórico, Metas, Gastos, Links y más secciones." },
  { id:"settings",     tab:null,       bubblePos:"top-nav", arrowType:"up-right",
    title:"Perfil y personalización ⚙️",
    desc:"Toca ⚙️ arriba a la derecha para cambiar foto, nombre, tema visual (14 temas) y tipografía. Son ajustes personales, no afectan a tu pareja." },
  { id:"done",         tab:"home",     bubblePos:"center",  arrowType:null,        isFinal:true,
    title:"¡Todo listo! ✨",
    desc:"Ya conoces Shared Calendar. Empieza añadiendo algo a esta semana. Puedes repasar el tutorial desde ⚙️ → Mi perfil cuando quieras." },
];

export { TUTORIAL_STEPS };

export default function TutorialOverlay({ step, onNext, onSkip, onFinish }) {
  const s = TUTORIAL_STEPS[step];
  const total = TUTORIAL_STEPS.length;
  const isFirst = step === 0;
  const isLast = step === total - 1;

  const bubbleContainerStyle = (() => {
    if (s.bubblePos === "center") return { top:"50%", left:"50%", width:300, maxWidth:"88vw", transform:"translate(-50%,-50%)" };
    if (s.bubblePos === "top-nav") return { top:130, left:16, right:16 };
    return { top:68, left:16, right:16 };
  })();

  const arrowEl = (() => {
    const t = s.arrowType;
    if (!t) return null;
    const st = "#2d1060";
    const sw = "3.5";
    const sw2 = "3";
    const base = { position:"absolute", pointerEvents:"none" };

    if (t === "down-center") return (
      <div style={{ ...base, top:248, left:"calc(50% - 25px)" }}>
        <svg width="50" height="80" viewBox="0 0 50 80" fill="none">
          <path d="M 25,4 C 38,22 14,52 25,72" stroke={st} strokeWidth={sw} strokeLinecap="round"/>
          <path d="M 13,61 L 25,76 L 37,62" stroke={st} strokeWidth={sw2} strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    );
    if (t === "down-left") return (
      <div style={{ ...base, top:248, left:"26%" }}>
        <svg width="70" height="90" viewBox="0 0 70 90" fill="none">
          <path d="M 55,5 C 68,38 22,55 18,80" stroke={st} strokeWidth={sw} strokeLinecap="round"/>
          <path d="M 6,68 L 18,84 L 31,72" stroke={st} strokeWidth={sw2} strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    );
    if (t === "down-right") return (
      <div style={{ ...base, top:248, right:"6%" }}>
        <svg width="70" height="90" viewBox="0 0 70 90" fill="none">
          <path d="M 15,5 C 2,38 48,55 52,80" stroke={st} strokeWidth={sw} strokeLinecap="round"/>
          <path d="M 39,68 L 52,84 L 64,72" stroke={st} strokeWidth={sw2} strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    );
    if (t === "up-left") return (
      <div style={{ ...base, top:50, left:14 }}>
        <svg width="60" height="72" viewBox="0 0 60 72" fill="none">
          <path d="M 50,68 C 56,44 18,26 14,8" stroke={st} strokeWidth={sw} strokeLinecap="round"/>
          <path d="M 2,18 L 14,5 L 26,17" stroke={st} strokeWidth={sw2} strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    );
    if (t === "up-right") return (
      <div style={{ ...base, top:50, right:14 }}>
        <svg width="60" height="72" viewBox="0 0 60 72" fill="none">
          <path d="M 10,68 C 4,44 42,26 46,8" stroke={st} strokeWidth={sw} strokeLinecap="round"/>
          <path d="M 34,18 L 46,5 L 58,17" stroke={st} strokeWidth={sw2} strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    );
    return null;
  })();

  return (
    <div style={{ position:"fixed", inset:0, zIndex:500, pointerEvents:"none" }}>
      <style>{`@keyframes tut-pop { from { opacity:0; transform:scale(0.95) } to { opacity:1; transform:scale(1) } }`}</style>

      {arrowEl}

      <div style={{ position:"absolute", pointerEvents:"auto", ...bubbleContainerStyle }}>
        <div key={step} style={{ animation:"tut-pop 0.28s cubic-bezier(0.34,1.2,0.64,1) both", background:"rgba(255,255,255,0.88)", backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)", borderRadius:20, padding:"18px 20px 16px", boxShadow:"0 8px 40px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.1)", position:"relative" }}>

          {!isLast && (
            <button onClick={onSkip} style={{ position:"absolute", top:12, right:14, background:"none", border:"none", cursor:"pointer", fontSize:11, color:"rgba(45,16,96,0.35)", fontFamily:"inherit", padding:0 }}>
              Saltar
            </button>
          )}

          <div style={{ fontSize:15, fontWeight:700, color:"#1a0a30", marginBottom:6, paddingRight:44, lineHeight:1.3 }}>{s.title}</div>
          <div style={{ fontSize:13, color:"#3d2060", lineHeight:1.65, marginBottom:14 }}>{s.desc}</div>

          <div style={{ display:"flex", gap:4, marginBottom:14 }}>
            {TUTORIAL_STEPS.map((_,i) => (
              <div key={i} style={{ height:5, width:i===step?18:5, borderRadius:99, background:i===step?"#7c3aed":i<step?"rgba(124,58,237,0.4)":"rgba(30,10,80,0.12)", transition:"all 0.3s" }} />
            ))}
          </div>

          <button
            onClick={isLast ? onFinish : onNext}
            onMouseDown={e=>e.currentTarget.style.transform="scale(0.97)"}
            onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}
            onTouchStart={e=>e.currentTarget.style.transform="scale(0.97)"}
            onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}
            style={{ background:"linear-gradient(135deg,#7c3aed 0%,#a855f7 100%)", border:"none", borderRadius:12, padding:"11px 0", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit", width:"100%", letterSpacing:0.2, transition:"transform 0.1s", display:"block" }}>
            {isLast ? "¡Empezar! 🚀" : isFirst ? "Mostrarme la app →" : "Siguiente →"}
          </button>

          <div style={{ textAlign:"center", fontSize:11, color:"rgba(45,16,96,0.28)", marginTop:8 }}>{step+1} de {total}</div>
        </div>
      </div>
    </div>
  );
}
