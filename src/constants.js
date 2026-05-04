// ─── Version ──────────────────────────────────────────────────────────────────
export const APP_VERSION = "3.0.0";
export const LAST_UPDATE = "2026-05-04";
export const CHANGELOG = [
  { v:"2.0.0", date:"2026-04-08", notes:["Login con Google OAuth","Espacio privado por pareja con código compartido","Sincronización en tiempo real con Supabase Realtime","Backup automático en localStorage"] },
  { v:"1.9.3", date:"2026-04-06", notes:["P2: columna 'Sin fecha' eliminada, calendario vuelve a pantalla completa","Se mantiene edición inline de actividades desde el panel del día"] },
  { v:"1.9.2", date:"2026-04-05", notes:["Sin fecha: solo no-hechas, dedup por título+quién+emoji (semana más reciente)","Drag & drop corregido: onDragEnter + relatedTarget fix","Metas: ❌ en TODOS los períodos pasados no cumplidos","Stats: barras con escala absoluta 0-100%","Fecha de hoy bajo 'Semana X', botón nueva misión arriba"] },
  { v:"1.9.0", date:"2026-04-04", notes:["Fix guardado: debounce evita pérdidas de datos","Filtro de categoría global (persiste entre tabs)","Calendario: columna sin-fecha con drag & drop","Editar actividades directamente en calendario (sin salir)","Metas: períodos no cumplidos en rojo, cumplidos en verde"] },
  { v:"1.8.0", date:"2026-03-30", notes:["Categoría Viaje + multi-categoría por tarea/evento","Filtro global por persona persiste entre tabs","Metas: tipo Mínimo/Máximo","Countdown en segundos cuando queda <24h","Gráfico horas por categoría (trabajo en escala propia)","Filtro Esta semana en Historial","Meta enlazada: selector desplegable","Barras de progreso relativas","Insights más potentes"] },
  { v:"1.7.0", date:"2026-03-26", notes:["Filtro por persona en P1 y P2","Versión dorada con fecha y changelog","Editar estado desde P2","Tareas recurrentes (semanal/mensual)","Goals con countdown deadline","Stats rediseñado"] },
  { v:"1.6.0", date:"2026-03-25", notes:["Fix stats semanas futuras","Calendario navega a semana correcta","Distinción Tarea vs Evento","Distribuir eventos","Historial sin semanas futuras","Emojis con fondo en calendario"] },
];

// ─── Status ───────────────────────────────────────────────────────────────────
export const SEED_VERSION = 5;
export const STATUS_ORDER = ["TBC", "ASAP", "IN_PROGRESS", "DONE"];
export const STATUS = {
  TBC:         { label:"TBC",      icon:"⏳", color:"#94a3b8", bg:"rgba(148,163,184,0.12)", border:"rgba(148,163,184,0.3)" },
  ASAP:        { label:"ASAP",     icon:"🔥", color:"#fb923c", bg:"rgba(251,146,60,0.12)",  border:"rgba(251,146,60,0.3)"  },
  IN_PROGRESS: { label:"En curso", icon:"⚡", color:"#60a5fa", bg:"rgba(96,165,250,0.12)",  border:"rgba(96,165,250,0.3)"  },
  DONE:        { label:"Hecho",    icon:"✅", color:"#34d399", bg:"rgba(52,211,153,0.12)",  border:"rgba(52,211,153,0.3)"  },
};

// ─── Categories ───────────────────────────────────────────────────────────────
export const CATEGORIES = [
  { id:"pareja",  label:"Pareja",  icon:"💞", color:"#f472b6" },
  { id:"deporte", label:"Deporte", icon:"🏅", color:"#60a5fa" },
  { id:"casa",    label:"Casa",    icon:"🏠", color:"#a78bfa" },
  { id:"salud",   label:"Salud",   icon:"💊", color:"#34d399" },
  { id:"trabajo", label:"Trabajo", icon:"💼", color:"#fbbf24" },
  { id:"ocio",    label:"Ocio",    icon:"🎉", color:"#f97316" },
  { id:"social",  label:"Social",  icon:"🥂", color:"#e879f9" },
  { id:"viaje",   label:"Viaje",   icon:"✈️", color:"#38bdf8" },
];
export const getMCats = m => m.categories?.length ? m.categories : (m.category ? [m.category] : []);
export const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

