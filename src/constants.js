// ─── Version ──────────────────────────────────────────────────────────────────
export const APP_VERSION = "4.20.1";
export const LAST_UPDATE = "2026-07-02";

// Banner de mantenimiento — null = desactivado
// Para activar durante trabajos de riesgo, cambiar a objeto con title + body y redesplegar.
// Se revierte a null una vez completado el mantenimiento.
export const MAINTENANCE_WARNING = null;
/* Ejemplo de activación:
export const MAINTENANCE_WARNING = {
  title: "Estamos mejorando la app",
  body:  "Realizamos ajustes para hacerla más segura y estable. Te recomendamos no realizar cambios importantes — no podemos garantizar que se guarden correctamente en este momento.",
};
*/

// Clave pública VAPID — segura en el cliente (no es un secreto)
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
  ?? "BCoIIBdYxBOpjsCsqHRmNFP-gxfmPUB87qomsXW8wpptkV-FrCTLj-4cnfzDOnocuxjDO3oPY2NiS2Tv5m6k5QU";
// ─── Mood / Ánimo ────────────────────────────────────────────────────────────
export const EMOTIONS = [
  { id:"alegre",      label:"Alegre",       emoji:"😄", valence:1,  color:"#fbbf24" },
  { id:"tranquilo",   label:"Tranquilo",    emoji:"😌", valence:1,  color:"#60a5fa" },
  { id:"emocionado",  label:"Emocionado",   emoji:"🤩", valence:1,  color:"#f472b6" },
  { id:"energico",    label:"Energético",   emoji:"⚡", valence:1,  color:"#fb923c" },
  { id:"carinoso",    label:"Cariñoso",     emoji:"🥰", valence:1,  color:"#e879f9" },
  { id:"confiado",    label:"Confiado",     emoji:"💪", valence:1,  color:"#a78bfa" },
  { id:"agradecido",  label:"Agradecido",   emoji:"🙏", valence:1,  color:"#34d399" },
  { id:"triste",      label:"Triste",       emoji:"😢", valence:-1, color:"#94a3b8" },
  { id:"ansioso",     label:"Ansioso",      emoji:"😰", valence:-1, color:"#f43f5e" },
  { id:"irritable",   label:"Irritable",    emoji:"😤", valence:-1, color:"#ef4444" },
  { id:"agotado",     label:"Agotado",      emoji:"😩", valence:-1, color:"#6b7280" },
  { id:"entumecido",  label:"Entumecido",   emoji:"😶", valence:-1, color:"#475569" },
  { id:"melancolico", label:"Melancólico",  emoji:"😔", valence:-1, color:"#818cf8" },
  { id:"frustrado",   label:"Frustrado",    emoji:"😠", valence:-1, color:"#f97316" },
  { id:"esperanzado", label:"Esperanzado",  emoji:"🌱", valence:1,  color:"#4ade80" },
  { id:"orgulloso",   label:"Orgulloso",    emoji:"🏆", valence:1,  color:"#fde68a" },
  { id:"en_paz",      label:"En paz",       emoji:"🕊️", valence:1,  color:"#67e8f9" },
  { id:"solitario",   label:"Solitario",    emoji:"🫥", valence:-1, color:"#93c5fd" },
  { id:"abrumado",    label:"Abrumado",     emoji:"🤯", valence:-1, color:"#4b5563" },
  { id:"inseguro",    label:"Inseguro",     emoji:"😟", valence:-1, color:"#c084fc" },
];


