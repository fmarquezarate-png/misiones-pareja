import { useState, useEffect, useCallback, useRef } from "react";
import { loadData, saveData, loadLocalBackup, exportData, importData, signInWithGoogle, signOut, getSession, onAuthChange, getMyCoupleId, createCouple, joinCouple, subscribeToUpdates } from "./supabase.js";
import supabase from "./supabase.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const APP_VERSION = "2.0.8";
const LAST_UPDATE = "2026-04-17";
const CHANGELOG = [
  { v:"2.0.8", date:"2026-04-17", notes:["Calendario: celdas responsivas (ResizeObserver, máximo espacio)", "Calendario: tareas multi-día ocupan todos los días según fecha+hora+duración","Calendario: compartir día / tarea / semana como imagen PNG (WhatsApp/descarga)","Calendario: editar participante al editar actividad inline","Nuevo usuario: pantalla en blanco (sin datos de ejemplo)","Top bar: emoji de pareja configurable (ajustes de perfil)","Tareas arrastradas: se marcan DONE en semana original con flag 'tarde' (no infla stats)","Stats AI: mínimo 5 misiones para considerar mejor/peor semana","Inicio: emoji de participante + tipo (tarea/evento) en cada fila de misiones","Filtros: secciones Participantes/Categorías diferenciadas + ordenar semana","Zoom móvil bloqueado (no queda pegado al hacer zoom in/out)","PWA: siempre carga versión más reciente (skipWaiting + networkFirst)"] },
  { v:"2.0.7", date:"2026-04-15", notes:["Emoji de pareja elegible desde Mi Perfil (24 opciones)", "Fix: menú lateral usa emoji elegido en vez de 💞 fijo","Fix: dropdown de tema en ProfileModal deja de cortarse (inline)","Fix: select de meta sin contraste blanco-sobre-blanco en Mac","Cursor: sin selección de texto accidental en escritorio","Stats: barras de semanas capeadas a 12 máximo","Nueva pestaña Pendientes en menú (todas las tareas no-DONE)","Inicio: layout 2 columnas en pantallas anchas (pendientes | eventos)","Compartir semana: imagen generada con Canvas + navigator.share/descarga"] },
  { v:"2.0.6", date:"2026-04-15", notes:["Fix: mensajes de sync (✓ al día / ⬆ subido / ⬇ actualizado / ⚠ error) ahora son toasts flotantes visibles siempre","Fix: error de Supabase también aparece como toast si no hay syncMsg activo","5 temas nuevos: Aurora Boreal (neon verde+magenta), Neón Tokyo (cyan+fucsia), Vino & Oro (burdeos+dorado), Mañana Clara (tema claro crema/blanco), Café Oscuro (chocolate+ámbar)","Sistema de colores de texto por tema (--t-text/muted/dim) — Mañana Clara tiene texto oscuro legible","Selector de tema cambiado de grid de tarjetas a dropdown desplegable con 10 temas listados","S.input, S.label, S.btnSecondary usan CSS vars de texto para adaptarse al tema claro"] },
  { v:"2.0.5", date:"2026-04-15", notes:["Menú lateral: pie siempre visible en móvil (solo versión + changelog, sin scroll)","Sincronización movida a ⚙️ dropdown (junto a Exportar/Importar/Cerrar sesión)","Sync muestra 'Sincronizando…' mientras está activo"] },
  { v:"2.0.4", date:"2026-04-15", notes:["Foto de pareja en home, menú lateral y perfil (crop circular 72px, JPEG)","Fotos individuales por persona en perfil (con previsualización de avatar)","5 temas visuales con fondos más saturados y contrastados","Tipografía propia por tema: Jakarta Sans / DM Sans / Nunito / Lato / Space Grotesk","Fuente se carga dinámicamente desde Google Fonts al cambiar tema","Hoja de ruta: v3.0 — modo individual + grupos de amigos (pendiente)"] },
  { v:"2.0.3", date:"2026-04-15", notes:["Rediseño UX: menú hamburguesa lateral con navegación","Página de inicio con resumen del día (hoy/mañana + semana)","Top bar persistente (☰ + 🏠 + ⚙️) adaptado a móvil/web","⚙️ abre dropdown: Mi perfil / Exportar / Importar / Cerrar sesión","ProfileModal: nombres, colores, fotos individuales y selector de tema","5 temas de color (Noche Violeta, Océano, Jardín, Atardecer, Obsidiana)","Versión y changelog movidos al pie del menú lateral"] },
  { v:"2.0.2", date:"2026-04-13", notes:["Stats: semana actual excluida de mejor/peor semana","Stats: botón ℹ en Participación por persona","Metas: campo 'Analizar desde' para ignorar períodos anteriores","Metas: historial muestra '–' para períodos sin datos","Objetivo épico integrado en cabecera de semana","Warning arrastrada muestra cuántas semanas lleva pendiente"] },
  { v:"2.0.1", date:"2026-04-13", notes:["Fix crítico: errores de Supabase ahora visibles en UI (antes silenciosos)","Import JSON sube datos a Supabase inmediatamente","Botón 🔄 sincroniza en ambas direcciones","localStorage por pareja (evita mezcla de datos entre usuarios)"] },
  { v:"2.0.0", date:"2026-04-08", notes:["Login con Google OAuth","Espacio privado por pareja con código compartido","Sincronización en tiempo real con Supabase Realtime","Backup automático en localStorage"] },
  { v:"1.9.3", date:"2026-04-06", notes:["P2: columna 'Sin fecha' eliminada, calendario vuelve a pantalla completa","Se mantiene edición inline de actividades desde el panel del día"] },
  { v:"1.9.2", date:"2026-04-05", notes:["Sin fecha: solo no-hechas, dedup por título+quién+emoji (semana más reciente)","Drag & drop corregido: onDragEnter + relatedTarget fix","Metas: ❌ en TODOS los períodos pasados no cumplidos","Stats: barras con escala absoluta 0-100%","Fecha de hoy bajo 'Semana X', botón nueva misión arriba"] },
  { v:"1.9.0", date:"2026-04-04", notes:["Fix guardado: debounce evita pérdidas de datos","Filtro de categoría global (persiste entre tabs)","Calendario: columna sin-fecha con drag & drop","Editar actividades directamente en calendario (sin salir)","Metas: períodos no cumplidos en rojo, cumplidos en verde"] },
  { v:"1.8.0", date:"2026-03-30", notes:["Categoría Viaje + multi-categoría por tarea/evento","Filtro global por persona persiste entre tabs","Metas: tipo Mínimo/Máximo","Countdown en segundos cuando queda <24h","Gráfico horas por categoría (trabajo en escala propia)","Filtro Esta semana en Historial","Meta enlazada: selector desplegable","Barras de progreso relativas","Insights más potentes"] },
  { v:"1.7.0", date:"2026-03-26", notes:["Filtro por persona en P1 y P2","Versión dorada con fecha y changelog","Editar estado desde P2","Tareas recurrentes (semanal/mensual)","Goals con countdown deadline","Stats rediseñado"] },
  { v:"1.6.0", date:"2026-03-25", notes:["Fix stats semanas futuras","Calendario navega a semana correcta","Distinción Tarea vs Evento","Distribuir eventos","Historial sin semanas futuras","Emojis con fondo en calendario"] },
];
const SEED_VERSION = 6;
const STATUS_ORDER = ["TBC", "ASAP", "IN_PROGRESS", "DONE"];
const STATUS = {
  TBC:         { label:"TBC",      icon:"⏳", color:"#94a3b8", bg:"rgba(148,163,184,0.12)", border:"rgba(148,163,184,0.3)" },
  ASAP:        { label:"ASAP",     icon:"🔥", color:"#fb923c", bg:"rgba(251,146,60,0.12)",  border:"rgba(251,146,60,0.3)"  },
  IN_PROGRESS: { label:"En curso", icon:"⚡", color:"#60a5fa", bg:"rgba(96,165,250,0.12)",  border:"rgba(96,165,250,0.3)"  },
  DONE:        { label:"Hecho",    icon:"✅", color:"#34d399", bg:"rgba(52,211,153,0.12)",  border:"rgba(52,211,153,0.3)"  },
};

const CATEGORIES = [
  { id:"pareja",  label:"Pareja",  icon:"💞", color:"#f472b6" },
  { id:"deporte", label:"Deporte", icon:"🏅", color:"#60a5fa" },
  { id:"casa",    label:"Casa",    icon:"🏠", color:"#a78bfa" },
  { id:"salud",   label:"Salud",   icon:"💊", color:"#34d399" },
  { id:"trabajo", label:"Trabajo", icon:"💼", color:"#fbbf24" },
  { id:"ocio",    label:"Ocio",    icon:"🎉", color:"#f97316" },
  { id:"social",  label:"Social",  icon:"🥂", color:"#e879f9" },
  { id:"viaje",   label:"Viaje",   icon:"✈️", color:"#38bdf8" },
];
const getMCats = m => m.categories?.length ? m.categories : (m.category ? [m.category] : []);
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

const EMOJI_GROUPS = [
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

const uid = () => Math.random().toString(36).slice(2, 9);
const isoWeekKey = (wn, yr) => `${yr}-W${String(wn).padStart(2,"0")}`;
const getWeekAndYear = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { week: Math.ceil((((d - ys) / 86400000) + 1) / 7), year: d.getUTCFullYear() };
};
const isTodayMonday = () => new Date().getDay() === 1;
const isoWeeksInYear = yr => getWeekAndYear(new Date(yr, 11, 28)).week;
const prevWeekFn = (wn, yr) => wn === 1 ? { wn: isoWeeksInYear(yr - 1), yr: yr - 1 } : { wn: wn - 1, yr };

// ─── Seed ─────────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = { person1: "Pololo", person2: "Banana", colors: { person1:"#f472b6", person2:"#a78bfa", together:"#34d399" } };
const DEFAULT_COLORS = { person1:"#f472b6", person2:"#a78bfa", together:"#34d399" };

const _DT = { text:"#f8f4ff", textMuted:"#8b7fa8", textDim:"#4a4166" }; // dark theme defaults
const THEMES = [
  // ── Oscuros originales ────────────────────────────────────────────────────
  {
    id:"violet", name:"Noche Violeta", preview:["#f472b6","#a78bfa","#34d399"],
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
    id:"ocean", name:"Océano Profundo", preview:["#22d3ee","#818cf8","#06b6d4"],
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
    id:"sage", name:"Jardín Botánico", preview:["#4ade80","#a3e635","#fbbf24"],
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
    id:"sunset", name:"Atardecer", preview:["#fb923c","#f43f5e","#fbbf24"],
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
    id:"obsidian", name:"Obsidiana", preview:["#e2e8f0","#94a3b8","#60a5fa"],
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
    id:"aurora", name:"Aurora Boreal", preview:["#00ff88","#ff00cc","#00d4ff"],
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
    id:"tokyo", name:"Neón Tokyo", preview:["#f0abfc","#22d3ee","#facc15"],
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
    id:"wine", name:"Vino & Oro", preview:["#be123c","#fbbf24","#f9a8d4"],
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
    id:"dawn", name:"Mañana Clara", preview:["#7c3aed","#f472b6","#10b981"],
    bg:"#f5f0ea",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(244,114,182,0.22) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(124,58,237,0.18) 0%,transparent 52%)",
    menuBg:"rgba(245,240,234,0.98)", topBarBg:"rgba(245,240,234,0.94)",
    card:"rgba(255,255,255,0.85)", cardBorder:"rgba(124,58,237,0.15)",
    btnGrad:"linear-gradient(135deg,#f472b6,#7c3aed)",
    accent:"#7c3aed", accentSoft:"rgba(124,58,237,0.1)",
    fontBody:"'Nunito',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap",
    text:"#1e0d3c", textMuted:"#6b5f88", textDim:"#9b8faa",
  },
  {
    id:"coffee", name:"Café Oscuro", preview:["#f59e0b","#92400e","#fde68a"],
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

const googleCalendarUrl = (mission, name1, name2) => {
  if (!mission.date) return null;
  const ds = mission.date.replace(/-/g, "");
  const who = mission.who==="person1"?name1:mission.who==="person2"?name2:`${name1} & ${name2}`;
  let dates;
  if (mission.time) {
    const [hh, mm] = mission.time.split(":").map(Number);
    const tot = hh*60 + mm + Math.round((mission.duration || mission.estimatedHours || 1)*60);
    const eh = String(Math.floor(tot/60)%24).padStart(2,"0"), em = String(tot%60).padStart(2,"0");
    dates = `${ds}T${String(hh).padStart(2,"0")}${String(mm).padStart(2,"0")}00/${ds}T${eh}${em}00`;
  } else {
    const nd = new Date(mission.date); nd.setDate(nd.getDate()+1);
    dates = `${ds}/${nd.toISOString().slice(0,10).replace(/-/g,"")}`;
  }
  const dur = mission.duration || mission.estimatedHours;
  const details = `Quién: ${who}${dur?` · ${dur}h`:""}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(mission.emoji+" "+mission.title)}&dates=${dates}&details=${encodeURIComponent(details)}`;
};
const mk = (id, emoji, title, status, completedAt=null) => ({
  id, emoji, title, status, createdAt: 1739059200000, completedAt,
  date: null, time: null, carriedFrom: null, carriedFromWeek: null,
  category: null, who: "together", duration: null, type: "task",
});

const { week: _seedWeek, year: _seedYear } = getWeekAndYear();
const SEED = {
  seedVersion: SEED_VERSION,
  currentWeekNumber: _seedWeek, currentYear: _seedYear,
  settings: DEFAULT_SETTINGS,
  goals: [],
  weeks: {},
};

// ─── Goal helpers ─────────────────────────────────────────────────────────────
const PERIOD_LABEL = { weekly:"Semanal", monthly:"Mensual", annual:"Anual" };
const PERIOD_EMOJI = { weekly:"📅", monthly:"🗓️", annual:"🎊" };

function computeGoalProgress(goal, weeks, cwn, cyr) {
  const now = new Date();
  const allDone = Object.values(weeks).flatMap(w =>
    (w.missions||[]).filter(m => m.goalId===goal.id && m.status==="DONE")
      .map(m => ({ ...m, wn:w.weekNumber, wy:w.year||cyr }))
  );
  let current = 0;
  if (goal.period==="weekly") {
    current = allDone.filter(m => m.wn===cwn && m.wy===cyr).length;
  } else if (goal.period==="monthly") {
    current = allDone.filter(m => {
      if (m.date) { const d=new Date(m.date); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); }
      const approx = new Date(m.wy, 0, 1+(m.wn-1)*7);
      return approx.getMonth()===now.getMonth()&&approx.getFullYear()===now.getFullYear();
    }).length;
  } else {
    current = allDone.filter(m => {
      if (m.date) return new Date(m.date).getFullYear()===now.getFullYear();
      return m.wy===now.getFullYear();
    }).length;
  }
  const isMax = goal.goalType==="max";
  // For max: met if current <= target; pct fills as you approach target (inverse)
  const pct = goal.target>0 ? (isMax ? Math.min((current/goal.target)*100,100) : Math.min((current/goal.target)*100,100)) : 0;
  return { current, target:goal.target, pct, isMax, met: isMax ? current<=goal.target : current>=goal.target };
}

function computeGoalHistory(goal, weeks) {
  const now = new Date();
  const allDone = Object.values(weeks).flatMap(w =>
    (w.missions||[]).filter(m => m.goalId===goal.id && m.status==="DONE")
      .map(m => ({ ...m, wn:w.weekNumber, wy:w.year||now.getFullYear() }))
  );
  const isMax = goal.goalType==="max";
  const startDate = goal.startDate ? new Date(goal.startDate) : null;
  const beforeStart = d => startDate && d < startDate;
  const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  if (goal.period==="weekly") {
    return Array.from({length:8},(_,i)=>{
      const d = new Date(now); d.setDate(d.getDate()-(7-i)*7);
      const { week:wn, year:wy } = getWeekAndYear(d);
      if (beforeStart(d)) return { label:`S${wn}`, count:0, met:false, isPast:i<7, noData:true };
      const isPast = i < 7;
      const count = allDone.filter(m=>m.wn===wn&&m.wy===wy).length;
      const met = isMax ? count<=goal.target : count>=goal.target;
      return { label:`S${wn}`, count, met, isPast };
    });
  } else if (goal.period==="monthly") {
    return Array.from({length:6},(_,i)=>{
      const d = new Date(now.getFullYear(), now.getMonth()-(5-i), 1);
      const mo=d.getMonth(), yr=d.getFullYear();
      if (beforeStart(d)) return { label:MONTHS_SHORT[mo], count:0, met:false, isPast:i<5, noData:true };
      const isPast = i < 5;
      const count = allDone.filter(m=>{
        if (m.date){const md=new Date(m.date);return md.getMonth()===mo&&md.getFullYear()===yr;}
        const approx=new Date(m.wy,0,1+(m.wn-1)*7);
        return approx.getMonth()===mo&&approx.getFullYear()===yr;
      }).length;
      const met = isMax ? count<=goal.target : count>=goal.target;
      return { label:MONTHS_SHORT[mo], count, met, isPast };
    });
  } else {
    return Array.from({length:4},(_,i)=>{
      const yr = now.getFullYear()-(3-i);
      const d = new Date(yr, 0, 1);
      if (beforeStart(d)) return { label:String(yr), count:0, met:false, isPast:i<3, noData:true };
      const isPast = i < 3;
      const count = allDone.filter(m=>{
        if(m.date)return new Date(m.date).getFullYear()===yr;
        return m.wy===yr;
      }).length;
      const met = isMax ? count<=goal.target : count>=goal.target;
      return { label:String(yr), count, met, isPast };
    });
  }
}