// ─── Emoji groups ─────────────────────────────────────────────────────────────
export const EMOJI_GROUPS = [
  { label:"🏅 Deporte", emojis:["🎾","🏓","🏸","⚽","🏀","🏊","🚴","🧘","🏋️","🤸","🏆","🎳","🛼","🥊","🏄","⛷️","🧗","🤽","🏇","🥋","🏐","🎽","🥅","🥌","🎿","🛹","🪂","⛳","🎱","🏒","🤺","🏹","🤾","🏃","🧗","🫀"] },
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

// ─── Goal labels ──────────────────────────────────────────────────────────────
export const PERIOD_LABEL = { weekly:"Semanal", monthly:"Mensual", annual:"Anual" };
export const PERIOD_EMOJI = { weekly:"📅", monthly:"🗓️", annual:"🎊" };

// ─── Defaults & Seed ──────────────────────────────────────────────────────────
export const DEFAULT_SETTINGS = { person1: "Pololo", person2: "Banana", colors: { person1:"#f472b6", person2:"#a78bfa", together:"#34d399" } };
export const DEFAULT_COLORS   = { person1:"#f472b6", person2:"#a78bfa", together:"#34d399" };

export const mk = (id, emoji, title, status, completedAt=null) => ({
  id, emoji, title, status, createdAt: 1739059200000, completedAt,
  date: null, time: null, carriedFrom: null, carriedFromWeek: null,
  category: null, who: "together", duration: null, type: "task",
});

import { getWeekAndYear } from "./utils.js";
const { week: _seedWeek, year: _seedYear } = getWeekAndYear();

export const SEED = {
  seedVersion: SEED_VERSION,
  currentWeekNumber: _seedWeek, currentYear: _seedYear,
  settings: DEFAULT_SETTINGS,
  goals: [
    { id:"sg1", emoji:"🍽️", title:"Cenar juntos fuera de casa", who:"together", period:"monthly", target:2, active:true, createdAt:1739059200000 },
    { id:"sg2", emoji:"🏃", title:"Hacer deporte juntos", who:"together", period:"weekly", target:2, active:true, createdAt:1739059200000 },
    { id:"sg3", emoji:"🧘", title:"Día de relax sin estrés", who:"together", period:"monthly", target:1, active:true, createdAt:1739059200000 },
  ],
  weeks: {
    "2026-W07": {
      weekNumber:7, year:2026, epicObjective:"A tope con healty style!", createdAt:1739059200000,
      workHours:{person1:0,person2:0},
      missions:[
        mk("w07a","🎾","Padel mixto torneo!","DONE",1739059200000),
        mk("w07b","💸","Terminar de meter en Split lo de Chile","ASAP"),
        mk("w07c","👄","Comprar perfume banana","TBC"),
        mk("w07d","🎳","Bowling miércoles!","TBC"),
        mk("w07e","🧩","Avanzar en el puzzle","DONE",1739059200000),
        mk("w07f","🌶️","Cocinar algo rico y healthy","DONE",1739059200000),
        mk("w07g","🧖","Día de relax y Spa","TBC"),
        mk("w07h","🚢","Revisar ofertas crucero Grecia!","TBC"),
        mk("w07i","🦷","Citas Dentista","DONE",1739059200000),
        mk("w07j","🏥","Conseguir cita pruebas médicas carnet","TBC"),
      ],
    },
    "2026-W09": {
      weekNumber:9, year:2026, epicObjective:"¡RECONECTAR!", createdAt:1740268800000,
      workHours:{person1:0,person2:0},
      missions:[
        mk("w09a","🎾","Montar partidito próxima semana","TBC"),
        mk("w09b","👔","Organizar ropa pololo","DONE",1740268800000),
        mk("w09c","🛒","Super Gringo: materiales manualidades + mesita sofá","DONE",1740268800000),
        mk("w09d","🤲","Hacer manualidades","DONE",1740268800000),
        mk("w09e","💸","Terminar de meter en Split lo de Chile","ASAP"),
        mk("w09f","👄","Comprar perfume banana","TBC"),
        mk("w09g","🧩","Avanzar en el puzzle","TBC"),
        mk("w09h","👩‍🍳","Cocinar algo rico y healthy","TBC"),
        mk("w09i","🧖","Ir al SPA","TBC"),
        mk("w09j","🚢","Revisar ofertas crucero Grecia!","TBC"),
        mk("w09k","🦷","Citas Dentista","DONE",1740268800000),
        mk("w09l","🏥","Conseguir cita pruebas médicas carnet","TBC"),
      ],
    },
    "2026-W10": {
      weekNumber:10, year:2026, epicObjective:"SER FELICES Y ESTAR RELAJAOS!", createdAt:1740873600000,
      workHours:{person1:0,person2:0},
      missions:[
        mk("w10a","💸","Terminar de meter en Split lo de Chile","DONE",1740873600000),
        mk("w10b","👄","Comprar perfume banana","TBC"),
        mk("w10c","🛒","Comprar todo para la oncesita!!","DONE",1740873600000),
        mk("w10d","🎾","Comprar patines y bambas correr banana!","TBC"),
        mk("w10e","🧩","Avanzar en el puzzle","TBC"),
        mk("w10f","🕺","Pololo perrear hasta el suelo con sus friends","DONE",1740873600000),
        mk("w10g","🧖","Pedir cita para el SPA o ir si se puede","TBC"),
        mk("w10h","🚢","Montar de una vez ya el viaje a Grecia!","TBC"),
        mk("w10i","🤲","Cuidar nuestro cortisol sin ponernos demasiadas tareas","TBC"),
      ],
    },
    "2026-W11": {
      weekNumber:11, year:2026, epicObjective:"??????", createdAt:1741478400000,
      workHours:{person1:0,person2:0},
      missions:[
        mk("w11a","👄","Comprar perfume banana","TBC"),
        mk("w11b","🛒","Hacer compra carrito Amazon","TBC"),
        mk("w11c","🎾","Comprar patines y bambas - Ver zapas pádel pololo","TBC"),
        mk("w11d","🧩","Avanzar en el puzzle","TBC"),
        mk("w11e","🏆","Torneo pololo el finde","TBC"),
        mk("w11f","🧖","Pedir cita SPA o ir si se puede + Skincare plz","TBC"),
        mk("w11g","🚢","Montar de una vez ya el viaje a Grecia!","TBC"),
        mk("w11h","🤲","Cuidar nuestro cortisol sin ponernos demasiadas tareas","TBC"),
      ],
    },
    "2026-W12": {
      weekNumber:12, year:2026, epicObjective:"", createdAt:1742083200000,
      workHours:{person1:0,person2:0},
      missions:[
        mk("w12a","🛒","Hacer compra carrito Amazon","TBC"),
        mk("w12b","🛼","Comprar patines y bambas - Ver zapas pádel pololo","TBC"),
        mk("w12c","🧩","Avanzar en el puzle","TBC"),
        mk("w12d","🧖","Pedir cita SPA o ir si se puede + Skincare plz","TBC"),
        mk("w12e","🚢","Montar de una vez ya el viaje a Grecia!","TBC"),
        {...mk("w12f","🩺","Revisión médica para el carnet de conducir","ASAP"), who:"person1"},
        mk("w12g","🖼️","Imprimir fotos para enchular la pieza","TBC"),
        mk("w12h","🎳","Lunes de liga!!","TBC"),
        mk("w12i","👁️","Comprar lentillas","TBC"),
        mk("w12j","🤖","Montar Claude asistente financiero para banana","TBC"),
      ],
    },
    "2026-W13": {
      weekNumber:13, year:2026, epicObjective:"", createdAt:1742688000000,
      workHours:{person1:0,person2:0},
      missions:[
        mk("w13a","🛒","Hacer compra carrito Amazon","TBC"),
        mk("w13b","🛼","Comprar patines y bambas - Ver zapas pádel pololo","TBC"),
        mk("w13c","🧩","Avanzar en el puzle","TBC"),
        mk("w13d","🧖","Pedir cita SPA o ir si se puede + Skincare plz","TBC"),
        mk("w13e","🚢","Montar de una vez ya el viaje a Grecia!","TBC"),
        {...mk("w13f","🩺","Revisión médica para el carnet de conducir","ASAP"), who:"person1"},
        mk("w13g","🖼️","Imprimir fotos para enchular la pieza","TBC"),
        mk("w13h","🎳","Lunes de liga!!","TBC"),
        {...mk("w13i","👁️","Comprar lentillas","DONE",1742688000001), who:"person2"},
        {...mk("w13j","🤖","Montar Claude asistente financiero para banana","TBC"), who:"person1"},
        mk("w13k","🙊","Banana prepararse para la boda","TBC"),
      ],
    },
  },
};