// ─── Status ───────────────────────────────────────────────────────────────────
export const SEED_VERSION = 6;
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
  { label:"🏅 Deporte", emojis:["🎾","🏓","🏸","⚽","🏀","🏊","🚴","🧘","🏋️","🤸","🏆","🎳","🛼","🥊","🏄","⛷️","🧗","🤽","🏇","🥋","🏐","🎽","🥅","🥌","🎿","🛹","🪂","⛳","🎱","🏒","🤺","🏹","🤾","🏃","🚵","⚾","🏈","🏉","🥏","🪃","🏑","🛷","⛸️","🥎"] },
  { label:"🏠 Casa",    emojis:["🛒","🖼️","🔧","💡","🛁","🪴","🧹","🛋️","🪟","🏠","🔑","📦","🧺","🪣","🫧","🔩","🪑","🛏️","🚿","🧼","🧽","🪠","🔋","💻","🖨️","🚪","🧯","🧴","🪜","🔌","🕯️","🪞","🧷","🪡","🧵","🛗","🚽","🪤","🧰","🔨","🪛","🪚"] },
  { label:"💆 Bienestar",emojis:["🧖","💆","🧴","💅","😴","🌿","🧠","❤️","💊","🩺","🫁","🦷","👁️","🩻","🫶","🌞","🍃","🌺","💐","🩹","💉","🩼","🦴","🧘","🛌","🫖","🍵","🧊","🪥","🧎","🤲","💪","🦵","👂","👃","🩷"] },
  { label:"✈️ Viajes",  emojis:["🚢","✈️","🏖️","🗺️","🧳","🌊","🏔️","🌍","🏛️","📸","🚂","🛵","🚗","⛺","🏕️","🗼","🗽","🎡","🏝️","🌄","🌅","🧭","🎫","🪪","🚀","🛳️","⛴️","🚁","🚠","🚡","🏨","🛎️","🗾","🏜️","🌃","🎢","🎠","🛶","🪝","🧗"] },
  { label:"🍕 Comida",  emojis:["🍕","🌮","🥗","🍷","🧁","🎂","🍣","☕","🥘","🍜","🫕","🥂","🍝","🥩","🍱","🥡","🍰","🫙","🧆","🥙","🍛","🥐","🧇","🍳","🫖","🍹","🍔","🌭","🥪","🍟","🥞","🧀","🥨","🍞","🥖","🍤","🍦","🍩","🍪","🍫","🍿","🍺","🍶","🧋","🥤","🍎","🍌","🍓","🥑","🥦","🌶️"] },
  { label:"💌 Pareja",  emojis:["💞","💌","🫀","💍","🌹","🙊","🐼","🦋","🌸","🎁","🕯️","💫","🥰","😍","🫦","💋","🌷","💐","🎀","🩷","🧸","🫂","🌙","✨","🪷","💝","💖","💗","💓","💕","❤️‍🔥","😘","🥂","🍓","🛌","💑","👩‍❤️‍👨","🫰"] },
  { label:"💻 Trabajo", emojis:["🤖","💸","📚","📝","💡","🔧","📊","🎯","🗂️","✉️","📱","🖥️","💼","🗃️","📋","🔍","📈","📉","🖊️","📌","📎","🗓️","⌚","💬","🤝","🏦","⌨️","🖱️","💾","🖲️","🗒️","📅","📆","🔖","🏷️","⏰","⏱️","🧮","📠","☎️","🛜","📡"] },
  { label:"🎉 Ocio",    emojis:["🎉","🎬","🎸","🎮","🧩","🎲","🎨","🎵","🎤","🎪","🪄","🎭","🎠","🎯","🎳","🎻","🥁","🎹","🎺","🪗","🎷","📺","📷","🎧","🕹️","🃏","🎰","🎱","🪅","🎊","🪩","🎟️","🪕","🎼","📻","🎙️","🪀","🧸","♟️","🀄"] },
  { label:"🌱 Natura",  emojis:["🌱","🌳","🌻","🍄","🦁","🐶","🐱","🐠","🦜","🦋","🐝","🐢","🌈","🌊","⛰️","🌋","🦅","🌿","🍀","🌺","🐉","🦊","🐧","🦔","🌙","⭐","🌷","🌼","🌵","🌴","🍂","🍁","🐰","🐻","🐨","🐯","🦌","🦉","🐺","🐗","🦢","🦩","🐙","🐬","🐳","🦈","🌾","🪺","🪻"] },
  { label:"🎓 Cultura", emojis:["🎓","📖","🖼️","🏛️","🎭","🎨","🎬","📽️","🎼","🎤","📰","✍️","🖋️","📜","🏺","🗿","🎑","🌐","🔭","🔬","🧪","🧬","💎","🪬","🎋","🪁","📕","📗","📘","📙","📓","🗞️","🧾","🩰","🎻","♟️","🧠","🗽","⛩️","🕌","⛪"] },
  { label:"👕 Ropa",    emojis:["👕","👗","👚","👖","🧥","👔","👙","🩳","🧦","👠","👟","🥿","👢","👞","🧤","🧣","🎩","🧢","👒","👑","💍","👜","👛","🎒","🕶️","👓","🥼","🦺","👘","🩱","👝","🛍️","🩴","🥾","👡","💼","🧳","🪮","💄","💅","🧶","🪡"] },
  { label:"🌦️ Clima",   emojis:["☀️","🌤️","⛅","🌥️","☁️","🌦️","🌧️","⛈️","🌩️","❄️","☃️","⛄","🌨️","💨","🌪️","🌫️","🌈","🌡️","☔","💧","🔥","⚡","🌬️","🌊","💦","🌀","🌝","🌛","🌜","🌚","⭐","🌟","☄️","🌠","🌑","🌕","🌗"] },
  { label:"🚗 Transporte",emojis:["🚗","🚙","🚕","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🏎️","🏍️","🛵","🚲","🛴","🛹","🚌","🚎","🚆","🚄","🚅","🚈","🚉","🚊","🚇","✈️","🛩️","🚁","🚀","🛸","⛵","🚤","🛥️","⚓","🚏","🚦","🚥","🛺","🦽","🦼","🛞","⛽"] },
  { label:"💰 Dinero",  emojis:["💰","💵","💴","💶","💷","🪙","💳","🧾","💸","🏦","🏧","📈","📉","💹","🤑","💎","⚖️","🔐","🪪","🧮","🛒","🏷️","🎰","💲","🪜","📊","💼","🤝","🪧"] },
  { label:"😀 Emociones",emojis:["😀","😄","😁","😊","🙂","😍","🥰","😘","😎","🤩","🥳","😋","🤗","🤔","😴","😌","😢","😭","😤","😠","😱","😨","😅","😬","🙄","😏","😇","🥺","😞","😔","🫠","🫨","🤯","😵","🤒","🤕","🤧","🥵","🥶","😷","🤫","🫢","🙃","😜","🤪","😈"] },
  { label:"🔣 Símbolos", emojis:["✅","❌","⭐","🔥","💯","❗","❓","⚠️","🚫","♻️","✔️","➕","➖","✖️","➗","🔔","🔕","🔒","🔓","🔑","💤","💢","💥","💫","💦","🕐","⏳","⌛","🔄","🔁","⤴️","🆗","🆕","🅰️","🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪","🟤","🔺","🔻","🔆"] },
];

