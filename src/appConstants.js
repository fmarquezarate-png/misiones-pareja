// ─── Constantes de UI extraídas de App.jsx ───────────────────────────────────
// Mover aquí evita que App.jsx crezca con datos estáticos.

export const STATUS_ORDER = ["TBC", "ASAP", "IN_PROGRESS", "DONE"];

export const TABS = ["home", "current", "calendar", "pending", "goals", "stats", "gastos", "chat", "wishlist"];

export const TUTORIAL_STEPS = [
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

export const STATUS = {
  TBC:         { label:"TBC",      icon:"⏳", color:"#94a3b8", bg:"rgba(148,163,184,0.12)", border:"rgba(148,163,184,0.3)" },
  ASAP:        { label:"ASAP",     icon:"🔥", color:"#fb923c", bg:"rgba(251,146,60,0.12)",  border:"rgba(251,146,60,0.3)"  },
  IN_PROGRESS: { label:"En curso", icon:"⚡", color:"#60a5fa", bg:"rgba(96,165,250,0.12)",  border:"rgba(96,165,250,0.3)"  },
  DONE:        { label:"Hecho",    icon:"✅", color:"#34d399", bg:"rgba(52,211,153,0.12)",  border:"rgba(52,211,153,0.3)"  },
};

export const CATEGORIES = [
  { id:"pareja",  label:"Pareja",  icon:"💞", color:"#f472b6" },
  { id:"deporte", label:"Deporte", icon:"🏅", color:"#60a5fa" },
  { id:"casa",    label:"Casa",    icon:"🏠", color:"var(--t-accent,#a78bfa)" },
  { id:"salud",   label:"Salud",   icon:"💊", color:"#34d399" },
  { id:"trabajo", label:"Trabajo", icon:"💼", color:"#fbbf24" },
  { id:"ocio",    label:"Ocio",    icon:"🎉", color:"#f97316" },
  { id:"social",  label:"Social",  icon:"🥂", color:"#e879f9" },
  { id:"viaje",   label:"Viaje",   icon:"✈️", color:"#38bdf8" },
];

export const GASTO_CATS = [
  { id:"comida",      label:"Comida",       icon:"🍽️",  color:"#f97316" },
  { id:"super",       label:"Supermercado", icon:"🛒",  color:"#fb923c" },
  { id:"casa",        label:"Casa",         icon:"🏠",  color:"var(--t-accent,#a78bfa)" },
  { id:"ocio",        label:"Ocio",         icon:"🎉",  color:"#e879f9" },
  { id:"transporte",  label:"Transporte",   icon:"🚗",  color:"#60a5fa" },
  { id:"salud",       label:"Salud",        icon:"💊",  color:"#34d399" },
  { id:"viaje",       label:"Viaje",        icon:"✈️",  color:"#38bdf8" },
  { id:"ropa",        label:"Ropa",         icon:"👕",  color:"#fbbf24" },
  { id:"tech",        label:"Tecnología",   icon:"💻",  color:"#818cf8" },
  { id:"cultura",     label:"Cultura",      icon:"🎭",  color:"#c084fc" },
  { id:"deporte",     label:"Deporte",      icon:"🏅",  color:"#4ade80" },
  { id:"mascotas",    label:"Mascotas",     icon:"🐾",  color:"#f472b6" },
  { id:"regalo",      label:"Regalos",      icon:"🎁",  color:"#f43f5e" },
  { id:"suscripcion", label:"Suscripciones",icon:"📺",  color:"#94a3b8" },
  { id:"otro",        label:"Otro",         icon:"📦",  color:"var(--t-text-muted,#8b7fa8)" },
];

export const EMOJI_GROUPS = [
  { label:"🏅 Deporte", emojis:["🎾","🏓","🏸","⚽","🏀","🏊","🚴","🧘","🏋️","🤸","🏆","🎳","🛼","🥊","🏄","⛷️","🧗","🤽","🏇","🥋","🏐","🎽","🥅","🥌","🎿","🛹","🪂","⛳","🎱","🏒","🤺","🏹","🤾","🏃","🫀"] },
  { label:"🏠 Casa",    emojis:["🛒","🖼️","🔧","💡","🛁","🪴","🧹","🛋️","🪟","🏠","🔑","📦","🧺","🪣","🫧","🔩","🪑","🛏️","🚿","🧼","🧽","🪠","🔋","💻","🖨️"] },
  { label:"💆 Bienestar",emojis:["🧖","💆","🧴","💅","😴","🌿","🧠","❤️","💊","🩺","🛁","🫁","🦷","👁️","🩻","🧘","🫶","🌞","🌙","🍃","🌺","💐","🫧","🩹","🏃"] },
  { label:"✈️ Viajes",  emojis:["🚢","✈️","🏖️","🗺️","🧳","🌊","🏔️","🌍","🏛️","📸","🚂","🛵","🚗","⛺","🏕️","🗼","🗽","🎡","🏝️","🌄","🌅","🧭","🎫","🪪","🚀"] },
  { label:"🍕 Comida",  emojis:["🍕","🌮","🥗","🍷","🧁","🎂","🍣","☕","🥘","🍜","🫕","🥂","🍝","🥩","🍱","🥡","🍰","🫙","🧆","🥙","🍛","🥐","🧇","🍳","🫖","🍹"] },
  { label:"💌 Pareja",  emojis:["💞","💌","🫀","💍","🌹","🙊","🐼","🦋","🌸","🎁","🕯️","💫","🥰","😍","🫦","💋","🌷","💐","🎀","🩷","🧸","🫂","🌙","✨","🪷","💝"] },
  { label:"💻 Trabajo", emojis:["🤖","💸","📚","📝","💡","🔧","📊","🎯","🗂️","✉️","📱","🖥️","💼","🗃️","📋","🔍","📈","📉","🖊️","📌","📎","🗓️","⌚","💬","🤝","🏦"] },
  { label:"🎉 Ocio",    emojis:["🎉","🎬","🎸","🎮","🧩","🎲","🎨","🎵","🎤","🎪","🪄","🎭","🎠","🎯","🎳","🎻","🥁","🎹","🎺","🪗","🎷","📺","📷","🎧","🕹️","🃏"] },
  { label:"🌱 Natura",  emojis:["🌱","🌳","🌻","🍄","🦁","🐶","🐱","🐠","🦜","🦋","🐝","🐢","🌈","🌊","⛰️","🌋","🦅","🌿","🍀","🌺","🐉","🦊","🐧","🦔","🌙","⭐"] },
  { label:"🎓 Cultura", emojis:["🎓","📖","🖼️","🏛️","🎭","🎨","🎬","📽️","🎼","🎤","📰","✍️","🖋️","📜","🏺","🗿","🎑","🌐","🔭","🔬","🧪","🧬","💎","🪬","🎋","🪁"] },
];

// Mapa rápido id → categoría (evita .find() en render)
export const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

// Helper usado en múltiples vistas
export const getMCats = m => m.categories?.length ? m.categories : (m.category ? [m.category] : []);

export const DEFAULT_SETTINGS = {
  person1: "Persona 1",
  person2: "Persona 2",
  colors: { person1: "#f472b6", person2: "#a78bfa", together: "#34d399" },
  notifications: {
    chat: true,
    partnerChanges: true,
    eventReminders: true,
    goalDeadlines: true,
    dailyBriefing: false,
    briefingTime: "08:00",
  },
};

export const DEFAULT_COLORS = { person1: "#f472b6", person2: "#a78bfa", together: "#34d399" };

export const PERIOD_LABEL = { weekly: "Semanal", monthly: "Mensual", annual: "Anual" };
export const PERIOD_EMOJI = { weekly: "📅", monthly: "🗓️", annual: "🎊" };