// ─── Carry-over ───────────────────────────────────────────────────────────────
function repairMisplacedMissions(data) {
  let weeks = { ...data.weeks };
  let moved = 0;
  for (const [key, week] of Object.entries(weeks)) {
    const keep = [], move = [];
    for (const m of (week.missions||[])) {
      if (!m.date) { keep.push(m); continue; }
      const { week:wn, year:yr } = getWeekAndYear(new Date(m.date));
      const targetKey = isoWeekKey(wn, yr);
      if (targetKey === key) { keep.push(m); }
      else { move.push({ m, targetKey, wn, yr }); }
    }
    if (!move.length) continue;
    weeks = { ...weeks, [key]: { ...week, missions: keep } };
    for (const { m, targetKey, wn, yr } of move) {
      const tw = weeks[targetKey] || { weekNumber:wn, year:yr, epicObjective:"", missions:[], createdAt:Date.now(), workHours:{person1:0,person2:0} };
      if (!tw.missions.find(x => x.id===m.id)) {
        weeks = { ...weeks, [targetKey]: { ...tw, missions:[...tw.missions, m] } };
        moved++;
      }
    }
  }
  return { data:{ ...data, weeks }, moved };
}
function applyCarryOver(data) {
  const { currentWeekNumber:cwn, currentYear:cyr } = data;
  const { wn:pwn, yr:pyr } = prevWeekFn(cwn, cyr);
  const prevKey = isoWeekKey(pwn, pyr), currKey = isoWeekKey(cwn, cyr);
  const prevW = data.weeks[prevKey]; if (!prevW) return data;
  const currW = data.weeks[currKey] || { weekNumber:cwn, year:cyr, epicObjective:"", missions:[], createdAt:Date.now(), workHours:{person1:0,person2:0} };
  const existingCarriedIds = new Set((currW.missions||[]).filter(m=>m.carriedFrom).map(m=>m.carriedFrom));
  const existingTitles = new Set((currW.missions||[]).map(m=>m.title));
  const toCarry = (prevW.missions||[]).filter(m => m.status!=="DONE" && !existingCarriedIds.has(m.id) && !existingTitles.has(m.title));
  // Recurring series: generate fresh instance for current week if not already there
  const allPrevSeries = (prevW.missions||[]).filter(m => m.seriesPattern && m.seriesId);
  const existingSeriesIds = new Set((currW.missions||[]).filter(m=>m.seriesId).map(m=>m.seriesId));
  const today = new Date();
  const isFirstWeekOfMonth = cwn === getWeekAndYear(new Date(today.getFullYear(), today.getMonth(), 1)).week;
  const newSeriesMissions = allPrevSeries.filter(m => {
    if (existingSeriesIds.has(m.seriesId)) return false;
    if (m.seriesPattern === "weekly") return true;
    if (m.seriesPattern === "monthly") return isFirstWeekOfMonth;
    return false;
  }).map(m => ({ ...m, id:uid(), carriedFrom:null, carriedFromWeek:null, date:null, createdAt:Date.now(), completedAt:null, status:"TBC" }));

  if (!toCarry.length && !newSeriesMissions.length) return data;
  const carried = toCarry.map(m => ({ ...m, id:uid(), carriedFrom:m.id, carriedFromWeek:prevKey, date:null, createdAt:Date.now(), completedAt:null, status:m.status==="ASAP"?"ASAP":"TBC" }));
  return { ...data, weeks: { ...data.weeks, [currKey]: { ...currW, missions:[...(currW.missions||[]), ...carried, ...newSeriesMissions] } } };
}
function syncCarryDone(data, weekKey, missionId) {
  const week = data.weeks[weekKey]; if (!week) return data;
  const mission = week.missions.find(m=>m.id===missionId);
  if (!mission?.carriedFrom || !mission?.carriedFromWeek) return data;
  const origWeek = data.weeks[mission.carriedFromWeek]; if (!origWeek) return data;
  return { ...data, weeks: { ...data.weeks, [mission.carriedFromWeek]: { ...origWeek, missions: origWeek.missions.map(m => m.id===mission.carriedFrom ? {...m, status:"DONE", completedAt:Date.now(), completedLate:true} : m) } } };
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  card:        { background:"var(--t-card,#1d1733)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.12))", borderRadius:14, padding:"14px 16px" },
  input:       { background:"rgba(128,128,128,0.08)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.25))", borderRadius:8, padding:"8px 12px", color:"var(--t-text,#f8f4ff)", fontSize:14, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" },
  inputSm:     { background:"rgba(128,128,128,0.08)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.2))", borderRadius:7, padding:"5px 8px", color:"var(--t-text,#f8f4ff)", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" },
  btnNav:      { background:"rgba(128,128,128,0.06)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.2))", borderRadius:8, color:"var(--t-accent,#a78bfa)", fontSize:22, width:38, height:38, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit", lineHeight:1, flexShrink:0 },
  btnPrimary:  { background:"var(--t-btn-grad,linear-gradient(135deg,#f472b6,#a78bfa))", border:"none", borderRadius:8, color:"#fff", padding:"7px 14px", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"inherit" },
  btnSecondary:{ background:"rgba(128,128,128,0.08)", border:"1px solid rgba(128,128,128,0.18)", borderRadius:8, color:"var(--t-text-muted,#8b7fa8)", padding:"7px 14px", cursor:"pointer", fontSize:13, fontFamily:"inherit" },
  label:       { fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:6, display:"block" },
};

// Injects CSS custom properties + loads Google Font for the active theme
function ThemeInjector({ themeId }) {
  // One-time: inject global cursor + user-select rules
  useEffect(() => {
    if (document.getElementById("global-cursor")) return;
    const s = document.createElement("style");
    s.id = "global-cursor";
    s.textContent = `*,*::before,*::after{user-select:none;-webkit-user-select:none}input,textarea,[contenteditable=true]{user-select:text;-webkit-user-select:text;cursor:text!important}button,a,select,label{cursor:pointer!important}`;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    const t = THEMES.find(x=>x.id===themeId) || THEMES[0];
    // Load theme font dynamically
    const LINK_ID = "theme-font";
    let link = document.getElementById(LINK_ID);
    if (t.googleFonts) {
      if (!link) { link = document.createElement("link"); link.id = LINK_ID; link.rel = "stylesheet"; document.head.appendChild(link); }
      link.href = t.googleFonts;
    } else if (link) {
      link.href = ""; // remove external font for built-in themes
    }
    // Apply CSS custom properties
    const r = document.documentElement.style;
    r.setProperty("--t-bg",          t.bg);
    r.setProperty("--t-bg-grad",     t.bgGrad);
    r.setProperty("--t-menu-bg",     t.menuBg);
    r.setProperty("--t-topbar-bg",   t.topBarBg);
    r.setProperty("--t-card",        t.card);
    r.setProperty("--t-card-border", t.cardBorder);
    r.setProperty("--t-btn-grad",    t.btnGrad);
    r.setProperty("--t-accent",      t.accent);
    r.setProperty("--t-accent-soft", t.accentSoft);
    r.setProperty("--t-font-body",   t.fontBody);
    r.setProperty("--t-text",        t.text      || "#f8f4ff");
    r.setProperty("--t-text-muted",  t.textMuted || "#8b7fa8");
    r.setProperty("--t-text-dim",    t.textDim   || "#4a4166");
  }, [themeId]);
  return null;
}
const badgeStyle = s => ({ background:STATUS[s].bg, color:STATUS[s].color, border:`1px solid ${STATUS[s].border}`, padding:"3px 8px", borderRadius:99, fontSize:11, fontWeight:600, fontFamily:"inherit", letterSpacing:0.3, cursor:"pointer", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:4 });
const catBadgeStyle = catId => { const c = CAT_MAP[catId]; if (!c) return {}; return { background:`${c.color}18`, color:c.color, border:`1px solid ${c.color}40`, padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600, display:"flex", alignItems:"center", gap:3, whiteSpace:"nowrap" }; };

// ─── App ──────────────────────────────────────────────────────────────────────
// ─── Auth wrapper ─────────────────────────────────────────────────────────────
export default function AppWithAuth() {
  const [session, setSession]       = useState(undefined); // undefined = loading
  const [coupleData, setCoupleData] = useState(null); // { couple_id, person_name }
  const [authStep, setAuthStep]     = useState("checking"); // checking | login | onboarding | app

  useEffect(() => {
    // Get initial session
    getSession().then(s => {
      setSession(s);
      if (!s) { setAuthStep("login"); return; }
      // Has session — check if in a couple
      getMyCoupleId().then(cd => {
        if (cd?.couple_id) { setCoupleData(cd); setAuthStep("app"); }
        else setAuthStep("onboarding");
      });
    });
    // Listen for auth changes
    const sub = onAuthChange(s => {
      setSession(s);
      if (!s) { setAuthStep("login"); setCoupleData(null); }
      else {
        getMyCoupleId().then(cd => {
          if (cd?.couple_id) { setCoupleData(cd); setAuthStep("app"); }
          else setAuthStep("onboarding");
        });
      }
    });
    return () => sub.unsubscribe();
  }, []);

  if (authStep === "checking") return (
    <div style={{ background:"#0a0714", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", color:"#f8f4ff", fontFamily:"system-ui" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:12 }}>💞</div>
        <div style={{ color:"#8b7fa8", fontSize:14 }}>Comprobando sesión...</div>
      </div>
    </div>
  );

  if (authStep === "login") return <LoginScreen />;
  if (authStep === "onboarding") return <OnboardingScreen session={session} onDone={cd => { setCoupleData(cd); setAuthStep("app"); }} />;
  return <CoupleMissions coupleId={coupleData?.couple_id} personName={coupleData?.person_name} onSignOut={() => { signOut(); setAuthStep("login"); }} />;
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen() {
  return (
    <div style={{ background:"#0a0714", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif", color:"#f8f4ff", padding:20 }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ textAlign:"center", maxWidth:340, width:"100%" }}>
        <div style={{ fontSize:64, marginBottom:16 }}>💞</div>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:32, fontWeight:700, marginBottom:8, letterSpacing:-1 }}>Misiones de Pareja</div>
        <div style={{ fontSize:14, color:"#8b7fa8", marginBottom:40, lineHeight:1.6 }}>Tu espacio privado para planificar<br/>la semana juntos</div>
        <button onClick={signInWithGoogle}
          style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, width:"100%", padding:"14px 20px", background:"#fff", border:"none", borderRadius:12, cursor:"pointer", fontSize:15, fontWeight:600, color:"#1a1a2e", fontFamily:"inherit", boxShadow:"0 4px 20px rgba(0,0,0,0.3)", transition:"transform 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
          onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Entrar con Google
        </button>
        <div style={{ fontSize:11, color:"#4a4166", marginTop:20, lineHeight:1.6 }}>
          Tus datos son privados y solo accesibles<br/>con tu código de pareja
        </div>
      </div>
    </div>
  );
}

// ─── Onboarding Screen ────────────────────────────────────────────────────────
function OnboardingScreen({ session, onDone }) {
  const [step, setStep]       = useState("choice"); // choice | create | join
  const [name, setName]       = useState(session?.user?.user_metadata?.full_name?.split(" ")[0] || "");
  const [code, setCode]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleCreate = async () => {
    if (!name.trim() || !code.trim()) return;
    setLoading(true); setError(null);
    const res = await createCouple(code.trim().toUpperCase(), name.trim());
    if (res.error) { setError(res.error); setLoading(false); return; }
    onDone({ couple_id: res.couple_id, person_name: name.trim() });
  };

  const handleJoin = async () => {
    if (!name.trim() || !code.trim()) return;
    setLoading(true); setError(null);
    const res = await joinCouple(code.trim().toUpperCase(), name.trim());
    if (res.error) { setError(res.error); setLoading(false); return; }
    onDone({ couple_id: res.couple_id, person_name: name.trim() });
  };

  const inputStyle = { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(167,139,250,0.25)", borderRadius:10, padding:"12px 14px", color:"#f8f4ff", fontSize:15, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box", letterSpacing:0.3 };
  const btnStyle = { background:"linear-gradient(135deg,#f472b6,#a78bfa)", border:"none", borderRadius:10, color:"#fff", padding:"13px", cursor:"pointer", fontSize:15, fontWeight:600, fontFamily:"inherit", width:"100%", opacity:loading?0.6:1 };
  const backBtn = { background:"none", border:"none", color:"#6b5f88", cursor:"pointer", fontSize:13, fontFamily:"inherit", marginBottom:20, padding:0 };

  return (
    <div style={{ background:"#0a0714", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif", color:"#f8f4ff", padding:20 }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ maxWidth:360, width:"100%" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:48, marginBottom:10 }}>💞</div>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:700 }}>¡Bienvenido/a!</div>
          <div style={{ fontSize:13, color:"#8b7fa8", marginTop:8 }}>
            {session?.user?.email && <span>Conectado como <strong style={{ color:"#a78bfa" }}>{session.user.email}</strong></span>}
          </div>
        </div>

        {step === "choice" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ fontSize:13, color:"#8b7fa8", textAlign:"center", marginBottom:8 }}>¿Qué quieres hacer?</div>
            <button onClick={() => setStep("create")}
              style={{ ...btnStyle, background:"linear-gradient(135deg,#f472b6,#a78bfa)" }}>
              ✨ Crear una pareja nueva
            </button>
            <button onClick={() => setStep("join")}
              style={{ ...btnStyle, background:"rgba(167,139,250,0.15)", border:"1px solid rgba(167,139,250,0.3)", color:"#c4b8ff" }}>
              🔗 Unirme a una pareja existente
            </button>
            <button onClick={() => signOut()} style={{ ...backBtn, marginTop:8, textAlign:"center", width:"100%", display:"block" }}>
              ← Cerrar sesión
            </button>
          </div>
        )}

        {step === "create" && (
          <div>
            <button onClick={() => { setStep("choice"); setError(null); }} style={backBtn}>← Volver</button>
            <div style={{ fontSize:14, color:"#8b7fa8", marginBottom:20 }}>
              Crea un espacio privado para vuestra pareja con un código único que compartiréis.
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", fontWeight:600, marginBottom:6 }}>Tu nombre</div>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej: Pololo 👑" style={inputStyle} />
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", fontWeight:600, marginBottom:6 }}>Código de pareja</div>
              <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="Ej: FRAN-ANA" maxLength={20} style={{ ...inputStyle, letterSpacing:2, textTransform:"uppercase" }} />
              <div style={{ fontSize:11, color:"#4a4166", marginTop:5 }}>Este código lo usará tu pareja para unirse. Elige algo memorable.</div>
            </div>
            {error && <div style={{ fontSize:13, color:"#fb923c", marginBottom:12, background:"rgba(251,146,60,0.1)", border:"1px solid rgba(251,146,60,0.25)", borderRadius:8, padding:"8px 12px" }}>{error}</div>}
            <button onClick={handleCreate} disabled={loading || !name.trim() || !code.trim()} style={btnStyle}>
              {loading ? "Creando..." : "🚀 Crear pareja"}
            </button>
          </div>
        )}

        {step === "join" && (
          <div>
            <button onClick={() => { setStep("choice"); setError(null); }} style={backBtn}>← Volver</button>
            <div style={{ fontSize:14, color:"#8b7fa8", marginBottom:20 }}>
              Tu pareja ya creó el espacio. Introduce el código que te compartió.
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", fontWeight:600, marginBottom:6 }}>Tu nombre</div>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej: Banana 🍌" style={inputStyle} />
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", fontWeight:600, marginBottom:6 }}>Código de pareja</div>
              <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="Ej: FRAN-ANA" maxLength={20} style={{ ...inputStyle, letterSpacing:2, textTransform:"uppercase" }} />
            </div>
            {error && <div style={{ fontSize:13, color:"#fb923c", marginBottom:12, background:"rgba(251,146,60,0.1)", border:"1px solid rgba(251,146,60,0.25)", borderRadius:8, padding:"8px 12px" }}>{error}</div>}
            <button onClick={handleJoin} disabled={loading || !name.trim() || !code.trim()} style={btnStyle}>
              {loading ? "Uniéndome..." : "🔗 Unirme a la pareja"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CoupleMissions({ coupleId, personName, onSignOut }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingError, setSavingError] = useState(false);
  const saveTimerRef = useRef(null);
  const [activeTab,       setActiveTab]       = useState("home");
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [showProfile,     setShowProfile]     = useState(false);
  const [settingsMenuOpen,setSettingsMenuOpen]= useState(false);
  const [importMsg,       setImportMsg]       = useState(null);
  const importFileRef = useRef(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newM, setNewM] = useState({ emoji:"🎯", title:"", status:"TBC", date:"", time:"", categories:[], who:"together", duration:"", goalId:null, type:"task", seriesPattern:"" });
  const [editObj, setEditObj] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [histWeekRange, setHistWeekRange] = useState("all");
  const [globalPersonFilter, setGlobalPersonFilter] = useState("all");
  const [globalCatFilter, setGlobalCatFilter] = useState([]); // [] = todas
  const [weekSort, setWeekSort] = useState("default"); // default | chrono | type | who | status
  const [showChangelog, setShowChangelog] = useState(false);
  const [lightboxSrc,   setLightboxSrc]   = useState(null);
  const [syncing, setSyncing]       = useState(false);
  const [syncError, setSyncError]   = useState(null);   // string | null
  const [syncMsg,   setSyncMsg]     = useState(null);   // feedback message

  const showSyncMsg = msg => { setSyncMsg(msg); setTimeout(() => setSyncMsg(null), 3000); };

  // Pull remote data; if Supabase has nothing, push local data up.
  const forceSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const remote = await loadData(coupleId);
      if (remote) {
        // Compare timestamps to know if we actually updated anything
        const remoteTs = remote.updatedAt || remote.currentWeekNumber;
        setData(prev => {
          const prevTs = prev?.updatedAt || prev?.currentWeekNumber;
          if (JSON.stringify(remote) === JSON.stringify(prev)) {
            showSyncMsg("✓ Ya estás al día");
          } else {
            showSyncMsg("⬇ Datos actualizados desde Supabase");
          }
          return remote;
        });
      } else {
        // No row in Supabase yet — push local data up
        setData(current => {
          if (current) {
            saveData(current, coupleId)
              .then(() => showSyncMsg("⬆ Datos subidos a Supabase"))
              .catch(e => { setSyncError(e.message); showSyncMsg("⚠ Error al subir"); });
          }
          return current;
        });
      }
    } catch (e) {
      setSyncError(e.message);
      showSyncMsg("⚠ Error de conexión");
    }
    setSyncing(false);
  };

  useEffect(() => {
    (async () => {
      try {
        let base = await loadData(coupleId);
        let isRealData = !!base; // true = came from Supabase or real local backup

        if (base) {
          if (!base.seedVersion || base.seedVersion < SEED_VERSION) {
            base = { ...SEED, settings: base.settings || SEED.settings, goals: base.goals || SEED.goals, weeks: { ...SEED.weeks, ...base.weeks }, seedVersion: SEED_VERSION };
          }
        } else {
          // No data from Supabase – check couple-specific local backup (with old-key migration)
          const local = loadLocalBackup(coupleId);
          if (local && local.data && local.data.weeks && Object.keys(local.data.weeks).length > 1) {
            base = local.data;
            isRealData = true;
          } else {
            base = { ...SEED };
            isRealData = false; // only SEED – do NOT overwrite Supabase with this
          }
        }

        if (!base.settings) base.settings = DEFAULT_SETTINGS;
        if (!base.goals) base.goals = SEED.goals;
        if (isTodayMonday()) base = applyCarryOver(base);
        setData(base);

        // Only push to Supabase if we have real data – never overwrite with SEED
        if (isRealData) await saveData(base, coupleId);
      } catch(e) {
        console.error(e);
        setError("No se pudo conectar con la base de datos. Comprueba tu conexión.");
        setData({ ...SEED });
      }
      setLoading(false);
    })();
  }, []);

  // Realtime: reload when partner saves
  useEffect(() => {
    if (!coupleId) return;
    const channel = subscribeToUpdates(coupleId, remoteData => {
      if (remoteData) {
        setData(prev => {
          // Only update if remote is newer (avoid overwriting own unsaved changes)
          if (!prev) return remoteData;
          return remoteData;
        });
      }
    });
    return () => { supabase.removeChannel(channel); };
  }, [coupleId]);

  const update = useCallback(fn => {
    setData(prev => {
      const next = fn(prev);
      // Debounced save: 700ms after last change
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        setSaving(true);
        setSavingError(false);
        saveData(next, coupleId)
          .then(() => { setSaved(true); setSyncError(null); setTimeout(() => setSaved(false), 1800); })
          .catch(e => { console.error("Supabase save failed:", e.message); setSavingError(true); setSyncError(e.message); setTimeout(() => setSavingError(false), 6000); })
          .finally(() => setSaving(false));
      }, 700);
      return next;
    });
  }, [coupleId]);

  if (loading) return (
    <div style={{ background:"#0a0714", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", color:"#f8f4ff", fontFamily:"system-ui" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:12 }}>💞</div>
        <div style={{ color:"#8b7fa8", fontSize:14 }}>Cargando misiones...</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ background:"#0a0714", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", color:"#f8f4ff", fontFamily:"system-ui", padding:20 }}>
      <div style={{ textAlign:"center", maxWidth:340 }}>
        <div style={{ fontSize:48, marginBottom:12 }}>⚠️</div>
        <div style={{ color:"#fb923c", fontSize:14, marginBottom:16 }}>{error}</div>
        <button onClick={() => window.location.reload()} style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:8, color:"#f8f4ff", padding:"8px 20px", cursor:"pointer", fontFamily:"inherit" }}>Reintentar</button>
      </div>
    </div>
  );

  const p1 = data.settings?.person1 || "Pololo";
  const p2 = data.settings?.person2 || "Banana";
  const colors = { ...DEFAULT_COLORS, ...(data.settings?.colors||{}) };
  const themeId = data.settings?.themeId || "violet";
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importData(file);
      update(() => imported);
      setImportMsg("✅ Datos restaurados correctamente");
      setTimeout(() => setImportMsg(null), 2500);
    } catch (err) { setImportMsg("❌ " + err.message); setTimeout(() => setImportMsg(null), 3500); }
    e.target.value = "";
  };
  const wkey = isoWeekKey(data.currentWeekNumber, data.currentYear);
  const week = data.weeks[wkey] || { weekNumber:data.currentWeekNumber, year:data.currentYear, epicObjective:"", missions:[], createdAt:Date.now(), workHours:{person1:0,person2:0} };
  const patchWeek = fn => update(d => ({ ...d, weeks: { ...d.weeks, [wkey]: fn(d.weeks[wkey] || week) } }));

  const addMission = () => {
    if (!newM.title.trim()) return;
    const sid = newM.seriesPattern ? (newM.seriesId||uid()) : null;
    patchWeek(w => ({ ...w, missions:[...(w.missions||[]), { id:uid(), emoji:newM.emoji, title:newM.title.trim(), status:newM.status, date:newM.date||null, time:newM.time||null, createdAt:Date.now(), completedAt:null, carriedFrom:null, carriedFromWeek:null, categories:newM.categories||[], who:newM.who, duration:newM.duration?parseFloat(newM.duration):null, goalId:newM.goalId||null, type:newM.type||"task", seriesPattern:newM.seriesPattern||null, seriesId:sid }] }));
    setNewM({ emoji:"🎯", title:"", status:"TBC", date:"", time:"", categories:[], who:"together", duration:"", goalId:null, type:"task", seriesPattern:"" });
    setShowAddForm(false);
  };

  const cycleStatus = id => {
    update(d => {
      const w = d.weeks[wkey]; if (!w) return d;
      const m = w.missions.find(x=>x.id===id);
      const nx = STATUS_ORDER[(STATUS_ORDER.indexOf(m.status)+1)%STATUS_ORDER.length];
      let next = { ...d, weeks: { ...d.weeks, [wkey]: { ...w, missions: w.missions.map(x => x.id===id ? {...x, status:nx, completedAt:nx==="DONE"?Date.now():null} : x) } } };
      if (nx==="DONE" && m.carriedFrom) next = syncCarryDone(next, wkey, id);
      return next;
    });
  };

  const delMission = id => patchWeek(w => ({ ...w, missions:w.missions.filter(m=>m.id!==id) }));
  const patchM = (id, patch) => patchWeek(w => ({ ...w, missions:w.missions.map(m=>m.id===id?{...m,...patch}:m) }));
  const changeWeek = d => update(s => { let wn=s.currentWeekNumber+d,yr=s.currentYear; if(wn>isoWeeksInYear(yr)){wn=1;yr++;} if(wn<1){yr--;wn=isoWeeksInYear(yr);} return {...s,currentWeekNumber:wn,currentYear:yr}; });
  const { week:todayWeek, year:todayYear } = getWeekAndYear();
  const isCurrentWeek = data.currentWeekNumber===todayWeek && data.currentYear===todayYear;
  const goToToday = () => { update(s=>({...s,currentWeekNumber:todayWeek,currentYear:todayYear})); setActiveTab("current"); };
  const runCarryOver = () => update(d => applyCarryOver(d));
  const cycleStatusGlobal = (wn, yr, id) => {
    const key = isoWeekKey(wn, yr);
    update(d => {
      const w = d.weeks[key]; if (!w) return d;
      const m = w.missions.find(x=>x.id===id); if (!m) return d;
      const nx = STATUS_ORDER[(STATUS_ORDER.indexOf(m.status)+1)%STATUS_ORDER.length];
      return { ...d, weeks: { ...d.weeks, [key]: { ...w, missions: w.missions.map(x=>x.id===id?{...x,status:nx,completedAt:nx==="DONE"?Date.now():null}:x) } } };
    });
  };
  const patchMissionGlobal = (wn, yr, id, patch) => {
    const key = isoWeekKey(wn, yr);
    update(d => {
      const w = d.weeks[key]; if (!w) return d;
      return { ...d, weeks: { ...d.weeks, [key]: { ...w, missions: w.missions.map(x=>x.id===id?{...x,...patch}:x) } } };
    });
  };
  const deleteMissionGlobal = (wn, yr, id) => {
    const key = isoWeekKey(wn, yr);
    update(d => {
      const w = d.weeks[key]; if (!w) return d;
      return { ...d, weeks: { ...d.weeks, [key]: { ...w, missions: w.missions.filter(x=>x.id!==id) } } };
    });
  };
  const runRepair = () => {
    update(d => {
      const { data: fixed, moved } = repairMisplacedMissions(d);
      if (moved === 0) alert("✅ Todo en orden — ningún evento fuera de su semana.");
      else alert(`✅ ${moved} evento${moved>1?"s":""} reubicado${moved>1?"s":""} a su semana correcta.`);
      return fixed;
    });
  };

  const patchGoals = fn => update(d => ({ ...d, goals: fn(d.goals||[]) }));
  const addGoal = g => patchGoals(gs => [...gs, { ...g, id:uid(), active:true, createdAt:Date.now() }]);
  const updateGoal = (id, patch) => patchGoals(gs => gs.map(g => g.id===id ? {...g,...patch} : g));
  const deleteGoal = id => patchGoals(gs => gs.filter(g => g.id!==id));

  const compressImage = (file) => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const maxPx = 800;
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  const downloadWeekICS = (weekData, weekKey, name1, name2) => {
    const missions = weekData.missions || [];
    const dated = missions.filter(m => m.date);
    if (dated.length === 0) {
      alert("No hay misiones con fecha en esta semana. Abre cada misión, pulsa en ella y asigna una fecha para poder exportarla al calendario.");
      return;
    }
    const stamp = new Date().toISOString().replace(/[-:.]/g,"").slice(0,15)+"Z";
    const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Misiones Pareja//ES","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
    for (const m of dated) {
      const who = m.who==="person1"?name1:m.who==="person2"?name2:`${name1} & ${name2}`;
      const ds = m.date.replace(/-/g,"");
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${m.id}-${Date.now()}@misiones-pareja`);
      lines.push(`DTSTAMP:${stamp}`);
      if (m.time) {
        const ts = m.time.replace(":","")+"00";
        lines.push(`DTSTART:${ds}T${ts}`);
        const [hh,mm] = m.time.split(":").map(Number);
        const tot = hh*60+mm+Math.round((m.duration||m.estimatedHours||1)*60);
        const eh = String(Math.floor(tot/60)%24).padStart(2,"0"), em = String(tot%60).padStart(2,"0");
        lines.push(`DTEND:${ds}T${eh}${em}00`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${ds}`);
        const nd = new Date(m.date); nd.setDate(nd.getDate()+1);
        lines.push(`DTEND;VALUE=DATE:${nd.toISOString().slice(0,10).replace(/-/g,"")}`);
      }
      lines.push(`SUMMARY:${m.emoji} ${m.title}`);
      const parts = [`Semana ${weekData.weekNumber}`,`Estado: ${STATUS[m.status]?.label||m.status}`,`Quién: ${who}`];
      if (m.duration||m.estimatedHours) parts.push(`Duración: ${m.duration||m.estimatedHours}h`);
      lines.push(`DESCRIPTION:${parts.join("\\n")}`);
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type:"text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`misiones-${weekKey}.ics`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadWeekPDF = (weekData, weekKey, name1, name2) => {
    const missions = weekData.missions || [];
    const done = missions.filter(m=>m.status==="DONE").length;
    const sorted = [...missions].sort((a,b)=>{ if(a.date&&b.date) return (a.date+(a.time||""))>(b.date+(b.time||""))?1:-1; if(a.date)return -1; if(b.date)return 1; return 0; });
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Misiones Semana ${weekData.weekNumber}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#fff;color:#1a1a2e;max-width:720px;margin:0 auto;padding:40px 32px}
h1{font-size:30px;font-weight:700;color:#6d28d9;margin-bottom:4px}
.meta{color:#888;font-size:13px;margin-bottom:20px}
.obj{background:#f5f0ff;border-left:4px solid #a78bfa;padding:10px 16px;border-radius:8px;margin-bottom:20px;font-style:italic;color:#4c1d95;font-size:15px}
.kpis{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap}
.kpi{background:#f8f4ff;padding:14px 20px;border-radius:12px;text-align:center;flex:1;min-width:80px}
.kpi-n{font-size:26px;font-weight:700;color:#7c3aed}
.kpi-l{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:2px}
.progress{background:#e9d5ff;border-radius:99px;height:8px;margin-bottom:24px;overflow:hidden}
.progress-bar{height:100%;background:linear-gradient(90deg,#7c3aed,#ec4899);border-radius:99px}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;padding:8px 10px;border-bottom:2px solid #f0e8ff}
td{padding:12px 10px;border-bottom:1px solid #f8f4ff;vertical-align:top}
.emoji{font-size:20px}
.title{font-size:14px;font-weight:600;color:#1a1a2e}
.title.done{text-decoration:line-through;color:#aaa}
.detail{font-size:12px;color:#888;margin-top:3px}
.badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600}
.DONE{background:#d1fae5;color:#065f46}
.ASAP{background:#ffedd5;color:#9a3412}
.IN_PROGRESS{background:#dbeafe;color:#1e40af}
.TBC{background:#f1f5f9;color:#475569}
.footer{margin-top:32px;text-align:center;font-size:11px;color:#ccc;border-top:1px solid #f0e8ff;padding-top:16px}
@media print{body{padding:20px}button{display:none!important}}
</style></head><body>
<h1>💞 Semana ${weekData.weekNumber} · ${weekData.year||new Date().getFullYear()}</h1>
<div class="meta">${name1} & ${name2} · Generado el ${new Date().toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
${weekData.epicObjective?`<div class="obj">🎯 ${weekData.epicObjective}</div>`:""}
<div class="kpis">
  <div class="kpi"><div class="kpi-n">${missions.length}</div><div class="kpi-l">Misiones</div></div>
  <div class="kpi"><div class="kpi-n">${done}</div><div class="kpi-l">Hechas</div></div>
  <div class="kpi"><div class="kpi-n">${missions.length>0?Math.round((done/missions.length)*100):0}%</div><div class="kpi-l">Progreso</div></div>
  ${missions.filter(m=>m.date).length>0?`<div class="kpi"><div class="kpi-n">${missions.filter(m=>m.date).length}</div><div class="kpi-l">Con fecha</div></div>`:""}
</div>
<div class="progress"><div class="progress-bar" style="width:${missions.length>0?Math.round((done/missions.length)*100):0}%"></div></div>
<table>
<thead><tr><th style="width:36px"></th><th>Misión</th><th>Cuándo</th><th>Quién</th><th>Estado</th></tr></thead>
<tbody>
${sorted.map(m=>{
  const who=m.who==="person1"?name1:m.who==="person2"?name2:"Juntos";
  const when=m.date?(m.time?`${m.date} ${m.time}`:m.date):"Sin fecha";
  const dur = m.duration||m.estimatedHours;
  return `<tr><td class="emoji">${m.emoji}</td><td><div class="title${m.status==="DONE"?" done":""}">${m.title}</div>${dur?`<div class="detail">⏱ ${dur}h</div>`:""}</td><td style="font-size:13px;color:#555">${when}</td><td style="font-size:13px;color:#555">${who}</td><td><span class="badge ${m.status}">${STATUS[m.status]?.icon||""} ${STATUS[m.status]?.label||m.status}</span></td></tr>`;
}).join("")}
</tbody></table>
<div class="footer">💞 Misiones de Pareja · misiones-pareja.netlify.app</div>
</body></html>`;
    const win = window.open("","_blank");
    win.document.write(html);
    win.document.close();
    setTimeout(()=>win.print(),600);
  };

  const downloadFilteredPDF = (weekEntries, personFilter, name1, name2) => {
    const personLabel = personFilter==="all"?`${name1} & ${name2}`:personFilter==="person1"?name1:personFilter==="person2"?name2:"Juntos";
    const allMissions = weekEntries.flatMap(([,w]) => {
      const ms = personFilter==="all" ? (w.missions||[]) : (w.missions||[]).filter(m=>m.who===personFilter);
      return ms.map(m=>({...m, weekNumber:w.weekNumber, _year:w.year, _obj:w.epicObjective}));
    });
    if (!allMissions.length) { alert("No hay misiones para los filtros seleccionados."); return; }
    const sorted = [...allMissions].sort((a,b)=>{
      if(a.weekNumber!==b.weekNumber) return a.weekNumber-b.weekNumber;
      if(a.date&&b.date) return (a.date+(a.time||""))>(b.date+(b.time||""))?1:-1;
      if(a.date)return -1; if(b.date)return 1; return 0;
    });
    const doneCount = allMissions.filter(m=>m.status==="DONE").length;
    const total = allMissions.length;
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Misiones - ${personLabel}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#fff;color:#1a1a2e;max-width:720px;margin:0 auto;padding:40px 32px}
h1{font-size:28px;font-weight:700;color:#6d28d9;margin-bottom:4px}
.meta{color:#888;font-size:13px;margin-bottom:20px}
.kpis{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.kpi{background:#f8f4ff;padding:12px 18px;border-radius:12px;text-align:center;flex:1;min-width:70px}
.kpi-n{font-size:22px;font-weight:700;color:#7c3aed}
.kpi-l{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:2px}
.week-header{background:#f5f0ff;border-left:4px solid #a78bfa;padding:8px 14px;border-radius:6px;margin:18px 0 10px;font-weight:600;color:#4c1d95;font-size:14px}
table{width:100%;border-collapse:collapse;margin-bottom:8px}
th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#999;padding:6px 8px;border-bottom:2px solid #f0e8ff}
td{padding:10px 8px;border-bottom:1px solid #f8f4ff;vertical-align:top}
.badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600}
.DONE{background:#d1fae5;color:#065f46}.ASAP{background:#ffedd5;color:#9a3412}.IN_PROGRESS{background:#dbeafe;color:#1e40af}.TBC{background:#f1f5f9;color:#475569}
.footer{margin-top:28px;text-align:center;font-size:11px;color:#ccc;border-top:1px solid #f0e8ff;padding-top:14px}
@media print{body{padding:20px}}
</style></head><body>
<h1>💞 Misiones — ${personLabel}</h1>
<div class="meta">${weekEntries.length} semana${weekEntries.length!==1?"s":""} · Generado el ${new Date().toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-n">${total}</div><div class="kpi-l">Misiones</div></div>
  <div class="kpi"><div class="kpi-n">${doneCount}</div><div class="kpi-l">Hechas</div></div>
  <div class="kpi"><div class="kpi-n">${total>0?Math.round((doneCount/total)*100):0}%</div><div class="kpi-l">Progreso</div></div>
</div>
${weekEntries.map(([,w])=>{
  const ms = personFilter==="all"?(w.missions||[]):(w.missions||[]).filter(m=>m.who===personFilter);
  if(!ms.length) return "";
  const who2=m2=>m2.who==="person1"?name1:m2.who==="person2"?name2:"Juntos";
  return `<div class="week-header">Semana ${w.weekNumber}${w.epicObjective?` · "${w.epicObjective}"`:""}  — ${ms.filter(m=>m.status==="DONE").length}/${ms.length}</div>
<table><thead><tr><th></th><th>Misión</th><th>Cuándo</th><th>Quién</th><th>Estado</th></tr></thead><tbody>
${ms.map(m=>{
  const whenStr=m.date?(m.time?`${m.date} ${m.time}`:m.date):"Sin fecha";
  return `<tr><td style="font-size:18px">${m.emoji}</td><td style="font-size:13px;font-weight:600;color:${m.status==="DONE"?"#aaa":"#1a1a2e"};text-decoration:${m.status==="DONE"?"line-through":"none"}">${m.title}</td><td style="font-size:12px;color:#666">${whenStr}</td><td style="font-size:12px;color:#666">${who2(m)}</td><td><span class="badge ${m.status}">${STATUS[m.status]?.icon||""} ${STATUS[m.status]?.label||m.status}</span></td></tr>`;
}).join("")}
</tbody></table>`;
}).join("")}
<div class="footer">💞 Misiones de Pareja · misiones-pareja.netlify.app</div>
</body></html>`;
    const win = window.open("","_blank");
    win.document.write(html);
    win.document.close();
    setTimeout(()=>win.print(),600);
  };

  const done = week.missions?.filter(m=>m.status==="DONE").length||0;
  const total = week.missions?.length||0;
  const carriedCount = week.missions?.filter(m=>m.carriedFrom).length||0;

  const pct = total>0?(done/total)*100:0;
  const carried = week.missions?.filter(m=>m.carriedFrom)||[];
  const sortedWeeks = Object.entries(data.weeks).sort((a,b)=>b[0].localeCompare(a[0]));
  const allDated = Object.entries(data.weeks).flatMap(([key,w])=>(w.missions||[]).filter(m=>m.date).map(m=>({...m,weekNumber:w.weekNumber,_yr:parseInt(key.split("-W")[0])||w.year||new Date().getFullYear()})));
  const allUndated = Object.entries(data.weeks).flatMap(([key,w])=>(w.missions||[]).filter(m=>!m.date&&m.status!=="DONE").map(m=>({...m,weekNumber:w.weekNumber,_yr:parseInt(key.split("-W")[0])||w.year||new Date().getFullYear(),_key:key})));

  return (
    <div style={{ minHeight:"100vh", background:"var(--t-bg,#0a0714)", backgroundImage:"var(--t-bg-grad)", fontFamily:"var(--t-font-body,'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif)", color:"var(--t-text,#f8f4ff)" }}>
      <ThemeInjector themeId={themeId} />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Hidden file input for import */}
      <input ref={importFileRef} type="file" accept=".json" onChange={handleImport} style={{ display:"none" }} />
      {importMsg && <div style={{ position:"fixed", bottom:90, left:"50%", transform:"translateX(-50%)", background:importMsg.startsWith("✅")?"rgba(52,211,153,0.15)":"rgba(251,146,60,0.15)", border:`1px solid ${importMsg.startsWith("✅")?"rgba(52,211,153,0.4)":"rgba(251,146,60,0.4)"}`, borderRadius:12, padding:"10px 20px", zIndex:400, fontSize:13, color:importMsg.startsWith("✅")?"#34d399":"#fb923c", whiteSpace:"nowrap", backdropFilter:"blur(8px)" }}>{importMsg}</div>}
      {syncMsg  && <div style={{ position:"fixed", bottom:syncMsg&&importMsg?130:90, left:"50%", transform:"translateX(-50%)", background:syncMsg.startsWith("⚠")?"rgba(251,146,60,0.15)":syncMsg.startsWith("✓")||syncMsg.startsWith("⬆")||syncMsg.startsWith("⬇")?"rgba(52,211,153,0.15)":"rgba(96,165,250,0.15)", border:`1px solid ${syncMsg.startsWith("⚠")?"rgba(251,146,60,0.4)":syncMsg.startsWith("✓")||syncMsg.startsWith("⬆")||syncMsg.startsWith("⬇")?"rgba(52,211,153,0.4)":"rgba(96,165,250,0.4)"}`, borderRadius:12, padding:"10px 20px", zIndex:400, fontSize:13, color:syncMsg.startsWith("⚠")?"#fb923c":syncMsg.startsWith("✓")||syncMsg.startsWith("⬆")||syncMsg.startsWith("⬇")?"#34d399":"#60a5fa", whiteSpace:"nowrap", backdropFilter:"blur(8px)" }}>{syncMsg}</div>}
      {syncError && !syncMsg && <div style={{ position:"fixed", bottom:90, left:"50%", transform:"translateX(-50%)", background:"rgba(251,146,60,0.12)", border:"1px solid rgba(251,146,60,0.35)", borderRadius:12, padding:"8px 16px", zIndex:400, fontSize:12, color:"#fb923c", maxWidth:300, textAlign:"center", backdropFilter:"blur(8px)" }}>⚠ {syncError.slice(0,80)}</div>}

      {showProfile && <ProfileModal data={data} update={update} onClose={()=>setShowProfile(false)} />}

      {/* Changelog modal */}
      {showChangelog && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={()=>setShowChangelog(false)}>
          <div style={{ background:"#1d1733", border:"1px solid rgba(251,191,36,0.3)", borderRadius:18, padding:24, width:"100%", maxWidth:420, maxHeight:"80vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <span style={{ fontFamily:"'Fraunces',serif", fontSize:20, color:"#fbbf24" }}>📋 Changelog</span>
              <button onClick={()=>setShowChangelog(false)} style={{ background:"none", border:"none", color:"#6b5f88", fontSize:20, cursor:"pointer" }}>×</button>
            </div>
            {CHANGELOG.map(c=>(
              <div key={c.v} style={{ marginBottom:16 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"#fbbf24" }}>v{c.v}</span>
                  <span style={{ fontSize:11, color:"#4a4166" }}>{c.date}</span>
                </div>
                <ul style={{ margin:0, padding:"0 0 0 16px" }}>
                  {c.notes.map((n,i)=><li key={i} style={{ fontSize:12, color:"#8b7fa8", marginBottom:3 }}>{n}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Slide-out menu backdrop */}
      {menuOpen && <div onClick={()=>setMenuOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:90, backdropFilter:"blur(3px)", WebkitBackdropFilter:"blur(3px)" }} />}

      {/* Slide-out menu */}
      <div style={{ position:"fixed", top:0, left:0, bottom:0, width:248, background:"var(--t-menu-bg,rgba(12,8,26,0.97))", borderRight:"1px solid var(--t-card-border,rgba(167,139,250,0.1))", zIndex:100, transform:menuOpen?"translateX(0)":"translateX(-100%)", transition:"transform 0.26s cubic-bezier(0.4,0,0.2,1)", display:"flex", flexDirection:"column", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)" }}>
        {/* Menu header */}
        <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid var(--t-card-border,rgba(167,139,250,0.07))", display:"flex", alignItems:"center", gap:12 }}>
          {data.settings?.photos?.couple
            ? <img src={data.settings.photos.couple} style={{ width:44, height:44, borderRadius:99, objectFit:"cover", border:"2px solid var(--t-accent,#a78bfa)", flexShrink:0 }} alt="pareja" />
            : <div style={{ width:44, height:44, borderRadius:99, background:"var(--t-accent-soft,rgba(167,139,250,0.1))", border:"1px solid var(--t-card-border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{data.settings?.coupleEmoji||"💞"}</div>
          }
          <div>
            <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", letterSpacing:1.5, textTransform:"uppercase" }}>Misiones de Pareja</div>
            <div style={{ fontSize:14, color:"var(--t-accent,#c4b8ff)", fontWeight:600, marginTop:1 }}>{p1} & {p2}</div>
          </div>
        </div>
        {/* Nav items */}
        <nav style={{ flex:1, padding:"10px 8px", display:"flex", flexDirection:"column", gap:2, overflowY:"auto" }}>
          {[
            { id:"home",     label:"Inicio",      icon:"🏠" },
            { id:"current",  label:"Semana",       icon:"🎯" },
            { id:"calendar", label:"Calendario",   icon:"📅" },
            { id:"history",  label:"Histórico",    icon:"🗂️" },
            { id:"goals",    label:"Metas",        icon:"🏅" },
            { id:"stats",    label:"Stats",        icon:"📊" },
          ].map(n => (
            <button key={n.id} onClick={()=>{ setActiveTab(n.id); setMenuOpen(false); }}
              style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:10, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:activeTab===n.id?600:400, background:activeTab===n.id?"var(--t-accent-soft,rgba(167,139,250,0.14))":"transparent", color:activeTab===n.id?"var(--t-accent,#c4b8ff)":"var(--t-text-muted,#6b5f88)", textAlign:"left", width:"100%", transition:"all 0.15s", position:"relative" }}>
              <span style={{ fontSize:17, lineHeight:1 }}>{n.icon}</span>
              <span style={{ flex:1 }}>{n.label}</span>
              {activeTab===n.id && <span style={{ width:5, height:5, borderRadius:99, background:"var(--t-accent,#a78bfa)", flexShrink:0 }} />}
            </button>
          ))}
        </nav>
        {/* Menu footer: version only — always visible, no scroll needed */}
        <div style={{ padding:"12px 16px", borderTop:"1px solid var(--t-card-border,rgba(167,139,250,0.07))", flexShrink:0 }}>
          {syncMsg && <div style={{ fontSize:10, color:syncMsg.startsWith("⚠")?"#fb923c":syncMsg.startsWith("✓")?"#34d399":"#60a5fa", marginBottom:6, lineHeight:1.4 }}>{syncMsg}</div>}
          <button onClick={()=>{ setShowChangelog(true); setMenuOpen(false); }}
            style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 0", display:"flex", gap:8, alignItems:"center", width:"100%" }}>
            <span style={{ fontSize:11, fontWeight:700, color:"#fbbf24", letterSpacing:0.5, textShadow:"0 0 8px rgba(251,191,36,0.35)" }}>v{APP_VERSION}</span>
            <span style={{ fontSize:10, color:"#3d3360" }}>{LAST_UPDATE}</span>
            <span style={{ fontSize:10, color:"#3d3360", marginLeft:"auto" }}>Ver cambios →</span>
          </button>
        </div>
      </div>

      {/* ── Sticky top bar ── */}
      <div style={{ position:"sticky", top:0, zIndex:80, background:"var(--t-topbar-bg,rgba(10,7,20,0.9))", backdropFilter:"blur(14px)", WebkitBackdropFilter:"blur(14px)", borderBottom:"1px solid var(--t-card-border,rgba(167,139,250,0.08))", padding:"0 12px", height:52, display:"flex", alignItems:"center", gap:8 }}>
        {/* Hamburger */}
        <button onClick={()=>setMenuOpen(v=>!v)} aria-label="Menú"
          style={{ background:"none", border:"none", cursor:"pointer", color:"#8b7fa8", padding:"8px 6px", display:"flex", flexDirection:"column", gap:4, alignItems:"center", justifyContent:"center", flexShrink:0, borderRadius:8 }}>
          <span style={{ display:"block", width:18, height:1.5, background:"currentColor", borderRadius:99 }} />
          <span style={{ display:"block", width:13, height:1.5, background:"currentColor", borderRadius:99 }} />
          <span style={{ display:"block", width:18, height:1.5, background:"currentColor", borderRadius:99 }} />
        </button>
        {/* Home button */}
        <button onClick={()=>setActiveTab("home")} aria-label="Inicio"
          style={{ background:"none", border:"none", cursor:"pointer", color:activeTab==="home"?"#c4b8ff":"#4a4166", fontSize:18, padding:"6px 5px", lineHeight:1, borderRadius:8, flexShrink:0, transition:"color 0.15s" }}>🏠</button>
        {/* Page title */}
        <div style={{ flex:1, textAlign:"center" }}>
          <span style={{ fontSize:13, fontWeight:500, color:"#8b7fa8" }}>
            {activeTab==="home"     ? `${data.settings?.coupleEmoji||"💞"} ${p1} & ${p2}`
            :activeTab==="current"  ? `🎯 Semana ${data.currentWeekNumber}`
            :activeTab==="calendar" ? "📅 Calendario"
            :activeTab==="history"  ? "🗂️ Histórico"
            :activeTab==="goals"    ? "🏅 Metas"
            :activeTab==="stats"    ? "📊 Stats"
            : ""}
          </span>
        </div>
        {/* Settings dropdown trigger */}
        <div style={{ position:"relative", flexShrink:0 }}>
          <button onClick={()=>setSettingsMenuOpen(v=>!v)} aria-label="Ajustes"
            style={{ background:"rgba(255,255,255,0.04)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.15))", borderRadius:8, color:"#6b5f88", width:34, height:34, cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>⚙️</button>
          {settingsMenuOpen && <>
            <div onClick={()=>setSettingsMenuOpen(false)} style={{ position:"fixed", inset:0, zIndex:110 }} />
            <div style={{ position:"absolute", top:40, right:0, background:"var(--t-menu-bg,rgba(12,8,26,0.98))", border:"1px solid var(--t-card-border,rgba(167,139,250,0.15))", borderRadius:12, padding:"6px 0", zIndex:120, minWidth:180, backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", boxShadow:"0 8px 32px rgba(0,0,0,0.5)" }}>
              {[
                { icon:"👤", label:"Mi perfil",  action:()=>{ setShowProfile(true); setSettingsMenuOpen(false); } },
                { icon:"📥", label:"Exportar",   action:()=>{ exportData(data); setSettingsMenuOpen(false); } },
                { icon:"📤", label:"Importar",   action:()=>{ importFileRef.current?.click(); setSettingsMenuOpen(false); } },
                { icon:"🔄", label:syncing?"Sincronizando…":"Actualizar datos", action:()=>{ forceSync(); setSettingsMenuOpen(false); } },
              ].map((item,i)=>(
                <button key={i} onClick={item.action}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 16px", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, color:"#c4b8ff", width:"100%", textAlign:"left", transition:"background 0.12s" }}
                  onMouseEnter={e=>e.currentTarget.style.background="var(--t-accent-soft,rgba(167,139,250,0.1))"}
                  onMouseLeave={e=>e.currentTarget.style.background="none"}>
                  <span style={{ fontSize:15 }}>{item.icon}</span>{item.label}
                </button>
              ))}
              <div style={{ height:1, background:"var(--t-card-border,rgba(167,139,250,0.1))", margin:"4px 0" }} />
              <button onClick={()=>{ onSignOut(); setSettingsMenuOpen(false); }}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 16px", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, color:"#f472b6", width:"100%", textAlign:"left" }}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(244,114,182,0.08)"}
                onMouseLeave={e=>e.currentTarget.style.background="none"}>
                <span style={{ fontSize:15 }}>🚪</span>Cerrar sesión
              </button>
            </div>
          </>}
        </div>
      </div>

      <div style={{ maxWidth:640, margin:"0 auto", padding:"18px 16px 120px" }}>

        {/* Global filters — show only for tabs that need them */}
        {(activeTab==="current"||activeTab==="calendar"||activeTab==="history") && <div style={{ marginBottom:12, display:"flex", flexDirection:"column", gap:6 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
            <span style={{ fontSize:9, color:"#3d3360", letterSpacing:1.5, textTransform:"uppercase", fontWeight:600, flexShrink:0 }}>👥</span>
            {[["all","Todos","#6b5f88"],["person1",p1,colors.person1],["person2",p2,colors.person2],["together","Juntos",colors.together]].map(([v,l,c])=>(
              <button key={v} onClick={()=>setGlobalPersonFilter(v)} style={{ background:globalPersonFilter===v?`${c}22`:"rgba(255,255,255,0.03)", border:`1px solid ${globalPersonFilter===v?c+"55":"rgba(255,255,255,0.07)"}`, borderRadius:99, color:globalPersonFilter===v?c:"#4a4166", padding:"3px 10px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:globalPersonFilter===v?600:400, transition:"all 0.15s" }}>{l}</button>
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4, flexWrap:"wrap" }}>
            <span style={{ fontSize:9, color:"#3d3360", letterSpacing:1.5, textTransform:"uppercase", fontWeight:600, flexShrink:0 }}>🏷️</span>
            <button onClick={()=>setGlobalCatFilter([])} style={{ background:!globalCatFilter.length?"rgba(167,139,250,0.18)":"rgba(255,255,255,0.03)", border:`1px solid ${!globalCatFilter.length?"rgba(167,139,250,0.4)":"rgba(255,255,255,0.07)"}`, borderRadius:99, color:!globalCatFilter.length?"#c4b8ff":"#4a4166", padding:"2px 9px", cursor:"pointer", fontSize:10, fontFamily:"inherit", fontWeight:!globalCatFilter.length?600:400 }}>Todas</button>
            {CATEGORIES.map(c=>{const on=globalCatFilter.includes(c.id);return<button key={c.id} onClick={()=>setGlobalCatFilter(p=>on?p.filter(x=>x!==c.id):[...p,c.id])} style={{ background:on?`${c.color}22`:"rgba(255,255,255,0.03)", border:`1px solid ${on?c.color+"55":"rgba(255,255,255,0.07)"}`, borderRadius:99, color:on?c.color:"#4a4166", padding:"2px 9px", cursor:"pointer", fontSize:10, fontFamily:"inherit", fontWeight:on?600:400 }}>{c.icon} {c.label}</button>;})}
          </div>
        </div>}

        {/* ── HOME ── */}
        {activeTab==="home" && (() => {
          const now = new Date();
          const todayStr = now.toISOString().slice(0,10);
          const tom = new Date(now); tom.setDate(tom.getDate()+1);
          const tomStr = tom.toISOString().slice(0,10);
          const todayAll = allDated.filter(m=>m.date===todayStr);
          const tomAll   = allDated.filter(m=>m.date===tomStr);
          const pending  = (week.missions||[]).filter(m=>m.status!=="DONE");
          const wDone    = (week.missions||[]).filter(m=>m.status==="DONE").length;
          const wTotal   = (week.missions||[]).length;
          const wPct     = wTotal>0?Math.round((wDone/wTotal)*100):0;
          const hour     = now.getHours();
          const greeting = hour<13?"Buenos días":hour<20?"Buenas tardes":"Buenas noches";
          const hasContent = wTotal>0 || todayAll.length>0 || tomAll.length>0;
          return (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {/* Hero — full width */}
              <div style={{ textAlign:"center", padding:"24px 0 8px" }}>
                {data.settings?.photos?.couple
                  ? <img src={data.settings.photos.couple} style={{ width:80, height:80, borderRadius:99, objectFit:"cover", border:"3px solid var(--t-accent,#a78bfa)", boxShadow:"0 0 28px color-mix(in srgb,var(--t-accent,#a78bfa) 40%,transparent)", marginBottom:12 }} alt="pareja" />
                  : <div style={{ fontSize:48, marginBottom:10, filter:"drop-shadow(0 0 12px rgba(167,139,250,0.4))" }}>{data.settings?.coupleEmoji||"💞"}</div>
                }
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:300, color:"var(--t-text,#f8f4ff)", marginBottom:3, letterSpacing:-0.5 }}>{greeting}</div>
                <div style={{ fontSize:12, color:"var(--t-text-muted,#6b5f88)", letterSpacing:1 }}>{p1} & {p2}</div>
                {week.epicObjective && (
                  <div style={{ marginTop:10, fontSize:14, fontFamily:"'Fraunces',serif", fontWeight:300, fontStyle:"italic", color:"var(--t-accent,#f472b6)" }}>"{week.epicObjective}"</div>
                )}
              </div>

              {/* 2-column grid — auto-fit collapses to 1 col on mobile */}
              {hasContent && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:12, alignItems:"start" }}>

                  {/* LEFT — Tareas pendientes */}
                  {wTotal>0 && (
                    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      <div style={{ fontSize:10, color:"#6b5f88", letterSpacing:2, textTransform:"uppercase", fontWeight:600 }}>🎯 Semana {data.currentWeekNumber}</div>
                      <div style={{ ...S.card, cursor:"pointer", borderColor:wPct===100?"rgba(52,211,153,0.25)":"rgba(167,139,250,0.18)" }} onClick={()=>setActiveTab("current")}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                          <span style={{ fontSize:12, color:wPct===100?"#34d399":wPct>=60?"#fbbf24":"#f472b6", fontWeight:700 }}>{wDone}/{wTotal} completadas</span>
                          <span style={{ fontSize:12, color:wPct===100?"#34d399":wPct>=60?"#fbbf24":"#f472b6", fontWeight:700 }}>{wPct}%</span>
                        </div>
                        <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:99, height:5, overflow:"hidden", marginBottom:12 }}>
                          <div style={{ height:"100%", width:`${wPct}%`, background:wPct===100?"linear-gradient(90deg,#34d399,#60a5fa)":"linear-gradient(90deg,#f472b6,#a78bfa)", borderRadius:99, transition:"width 0.6s" }} />
                        </div>
                        {pending.length===0
                          ? <div style={{ fontSize:13, color:"#34d399", textAlign:"center", padding:"8px 0" }}>🎉 ¡Semana completada!</div>
                          : pending.map(m=>{
                            const whoClr=m.who==="person1"?colors.person1:m.who==="person2"?colors.person2:colors.together;
                            const whoLbl=m.who==="person1"?"👤":m.who==="person2"?"👤":"👫";
                            return (
                            <div key={m.id} style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:"#8b7fa8", marginBottom:7 }}>
                              <span style={{ fontSize:14 }}>{m.emoji}</span>
                              <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.title}</span>
                              <span style={{ fontSize:10, color:whoClr, flexShrink:0 }}>{m.who==="together"?"👫":"👤"}</span>
                              <span style={{ fontSize:10, flexShrink:0 }}>{m.type==="event"?"📅":"✅"}</span>
                              <span style={{ fontSize:10, color:STATUS[m.status]?.color, background:STATUS[m.status]?.bg, border:`1px solid ${STATUS[m.status]?.border}`, borderRadius:99, padding:"1px 6px", flexShrink:0 }}>{STATUS[m.status]?.icon}</span>
                            </div>
                          );})
                        }
                        <div style={{ fontSize:11, color:"#4a4166", textAlign:"right", marginTop:4 }}>Ver semana →</div>
                      </div>
                    </div>
                  )}

                  {/* RIGHT — Eventos de hoy y mañana */}
                  {(todayAll.length>0 || tomAll.length>0) && (
                    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      <div style={{ fontSize:10, color:"#6b5f88", letterSpacing:2, textTransform:"uppercase", fontWeight:600 }}>📅 Esta semana</div>
                      {todayAll.length>0 && (
                        <div style={{ ...S.card, borderColor:"rgba(96,165,250,0.2)" }}>
                          <div style={{ fontSize:10, color:"#60a5fa", fontWeight:600, textTransform:"uppercase", letterSpacing:1.5, marginBottom:10 }}>📆 Hoy</div>
                          {todayAll.map(m=>(
                            <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10, fontSize:13, marginBottom:8 }}>
                              <span style={{ fontSize:19 }}>{m.emoji}</span>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ color:m.status==="DONE"?"#4a4166":"var(--t-text,#f0e8ff)", textDecoration:m.status==="DONE"?"line-through":"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.title}</div>
                                {m.time && <div style={{ fontSize:11, color:"#4a4166" }}>🕐 {m.time}</div>}
                              </div>
                              <span style={{ fontSize:12, color:STATUS[m.status]?.color, flexShrink:0 }}>{STATUS[m.status]?.icon}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {tomAll.length>0 && (
                        <div style={{ ...S.card, opacity:0.82 }}>
                          <div style={{ fontSize:10, color:"#8b7fa8", fontWeight:600, textTransform:"uppercase", letterSpacing:1.5, marginBottom:10 }}>📆 Mañana</div>
                          {tomAll.map(m=>(
                            <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10, fontSize:13, marginBottom:8 }}>
                              <span style={{ fontSize:19 }}>{m.emoji}</span>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ color:"#8b7fa8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.title}</div>
                                {m.time && <div style={{ fontSize:11, color:"#4a4166" }}>🕐 {m.time}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {todayAll.length===0 && tomAll.length===0 && (
                        <div style={{ ...S.card, textAlign:"center", padding:"20px 0", color:"#3d3360", fontSize:13 }}>Sin eventos próximos</div>
                      )}
                    </div>
                  )}

                  {/* If only one side has content, fill a placeholder on the other */}
                  {wTotal===0 && (todayAll.length>0||tomAll.length>0) && (
                    <div style={{ ...S.card, textAlign:"center", padding:"24px 0", cursor:"pointer" }} onClick={()=>setActiveTab("current")}>
                      <div style={{ fontSize:28, marginBottom:8 }}>🎯</div>
                      <div style={{ fontSize:13, color:"#4a4166", marginBottom:10 }}>Sin misiones esta semana</div>
                      <button style={S.btnPrimary}>+ Añadir misión</button>
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {!hasContent && (
                <div style={{ textAlign:"center", padding:"56px 0" }}>
                  <div style={{ fontSize:52, marginBottom:14 }}>{data.settings?.coupleEmoji||"💞"}</div>
                  <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:300, color:"#4a4166", marginBottom:6 }}>Todo despejado</div>
                  <div style={{ fontSize:13, color:"#2d2450", marginBottom:24 }}>Sin misiones ni eventos para hoy</div>
                  <button onClick={()=>setActiveTab("current")} style={S.btnPrimary}>✅ Añadir misión</button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Current Week */}
        {activeTab==="current" && <div>
          {/* Week navigation */}
          <div style={{ textAlign:"center", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:14, marginBottom:week.epicObjective?4:8 }}>
              <button onClick={()=>changeWeek(-1)} style={S.btnNav}>‹</button>
              <div>
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:36, fontWeight:700, lineHeight:1, letterSpacing:-1 }}>Semana {data.currentWeekNumber}</div>
                <div style={{ fontSize:11, color:"#4a4166", marginTop:3 }}>{(()=>{const d=new Date();const dias=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];const meses=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]}`;})()}</div>
              </div>
              <button onClick={()=>changeWeek(1)} style={S.btnNav}>›</button>
            </div>
            <div style={{ marginBottom:6, minHeight:22 }}>
              {editObj
                ? <input autoFocus value={week.epicObjective} onChange={e=>patchWeek(w=>({...w,epicObjective:e.target.value}))} onBlur={()=>setEditObj(false)} onKeyDown={e=>e.key==="Enter"&&setEditObj(false)} placeholder="¿Cuál es la misión épica de la semana?" style={{ background:"transparent", border:"none", borderBottom:"1px solid rgba(244,114,182,0.4)", color:"#f472b6", fontSize:14, fontFamily:"'Fraunces',serif", fontWeight:300, fontStyle:"italic", textAlign:"center", width:"80%", outline:"none", padding:"2px 0" }} />
                : <div onClick={()=>setEditObj(true)} style={{ cursor:"text", fontSize:14, fontFamily:"'Fraunces',serif", fontWeight:300, fontStyle:"italic", color:week.epicObjective?"#f472b6":"#3d3360", textAlign:"center" }}>
                    {week.epicObjective ? `"${week.epicObjective}"` : <span style={{ fontSize:11, color:"#2d2450" }}>+ objetivo épico de la semana</span>}
                  </div>
              }
            </div>
            {!isCurrentWeek && (
              <button onClick={goToToday} style={{ background:"rgba(244,114,182,0.1)", border:"1px solid rgba(244,114,182,0.25)", borderRadius:99, color:"#f472b6", fontSize:11, fontWeight:600, padding:"4px 14px", cursor:"pointer", fontFamily:"inherit", marginBottom:6 }}>📍 Volver a hoy</button>
            )}
            {total>0 && <>
              <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:99, height:5, overflow:"hidden", margin:"8px 24px 0" }}>
                <div style={{ height:"100%", width:`${pct}%`, background:"linear-gradient(90deg,#f472b6,#a78bfa)", borderRadius:99, transition:"width 0.6s" }} />
              </div>
              <div style={{ fontSize:11, color:"#8b7fa8", marginTop:5 }}>{done} de {total} completadas {pct===100?"🎉":`(${Math.round(pct)}%)`}</div>
            </>}
          </div>
          {carriedCount>0 && <div style={{ background:"rgba(251,146,60,0.1)", border:"1px solid rgba(251,146,60,0.25)", borderRadius:12, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:10, fontSize:13 }}>
            <span style={{ fontSize:20 }}>🔁</span>
            <span style={{ color:"#fdba74" }}><strong>{carriedCount} misión{carriedCount>1?"es":""}</strong> arrastrada{carriedCount>1?"s":""} de la semana anterior</span>
          </div>}
          <WorkHoursCard week={week} patchWeek={patchWeek} p1={p1} p2={p2} />
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginBottom:4 }}>
            <button onClick={runCarryOver} style={{ background:"none", border:"none", color:"#4a4166", fontSize:11, cursor:"pointer", fontFamily:"inherit", padding:"2px 4px" }}
              onMouseEnter={e=>e.currentTarget.style.color="#a78bfa"} onMouseLeave={e=>e.currentTarget.style.color="#4a4166"}>🔁 Recuperar tareas pendientes</button>
            <button onClick={runRepair} style={{ background:"none", border:"none", color:"#4a4166", fontSize:11, cursor:"pointer", fontFamily:"inherit", padding:"2px 4px" }}
              onMouseEnter={e=>e.currentTarget.style.color="#60a5fa"} onMouseLeave={e=>e.currentTarget.style.color="#4a4166"}>📅 Distribuir eventos</button>
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:6, marginBottom:6 }}>
            {!showAddForm && <>
              <button onClick={()=>{ setNewM(p=>({...p,type:"task",emoji:"🎯"})); setShowAddForm(true); }}
                style={{ background:"rgba(167,139,250,0.1)", border:"1px solid rgba(167,139,250,0.25)", borderRadius:99, color:"#a78bfa", cursor:"pointer", fontSize:12, fontFamily:"inherit", padding:"5px 13px", display:"flex", alignItems:"center", gap:5 }}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(167,139,250,0.2)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(167,139,250,0.1)"}>
                ✅ + Tarea
              </button>
              <button onClick={()=>{ setNewM(p=>({...p,type:"event",emoji:"📅"})); setShowAddForm(true); }}
                style={{ background:"rgba(96,165,250,0.08)", border:"1px solid rgba(96,165,250,0.22)", borderRadius:99, color:"#60a5fa", cursor:"pointer", fontSize:12, fontFamily:"inherit", padding:"5px 13px", display:"flex", alignItems:"center", gap:5 }}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(96,165,250,0.18)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(96,165,250,0.08)"}>
                📅 + Evento
              </button>
            </>}
          </div>
          {showAddForm&&<AddMissionForm newM={newM} setNewM={setNewM} onAdd={addMission} onCancel={()=>setShowAddForm(false)} p1={p1} p2={p2} goals={data.goals||[]} />}
          {/* Sort bar */}
          <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:8, flexWrap:"wrap" }}>
            <span style={{ fontSize:9, color:"#3d3360", letterSpacing:1.5, textTransform:"uppercase", fontWeight:600 }}>↕️</span>
            {[["default","Por defecto"],["chrono","Cronológico"],["type","Tipo"],["who","Persona"],["status","Estado"]].map(([v,l])=>(
              <button key={v} onClick={()=>setWeekSort(v)} style={{ background:weekSort===v?"rgba(167,139,250,0.18)":"rgba(255,255,255,0.03)", border:`1px solid ${weekSort===v?"rgba(167,139,250,0.4)":"rgba(255,255,255,0.07)"}`, borderRadius:99, color:weekSort===v?"#c4b8ff":"#4a4166", padding:"2px 9px", cursor:"pointer", fontSize:10, fontFamily:"inherit", fontWeight:weekSort===v?600:400 }}>{l}</button>
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {(()=>{
              const filtered=(week.missions||[]).filter(m=>(globalPersonFilter==="all"||m.who===globalPersonFilter)&&(!globalCatFilter.length||getMCats(m).some(c=>globalCatFilter.includes(c))));
              const sorted=[...filtered].sort((a,b)=>{
                if(weekSort==="chrono"){const da=a.date?a.date+"T"+(a.time||"00:00"):"9999";const db=b.date?b.date+"T"+(b.time||"00:00"):"9999";return da.localeCompare(db);}
                if(weekSort==="type"){const ta=a.type==="event"?0:1;const tb=b.type==="event"?0:1;return ta-tb;}
                if(weekSort==="who"){const wo=["person1","person2","together"];return wo.indexOf(a.who||"together")-wo.indexOf(b.who||"together");}
                if(weekSort==="status"){return STATUS_ORDER.indexOf(a.status)-STATUS_ORDER.indexOf(b.status);}
                return 0;
              });
              return sorted.map(m=>(
                <MissionCard key={m.id} mission={m} p1={p1} p2={p2} colors={colors} goals={data.goals||[]} weeksData={data.weeks} onCycleStatus={()=>cycleStatus(m.id)} onDelete={()=>delMission(m.id)} onPatch={p=>patchM(m.id,p)} />
              ));
            })()}
          </div>
        </div>}

        {activeTab==="calendar" && <CalendarView
          allDatedMissions={allDated} week={week} wkey={wkey} p1={p1} p2={p2} weeks={data.weeks} colors={colors} settings={data.settings} personFilter={globalPersonFilter} catFilter={globalCatFilter} goals={data.goals||[]}
          onPatchMission={patchMissionGlobal} onDeleteMission={deleteMissionGlobal}
          onAddForDay={(date) => {
            const { week:wn, year:yr } = getWeekAndYear(new Date(date));
            update(s => ({...s, currentWeekNumber:wn, currentYear:yr}));
            setNewM(p=>({...p, date, type:"event", emoji:"📅"}));
            setShowAddForm(true); setActiveTab("current");
          }}
          onDownloadICS={() => downloadWeekICS(week, wkey, p1, p2)}
          onDownloadPDF={() => downloadWeekPDF(week, wkey, p1, p2)}
          onGoToWeek={(wn,yr)=>{update(s=>({...s,currentWeekNumber:wn,currentYear:yr}));setActiveTab("current");}}
          onCycleStatus={cycleStatusGlobal}
        />}

        {activeTab==="history" && (() => {
          const { week:_htw, year:_hty } = getWeekAndYear();
          const _htodayKey = isoWeekKey(_htw, _hty);
          const allHistSorted = Object.entries(data.weeks).filter(([key])=>key<=_htodayKey).sort((a,b)=>b[0].localeCompare(a[0]));
          const histFiltered = histWeekRange==="all" ? allHistSorted : allHistSorted.slice(0, parseInt(histWeekRange));
          const filterHM = ms => ms.filter(m=>(globalPersonFilter==="all"||m.who===globalPersonFilter)&&(!globalCatFilter.length||getMCats(m).some(c=>globalCatFilter.includes(c))));
          return (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {/* Filter bar */}
            <div style={{ ...S.card, padding:"10px 14px" }}>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                <div>
                  <div style={S.label}>Semanas</div>
                  <div style={{ display:"flex", gap:3 }}>
                    {[["all","Todas"],["1","Esta sem."],["4","4 últ."],["8","8 últ."]].map(([v,l])=>(
                      <button key={v} onClick={()=>setHistWeekRange(v)} style={{ background:histWeekRange===v?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.04)", border:`1px solid ${histWeekRange===v?"rgba(167,139,250,0.4)":"rgba(255,255,255,0.08)"}`, borderRadius:7, color:histWeekRange===v?"#a78bfa":"#6b5f88", padding:"4px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Export buttons */}
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => downloadWeekICS(week, wkey, p1, p2)} style={{ ...S.btnSecondary, flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"9px 10px", borderColor:"rgba(52,211,153,0.3)", color:"#34d399", fontSize:12 }}>📅 .ics semana actual</button>
              <button onClick={() => downloadFilteredPDF(histFiltered, globalPersonFilter, p1, p2)} style={{ ...S.btnSecondary, flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"9px 10px", borderColor:"rgba(167,139,250,0.3)", color:"#a78bfa", fontSize:12 }}>🖨️ PDF filtrado ({histFiltered.length} sem.)</button>
            </div>
            {/* Week cards */}
            {histFiltered.map(([key,w]) => {
              const filtMs = filterHM(w.missions||[]);
              const d=filtMs.filter(m=>m.status==="DONE").length, t=filtMs.length, p=t>0?Math.round((d/t)*100):0, cur=key===wkey;
              return (
                <div key={key} style={{ ...S.card, borderColor:cur?"rgba(167,139,250,0.45)":"rgba(167,139,250,0.1)", background:cur?"#231e3d":"#1d1733", padding:"12px 14px" }}>
                  <div onClick={()=>{const yr=parseInt(key.split("-W")[0])||w.year;update(s=>({...s,currentWeekNumber:w.weekNumber,currentYear:yr}));setActiveTab("current");}} style={{ cursor:"pointer", marginBottom:w.epicObjective?5:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ fontFamily:"'Fraunces',serif", fontWeight:600, fontSize:18, display:"flex", alignItems:"center", gap:7 }}>
                        Semana {w.weekNumber}
                        {cur&&<span style={{ fontSize:10, color:"#a78bfa", background:"rgba(167,139,250,0.15)", padding:"2px 7px", borderRadius:99, fontFamily:"inherit", fontWeight:600 }}>ACTUAL</span>}
                      </div>
                      <div style={{ fontSize:13, color:p===100?"#34d399":"#8b7fa8", fontWeight:600 }}>{p===100?"🏆":""} {d}/{t}</div>
                    </div>
                    {w.epicObjective&&<div style={{ fontSize:12, color:"#6b5f88", marginTop:3, fontStyle:"italic", fontFamily:"'Fraunces',serif", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>"{w.epicObjective}"</div>}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }} onClick={e=>e.stopPropagation()}>
                    <div style={{ flex:1 }}>
                      <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:99, height:5, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${p}%`, borderRadius:99, background:p===100?"linear-gradient(90deg,#34d399,#60a5fa)":"linear-gradient(90deg,#f472b6,#a78bfa)", transition:"width 0.5s" }} />
                      </div>
                      <div style={{ fontSize:10, color:"#4a4166", marginTop:3 }}>{p}%{globalPersonFilter!=="all"?` (${globalPersonFilter==="person1"?p1:globalPersonFilter==="person2"?p2:"Juntos"})`:""}</div>
                    </div>
                    {w.photo
                      ? <div style={{ position:"relative", flexShrink:0 }}>
                          <img src={w.photo} onClick={()=>setLightboxSrc(w.photo)} style={{ width:44, height:44, borderRadius:8, objectFit:"cover", display:"block", border:"1px solid rgba(167,139,250,0.25)", cursor:"zoom-in" }} alt="foto" title="Ver foto completa" />
                          <button onClick={()=>update(d=>({...d,weeks:{...d.weeks,[key]:{...d.weeks[key],photo:null}}}))}
                            style={{ position:"absolute", top:-5, right:-5, background:"#1d1733", border:"1px solid rgba(167,139,250,0.3)", borderRadius:99, color:"#8b7fa8", fontSize:9, width:16, height:16, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>✕</button>
                        </div>
                      : <label style={{ flexShrink:0, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(255,255,255,0.03)", border:"1px dashed rgba(167,139,250,0.18)", borderRadius:8, cursor:"pointer", fontSize:16 }} title="Añadir foto de recuerdo">
                          📸
                          <input type="file" accept="image/*" style={{ display:"none" }}
                            onChange={async e=>{const f=e.target.files[0];if(!f)return;const b64=await compressImage(f);update(d=>({...d,weeks:{...d.weeks,[key]:{...d.weeks[key],photo:b64}}}));e.target.value="";}} />
                        </label>
                    }
                  </div>
                  {/* ICS por semana */}
                  {(w.missions||[]).some(m=>m.date)&&<div style={{ marginTop:8 }}>
                    <button onClick={()=>downloadWeekICS(w, key, p1, p2)} style={{ ...S.btnSecondary, fontSize:11, padding:"4px 10px", borderColor:"rgba(52,211,153,0.25)", color:"#34d399", width:"100%" }}>📅 Importar semana {w.weekNumber} a Google Calendar (.ics)</button>
                  </div>}
                  {w.photo&&<div style={{ marginTop:8, position:"relative", cursor:"zoom-in" }} onClick={()=>setLightboxSrc(w.photo)}>
                    <img src={w.photo} style={{ width:"100%", borderRadius:10, maxHeight:130, objectFit:"cover", display:"block" }} alt="foto semana" />
                    <div style={{ position:"absolute", inset:0, borderRadius:10, background:"rgba(0,0,0,0)", display:"flex", alignItems:"flex-end", justifyContent:"flex-end", padding:6 }}>
                      <span style={{ background:"rgba(0,0,0,0.45)", borderRadius:6, fontSize:10, color:"#f8f4ff", padding:"2px 7px", backdropFilter:"blur(4px)" }}>🔍 Ver completa</span>
                    </div>
                  </div>}
                </div>
              );
            })}
          </div>
          );
        })()}

        {activeTab==="goals" && <GoalsView goals={data.goals||[]} weeks={data.weeks} cwn={data.currentWeekNumber} cyr={data.currentYear} p1={p1} p2={p2} colors={colors} onAdd={addGoal} onUpdate={updateGoal} onDelete={deleteGoal} />}

        {activeTab==="stats" && <StatsView weeks={data.weeks} p1={p1} p2={p2} colors={colors} onGoToWeek={(wn,yr)=>{update(s=>({...s,currentWeekNumber:wn,currentYear:yr}));setActiveTab("current");}} />}
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div onClick={()=>setLightboxSrc(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16, cursor:"zoom-out" }}>
          <img src={lightboxSrc} style={{ maxWidth:"100%", maxHeight:"100%", borderRadius:12, objectFit:"contain", boxShadow:"0 20px 60px rgba(0,0,0,0.8)" }} alt="foto completa" />
          <button onClick={()=>setLightboxSrc(null)} style={{ position:"absolute", top:16, right:16, background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:99, color:"#f8f4ff", fontSize:20, width:38, height:38, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>
      )}
    </div>
  );
}

function WorkHoursCard({ week, patchWeek, p1, p2 }) {
  const [open, setOpen] = useState(false);
  const wh = week.workHours || { person1:0, person2:0 };
  return (
    <div style={{ ...S.card, marginBottom:14, borderColor:"rgba(251,191,36,0.18)" }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
        <div style={{ fontSize:10, letterSpacing:2.5, textTransform:"uppercase", color:"#fbbf24", fontWeight:600 }}>💼 Horas laborales</div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          {(wh.person1||wh.person2)>0
            ? <div style={{ display:"flex", gap:8 }}>
                {wh.person1>0&&<span style={{ fontSize:12, color:"#8b7fa8" }}>{p1}: <strong style={{ color:"#f8f4ff" }}>{wh.person1}h</strong></span>}
                {wh.person2>0&&<span style={{ fontSize:12, color:"#8b7fa8" }}>{p2}: <strong style={{ color:"#f8f4ff" }}>{wh.person2}h</strong></span>}
              </div>
            : <span style={{ fontSize:12, color:"#3d3360", fontStyle:"italic" }}>sin registrar</span>
          }
          <span style={{ color:"#4a4166", fontSize:14 }}>{open?"▲":"▼"}</span>
        </div>
      </div>
      {open && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:12 }}>
          {[{key:"person1",label:p1},{key:"person2",label:p2}].map(({key,label})=>(
            <div key={key}>
              <label style={S.label}>{label}</label>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <input type="number" min="0" max="80" step="0.5" value={wh[key]||""} onChange={e=>patchWeek(w=>({...w, workHours:{...w.workHours,[key]:parseFloat(e.target.value)||0}}))} placeholder="0" style={{ ...S.inputSm, width:"70px" }} />
                <span style={{ fontSize:12, color:"#6b5f88" }}>horas</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddMissionForm({ newM, setNewM, onAdd, onCancel, p1, p2, goals }) {
  const WHO = [{ id:"together",label:"Juntos",icon:"👫"},{id:"person1",label:p1,icon:"🙋"},{id:"person2",label:p2,icon:"🙋"}];
  const activeGoals = (goals||[]).filter(g=>g.active!==false);
  const isEvent = newM.type==="event";
  return (
    <div style={{ ...S.card, borderColor:isEvent?"rgba(96,165,250,0.35)":"rgba(167,139,250,0.3)" }}>
      {/* Tipo: tarea vs evento */}
      <div style={{ display:"flex", gap:4, marginBottom:10 }}>
        {[{id:"task",label:"✅ Tarea"},{id:"event",label:"📅 Evento"}].map(t=>(
          <button key={t.id} onClick={()=>setNewM(p=>({...p,type:t.id}))}
            style={{ flex:1, background:newM.type===t.id?(t.id==="event"?"rgba(96,165,250,0.18)":"rgba(167,139,250,0.18)"):"rgba(255,255,255,0.03)", border:`1px solid ${newM.type===t.id?(t.id==="event"?"rgba(96,165,250,0.5)":"rgba(167,139,250,0.5)"):"rgba(255,255,255,0.08)"}`, borderRadius:8, color:newM.type===t.id?(t.id==="event"?"#60a5fa":"#c4b8ff"):"#4a4166", padding:"5px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:newM.type===t.id?600:400 }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10 }}>
        <EmojiSelect value={newM.emoji} onChange={e=>setNewM(p=>({...p,emoji:e}))} />
        <input autoFocus value={newM.title} onChange={e=>setNewM(p=>({...p,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&onAdd()} placeholder={isEvent?"Nombre del evento...":"Nombre de la misión..."} style={S.input} />
      </div>
      <div style={{ marginBottom:10 }}>
        <label style={S.label}>Categoría (multi)</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
          {CATEGORIES.map(c=>{
            const sel=(newM.categories||[]).includes(c.id);
            return <button key={c.id} onClick={()=>setNewM(p=>{const cats=p.categories||[];return {...p,categories:sel?cats.filter(x=>x!==c.id):[...cats,c.id]};})}
              style={{ ...catBadgeStyle(c.id), cursor:"pointer", border:`1px solid ${c.color}${sel?"":"20"}`, opacity:sel||!(newM.categories||[]).length?1:0.4 }}>
              {c.icon} {c.label}
            </button>;
          })}
        </div>
      </div>
      <div style={{ marginBottom:10 }}>
        <label style={S.label}>¿Quién?</label>
        <div style={{ display:"flex", gap:5 }}>
          {WHO.map(w=>(
            <button key={w.id} onClick={()=>setNewM(p=>({...p,who:w.id}))}
              style={{ background:newM.who===w.id?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.04)", border:`1px solid ${newM.who===w.id?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:8, color:newM.who===w.id?"#c4b8ff":"#6b5f88", padding:"5px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
              {w.icon} {w.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
        <div><label style={S.label}>📆 Fecha</label><input type="date" value={newM.date} onChange={e=>setNewM(p=>({...p,date:e.target.value}))} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
        <div><label style={S.label}>🕐 Hora</label><input type="time" value={newM.time} onChange={e=>setNewM(p=>({...p,time:e.target.value}))} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
      </div>
      <div style={{ marginBottom:10 }}><label style={S.label}>⏱ Duración (h)</label><input type="number" min="0" step="0.5" value={newM.duration} onChange={e=>setNewM(p=>({...p,duration:e.target.value}))} placeholder="1" style={S.inputSm} /></div>
      {activeGoals.length>0&&<div style={{ marginBottom:10 }}>
        <label style={S.label}>🏅 ¿Cuenta para alguna meta?</label>
        <select value={newM.goalId||""} onChange={e=>setNewM(p=>({...p,goalId:e.target.value||null}))} style={{ ...S.input, fontSize:13, colorScheme:"dark", background:"rgba(16,10,32,0.95)", color:"var(--t-text,#f8f4ff)" }}>
          <option value="">— Sin meta —</option>
          {activeGoals.map(g=><option key={g.id} value={g.id}>{g.emoji} {g.title}</option>)}
        </select>
      </div>}
      {newM.type==="task"&&<div style={{ marginBottom:10 }}>
        <label style={S.label}>🔁 Tarea recurrente</label>
        <div style={{ display:"flex", gap:4 }}>
          {[{id:"",label:"Una vez"},{id:"weekly",label:"Semanal"},{id:"monthly",label:"Mensual"}].map(o=>(
            <button key={o.id} onClick={()=>setNewM(p=>({...p,seriesPattern:o.id,seriesId:o.id?p.seriesId||uid():undefined}))}
              style={{ flex:1, background:newM.seriesPattern===o.id?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.04)", border:`1px solid ${newM.seriesPattern===o.id?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:7, color:newM.seriesPattern===o.id?"#c4b8ff":"#6b5f88", padding:"5px 6px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:newM.seriesPattern===o.id?600:400 }}>{o.label}</button>
          ))}
        </div>
      </div>}
      <div style={{ display:"flex", gap:6, justifyContent:"space-between", alignItems:"center", flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {STATUS_ORDER.map(s=><button key={s} onClick={()=>setNewM(p=>({...p,status:s}))} style={{ ...badgeStyle(s), opacity:newM.status===s?1:0.35 }}>{STATUS[s].icon} {STATUS[s].label}</button>)}
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={onCancel} style={S.btnSecondary}>Cancelar</button>
          <button onClick={onAdd} style={S.btnPrimary}>Añadir ✨</button>
        </div>
      </div>
    </div>
  );
}

function MissionCard({ mission, onCycleStatus, onDelete, onPatch, p1, p2, colors, goals, weeksData }) {
  const [expanded, setExpanded] = useState(false);
  const isDone = mission.status==="DONE", isCarried = !!mission.carriedFrom;
  const mCats = getMCats(mission).map(id=>CAT_MAP[id]).filter(Boolean);
  const clr = colors || DEFAULT_COLORS;
  const whoColor = mission.who==="person1"?clr.person1:mission.who==="person2"?clr.person2:clr.together;
  const WHO = [{ id:"together",label:"Juntos",icon:"👫"},{id:"person1",label:p1,icon:"🙋"},{id:"person2",label:p2,icon:"🙋"}];
  const gcalUrl = googleCalendarUrl(mission, p1, p2);
  const isEvent = mission.type==="event";
  const firstCat = mCats[0];
  const cardBorder = isDone?"rgba(52,211,153,0.15)":isCarried?"rgba(251,146,60,0.2)":isEvent?"rgba(96,165,250,0.3)":firstCat?`${firstCat.color}30`:`${whoColor}22`;
  const carriedWeeks = (() => {
    if (!isCarried || isDone || !weeksData) return 0;
    let count = 0, originId = mission.carriedFrom, originWeek = mission.carriedFromWeek;
    while (originId && originWeek && count < 20) {
      count++;
      const w = weeksData[originWeek];
      if (!w) break;
      const origin = (w.missions || []).find(m => m.id === originId);
      if (!origin?.carriedFrom) break;
      originId = origin.carriedFrom;
      originWeek = origin.carriedFromWeek;
    }
    return count;
  })();
  return (
    <div style={{ ...S.card, borderColor:cardBorder, opacity:isDone?0.78:1, transition:"all 0.25s" }}>
      {isCarried&&!isDone&&(
        <div style={{ fontSize:10, color:carriedWeeks>=3?"#f87171":"#fb923c", letterSpacing:1, marginBottom:6, display:"flex", alignItems:"center", gap:4 }}>
          {carriedWeeks>=3?"⚠️":"🔁"} {carriedWeeks>=3?`Arrastrada ${carriedWeeks} semanas`:"Arrastrada"}
        </div>
      )}
      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
        <EmojiSelect value={mission.emoji} onChange={e=>onPatch({emoji:e})} />
        <div style={{ flex:1, minWidth:0, cursor:"pointer" }} onClick={()=>setExpanded(v=>!v)}>
          <div style={{ fontSize:14, fontWeight:500, lineHeight:1.4, color:isDone?"#6b5f88":"#f0e8ff", textDecoration:isDone?"line-through":"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={mission.title}>{mission.title}</div>
          <div style={{ display:"flex", gap:4, marginTop:4, flexWrap:"wrap" }}>
            {mCats.map(cat=><span key={cat.id} style={catBadgeStyle(cat.id)}>{cat.icon} {cat.label}</span>)}
            {mission.who==="together"&&<span style={{ background:`${clr.together}18`, color:clr.together, border:`1px solid ${clr.together}40`, padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600 }}>👫 Juntos</span>}
            {mission.who==="person1"&&<span style={{ background:`${clr.person1}18`, color:clr.person1, border:`1px solid ${clr.person1}40`, padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600 }}>🙋 {p1}</span>}
            {mission.who==="person2"&&<span style={{ background:`${clr.person2}18`, color:clr.person2, border:`1px solid ${clr.person2}40`, padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600 }}>🙋 {p2}</span>}
            {(mission.duration||mission.estimatedHours)&&<span style={{ background:"rgba(96,165,250,0.08)", color:"#60a5fa", border:"1px solid rgba(96,165,250,0.2)", padding:"2px 7px", borderRadius:99, fontSize:11 }}>⏱ {mission.duration||mission.estimatedHours}h</span>}
            {mission.date&&<span style={{ background:"rgba(255,255,255,0.05)", color:"#6b5f88", border:"1px solid rgba(255,255,255,0.08)", padding:"2px 7px", borderRadius:99, fontSize:11 }}>📆 {mission.date}{mission.time?` · 🕐 ${mission.time}`:""}</span>}
            {isEvent&&<span style={{ background:"rgba(96,165,250,0.12)", color:"#60a5fa", border:"1px solid rgba(96,165,250,0.25)", padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600 }}>📅 Evento</span>}
            {mission.seriesPattern&&<span style={{ background:"rgba(52,211,153,0.1)", color:"#34d399", border:"1px solid rgba(52,211,153,0.25)", padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600 }}>🔁 {mission.seriesPattern==="weekly"?"Semanal":"Mensual"}</span>}
            {mission.goalId&&(()=>{const g=(goals||[]).find(x=>x.id===mission.goalId);return g?<span style={{ background:"rgba(167,139,250,0.12)", color:"#a78bfa", border:"1px solid rgba(167,139,250,0.25)", padding:"2px 7px", borderRadius:99, fontSize:11 }}>{g.emoji} {g.title}</span>:null;})()}
          </div>
        </div>
        <button onClick={onCycleStatus} style={badgeStyle(mission.status)}>{STATUS[mission.status].icon}</button>
        <button onClick={onDelete} style={{ background:"none", border:"none", cursor:"pointer", color:"#3d3360", fontSize:18, padding:"0 2px", lineHeight:1, flexShrink:0 }}
          onMouseEnter={e=>e.currentTarget.style.color="#f472b6"} onMouseLeave={e=>e.currentTarget.style.color="#3d3360"}>×</button>
      </div>
      {expanded && (
        <div style={{ marginTop:12, borderTop:"1px solid rgba(167,139,250,0.12)", paddingTop:12 }}>
          <div style={{ marginBottom:10 }}><label style={S.label}>Título</label><input value={mission.title} onChange={e=>onPatch({title:e.target.value})} style={S.input} /></div>
          <div style={{ marginBottom:10 }}>
            <label style={S.label}>Tipo</label>
            <div style={{ display:"flex", gap:4 }}>
              {[{id:"task",label:"✅ Tarea"},{id:"event",label:"📅 Evento"}].map(t=>{
                const sel=(mission.type||"task")===t.id;
                const ac=t.id==="event"?"rgba(96,165,250,0.5)":"rgba(167,139,250,0.5)";
                const tc=t.id==="event"?"#60a5fa":"#c4b8ff";
                return <button key={t.id} onClick={()=>onPatch({type:t.id})} style={{ flex:1, background:sel?(t.id==="event"?"rgba(96,165,250,0.15)":"rgba(167,139,250,0.15)"):"rgba(255,255,255,0.03)", border:`1px solid ${sel?ac:"rgba(255,255,255,0.08)"}`, borderRadius:7, color:sel?tc:"#4a4166", padding:"4px 8px", cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:sel?600:400 }}>{t.label}</button>;
              })}
            </div>
          </div>
          <div style={{ marginBottom:10 }}>
            <label style={S.label}>Categoría (multi)</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {CATEGORIES.map(c=>{
                const curCats=getMCats(mission);const sel=curCats.includes(c.id);
                return <button key={c.id} onClick={()=>onPatch({categories:sel?curCats.filter(x=>x!==c.id):[...curCats,c.id],category:null})}
                  style={{ ...catBadgeStyle(c.id), cursor:"pointer", border:`1px solid ${c.color}${sel?"":"20"}`, opacity:sel||!curCats.length?1:0.4 }}>{c.icon} {c.label}</button>;
              })}
            </div>
          </div>
          <div style={{ marginBottom:10 }}>
            <label style={S.label}>¿Quién?</label>
            <div style={{ display:"flex", gap:5 }}>
              {WHO.map(w=>{
                const wc=w.id==="person1"?clr.person1:w.id==="person2"?clr.person2:clr.together;
                const sel=mission.who===w.id;
                return <button key={w.id} onClick={()=>onPatch({who:w.id})} style={{ background:sel?`${wc}22`:"rgba(255,255,255,0.04)", border:`1px solid ${sel?wc+"60":"rgba(255,255,255,0.08)"}`, borderRadius:8, color:sel?wc:"#6b5f88", padding:"5px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>{w.icon} {w.label}</button>;
              })}
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <div><label style={S.label}>📆 Fecha</label><input type="date" value={mission.date||""} onChange={e=>onPatch({date:e.target.value||null})} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
            <div><label style={S.label}>🕐 Hora</label><input type="time" value={mission.time||""} onChange={e=>onPatch({time:e.target.value||null})} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
          </div>
          <div style={{ marginBottom:8 }}><label style={S.label}>⏱ Duración (h)</label><input type="number" min="0" step="0.5" value={mission.duration||""} onChange={e=>onPatch({duration:parseFloat(e.target.value)||null})} placeholder="1" style={S.inputSm} /></div>
          {(goals||[]).filter(g=>g.active!==false).length>0&&<div style={{ marginBottom:8 }}>
            <label style={S.label}>🏅 ¿Cuenta para alguna meta?</label>
            <select value={mission.goalId||""} onChange={e=>onPatch({goalId:e.target.value||null})} style={{ ...S.input, fontSize:13, colorScheme:"dark", background:"rgba(16,10,32,0.95)", color:"var(--t-text,#f8f4ff)" }}>
              <option value="">— Sin meta —</option>
              {(goals||[]).filter(g=>g.active!==false).map(g=><option key={g.id} value={g.id}>{g.emoji} {g.title}</option>)}
            </select>
          </div>}
          {gcalUrl&&<a href={gcalUrl} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, color:"#34d399", background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:7, padding:"5px 10px", textDecoration:"none", marginTop:4 }}>📅 Añadir a Google Calendar</a>}
        </div>
      )}
    </div>
  );
}

function ProfileModal({ data, update, onClose }) {
  const settings = data.settings || {};
  const [p1,      setP1]      = useState(settings.person1||"Pololo");
  const [p2,      setP2]      = useState(settings.person2||"Banana");
  const [colors,  setColors]  = useState({ ...DEFAULT_COLORS, ...(settings.colors||{}) });
  const [themeId,      setThemeId]      = useState(settings.themeId||"violet");
  const [themeOpen,    setThemeOpen]    = useState(false);
  const [coupleEmoji,  setCoupleEmoji]  = useState(settings.coupleEmoji||"💞");
  const [photos,       setPhotos]       = useState({ person1: settings.photos?.person1||null, person2: settings.photos?.person2||null, couple: settings.photos?.couple||null });
  const COUPLE_EMOJIS = ["💞","💑","👫","🫂","💕","💓","💗","💝","💘","🥰","😍","💋","🌹","❤️","🫶","🩷","🔥","✨","🌟","🦋","👑","🎉","🌈","🎯"];
  const setColor = (key, val) => setColors(c=>({...c,[key]:val}));

  const compressAvatar = (file) => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const size = 180;
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        // crop square from center
        const s = Math.min(img.width, img.height);
        const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  const handlePhoto = async (key, e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const b64 = await compressAvatar(file);
    setPhotos(p=>({...p,[key]:b64}));
    e.target.value = "";
  };

  const save = () => {
    update(d=>({...d, settings:{...d.settings, person1:p1.trim()||"Pololo", person2:p2.trim()||"Banana", colors, themeId, coupleEmoji, photos}}));
    onClose();
  };

  const personRow = (key, label, nameVal, setName) => (
    <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:18 }}>
      {/* Avatar */}
      <label style={{ cursor:"pointer", flexShrink:0 }}>
        <div style={{ width:56, height:56, borderRadius:99, background:colors[key]+"22", border:`2px solid ${colors[key]}55`, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", position:"relative" }}>
          {photos[key]
            ? <img src={photos[key]} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" />
            : <span style={{ fontSize:22 }}>{key==="person1"?"👤":"👤"}</span>}
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", opacity:0, transition:"opacity 0.15s", borderRadius:99 }}
            onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0}>
            <span style={{ fontSize:16 }}>📷</span>
          </div>
        </div>
        <input type="file" accept="image/*" onChange={e=>handlePhoto(key,e)} style={{ display:"none" }} />
      </label>
      <div style={{ flex:1 }}>
        <label style={S.label}>{label}</label>
        <input value={nameVal} onChange={e=>setName(e.target.value)} style={S.input} placeholder={label} />
      </div>
      <div style={{ flexShrink:0 }}>
        <label style={{ ...S.label, textAlign:"center" }}>Color</label>
        <input type="color" value={colors[key]} onChange={e=>setColor(key,e.target.value)}
          style={{ width:36, height:36, border:"none", borderRadius:8, cursor:"pointer", background:"none", padding:2, display:"block" }} />
      </div>
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:150, display:"flex", flexDirection:"column", overflow:"hidden" }} onClick={onClose}>
      <div style={{ background:"var(--t-menu-bg,#0f0a1e)", borderTop:"1px solid var(--t-card-border,rgba(167,139,250,0.15))", borderRadius:"20px 20px 0 0", marginTop:"auto", maxHeight:"92vh", overflow:"hidden", display:"flex", flexDirection:"column" }} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 20px 0" }}>
          <span style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:600, color:"#f8f4ff" }}>👤 Mi Perfil</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#6b5f88", fontSize:22, cursor:"pointer", lineHeight:1 }}>×</button>
        </div>
        {/* Scrollable body */}
        <div style={{ overflowY:"auto", padding:"16px 20px 20px", flex:1 }}>

          {/* Foto de pareja */}
          <div style={{ fontSize:10, color:"#6b5f88", letterSpacing:2, textTransform:"uppercase", fontWeight:600, marginBottom:12, marginTop:4 }}>Foto de pareja</div>
          <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:24, padding:"14px 16px", background:"var(--t-accent-soft,rgba(167,139,250,0.06))", borderRadius:14, border:"1px solid var(--t-card-border)" }}>
            <label style={{ cursor:"pointer", flexShrink:0 }}>
              <div style={{ width:72, height:72, borderRadius:99, background:"var(--t-accent-soft)", border:`2px solid var(--t-accent,#a78bfa)`, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", position:"relative" }}>
                {photos.couple
                  ? <img src={photos.couple} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" />
                  : <span style={{ fontSize:32 }}>{coupleEmoji}</span>}
              </div>
              <input type="file" accept="image/*" onChange={e=>handlePhoto("couple",e)} style={{ display:"none" }} />
            </label>
            <div>
              <div style={{ fontSize:13, color:"#c4b8ff", fontWeight:500, marginBottom:4 }}>Vuestra foto juntos</div>
              <div style={{ fontSize:11, color:"#6b5f88", marginBottom:8, lineHeight:1.5 }}>Aparece en la pantalla de inicio y en el menú lateral</div>
              <div style={{ display:"flex", gap:8 }}>
                <label style={{ ...S.btnSecondary, fontSize:11, cursor:"pointer", padding:"5px 12px", display:"inline-block" }}>
                  📷 Cambiar
                  <input type="file" accept="image/*" onChange={e=>handlePhoto("couple",e)} style={{ display:"none" }} />
                </label>
                {photos.couple && <button onClick={()=>setPhotos(p=>({...p,couple:null}))} style={{ ...S.btnSecondary, fontSize:11, padding:"5px 12px" }}>✕ Quitar</button>}
              </div>
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:11, color:"#8b7fa8", marginBottom:6 }}>Emoji cuando no hay foto</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {COUPLE_EMOJIS.map(e=>(
                    <button key={e} onClick={()=>setCoupleEmoji(e)}
                      style={{ fontSize:19, background:coupleEmoji===e?"rgba(167,139,250,0.22)":"rgba(255,255,255,0.04)", border:`1px solid ${coupleEmoji===e?"rgba(167,139,250,0.55)":"rgba(255,255,255,0.08)"}`, borderRadius:8, padding:"4px 5px", cursor:"pointer", lineHeight:1, outline:"none" }}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Personas */}
          <div style={{ fontSize:10, color:"#6b5f88", letterSpacing:2, textTransform:"uppercase", fontWeight:600, marginBottom:14 }}>Personas</div>
          {personRow("person1","Persona 1",p1,setP1)}
          {personRow("person2","Persona 2",p2,setP2)}
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
            <div style={{ width:56, height:56, borderRadius:99, background:colors.together+"22", border:`2px solid ${colors.together}44`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ fontSize:22 }}>{coupleEmoji}</span>
            </div>
            <div style={{ flex:1 }}>
              <label style={S.label}>Juntos</label>
              <div style={{ fontSize:12, color:"#6b5f88", fontStyle:"italic" }}>Color para actividades en pareja</div>
            </div>
            <input type="color" value={colors.together} onChange={e=>setColor("together",e.target.value)}
              style={{ width:36, height:36, border:"none", borderRadius:8, cursor:"pointer", background:"none", padding:2, flexShrink:0 }} />
          </div>
          <button onClick={()=>setColors(DEFAULT_COLORS)} style={{ ...S.btnSecondary, fontSize:11, marginBottom:24 }}>↺ Restablecer colores</button>

          {/* Tema */}
          <div style={{ fontSize:10, color:"#6b5f88", letterSpacing:2, textTransform:"uppercase", fontWeight:600, marginBottom:10 }}>Tema de la app</div>
          <div style={{ marginBottom:8 }}>
            {/* Trigger */}
            <button onClick={()=>setThemeOpen(v=>!v)}
              style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"rgba(128,128,128,0.08)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.2))", borderRadius:themeOpen?"10px 10px 0 0":10, cursor:"pointer", fontFamily:"inherit", borderBottom:themeOpen?"none":"1px solid var(--t-card-border,rgba(167,139,250,0.2))" }}>
              <div style={{ display:"flex", gap:5 }}>
                {(THEMES.find(t=>t.id===themeId)||THEMES[0]).preview.map((c,i)=>(
                  <div key={i} style={{ width:11, height:11, borderRadius:99, background:c }} />
                ))}
              </div>
              <span style={{ flex:1, textAlign:"left", fontSize:13, color:"var(--t-text,#f8f4ff)", fontWeight:500 }}>
                {(THEMES.find(t=>t.id===themeId)||THEMES[0]).name}
              </span>
              <span style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)" }}>{themeOpen?"▲":"▼"}</span>
            </button>
            {/* Inline list — avoids overflow:auto clipping */}
            {themeOpen && (
              <div style={{ border:"1px solid var(--t-card-border,rgba(167,139,250,0.18))", borderTop:"none", borderRadius:"0 0 10px 10px", overflow:"hidden" }}>
                {THEMES.map(t=>(
                  <button key={t.id} onClick={()=>{ setThemeId(t.id); setThemeOpen(false); }}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:themeId===t.id?"var(--t-accent-soft,rgba(167,139,250,0.12))":"rgba(128,128,128,0.04)", border:"none", borderBottom:"1px solid rgba(128,128,128,0.08)", cursor:"pointer", width:"100%", fontFamily:"inherit" }}>
                    <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                      {t.preview.map((c,i)=><div key={i} style={{ width:10, height:10, borderRadius:99, background:c }} />)}
                    </div>
                    <span style={{ flex:1, fontSize:13, color:themeId===t.id?"var(--t-accent,#a78bfa)":"var(--t-text-muted,#8b7fa8)", textAlign:"left", fontWeight:themeId===t.id?600:400 }}>{t.name}</span>
                    {themeId===t.id && <span style={{ fontSize:12, color:"var(--t-accent,#a78bfa)" }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Footer */}
        <div style={{ padding:"14px 20px", borderTop:"1px solid var(--t-card-border,rgba(167,139,250,0.1))", display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={S.btnSecondary}>Cancelar</button>
          <button onClick={save} style={S.btnPrimary}>Guardar ✓</button>
        </div>
      </div>
    </div>
  );
}

function CatStatsCard({ catStats }) {
  const [tab, setTab] = useState("act");
  const maxC = Math.max(...catStats.map(x=>x.count),1);
  const lifeStats = catStats.filter(c=>c.id!=="trabajo");
  const workStat = catStats.find(c=>c.id==="trabajo");
  const maxLifeH = Math.max(...lifeStats.map(c=>c.dur),0.1);
  const maxWorkH = Math.max(workStat?.dur||0, 0.1);
  return (
    <div style={S.card}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", fontWeight:600 }}>🏷️ Por categoría</span>
        <div style={{ display:"flex", gap:3 }}>
          {[["act","Actividades"],["h","Horas"]].map(([v,l])=>(
            <button key={v} onClick={()=>setTab(v)} style={{ background:tab===v?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.04)", border:`1px solid ${tab===v?"rgba(167,139,250,0.4)":"rgba(255,255,255,0.08)"}`, borderRadius:7, color:tab===v?"#c4b8ff":"#6b5f88", padding:"3px 10px", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
      </div>
      {tab==="act"?catStats.map(c=>{ const cpct=c.count>0?Math.round((c.done/c.count)*100):0; return (
        <div key={c.id} style={{ marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span style={{ fontSize:12, color:c.color, fontWeight:600 }}>{c.icon} {c.label}</span>
            <span style={{ fontSize:12, color:cpct===100?"#34d399":"#6b5f88", fontWeight:600 }}>{c.done}/{c.count} ({cpct}%)</span>
          </div>
          <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:99, height:6, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${(c.count/maxC)*100}%`, background:c.color, borderRadius:99, opacity:0.8 }} />
          </div>
        </div>
      );}):(<>
        {lifeStats.filter(c=>c.dur>0).length>0&&<>
          <div style={{ fontSize:10, color:"#4a4166", letterSpacing:1.5, marginBottom:8 }}>VIDA</div>
          {lifeStats.filter(c=>c.dur>0).map(c=>(
            <div key={c.id} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:12, color:c.color, fontWeight:600 }}>{c.icon} {c.label}</span>
                <span style={{ fontSize:12, color:"#60a5fa" }}>{c.dur}h</span>
              </div>
              <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:99, height:6, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${(c.dur/maxLifeH)*100}%`, background:c.color, borderRadius:99, opacity:0.8 }} />
              </div>
            </div>
          ))}
        </>}
        {workStat&&workStat.dur>0&&<>
          <div style={{ borderTop:"1px dashed rgba(251,191,36,0.2)", marginTop:10, paddingTop:10, marginBottom:8 }}>
            <div style={{ fontSize:10, color:"#fbbf2488", letterSpacing:1.5 }}>TRABAJO <span style={{ color:"#4a4166", fontWeight:400 }}>(escala propia)</span></div>
          </div>
          <div style={{ marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:12, color:"#fbbf24", fontWeight:600 }}>💼 Trabajo</span>
              <span style={{ fontSize:12, color:"#fbbf24", fontWeight:700 }}>{workStat.dur}h</span>
            </div>
            <div style={{ background:"rgba(251,191,36,0.08)", borderRadius:99, height:8, overflow:"hidden", border:"1px solid rgba(251,191,36,0.15)" }}>
              <div style={{ height:"100%", width:"100%", background:"linear-gradient(90deg,#fbbf24,#f59e0b)", borderRadius:99, opacity:0.8 }} />
            </div>
          </div>
        </>}
        {!catStats.some(c=>c.dur>0)&&<div style={{ textAlign:"center", color:"#4a4166", fontSize:12, padding:"20px 0" }}>Sin horas registradas aún.</div>}
      </>)}
    </div>
  );
}

function StatsView({ weeks, p1, p2, colors, onGoToWeek }) {
  const clr = { ...DEFAULT_COLORS, ...(colors||{}) };
  const [stWho,        setStWho]        = useState("all");
  const [stRange,      setStRange]      = useState("all");
  const [showPartInfo, setShowPartInfo] = useState(false);

  // ── Datos filtrados ──────────────────────────────────────────────────────
  const { week: _tw, year: _ty } = getWeekAndYear();
  const todayKey = isoWeekKey(_tw, _ty);
  const sortedAll = Object.entries(weeks).filter(([key]) => key <= todayKey).sort((a,b)=>a[0].localeCompare(b[0]));
  const rangedEntries = stRange==="all" ? sortedAll : sortedAll.slice(-parseInt(stRange));
  const allW = rangedEntries.map(([key,w]) => {
    const ms = stWho==="all" ? (w.missions||[]) : (w.missions||[]).filter(m=>m.who===stWho);
    const _yr = parseInt(key.split("-W")[0]) || new Date().getFullYear();
    return { ...w, missions:ms, _yr };
  });
  const allM = allW.flatMap(w=>w.missions||[]);
  const total=allM.length, done=allM.filter(m=>m.status==="DONE"&&!m.completedLate).length;
  const pct=total>0?Math.round((done/total)*100):0, wc=allW.length;

  let bestStreak=0, currStreak=0, currStreakNow=0;
  for (const w of allW) {
    const d=w.missions?.filter(m=>m.status==="DONE").length||0, t=w.missions?.length||0;
    if (t>0 && d===t) { currStreak++; bestStreak=Math.max(bestStreak,currStreak); currStreakNow=currStreak; } else { currStreak=0; }
  }

  const bySt = STATUS_ORDER.map(s => ({ s, count:allM.filter(m=>m.status===s).length }));
  const maxSt = Math.max(...bySt.map(x=>x.count), 1);
  const totalDuration = allM.reduce((s,m)=>s+(m.duration||m.estimatedHours||0),0);
  const catStats = CATEGORIES.map(c => {
    const ms=allM.filter(m=>getMCats(m).includes(c.id));
    return { ...c, dur:ms.reduce((s,m)=>s+(m.duration||m.estimatedHours||0),0), count:ms.length, done:ms.filter(m=>m.status==="DONE").length };
  }).filter(c=>c.count>0).sort((a,b)=>b.count-a.count);
  // ph usa misiones sin filtrar por persona para que "participación" muestre siempre la distribución real
  const rawAllM = rangedEntries.flatMap(([,w]) => w.missions||[]);
  const ph = key => { const ms=rawAllM.filter(m=>m.who===key); return { count:ms.length, done:ms.filter(m=>m.status==="DONE").length }; };
  const ph1=ph("person1"), ph2=ph("person2"), phT=ph("together");
  const totalWork1=allW.reduce((s,w)=>s+(w.workHours?.person1||0),0), totalWork2=allW.reduce((s,w)=>s+(w.workHours?.person2||0),0);
  const series=allW.map(w=>{ const d=w.missions?.filter(m=>m.status==="DONE"&&!m.completedLate).length||0,t=w.missions?.length||0; return { label:`S${w.weekNumber}`, pct:t>0?Math.round((d/t)*100):0, durH:(w.missions||[]).reduce((s,m)=>s+(m.duration||m.estimatedHours||0),0), total:t, done:d, weekNumber:w.weekNumber, year:w._yr }; });
  const maxH=Math.max(...series.map(s=>s.durH),1);

  // ── Etapa 2: computed display vars ──────────────────────────────────────────
  const pctColor = pct>=80?"#34d399":pct>=50?"#fbbf24":"#f472b6";
  const barPersonColor = stWho==="person1"?clr.person1:stWho==="person2"?clr.person2:stWho==="together"?clr.together:null;
  const filterLabel = (stRange!=="all"?`Últ. ${stRange} sem.`:"Historial completo") + (stWho!=="all"?" · "+(stWho==="person1"?p1:stWho==="person2"?p2:"Juntos"):"");

  // ── AI Insights ─────────────────────────────────────────────────────────────
  const insights = [];
  // 1. Trend: compare last 3 vs prev 3
  if (series.length>=3) {
    const last3=series.slice(-3),prev3=series.slice(-6,-3);
    const avgL=last3.reduce((s,w)=>s+w.pct,0)/last3.length;
    const avgP=prev3.length>0?prev3.reduce((s,w)=>s+w.pct,0)/prev3.length:avgL;
    const lastW=last3[last3.length-1];
    if (avgL>avgP+12) insights.push({icon:"🚀",title:`Momento imparable: +${Math.round(avgL-avgP)}pts en 3 semanas`,desc:`De ${Math.round(avgP)}% a ${Math.round(avgL)}% de media. ¡Seguid así!`,weekNumber:lastW?.weekNumber,year:lastW?.year});
    else if (avgL<avgP-12) insights.push({icon:"📉",title:"Bajada de ritmo detectada",desc:`De ${Math.round(avgP)}% bajasteis a ${Math.round(avgL)}%. Esta semana es la oportunidad de remontar.`,weekNumber:lastW?.weekNumber,year:lastW?.year});
    else insights.push({icon:"➡️",title:`Consistencia sólida al ${Math.round(avgL)}%`,desc:`Lleváis 3 semanas sin grandes altibajos. Consistencia = progreso real 💪`});
  }
  // 2. Best and worst week — mínimo 5 misiones para ser representativa
  const weekScores=allW.filter(w=>isoWeekKey(w.weekNumber,w._yr)<todayKey).map(w=>{const d=w.missions?.filter(m=>m.status==="DONE"&&!m.completedLate).length||0,t=w.missions?.length||0;return{p:t>0?d/t:null,wn:w.weekNumber,yr:w._yr,obj:w.epicObjective,t,d};}).filter(w=>w.p!==null&&w.t>=5);
  if (weekScores.length>=2){
    const bW=weekScores.reduce((a,b)=>b.p>a.p?b:a);
    const wW=weekScores.reduce((a,b)=>b.p<a.p?b:a);
    if (Math.round(bW.p*100)>=60) insights.push({icon:"🏆",title:`Mejor semana: S${bW.wn}${bW.obj?` — "${bW.obj}"`:""}`,desc:`${bW.d}/${bW.t} completadas (${Math.round(bW.p*100)}%). ¡Vuestra semana récord!`,weekNumber:bW.wn,year:bW.yr});
    if (wW.wn!==bW.wn&&Math.round(wW.p*100)<40) insights.push({icon:"💡",title:`Semana floja: S${wW.wn} (${Math.round(wW.p*100)}%)`,desc:`Solo ${wW.d}/${wW.t} completadas. Explorad qué pasó para no repetirlo.`,weekNumber:wW.wn,year:wW.yr});
  }
  // 3. Category star + weak spot
  if (catStats.length>1){
    const sorted=[...catStats].sort((a,b)=>b.done/Math.max(b.count,1)-a.done/Math.max(a.count,1));
    const best=sorted[0],weak=sorted[sorted.length-1];
    if (best.count>1) insights.push({icon:best.icon,title:`${best.label}: vuestra categoría estrella`,desc:`${Math.round((best.done/best.count)*100)}% de completitud en ${best.count} misiones. Punto fuerte del equipo.`});
    if (weak.count>1&&Math.round((weak.done/weak.count)*100)<50) insights.push({icon:"⚠️",title:`${weak.label}: categoría con margen de mejora`,desc:`Solo ${Math.round((weak.done/weak.count)*100)}% completadas. Puede valer la pena revisar si las misiones son demasiado ambiciosas.`});
  }
  // 4. Balance P1 vs P2 — mínimo 6 misiones individuales para ser significativo
  const p1c=ph("person1").count,p2c=ph("person2").count;
  if (p1c+p2c>=6){
    const diff=Math.abs(p1c-p2c);
    const diffPct=Math.round((diff/(p1c+p2c))*100);
    if (diffPct>=25) insights.push({icon:"⚖️",title:`${p1c>p2c?p1:p2} lleva ${diff} misiones más`,desc:`${p1}: ${p1c} propias · ${p2}: ${p2c} propias. ¿Está el peso bien repartido?`});
    else insights.push({icon:"🤝",title:"Reparto equilibrado del trabajo",desc:`${p1}: ${p1c} · ${p2}: ${p2c}. Diferencia del ${diffPct}% — gran trabajo en equipo.`});
  }
  // 5. Work-life balance: ratio trabajo vs resto
  if (catStats.length>0){
    const workC=catStats.find(c=>c.id==="trabajo");
    const lifeTotal=catStats.filter(c=>c.id!=="trabajo").reduce((s,c)=>s+c.count,0);
    if (workC&&lifeTotal>0){
      const ratio=(workC.count/(workC.count+lifeTotal)*100);
      if (ratio>60) insights.push({icon:"💼",title:`Trabajo ocupa el ${Math.round(ratio)}% de las misiones`,desc:`Las misiones de trabajo dominan el plan. ¿Estáis dedicando suficiente tiempo a pareja y ocio?`});
      else if (ratio<20&&workC.count>0) insights.push({icon:"🌈",title:"Gran equilibrio vida-trabajo",desc:`Solo ${Math.round(ratio)}% de misiones son de trabajo. Tiempo de calidad bien aprovechado.`});
    }
  }
  // 6. Streak
  if (currStreakNow>=2) insights.push({icon:"🔥",title:`Racha activa: ${currStreakNow} semana${currStreakNow>1?"s":""} perfectas`,desc:`Lleváis ${currStreakNow} semanas al 100%. ¡No rompáis la cadena!`});
  // 7. Completion velocity (missions per week)
  if (wc>=4){const avgMpW=(total/wc).toFixed(1);insights.push({icon:"📊",title:`Media de ${avgMpW} misiones/semana`,desc:`Con ${total} misiones en ${wc} semanas. ${avgMpW<3?"Podéis añadir más retos":avgMpW>8?"Ritmo muy alto — aseguraos de que es sostenible":"Ritmo saludable"}.`});}

  if(total===0) return <div style={{ textAlign:"center", color:"#3d3360", padding:50 }}><div style={{ fontSize:40, marginBottom:12 }}>📊</div><div style={{ fontStyle:"italic" }}>Sin datos aún.</div></div>;

  // Donut chart for status
  const donutTotal = bySt.reduce((s,x)=>s+x.count,0);
  let donutOffset=0;
  const donutSegments = bySt.filter(x=>x.count>0).map(({s,count})=>{ const pct2=(count/donutTotal)*100; const seg={s,pct:pct2,offset:donutOffset}; donutOffset+=pct2; return seg; });
  const C=15.9155, R=5; // SVG circumference helper

  const whoOpts = [
    { id:"all", label:"Todos", color:"#8b7fa8" },
    { id:"person1", label:p1, color:clr.person1 },
    { id:"person2", label:p2, color:clr.person2 },
    { id:"together", label:"Juntos", color:clr.together },
  ];
  const rangeOpts = [
    { id:"all", label:"Siempre" },
    { id:"1", label:"Esta sem." },
    { id:"4", label:"4 sem." },
    { id:"8", label:"8 sem." },
    { id:"12", label:"12 sem." },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Filter bar */}
      <div style={{ ...S.card, padding:"10px 12px", display:"flex", flexDirection:"column", gap:9 }}>
        {/* Who */}
        <div style={{ display:"flex", gap:5, alignItems:"center" }}>
          <span style={{ fontSize:10, color:"#4a4166", textTransform:"uppercase", letterSpacing:1.2, flexShrink:0, width:40 }}>Quién</span>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {whoOpts.map(o=>{
              const active = stWho===o.id;
              return <button key={o.id} onClick={()=>setStWho(o.id)}
                style={{ background:active?`${o.color}22`:"rgba(255,255,255,0.03)", border:`1px solid ${active?o.color:"rgba(255,255,255,0.08)"}`, borderRadius:99, color:active?o.color:"#4a4166", padding:"3px 11px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:active?600:400, transition:"all 0.15s" }}>
                {o.label}
              </button>;
            })}
          </div>
        </div>
        {/* Range */}
        <div style={{ display:"flex", gap:5, alignItems:"center" }}>
          <span style={{ fontSize:10, color:"#4a4166", textTransform:"uppercase", letterSpacing:1.2, flexShrink:0, width:40 }}>Rango</span>
          <div style={{ display:"flex", gap:4 }}>
            {rangeOpts.map(o=>{
              const active = stRange===o.id;
              return <button key={o.id} onClick={()=>setStRange(o.id)}
                style={{ background:active?"rgba(167,139,250,0.18)":"rgba(255,255,255,0.03)", border:`1px solid ${active?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:99, color:active?"#c4b8ff":"#4a4166", padding:"3px 11px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:active?600:400, transition:"all 0.15s" }}>
                {o.label}
              </button>;
            })}
          </div>
        </div>
      </div>

      {/* AI Insights */}
      {insights.length>0&&<div style={{ ...S.card, borderColor:"rgba(244,114,182,0.25)", background:"linear-gradient(135deg,rgba(167,139,250,0.07),rgba(244,114,182,0.04))" }}>
        <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#f472b6", marginBottom:12, fontWeight:600 }}>✨ Análisis inteligente</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {insights.map((ins,i)=>(
            <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", paddingBottom:i<insights.length-1?10:0, borderBottom:i<insights.length-1?"1px solid rgba(167,139,250,0.1)":"none" }}>
              <span style={{ fontSize:18, lineHeight:1, flexShrink:0, marginTop:1 }}>{ins.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:2 }}>
                  <span style={{ fontSize:13, color:"#e2d9ff", fontWeight:600 }}>{ins.title}</span>
                  {ins.weekNumber&&onGoToWeek&&<button onClick={()=>onGoToWeek(ins.weekNumber,ins.year||new Date().getFullYear())}
                    style={{ background:"rgba(167,139,250,0.15)", border:"1px solid rgba(167,139,250,0.3)", borderRadius:99, color:"#a78bfa", fontSize:10, padding:"2px 9px", cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>
                    → S{ins.weekNumber}
                  </button>}
                </div>
                <div style={{ fontSize:12, color:"#8b7fa8", lineHeight:1.5 }}>{ins.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>}

      {/* KPIs */}
      <div>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:7 }}>
          <span style={{ fontSize:10, color:"#4a4166", background:"rgba(167,139,250,0.08)", border:"1px solid rgba(167,139,250,0.15)", borderRadius:99, padding:"2px 10px" }}>{filterLabel}</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8 }}>
          {[
            {label:"Semanas",value:wc,icon:"📅",color:null},
            {label:"Misiones",value:total,icon:"📝",color:null},
            {label:"Completadas",value:`${pct}%`,icon:"🏆",color:pctColor},
            {label:"Racha récord",value:bestStreak>0?`${bestStreak}🔥`:"—",icon:"⚡",color:bestStreak>=3?"#fbbf24":null},
          ].map(s=>(
            <div key={s.label} style={{ ...S.card, textAlign:"center", padding:"14px 6px", borderColor:s.color?`${s.color}55`:undefined }}>
              <div style={{ fontSize:22, marginBottom:3 }}>{s.icon}</div>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:700, color:s.color||"#f8f4ff", lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:9, color:"#6b5f88", textTransform:"uppercase", letterSpacing:1, marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Status donut + bars side by side */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", marginBottom:14, fontWeight:600 }}>📊 Distribución de estados</div>
        <div style={{ display:"flex", gap:16, alignItems:"center" }}>
          {/* Donut SVG */}
          <div style={{ flexShrink:0 }}>
            <svg viewBox="0 0 36 36" width={90} height={90} style={{ transform:"rotate(-90deg)" }}>
              <circle cx="18" cy="18" r="15.9155" strokeWidth="3.8" fill="none" stroke="rgba(255,255,255,0.05)"/>
              {donutSegments.map(({s,pct:p,offset})=>(
                <circle key={s} cx="18" cy="18" r="15.9155" fill="none" strokeWidth="3.8"
                  stroke={STATUS[s].color}
                  strokeDasharray={`${p} ${100-p}`}
                  strokeDashoffset={-offset}
                  style={{ opacity:0.85 }} />
              ))}
            </svg>
          </div>
          {/* Bars */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
            {bySt.filter(x=>x.count>0).map(({s,count})=>(
              <div key={s} style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:78, fontSize:12, color:STATUS[s].color, fontWeight:600, flexShrink:0 }}>{STATUS[s].icon} {STATUS[s].label}</div>
                <div style={{ flex:1, background:"rgba(255,255,255,0.06)", borderRadius:99, height:7, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${(count/maxSt)*100}%`, background:STATUS[s].color, borderRadius:99, opacity:0.85, transition:"width 0.5s" }} />
                </div>
                <div style={{ fontSize:12, color:"#8b7fa8", width:24, textAlign:"right", flexShrink:0 }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Completion % per week — normalizado al máximo, máx 12 semanas */}
      {series.length>1&&(()=>{
        const baseColor=barPersonColor||"#f472b6";
        const BAR_MAX=72; // px
        const displaySeries=series.slice(-12);
        return <div style={S.card}>
          <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", marginBottom:12, fontWeight:600 }}>✅ Progreso semana a semana</div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:BAR_MAX+28 }}>
            {displaySeries.map((w,i)=>{
              const isLast=i===displaySeries.length-1;
              const barH=w.total>0?Math.max(Math.round(w.pct/100*BAR_MAX),3):3;
              const barBg=w.pct===100?"linear-gradient(0deg,#34d399,#60a5fa)":isLast?`linear-gradient(0deg,${baseColor},${baseColor}cc)`:`linear-gradient(0deg,${baseColor}88,${baseColor}44)`;
              return <div key={w.label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                <div style={{ fontSize:9, color:isLast?baseColor:"#6b5f88", fontWeight:isLast?700:400, height:14, display:"flex", alignItems:"flex-end" }}>{w.total>0?`${w.pct}%`:""}</div>
                <div style={{ width:"100%", borderRadius:"3px 3px 0 0", height:barH, background:barBg, opacity:isLast?1:0.8, boxShadow:isLast?`0 0 6px ${baseColor}55`:"none", transition:"height 0.4s" }} />
                <div style={{ fontSize:9, color:isLast?baseColor:"#4a4166", fontWeight:isLast?700:400 }}>{w.label}</div>
              </div>;
            })}
          </div>
        </div>;
      })()}

      {/* Per person with mini visual bars — siempre desde rawAllM (sin filtro persona) */}
      <div style={S.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:showPartInfo?8:14 }}>
          <span style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", fontWeight:600 }}>👥 Participación por persona</span>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            {stWho!=="all"&&<span style={{ fontSize:10, color:"#4a4166", fontStyle:"italic" }}>distribución real del rango</span>}
            <button onClick={()=>setShowPartInfo(v=>!v)} title="¿Qué mide esto?" style={{ background:showPartInfo?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.05)", border:`1px solid ${showPartInfo?"rgba(167,139,250,0.45)":"rgba(255,255,255,0.1)"}`, borderRadius:99, color:showPartInfo?"#c4b8ff":"#6b5f88", fontSize:11, padding:"1px 7px", cursor:"pointer", fontFamily:"inherit", lineHeight:1.6 }}>ℹ</button>
          </div>
        </div>
        {showPartInfo&&<div style={{ marginBottom:12, padding:"8px 10px", background:"rgba(167,139,250,0.06)", border:"1px solid rgba(167,139,250,0.15)", borderRadius:8, fontSize:12, color:"#8b7fa8", lineHeight:1.6 }}>Muestra cuántas actividades tiene asignadas cada persona en el período seleccionado y qué porcentaje completó. No mide quién hizo más trabajo, sino cómo están distribuidas las responsabilidades.</div>}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[{name:p1,h:ph1,color:clr.person1},{name:p2,h:ph2,color:clr.person2},{name:"Juntos",h:phT,color:clr.together}].map(({name,h,color})=>{
            const tot=ph1.count+ph2.count+phT.count||1;
            return <div key={name} style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:64, fontSize:12, color, fontWeight:600, flexShrink:0 }}>{name}</div>
              <div style={{ flex:1, background:"rgba(255,255,255,0.06)", borderRadius:99, height:8, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${(h.count/tot)*100}%`, background:color, borderRadius:99, opacity:0.8 }} />
              </div>
              <div style={{ fontSize:12, color:"#8b7fa8", flexShrink:0, width:60, textAlign:"right" }}>
                {h.count} <span style={{ color:color, fontWeight:600 }}>{h.count>0?`(${Math.round((h.done/h.count)*100)}%✓)`:""}</span>
              </div>
            </div>;
          })}
        </div>
      </div>

      {/* By category — dual view (actividades / horas) */}
      {catStats.length>0&&<CatStatsCard catStats={catStats} />}

      {/* Work hours */}
      {(totalWork1>0||totalWork2>0)&&<div style={S.card}>
        <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#fbbf24", marginBottom:14, fontWeight:600 }}>💼 Horas laborales totales</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[[p1,totalWork1],[p2,totalWork2]].map(([name,h])=>(
            <div key={name} style={{ background:"rgba(251,191,36,0.07)", border:"1px solid rgba(251,191,36,0.15)", borderRadius:10, padding:"12px", textAlign:"center" }}>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:28, fontWeight:700, color:"#fbbf24" }}>{h}h</div>
              <div style={{ fontSize:12, color:"#8b7fa8", marginTop:2 }}>{name}</div>
            </div>
          ))}
        </div>
        {totalWork1>0&&totalWork2>0&&<div style={{ marginTop:10, fontSize:12, color:"#8b7fa8", textAlign:"center" }}>
          {Math.abs(totalWork1-totalWork2)<5?"⚖️ Carga laboral muy equilibrada"
            :totalWork1>totalWork2?`⚡ ${p1} trabajó ${totalWork1-totalWork2}h más esta temporada`
            :`⚡ ${p2} trabajó ${totalWork2-totalWork1}h más esta temporada`}
        </div>}
      </div>}

      {/* E4: Detalle por semana */}
      <WeekDetailList allW={allW} series={series} pctColor={pctColor} clr={clr} onGoToWeek={onGoToWeek} />

    </div>
  );
}

function WeekDetailList({ allW, series, pctColor, clr, onGoToWeek }) {
  const [open, setOpen] = useState(false);
  const rows = [...allW].reverse().map((w,ri) => {
    const ms = w.missions||[];
    const d = ms.filter(m=>m.status==="DONE").length;
    const t = ms.length;
    const pct = t>0 ? Math.round((d/t)*100) : 0;
    const color = pct===100?"#34d399":pct>=60?"#fbbf24":"#f472b6";
    return { w, d, t, pct, color };
  }).filter(r=>r.t>0);

  if (!rows.length) return null;

  return (
    <div style={S.card}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{ width:"100%", background:"none", border:"none", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", padding:0, fontFamily:"inherit" }}>
        <span style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", fontWeight:600 }}>📋 Detalle por semana</span>
        <span style={{ fontSize:12, color:"#4a4166", transition:"transform 0.2s", display:"inline-block", transform:open?"rotate(180deg)":"rotate(0deg)" }}>▾</span>
      </button>

      {open&&<div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:0 }}>
        {rows.map(({w,d,t,pct,color},i)=>(
          <div key={w.weekNumber} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0",
            borderTop:i>0?"1px solid rgba(255,255,255,0.04)":"none" }}>
            {/* Week badge */}
            <div style={{ minWidth:34, height:34, borderRadius:9, background:`${color}18`, border:`1px solid ${color}40`,
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ fontSize:9, color, fontWeight:700, lineHeight:1 }}>S{w.weekNumber}</span>
              <span style={{ fontSize:8, color:"#4a4166", lineHeight:1.2 }}>{w._yr}</span>
            </div>
            {/* Objective + mini bar */}
            <div style={{ flex:1, minWidth:0 }}>
              {w.epicObjective&&<div style={{ fontSize:11, color:"#8b7fa8", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginBottom:3 }}>
                {w.epicObjective}
              </div>}
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ flex:1, background:"rgba(255,255,255,0.06)", borderRadius:99, height:5, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:99, transition:"width 0.4s" }} />
                </div>
                <span style={{ fontSize:11, color, fontWeight:600, flexShrink:0, minWidth:36, textAlign:"right" }}>{d}/{t}</span>
              </div>
            </div>
            {/* Navigate */}
            {onGoToWeek&&<button onClick={()=>onGoToWeek(w.weekNumber,w._yr)}
              style={{ background:"rgba(167,139,250,0.1)", border:"1px solid rgba(167,139,250,0.2)", borderRadius:8,
                color:"#a78bfa", fontSize:11, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>
              → Ir
            </button>}
          </div>
        ))}
      </div>}
    </div>
  );
}

function CalendarView({ allDatedMissions, week, wkey, p1, p2, weeks, colors, onAddForDay, onDownloadICS, onDownloadPDF, onGoToWeek, onCycleStatus, onPatchMission, onDeleteMission, personFilter="all", catFilter=[], goals=[], settings }) {
  const today=new Date();
  const [calYear,setCalYear]=useState(today.getFullYear());
  const [calMonth,setCalMonth]=useState(today.getMonth());
  const [selectedDay,setSelectedDay]=useState(null);
  const [editingMission,setEditingMission]=useState(null);
  const [dragOver,setDragOver]=useState(null);
  const [cellPx,setCellPx]=useState(44);
  const [sharing,setSharing]=useState(false);
  const calRef=useRef(null);
  const MONTHS=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const DAYS=["L","M","X","J","V","S","D"];
  const prevM=()=>{if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1);setSelectedDay(null);};
  const nextM=()=>{if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1);setSelectedDay(null);};
  const firstDow=(new Date(calYear,calMonth,1).getDay()+6)%7, daysInM=new Date(calYear,calMonth+1,0).getDate();
  const todayStr=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const clrC=colors||DEFAULT_COLORS;

  useEffect(()=>{
    if(!calRef.current)return;
    const ro=new ResizeObserver(([e])=>{
      const w=e.contentRect.width;
      setCellPx(Math.max(32,Math.floor((w-18)/7)));
    });
    ro.observe(calRef.current);
    return()=>ro.disconnect();
  },[]);

  const numSz=cellPx<40?8:10;
  const emojiSz=cellPx<40?9:11;
  const maxPerCell=cellPx<40?2:3;
  const cellH=Math.max(48,cellPx);

  const getMissionDates=(m)=>{
    if(!m.date)return[];
    if(!m.time||!m.duration||m.duration<=0)return[m.date];
    const startMs=new Date(m.date+"T"+m.time).getTime();
    const endMs=startMs+m.duration*60000;
    const dates=[];
    const cur=new Date(m.date);
    while(cur.getTime()<endMs){
      const ds=`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}-${String(cur.getDate()).padStart(2,"0")}`;
      if(!dates.includes(ds))dates.push(ds);
      cur.setDate(cur.getDate()+1);
    }
    return dates;
  };

  const applyFilters=ms=>ms.filter(m=>(personFilter==="all"||m.who===personFilter)&&(!catFilter.length||getMCats(m).some(c=>catFilter.includes(c))));
  const byDate={};
  applyFilters(allDatedMissions).forEach(m=>{
    getMissionDates(m).forEach(ds=>{
      if(!byDate[ds])byDate[ds]=[];
      byDate[ds].push(m);
    });
  });

  const cells=[...Array(firstDow).fill(null),...Array.from({length:daysInM},(_,i)=>i+1)];
  const selStr=selectedDay?`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(selectedDay).padStart(2,"0")}`:null;
  const selMs=selStr?(byDate[selStr]||[]):[];

  const onDragStart=(e,m)=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",JSON.stringify({id:m.id,wn:m.weekNumber,yr:m._yr}));};
  const onDropDay=(e,dateStr)=>{
    e.preventDefault();setDragOver(null);
    try{const{id,wn,yr}=JSON.parse(e.dataTransfer.getData("text/plain"));onPatchMission&&onPatchMission(wn,yr,id,{date:dateStr});}catch(err){console.warn("drop err",err);}
  };

  const openEdit=m=>setEditingMission({mission:m,wn:m.weekNumber,yr:m._yr});
  const closeEdit=()=>setEditingMission(null);
  const patchEditing=patch=>{
    if(!editingMission)return;
    onPatchMission&&onPatchMission(editingMission.wn,editingMission.yr,editingMission.mission.id,patch);
    setEditingMission(p=>({...p,mission:{...p.mission,...patch}}));
  };

  const dlBlob=(blob,name)=>{
    const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);
  };

  const doShare=async(type,payload)=>{
    setSharing(true);
    try{
      const W=600,PAD=24;
      const coupleEmoji=settings?.coupleEmoji||"💞";
      const coupleLabel=`${p1} & ${p2}`;
      let rows=[];
      if(type==="week"){
        const ms=applyFilters(allDatedMissions).slice(0,20);
        rows=[{t:"h",text:`${coupleEmoji} ${coupleLabel}`},{t:"s",text:`${MONTHS[calMonth]} ${calYear}`},{t:"div"},...ms.map(m=>({t:"m",m}))];
      }else if(type==="day"){
        rows=[{t:"h",text:`${coupleEmoji} ${coupleLabel}`},{t:"s",text:`${payload.day} de ${MONTHS[calMonth]}`},{t:"div"},...payload.ms.map(m=>({t:"m",m}))];
      }else if(type==="task"){
        rows=[{t:"h",text:`${coupleEmoji} ${coupleLabel}`},{t:"div"},{t:"tk",m:payload.m}];
      }
      let H=PAD*2+52;
      rows.forEach(r=>{if(r.t==="s")H+=22;else if(r.t==="div")H+=20;else if(r.t==="m")H+=30;else if(r.t==="tk")H+=66;});
      H=Math.max(H,100);
      const cvs=document.createElement("canvas");cvs.width=W;cvs.height=H;
      const ctx=cvs.getContext("2d");
      ctx.fillStyle="#0a0714";ctx.fillRect(0,0,W,H);
      ctx.fillStyle="rgba(167,139,250,0.06)";ctx.fillRect(12,12,W-24,H-24);
      ctx.strokeStyle="rgba(167,139,250,0.22)";ctx.lineWidth=1;ctx.strokeRect(12,12,W-24,H-24);
      let y=PAD;
      rows.forEach(r=>{
        if(r.t==="h"){
          ctx.font="bold 22px system-ui,sans-serif";ctx.fillStyle="#c4b8ff";ctx.textAlign="center";
          ctx.fillText(r.text,W/2,y+28);y+=52;
        }else if(r.t==="s"){
          ctx.font="13px system-ui,sans-serif";ctx.fillStyle="#7c6fa0";ctx.textAlign="center";
          ctx.fillText(r.text,W/2,y+14);y+=22;
        }else if(r.t==="div"){
          ctx.strokeStyle="rgba(167,139,250,0.18)";ctx.lineWidth=1;
          ctx.beginPath();ctx.moveTo(PAD+16,y+10);ctx.lineTo(W-PAD-16,y+10);ctx.stroke();
          y+=20;
        }else if(r.t==="m"){
          const m=r.m,icon=STATUS[m.status]?.icon||"⏳";
          const who=m.who==="person1"?p1:m.who==="person2"?p2:"juntos";
          ctx.font="14px system-ui,sans-serif";ctx.fillStyle=m.status==="DONE"?"#4d4566":"#e2d9ff";ctx.textAlign="left";
          ctx.fillText(`${m.emoji} ${m.title}`,PAD+16,y+14);
          ctx.font="11px system-ui,sans-serif";ctx.fillStyle="#7c6fa0";
          ctx.fillText(`${icon} ${who}${m.date?" · "+m.date:""}`,PAD+16,y+26);
          y+=30;
        }else if(r.t==="tk"){
          const m=r.m,icon=STATUS[m.status]?.icon||"⏳";
          const who=m.who==="person1"?p1:m.who==="person2"?p2:"Juntos";
          ctx.font="bold 20px system-ui,sans-serif";ctx.fillStyle="#e2d9ff";ctx.textAlign="left";
          ctx.fillText(`${m.emoji} ${m.title}`,PAD+16,y+26);
          ctx.font="13px system-ui,sans-serif";ctx.fillStyle="#a78bfa";
          ctx.fillText(`${icon} ${who}${m.date?" · "+m.date:""}${m.time?" · "+m.time:""}`,PAD+16,y+48);
          y+=66;
        }
      });
      ctx.font="10px system-ui,sans-serif";ctx.fillStyle="rgba(100,80,140,0.45)";ctx.textAlign="center";
      ctx.fillText("Misiones de Pareja",W/2,H-14);
      cvs.toBlob(async blob=>{
        const fname=`misiones-${type}-${Date.now()}.png`;
        if(navigator.share&&navigator.canShare){
          const file=new File([blob],fname,{type:"image/png"});
          if(navigator.canShare({files:[file]})){await navigator.share({files:[file],title:coupleLabel});setSharing(false);return;}
        }
        dlBlob(blob,fname);setSharing(false);
      },"image/png");
    }catch(e){console.warn("share err",e);setSharing(false);}
  };

  return (
    <div>
      {/* Action buttons */}
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        <button onClick={onDownloadICS} style={{...S.btnSecondary,flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"9px 10px",borderColor:"rgba(52,211,153,0.3)",color:"#34d399",fontSize:12}}>📅 Google Calendar (.ics)</button>
        <button onClick={onDownloadPDF} style={{...S.btnSecondary,flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"9px 10px",borderColor:"rgba(167,139,250,0.3)",color:"#a78bfa",fontSize:12}}>🖨️ PDF semana</button>
        <button onClick={()=>doShare("week",{})} disabled={sharing} style={{...S.btnSecondary,display:"flex",alignItems:"center",gap:5,padding:"9px 10px",borderColor:"rgba(244,114,182,0.3)",color:"#f472b6",fontSize:12}}>{sharing?"⏳":"📤"} Compartir</button>
      </div>

      {/* 2-col layout: calendar + day detail */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,alignItems:"start"}}>
        {/* Calendar column */}
        <div ref={calRef}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:16}}>
            <button onClick={prevM} style={S.btnNav}>‹</button>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:600,minWidth:160,textAlign:"center"}}>{MONTHS[calMonth]} {calYear}</div>
            <button onClick={nextM} style={S.btnNav}>›</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:3}}>
            {DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:numSz,color:"#4a4166",fontWeight:600,padding:"3px 0"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
            {cells.map((day,i)=>{
              if(!day)return<div key={`e${i}`}/>;
              const ds=`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const ms=byDate[ds]||[],isTd=ds===todayStr,isSel=day===selectedDay,isDO=dragOver===ds;
              const hasMultiDay=ms.some(m=>getMissionDates(m).length>1);
              return<div key={day} onClick={()=>setSelectedDay(isSel?null:day)}
                onDragEnter={e=>{e.preventDefault();setDragOver(ds);}} onDragOver={e=>e.preventDefault()} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDragOver(null);}} onDrop={e=>onDropDay(e,ds)}
                style={{borderRadius:8,minHeight:cellH,padding:"4px 3px",cursor:"pointer",
                  background:isDO?"rgba(167,139,250,0.3)":isSel?"rgba(167,139,250,0.22)":isTd?"rgba(244,114,182,0.1)":ms.length>0?"rgba(167,139,250,0.06)":"rgba(255,255,255,0.02)",
                  border:isDO?"1px solid rgba(167,139,250,0.7)":isSel?"1px solid rgba(167,139,250,0.55)":isTd?"1px solid rgba(244,114,182,0.4)":"1px solid rgba(255,255,255,0.04)",transition:"all 0.12s"}}>
                <div style={{fontSize:numSz,fontWeight:600,marginBottom:2,textAlign:"center",color:isTd?"#f472b6":isSel?"#c4b8ff":"#4a4166"}}>{day}</div>
                {hasMultiDay&&<div style={{textAlign:"center",fontSize:8,color:"#a78bfa",lineHeight:1,marginBottom:1}}>↔</div>}
                <div style={{display:"flex",flexWrap:"wrap",gap:2,justifyContent:"center"}}>
                  {ms.slice(0,maxPerCell).map(m=>{const bg=m.who==="person1"?clrC.person1:m.who==="person2"?clrC.person2:clrC.together;return<span key={m.id+ds} draggable onDragStart={e=>{e.stopPropagation();onDragStart(e,m);}} onDragEnd={()=>setDragOver(null)} title={m.title} style={{fontSize:emojiSz,lineHeight:1,background:`${bg}30`,border:`1px solid ${bg}55`,borderRadius:3,padding:"1px 2px",opacity:m.status==="DONE"?0.4:1,cursor:"grab"}}>{m.emoji}</span>;})}
                  {ms.length>maxPerCell&&<span style={{fontSize:8,color:"#4a4166"}}>+{ms.length-maxPerCell}</span>}
                </div>
              </div>;
            })}
          </div>
        </div>

        {/* Day detail column */}
        <div>
          {selectedDay?<div style={{...S.card,borderColor:"rgba(167,139,250,0.3)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"#a78bfa",fontWeight:600}}>{selectedDay} de {MONTHS[calMonth]}</div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>doShare("day",{day:selectedDay,ms:selMs})} disabled={sharing||!selMs.length} style={{...S.btnSecondary,fontSize:11,padding:"4px 8px",color:"#f472b6",borderColor:"rgba(244,114,182,0.3)"}}>📤</button>
                {onAddForDay&&<button onClick={()=>onAddForDay(selStr)} style={{...S.btnPrimary,fontSize:11,padding:"5px 10px"}}>+ Añadir</button>}
              </div>
            </div>
            {selMs.length===0?<div style={{color:"#3d3360",fontStyle:"italic",fontSize:13}}>Sin misiones para este día</div>:
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {selMs.map(m=>{
                  const whoColor=m.who==="person1"?clrC.person1:m.who==="person2"?clrC.person2:clrC.together;
                  const isMultiDay=getMissionDates(m).length>1;
                  return<div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid rgba(167,139,250,0.08)"}}>
                    <span style={{fontSize:20,flexShrink:0}}>{m.emoji}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,color:m.status==="DONE"?"#4d4566":"#e2d9ff",textDecoration:m.status==="DONE"?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {m.title}{isMultiDay&&<span style={{fontSize:10,marginLeft:4,color:"#a78bfa"}}>↔</span>}
                      </div>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:2}}>
                        {m.time&&<span style={{fontSize:10,color:"#a78bfa"}}>🕐 {m.time}</span>}
                        {m.duration>0&&<span style={{fontSize:10,color:"#7c6fa0"}}>{m.duration>=60?`${Math.floor(m.duration/60)}h${m.duration%60?m.duration%60+"m":""}`:m.duration+"m"}</span>}
                        {getMCats(m).map(ci=>{const c=CAT_MAP[ci];return c?<span key={ci} style={{fontSize:10,color:c.color}}>{c.icon}</span>:null;})}
                        <span style={{fontSize:10,background:`${whoColor}18`,color:whoColor,border:`1px solid ${whoColor}40`,padding:"0 5px",borderRadius:99}}>{m.who==="person1"?p1:m.who==="person2"?p2:"👫"}</span>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:4,flexShrink:0}}>
                      <button onClick={()=>doShare("task",{m})} disabled={sharing} style={{background:"rgba(244,114,182,0.1)",border:"1px solid rgba(244,114,182,0.2)",borderRadius:7,color:"#f472b6",fontSize:11,padding:"4px 6px",cursor:"pointer",fontFamily:"inherit"}}>📤</button>
                      <button onClick={()=>onCycleStatus&&onCycleStatus(m.weekNumber,m._yr,m.id)} style={badgeStyle(m.status)}>{STATUS[m.status].icon}</button>
                      <button onClick={()=>openEdit(m)} style={{background:"rgba(167,139,250,0.12)",border:"1px solid rgba(167,139,250,0.25)",borderRadius:7,color:"#a78bfa",fontSize:11,padding:"4px 8px",cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                    </div>
                  </div>;
                })}
              </div>
            }
          </div>:<div style={{...S.card,borderColor:"rgba(167,139,250,0.1)",color:"#3d3360",fontStyle:"italic",fontSize:13,textAlign:"center",padding:"32px 16px"}}>
            Toca un día para ver sus misiones
          </div>}
        </div>
      </div>

      {/* Inline edit modal */}
      {editingMission&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={closeEdit}>
        <div style={{background:"#1d1733",border:"1px solid rgba(167,139,250,0.35)",borderRadius:16,padding:20,width:"100%",maxWidth:420,maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <span style={{fontSize:13,fontWeight:600,color:"#c4b8ff"}}>✏️ Editar actividad</span>
            <button onClick={closeEdit} style={{background:"none",border:"none",color:"#6b5f88",fontSize:20,cursor:"pointer"}}>×</button>
          </div>
          <div style={{marginBottom:10}}><label style={S.label}>Título</label><input value={editingMission.mission.title} onChange={e=>patchEditing({title:e.target.value})} style={S.input} /></div>
          <div style={{marginBottom:10}}>
            <label style={S.label}>Participante</label>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {[{id:"person1",label:p1},{id:"person2",label:p2},{id:"together",label:"👫 Juntos"}].map(w=>(
                <button key={w.id} onClick={()=>patchEditing({who:w.id})}
                  style={{background:editingMission.mission.who===w.id?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${editingMission.mission.who===w.id?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`,borderRadius:8,color:editingMission.mission.who===w.id?"#c4b8ff":"#6b5f88",padding:"5px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>{w.label}</button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <label style={S.label}>Categoría (multi)</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {CATEGORIES.map(c=>{const sel=getMCats(editingMission.mission).includes(c.id);return<button key={c.id} onClick={()=>{const cur=getMCats(editingMission.mission);patchEditing({categories:sel?cur.filter(x=>x!==c.id):[...cur,c.id],category:null});}} style={{...catBadgeStyle(c.id),cursor:"pointer",border:`1px solid ${c.color}${sel?"":"20"}`,opacity:sel||!getMCats(editingMission.mission).length?1:0.4}}>{c.icon} {c.label}</button>;})}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div><label style={S.label}>📆 Fecha</label><input type="date" value={editingMission.mission.date||""} onChange={e=>patchEditing({date:e.target.value||null})} style={{...S.inputSm,colorScheme:"dark"}} /></div>
            <div><label style={S.label}>🕐 Hora</label><input type="time" value={editingMission.mission.time||""} onChange={e=>patchEditing({time:e.target.value||null})} style={{...S.inputSm,colorScheme:"dark"}} /></div>
          </div>
          <div style={{marginBottom:10}}>
            <label style={S.label}>Estado</label>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {STATUS_ORDER.map(s=><button key={s} onClick={()=>patchEditing({status:s,completedAt:s==="DONE"?Date.now():null})} style={{...badgeStyle(s),opacity:editingMission.mission.status===s?1:0.35}}>{STATUS[s].icon} {STATUS[s].label}</button>)}
            </div>
          </div>
          {goals.filter(g=>g.active!==false).length>0&&<div style={{marginBottom:10}}>
            <label style={S.label}>🏅 Meta</label>
            <select value={editingMission.mission.goalId||""} onChange={e=>patchEditing({goalId:e.target.value||null})} style={{...S.input,fontSize:13,colorScheme:"dark",background:"rgba(16,10,32,0.95)",color:"var(--t-text,#f8f4ff)"}}>
              <option value="">— Sin meta —</option>
              {goals.filter(g=>g.active!==false).map(g=><option key={g.id} value={g.id}>{g.emoji} {g.title}</option>)}
            </select>
          </div>}
          <div style={{display:"flex",gap:8,justifyContent:"space-between",marginTop:14}}>
            <button onClick={()=>{if(window.confirm("¿Eliminar esta actividad?"))onDeleteMission&&onDeleteMission(editingMission.wn,editingMission.yr,editingMission.mission.id);closeEdit();}} style={{...S.btnSecondary,color:"#f472b6",borderColor:"rgba(244,114,182,0.3)"}}>🗑 Eliminar</button>
            <button onClick={closeEdit} style={S.btnPrimary}>Listo ✓</button>
          </div>
        </div>
      </div>}
    </div>
  );
}

function EmojiSelect({ value, onChange }) {
  const [open,setOpen]=useState(false), [ag,setAg]=useState(0);
  return (
    <div style={{ position:"relative", flexShrink:0 }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ fontSize:22, background:"none", border:"none", cursor:"pointer", padding:"0 2px", lineHeight:1 }}>{value}</button>
      {open&&<><div onClick={()=>setOpen(false)} style={{ position:"fixed", inset:0, zIndex:9 }}/>
        <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:10, background:"#1a1330", border:"1px solid rgba(167,139,250,0.25)", borderRadius:14, width:260, boxShadow:"0 12px 40px rgba(0,0,0,0.7)", overflow:"hidden" }}>
          <div style={{ display:"flex", overflowX:"auto", padding:"8px 8px 0", gap:4, scrollbarWidth:"none" }}>
            {EMOJI_GROUPS.map((g,i)=><button key={i} onClick={()=>setAg(i)} style={{ background:ag===i?"rgba(167,139,250,0.25)":"none", border:"none", borderRadius:8, padding:"4px 6px", cursor:"pointer", fontSize:14, flexShrink:0 }}>{g.label.split(" ")[0]}</button>)}
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:3, padding:"8px 10px 10px", maxHeight:180, overflowY:"auto", overscrollBehavior:"contain" }}>
            {EMOJI_GROUPS[ag].emojis.map(e=><button key={e} onClick={()=>{onChange(e);setOpen(false);}} style={{ fontSize:20, background:"none", border:"none", cursor:"pointer", padding:4, borderRadius:8 }}
              onMouseEnter={ev=>ev.currentTarget.style.background="rgba(167,139,250,0.2)"} onMouseLeave={ev=>ev.currentTarget.style.background="none"}>{e}</button>)}
          </div>
        </div>
      </>}
    </div>
  );
}

// ─── P5 Goals ─────────────────────────────────────────────────────────────────
function GoalForm({ form, setForm, onSave, onCancel, isEdit, p1, p2 }) {
  const WHO = [{id:"together",label:"Juntos",icon:"👫"},{id:"person1",label:p1,icon:"🙋"},{id:"person2",label:p2,icon:"🙋"}];
  const PERIODS = [{id:"weekly",label:"Semanal"},{id:"monthly",label:"Mensual"},{id:"annual",label:"Anual"}];
  return (
    <div style={{ ...S.card, borderColor:"rgba(167,139,250,0.35)" }}>
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10 }}>
        <EmojiSelect value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e}))} />
        <input autoFocus value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&onSave()} placeholder="Nombre de la meta..." style={S.input} />
      </div>
      <div style={{ marginBottom:10 }}>
        <label style={S.label}>¿Para quién?</label>
        <div style={{ display:"flex", gap:5 }}>
          {WHO.map(w=><button key={w.id} onClick={()=>setForm(f=>({...f,who:w.id}))} style={{ background:form.who===w.id?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.04)", border:`1px solid ${form.who===w.id?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:8, color:form.who===w.id?"#c4b8ff":"#6b5f88", padding:"5px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>{w.icon} {w.label}</button>)}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10, marginBottom:12, alignItems:"end" }}>
        <div>
          <label style={S.label}>Periodicidad</label>
          <div style={{ display:"flex", gap:4 }}>
            {PERIODS.map(p=><button key={p.id} onClick={()=>setForm(f=>({...f,period:p.id}))} style={{ flex:1, background:form.period===p.id?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.04)", border:`1px solid ${form.period===p.id?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:7, color:form.period===p.id?"#c4b8ff":"#6b5f88", padding:"5px 6px", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>{p.label}</button>)}
          </div>
        </div>
        <div style={{ textAlign:"center" }}>
          <label style={S.label}>{(form.goalType||"min")==="min"?"Mínimo":"Máximo"}</label>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <button onClick={()=>setForm(f=>({...f,target:Math.max(1,f.target-1)}))} style={{ ...S.btnSecondary, padding:"4px 10px", fontSize:16 }}>−</button>
            <span style={{ fontFamily:"'Fraunces',serif", fontSize:22, color:"#f8f4ff", minWidth:20, textAlign:"center" }}>{form.target}</span>
            <button onClick={()=>setForm(f=>({...f,target:f.target+1}))} style={{ ...S.btnSecondary, padding:"4px 10px", fontSize:16 }}>+</button>
          </div>
        </div>
      </div>
      <div style={{ marginBottom:10 }}>
        <label style={S.label}>Tipo de límite</label>
        <div style={{ display:"flex", gap:4 }}>
          {[{id:"min",label:"✅ Mínimo (hacer al menos X)"},{id:"max",label:"🚫 Máximo (no más de X)"}].map(t=>(
            <button key={t.id} onClick={()=>setForm(f=>({...f,goalType:t.id}))} style={{ flex:1, background:(form.goalType||"min")===t.id?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.04)", border:`1px solid ${(form.goalType||"min")===t.id?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:7, color:(form.goalType||"min")===t.id?"#c4b8ff":"#6b5f88", padding:"5px 6px", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>{t.label}</button>
          ))}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
        <div>
          <label style={S.label}>📅 Analizar desde (opcional)</label>
          <input type="date" value={form.startDate||""} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} style={{ ...S.inputSm, colorScheme:"dark" }} />
        </div>
        <div>
          <label style={S.label}>📅 Deadline (opcional)</label>
          <input type="date" value={form.deadline||""} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} style={{ ...S.inputSm, colorScheme:"dark" }} />
        </div>
      </div>
      <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
        <button onClick={onCancel} style={S.btnSecondary}>Cancelar</button>
        <button onClick={onSave} style={S.btnPrimary}>{isEdit?"Guardar ✓":"Crear meta ✨"}</button>
      </div>
    </div>
  );
}

function GoalCard({ goal, progress, history, p1, p2, colors, onEdit, onArchive }) {
  const clr = colors||DEFAULT_COLORS;
  const whoColor = goal.who==="person1"?clr.person1:goal.who==="person2"?clr.person2:clr.together;
  const whoLabel = goal.who==="person1"?p1:goal.who==="person2"?p2:"Juntos";
  const whoIcon = goal.who==="together"?"👫":"🙋";
  const isMax = goal.goalType==="max";
  const met = isMax ? progress.current<=progress.target : progress.current>=progress.target;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!goal.deadline) return;
    const dl=new Date(goal.deadline); dl.setHours(23,59,59);
    if ((dl-new Date())>86400000) return; // only run interval for <24h
    const id=setInterval(()=>setTick(t=>t+1),1000);
    return ()=>clearInterval(id);
  },[goal.deadline]);
  return (
    <div style={{ ...S.card, borderColor:met?`${clr.together}50`:"rgba(167,139,250,0.12)", transition:"border-color 0.3s" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <span style={{ fontSize:28 }}>{goal.emoji}</span>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:"#f0e8ff" }}>{goal.title}</div>
            <div style={{ display:"flex", gap:5, marginTop:3, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, background:`${whoColor}18`, color:whoColor, border:`1px solid ${whoColor}40`, padding:"1px 6px", borderRadius:99 }}>{whoIcon} {whoLabel}</span>
              <span style={{ fontSize:11, color:"#6b5f88" }}>{PERIOD_EMOJI[goal.period]} {PERIOD_LABEL[goal.period]} · {isMax?"máx.":"mín."} {goal.target}×</span>
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:2 }}>
          <button onClick={onEdit} style={{ background:"none", border:"none", cursor:"pointer", color:"#4a4166", fontSize:15, padding:"3px 5px" }}
            onMouseEnter={e=>e.currentTarget.style.color="#a78bfa"} onMouseLeave={e=>e.currentTarget.style.color="#4a4166"}>✏️</button>
          <button onClick={onArchive} title="Archivar" style={{ background:"none", border:"none", cursor:"pointer", color:"#4a4166", fontSize:13, padding:"3px 5px" }}
            onMouseEnter={e=>e.currentTarget.style.color="#fb923c"} onMouseLeave={e=>e.currentTarget.style.color="#4a4166"}>📦</button>
        </div>
      </div>
      {/* Progreso período actual */}
      <div style={{ marginBottom:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:5 }}>
          <span style={{ color:"#8b7fa8" }}>{goal.period==="weekly"?"Esta semana":goal.period==="monthly"?"Este mes":"Este año"}</span>
          <span style={{ color:met?"#34d399":isMax&&progress.current>progress.target?"#f472b6":"#f8f4ff", fontWeight:600 }}>{met?"✅ ":isMax&&progress.current>progress.target?"❌ ":""}{progress.current}/{progress.target}{isMax?" (máx.)":""}</span>
        </div>
        <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:99, height:8, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${progress.pct}%`, background:met?"linear-gradient(90deg,#34d399,#60a5fa)":isMax&&progress.current>progress.target?"linear-gradient(90deg,#f472b6,#fb923c)":`linear-gradient(90deg,${whoColor},${whoColor}99)`, borderRadius:99, transition:"width 0.5s" }} />
        </div>
      </div>
      {/* Countdown */}
      {goal.deadline&&(()=>{
        const dl=new Date(goal.deadline); dl.setHours(23,59,59);
        const msLeft=dl-new Date();
        const expired=msLeft<0;
        const under24h=!expired&&msLeft<86400000;
        let label;
        if (expired){const d=Math.floor(-msLeft/86400000);label=`💀 Venció hace ${d||1} día${d!==1?"s":""}`;}
        else if (under24h){
          const h=Math.floor(msLeft/3600000),m=Math.floor((msLeft%3600000)/60000),s=Math.floor((msLeft%60000)/1000);
          label=`⏰ ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")} restantes`;
        } else {const d=Math.ceil(msLeft/86400000);label=`⏳ ${d} día${d!==1?"s":""} para el deadline`;}
        const urgent=!expired&&msLeft<7*86400000;
        return <div style={{ marginBottom:10, display:"flex", alignItems:"center", gap:6, background:expired?"rgba(244,114,182,0.1)":under24h?"rgba(244,114,182,0.08)":urgent?"rgba(251,146,60,0.08)":"rgba(167,139,250,0.06)", border:`1px solid ${expired||under24h?"rgba(244,114,182,0.3)":urgent?"rgba(251,146,60,0.25)":"rgba(167,139,250,0.15)"}`, borderRadius:8, padding:"6px 10px" }}>
          <span style={{ fontSize:12, color:expired||under24h?"#f472b6":urgent?"#fb923c":"#8b7fa8", fontWeight:600, fontFamily:under24h?"monospace":"inherit", letterSpacing:under24h?1:0 }}>{label}</span>
          <span style={{ fontSize:11, color:"#4a4166", marginLeft:"auto" }}>{goal.deadline}</span>
        </div>;
      })()}
      {/* Historial */}
      {history.length>0&&<div>
        <div style={{ fontSize:9, letterSpacing:1.5, textTransform:"uppercase", color:"#4a4166", marginBottom:5 }}>Historial</div>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {history.map((h,i)=>{
            const failed=!h.met&&(h.count>0||h.isPast)&&!h.noData;
            const noData=!!h.noData;
            return <div key={i} title={noData?`${h.label}: sin datos`:`${h.label}: ${h.count}/${goal.target}`}
              style={{ minWidth:28, height:28, borderRadius:7, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontSize:10, gap:1,
                background:noData?"rgba(255,255,255,0.02)":failed?"rgba(244,114,182,0.18)":h.met?"rgba(52,211,153,0.15)":"rgba(255,255,255,0.04)",
                border:`1px solid ${noData?"rgba(255,255,255,0.06)":failed?"rgba(244,114,182,0.45)":h.met?"rgba(52,211,153,0.35)":"rgba(255,255,255,0.07)"}`,
                color:noData?"#2d2450":failed?"#f472b6":h.met?"#34d399":"#4a4166", padding:"0 4px" }}>
              <span style={{ fontSize:11 }}>{noData?"–":failed?"❌":h.met?"✅":"·"}</span>
              <span style={{ fontSize:8 }}>{h.label}</span>
            </div>;
          })}
        </div>
      </div>}
    </div>
  );
}

function GoalsView({ goals, weeks, cwn, cyr, p1, p2, colors, onAdd, onUpdate, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [form, setForm] = useState({ emoji:"🏅", title:"", who:"together", period:"monthly", target:1 });

  const openNew = () => { setEditGoal(null); setForm({emoji:"🏅",title:"",who:"together",period:"monthly",target:1,deadline:"",goalType:"min",startDate:""}); setShowForm(true); };
  const openEdit = g => { setEditGoal(g); setForm({emoji:g.emoji,title:g.title,who:g.who,period:g.period,target:g.target,deadline:g.deadline||"",goalType:g.goalType||"min",startDate:g.startDate||""}); setShowForm(true); };
  const cancel = () => { setShowForm(false); setEditGoal(null); };
  const save = () => {
    if (!form.title.trim()) return;
    if (editGoal) onUpdate(editGoal.id, form); else onAdd(form);
    setShowForm(false); setEditGoal(null);
  };

  const active = (goals||[]).filter(g=>g.active!==false);
  const archived = (goals||[]).filter(g=>g.active===false);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#a78bfa", fontWeight:600 }}>🏅 Metas activas</div>
        {!showForm&&<button onClick={openNew} style={S.btnPrimary}>+ Nueva meta</button>}
      </div>

      {showForm&&<GoalForm form={form} setForm={setForm} onSave={save} onCancel={cancel} isEdit={!!editGoal} p1={p1} p2={p2} />}

      {active.map(g=>{
        const prog = computeGoalProgress(g, weeks, cwn, cyr);
        const hist = computeGoalHistory(g, weeks);
        return <GoalCard key={g.id} goal={g} progress={prog} history={hist} p1={p1} p2={p2} colors={colors}
          onEdit={()=>openEdit(g)} onArchive={()=>onUpdate(g.id,{active:false})} />;
      })}

      {!active.length&&!showForm&&<div style={{ textAlign:"center", padding:48, color:"#3d3360" }}>
        <div style={{ fontSize:44, marginBottom:12 }}>🏅</div>
        <div style={{ fontStyle:"italic", fontSize:14 }}>Sin metas activas aún.<br/>¡Crea la primera!</div>
      </div>}

      {archived.length>0&&<div>
        <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#4a4166", fontWeight:600, marginBottom:8, marginTop:4 }}>Archivadas</div>
        {archived.map(g=>(
          <div key={g.id} style={{ ...S.card, opacity:0.5, marginBottom:6, display:"flex", alignItems:"center", gap:10, padding:"10px 14px" }}>
            <span style={{ fontSize:20 }}>{g.emoji}</span>
            <div style={{ flex:1, fontSize:13, color:"#6b5f88" }}>{g.title}</div>
            <button onClick={()=>onUpdate(g.id,{active:true})} style={{ ...S.btnSecondary, fontSize:11, padding:"3px 10px" }}>↺ Reactivar</button>
            <button onClick={()=>onDelete(g.id)} style={{ background:"none", border:"none", color:"#3d3360", cursor:"pointer", fontSize:18, lineHeight:1, padding:"0 2px" }}
              onMouseEnter={e=>e.currentTarget.style.color="#f472b6"} onMouseLeave={e=>e.currentTarget.style.color="#3d3360"}>×</button>
          </div>
        ))}
      </div>}
    </div>
  );
}