// ─── Goal labels ──────────────────────────────────────────────────────────────
export const PERIOD_LABEL = { weekly:"Semanal", monthly:"Mensual", annual:"Anual" };
export const PERIOD_EMOJI = { weekly:"📅", monthly:"🗓️", annual:"🎊" };

// ─── Defaults & Seed ──────────────────────────────────────────────────────────
export const DEFAULT_SETTINGS = { person1: "Persona 1", person2: "Persona 2", colors: { person1:"#f472b6", person2:"#a78bfa", together:"#34d399" }, notifications: { chat:true, partnerChanges:true, eventReminders:true, goalDeadlines:true, dailyBriefing:false, briefingTime:"08:00" } };
export const DEFAULT_COLORS   = { person1:"#f472b6", person2:"#a78bfa", together:"#34d399" };

export const mk = (id, emoji, title, status, completedAt=null) => ({
  id, emoji, title, status, createdAt: 1739059200000, completedAt,
  date: null, time: null, carriedFrom: null, carriedFromWeek: null,
  category: null, who: "together", duration: null, type: "task",
});

import { getWeekAndYear } from "./utils.js";
const { week: _seedWeek, year: _seedYear } = getWeekAndYear();
const _seedKey = `${_seedYear}-W${String(_seedWeek).padStart(2,"0")}`;

export const SEED = {
  seedVersion: SEED_VERSION,
  currentWeekNumber: _seedWeek, currentYear: _seedYear,
  settings: DEFAULT_SETTINGS,
  goals: [
    { id:"sg1", emoji:"🍽️", title:"Cenar juntos fuera de casa", who:"together", period:"monthly", target:2, active:true, createdAt:1739059200000 },
    { id:"sg2", emoji:"🏃", title:"Hacer deporte juntos", who:"together", period:"weekly", target:2, active:true, createdAt:1739059200000 },
    { id:"sg3", emoji:"🧘", title:"Día de relax sin pantallas", who:"together", period:"monthly", target:1, active:true, createdAt:1739059200000 },
  ],
  weeks: {
    [_seedKey]: {
      weekNumber: _seedWeek, year: _seedYear,
      epicObjective: "¡Empezar con buen pie! 🚀",
      createdAt: Date.now(),
      workHours: { person1:0, person2:0 },
      missions: [
        mk("s01","🎯","Añade aquí tu primera tarea","TBC"),
        mk("s02","📅","Crea un evento para esta semana","TBC"),
        {...mk("s03","🏃","Hacer deporte juntos","TBC"), who:"together"},
        {...mk("s04","🍳","Cocinar algo rico en casa","TBC"), who:"together"},
        mk("s05","🌿","Momento de desconexión y relax","TBC"),
      ],
    },
  },
};

// ─── Gasto categories ─────────────────────────────────────────────────────────
export const GASTO_CATS = [
  { id:"comida",      label:"Comida",       icon:"🍽️",  color:"#f97316" },
  { id:"super",       label:"Supermercado", icon:"🛒",  color:"#fb923c" },
  { id:"casa",        label:"Casa",         icon:"🏠",  color:"#a78bfa" },
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

// ─── Themes ───────────────────────────────────────────────────────────────────
export const _DT = { text:"#f8f4ff", textMuted:"#8b7fa8", textDim:"#4a4166" };
export const THEMES = [
  // ── Oscuros originales ────────────────────────────────────────────────────
  {
    id:"violet", name:"Noche Violeta", preview:["#f472b6","#a78bfa","#34d399"], dark:true, pair:"lavender",
    bg:"#080512",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(167,139,250,0.40) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(244,114,182,0.35) 0%,transparent 52%)",
    menuBg:"rgba(6,3,16,0.98)", topBarBg:"rgba(6,3,14,0.94)",
    card:"#130d2a", cardBorder:"rgba(167,139,250,0.18)",
    btnGrad:"linear-gradient(135deg,#f472b6,#a78bfa)",
    accent:"#a78bfa", accentSoft:"rgba(167,139,250,0.14)",
    fontBody:"'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif", googleFonts:null,
    ..._DT,
  },
  {
    id:"ocean", name:"Océano Profundo", preview:["#22d3ee","#818cf8","#06b6d4"], dark:true, pair:"sky",
    bg:"#010c18",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(6,182,212,0.38) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(99,102,241,0.32) 0%,transparent 52%)",
    menuBg:"rgba(1,7,15,0.98)", topBarBg:"rgba(1,9,18,0.94)",
    card:"#071a2c", cardBorder:"rgba(6,182,212,0.18)",
    btnGrad:"linear-gradient(135deg,#06b6d4,#818cf8)",
    accent:"#22d3ee", accentSoft:"rgba(34,211,238,0.13)",
    fontBody:"'DM Sans',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap",
    ..._DT,
  },
  {
    id:"sage", name:"Jardín Botánico", preview:["#4ade80","#a3e635","#fbbf24"], dark:true, pair:"mint",
    bg:"#030c06",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(74,222,128,0.35) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(251,191,36,0.28) 0%,transparent 52%)",
    menuBg:"rgba(2,8,4,0.98)", topBarBg:"rgba(3,11,5,0.94)",
    card:"#08180d", cardBorder:"rgba(74,222,128,0.18)",
    btnGrad:"linear-gradient(135deg,#4ade80,#fbbf24)",
    accent:"#4ade80", accentSoft:"rgba(74,222,128,0.13)",
    fontBody:"'Nunito',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap",
    ..._DT,
  },
  {
    id:"sunset", name:"Atardecer", preview:["#fb923c","#f43f5e","#fbbf24"], dark:true, pair:"peach",
    bg:"#110507",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(251,146,60,0.38) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(244,63,94,0.32) 0%,transparent 52%)",
    menuBg:"rgba(14,4,6,0.98)", topBarBg:"rgba(14,5,7,0.94)",
    card:"#1e0b0e", cardBorder:"rgba(251,146,60,0.2)",
    btnGrad:"linear-gradient(135deg,#fb923c,#f43f5e)",
    accent:"#fb923c", accentSoft:"rgba(251,146,60,0.13)",
    fontBody:"'Lato','Helvetica Neue',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap",
    ..._DT,
  },
  {
    id:"obsidian", name:"Obsidiana", preview:["#e2e8f0","#94a3b8","#60a5fa"], dark:true, pair:"lavender",
    bg:"#050505",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(96,165,250,0.18) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(148,163,184,0.12) 0%,transparent 52%)",
    menuBg:"rgba(4,4,4,0.99)", topBarBg:"rgba(5,5,5,0.96)",
    card:"#101010", cardBorder:"rgba(148,163,184,0.14)",
    btnGrad:"linear-gradient(135deg,#94a3b8,#60a5fa)",
    accent:"#94a3b8", accentSoft:"rgba(148,163,184,0.1)",
    fontBody:"'Space Grotesk',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
    ..._DT,
  },
  // ── Nuevos: Fuera de la caja ──────────────────────────────────────────────
  {
    id:"aurora", name:"Aurora Boreal", preview:["#00ff88","#ff00cc","#00d4ff"], dark:true, pair:"mint",
    bg:"#030b10",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(0,255,136,0.45) 0%,transparent 50%),radial-gradient(ellipse at 105% -5%,rgba(255,0,204,0.40) 0%,transparent 50%)",
    menuBg:"rgba(2,7,12,0.98)", topBarBg:"rgba(3,9,14,0.95)",
    card:"#071520", cardBorder:"rgba(0,255,136,0.2)",
    btnGrad:"linear-gradient(135deg,#00ff88,#ff00cc)",
    accent:"#00ff88", accentSoft:"rgba(0,255,136,0.12)",
    fontBody:"'Space Grotesk',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
    ..._DT,
  },
  {
    id:"tokyo", name:"Neón Tokyo", preview:["#f0abfc","#22d3ee","#facc15"], dark:true, pair:"blush",
    bg:"#06010f",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(240,171,252,0.42) 0%,transparent 50%),radial-gradient(ellipse at 105% -5%,rgba(34,211,238,0.38) 0%,transparent 50%)",
    menuBg:"rgba(4,1,10,0.99)", topBarBg:"rgba(5,1,12,0.95)",
    card:"#110820", cardBorder:"rgba(240,171,252,0.2)",
    btnGrad:"linear-gradient(135deg,#d946ef,#22d3ee)",
    accent:"#f0abfc", accentSoft:"rgba(240,171,252,0.12)",
    fontBody:"'Space Grotesk',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
    ..._DT,
  },
  {
    id:"wine", name:"Vino & Oro", preview:["#be123c","#fbbf24","#f9a8d4"], dark:true, pair:"blush",
    bg:"#0e0208",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(190,18,60,0.45) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(251,191,36,0.35) 0%,transparent 52%)",
    menuBg:"rgba(10,2,7,0.99)", topBarBg:"rgba(12,2,8,0.95)",
    card:"#200614", cardBorder:"rgba(251,191,36,0.2)",
    btnGrad:"linear-gradient(135deg,#9f1239,#fbbf24)",
    accent:"#fbbf24", accentSoft:"rgba(251,191,36,0.12)",
    fontBody:"'Lato','Helvetica Neue',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap",
    ..._DT,
  },
  {
    id:"dawn", name:"Mañana Clara", preview:["#7c3aed","#f472b6","#10b981"], dark:false, pair:"violet",
    bg:"#f5f0ea",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(244,114,182,0.22) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(124,58,237,0.18) 0%,transparent 52%)",
    menuBg:"rgba(245,240,234,0.98)", topBarBg:"rgba(245,240,234,0.94)",
    card:"rgba(255,255,255,0.85)", cardBorder:"rgba(124,58,237,0.15)",
    btnGrad:"linear-gradient(135deg,#f472b6,#7c3aed)",
    accent:"#7c3aed", accentSoft:"rgba(124,58,237,0.1)",
    fontBody:"'Nunito',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap",
    text:"#1e0d3c", textMuted:"#3d2c5e", textDim:"#6e5c8a", error:"#c0392b",
  },
  // ── Temas claros ──────────────────────────────────────────────────────────
  {
    id:"blush", name:"Rosa Pastel", preview:["#e91e8c","#f472b6","#fb7185"], dark:false, pair:"tokyo",
    bg:"#fff0f5",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(233,30,140,0.12) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(251,113,133,0.10) 0%,transparent 52%)",
    menuBg:"rgba(255,240,245,0.98)", topBarBg:"rgba(255,240,245,0.94)",
    card:"rgba(255,255,255,0.9)", cardBorder:"rgba(233,30,140,0.15)",
    btnGrad:"linear-gradient(135deg,#e91e8c,#f472b6)",
    accent:"#e91e8c", accentSoft:"rgba(233,30,140,0.1)",
    fontBody:"'Nunito',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap",
    text:"#3d0028", textMuted:"#5c1840", textDim:"#8c4472", error:"#b52042",
  },
  {
    id:"sky", name:"Cielo Azul", preview:["#0ea5e9","#38bdf8","#7dd3fc"], dark:false, pair:"ocean",
    bg:"#f0f8ff",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(14,165,233,0.12) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(56,189,248,0.10) 0%,transparent 52%)",
    menuBg:"rgba(240,248,255,0.98)", topBarBg:"rgba(240,248,255,0.94)",
    card:"rgba(255,255,255,0.9)", cardBorder:"rgba(14,165,233,0.15)",
    btnGrad:"linear-gradient(135deg,#0ea5e9,#38bdf8)",
    accent:"#0ea5e9", accentSoft:"rgba(14,165,233,0.1)",
    fontBody:"'DM Sans',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap",
    text:"#0c2a48", textMuted:"#0f3d6e", textDim:"#2c6898", error:"#b52d20",
  },
  {
    id:"mint", name:"Menta Fresca", preview:["#059669","#10b981","#34d399"], dark:false, pair:"sage",
    bg:"#f0faf4",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(5,150,105,0.12) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(16,185,129,0.10) 0%,transparent 52%)",
    menuBg:"rgba(240,250,244,0.98)", topBarBg:"rgba(240,250,244,0.94)",
    card:"rgba(255,255,255,0.9)", cardBorder:"rgba(5,150,105,0.15)",
    btnGrad:"linear-gradient(135deg,#059669,#10b981)",
    accent:"#059669", accentSoft:"rgba(5,150,105,0.1)",
    fontBody:"'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif", googleFonts:null,
    text:"#0a2e1e", textMuted:"#0d4429", textDim:"#1d7045", error:"#a52d14",
  },
  {
    id:"peach", name:"Melocotón", preview:["#ea7026","#f97316","#fb923c"], dark:false, pair:"sunset",
    bg:"#fff8f0",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(234,112,38,0.12) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(249,115,22,0.10) 0%,transparent 52%)",
    menuBg:"rgba(255,248,240,0.98)", topBarBg:"rgba(255,248,240,0.94)",
    card:"rgba(255,255,255,0.9)", cardBorder:"rgba(234,112,38,0.15)",
    btnGrad:"linear-gradient(135deg,#ea7026,#f97316)",
    accent:"#ea7026", accentSoft:"rgba(234,112,38,0.1)",
    fontBody:"'Lato','Helvetica Neue',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap",
    text:"#3d1500", textMuted:"#4d1f08", textDim:"#7a3e12", error:"#a02010",
  },
  {
    id:"lavender", name:"Lavanda Suave", preview:["#7c3aed","#8b5cf6","#a78bfa"], dark:false, pair:"violet",
    bg:"#f5f0ff",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(124,58,237,0.12) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(139,92,246,0.10) 0%,transparent 52%)",
    menuBg:"rgba(245,240,255,0.98)", topBarBg:"rgba(245,240,255,0.94)",
    card:"rgba(255,255,255,0.9)", cardBorder:"rgba(124,58,237,0.15)",
    btnGrad:"linear-gradient(135deg,#7c3aed,#8b5cf6)",
    accent:"#7c3aed", accentSoft:"rgba(124,58,237,0.1)",
    fontBody:"'Space Grotesk',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
    text:"#1e0b4b", textMuted:"#3c2070", textDim:"#6b4fa8",
  },
  {
    id:"coffee", name:"Café Oscuro", preview:["#f59e0b","#92400e","#fde68a"], dark:true, pair:"peach",
    bg:"#0d0805",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(245,158,11,0.40) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(146,64,14,0.45) 0%,transparent 52%)",
    menuBg:"rgba(10,6,3,0.99)", topBarBg:"rgba(11,7,4,0.95)",
    card:"#1c1008", cardBorder:"rgba(245,158,11,0.2)",
    btnGrad:"linear-gradient(135deg,#92400e,#f59e0b)",
    accent:"#f59e0b", accentSoft:"rgba(245,158,11,0.12)",
    fontBody:"'Lato','Helvetica Neue',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap",
    ..._DT,
  },
];

// ─── Fonts ────────────────────────────────────────────────────────────────────
export const FONTS = [
  { id:"auto",         name:"Automático (del tema)",  family:null, googleFonts:null },
  { id:"inter",        name:"Inter",                  family:"'Inter',system-ui,sans-serif",                googleFonts:"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
  { id:"poppins",      name:"Poppins",                family:"'Poppins',system-ui,sans-serif",              googleFonts:"https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" },
  { id:"playfair",     name:"Playfair Display",       family:"'Playfair Display',Georgia,serif",            googleFonts:"https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" },
  { id:"space",        name:"Space Grotesk",          family:"'Space Grotesk',system-ui,sans-serif",        googleFonts:"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" },
  { id:"raleway",      name:"Raleway",                family:"'Raleway',system-ui,sans-serif",              googleFonts:"https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700&display=swap" },
  { id:"montserrat",   name:"Montserrat",             family:"'Montserrat',system-ui,sans-serif",           googleFonts:"https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" },
  { id:"merriweather", name:"Merriweather",           family:"'Merriweather',Georgia,serif",                googleFonts:"https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap" },
  { id:"quicksand",    name:"Quicksand",              family:"'Quicksand',system-ui,sans-serif",            googleFonts:"https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" },
  { id:"josefin",      name:"Josefin Sans",           family:"'Josefin Sans',system-ui,sans-serif",         googleFonts:"https://fonts.googleapis.com/css2?family=Josefin+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap" },
  { id:"dmserif",      name:"DM Serif Display",       family:"'DM Serif Display',Georgia,serif",            googleFonts:"https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap" },
];
