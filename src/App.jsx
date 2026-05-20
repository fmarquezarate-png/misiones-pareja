import { useState, useEffect, useCallback, useRef } from "react";
import { loadData, loadDataWithVersion, saveData, saveWithRetry, isValidAppData, loadLocalBackup, exportData, importData, signInWithGoogle, signOut, getSession, onAuthChange, getMyCoupleId, createCouple, joinCouple, subscribeToUpdates, loadMessages, sendMessage, subscribeToMessages } from "./supabase.js";
import supabase from "./supabase.js";
import Brand from "./components/Brand.jsx";
import Toast, { useToast } from "./components/Toast.jsx";
import HomeDashboard from "./components/HomeDashboard.jsx";
import WeekTimeline from "./components/WeekTimeline.jsx";
import FilterDrawer, { FilterButton } from "./components/FilterDrawer.jsx";
import OverflowMenu, { OverflowButton } from "./components/OverflowMenu.jsx";
import LinksView from "./components/LinksView.jsx";
import { useConfirm } from "./components/ConfirmModal.jsx";
import { SkeletonDashboard } from "./components/Skeleton.jsx";
import { uid, isoWeekKey, getWeekAndYear, isTodayMonday, isoWeeksInYear, prevWeekFn } from "./utils.js";
import { APP_VERSION, LAST_UPDATE, CHANGELOG, SEED_VERSION, THEMES, FONTS } from "./constants.js";
import { track, setTrackContext } from "./lib/track.js";
import { isEnabled } from "./lib/flags.js";
import { generateInsights } from "./lib/insights.js";
import { saveWithCAS } from "./lib/repo.js";
import PillFilter from "./components/PillFilter.jsx";
import DevBackfillPanel from "./components/DevBackfillPanel.jsx";
import GoalsView from "./views/GoalsView.jsx";

const STATUS_ORDER = ["TBC", "ASAP", "IN_PROGRESS", "DONE"];

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
const STATUS = {
  TBC:         { label:"TBC",      icon:"⏳", color:"#94a3b8", bg:"rgba(148,163,184,0.12)", border:"rgba(148,163,184,0.3)" },
  ASAP:        { label:"ASAP",     icon:"🔥", color:"#fb923c", bg:"rgba(251,146,60,0.12)",  border:"rgba(251,146,60,0.3)"  },
  IN_PROGRESS: { label:"En curso", icon:"⚡", color:"#60a5fa", bg:"rgba(96,165,250,0.12)",  border:"rgba(96,165,250,0.3)"  },
  DONE:        { label:"Hecho",    icon:"✅", color:"#34d399", bg:"rgba(52,211,153,0.12)",  border:"rgba(52,211,153,0.3)"  },
};

const CATEGORIES = [
  { id:"pareja",  label:"Pareja",  icon:"💞", color:"#f472b6" },
  { id:"deporte", label:"Deporte", icon:"🏅", color:"#60a5fa" },
  { id:"casa",    label:"Casa",    icon:"🏠", color:"var(--t-accent,#a78bfa)" },
  { id:"salud",   label:"Salud",   icon:"💊", color:"#34d399" },
  { id:"trabajo", label:"Trabajo", icon:"💼", color:"#fbbf24" },
  { id:"ocio",    label:"Ocio",    icon:"🎉", color:"#f97316" },
  { id:"social",  label:"Social",  icon:"🥂", color:"#e879f9" },
  { id:"viaje",   label:"Viaje",   icon:"✈️", color:"#38bdf8" },
];
const GASTO_CATS = [
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
const getMCats = m => m.categories?.length ? m.categories : (m.category ? [m.category] : []);
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

const EMOJI_GROUPS = [
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

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = ["home","current","calendar","pending","goals","stats","gastos","chat"];

// ─── Swipe hook (used for week navigation and tab switching on touch) ─────────
function useSwipe(onLeft, onRight, minDist = 110) {
  const x0 = useRef(null);
  const y0 = useRef(null);
  return {
    onTouchStart: e => { x0.current = e.touches[0].clientX; y0.current = e.touches[0].clientY; },
    onTouchEnd:   e => {
      if (x0.current === null) return;
      const dx = e.changedTouches[0].clientX - x0.current;
      const dy = e.changedTouches[0].clientY - y0.current;
      x0.current = null; y0.current = null;
      if (Math.abs(dx) < minDist) return;
      if (Math.abs(dx) <= Math.abs(dy) * 1.5) return; // mostly vertical — let scroll handle it
      if (dx < 0) onLeft?.(); else onRight?.();
    },
  };
}

// ─── Seed ─────────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = { person1: "Persona 1", person2: "Persona 2", colors: { person1:"#f472b6", person2:"#a78bfa", together:"#34d399" }, notifications: { chat:true, partnerChanges:true, eventReminders:true, goalDeadlines:true, dailyBriefing:false, briefingTime:"08:00" } };
const DEFAULT_COLORS = { person1:"#f472b6", person2:"#a78bfa", together:"#34d399" };

// ─── Notification helpers ─────────────────────────────────────────────────────
const showNotif = (title, body, opts={}) => {
  if (typeof Notification==="undefined" || Notification.permission!=="granted") return;
  try { new Notification(title, { icon:"/icon-192.png", badge:"/icon-192.png", body, ...opts }); }
  catch { /* unsupported env */ }
};
let _rTimers = [];
const clearRTimers = () => { _rTimers.forEach(clearTimeout); _rTimers = []; };
const scheduleReminders = (data, p1, p2) => {
  clearRTimers();
  if (!data?.settings?.notifications?.eventReminders) return;
  const OFFSETS = { ontime:0, "15min":15*60e3, "30min":30*60e3, "1h":60*60e3, "1day":24*3600e3 };
  const now = Date.now();
  Object.values(data.weeks||{}).flatMap(w=>w.missions||[]).forEach(m => {
    if (m.type!=="event"||!m.date||!m.time||!m.reminder||m.reminder==="none") return;
    const offset = OFFSETS[m.reminder]; if (offset===undefined) return;
    const fireAt = new Date(`${m.date}T${m.time}:00`).getTime() - offset;
    if (fireAt <= now) return;
    const who = m.who==="person1"?p1:m.who==="person2"?p2:"Juntos";
    const label = {ontime:"¡Ahora!","15min":"En 15 min","30min":"En 30 min","1h":"En 1 hora","1day":"Mañana"}[m.reminder]||"";
    _rTimers.push(setTimeout(()=>showNotif(`${m.emoji} ${m.title}`,`${label} · ${who}`,{tag:`rem-${m.id}`}), fireAt-now));
  });
};

// Per-user localStorage preferences (theme & font are personal, not shared with partner)
const getUserPrefs = id => { try { return JSON.parse(localStorage.getItem(`user-prefs-${id}`)||"{}"); } catch { return {}; } };
const saveUserPrefs = (id, patch) => { try { localStorage.setItem(`user-prefs-${id}`, JSON.stringify({...getUserPrefs(id),...patch})); } catch {} };

// ISO week date helpers
const _SD = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const _SM = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const weekStartDate = (wn, yr) => {
  const jan4 = new Date(yr, 0, 4);
  const dow = (jan4.getDay() + 6) % 7; // 0=Mon … 6=Sun
  return new Date(yr, 0, 4 - dow + (wn-1)*7);
};
const fmtShortDate = d => `${_SD[d.getDay()]} ${d.getDate()} ${_SM[d.getMonth()]}`;
const fmtWeekRange = (wn, yr) => {
  const mon = weekStartDate(wn, yr);
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate()+6);
  const from = `${mon.getDate()} ${_SM[mon.getMonth()]}`;
  const to   = `${sun.getDate()} ${_SM[sun.getMonth()]}`;
  return mon.getMonth()===sun.getMonth() ? `${mon.getDate()}–${sun.getDate()} ${_SM[mon.getMonth()]}` : `${from} – ${to}`;
};

const googleCalendarUrl = (mission, name1, name2) => {
  if (!mission.date) return null;
  const ds = mission.date.replace(/-/g, "");
  const who = mission.who==="person1"?name1:mission.who==="person2"?name2:`${name1} & ${name2}`;
  let dates;
  if (mission.time) {
    const [hh, mm] = mission.time.split(":").map(Number);
    const tot = hh*60 + mm + (mission.duration || 60);
    const eh = String(Math.floor(tot/60)%24).padStart(2,"0"), em = String(tot%60).padStart(2,"0");
    dates = `${ds}T${String(hh).padStart(2,"0")}${String(mm).padStart(2,"0")}00/${ds}T${eh}${em}00`;
  } else {
    const nd = new Date(mission.date); nd.setDate(nd.getDate()+1);
    dates = `${ds}/${nd.toISOString().slice(0,10).replace(/-/g,"")}`;
  }
  const dur = mission.duration;
  const details = `Quién: ${who}${dur?` · ${Math.round(dur/60*10)/10}h`:""}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(mission.emoji+" "+mission.title)}&dates=${dates}&details=${encodeURIComponent(details)}`;
};


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
  const existingSeriesIds = new Set((currW.missions||[]).filter(m=>m.seriesId).map(m=>m.seriesId));
  const toCarry = (prevW.missions||[]).filter(m => m.status!=="DONE" && !existingCarriedIds.has(m.id) && !existingTitles.has(m.title));

  // Recurring: look at prevW and also 2 weeks back for biweekly series
  const { wn:p2wn, yr:p2yr } = prevWeekFn(pwn, pyr);
  const prev2W = data.weeks[isoWeekKey(p2wn, p2yr)];
  const prevSeries = (prevW.missions||[]).filter(m => m.seriesPattern && m.seriesId);
  const prevSeriesIds = new Set(prevSeries.map(m => m.seriesId));
  const biweeklyFromPrev2 = (prev2W?.missions||[]).filter(m =>
    m.seriesPattern === "biweekly" && m.seriesId &&
    !existingSeriesIds.has(m.seriesId) && !prevSeriesIds.has(m.seriesId)
  );
  const allSeriesSources = [...prevSeries, ...biweeklyFromPrev2];

  const today = new Date();
  const isFirstWeekOfMonth = cwn === getWeekAndYear(new Date(today.getFullYear(), today.getMonth(), 1)).week;
  const seriesEndOk = m => {
    if (!m.seriesEndDate) return true;
    const { week:eWn, year:eYr } = getWeekAndYear(new Date(m.seriesEndDate));
    return !(cyr > eYr || (cyr === eYr && cwn > eWn));
  };

  const newSeriesMissions = allSeriesSources.filter(m => {
    if (existingSeriesIds.has(m.seriesId)) return false;
    if (!seriesEndOk(m)) return false;
    if (m.seriesPattern === "weekly") return true;
    if (m.seriesPattern === "monthly") return isFirstWeekOfMonth;
    if (m.seriesPattern === "biweekly") {
      const sWn = m.seriesStartWeek || pwn;
      const sYr = m.seriesStartYear || pyr;
      const weeksDiff = (cyr - sYr) * 52 + (cwn - sWn);
      return weeksDiff % 2 === 0;
    }
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

const dlBlob=(blob,name)=>{
  const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);
};

const getMissionDates=(m)=>{
  if(!m.date)return[];
  // Safety defaults: if a piece of time info is missing, fill sensibly so
  // multi-day events still span correctly in the calendar.
  const startTime = m.time || "00:00";
  const startMs = new Date(m.date+"T"+startTime).getTime();
  if(isNaN(startMs)) return [m.date];
  let endMs = null;
  if(m.endDate){
    // If endDate is set but endTime missing → assume end-of-day
    const endTime = m.endTime || "23:59";
    const t = new Date(m.endDate+"T"+endTime).getTime();
    if(!isNaN(t)) endMs = t;
  }
  if(endMs===null && m.duration>0){
    // Fallback via duration
    endMs = startMs + m.duration*60000;
  }
  if(endMs===null || endMs<=startMs) return [m.date];
  // Walk day-by-day from start date to (and including) end date
  const dates=[];
  const cur=new Date(m.date+"T00:00");
  // Determine last day string from endMs (local date parts)
  const endD = new Date(endMs);
  const lastStr = `${endD.getFullYear()}-${String(endD.getMonth()+1).padStart(2,"0")}-${String(endD.getDate()).padStart(2,"0")}`;
  // Safety cap to avoid runaway loops on bad data (max ~1 year span)
  let guard = 0;
  while(guard++ < 400){
    const ds = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}-${String(cur.getDate()).padStart(2,"0")}`;
    dates.push(ds);
    if(ds===lastStr) break;
    cur.setDate(cur.getDate()+1);
  }
  return dates.length ? dates : [m.date];
};

// Injects CSS custom properties + loads Google Font for the active theme/font
function ThemeInjector({ themeId, fontId }) {
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
    const f = FONTS.find(x=>x.id===fontId);
    const useCustomFont = f && f.id !== "auto";

    // Load font dynamically (user font overrides theme font)
    const LINK_ID = "theme-font";
    let link = document.getElementById(LINK_ID);
    const fontUrl = useCustomFont ? f.googleFonts : t.googleFonts;
    if (fontUrl) {
      if (!link) { link = document.createElement("link"); link.id = LINK_ID; link.rel = "stylesheet"; document.head.appendChild(link); }
      link.href = fontUrl;
    } else if (link) {
      link.href = "";
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
    r.setProperty("--t-font-body",   useCustomFont ? f.family : t.fontBody);
    r.setProperty("--t-text",        t.text      || "#f8f4ff");
    r.setProperty("--t-text-muted",  t.textMuted || "#8b7fa8");
    r.setProperty("--t-text-dim",    t.textDim   || "#4a4166");
    r.setProperty("--t-error",       t.error     || "#f87171");
    r.setProperty("--t-input-bg",    t.dark === false ? "rgba(0,0,0,0.05)" : "rgba(128,128,128,0.10)");
    document.documentElement.style.background = t.bg;
    try {
      const vars = {
        "--t-bg": t.bg, "--t-bg-grad": t.bgGrad, "--t-menu-bg": t.menuBg,
        "--t-topbar-bg": t.topBarBg, "--t-card": t.card, "--t-card-border": t.cardBorder,
        "--t-btn-grad": t.btnGrad, "--t-accent": t.accent, "--t-accent-soft": t.accentSoft,
        "--t-font-body": useCustomFont ? f.family : t.fontBody,
        "--t-text": t.text || "#f8f4ff", "--t-text-muted": t.textMuted || "#8b7fa8",
        "--t-text-dim": t.textDim || "#4a4166", "--t-error": t.error || "#f87171",
        "--t-input-bg": t.dark === false ? "rgba(0,0,0,0.05)" : "rgba(128,128,128,0.10)",
      };
      localStorage.setItem("mp_theme", JSON.stringify(vars));
      localStorage.setItem("mp-quick-bg", t.bg);
    } catch {}
  }, [themeId, fontId]);
  return null;
}
const badgeStyle = s => ({ background:STATUS[s].bg, color:STATUS[s].color, border:`1px solid ${STATUS[s].border}`, padding:"3px 8px", borderRadius:99, fontSize:11, fontWeight:600, fontFamily:"inherit", letterSpacing:0.3, cursor:"pointer", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:4 });
const catBadgeStyle = catId => { const c = CAT_MAP[catId]; if (!c) return {}; return { background:`${c.color}18`, color:c.color, border:`1px solid ${c.color}40`, padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600, display:"flex", alignItems:"center", gap:3, whiteSpace:"nowrap" }; };

// ─── App ──────────────────────────────────────────────────────────────────────
// ─── Auth wrapper ─────────────────────────────────────────────────────────────
const AUTH_CACHE_KEY = "shared-cal-auth-v1";

export default function AppWithAuth() {
  // Instant startup: read cached couple synchronously (set on previous login, no network needed)
  const authCache = (() => { try { return JSON.parse(localStorage.getItem(AUTH_CACHE_KEY)||"null"); } catch { return null; } })();

  const [session,    setSession]    = useState(undefined);
  const [coupleData, setCoupleData] = useState(authCache);
  const [authStep,   setAuthStep]   = useState(authCache ? "app" : "checking");

  useEffect(() => {
    // Single handler for initial session + every auth state change
    const resolve = async s => {
      setSession(s);
      if (!s) {
        localStorage.removeItem(AUTH_CACHE_KEY);
        setCoupleData(null); setAuthStep("login"); return;
      }
      const cd = await getMyCoupleId();
      if (cd?.couple_id) {
        localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ couple_id: cd.couple_id, person_name: cd.person_name }));
        setCoupleData(cd); setAuthStep("app");
      } else {
        localStorage.removeItem(AUTH_CACHE_KEY);
        setAuthStep("onboarding");
      }
    };
    getSession().then(resolve);
    const sub = onAuthChange(resolve);
    return () => sub.unsubscribe();
  }, []);

  const handleSignOut = () => { localStorage.removeItem(AUTH_CACHE_KEY); signOut(); };

  if (authStep === "checking") return (
    <div style={{ background:"#0a0714", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", color:"#f8f4ff", fontFamily:"system-ui" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:12 }}>💞</div>
        <div style={{ color:"var(--t-text-muted,#8b7fa8)", fontSize:14 }}>Comprobando sesión...</div>
      </div>
    </div>
  );

  if (authStep === "login") return <LoginScreen />;
  if (authStep === "onboarding") return <OnboardingScreen session={session} onDone={cd => { localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(cd)); setCoupleData(cd); setAuthStep("app"); }} />;
  // key={coupleData?.couple_id} forces full remount if couple changes (data isolation)
  return <CoupleMissions key={coupleData?.couple_id} coupleId={coupleData?.couple_id} personName={coupleData?.person_name} onSignOut={handleSignOut} sessionUserId={session?.user?.id} />;
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen() {
  return (
    <div style={{ background:"#0a0714", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif", color:"#f8f4ff", padding:20 }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ textAlign:"center", maxWidth:340, width:"100%" }}>
        <div style={{ fontSize:64, marginBottom:16 }}>📅</div>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:32, fontWeight:700, marginBottom:8, letterSpacing:-1 }}>Shared Calendar</div>
        <div style={{ fontSize:14, color:"var(--t-text-muted,#8b7fa8)", marginBottom:40, lineHeight:1.6 }}>Tu espacio compartido para planificar<br/>la semana en equipo</div>
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
        <div style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)", marginTop:20, lineHeight:1.6 }}>
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

  const inputStyle = { background:"rgba(128,128,128,0.10)", border:"1px solid rgba(167,139,250,0.25)", borderRadius:10, padding:"12px 14px", color:"#f8f4ff", fontSize:15, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box", letterSpacing:0.3 };
  const btnStyle = { background:"linear-gradient(135deg,#f472b6,#a78bfa)", border:"none", borderRadius:10, color:"#fff", padding:"13px", cursor:"pointer", fontSize:15, fontWeight:600, fontFamily:"inherit", width:"100%", opacity:loading?0.6:1 };
  const backBtn = { background:"none", border:"none", color:"var(--t-text-dim,#6b5f88)", cursor:"pointer", fontSize:13, fontFamily:"inherit", marginBottom:20, padding:0 };

  return (
    <div style={{ background:"#0a0714", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif", color:"#f8f4ff", padding:20 }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ maxWidth:360, width:"100%" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:48, marginBottom:10 }}>💞</div>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:700 }}>¡Bienvenido/a!</div>
          <div style={{ fontSize:13, color:"var(--t-text-muted,#8b7fa8)", marginTop:8 }}>
            {session?.user?.email && <span>Conectado como <strong style={{ color:"var(--t-accent,#a78bfa)" }}>{session.user.email}</strong></span>}
          </div>
        </div>

        {step === "choice" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ fontSize:13, color:"var(--t-text-muted,#8b7fa8)", textAlign:"center", marginBottom:8 }}>¿Qué quieres hacer?</div>
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
            <div style={{ fontSize:14, color:"var(--t-text-muted,#8b7fa8)", marginBottom:20 }}>
              Crea un espacio privado para vuestra pareja con un código único que compartiréis.
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:6 }}>Tu nombre</div>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej: Ana, Carlos…" style={inputStyle} />
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:6 }}>Código de pareja</div>
              <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="Ej: FRAN-ANA" maxLength={20} style={{ ...inputStyle, letterSpacing:2, textTransform:"uppercase" }} />
              <div style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)", marginTop:5 }}>Este código lo usará tu pareja para unirse. Elige algo memorable.</div>
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
            <div style={{ fontSize:14, color:"var(--t-text-muted,#8b7fa8)", marginBottom:20 }}>
              Tu pareja ya creó el espacio. Introduce el código que te compartió.
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:6 }}>Tu nombre</div>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej: Ana, Carlos…" style={inputStyle} />
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:6 }}>Código de pareja</div>
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

function TutorialOverlay({ step, onNext, onSkip, onFinish }) {
  const s = TUTORIAL_STEPS[step];
  const total = TUTORIAL_STEPS.length;
  const isFirst = step === 0;
  const isLast = step === total - 1;

  // Bubble container position (the arrow lives outside this)
  const bubbleContainerStyle = (() => {
    if (s.bubblePos === "center") return { top:"50%", left:"50%", width:300, maxWidth:"88vw", transform:"translate(-50%,-50%)" };
    if (s.bubblePos === "top-nav") return { top:130, left:16, right:16 };
    return { top:68, left:16, right:16 }; // "top" — below topbar
  })();

  // Doodle arrow elements
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

      {/* Speech bubble container — only this subtree captures pointer events */}
      <div style={{ position:"absolute", pointerEvents:"auto", ...bubbleContainerStyle }}>
        {/* Inner div keyed to step for re-animation on each step change */}
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

function CoupleMissions({ coupleId, personName, onSignOut, sessionUserId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const saveTimerRef    = useRef(null);
  const dataRef         = useRef(null);
  const dataVersionRef  = useRef(0);
  const [activeTab,       setActiveTab]       = useState("home");
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [showProfile,     setShowProfile]     = useState(false);
  const [settingsMenuOpen,setSettingsMenuOpen]= useState(false);
  const [importMsg,       setImportMsg]       = useState(null);
  const importFileRef = useRef(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newM, setNewM] = useState({ emoji:"🎯", title:"", status:"TBC", date:"", time:"", endDate:"", endTime:"", categories:[], who:"together", duration:0, goalId:null, type:"task", seriesPattern:"", seriesEndDate:"", reminder:"none" });
  const [editObj, setEditObj] = useState(false);
  const [error, setError] = useState(null);
  const [histWeekRange, setHistWeekRange] = useState("all");
  const [globalPersonFilter, setGlobalPersonFilter] = useState([]); // [] = todos
  const [globalCatFilter, setGlobalCatFilter] = useState([]); // [] = todas
  const [localThemeId, setLocalThemeId] = useState(null);
  const [localFontId,  setLocalFontId]  = useState(null);
  const [weekSort, setWeekSort] = useState("default"); // default | chrono | type | who | status
  const [showChangelog, setShowChangelog] = useState(false);
  const [lightboxSrc,   setLightboxSrc]   = useState(null);
  const [syncing, setSyncing]       = useState(false);
  const [syncError, setSyncError]   = useState(null);   // string | null
  const [syncMsg,   setSyncMsg]     = useState(null);   // feedback message
  const [tutorialStep, setTutorialStep] = useState(null); // null = hidden
  const [notifGranted, setNotifGranted] = useState(typeof Notification!=="undefined" && Notification.permission==="granted");
  const notifSettingsRef = useRef(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingSave, setPendingSave] = useState(false);
  const [savingState, setSavingState] = useState("idle"); // "idle"|"saving"|"saved"|"error"
  const [pendingTab, setPendingTab] = useState("pending"); // "pending" | "logros"
  const [logrosPeopleFilter, setLogrosPeopleFilter] = useState([]);
  const [logrosCatFilter, setLogrosCatFilter] = useState([]);
  const [icsModal, setIcsModal] = useState(false);
  const [icsFrom,  setIcsFrom]  = useState("");
  const [icsTo,    setIcsTo]    = useState("");
  const [popOpen,       setPopOpen]       = useState(false);
  const [filtersOpen,   setFiltersOpen]   = useState(false);
  const [weekViewMode,  setWeekViewMode]  = useState("timeline"); // "list" | "timeline"
  const { toast: appToast, push: pushToast, dismiss: dismissToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const showSyncMsg = msg => { setSyncMsg(msg); setTimeout(() => setSyncMsg(null), 3000); };

  const checkUpdate = async () => {
    pushToast({ kind: "loading", text: "Verificando versión…" });
    try {
      // Step 1: fetch server version bypassing all caches
      let serverVersion = null;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) serverVersion = (await res.json()).v;
      } catch { /* offline or missing file — skip version check */ }

      // Step 2: compare with current bundle version
      if (serverVersion && serverVersion === APP_VERSION) {
        pushToast({ kind: "error", text: `Ya tienes la última versión (v${APP_VERSION}). Si acabas de desplegar, espera unos minutos y vuelve a intentar.` });
        return;
      }

      // Step 3: trigger service worker update
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          } else if (!reg.installing && serverVersion && serverVersion !== APP_VERSION) {
            // SW updated but not yet waiting — force reload anyway
          } else if (!reg.waiting && !reg.installing && !serverVersion) {
            pushToast({ kind: "error", text: "No se encontró actualización en el service worker. Intenta limpiar caché del navegador (Ctrl+Shift+R)." });
            return;
          }
        }
      }

      const msg = serverVersion && serverVersion !== APP_VERSION
        ? `Actualizando v${APP_VERSION} → v${serverVersion}…`
        : "Actualizando…";
      pushToast({ kind: "success", text: msg });
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      pushToast({ kind: "error", text: `Error al actualizar: ${err.message}` });
    }
  };

  // Pull remote data; if Supabase has nothing, push local data up.
  const forceSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const remote = await loadData(coupleId);
      if (remote) {
        setData(prev => {
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

  // Force-push local data up to Supabase, then verify with actual timestamp from DB
  const forcePush = async () => {
    if (!coupleId) return;
    setSyncing(true);
    setSyncError(null);
    showSyncMsg("⬆ Subiendo a Supabase…");
    try {
      await saveWithRetry(data, coupleId);
      // Read back updated_at — set by BEFORE UPDATE trigger, ground truth that the write landed
      const { data: row, error: readErr } = await supabase
        .from("app_data")
        .select("updated_at")
        .eq("id", coupleId)
        .single();
      if (readErr || !row) throw new Error("Guardado pero no se pudo leer confirmación: " + (readErr?.message || "sin datos"));
      const savedAt = new Date(row.updated_at);
      const diffSec = Math.round((Date.now() - savedAt.getTime()) / 1000);
      const timeStr = savedAt.toLocaleTimeString("es-ES");
      if (diffSec > 30) throw new Error(`updated_at tiene ${diffSec}s de antigüedad — el write no se aplicó. Revisa RLS o sesión.`);
      showSyncMsg(`✅ Guardado en Supabase · ${timeStr} (hace ${diffSec}s)`);
    } catch (e) {
      setSyncError(e.message);
      showSyncMsg("⚠ " + e.message);
    }
    setSyncing(false);
  };

  useEffect(() => {
    (async () => {
      // Fast path: render local backup instantly (zero network wait for returning users)
      const local = loadLocalBackup(coupleId);
      if (local?.data?.weeks) {
        let fast = { ...local.data };
        if (!fast.settings) fast.settings = DEFAULT_SETTINGS;
        if (!fast.goals) fast.goals = SEED.goals;
        setData(fast);
        setLoading(false); // show immediately — Supabase will update silently
      }

      // Leer version para CAS — no interrumpe el flujo existente
      loadDataWithVersion(coupleId).then(({ version }) => {
        dataVersionRef.current = version;
        console.debug("[CAS] version cargada:", version);
      });

      // Background: fetch authoritative data from Supabase
      try {
        let base = await loadData(coupleId);
        let isRealData = !!base;
        let didMigrate = false;

        if (base) {
          if (!base.seedVersion || base.seedVersion < SEED_VERSION) {
            base = { ...SEED, settings: base.settings || SEED.settings, goals: base.goals || SEED.goals, weeks: { ...SEED.weeks, ...base.weeks }, seedVersion: SEED_VERSION };
            didMigrate = true;
          }
        } else {
          if (local?.data?.weeks && Object.keys(local.data.weeks).length > 1) {
            base = local.data; isRealData = true;
          } else {
            base = { ...SEED }; isRealData = false;
          }
        }

        if (!base.settings) base.settings = DEFAULT_SETTINGS;
        if (!base.goals) base.goals = SEED.goals;
        if (isTodayMonday()) base = applyCarryOver(base);
        const { data: repaired, moved: repairedCount } = repairMisplacedMissions(base);
        if (repairedCount > 0) { base = repaired; didMigrate = true; }
        setData(base);

        if (isRealData && didMigrate) await saveData(base, coupleId);
      } catch(e) {
        // Only surface error if we have nothing to show (no local backup)
        if (!local?.data) {
          setError("No se pudo conectar con la base de datos. Comprueba tu conexión.");
          setData({ ...SEED });
        }
      }
      setLoading(false);
    })();
  }, []);

  // Auto-launch tutorial on first visit
  useEffect(() => {
    if (!loading && coupleId && !localStorage.getItem("shared-cal-tutorial-v1")) {
      const t = setTimeout(() => setTutorialStep(0), 700);
      return () => clearTimeout(t);
    }
  }, [loading, coupleId]);

  // Navigate to tab when tutorial step changes
  useEffect(() => {
    if (tutorialStep !== null && TUTORIAL_STEPS[tutorialStep]?.tab) {
      setActiveTab(TUTORIAL_STEPS[tutorialStep].tab);
    }
  }, [tutorialStep]);

  const tutorialNext   = () => setTutorialStep(s => Math.min(s+1, TUTORIAL_STEPS.length-1));
  const tutorialFinish = () => { localStorage.setItem("shared-cal-tutorial-v1","done"); setTutorialStep(null); setActiveTab("home"); };
  const tutorialSkip   = () => { localStorage.setItem("shared-cal-tutorial-v1","done"); setTutorialStep(null); };

  // Keep notifSettingsRef current for use inside async callbacks
  useEffect(() => { notifSettingsRef.current = data?.settings?.notifications; }, [data?.settings?.notifications]);

  // Telemetry: expose coupleId globally + fire app_open once
  useEffect(() => {
    if (!coupleId) return;
    window.__mpCoupleId = coupleId;
    setTrackContext({ coupleId, userId: sessionUserId });
    track("app_open", { version: APP_VERSION });
  }, [coupleId]); // eslint-disable-line

  // Telemetry: track view changes
  useEffect(() => {
    if (!coupleId) return;
    track("view_changed", { view: activeTab });
  }, [activeTab, coupleId]); // eslint-disable-line

  // Schedule event reminders whenever data changes
  useEffect(() => {
    if (!data || !notifGranted) return;
    scheduleReminders(data, data.settings?.person1||"Persona 1", data.settings?.person2||"Persona 2");
    return clearRTimers;
  }, [data, notifGranted]);

  // On data load: goal deadline reminders + daily briefing (#10)
  useEffect(() => {
    if (!data || !notifGranted) return;
    const ns = data.settings?.notifications || {};

    // Goal deadlines: notify 7 days, 1 day, and day-of
    if (ns.goalDeadlines) {
      const today = new Date(); today.setHours(0,0,0,0);
      (data.goals||[]).filter(g=>g.active!==false&&g.deadline).forEach(g=>{
        const days = Math.round((new Date(g.deadline)-today)/86400e3);
        const key = `gdl-${g.id}-${days}`;
        if ((days===7||days===1||days===0) && !localStorage.getItem(key)) {
          localStorage.setItem(key,"1");
          showNotif(`🏅 ${g.title}`, days===0?"¡Vence hoy!":days===1?"Vence mañana":"Vence en 7 días", {tag:key});
        }
      });
    }

    // Daily briefing (feature #10)
    let briefingTimer = null;
    if (ns.dailyBriefing) {
      const today = new Date(); const todayStr = today.toISOString().slice(0,10);
      const bKey = `briefing-${todayStr}`;
      const fireBriefing = () => {
        localStorage.setItem(bKey,"1");
        const allM = Object.values(data.weeks||{}).flatMap(w=>w.missions||[]);
        const ev = allM.filter(m=>m.date===todayStr&&m.type==="event").length;
        const tk = allM.filter(m=>m.date===todayStr&&m.type!=="event"&&m.status!=="DONE").length;
        const body = ev||tk ? [ev&&`${ev} evento${ev>1?"s":""}`, tk&&`${tk} tarea${tk>1?"s":""}`].filter(Boolean).join(" · ") : "Hoy no hay nada planeado 🌿";
        showNotif("☀️ Buenos días", body, {tag:"daily-briefing"});
      };
      if (!localStorage.getItem(bKey)) {
        const [bh,bm] = (ns.briefingTime||"08:00").split(":").map(Number);
        const fireAt = new Date(today); fireAt.setHours(bh,bm,0,0);
        if (today >= fireAt) {
          fireBriefing();
        } else {
          // Schedule within this session
          briefingTimer = setTimeout(fireBriefing, fireAt - today);
        }
      }
    }
    return () => { if (briefingTimer) clearTimeout(briefingTimer); };
  }, [data?.weeks, data?.goals, notifGranted]); // eslint-disable-line

  // Realtime: reload when partner saves (skipped if we have unsaved local changes)
  useEffect(() => {
    if (!coupleId) return;
    const channel = subscribeToUpdates(coupleId, remoteData => {
      // hasPendingSave guard in subscribeToUpdates ensures we only reach here when safe
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      setSavingState("idle");
      if (notifSettingsRef.current?.partnerChanges && document.visibilityState!=="visible") {
        showNotif("📅 Shared Calendar", "Tu pareja actualizó el calendario", {tag:"partner-update"});
      }
      setData(() => remoteData);
    }, {
      hasPendingSave: () => pendingSave || !!saveTimerRef.current,
    });
    return () => { supabase.removeChannel(channel); };
  }, [coupleId]);

  // Keep dataRef in sync so visibilitychange handler always has fresh data
  useEffect(() => { dataRef.current = data; }, [data]);

  // Flush debounced save immediately when app goes to background (iOS) or tab closes (desktop)
  useEffect(() => {
    const flushPendingSave = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        if (dataRef.current && coupleId && isValidAppData(dataRef.current)) {
          saveWithRetry(dataRef.current, coupleId, {
            retries: 1, baseDelay: 300,
            getLatestData: () => dataRef.current,
          }).catch(() => {});
        }
      }
    };
    const handleVisibilityChange = () => { if (document.visibilityState === "hidden") flushPendingSave(); };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushPendingSave);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushPendingSave);
    };
  }, [coupleId]);

  // Online/offline detection
  useEffect(() => {
    const up = () => setIsOnline(true);
    const dn = () => setIsOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", dn);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", dn); };
  }, []);

  // Retry pending save when reconnecting
  useEffect(() => {
    if (isOnline && pendingSave && data && coupleId && isValidAppData(data)) {
      saveWithRetry(data, coupleId, { getLatestData: () => dataRef.current })
        .then(() => { setPendingSave(false); setSyncError(null); showSyncMsg("✓ Cambios sincronizados"); })
        .catch(e => { setSyncError(e.message); showSyncMsg("⚠ Sin conexión — reintentando…"); });
    }
  }, [isOnline]); // eslint-disable-line

  const update = useCallback(fn => {
    setData(prev => {
      const next = fn(prev);
      if (!isValidAppData(next)) {
        // guard: skip save if state looks corrupt — but notify instead of silently dropping
        console.error("[save] isValidAppData failed — datos no guardados. Tamaño:", JSON.stringify(next).length);
        track("save_validation_failed", {
          size: JSON.stringify(next).length,
          keys: Object.keys(next || {}).join(",").slice(0, 100),
        });
        pushToast({ kind: "error", text: "⚠️ Error de validación — los cambios no se guardaron. Recarga la app si el problema persiste." });
        return next;
      }
      // Debounced save: 700ms after last change, with exponential backoff on failure
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        // CAS pre-check: si el flag está activo, intentar save atómico primero
        if (isEnabled("cas_version_check")) {
          saveWithCAS(coupleId, next, dataVersionRef.current).then(result => {
            if (result.success) {
              dataVersionRef.current = result.newVersion;
              console.debug("[CAS] save exitoso, nueva version:", result.newVersion);
            } else if (result.conflict) {
              console.warn("[CAS] conflicto de version — otro cliente se adelantó");
              track("cas_conflict", { couple_id: coupleId });
            }
            // Si casDisabled o error, el saveWithRetry normal ya se encarga
          });
        }
        saveWithRetry(next, coupleId, { getLatestData: () => dataRef.current })
          .then(() => { setSyncError(null); setPendingSave(false); setSavingState("saved"); setTimeout(() => setSavingState("idle"), 2000); })
          .catch(e => { setSyncError(e.message); setPendingSave(true); setSavingState("error"); showSyncMsg("⚠ Error al guardar — reintentando…"); });
      }, 700);
      return next;
    });
    setSavingState("saving");
  }, [coupleId]);

  // These must be declared before any early return so useSwipe (which calls
  // useRef internally) is always called in the same order — Rules of Hooks.
  const changeWeek = d => update(s => { let wn=s.currentWeekNumber+d,yr=s.currentYear; if(wn>isoWeeksInYear(yr)){wn=1;yr++;} if(wn<1){yr--;wn=isoWeeksInYear(yr);} return {...s,currentWeekNumber:wn,currentYear:yr}; });
  const swipeWeek = useSwipe(() => changeWeek(1), () => changeWeek(-1));

  if (loading) return (
    <div style={{ background:"var(--t-bg,#0a0714)", minHeight:"100vh", fontFamily:"system-ui", padding:"16px 16px calc(24px + env(safe-area-inset-bottom))", maxWidth:640, margin:"0 auto" }}>
      <style>{`@keyframes sk-pulse{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ height:52, marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:99, background:"linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 75%)", backgroundSize:"200% 100%", animation:"sk-pulse 1.6s ease-in-out infinite" }} />
        <div style={{ flex:1, height:14, borderRadius:8, background:"linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 75%)", backgroundSize:"200% 100%", animation:"sk-pulse 1.6s ease-in-out infinite" }} />
      </div>
      <SkeletonDashboard />
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

  const p1 = data.settings?.person1 || "Persona 1";
  const p2 = data.settings?.person2 || "Persona 2";
  const colors = { ...DEFAULT_COLORS, ...(data.settings?.colors||{}) };
  const _uprefs = getUserPrefs(sessionUserId);
  const themeId = localThemeId || _uprefs.themeId || data.settings?.themeId || "violet";
  const fontId  = localFontId  || _uprefs.fontId  || data.settings?.fontId  || "auto";
  const _activeTheme = THEMES.find(t => t.id === themeId) || THEMES[0];
  const toggleDarkLight = () => {
    const pair = _activeTheme.pair || (_activeTheme.dark ? "lavender" : "violet");
    setLocalThemeId(pair);
    if (sessionUserId) saveUserPrefs(sessionUserId, { themeId: pair });
  };
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
    // Safety defaults so multi-day events always render even if user left
    // a time piece blank: endDate without endTime → 23:59, date without time
    // when an endDate is set → 00:00.
    const hasEnd = !!newM.endDate;
    const startTime = newM.time || (hasEnd ? "00:00" : null);
    const endTime   = hasEnd ? (newM.endTime || "23:59") : null;
    patchWeek(w => ({ ...w, missions:[...(w.missions||[]), { id:uid(), emoji:newM.emoji, title:newM.title.trim(), status:newM.status, date:newM.date||null, time:startTime, endDate:newM.endDate||null, endTime, createdAt:Date.now(), completedAt:null, carriedFrom:null, carriedFromWeek:null, categories:newM.categories||[], who:newM.who, duration:newM.duration||null, goalId:newM.goalId||null, type:newM.type||"task", seriesPattern:newM.seriesPattern||null, seriesId:sid, seriesEndDate:newM.seriesEndDate||null, seriesStartWeek:sid?data.currentWeekNumber:null, seriesStartYear:sid?data.currentYear:null }] }));
    setNewM({ emoji:"🎯", title:"", status:"TBC", date:"", time:"", endDate:"", endTime:"", categories:[], who:"together", duration:0, goalId:null, type:"task", seriesPattern:"", seriesEndDate:"", reminder:"none" });
    setShowAddForm(false);
  };

  const cycleStatus = id => {
    update(d => {
      const w = d.weeks[wkey]; if (!w) return d;
      const m = w.missions.find(x=>x.id===id);
      const nx = STATUS_ORDER[(STATUS_ORDER.indexOf(m.status)+1)%STATUS_ORDER.length];
      if (nx==="DONE") track("mission_completed", { who: m.who, hasGoal: !!m.goalId, week: w.weekNumber });
      let next = { ...d, weeks: { ...d.weeks, [wkey]: { ...w, missions: w.missions.map(x => x.id===id ? {...x, status:nx, completedAt:nx==="DONE"?Date.now():null} : x) } } };
      if (nx==="DONE" && m.carriedFrom) next = syncCarryDone(next, wkey, id);
      return next;
    });
  };

  const delMission = id => patchWeek(w => ({ ...w, missions:w.missions.filter(m=>m.id!==id) }));
  const patchM = (id, patch) => patchWeek(w => ({ ...w, missions:w.missions.map(m=>m.id===id?{...m,...patch}:m) }));
  const { week:todayWeek, year:todayYear } = getWeekAndYear();
  const isCurrentWeek = data.currentWeekNumber===todayWeek && data.currentYear===todayYear;
  const goToToday = () => { update(s=>({...s,currentWeekNumber:todayWeek,currentYear:todayYear})); setActiveTab("current"); };
  const runCarryOver = () => update(d => applyCarryOver(d));
  const patchAllFutureSeries = (seriesId, fromWkey, patch) => {
    update(d => {
      const newWeeks = { ...d.weeks };
      for (const [wkey, w] of Object.entries(newWeeks)) {
        if (wkey < fromWkey) continue;
        newWeeks[wkey] = { ...w, missions: (w.missions||[]).map(m => m.seriesId === seriesId ? { ...m, ...patch } : m) };
      }
      return { ...d, weeks: newWeeks };
    });
  };
  const cycleStatusGlobal = (wn, yr, id) => {
    const key = isoWeekKey(wn, yr);
    update(d => {
      const w = d.weeks[key]; if (!w) return d;
      const m = w.missions.find(x=>x.id===id); if (!m) return d;
      const nx = STATUS_ORDER[(STATUS_ORDER.indexOf(m.status)+1)%STATUS_ORDER.length];
      if (nx==="DONE") track("mission_completed", { who: m.who, hasGoal: !!m.goalId, week: w.weekNumber });
      let next = { ...d, weeks: { ...d.weeks, [key]: { ...w, missions: w.missions.map(x=>x.id===id?{...x,status:nx,completedAt:nx==="DONE"?Date.now():null}:x) } } };
      if (nx==="DONE" && m.carriedFrom) next = syncCarryDone(next, key, id);
      return next;
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
    const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Shared Calendar//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
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
        const tot = hh*60+mm+(m.duration||60);
        const eh = String(Math.floor(tot/60)%24).padStart(2,"0"), em = String(tot%60).padStart(2,"0");
        lines.push(`DTEND:${ds}T${eh}${em}00`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${ds}`);
        const nd = new Date(m.date); nd.setDate(nd.getDate()+1);
        lines.push(`DTEND;VALUE=DATE:${nd.toISOString().slice(0,10).replace(/-/g,"")}`);
      }
      lines.push(`SUMMARY:${m.emoji} ${m.title}`);
      const parts = [`Semana ${weekData.weekNumber}`,`Estado: ${STATUS[m.status]?.label||m.status}`,`Quién: ${who}`];
      if (m.duration) parts.push(`Duración: ${Math.round(m.duration/60*10)/10}h`);
      lines.push(`DESCRIPTION:${parts.join("\\n")}`);
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type:"text/calendar;charset=utf-8" });
    dlBlob(blob,`misiones-${weekKey}.ics`);
  };

  const downloadRangeICS = () => {
    if (!icsFrom || !icsTo || icsFrom > icsTo) return;
    const missions = Object.values(data.weeks)
      .flatMap(w => (w.missions||[]).filter(m => m.date && m.date >= icsFrom && m.date <= icsTo))
      .sort((a,b) => a.date.localeCompare(b.date));
    if (missions.length === 0) { alert("No hay actividades con fecha en ese rango."); return; }
    const stamp = new Date().toISOString().replace(/[-:.]/g,"").slice(0,15)+"Z";
    const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Shared Calendar//ES","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
    for (const m of missions) {
      const who = m.who==="person1"?p1:m.who==="person2"?p2:`${p1} & ${p2}`;
      const ds = m.date.replace(/-/g,"");
      lines.push("BEGIN:VEVENT",`UID:${m.id}-${stamp}@sc`,`DTSTAMP:${stamp}`);
      if (m.time) {
        const ts = m.time.replace(":","")+"00";
        lines.push(`DTSTART:${ds}T${ts}`);
        const [hh,mm2] = m.time.split(":").map(Number);
        const tot = hh*60+mm2+(m.duration||60);
        lines.push(`DTEND:${ds}T${String(Math.floor(tot/60)%24).padStart(2,"0")}${String(tot%60).padStart(2,"0")}00`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${ds}`);
        const nd = new Date(m.date+"T00:00:00"); nd.setDate(nd.getDate()+1);
        lines.push(`DTEND;VALUE=DATE:${nd.toISOString().slice(0,10).replace(/-/g,"")}`);
      }
      lines.push(`SUMMARY:${m.emoji} ${m.title}`);
      lines.push(`DESCRIPTION:Estado: ${STATUS[m.status]?.label||m.status}\\nQuién: ${who}${m.duration?`\\nDuración: ${Math.round(m.duration/60*10)/10}h`:""}`);
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    dlBlob(new Blob([lines.join("\r\n")], {type:"text/calendar;charset=utf-8"}), `calendar-${icsFrom}-${icsTo}.ics`);
    setIcsModal(false);
  };

  const downloadWeekPDF = (weekData, weekKey, name1, name2) => {
    const missions = weekData.missions || [];
    const done = missions.filter(m=>m.status==="DONE").length;
    const sorted = [...missions].sort((a,b)=>{ if(a.date&&b.date) return (a.date+(a.time||""))>(b.date+(b.time||""))?1:-1; if(a.date)return -1; if(b.date)return 1; return 0; });
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Shared Calendar Semana ${weekData.weekNumber}</title>
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
<h1>📅 Semana ${weekData.weekNumber} · ${weekData.year||new Date().getFullYear()}</h1>
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
  const dur = m.duration;
  return `<tr><td class="emoji">${m.emoji}</td><td><div class="title${m.status==="DONE"?" done":""}">${m.title}</div>${dur?`<div class="detail">⏱ ${dur}h</div>`:""}</td><td style="font-size:13px;color:#555">${when}</td><td style="font-size:13px;color:#555">${who}</td><td><span class="badge ${m.status}">${STATUS[m.status]?.icon||""} ${STATUS[m.status]?.label||m.status}</span></td></tr>`;
}).join("")}
</tbody></table>
<div class="footer">📅 Shared Calendar</div>
</body></html>`;
    const win = window.open("","_blank");
    win.document.write(html);
    win.document.close();
    setTimeout(()=>{ win.print(); win.onafterprint = () => win.close(); }, 600);
  };

  const downloadFilteredPDF = (weekEntries, personFilter, name1, name2) => {
    const personLabel = !personFilter.length ? `${name1} & ${name2}` : personFilter.map(f=>f==="person1"?name1:f==="person2"?name2:"Juntos").join(" + ");
    const allMissions = weekEntries.flatMap(([,w]) => {
      const ms = !personFilter.length ? (w.missions||[]) : (w.missions||[]).filter(m=>personFilter.includes(m.who));
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
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Shared Calendar - ${personLabel}</title>
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
<h1>📅 Shared Calendar — ${personLabel}</h1>
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
<div class="footer">📅 Shared Calendar</div>
</body></html>`;
    const win = window.open("","_blank");
    win.document.write(html);
    win.document.close();
    setTimeout(()=>{ win.print(); win.onafterprint = () => win.close(); }, 600);
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
    <div style={{ minHeight:"100vh", overflowX:"hidden", background:"var(--t-bg,#0a0714)", backgroundImage:"var(--t-bg-grad)", fontFamily:"var(--t-font-body,'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif)", color:"var(--t-text,#f8f4ff)" }}>
      <ThemeInjector themeId={themeId} fontId={fontId} />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        *:focus { outline: none; }
        *:focus-visible { outline: 2px solid var(--t-accent,#a78bfa); outline-offset: 2px; border-radius: 4px; }
        .sc-nav-btn:focus-visible { outline: 2px solid var(--t-accent,#a78bfa); outline-offset: -2px; border-radius: 10px; }
        button:focus-visible, a:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--t-accent,#a78bfa); outline-offset: 2px; }
        @keyframes mc-pop { 0%{transform:scale(1)} 50%{transform:scale(1.28)} 100%{transform:scale(1)} }
        @keyframes sc-dot-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.75)} }
        @keyframes sc-saved-fade { 0%{opacity:1} 100%{opacity:0} }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* Hidden file input for import */}
      <input ref={importFileRef} type="file" accept=".json" onChange={handleImport} style={{ display:"none" }} />
      {/* Offline banner */}
      {!isOnline && <div style={{ position:"fixed", top:0, left:0, right:0, background:"rgba(30,20,10,0.97)", borderBottom:"1px solid rgba(251,146,60,0.4)", paddingTop:"calc(8px + env(safe-area-inset-top))", paddingBottom:8, paddingLeft:16, paddingRight:16, zIndex:500, display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#fdba74" }}>
        <span style={{ fontSize:16 }}>📡</span>
        <span style={{ flex:1 }}>Sin conexión · Los cambios se guardan localmente y se sincronizarán al reconectar</span>
        {pendingSave && <span style={{ fontSize:10, color:"#fb923c" }}>⏳ pendiente</span>}
      </div>}
      {isOnline && pendingSave && <div style={{ position:"fixed", top:0, left:0, right:0, background:"rgba(10,20,30,0.97)", borderBottom:"1px solid rgba(96,165,250,0.4)", paddingTop:"calc(6px + env(safe-area-inset-top))", paddingBottom:6, paddingLeft:16, paddingRight:16, zIndex:500, display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#60a5fa" }}>
        <span>🔄</span><span>Sincronizando cambios pendientes…</span>
      </div>}

      {importMsg && <div style={{ position:"fixed", bottom:90, left:"50%", transform:"translateX(-50%)", background:importMsg.startsWith("✅")?"rgba(52,211,153,0.15)":"rgba(251,146,60,0.15)", border:`1px solid ${importMsg.startsWith("✅")?"rgba(52,211,153,0.4)":"rgba(251,146,60,0.4)"}`, borderRadius:12, padding:"10px 20px", zIndex:400, fontSize:13, color:importMsg.startsWith("✅")?"#34d399":"#fb923c", whiteSpace:"nowrap", backdropFilter:"blur(8px)" }}>{importMsg}</div>}
      {syncMsg  && <div style={{ position:"fixed", bottom:syncMsg&&importMsg?130:90, left:"50%", transform:"translateX(-50%)", background:syncMsg.startsWith("⚠")?"rgba(251,146,60,0.15)":syncMsg.startsWith("✓")||syncMsg.startsWith("⬆")||syncMsg.startsWith("⬇")?"rgba(52,211,153,0.15)":"rgba(96,165,250,0.15)", border:`1px solid ${syncMsg.startsWith("⚠")?"rgba(251,146,60,0.4)":syncMsg.startsWith("✓")||syncMsg.startsWith("⬆")||syncMsg.startsWith("⬇")?"rgba(52,211,153,0.4)":"rgba(96,165,250,0.4)"}`, borderRadius:12, padding:"10px 20px", zIndex:400, fontSize:13, color:syncMsg.startsWith("⚠")?"#fb923c":syncMsg.startsWith("✓")||syncMsg.startsWith("⬆")||syncMsg.startsWith("⬇")?"#34d399":"#60a5fa", whiteSpace:"nowrap", backdropFilter:"blur(8px)" }}>{syncMsg}</div>}
      {syncError && !syncMsg && (
        <div style={{ position:"fixed", bottom:90, left:"50%", transform:"translateX(-50%)", background:"rgba(20,8,6,0.97)", border:"1px solid rgba(251,146,60,0.5)", borderRadius:12, padding:"10px 16px 10px 14px", zIndex:400, fontSize:12, color:"#fb923c", maxWidth:340, textAlign:"left", backdropFilter:"blur(8px)", display:"flex", alignItems:"flex-start", gap:8, boxShadow:"0 4px 24px rgba(0,0,0,0.5)" }}>
          <span style={{ flexShrink:0, fontSize:14 }}>⚠</span>
          <span style={{ flex:1, lineHeight:1.5, wordBreak:"break-word" }}>{syncError}</span>
          <button onClick={() => setSyncError(null)} style={{ flexShrink:0, background:"none", border:"none", color:"rgba(251,146,60,0.5)", cursor:"pointer", fontSize:16, padding:"0 0 0 4px", lineHeight:1 }}>×</button>
        </div>
      )}

      {showProfile && <ProfileModal data={data} update={update} onClose={()=>setShowProfile(false)} onStartTutorial={()=>{ setShowProfile(false); setTutorialStep(0); }} sessionUserId={sessionUserId} onCheckUpdate={checkUpdate} onThemeChange={(tid,fid)=>{ setLocalThemeId(tid); setLocalFontId(fid); }} />}

      {/* ICS export date-range modal */}
      {icsModal && <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setIcsModal(false)}>
        <div style={{background:"var(--t-card,#1d1733)",border:"1px solid var(--t-card-border,rgba(167,139,250,0.35))",borderRadius:16,padding:22,width:"100%",maxWidth:380}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <span style={{fontFamily:"'Fraunces',serif",fontSize:18,color:"var(--t-text,#f8f4ff)"}}>📅 Exportar a Google Calendar</span>
            <button onClick={()=>setIcsModal(false)} style={{background:"none",border:"none",color:"var(--t-text-dim,#6b5f88)",fontSize:20,cursor:"pointer"}}>×</button>
          </div>
          {/* Quick select */}
          <div style={S.label}>Selección rápida</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
            {[
              ["Esta semana", ()=>{ const {week:tw,year:ty}=getWeekAndYear(); const mon=weekStartDate(tw,ty); const sun=new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+6); setIcsFrom(mon.toISOString().slice(0,10)); setIcsTo(sun.toISOString().slice(0,10)); }],
              ["Este mes",    ()=>{ const n=new Date(); setIcsFrom(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`); setIcsTo(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${new Date(n.getFullYear(),n.getMonth()+1,0).getDate()}`); }],
              ["Próx. 4 sem.",()=>{ const n=new Date(),t=new Date(n); t.setDate(n.getDate()+28); setIcsFrom(n.toISOString().slice(0,10)); setIcsTo(t.toISOString().slice(0,10)); }],
              ["Próx. 3 meses",()=>{ const n=new Date(),t=new Date(n); t.setMonth(n.getMonth()+3); setIcsFrom(n.toISOString().slice(0,10)); setIcsTo(t.toISOString().slice(0,10)); }],
            ].map(([l,fn])=>(
              <button key={l} onClick={fn} style={{background:"var(--t-accent-soft,rgba(167,139,250,0.1))",border:"1px solid var(--t-card-border)",borderRadius:7,color:"var(--t-text-muted,#8b7fa8)",padding:"5px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>{l}</button>
            ))}
          </div>
          {/* Date pickers */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            <div><label style={S.label}>Desde</label><input type="date" value={icsFrom} onChange={e=>setIcsFrom(e.target.value)} style={{...S.inputSm,colorScheme:"dark"}} /></div>
            <div><label style={S.label}>Hasta</label><input type="date" value={icsTo}   onChange={e=>setIcsTo(e.target.value)}   style={{...S.inputSm,colorScheme:"dark"}} /></div>
          </div>
          {/* Preview count */}
          {icsFrom&&icsTo&&icsFrom<=icsTo&&<div style={{fontSize:12,color:"var(--t-text-dim,#6b5f88)",textAlign:"center",marginBottom:12}}>
            {Object.values(data.weeks).flatMap(w=>(w.missions||[]).filter(m=>m.date&&m.date>=icsFrom&&m.date<=icsTo)).length} actividades en ese rango
          </div>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setIcsModal(false)} style={S.btnSecondary}>Cancelar</button>
            <button onClick={downloadRangeICS} disabled={!icsFrom||!icsTo||icsFrom>icsTo} style={{...S.btnPrimary,flex:1,opacity:(!icsFrom||!icsTo||icsFrom>icsTo)?0.4:1}}>⬇ Descargar .ics</button>
          </div>
        </div>
      </div>}

      {/* Changelog modal */}
      {showChangelog && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={()=>setShowChangelog(false)}>
          <div style={{ background:"var(--t-card,#1d1733)", border:"1px solid rgba(251,191,36,0.3)", borderRadius:18, padding:24, width:"100%", maxWidth:420, maxHeight:"80vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <span style={{ fontFamily:"'Fraunces',serif", fontSize:20, color:"var(--t-accent,#fbbf24)" }}>📋 Changelog</span>
              <button onClick={()=>setShowChangelog(false)} style={{ background:"none", border:"none", color:"var(--t-text-muted,#6b5f88)", fontSize:20, cursor:"pointer" }}>×</button>
            </div>
            {CHANGELOG.map(c=>(
              <div key={c.v} style={{ marginBottom:16 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"var(--t-accent,#fbbf24)" }}>v{c.v}</span>
                  <span style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)" }}>{c.date}</span>
                </div>
                <ul style={{ margin:0, padding:"0 0 0 16px" }}>
                  {c.notes.map((n,i)=><li key={i} style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)", marginBottom:3 }}>{n}</li>)}
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
        <div style={{ paddingTop:"calc(18px + env(safe-area-inset-top))", paddingLeft:20, paddingRight:20, paddingBottom:14, borderBottom:"1px solid var(--t-card-border,rgba(167,139,250,0.07))", display:"flex", alignItems:"center", gap:12 }}>
          {data.settings?.photos?.couple
            ? <img src={data.settings.photos.couple} style={{ width:44, height:44, borderRadius:99, objectFit:"cover", border:"2px solid var(--t-accent,#a78bfa)", flexShrink:0 }} alt="pareja" />
            : <div style={{ width:44, height:44, borderRadius:99, background:"var(--t-accent-soft,rgba(167,139,250,0.1))", border:"1px solid var(--t-card-border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{data.settings?.coupleEmoji||"💞"}</div>
          }
          <div>
            <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", letterSpacing:1.5, textTransform:"uppercase" }}>Shared Calendar</div>
            <div style={{ fontSize:14, color:"var(--t-accent,#c4b8ff)", fontWeight:600, marginTop:1 }}>{p1} & {p2}</div>
          </div>
        </div>
        {/* Nav items */}
        <nav aria-label="Navegación principal" style={{ flex:1, padding:"10px 8px", display:"flex", flexDirection:"column", gap:2, overflowY:"auto" }}>
          {[
            { id:"home",     label:"Inicio",         icon:"🏠" },
            { id:"current",  label:"Semana",          icon:"🎯" },
            { id:"pending",  label:"Pendientes",      icon:"📋" },
            { id:"calendar", label:"Calendario",      icon:"📅" },
            { id:"history",  label:"Histórico",       icon:"🗂️" },
            { id:"goals",    label:"Metas",           icon:"🏅" },
            { id:"stats",    label:"Stats",           icon:"📊" },
            { id:"gastos",   label:"Gastos",          icon:"💸" },
            { id:"chat",     label:"Chat",            icon:"💬" },
            { id:"links",    label:"Links de Interés", icon:"🔗" },
          ].map(n => (
            <button key={n.id} onClick={()=>{ setActiveTab(n.id); setMenuOpen(false); }}
              aria-label={n.label} aria-current={activeTab===n.id ? "page" : undefined}
              className="sc-nav-btn"
              style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:10, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:activeTab===n.id?600:400, background:activeTab===n.id?"var(--t-accent-soft,rgba(167,139,250,0.14))":"transparent", color:activeTab===n.id?"var(--t-accent,#c4b8ff)":"var(--t-text-muted,#6b5f88)", textAlign:"left", width:"100%", transition:"all 0.15s", position:"relative" }}>
              <span aria-hidden="true" style={{ fontSize:17, lineHeight:1 }}>{n.icon}</span>
              <span style={{ flex:1 }}>{n.label}</span>
              {activeTab===n.id && <span aria-hidden="true" style={{ width:5, height:5, borderRadius:99, background:"var(--t-accent,#a78bfa)", flexShrink:0 }} />}
            </button>
          ))}
        </nav>
        {/* Menu footer: version only — always visible, no scroll needed */}
        <div style={{ padding:"12px 16px", borderTop:"1px solid var(--t-card-border,rgba(167,139,250,0.07))", flexShrink:0 }}>
          {syncMsg && <div style={{ fontSize:10, color:syncMsg.startsWith("⚠")?"#fb923c":syncMsg.startsWith("✓")?"#34d399":"#60a5fa", marginBottom:6, lineHeight:1.4 }}>{syncMsg}</div>}
          <button onClick={()=>{ setShowChangelog(true); setMenuOpen(false); }}
            style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 0", display:"flex", gap:8, alignItems:"center", width:"100%" }}>
            <span style={{ fontSize:11, fontWeight:700, color:"#fbbf24", letterSpacing:0.5, textShadow:"0 0 8px rgba(251,191,36,0.35)" }}>v{APP_VERSION}</span>
            <span style={{ fontSize:10, color:"var(--t-text-dim,#3d3360)" }}>{LAST_UPDATE}</span>
            <span style={{ fontSize:10, color:"var(--t-text-dim,#3d3360)", marginLeft:"auto" }}>Ver cambios →</span>
          </button>
        </div>
      </div>

      {/* ── Sticky top bar ── */}
      <div style={{ position:"sticky", top:0, zIndex:80, background:"var(--t-topbar-bg,rgba(10,7,20,0.9))", backdropFilter:"blur(14px)", WebkitBackdropFilter:"blur(14px)", borderBottom:"1px solid var(--t-card-border,rgba(167,139,250,0.08))", paddingTop:"env(safe-area-inset-top)" }}>
      <div style={{ height:52, display:"flex", alignItems:"center", gap:8, paddingLeft:12, paddingRight:12 }}>
        {/* Hamburger */}
        <button onClick={()=>setMenuOpen(v=>!v)} aria-label="Menú"
          style={{ background:"none", border:"none", cursor:"pointer", color:"var(--t-text-muted,#8b7fa8)", padding:"8px 6px", display:"flex", flexDirection:"column", gap:4, alignItems:"center", justifyContent:"center", flexShrink:0, borderRadius:8 }}>
          <span style={{ display:"block", width:18, height:1.5, background:"currentColor", borderRadius:99 }} />
          <span style={{ display:"block", width:13, height:1.5, background:"currentColor", borderRadius:99 }} />
          <span style={{ display:"block", width:18, height:1.5, background:"currentColor", borderRadius:99 }} />
        </button>
        {/* Home button */}
        <button onClick={()=>setActiveTab("home")} aria-label="Inicio"
          style={{ background:"none", border:"none", cursor:"pointer", color:activeTab==="home"?"#c4b8ff":"#4a4166", fontSize:18, padding:"6px 5px", lineHeight:1, borderRadius:8, flexShrink:0, transition:"color 0.15s" }}>🏠</button>
        {/* Page title */}
        <div style={{ flex:1, textAlign:"center" }}>
          {activeTab==="home"
            ? <Brand size={22} wordmark colors={colors} />
            : <span style={{ fontSize:13, fontWeight:500, color:"var(--t-text-muted,#8b7fa8)" }}>
                {activeTab==="current"  ? `🎯 Semana ${data.currentWeekNumber}`
                :activeTab==="pending"  ? "📋 Pendientes"
                :activeTab==="calendar" ? "Calendario"
                :activeTab==="history"  ? "🗂️ Histórico"
                :activeTab==="goals"    ? "🏅 Metas"
                :activeTab==="stats"    ? "📊 Stats"
                :activeTab==="gastos"   ? "💸 Gastos Compartidos"
                :activeTab==="chat"     ? "💬 Chat"
                :activeTab==="links"    ? "🔗 Links de Interés"
                : ""}
              </span>
          }
        </div>
        {/* Saving indicator dot — tappable when error to show detail */}
        {savingState !== "idle" && (
          <div
            role={savingState === "error" ? "button" : undefined}
            onClick={savingState === "error" ? () => forcePush() : undefined}
            title={savingState === "saving" ? "Guardando…" : savingState === "saved" ? "Guardado ✓" : "Error al guardar — toca para reintentar"}
            aria-label={savingState === "saving" ? "Guardando…" : savingState === "saved" ? "Guardado" : "Error al guardar — toca para reintentar"}
            style={{ width:savingState==="error"?20:7, height:savingState==="error"?20:7, borderRadius:99, flexShrink:0, cursor:savingState==="error"?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center",
              background: savingState === "saving" ? "#a78bfa" : savingState === "saved" ? "#34d399" : "rgba(248,113,113,0.15)",
              border: savingState === "error" ? "1.5px solid #f87171" : "none",
              animation: savingState === "saving" ? "sc-dot-pulse 1s ease-in-out infinite" : savingState === "saved" ? "sc-saved-fade 2s ease-out 0.5s forwards" : "none",
              boxShadow: savingState === "saving" ? "0 0 6px rgba(167,139,250,0.6)" : savingState === "saved" ? "0 0 6px rgba(52,211,153,0.6)" : "0 0 4px rgba(248,113,113,0.4)",
            }}>
            {savingState === "error" && <span style={{ fontSize:11, color:"#f87171", lineHeight:1 }}>!</span>}
          </div>
        )}
        {/* Dark/light toggle */}
        <button onClick={toggleDarkLight} aria-label={_activeTheme.dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
          title={_activeTheme.dark ? "Modo claro" : "Modo oscuro"}
          style={{ background:"none", border:"none", cursor:"pointer", color:"var(--t-text-muted,#8b7fa8)", fontSize:16, padding:"6px 5px", lineHeight:1, borderRadius:8, flexShrink:0 }}>
          <span aria-hidden="true">{_activeTheme.dark ? "☀️" : "🌙"}</span>
        </button>
        {/* Overflow menu ⋯ */}
        <div style={{ position:"relative", flexShrink:0 }}>
          <OverflowButton onClick={() => setPopOpen(o => !o)} />
          <OverflowMenu open={popOpen} onClose={() => setPopOpen(false)} items={[
            { icon:"↻", label:"Actualizar versión", onClick: checkUpdate },
            { icon:"⬆", label: syncing ? "Subiendo…" : "Subir datos a Supabase", onClick: () => { forcePush(); setPopOpen(false); } },
            { icon:"🔄", label: syncing ? "Sincronizando…" : "Bajar datos de Supabase", onClick: () => { forceSync(); setPopOpen(false); } },
            { divider: true },
            { icon:"📅", label:"Exportar a Google Calendar (.ics)", onClick: () => downloadWeekICS(week, wkey, p1, p2) },
            { icon:"🖨", label:"Imprimir / PDF", onClick: () => downloadWeekPDF(week, wkey, p1, p2) },
          ]} />
        </div>
        {/* Settings dropdown trigger */}
        <div style={{ position:"relative", flexShrink:0 }}>
          <button onClick={()=>setSettingsMenuOpen(v=>!v)} aria-label="Ajustes"
            style={{ background:"rgba(128,128,128,0.06)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.15))", borderRadius:8, color:"var(--t-text-dim,#6b5f88)", width:34, height:34, cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>⚙️</button>
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
      </div></div>{/* end inner 52px row + safe-area wrapper */}

      <div style={{ maxWidth:640, margin:"0 auto", padding:"18px 16px", paddingBottom:"calc(120px + env(safe-area-inset-bottom))" }}>

        {/* Global filters — show only for tabs that need them */}
        {(activeTab==="current"||activeTab==="calendar"||activeTab==="history"||activeTab==="pending") && (() => {
          const filterCount = globalPersonFilter.length + globalCatFilter.length;
          return (
            <div style={{ marginBottom:12 }}>
              <FilterButton count={filterCount} onClick={() => setFiltersOpen(true)} />
            </div>
          );
        })()}
        <FilterDrawer
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          filters={{ who: globalPersonFilter, cat: globalCatFilter }}
          setFilters={f => {
            setGlobalPersonFilter(f.who);
            setGlobalCatFilter(f.cat);
          }}
          persons={[
            { id:"person1",  name:p1,      emoji:"🙋", color:colors.person1 },
            { id:"person2",  name:p2,      emoji:"🙋", color:colors.person2 },
            { id:"together", name:"Juntos", emoji:"👫", color:colors.together },
          ]}
          categories={CATEGORIES.map(c => ({ id:c.id, label:c.label, emoji:c.icon, color:c.color }))}
        />

        {/* ── HOME ── */}
        {activeTab==="home" && (() => {
          const { week:todayWn, year:todayYr } = getWeekAndYear(new Date());
          const todayWkey = isoWeekKey(todayWn, todayYr);
          const todayWeekData = data.weeks[todayWkey] || { missions:[], epicObjective:"" };
          return (
            <HomeDashboard
              week={{ week: todayWn, year: todayYr, epicGoal: todayWeekData.epicObjective, label: fmtWeekRange(todayWn, todayYr) }}
              missions={todayWeekData.missions || []}
              goals={data.goals || []}
              colors={colors}
              p1={p1} p2={p2}
              photo={data.settings?.photos?.couple}
              p1Photo={data.settings?.photos?.person1}
              p2Photo={data.settings?.photos?.person2}
              onCycleStatus={id => cycleStatusGlobal(todayWn, todayYr, id)}
              onMissionPatch={(id, patch) => patchMissionGlobal(todayWn, todayYr, id, patch)}
              onDeleteMission={id => deleteMissionGlobal(todayWn, todayYr, id)}
              weeksData={data.weeks}
            />
          );
        })()}

        {/* Current Week */}
        {activeTab==="current" && <div {...swipeWeek}>
          {/* Week navigation */}
          <div style={{ textAlign:"center", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:14, marginBottom:week.epicObjective?4:8 }}>
              <button onClick={()=>changeWeek(-1)} style={S.btnNav}>‹</button>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:36, fontWeight:700, lineHeight:1, letterSpacing:-1 }}>Semana {data.currentWeekNumber}</div>
                <div style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)", marginTop:4 }}>{fmtWeekRange(data.currentWeekNumber, data.currentYear)}</div>
                <div style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)", marginTop:2 }}>Hoy: {fmtShortDate(new Date())}</div>
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
              <div style={{ background:"rgba(128,128,128,0.10)", borderRadius:99, height:5, overflow:"hidden", margin:"8px 24px 0" }}>
                <div style={{ height:"100%", width:`${pct}%`, background:"linear-gradient(90deg,#f472b6,#a78bfa)", borderRadius:99, transition:"width 0.6s" }} />
              </div>
              <div style={{ fontSize:11, color:"var(--t-text-muted,#8b7fa8)", marginTop:5 }}>{done} de {total} completadas {pct===100?"🎉":`(${Math.round(pct)}%)`}</div>
            </>}
          </div>
          {carriedCount>0 && <div style={{ background:"rgba(251,146,60,0.1)", border:"1px solid rgba(251,146,60,0.25)", borderRadius:12, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:10, fontSize:13 }}>
            <span style={{ fontSize:20 }}>🔁</span>
            <span style={{ color:"#fdba74" }}><strong>{carriedCount} misión{carriedCount>1?"es":""}</strong> arrastrada{carriedCount>1?"s":""} de la semana anterior</span>
          </div>}
          <WorkHoursCard week={week} patchWeek={patchWeek} p1={p1} p2={p2} />
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginBottom:4 }}>
            <button onClick={runCarryOver} style={{ background:"none", border:"none", color:"var(--t-text-dim,#4a4166)", fontSize:11, cursor:"pointer", fontFamily:"inherit", padding:"2px 4px" }}
              onMouseEnter={e=>e.currentTarget.style.color="#a78bfa"} onMouseLeave={e=>e.currentTarget.style.color="#4a4166"}>🔁 Recuperar tareas pendientes</button>
            <button onClick={runRepair} style={{ background:"none", border:"none", color:"var(--t-text-dim,#4a4166)", fontSize:11, cursor:"pointer", fontFamily:"inherit", padding:"2px 4px" }}
              onMouseEnter={e=>e.currentTarget.style.color="#60a5fa"} onMouseLeave={e=>e.currentTarget.style.color="#4a4166"}>📅 Distribuir eventos</button>
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:6, marginBottom:6 }}>
            {!showAddForm && <>
              <button onClick={()=>{ setNewM(p=>({...p,type:"task",emoji:"🎯"})); setShowAddForm(true); }}
                style={{ background:"rgba(167,139,250,0.1)", border:"1px solid rgba(167,139,250,0.25)", borderRadius:99, color:"var(--t-accent,#a78bfa)", cursor:"pointer", fontSize:12, fontFamily:"inherit", padding:"5px 13px", display:"flex", alignItems:"center", gap:5 }}
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
          {/* View mode + Sort bar */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:8, flexWrap:"wrap" }}>
            <div style={{ display:"flex", gap:4 }}>
              {[["timeline","⏱ Timeline"],["list","☰ Lista detallada"]].map(([v,l])=>(
                <button key={v} onClick={()=>setWeekViewMode(v)} style={{ background:weekViewMode===v?"rgba(167,139,250,0.18)":"rgba(128,128,128,0.05)", border:`1px solid ${weekViewMode===v?"rgba(167,139,250,0.4)":"rgba(255,255,255,0.07)"}`, borderRadius:99, color:weekViewMode===v?"#c4b8ff":"#4a4166", padding:"3px 11px", cursor:"pointer", fontSize:10, fontFamily:"inherit", fontWeight:weekViewMode===v?600:400 }}>{l}</button>
              ))}
            </div>
            {weekViewMode==="list" && <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
              <span style={{ fontSize:9, color:"var(--t-text-dim,#3d3360)", letterSpacing:1.5, textTransform:"uppercase", fontWeight:600 }}>↕️</span>
              {[["default","Por defecto"],["chrono","Cronológico"],["type","Tipo"],["who","Persona"],["status","Estado"]].map(([v,l])=>(
                <button key={v} onClick={()=>setWeekSort(v)} style={{ background:weekSort===v?"rgba(167,139,250,0.18)":"rgba(128,128,128,0.05)", border:`1px solid ${weekSort===v?"rgba(167,139,250,0.4)":"rgba(255,255,255,0.07)"}`, borderRadius:99, color:weekSort===v?"#c4b8ff":"#4a4166", padding:"2px 9px", cursor:"pointer", fontSize:10, fontFamily:"inherit", fontWeight:weekSort===v?600:400 }}>{l}</button>
              ))}
            </div>}
          </div>
          {weekViewMode==="timeline" ? (() => {
            const mon = weekStartDate(data.currentWeekNumber, data.currentYear);
            const weekDays = Array.from({ length:7 }, (_, i) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate()+i));
            const filtered=(week.missions||[]).filter(m=>(!globalPersonFilter.length||globalPersonFilter.includes(m.who))&&(!globalCatFilter.length||getMCats(m).some(c=>globalCatFilter.includes(c))));
            return <WeekTimeline missions={filtered} weekDays={weekDays} renderCard={m=><MissionCard key={m.id} mission={m} p1={p1} p2={p2} colors={colors} goals={data.goals||[]} weeksData={data.weeks} onCycleStatus={()=>cycleStatus(m.id)} onDelete={()=>delMission(m.id)} onPatch={p=>patchM(m.id,p)} />} />;
          })() : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {(()=>{
              const filtered=(week.missions||[]).filter(m=>(!globalPersonFilter.length||globalPersonFilter.includes(m.who))&&(!globalCatFilter.length||getMCats(m).some(c=>globalCatFilter.includes(c))));
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
          </div>}
        </div>}

        {activeTab==="calendar" && <CalendarView
          allDatedMissions={allDated} p1={p1} p2={p2} colors={colors} settings={data.settings} personFilter={globalPersonFilter} catFilter={globalCatFilter} goals={data.goals||[]}
          onPatchMission={patchMissionGlobal} onDeleteMission={deleteMissionGlobal} onPatchAllFutureSeries={patchAllFutureSeries}
          onAddForDay={(date) => {
            const { week:wn, year:yr } = getWeekAndYear(new Date(date));
            update(s => ({...s, currentWeekNumber:wn, currentYear:yr}));
            setNewM(p=>({...p, date, type:"event", emoji:"📅"}));
            setShowAddForm(true); setActiveTab("current");
          }}
          onDownloadICS={() => downloadWeekICS(week, wkey, p1, p2)}
          onDownloadPDF={() => downloadWeekPDF(week, wkey, p1, p2)}
          onCycleStatus={cycleStatusGlobal}
        />}

        {activeTab==="history" && (() => {
          const { week:_htw, year:_hty } = getWeekAndYear();
          const _htodayKey = isoWeekKey(_htw, _hty);
          const allHistSorted = Object.entries(data.weeks).filter(([key])=>key<=_htodayKey).sort((a,b)=>b[0].localeCompare(a[0]));
          const histFiltered = histWeekRange==="all" ? allHistSorted : allHistSorted.slice(0, parseInt(histWeekRange));
          const filterHM = ms => ms.filter(m=>(!globalPersonFilter.length||globalPersonFilter.includes(m.who))&&(!globalCatFilter.length||getMCats(m).some(c=>globalCatFilter.includes(c))));
          return (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {/* Filter bar */}
            <div style={{ ...S.card, padding:"10px 14px" }}>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                <div>
                  <div style={S.label}>Semanas</div>
                  <div style={{ display:"flex", gap:3 }}>
                    {[["all","Todas"],["1","Esta sem."],["4","4 últ."],["8","8 últ."]].map(([v,l])=>(
                      <button key={v} onClick={()=>setHistWeekRange(v)} style={{ background:histWeekRange===v?"var(--t-accent-soft,rgba(167,139,250,0.2))":"rgba(128,128,128,0.06)", border:`1px solid ${histWeekRange===v?"var(--t-accent,rgba(167,139,250,0.4))":"var(--t-card-border,rgba(255,255,255,0.08))"}`, borderRadius:7, color:histWeekRange===v?"var(--t-accent,#a78bfa)":"var(--t-text-dim,#6b5f88)", padding:"4px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Week cards */}
            {histFiltered.map(([key,w]) => {
              const filtMs = filterHM(w.missions||[]);
              const d=filtMs.filter(m=>m.status==="DONE").length, t=filtMs.length, p=t>0?Math.round((d/t)*100):0, cur=key===wkey;
              return (
                <div key={key} style={{ ...S.card, borderColor:cur?"var(--t-accent,rgba(167,139,250,0.45))":"var(--t-card-border,rgba(167,139,250,0.1))", background:cur?"var(--t-accent-soft,rgba(167,139,250,0.12))":"var(--t-card,#1d1733)", padding:"12px 14px" }}>
                  <div onClick={()=>{const yr=parseInt(key.split("-W")[0])||w.year;update(s=>({...s,currentWeekNumber:w.weekNumber,currentYear:yr}));setActiveTab("current");}} style={{ cursor:"pointer", marginBottom:w.epicObjective?5:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ fontFamily:"'Fraunces',serif", fontWeight:600, fontSize:18, display:"flex", alignItems:"center", gap:7 }}>
                        Semana {w.weekNumber}
                        {cur&&<span style={{ fontSize:10, color:"var(--t-accent,#a78bfa)", background:"var(--t-accent-soft,rgba(167,139,250,0.15))", padding:"2px 7px", borderRadius:99, fontFamily:"inherit", fontWeight:600 }}>ACTUAL</span>}
                      </div>
                      <div style={{ fontSize:13, color:p===100?"#34d399":"var(--t-text-muted,#8b7fa8)", fontWeight:600 }}>{p===100?"🏆":""} {d}/{t}</div>
                    </div>
                    {w.epicObjective&&<div style={{ fontSize:12, color:"var(--t-text-dim,#6b5f88)", marginTop:3, fontStyle:"italic", fontFamily:"'Fraunces',serif", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>"{w.epicObjective}"</div>}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }} onClick={e=>e.stopPropagation()}>
                    <div style={{ flex:1 }}>
                      <div style={{ background:"rgba(128,128,128,0.10)", borderRadius:99, height:5, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${p}%`, borderRadius:99, background:p===100?"linear-gradient(90deg,#34d399,#60a5fa)":"linear-gradient(90deg,#f472b6,#a78bfa)", transition:"width 0.5s" }} />
                      </div>
                      <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", marginTop:3 }}>{p}%{globalPersonFilter.length?` (${globalPersonFilter.map(f=>f==="person1"?p1:f==="person2"?p2:"Juntos").join("+")})`:""}</div>
                    </div>
                    {w.photo
                      ? <div style={{ position:"relative", flexShrink:0 }}>
                          <img src={w.photo} onClick={()=>setLightboxSrc(w.photo)} style={{ width:44, height:44, borderRadius:8, objectFit:"cover", display:"block", border:"1px solid rgba(167,139,250,0.25)", cursor:"zoom-in" }} alt="foto" title="Ver foto completa" />
                          <button onClick={()=>update(d=>({...d,weeks:{...d.weeks,[key]:{...d.weeks[key],photo:null}}}))}
                            style={{ position:"absolute", top:-5, right:-5, background:"var(--t-card,#1d1733)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.3))", borderRadius:99, color:"var(--t-text-muted,#8b7fa8)", fontSize:9, width:16, height:16, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>✕</button>
                        </div>
                      : <div style={{ flexShrink:0, display:"flex", gap:4 }}>
                          <label style={{ width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(128,128,128,0.05)", border:"1px dashed rgba(167,139,250,0.18)", borderRadius:8, cursor:"pointer", fontSize:14 }} title="Tomar foto">
                            📷
                            <input type="file" accept="image/*" capture="environment" style={{ display:"none" }}
                              onChange={async e=>{const f=e.target.files[0];if(!f)return;const b64=await compressImage(f);update(d=>({...d,weeks:{...d.weeks,[key]:{...d.weeks[key],photo:b64}}}));e.target.value="";}} />
                          </label>
                          <label style={{ width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(128,128,128,0.05)", border:"1px dashed rgba(167,139,250,0.18)", borderRadius:8, cursor:"pointer", fontSize:14 }} title="Elegir de galería">
                            🖼️
                            <input type="file" accept="image/*" style={{ display:"none" }}
                              onChange={async e=>{const f=e.target.files[0];if(!f)return;const b64=await compressImage(f);update(d=>({...d,weeks:{...d.weeks,[key]:{...d.weeks[key],photo:b64}}}));e.target.value="";}} />
                          </label>
                        </div>
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

        {activeTab==="chat" && <ChatView coupleId={coupleId} personName={personName} p1={p1} p2={p2} chatNotifEnabled={notifGranted && (data.settings?.notifications?.chat!==false)} />}

        {activeTab==="gastos" && <GastosView gastos={data.gastos||[]} proyectos={data.gastosProyectos||[]} p1={p1} p2={p2} colors={colors} onUpdate={gastos=>update(d=>({...d,gastos}))} onUpdateProyectos={proyectos=>update(d=>({...d,gastosProyectos:proyectos}))} onUpdateAll={patch=>update(d=>({...d,...patch}))} />}

        {activeTab==="links" && <LinksView links={data.links||[]} onSave={links=>update(d=>({...d,links}))} />}

        {activeTab==="pending" && (()=>{
          // ── Pendientes ──────────────────────────────────────────────────────
          // Only suppress originals when an UNDONE carry copy exists (if carry copy is DONE, show original)
          const carriedFromIds=new Set(Object.values(data.weeks).flatMap(w=>(w.missions||[]).filter(m=>m.carriedFrom&&m.status!=="DONE").map(m=>m.carriedFrom)));
          const pendingRaw=Object.entries(data.weeks)
            .sort((a,b)=>a[0].localeCompare(b[0]))
            .flatMap(([key,w])=>(w.missions||[])
              .filter(m=>m.status!=="DONE" && m.type!=="event" && !carriedFromIds.has(m.id))
              .map(m=>({...m,weekNumber:w.weekNumber,_yr:parseInt(key.split("-W")[0])||new Date().getFullYear(),_wkey:key})));
          const latestBySeries={};
          for(const m of pendingRaw){if(m.seriesId&&(!latestBySeries[m.seriesId]||m._wkey>latestBySeries[m.seriesId]._wkey))latestBySeries[m.seriesId]=m;}
          const pendingAll=pendingRaw.filter(m=>!m.seriesId||latestBySeries[m.seriesId]===m);
          const pendingFiltered=pendingAll.filter(m=>
            (!globalPersonFilter.length||globalPersonFilter.includes(m.who))&&
            (!globalCatFilter.length||getMCats(m).some(c=>globalCatFilter.includes(c)))
          );
          // ── Logros ──────────────────────────────────────────────────────────
          // Sorted newest-week-first so dedup keeps the most recent completion
          const logrosAll=Object.entries(data.weeks)
            .sort((a,b)=>b[0].localeCompare(a[0]))
            .flatMap(([key,w])=>(w.missions||[])
              .filter(m=>m.status==="DONE" && m.type!=="event")
              .map(m=>({...m,weekNumber:w.weekNumber,_yr:parseInt(key.split("-W")[0])||new Date().getFullYear(),_wkey:key})));
          // Dedup: by seriesId only (recurring tasks)
          const _seenSeries = new Set();
          const logrosDeduped = logrosAll.filter(m => {
            if (m.seriesId) {
              if (_seenSeries.has(m.seriesId)) return false;
              _seenSeries.add(m.seriesId);
            }
            return true;
          });
          // Hero stats para Logros
          const cwKey = `${data.currentYear}-W${String(data.currentWeekNumber).padStart(2,"0")}`;
          const logrosThisWeek = logrosAll.filter(m => m._wkey === cwKey).length;
          // Racha: días consecutivos hacia atrás con al menos 1 logro (usa completedAt)
          const logrosWithDate = logrosAll.filter(m => m.completedAt);
          const doneByDay = new Set(logrosWithDate.map(m => typeof m.completedAt === 'string' ? m.completedAt.slice(0,10) : null));
          let racha = 0;
          const today = new Date();
          for (let i = 0; i < 365; i++) {
            const d = new Date(today); d.setDate(today.getDate() - i);
            const key = d.toISOString().slice(0,10);
            if (doneByDay.has(key)) racha++;
            else if (i > 0) break;
          }
          const subTabStyle=(active)=>({
            flex:1, padding:"7px 0", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit",
            fontSize:12, fontWeight:600,
            background: active ? "var(--t-accent-soft,rgba(167,139,250,0.14))" : "rgba(128,128,128,0.06)",
            color: active ? "var(--t-accent,#a78bfa)" : "var(--t-text-muted,#8b7fa8)",
            transition:"all .15s",
          });
          return <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {/* Toolbar: sub-tabs + refresh */}
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <div style={{display:"flex",flex:1,gap:4,background:"rgba(128,128,128,0.06)",borderRadius:10,padding:3}}>
                <button onClick={()=>setPendingTab("pending")} style={subTabStyle(pendingTab==="pending")}>📋 Pendientes <span style={{fontSize:10,opacity:0.7}}>({pendingFiltered.length})</span></button>
                <button onClick={()=>{ setPendingTab("logros"); track("logros_tab_viewed", { count: logrosDeduped.length }); }}  style={subTabStyle(pendingTab==="logros")}>🏆 Logros <span style={{fontSize:10,opacity:0.7}}>({logrosDeduped.length})</span></button>
              </div>
              <button onClick={()=>forceSync()} title="Bajar datos de Supabase"
                style={{...S.btnSecondary, padding:"7px 10px", fontSize:12, display:"flex", alignItems:"center", gap:4, flexShrink:0}}>
                🔄 Bajar
              </button>
              <button onClick={()=>forcePush()} title="Subir datos locales a Supabase"
                style={{...S.btnSecondary, padding:"7px 10px", fontSize:12, display:"flex", alignItems:"center", gap:4, flexShrink:0, color:"var(--t-accent,#a78bfa)"}}>
                ⬆ Subir
              </button>
            </div>
            {/* Pendientes list */}
            {pendingTab==="pending" && (
              pendingFiltered.length===0
                ?<div style={{...S.card,textAlign:"center",color:"var(--t-text-dim,#3d3360)",fontStyle:"italic",padding:40}}>
                  <div style={{fontSize:36,marginBottom:12}}>🎉</div>
                  <div>¡Sin pendientes! Todo al día.</div>
                </div>
                :<div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {pendingFiltered.map(m=>{
                    const whoColor=m.who==="person1"?colors?.person1||DEFAULT_COLORS.person1:m.who==="person2"?colors?.person2||DEFAULT_COLORS.person2:colors?.together||DEFAULT_COLORS.together;
                    const isCarriedM=!!m.carriedFrom;
                    const delayWeeks=(()=>{if(!isCarriedM)return 0;let n=0,oid=m.carriedFrom,owk=m.carriedFromWeek;while(oid&&owk&&n<20){n++;const ow=data.weeks[owk];if(!ow)break;const om=(ow.missions||[]).find(x=>x.id===oid);if(!om?.carriedFrom)break;oid=om.carriedFrom;owk=om.carriedFromWeek;}return n;})();
                    return <div key={m.id+m._wkey} style={{...S.card,padding:"10px 14px"}}>
                      {isCarriedM&&<div style={{fontSize:10,color:delayWeeks>=3?"#f87171":"#fb923c",letterSpacing:0.5,marginBottom:5,display:"flex",alignItems:"center",gap:4}}>
                        {delayWeeks>=3?"⚠️":"🔁"} {delayWeeks>=3?`Arrastrada ${delayWeeks} semanas`:"Arrastrada"}
                      </div>}
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:22,flexShrink:0}}>{m.emoji}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,color:"var(--t-text,#e2d9ff)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.title}</div>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:3}}>
                            <span style={{fontSize:10,color:"var(--t-text-dim,#4a4166)"}}>S{m.weekNumber} {m._yr}</span>
                            {m.date&&<span style={{fontSize:10,color:"var(--t-accent,#a78bfa)"}}>📆 {m.date}</span>}
                            {getMCats(m).map(ci=>{const c=CAT_MAP[ci];return c?<span key={ci} style={{fontSize:10,color:c.color}}>{c.icon} {c.label}</span>:null;})}
                            <span style={{fontSize:10,background:`${whoColor}18`,color:whoColor,border:`1px solid ${whoColor}40`,padding:"0 5px",borderRadius:99}}>{m.who==="person1"?p1:m.who==="person2"?p2:"👫"}</span>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:4,flexShrink:0,alignItems:"center"}}>
                          <button onClick={()=>cycleStatusGlobal(m.weekNumber,m._yr,m.id)} style={badgeStyle(m.status)}>{STATUS[m.status].icon}</button>
                          <button onClick={()=>{update(s=>({...s,currentWeekNumber:m.weekNumber,currentYear:m._yr}));setActiveTab("current");}} style={{...S.btnSecondary,fontSize:10,padding:"4px 8px"}}>→ S{m.weekNumber}</button>
                          <button onClick={()=>confirm("¿Eliminar esta tarea?",()=>deleteMissionGlobal(m.weekNumber,m._yr,m.id))} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t-text-dim,#4a4166)",fontSize:18,padding:"0 2px",lineHeight:1,flexShrink:0}} title="Eliminar">×</button>
                        </div>
                      </div>
                    </div>;
                  })}
                </div>
            )}
            {/* Logros list */}
            {pendingTab==="logros" && (()=>{
              // PillFilter data
              const peoplePills = [
                { id:"person1", label:p1, count:logrosDeduped.filter(m=>m.who==="person1").length, color:colors?.person1||DEFAULT_COLORS.person1 },
                { id:"person2", label:p2, count:logrosDeduped.filter(m=>m.who==="person2").length, color:colors?.person2||DEFAULT_COLORS.person2 },
                { id:"together", label:"Juntos", count:logrosDeduped.filter(m=>m.who==="together").length, color:colors?.together||DEFAULT_COLORS.together },
              ].filter(p=>p.count>0);
              const catCounts = {};
              logrosDeduped.forEach(m=>getMCats(m).forEach(c=>{ catCounts[c]=(catCounts[c]||0)+1; }));
              const catPills = Object.entries(catCounts)
                .filter(([,n])=>n>0)
                .map(([id,count])=>({ id, count, ...CAT_MAP[id] }))
                .filter(c=>c.label);
              // Local filtered
              const logrosLocalFiltered = logrosDeduped.filter(m =>
                (!logrosPeopleFilter.length || logrosPeopleFilter.includes(m.who)) &&
                (!logrosCatFilter.length || getMCats(m).some(c => logrosCatFilter.includes(c)))
              );
              // Group by day
              const byDay = {};
              logrosLocalFiltered.forEach(m => {
                const day = (typeof m.completedAt === 'string' ? m.completedAt.slice(0,10) : null) || m._wkey;
                if(!byDay[day]) byDay[day]=[];
                byDay[day].push(m);
              });
              const days = Object.entries(byDay).sort(([a],[b])=>b.localeCompare(a));
              return (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {/* Hero stats */}
                  <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:2}}>
                    {[
                      { icon:"🏆", value:logrosDeduped.length, label:"Totales" },
                      { icon:"📅", value:logrosThisWeek, label:"Esta semana" },
                      { icon:"🔥", value:racha, label:`Día${racha!==1?"s":""} de racha` },
                    ].map(s=>(
                      <div key={s.label} style={{flex:"0 0 auto",background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.18)",borderRadius:12,padding:"10px 16px",textAlign:"center",minWidth:90}}>
                        <div style={{fontSize:20}}>{s.icon}</div>
                        <div style={{fontFamily:"'Fraunces',serif",fontSize:22,color:"#f8f4ff",fontWeight:700,lineHeight:1}}>{s.value}</div>
                        <div style={{fontSize:10,color:"#8b7fa8",marginTop:2}}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* PillFilter local */}
                  <PillFilter
                    people={peoplePills}
                    categories={catPills}
                    selectedPeople={logrosPeopleFilter}
                    selectedCats={logrosCatFilter}
                    onTogglePerson={id=>setLogrosPeopleFilter(f=>f.includes(id)?f.filter(x=>x!==id):[...f,id])}
                    onToggleCat={id=>setLogrosCatFilter(f=>f.includes(id)?f.filter(x=>x!==id):[...f,id])}
                  />
                  {/* Timeline agrupada por día */}
                  {logrosLocalFiltered.length===0
                    ? <div style={{...S.card,textAlign:"center",color:"var(--t-text-dim,#3d3360)",fontStyle:"italic",padding:40}}>
                        <div style={{fontSize:36,marginBottom:12}}>🏆</div>
                        <div>Todavía no hay logros registrados.</div>
                      </div>
                    : <div style={{display:"flex",flexDirection:"column",gap:14}}>
                        {days.map(([day,missions],di)=>{
                          let dayLabel;
                          if(day.includes("-W")) {
                            const [yr,wn]=day.split("-W");
                            dayLabel=`Semana ${wn} · ${yr}`;
                          } else {
                            const d=new Date(day+"T12:00:00");
                            const todayStr=new Date().toISOString().slice(0,10);
                            const yesterStr=new Date(Date.now()-86400000).toISOString().slice(0,10);
                            dayLabel=day===todayStr?"Hoy":day===yesterStr?"Ayer":d.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"short"});
                          }
                          return (
                            <div key={day} style={{opacity:0,animation:`fadeInUp 0.3s ease ${di*0.05}s forwards`}}>
                              <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"var(--t-accent,#a78bfa)",fontWeight:600,marginBottom:6}}>
                                {dayLabel} · {missions.length} logro{missions.length!==1?"s":""}
                              </div>
                              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                                {missions.map(m=>{
                                  const whoColor=m.who==="person1"?colors?.person1||DEFAULT_COLORS.person1:m.who==="person2"?colors?.person2||DEFAULT_COLORS.person2:colors?.together||DEFAULT_COLORS.together;
                                  return (
                                    <div key={m.id+m._wkey} style={{...S.card,padding:"9px 13px",borderLeft:`3px solid ${whoColor}`,opacity:0,animation:`fadeInUp 0.25s ease ${di*0.05+0.05}s forwards`}}>
                                      <div style={{display:"flex",alignItems:"center",gap:9}}>
                                        <span style={{fontSize:20,flexShrink:0}}>{m.emoji}</span>
                                        <div style={{flex:1,minWidth:0}}>
                                          <div style={{fontSize:13,color:"var(--t-text,#e2d9ff)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.title}</div>
                                          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:2}}>
                                            <span style={{fontSize:10,background:`${whoColor}18`,color:whoColor,border:`1px solid ${whoColor}40`,padding:"0 5px",borderRadius:99}}>{m.who==="person1"?p1:m.who==="person2"?p2:"👫"}</span>
                                            {getMCats(m).map(ci=>{const c=CAT_MAP[ci];return c?<span key={ci} style={{fontSize:10,color:c.color}}>{c.icon}</span>:null;})}
                                          </div>
                                        </div>
                                        <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                                          <span style={{fontSize:18}}>✅</span>
                                          <button onClick={()=>confirm("¿Eliminar este logro?",()=>deleteMissionGlobal(m.weekNumber,m._yr,m.id))} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t-text-dim,#4a4166)",fontSize:16,padding:"0 2px",lineHeight:1}} title="Eliminar">×</button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                  }
                </div>
              );
            })()}
          </div>;
        })()}
      </div>

      {/* Tutorial overlay */}
      {tutorialStep !== null && <TutorialOverlay step={tutorialStep} onNext={tutorialNext} onSkip={tutorialSkip} onFinish={tutorialFinish} />}

      {/* Lightbox */}
      {lightboxSrc && (
        <div onClick={()=>setLightboxSrc(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16, cursor:"zoom-out" }}>
          <img src={lightboxSrc} style={{ maxWidth:"100%", maxHeight:"100%", borderRadius:12, objectFit:"contain", boxShadow:"0 20px 60px rgba(0,0,0,0.8)" }} alt="foto completa" />
          <div style={{ position:"absolute", top:16, right:16, display:"flex", gap:8 }}>
            <a href={lightboxSrc} download="foto.jpg" onClick={e=>e.stopPropagation()} style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:99, color:"#f8f4ff", fontSize:18, width:38, height:38, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none" }}>⬇</a>
            <button onClick={()=>setLightboxSrc(null)} style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:99, color:"#f8f4ff", fontSize:20, width:38, height:38, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
          </div>
        </div>
      )}
      <Toast toast={appToast} onDismiss={dismissToast} />
      {import.meta.env.DEV && coupleId && data && (
        <DevBackfillPanel coupleId={coupleId} blobData={data} />
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
                {wh.person1>0&&<span style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)" }}>{p1}: <strong style={{ color:"#f8f4ff" }}>{wh.person1}h</strong></span>}
                {wh.person2>0&&<span style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)" }}>{p2}: <strong style={{ color:"#f8f4ff" }}>{wh.person2}h</strong></span>}
              </div>
            : <span style={{ fontSize:12, color:"var(--t-text-dim,#3d3360)", fontStyle:"italic" }}>sin registrar</span>
          }
          <span style={{ color:"var(--t-text-dim,#4a4166)", fontSize:14 }}>{open?"▲":"▼"}</span>
        </div>
      </div>
      {open && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:12 }}>
          {[{key:"person1",label:p1},{key:"person2",label:p2}].map(({key,label})=>(
            <div key={key}>
              <label style={S.label}>{label}</label>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <input type="number" min="0" max="80" step="0.5" value={wh[key]||""} onChange={e=>patchWeek(w=>({...w, workHours:{...w.workHours,[key]:parseFloat(e.target.value)||0}}))} placeholder="0" style={{ ...S.inputSm, width:"70px" }} />
                <span style={{ fontSize:12, color:"var(--t-text-dim,#6b5f88)" }}>horas</span>
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
  const goalMatchesWho = (g, who) => who === "together" || g.who === "together" || !g.who || g.who === who;
  const activeGoals = (goals||[]).filter(g => g.active!==false && goalMatchesWho(g, newM.who));
  const isEvent = newM.type==="event";
  const [endMode, setEndMode] = useState("duration");

  const computeEnd = (date, time, durMin) => {
    if (!date || !time || !durMin || durMin<=0) return { endDate:"", endTime:"" };
    const e = new Date(new Date(date+"T"+time).getTime() + durMin*60000);
    return { endDate:`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`, endTime:`${String(e.getHours()).padStart(2,"0")}:${String(e.getMinutes()).padStart(2,"0")}` };
  };
  const computeDur = (d, t, ed, et) => {
    if (!d||!t||!ed||!et) return null;
    const diff = Math.round((new Date(ed+"T"+et) - new Date(d+"T"+t)) / 60000);
    return diff > 0 ? diff : null;
  };
  const durLabel = min => !min ? "" : min>=60 ? `${Math.floor(min/60)}h${min%60?` ${min%60}m`:""}` : `${min}m`;

  const { endDate:calcEndDate, endTime:calcEndTime } = computeEnd(newM.date, newM.time, newM.duration);
  const calcDurMin = computeDur(newM.date, newM.time, newM.endDate, newM.endTime);

  return (
    <div style={{ ...S.card, borderColor:isEvent?"rgba(96,165,250,0.35)":"rgba(167,139,250,0.3)" }}>
      <div style={{ display:"flex", gap:4, marginBottom:10 }}>
        {[{id:"task",label:"✅ Tarea"},{id:"event",label:"📅 Evento"}].map(t=>(
          <button key={t.id} onClick={()=>setNewM(p=>({...p,type:t.id}))}
            style={{ flex:1, background:newM.type===t.id?(t.id==="event"?"rgba(96,165,250,0.18)":"rgba(167,139,250,0.18)"):"rgba(128,128,128,0.05)", border:`1px solid ${newM.type===t.id?(t.id==="event"?"rgba(96,165,250,0.5)":"rgba(167,139,250,0.5)"):"rgba(255,255,255,0.08)"}`, borderRadius:8, color:newM.type===t.id?(t.id==="event"?"#60a5fa":"#c4b8ff"):"#4a4166", padding:"5px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:newM.type===t.id?600:400 }}>
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
              style={{ background:newM.who===w.id?"rgba(167,139,250,0.2)":"rgba(128,128,128,0.06)", border:`1px solid ${newM.who===w.id?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:8, color:newM.who===w.id?"#c4b8ff":"#6b5f88", padding:"5px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
              {w.icon} {w.label}
            </button>
          ))}
        </div>
      </div>
      {isEvent&&<>
        {/* Inicio — date + time agrupados en card */}
        <div style={{ background:"rgba(167,139,250,0.06)", border:"1px solid rgba(167,139,250,0.15)", borderRadius:10, padding:"10px 12px", marginBottom:8 }}>
          <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>📅 Inicio</div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input type="date" value={newM.date} onChange={e=>{const d=e.target.value;if(endMode==="duration"){const {endDate,endTime}=computeEnd(d,newM.time,newM.duration);setNewM(p=>({...p,date:d,endDate,endTime}));}else{const dur=computeDur(d,newM.time,newM.endDate,newM.endTime);setNewM(p=>({...p,date:d,...(dur!==null?{duration:dur}:{})}));}}} style={{ ...S.inputSm, colorScheme:"dark", flex:1, padding:"9px 10px", fontSize:14, minHeight:40 }} />
            <input type="time" value={newM.time} onChange={e=>{const t=e.target.value;if(endMode==="duration"){const {endDate,endTime}=computeEnd(newM.date,t,newM.duration);setNewM(p=>({...p,time:t,endDate,endTime}));}else{const dur=computeDur(newM.date,t,newM.endDate,newM.endTime);setNewM(p=>({...p,time:t,...(dur!==null?{duration:dur}:{})}));}}} style={{ ...S.inputSm, colorScheme:"dark", width:108, flexShrink:0, padding:"9px 8px", fontSize:14, minHeight:40, textAlign:"center" }} />
          </div>
        </div>
        {/* Toggle duración / hora fin */}
        <div style={{ display:"flex", gap:4, marginBottom:8 }}>
          {[{id:"duration",label:"⏱ Duración"},{id:"endtime",label:"🏁 Hora fin"}].map(m=>(
            <button key={m.id} onClick={()=>setEndMode(m.id)}
              style={{ flex:1, background:endMode===m.id?"rgba(96,165,250,0.18)":"rgba(128,128,128,0.05)", border:`1px solid ${endMode===m.id?"rgba(96,165,250,0.45)":"rgba(255,255,255,0.08)"}`, borderRadius:7, color:endMode===m.id?"#60a5fa":"#4a4166", padding:"4px 8px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:endMode===m.id?600:400 }}>
              {m.label}
            </button>
          ))}
        </div>
        {endMode==="duration"
          ?<div style={{ marginBottom:10 }}>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input type="number" min="0" step="15" value={newM.duration||""} onChange={e=>{const dur=parseInt(e.target.value)||0;const {endDate,endTime}=computeEnd(newM.date,newM.time,dur);setNewM(p=>({...p,duration:dur,endDate,endTime}));}} placeholder="90" style={{ ...S.inputSm, flex:1 }} />
              <span style={{ fontSize:12, color:"var(--t-text-dim,#6b5f88)", flexShrink:0 }}>min {newM.duration>0&&<span style={{color:"#60a5fa"}}>({durLabel(newM.duration)})</span>}</span>
            </div>
            {calcEndDate&&<div style={{ fontSize:11, color:"#60a5fa", marginTop:4 }}>🏁 Termina: {calcEndDate!==newM.date?calcEndDate+" ":""}{calcEndTime}</div>}
          </div>
          :<div style={{ background:"rgba(167,139,250,0.06)", border:"1px solid rgba(167,139,250,0.15)", borderRadius:10, padding:"10px 12px", marginBottom:10 }}>
            <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>🏁 Fin</div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input type="date" value={newM.endDate||""} onChange={e=>{const ed=e.target.value;const safeEt=newM.endTime||(ed?"23:59":"");const safeT=newM.time||(ed?"00:00":"");const dur=computeDur(newM.date,safeT,ed,safeEt);setNewM(p=>({...p,endDate:ed,endTime:safeEt,time:safeT,...(dur!==null?{duration:dur}:{})}))} } style={{ ...S.inputSm, colorScheme:"dark", flex:1, padding:"9px 10px", fontSize:14, minHeight:40 }} />
              <input type="time" value={newM.endTime||""} onChange={e=>{const et=e.target.value;const safeEd=newM.endDate||(et?newM.date:"");const safeT=newM.time||(et?"00:00":"");const dur=computeDur(newM.date,safeT,safeEd,et);setNewM(p=>({...p,endTime:et,endDate:safeEd,time:safeT,...(dur!==null?{duration:dur}:{})}))} } style={{ ...S.inputSm, colorScheme:"dark", width:108, flexShrink:0, padding:"9px 8px", fontSize:14, minHeight:40, textAlign:"center" }} />
            </div>
            {calcDurMin!==null&&<div style={{ fontSize:11, color:"#60a5fa", marginTop:6 }}>⏱ Duración: {durLabel(calcDurMin)}</div>}
          </div>
        }
        {newM.time&&<div style={{ marginBottom:8 }}>
          <label style={S.label}>🔔 Recordatorio</label>
          <select value={newM.reminder||"none"} onChange={e=>setNewM(p=>({...p,reminder:e.target.value}))} style={{ ...S.inputSm, colorScheme:"dark", fontSize:12 }}>
            <option value="none">Sin recordatorio</option>
            <option value="ontime">En el momento</option>
            <option value="15min">15 min antes</option>
            <option value="30min">30 min antes</option>
            <option value="1h">1 hora antes</option>
            <option value="1day">1 día antes</option>
          </select>
        </div>}
      </>}
      {activeGoals.length>0&&<div style={{ marginBottom:10 }}>
        <label style={S.label}>🏅 ¿Cuenta para alguna meta?</label>
        <select value={newM.goalId||""} onChange={e=>setNewM(p=>({...p,goalId:e.target.value||null}))} style={{ ...S.input, fontSize:13, colorScheme:"dark", background:"var(--t-card,rgba(16,10,32,0.95))", color:"var(--t-text,#f8f4ff)" }}>
          <option value="">— Sin meta —</option>
          {activeGoals.map(g=><option key={g.id} value={g.id}>{g.emoji} {g.title}</option>)}
        </select>
      </div>}
      {!isEvent&&<div style={{ marginBottom:10 }}>
        <label style={S.label}>🔁 Tarea recurrente</label>
        <div style={{ display:"flex", gap:4 }}>
          {[{id:"",label:"Una vez"},{id:"weekly",label:"Semanal"},{id:"biweekly",label:"Bisemanal"},{id:"monthly",label:"Mensual"}].map(o=>(
            <button key={o.id} onClick={()=>setNewM(p=>({...p,seriesPattern:o.id,seriesEndDate:"",seriesId:o.id?p.seriesId||uid():undefined}))}
              style={{ flex:1, background:newM.seriesPattern===o.id?"rgba(167,139,250,0.2)":"rgba(128,128,128,0.06)", border:`1px solid ${newM.seriesPattern===o.id?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:7, color:newM.seriesPattern===o.id?"#c4b8ff":"#6b5f88", padding:"5px 6px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:newM.seriesPattern===o.id?600:400 }}>{o.label}</button>
          ))}
        </div>
        {newM.seriesPattern && <div style={{ marginTop:8 }}>
          <label style={S.label}>📅 Repetir hasta (opcional)</label>
          <input type="date" value={newM.seriesEndDate||""} onChange={e=>setNewM(p=>({...p,seriesEndDate:e.target.value}))} style={{...S.inputSm,colorScheme:"dark"}} />
        </div>}
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
  const [popping, setPopping] = useState(false);
  const isDone = mission.status==="DONE", isCarried = !!mission.carriedFrom;
  const mCats = getMCats(mission).map(id=>CAT_MAP[id]).filter(Boolean);
  const clr = colors || DEFAULT_COLORS;
  const whoColor = mission.who==="person1"?clr.person1:mission.who==="person2"?clr.person2:clr.together;
  const WHO = [{ id:"together",label:"Juntos",icon:"👫"},{id:"person1",label:p1,icon:"🙋"},{id:"person2",label:p2,icon:"🙋"}];
  const gcalUrl = googleCalendarUrl(mission, p1, p2);
  const isEvent = mission.type==="event";
  const firstCat = mCats[0];
  const cardBorder = isDone?"rgba(52,211,153,0.15)":isCarried?"rgba(251,146,60,0.2)":isEvent?"rgba(96,165,250,0.3)":firstCat?`${firstCat.color}30`:`${whoColor}22`;
  // v3: color rail + pop
  const railStyle = { borderLeft:`3px solid ${whoColor}`, paddingLeft:13 };
  const handleCycle = () => { setPopping(true); setTimeout(()=>setPopping(false),240); onCycleStatus(); };
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
    <div style={{ ...S.card, ...railStyle, borderColor:cardBorder, opacity:isDone?0.78:1, transition:"all 0.25s" }}>
      {isCarried&&!isDone&&(
        <div style={{ fontSize:10, color:carriedWeeks>=3?"#f87171":"#fb923c", letterSpacing:1, marginBottom:6, display:"flex", alignItems:"center", gap:4 }}>
          {carriedWeeks>=3?"⚠️":"🔁"} {carriedWeeks>=3?`Arrastrada ${carriedWeeks} semanas`:"Arrastrada"}
        </div>
      )}
      {mission.completedLate&&isDone&&(
        <div style={{ fontSize:10, color:"#fb923c", letterSpacing:0.5, marginBottom:6, display:"flex", alignItems:"center", gap:4 }}>
          ⏰ Completada con retraso
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
            {mission.duration&&<span style={{ background:"rgba(96,165,250,0.08)", color:"#60a5fa", border:"1px solid rgba(96,165,250,0.2)", padding:"2px 7px", borderRadius:99, fontSize:11 }}>⏱ {(()=>{const m=mission.duration;return m>=60?`${Math.floor(m/60)}h${m%60?` ${m%60}m`:""}`:m+"min";})()}</span>}
            {mission.endDate&&<span style={{ background:"rgba(96,165,250,0.08)", color:"#60a5fa", border:"1px solid rgba(96,165,250,0.2)", padding:"2px 7px", borderRadius:99, fontSize:11 }}>🏁 {mission.endDate}{mission.endTime?` ${mission.endTime}`:""}</span>}
            {mission.date&&<span style={{ background:"rgba(128,128,128,0.08)", color:"var(--t-text-dim,#6b5f88)", border:"1px solid rgba(255,255,255,0.08)", padding:"2px 7px", borderRadius:99, fontSize:11 }}>📆 {mission.date}{mission.time?` · 🕐 ${mission.time}`:""}</span>}
            {isEvent&&<span style={{ background:"rgba(96,165,250,0.12)", color:"#60a5fa", border:"1px solid rgba(96,165,250,0.25)", padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600 }}>📅 Evento</span>}
            {mission.seriesPattern&&<span style={{ background:"rgba(52,211,153,0.1)", color:"#34d399", border:"1px solid rgba(52,211,153,0.25)", padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600 }}>🔁 {mission.seriesPattern==="weekly"?"Semanal":mission.seriesPattern==="biweekly"?"Bisemanal":"Mensual"}</span>}
            {mission.goalId&&(()=>{const g=(goals||[]).find(x=>x.id===mission.goalId);return g?<span style={{ background:"rgba(167,139,250,0.12)", color:"var(--t-accent,#a78bfa)", border:"1px solid rgba(167,139,250,0.25)", padding:"2px 7px", borderRadius:99, fontSize:11 }}>{g.emoji} {g.title}</span>:null;})()}
          </div>
        </div>
        <button onClick={handleCycle} style={{ ...badgeStyle(mission.status), animation:popping?"mc-pop 0.22s ease-out":"none" }}>{STATUS[mission.status].icon}</button>
        <button onClick={onDelete} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--t-text-dim,#3d3360)", fontSize:18, padding:"0 2px", lineHeight:1, flexShrink:0 }}
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
                return <button key={t.id} onClick={()=>onPatch({type:t.id})} style={{ flex:1, background:sel?(t.id==="event"?"rgba(96,165,250,0.15)":"rgba(167,139,250,0.15)"):"rgba(128,128,128,0.05)", border:`1px solid ${sel?ac:"rgba(255,255,255,0.08)"}`, borderRadius:7, color:sel?tc:"#4a4166", padding:"4px 8px", cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:sel?600:400 }}>{t.label}</button>;
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
                return <button key={w.id} onClick={()=>onPatch({who:w.id})} style={{ background:sel?`${wc}22`:"rgba(128,128,128,0.06)", border:`1px solid ${sel?wc+"60":"rgba(255,255,255,0.08)"}`, borderRadius:8, color:sel?wc:"#6b5f88", padding:"5px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>{w.icon} {w.label}</button>;
              })}
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <div><label style={S.label}>📆 Fecha inicio</label><input type="date" value={mission.date||""} onChange={e=>onPatch({date:e.target.value||null})} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
            <div><label style={S.label}>🕐 Hora inicio</label><input type="time" value={mission.time||""} onChange={e=>onPatch({time:e.target.value||null})} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
          </div>
          {isEvent&&<div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <div><label style={S.label}>🏁 Fecha fin</label><input type="date" value={mission.endDate||""} onChange={e=>{const ed=e.target.value||null;const dur=mission.date&&mission.time&&ed&&mission.endTime?Math.round((new Date(ed+"T"+mission.endTime)-new Date(mission.date+"T"+mission.time))/60000):mission.duration;onPatch({endDate:ed,...(dur>0?{duration:dur}:{})});}} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
            <div><label style={S.label}>🕐 Hora fin</label><input type="time" value={mission.endTime||""} onChange={e=>{const et=e.target.value||null;const dur=mission.date&&mission.time&&mission.endDate&&et?Math.round((new Date(mission.endDate+"T"+et)-new Date(mission.date+"T"+mission.time))/60000):mission.duration;onPatch({endTime:et,...(dur>0?{duration:dur}:{})});}} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
          </div>}
          {!isEvent&&<div style={{ marginBottom:8 }}><label style={S.label}>⏱ Duración (min)</label><input type="number" min="0" step="15" value={mission.duration||""} onChange={e=>onPatch({duration:parseInt(e.target.value)||null})} placeholder="90" style={S.inputSm} /></div>}
          {(()=>{const gmw=(g,w)=>w==="together"||g.who==="together"||!g.who||g.who===w;const filtered=(goals||[]).filter(g=>g.active!==false&&gmw(g,mission.who));return filtered.length>0&&<div style={{ marginBottom:8 }}>
            <label style={S.label}>🏅 ¿Cuenta para alguna meta?</label>
            <select value={mission.goalId||""} onChange={e=>onPatch({goalId:e.target.value||null})} style={{ ...S.input, fontSize:13, colorScheme:"dark", background:"var(--t-card,rgba(16,10,32,0.95))", color:"var(--t-text,#f8f4ff)" }}>
              <option value="">— Sin meta —</option>
              {filtered.map(g=><option key={g.id} value={g.id}>{g.emoji} {g.title}</option>)}
            </select>
          </div>;})()}
          {gcalUrl&&<a href={gcalUrl} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, color:"#34d399", background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:7, padding:"5px 10px", textDecoration:"none", marginTop:4 }}>📅 Añadir a Google Calendar</a>}
        </div>
      )}
    </div>
  );
}

function ProfileModal({ data, update, onClose, onStartTutorial, sessionUserId, onCheckUpdate, onThemeChange }) {
  const settings = data.settings || {};
  const [p1,      setP1]      = useState(settings.person1||"Persona 1");
  const [p2,      setP2]      = useState(settings.person2||"Persona 2");
  const [colors,  setColors]  = useState({ ...DEFAULT_COLORS, ...(settings.colors||{}) });
  const _pm_uprefs = getUserPrefs(sessionUserId);
  const [themeId,      setThemeId]      = useState(_pm_uprefs.themeId || settings.themeId || "violet");
  const [themeOpen,    setThemeOpen]    = useState(false);
  const [fontId,       setFontId]       = useState(_pm_uprefs.fontId  || settings.fontId  || "auto");
  const [fontOpen,     setFontOpen]     = useState(false);
  const [coupleEmoji,  setCoupleEmoji]  = useState(settings.coupleEmoji||"💞");
  const [photos,       setPhotos]       = useState({ person1: settings.photos?.person1||null, person2: settings.photos?.person2||null, couple: settings.photos?.couple||null });
  const defNotif = settings.notifications || {};
  const [notifChat,        setNotifChat]        = useState(defNotif.chat !== false);
  const [notifPartner,     setNotifPartner]     = useState(defNotif.partnerChanges !== false);
  const [notifEvents,      setNotifEvents]      = useState(defNotif.eventReminders !== false);
  const [notifGoals,       setNotifGoals]       = useState(defNotif.goalDeadlines !== false);
  const [notifBriefing,    setNotifBriefing]    = useState(defNotif.dailyBriefing === true);
  const [notifBriefTime,   setNotifBriefTime]   = useState(defNotif.briefingTime || "08:00");
  const [notifPermission,  setNotifPermission]  = useState(typeof Notification !== "undefined" ? Notification.permission : "denied");
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

  const requestNotifPermission = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  };

  const save = () => {
    const notifications = { chat: notifChat, partnerChanges: notifPartner, eventReminders: notifEvents, goalDeadlines: notifGoals, dailyBriefing: notifBriefing, briefingTime: notifBriefTime };
    if (sessionUserId) saveUserPrefs(sessionUserId, { themeId, fontId });
    update(d=>({...d, settings:{...d.settings, person1:p1.trim()||"Persona 1", person2:p2.trim()||"Persona 2", colors, coupleEmoji, photos, notifications}}));
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
          <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--t-text-dim,#6b5f88)", fontSize:22, cursor:"pointer", lineHeight:1 }}>×</button>
        </div>
        {/* Scrollable body */}
        <div style={{ overflowY:"auto", padding:"16px 20px 20px", flex:1 }}>

          {/* Foto de pareja */}
          <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", letterSpacing:2, textTransform:"uppercase", fontWeight:600, marginBottom:12, marginTop:4 }}>Foto de pareja</div>
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
              <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:8, lineHeight:1.5 }}>Aparece en la pantalla de inicio y en el menú lateral</div>
              <div style={{ display:"flex", gap:8 }}>
                <label style={{ ...S.btnSecondary, fontSize:11, cursor:"pointer", padding:"5px 12px", display:"inline-block" }}>
                  📷 Cambiar
                  <input type="file" accept="image/*" onChange={e=>handlePhoto("couple",e)} style={{ display:"none" }} />
                </label>
                {photos.couple && <button onClick={()=>setPhotos(p=>({...p,couple:null}))} style={{ ...S.btnSecondary, fontSize:11, padding:"5px 12px" }}>✕ Quitar</button>}
              </div>
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:11, color:"var(--t-text-muted,#8b7fa8)", marginBottom:6 }}>Emoji cuando no hay foto</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {COUPLE_EMOJIS.map(e=>(
                    <button key={e} onClick={()=>setCoupleEmoji(e)}
                      style={{ fontSize:19, background:coupleEmoji===e?"rgba(167,139,250,0.22)":"rgba(128,128,128,0.06)", border:`1px solid ${coupleEmoji===e?"rgba(167,139,250,0.55)":"rgba(255,255,255,0.08)"}`, borderRadius:8, padding:"4px 5px", cursor:"pointer", lineHeight:1, outline:"none" }}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Personas */}
          <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", letterSpacing:2, textTransform:"uppercase", fontWeight:600, marginBottom:14 }}>Personas</div>
          {personRow("person1","Persona 1",p1,setP1)}
          {personRow("person2","Persona 2",p2,setP2)}
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
            <div style={{ width:56, height:56, borderRadius:99, background:colors.together+"22", border:`2px solid ${colors.together}44`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ fontSize:22 }}>{coupleEmoji}</span>
            </div>
            <div style={{ flex:1 }}>
              <label style={S.label}>Juntos</label>
              <div style={{ fontSize:12, color:"var(--t-text-dim,#6b5f88)", fontStyle:"italic" }}>Color para actividades en pareja</div>
            </div>
            <input type="color" value={colors.together} onChange={e=>setColor("together",e.target.value)}
              style={{ width:36, height:36, border:"none", borderRadius:8, cursor:"pointer", background:"none", padding:2, flexShrink:0 }} />
          </div>
          <button onClick={()=>setColors(DEFAULT_COLORS)} style={{ ...S.btnSecondary, fontSize:11, marginBottom:24 }}>↺ Restablecer colores</button>

          {/* Notificaciones */}
          <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", letterSpacing:2, textTransform:"uppercase", fontWeight:600, marginBottom:12, marginTop:8 }}>Notificaciones</div>
          <div style={{ background:"var(--t-accent-soft,rgba(167,139,250,0.06))", border:"1px solid var(--t-card-border,rgba(167,139,250,0.15))", borderRadius:14, padding:"14px 16px", marginBottom:24 }}>
            {notifPermission !== "granted" ? (
              <div style={{ textAlign:"center", padding:"8px 0 12px" }}>
                <div style={{ fontSize:28, marginBottom:8 }}>🔔</div>
                <div style={{ fontSize:13, color:"#c4b8ff", marginBottom:6, fontWeight:500 }}>Activa las notificaciones</div>
                <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:14, lineHeight:1.6 }}>
                  {notifPermission === "denied"
                    ? "Tu navegador ha bloqueado las notificaciones. Cámbialas desde la configuración del navegador."
                    : "Recibe alertas de mensajes, cambios de tu pareja y recordatorios de eventos."}
                </div>
                {notifPermission !== "denied" && (
                  <button onClick={requestNotifPermission} style={{ ...S.btnPrimary, fontSize:12, padding:"8px 20px" }}>🔔 Permitir notificaciones</button>
                )}
              </div>
            ) : (
              <>
                {[
                  [notifChat,    setNotifChat,    "💬", "Mensajes del chat"],
                  [notifPartner, setNotifPartner, "🔄", "Cambios de tu pareja"],
                  [notifEvents,  setNotifEvents,  "📅", "Recordatorios de eventos"],
                  [notifGoals,   setNotifGoals,   "🎯", "Vencimiento de metas"],
                ].map(([val, set, icon, label]) => (
                  <div key={label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingBottom:12, marginBottom:12, borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize:13, color:"#c4b8ff" }}>{icon} {label}</div>
                    <button onClick={()=>set(v=>!v)}
                      style={{ width:40, height:22, borderRadius:99, background:val?"var(--t-accent,#a78bfa)":"rgba(255,255,255,0.1)", border:"none", cursor:"pointer", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                      <span style={{ position:"absolute", top:3, left:val?20:3, width:16, height:16, borderRadius:99, background:"#fff", transition:"left 0.2s", display:"block" }} />
                    </button>
                  </div>
                ))}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:notifBriefing?10:0 }}>
                  <div style={{ fontSize:13, color:"#c4b8ff" }}>🌅 Resumen diario</div>
                  <button onClick={()=>setNotifBriefing(v=>!v)}
                    style={{ width:40, height:22, borderRadius:99, background:notifBriefing?"var(--t-accent,#a78bfa)":"rgba(255,255,255,0.1)", border:"none", cursor:"pointer", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                    <span style={{ position:"absolute", top:3, left:notifBriefing?20:3, width:16, height:16, borderRadius:99, background:"#fff", transition:"left 0.2s", display:"block" }} />
                  </button>
                </div>
                {notifBriefing && (
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:8, paddingTop:8, borderTop:"1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)" }}>Hora del resumen</span>
                    <input type="time" value={notifBriefTime} onChange={e=>setNotifBriefTime(e.target.value)}
                      style={{ ...S.inputSm, colorScheme:"dark", flex:1, maxWidth:110 }} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Tema */}
          <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", letterSpacing:2, textTransform:"uppercase", fontWeight:600, marginBottom:10 }}>Tema de la app</div>
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
                  <button key={t.id} onClick={()=>{ setThemeId(t.id); setThemeOpen(false); onThemeChange&&onThemeChange(t.id, fontId); }}
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
          </div>{/* end theme dropdown wrapper */}

          {/* Fuente */}
          <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", letterSpacing:2, textTransform:"uppercase", fontWeight:600, marginBottom:10, marginTop:16 }}>Tipografía</div>
          <div style={{ marginBottom:8 }}>
            <button onClick={()=>setFontOpen(v=>!v)}
              style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"rgba(128,128,128,0.08)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.2))", borderRadius:fontOpen?"10px 10px 0 0":10, cursor:"pointer", fontFamily:"inherit", borderBottom:fontOpen?"none":"1px solid var(--t-card-border,rgba(167,139,250,0.2))" }}>
              <span style={{ fontSize:15 }}>Aa</span>
              <span style={{ flex:1, textAlign:"left", fontSize:13, color:"var(--t-text,#f8f4ff)", fontWeight:500 }}>
                {(FONTS.find(f=>f.id===fontId)||FONTS[0]).name}
              </span>
              <span style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)" }}>{fontOpen?"▲":"▼"}</span>
            </button>
            {fontOpen && (
              <div style={{ border:"1px solid var(--t-card-border,rgba(167,139,250,0.18))", borderTop:"none", borderRadius:"0 0 10px 10px", overflow:"hidden" }}>
                {FONTS.map(f=>(
                  <button key={f.id} onClick={()=>{ setFontId(f.id); setFontOpen(false); onThemeChange&&onThemeChange(themeId, f.id); }}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:fontId===f.id?"var(--t-accent-soft,rgba(167,139,250,0.12))":"rgba(128,128,128,0.04)", border:"none", borderBottom:"1px solid rgba(128,128,128,0.08)", cursor:"pointer", width:"100%", fontFamily:f.family||"inherit" }}>
                    <span style={{ flex:1, fontSize:13, color:fontId===f.id?"var(--t-accent,#a78bfa)":"var(--t-text-muted,#8b7fa8)", textAlign:"left", fontWeight:fontId===f.id?600:400 }}>{f.name}</span>
                    {fontId===f.id && <span style={{ fontSize:12, color:"var(--t-accent,#a78bfa)" }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>{/* end font dropdown wrapper */}
        </div>{/* end scrollable body */}
        {/* Footer */}
        <div style={{ padding:"14px 20px", borderTop:"1px solid var(--t-card-border,rgba(167,139,250,0.1))", display:"flex", flexDirection:"column", gap:8 }}>
          {onStartTutorial && <button onClick={onStartTutorial} style={{ ...S.btnSecondary, fontSize:12, textAlign:"center", padding:"8px 14px", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>🎓 Ver tutorial de nuevo</button>}
          <button onClick={()=>{ onClose(); onCheckUpdate && onCheckUpdate(); }} style={{ ...S.btnSecondary, fontSize:12, textAlign:"center", padding:"8px 14px", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>🔄 Actualizar app (última versión)</button>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button onClick={onClose} style={S.btnSecondary}>Cancelar</button>
            <button onClick={save} style={S.btnPrimary}>Guardar ✓</button>
          </div>
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
        <span style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600 }}>🏷️ Por categoría</span>
        <div style={{ display:"flex", gap:3 }}>
          {[["act","Actividades"],["h","Horas"]].map(([v,l])=>(
            <button key={v} onClick={()=>setTab(v)} style={{ background:tab===v?"rgba(167,139,250,0.2)":"rgba(128,128,128,0.06)", border:`1px solid ${tab===v?"rgba(167,139,250,0.4)":"rgba(255,255,255,0.08)"}`, borderRadius:7, color:tab===v?"#c4b8ff":"#6b5f88", padding:"3px 10px", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
      </div>
      {tab==="act"?catStats.map(c=>{ const cpct=c.count>0?Math.round((c.done/c.count)*100):0; return (
        <div key={c.id} style={{ marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span style={{ fontSize:12, color:c.color, fontWeight:600 }}>{c.icon} {c.label}</span>
            <span style={{ fontSize:12, color:cpct===100?"#34d399":"#6b5f88", fontWeight:600 }}>{c.done}/{c.count} ({cpct}%)</span>
          </div>
          <div style={{ background:"rgba(128,128,128,0.10)", borderRadius:99, height:6, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${(c.count/maxC)*100}%`, background:c.color, borderRadius:99, opacity:0.8 }} />
          </div>
        </div>
      );}):(<>
        {lifeStats.filter(c=>c.dur>0).length>0&&<>
          <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", letterSpacing:1.5, marginBottom:8 }}>VIDA</div>
          {lifeStats.filter(c=>c.dur>0).map(c=>(
            <div key={c.id} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:12, color:c.color, fontWeight:600 }}>{c.icon} {c.label}</span>
                <span style={{ fontSize:12, color:"#60a5fa" }}>{Math.round(c.dur/60*10)/10}h</span>
              </div>
              <div style={{ background:"rgba(128,128,128,0.10)", borderRadius:99, height:6, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${(c.dur/maxLifeH)*100}%`, background:c.color, borderRadius:99, opacity:0.8 }} />
              </div>
            </div>
          ))}
        </>}
        {workStat&&workStat.dur>0&&<>
          <div style={{ borderTop:"1px dashed rgba(251,191,36,0.2)", marginTop:10, paddingTop:10, marginBottom:8 }}>
            <div style={{ fontSize:10, color:"#fbbf2488", letterSpacing:1.5 }}>TRABAJO <span style={{ color:"var(--t-text-dim,#4a4166)", fontWeight:400 }}>(escala propia)</span></div>
          </div>
          <div style={{ marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:12, color:"#fbbf24", fontWeight:600 }}>💼 Trabajo</span>
              <span style={{ fontSize:12, color:"#fbbf24", fontWeight:700 }}>{Math.round(workStat.dur/60*10)/10}h</span>
            </div>
            <div style={{ background:"rgba(251,191,36,0.08)", borderRadius:99, height:8, overflow:"hidden", border:"1px solid rgba(251,191,36,0.15)" }}>
              <div style={{ height:"100%", width:"100%", background:"linear-gradient(90deg,#fbbf24,#f59e0b)", borderRadius:99, opacity:0.8 }} />
            </div>
          </div>
        </>}
        {!catStats.some(c=>c.dur>0)&&<div style={{ textAlign:"center", color:"var(--t-text-dim,#4a4166)", fontSize:12, padding:"20px 0" }}>Sin horas registradas aún.</div>}
      </>)}
    </div>
  );
}

function StatsView({ weeks, p1, p2, colors, onGoToWeek }) {
  const clr = { ...DEFAULT_COLORS, ...(colors||{}) };
  const [stWho,        setStWho]        = useState("all");
  const [stRange,      setStRange]      = useState("all");
  const [showPartInfo, setShowPartInfo] = useState(false);
  const [exportModal,  setExportModal]  = useState(false);
  const [exportSecs,   setExportSecs]   = useState({ progress:true, personas:true, categorias:true, insights:false });

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
  const totalDuration = allM.reduce((s,m)=>s+(m.duration||0),0);
  const catStats = CATEGORIES.map(c => {
    const ms=allM.filter(m=>getMCats(m).includes(c.id));
    return { ...c, dur:ms.reduce((s,m)=>s+(m.duration||0),0), count:ms.length, done:ms.filter(m=>m.status==="DONE").length };
  }).filter(c=>c.count>0).sort((a,b)=>b.count-a.count);
  // ph usa misiones sin filtrar por persona para que "participación" muestre siempre la distribución real
  const rawAllM = rangedEntries.flatMap(([,w]) => w.missions||[]);
  const ph = key => { const ms=rawAllM.filter(m=>m.who===key); return { count:ms.length, done:ms.filter(m=>m.status==="DONE").length }; };
  const ph1=ph("person1"), ph2=ph("person2"), phT=ph("together");
  const totalWork1=allW.reduce((s,w)=>s+(w.workHours?.person1||0),0), totalWork2=allW.reduce((s,w)=>s+(w.workHours?.person2||0),0);
  const series=allW.map(w=>{ const d=w.missions?.filter(m=>m.status==="DONE"&&!m.completedLate).length||0,t=w.missions?.length||0; return { label:`S${w.weekNumber}`, pct:t>0?Math.round((d/t)*100):0, durH:(w.missions||[]).reduce((s,m)=>s+(m.duration||0),0), total:t, done:d, weekNumber:w.weekNumber, year:w._yr }; });
  const maxH=Math.max(...series.map(s=>s.durH),1);

  // ── Etapa 2: computed display vars ──────────────────────────────────────────
  const pctColor = pct>=80?"#34d399":pct>=50?"#fbbf24":"#f472b6";
  const barPersonColor = stWho==="person1"?clr.person1:stWho==="person2"?clr.person2:stWho==="together"?clr.together:null;
  const filterLabel = (stRange!=="all"?`Últ. ${stRange} sem.`:"Historial completo") + (stWho!=="all"?" · "+(stWho==="person1"?p1:stWho==="person2"?p2:"Juntos"):"");

  // ── AI Insights — always based on completed weeks only (exclude current week) ──
  const analysisSeries = series.filter(s => isoWeekKey(s.weekNumber, s.year) < todayKey);
  const insights = [];
  // 1. Trend: compare last 3 completed weeks vs prev 3
  if (analysisSeries.length>=3) {
    const last3=analysisSeries.slice(-3),prev3=analysisSeries.slice(-6,-3);
    const avgL=last3.reduce((s,w)=>s+w.pct,0)/last3.length;
    const avgP=prev3.length>0?prev3.reduce((s,w)=>s+w.pct,0)/prev3.length:avgL;
    const lastW=last3[last3.length-1];
    const wRange=`S${last3[0].weekNumber}–S${lastW.weekNumber}`;
    if (avgL>avgP+12) insights.push({icon:"🚀",title:`Tendencia al alza (${wRange}): +${Math.round(avgL-avgP)} puntos`,desc:`Habéis subido de ${Math.round(avgP)}% (3 sem. anteriores) a ${Math.round(avgL)}% (últimas 3 sem.). Ritmo excelente, mantened el plan.`,weekNumber:lastW?.weekNumber,year:lastW?.year});
    else if (avgL<avgP-12) insights.push({icon:"📉",title:`Bajada de ritmo (${wRange}): −${Math.round(avgP-avgL)} puntos`,desc:`Bajasteis de ${Math.round(avgP)}% a ${Math.round(avgL)}%. Revisad si las misiones son demasiado ambiciosas o si algo externo os está afectando.`,weekNumber:lastW?.weekNumber,year:lastW?.year});
    else insights.push({icon:"➡️",title:`Ritmo estable al ${Math.round(avgL)}% (${wRange})`,desc:`Lleváis 3 semanas con una variación menor de 12 puntos. La consistencia es más valiosa que los picos. Seguid igual.`});
  }
  // 2. Best and worst week — mínimo 5 misiones para ser representativa
  const weekScores=allW.filter(w=>isoWeekKey(w.weekNumber,w._yr)<todayKey).map(w=>{const d=w.missions?.filter(m=>m.status==="DONE"&&!m.completedLate).length||0,t=w.missions?.length||0;return{p:t>0?d/t:null,wn:w.weekNumber,yr:w._yr,obj:w.epicObjective,t,d};}).filter(w=>w.p!==null&&w.t>=5);
  if (weekScores.length>=2){
    const bW=weekScores.reduce((a,b)=>b.p>a.p?b:a);
    const wW=weekScores.reduce((a,b)=>b.p<a.p?b:a);
    if (Math.round(bW.p*100)>=60) insights.push({icon:"🏆",title:`Semana récord: S${bW.wn} con ${Math.round(bW.p*100)}%${bW.obj?` — "${bW.obj}"`:""}`,desc:`${bW.d} de ${bW.t} misiones completadas. ¿Qué hicisteis diferente esa semana? Intentad replicarlo.`,weekNumber:bW.wn,year:bW.yr});
    if (wW.wn!==bW.wn&&Math.round(wW.p*100)<40) insights.push({icon:"💡",title:`Semana más difícil: S${wW.wn} (${Math.round(wW.p*100)}%, ${wW.d}/${wW.t})`,desc:`Fue la semana con menor completitud del periodo. Analizar qué la hizo difícil puede ayudar a prevenir caídas similares.`,weekNumber:wW.wn,year:wW.yr});
  }
  // 3. Category star + weak spot
  if (catStats.length>1){
    const sorted=[...catStats].sort((a,b)=>b.done/Math.max(b.count,1)-a.done/Math.max(a.count,1));
    const best=sorted[0],weak=sorted[sorted.length-1];
    if (best.count>1) insights.push({icon:best.icon,title:`${best.label}: categoría estrella (${Math.round((best.done/best.count)*100)}% en ${best.count} misiones)`,desc:`${best.done} de ${best.count} completadas. Es donde sois más eficaces como equipo. Considerad ampliar misiones en esta área.`});
    if (weak.count>1&&Math.round((weak.done/weak.count)*100)<50) insights.push({icon:"⚠️",title:`${weak.label}: categoría pendiente (${Math.round((weak.done/weak.count)*100)}% en ${weak.count} misiones)`,desc:`Solo ${weak.done} de ${weak.count} completadas. Puede indicar que las misiones son poco concretas o que necesitan más tiempo del planificado.`});
  }
  // 4. Balance P1 vs P2 — mínimo 6 misiones individuales para ser significativo
  const p1c=ph("person1").count,p2c=ph("person2").count;
  if (p1c+p2c>=6){
    const diff=Math.abs(p1c-p2c);
    const diffPct=Math.round((diff/(p1c+p2c))*100);
    if (diffPct>=25) insights.push({icon:"⚖️",title:`${p1c>p2c?p1:p2} concentra el ${Math.round(p1c>p2c?p1c/(p1c+p2c)*100:p2c/(p1c+p2c)*100)}% de las misiones individuales`,desc:`${p1}: ${p1c} misiones · ${p2}: ${p2c} misiones. Una diferencia del ${diffPct}% puede indicar desequilibrio. Valorad redistribuir.`});
    else insights.push({icon:"🤝",title:`Reparto equilibrado: ${p1} ${p1c} − ${p2} ${p2c} (diferencia ${diffPct}%)`,desc:`Menos del 25% de diferencia en misiones individuales. El trabajo se distribuye de forma saludable entre los dos.`});
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
  if (currStreakNow>=2) insights.push({icon:"🔥",title:`Racha activa: ${currStreakNow} semana${currStreakNow>1?"s":""} al 100%`,desc:`Lleváis ${currStreakNow} semanas completando todas las misiones. Cada semana que mantenéis la racha refuerza el hábito. ¡A por la siguiente!`});
  // 7. Completion velocity (missions per week)
  if (wc>=4){const avgMpW=(total/wc).toFixed(1);const advice=avgMpW<3?"Poco volumen — podéis añadir más misiones para aprovechar el ritmo":avgMpW>8?"Ritmo intenso — revisad si todas las misiones son realmente necesarias o si podéis simplificar":"Volumen saludable y sostenible";insights.push({icon:"📊",title:`Media de ${avgMpW} misiones/semana en ${wc} semanas`,desc:`${total} misiones planificadas en total. ${advice}.`});}

  // Fallback: si no hay suficientes datos para los insights detallados, usar generateInsights
  const wrappedInsights = insights.length > 0
    ? insights
    : (isEnabled("stats_insights_enabled") ? generateInsights(weeks, p1, p2) : []);

  if(total===0) return <div style={{ textAlign:"center", color:"var(--t-text-dim,#3d3360)", padding:50 }}><div style={{ fontSize:40, marginBottom:12 }}>📊</div><div style={{ fontStyle:"italic" }}>Sin datos aún.</div></div>;

  // Donut chart for status
  const donutTotal = bySt.reduce((s,x)=>s+x.count,0);
  let donutOffset=0;
  const donutSegments = bySt.filter(x=>x.count>0).map(({s,count})=>{ const pct2=(count/donutTotal)*100; const seg={s,pct:pct2,offset:donutOffset}; donutOffset+=pct2; return seg; });
  const C=15.9155, R=5; // SVG circumference helper

  const whoOpts = [
    { id:"all", label:"Todos", color:"var(--t-text-muted,#8b7fa8)" },
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
          <span style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", textTransform:"uppercase", letterSpacing:1.2, flexShrink:0, width:40 }}>Quién</span>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {whoOpts.map(o=>{
              const active = stWho===o.id;
              return <button key={o.id} onClick={()=>setStWho(o.id)}
                style={{ background:active?`${o.color}22`:"rgba(128,128,128,0.05)", border:`1px solid ${active?o.color:"rgba(255,255,255,0.08)"}`, borderRadius:99, color:active?o.color:"var(--t-text-dim,#4a4166)", padding:"3px 11px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:active?600:400, transition:"all 0.15s" }}>
                {o.label}
              </button>;
            })}
          </div>
        </div>
        {/* Range */}
        <div style={{ display:"flex", gap:5, alignItems:"center" }}>
          <span style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", textTransform:"uppercase", letterSpacing:1.2, flexShrink:0, width:40 }}>Rango</span>
          <div style={{ display:"flex", gap:4 }}>
            {rangeOpts.map(o=>{
              const active = stRange===o.id;
              return <button key={o.id} onClick={()=>setStRange(o.id)}
                style={{ background:active?"rgba(167,139,250,0.18)":"rgba(128,128,128,0.05)", border:`1px solid ${active?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:99, color:active?"#c4b8ff":"#4a4166", padding:"3px 11px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:active?600:400, transition:"all 0.15s" }}>
                {o.label}
              </button>;
            })}
          </div>
        </div>
      </div>

      {/* Insights — diseño Wrapped */}
      {wrappedInsights.length>0&&(()=>{
        const SC={
          positive:{bg:"rgba(52,211,153,0.07)",border:"rgba(52,211,153,0.22)",val:"#34d399"},
          negative:{bg:"rgba(244,114,182,0.07)",border:"rgba(244,114,182,0.22)",val:"#f472b6"},
          curious: {bg:"rgba(96,165,250,0.07)", border:"rgba(96,165,250,0.22)", val:"#60a5fa"},
          neutral: {bg:"rgba(167,139,250,0.07)",border:"rgba(167,139,250,0.22)",val:"#a78bfa"},
        };
        // insight.sentiment viene de insights.js; los inline no tienen — derivar del icono
        const sentimentOf=ins=>ins.sentiment||(ins.icon==="📉"||ins.icon==="⚠️"||ins.icon==="⚖️"?"negative":ins.icon==="🚀"||ins.icon==="🏆"||ins.icon==="🔥"||ins.icon==="🌈"||ins.icon==="🤝"?"positive":ins.icon==="💡"||ins.icon==="📊"?"curious":"neutral");
        return <div>
          <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:10, paddingLeft:2 }}>✨ Tu resumen</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {wrappedInsights.map((ins,i)=>{
              const s=sentimentOf(ins);
              const c=SC[s]||SC.neutral;
              // inline insights usan {icon,title,desc,weekNumber}; insights.js usa {value,label,detail,sentiment}
              const headline=ins.title||ins.label||"";
              const narrative=ins.desc||ins.detail||"";
              const heroValue=ins.value||ins.icon||"";
              const isValueCard=!!ins.value; // insights.js card (tiene value grande)
              return <div key={i} style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:14, padding:"14px 16px", opacity:0, animation:`fadeInUp 0.3s ease ${i*0.06}s forwards` }}>
                {isValueCard
                  ?<div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:6 }}>
                    <span style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:700, color:c.val, lineHeight:1 }}>{heroValue}</span>
                    <span style={{ fontSize:10, color:c.val, textTransform:"uppercase", letterSpacing:1.5, fontWeight:600 }}>{headline}</span>
                  </div>
                  :<div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:18, lineHeight:1, flexShrink:0 }}>{heroValue}</span>
                    <span style={{ fontSize:13, color:"var(--t-text,#e2d9ff)", fontWeight:600, flex:1 }}>{headline}</span>
                    {ins.weekNumber&&onGoToWeek&&<button onClick={()=>onGoToWeek(ins.weekNumber,ins.year||new Date().getFullYear())} style={{ background:"rgba(167,139,250,0.15)", border:"1px solid rgba(167,139,250,0.3)", borderRadius:99, color:"#a78bfa", fontSize:10, padding:"2px 9px", cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>→ S{ins.weekNumber}</button>}
                  </div>
                }
                <div style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)", lineHeight:1.55 }}>{narrative}</div>
              </div>;
            })}
          </div>
      </div>;
      })()}

      {/* ── Deep Stats v2.0 ────────────────────────────────────────────── */}
      {(()=>{
        const dsM=Object.values(weeks).flatMap(w=>w.missions||[]);
        if(dsM.length<5) return null;
        const dsW=Object.values(weeks).filter(w=>(w.missions||[]).length>0);

        // 1. Sync Score
        const totDur=dsM.reduce((s,m)=>s+(m.duration||0),0);
        const togDur=dsM.filter(m=>m.who==="together").reduce((s,m)=>s+(m.duration||0),0);
        const workDur=dsM.filter(m=>getMCats(m).includes("trabajo")).reduce((s,m)=>s+(m.duration||0),0);
        const Sc=totDur-workDur>0?Math.round((togDur/(totDur-workDur))*100):null;

        // 2. Equity Index (casa tasks)
        const casaM=dsM.filter(m=>getMCats(m).includes("casa"));
        const cP1=casaM.filter(m=>m.who==="person1").length,cP2=casaM.filter(m=>m.who==="person2").length;
        const Ie=cP1+cP2>=4?Math.round((1-Math.abs(cP1-cP2)/(cP1+cP2))*100):null;

        // 3. Goal Density
        const Gd=dsM.length>0?Math.round((dsM.filter(m=>m.goalId).length/dsM.length)*100):0;

        // 4. Anchor Habit
        const byS={};
        dsM.filter(m=>m.seriesPattern&&m.seriesId).forEach(m=>{
          if(!byS[m.seriesId])byS[m.seriesId]={title:m.title,emoji:m.emoji,total:0,done:0};
          byS[m.seriesId].total++;if(m.status==="DONE")byS[m.seriesId].done++;
        });
        const series=Object.values(byS).filter(s=>s.total>=3);
        const anchor=series.length?[...series].sort((a,b)=>b.done/b.total-a.done/a.total)[0]:null;

        // 5. Burnout proxy: optimal week load
        const wData=dsW.map(w=>{const ms=w.missions||[];return{n:ms.length,pct:ms.length?ms.filter(m=>m.status==="DONE").length/ms.length:0};});
        const highComp=wData.filter(w=>w.pct>=0.7).map(w=>w.n);
        const optLoad=highComp.length?Math.round(highComp.reduce((s,n)=>s+n,0)/highComp.length):null;

        // 6. Best completion time window
        const bk={morning:{l:"Mañana 6–12",d:0,t:0},afternoon:{l:"Tarde 12–17",d:0,t:0},evening:{l:"Tarde–noche 17–21",d:0,t:0},night:{l:"Noche 21+",d:0,t:0}};
        dsM.filter(m=>m.time).forEach(m=>{
          const h=parseInt(m.time)||0;
          const k=h>=6&&h<12?"morning":h>=12&&h<17?"afternoon":h>=17&&h<21?"evening":"night";
          bk[k].t++;if(m.status==="DONE")bk[k].d++;
        });
        const bestWin=Object.entries(bk).filter(([,b])=>b.t>=3).sort((a,b)=>b[1].d/b[1].t-a[1].d/a[1].t)[0]||null;

        const pct2col=(v,hi,lo,hiClr="#34d399",loClr="#f472b6")=>v===null?"—":(<><span style={{color:v>=hi?hiClr:v>=lo?"#fbbf24":loClr,fontWeight:700,fontSize:18}}>{v}%</span></>);
        const bar=(v,hi="#34d399")=><div style={{height:4,borderRadius:2,background:"rgba(128,128,128,0.10)",marginTop:4}}><div style={{height:4,borderRadius:2,width:v===null?"0%":Math.min(100,v)+"%",background:v>=70?hi:v>=40?"#fbbf24":"#f472b6",transition:"width 0.6s"}}/></div>;

        const cards=[
          Sc!==null&&{icon:"🔗",label:"Sincronía de pareja",value:pct2col(Sc,40,20),bar:bar(Sc),note:Sc>=40?"Gran tiempo compartido":Sc>=20?"Tiempo moderado juntos":"Pocas actividades conjuntas"},
          Ie!==null&&{icon:"⚖️",label:"Equidad en casa",value:pct2col(Ie,80,50),bar:bar(Ie),note:Ie>=80?"Reparto muy equilibrado":Ie>=50?"Hay algo de desequilibrio":`${cP1>cP2?p1:p2} carga más las tareas de casa`},
          {icon:"🎯",label:"Densidad de metas",value:pct2col(Gd,40,15),bar:bar(Gd),note:Gd>=40?"Alta orientación a metas":Gd>=15?"Moderado":"Pocas actividades vinculadas a metas"},
          anchor&&{icon:anchor.emoji,label:"Hábito ancla",value:<span style={{color:"var(--t-accent,#a78bfa)",fontWeight:700,fontSize:13}}>{anchor.title}</span>,bar:bar(Math.round(anchor.done/anchor.total*100)),note:`${Math.round(anchor.done/anchor.total*100)}% completitud en ${anchor.total} ocurrencias`},
          optLoad&&{icon:"🔋",label:"Carga óptima/semana",value:<span style={{color:"#34d399",fontWeight:700,fontSize:18}}>{optLoad}</span>,bar:null,note:`Semanas con ≥70% de éxito promedian ${optLoad} misiones`},
          bestWin&&{icon:"⏰",label:"Ventana óptima",value:<span style={{color:"#60a5fa",fontWeight:700,fontSize:13}}>{bestWin[1].l}</span>,bar:bar(Math.round(bestWin[1].d/bestWin[1].t*100),"#60a5fa"),note:`${Math.round(bestWin[1].d/bestWin[1].t*100)}% completitud en ese horario`},
        ].filter(Boolean);

        return <div style={{...S.card,borderColor:"rgba(96,165,250,0.2)",background:"linear-gradient(135deg,rgba(96,165,250,0.05),rgba(167,139,250,0.04))"}}>
          <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"#60a5fa",marginBottom:12,fontWeight:600}}>🧠 Deep Stats v2.0</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
            {cards.map((c,i)=>(
              <div key={i} style={{background:"rgba(128,128,128,0.05)",border:"1px solid var(--t-card-border,rgba(128,128,128,0.12))",borderRadius:10,padding:"10px 12px"}}>
                <div style={{fontSize:10,color:"var(--t-text-dim,#4a4166)",marginBottom:4}}>{c.icon} {c.label}</div>
                <div>{c.value}</div>
                {c.bar}
                <div style={{fontSize:10,color:"var(--t-text-dim,#6b5f88)",marginTop:5,lineHeight:1.4}}>{c.note}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:9,color:"var(--t-text-dim,#3d3360)",marginTop:10,textAlign:"right"}}>Basado en {dsM.length} actividades totales · Filtros de quién/rango no aplican</div>
        </div>;
      })()}

      {/* KPIs */}
      <div>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:7 }}>
          <span style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", background:"rgba(167,139,250,0.08)", border:"1px solid rgba(167,139,250,0.15)", borderRadius:99, padding:"2px 10px" }}>{filterLabel}</span>
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
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:700, color:s.color||"var(--t-text,#f8f4ff)", lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:9, color:"var(--t-text-dim,#6b5f88)", textTransform:"uppercase", letterSpacing:1, marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Status donut + bars side by side */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", marginBottom:14, fontWeight:600 }}>📊 Distribución de estados</div>
        <div style={{ display:"flex", gap:16, alignItems:"center" }}>
          {/* Donut SVG */}
          <div style={{ flexShrink:0 }}>
            <svg viewBox="0 0 36 36" width={90} height={90} style={{ transform:"rotate(-90deg)" }}>
              <circle cx="18" cy="18" r="15.9155" strokeWidth="3.8" fill="none" stroke="rgba(128,128,128,0.08)"/>
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
                <div style={{ flex:1, background:"rgba(128,128,128,0.10)", borderRadius:99, height:7, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${(count/maxSt)*100}%`, background:STATUS[s].color, borderRadius:99, opacity:0.85, transition:"width 0.5s" }} />
                </div>
                <div style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)", width:24, textAlign:"right", flexShrink:0 }}>{count}</div>
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
          <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", marginBottom:12, fontWeight:600 }}>✅ Progreso semana a semana</div>
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
          <span style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600 }}>👥 Participación por persona</span>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            {stWho!=="all"&&<span style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", fontStyle:"italic" }}>distribución real del rango</span>}
            <button onClick={()=>setShowPartInfo(v=>!v)} title="¿Qué mide esto?" style={{ background:showPartInfo?"rgba(167,139,250,0.2)":"rgba(128,128,128,0.08)", border:`1px solid ${showPartInfo?"rgba(167,139,250,0.45)":"rgba(255,255,255,0.1)"}`, borderRadius:99, color:showPartInfo?"#c4b8ff":"#6b5f88", fontSize:11, padding:"1px 7px", cursor:"pointer", fontFamily:"inherit", lineHeight:1.6 }}>ℹ</button>
          </div>
        </div>
        {showPartInfo&&<div style={{ marginBottom:12, padding:"8px 10px", background:"rgba(167,139,250,0.06)", border:"1px solid rgba(167,139,250,0.15)", borderRadius:8, fontSize:12, color:"var(--t-text-muted,#8b7fa8)", lineHeight:1.6 }}>Muestra cuántas actividades tiene asignadas cada persona en el período seleccionado y qué porcentaje completó. No mide quién hizo más trabajo, sino cómo están distribuidas las responsabilidades.</div>}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[{name:p1,h:ph1,color:clr.person1},{name:p2,h:ph2,color:clr.person2},{name:"Juntos",h:phT,color:clr.together}].map(({name,h,color})=>{
            const tot=ph1.count+ph2.count+phT.count||1;
            return <div key={name} style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:64, fontSize:12, color, fontWeight:600, flexShrink:0 }}>{name}</div>
              <div style={{ flex:1, background:"rgba(128,128,128,0.10)", borderRadius:99, height:8, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${(h.count/tot)*100}%`, background:color, borderRadius:99, opacity:0.8 }} />
              </div>
              <div style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)", flexShrink:0, width:60, textAlign:"right" }}>
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
        <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-accent,#fbbf24)", marginBottom:14, fontWeight:600 }}>💼 Horas de trabajo registradas</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[[p1,totalWork1],[p2,totalWork2]].filter(([,h])=>h>0).map(([name,h])=>{
            const weeksWithHours = allW.filter(w=>w.workHours?.[name===p1?"person1":"person2"]>0).length;
            const avg = weeksWithHours>0 ? (h/weeksWithHours).toFixed(1) : h;
            return (
              <div key={name} style={{ background:"rgba(251,191,36,0.07)", border:"1px solid rgba(251,191,36,0.18)", borderRadius:10, padding:"12px", textAlign:"center" }}>
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:700, color:"#fbbf24" }}>{avg}h</div>
                <div style={{ fontSize:10, color:"var(--t-text-muted,#8b7fa8)", marginTop:1 }}>prom/semana</div>
                <div style={{ fontSize:11, color:"var(--t-text,#f8f4ff)", marginTop:3, fontWeight:600 }}>{name}</div>
              </div>
            );
          })}
        </div>
        {totalWork1>0&&totalWork2>0&&<div style={{ marginTop:10, fontSize:12, color:"var(--t-text-muted,#8b7fa8)", textAlign:"center" }}>
          {Math.abs(totalWork1-totalWork2)<5?"⚖️ Carga laboral muy equilibrada"
            :totalWork1>totalWork2?`⚡ ${p1} trabajó ${(totalWork1-totalWork2).toFixed(1)}h más en total`
            :`⚡ ${p2} trabajó ${(totalWork2-totalWork1).toFixed(1)}h más en total`}
        </div>}
      </div>}

      {/* E4: Detalle por semana */}
      <WeekDetailList allW={allW} onGoToWeek={onGoToWeek} />

      {/* Export stats as PNG — button */}
      <button onClick={()=>setExportModal(true)} style={{...S.btnSecondary,width:"100%",textAlign:"center",padding:"11px",display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:4}}>
        🖼 Exportar stats como imagen…
      </button>

      {/* Export modal */}
      {exportModal && (
        <>
          <div onClick={()=>setExportModal(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:190}}/>
          <div style={{position:"fixed",left:0,right:0,bottom:0,zIndex:200,background:"var(--t-card,#1d1733)",border:"1px solid var(--t-card-border,rgba(167,139,250,0.25))",borderRadius:"18px 18px 0 0",padding:"20px 20px calc(28px + env(safe-area-inset-bottom))"}}>
            <div style={{width:32,height:3,background:"var(--t-card-border,#4a4166)",borderRadius:99,margin:"0 auto 16px"}}/>
            <div style={{fontSize:15,fontWeight:600,color:"var(--t-text,#f8f4ff)",marginBottom:4}}>🖼 Exportar imagen de stats</div>
            <div style={{fontSize:12,color:"var(--t-text-muted,#8b7fa8)",marginBottom:14}}>Elige qué secciones incluir:</div>
            {[["progress","📊 Progreso global (% completado)"],["personas","👥 Desglose por persona"],["categorias","🏷️ Top categorías"],["insights","💡 Análisis automático"]].map(([k,label])=>(
              <label key={k} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid var(--t-card-border,rgba(255,255,255,0.05))",cursor:"pointer"}}>
                <input type="checkbox" checked={!!exportSecs[k]} onChange={e=>setExportSecs(s=>({...s,[k]:e.target.checked}))}
                  style={{width:16,height:16,accentColor:"var(--t-accent,#a78bfa)",cursor:"pointer"}}/>
                <span style={{fontSize:13,color:"var(--t-text,#f0e8ff)"}}>{label}</span>
              </label>
            ))}
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button onClick={()=>setExportModal(false)} style={{...S.btnSecondary,flex:1,padding:"10px"}}>Cancelar</button>
              <button onClick={()=>{
                setExportModal(false);
                const secs=exportSecs;
                const cs=getComputedStyle(document.documentElement);
                const bg=cs.getPropertyValue("--t-bg").trim()||"#0a0714";
                const acc=cs.getPropertyValue("--t-accent").trim()||"#a78bfa";
                const txtColor=cs.getPropertyValue("--t-text").trim()||"#f8f4ff";
                const mutedColor=cs.getPropertyValue("--t-text-muted").trim()||"#8b7fa8";
                const dimColor=cs.getPropertyValue("--t-text-dim").trim()||"#4a4166";
                // Compute height dynamically
                let H=80; // header
                if(secs.progress) H+=130;
                if(secs.personas) H+=90;
                if(secs.categorias) H+=70+Math.ceil(catStats.slice(0,6).length/3)*28;
                if(secs.insights) H+=20+insights.slice(0,3).length*52;
                H+=48; // footer
                const W=600, DPR=2;
                const cv=document.createElement("canvas"); cv.width=W*DPR; cv.height=H*DPR;
                const cx=cv.getContext("2d"); cx.scale(DPR,DPR);
                // BG
                cx.fillStyle=bg; cx.fillRect(0,0,W,H);
                const g1=cx.createRadialGradient(W,0,0,W,0,W*0.65); g1.addColorStop(0,`${acc}33`); g1.addColorStop(1,"transparent"); cx.fillStyle=g1; cx.fillRect(0,0,W,H);
                // Header
                cx.fillStyle=`${acc}18`; cx.fillRect(0,0,W,56);
                cx.font="600 12px system-ui"; cx.fillStyle=acc; cx.fillText("📅 SHARED CALENDAR · STATS",20,35);
                cx.font="11px system-ui"; cx.fillStyle=dimColor; const fl=filterLabel; cx.fillText(fl,W-cx.measureText(fl).width-20,35);
                let y=72;
                const pctClr=pct>=80?"#34d399":pct>=50?"#fbbf24":"#f472b6";
                if(secs.progress){
                  cx.font="bold 72px 'Fraunces',Georgia,serif"; cx.fillStyle=pctClr; cx.fillText(`${pct}%`,20,y+72);
                  cx.font="600 15px system-ui"; cx.fillStyle=txtColor; cx.fillText(`${done} de ${total} actividades completadas`,20,y+100);
                  // Mini bar
                  cx.fillStyle="rgba(255,255,255,0.08)"; cx.fillRect(20,y+112,W-40,7);
                  cx.fillStyle=pctClr; cx.fillRect(20,y+112,(W-40)*(pct/100),7);
                  y+=130;
                }
                if(secs.personas){
                  cx.strokeStyle=`${acc}30`; cx.lineWidth=1; cx.beginPath(); cx.moveTo(20,y); cx.lineTo(W-20,y); cx.stroke(); y+=16;
                  cx.font="10px system-ui"; cx.fillStyle=mutedColor; cx.fillText("PERSONAS",20,y); y+=16;
                  [[p1,ph1,clr.person1],[p2,ph2,clr.person2],["Juntos",phT,clr.together||"#34d399"]].forEach(([name,ph,color])=>{
                    const p2=ph.count>0?Math.round(ph.done/ph.count*100):0; const bw=W-180;
                    cx.font="600 12px system-ui"; cx.fillStyle=color; cx.fillText(name,20,y+12);
                    cx.fillStyle="rgba(255,255,255,0.07)"; cx.fillRect(130,y+4,bw,6);
                    cx.fillStyle=color; cx.fillRect(130,y+4,bw*(p2/100),6);
                    cx.font="11px system-ui"; cx.fillStyle=mutedColor; cx.fillText(`${ph.done}/${ph.count} · ${p2}%`,W-95,y+12); y+=24;
                  }); y+=10;
                }
                if(secs.categorias && catStats.length){
                  cx.strokeStyle=`${acc}30`; cx.lineWidth=1; cx.beginPath(); cx.moveTo(20,y); cx.lineTo(W-20,y); cx.stroke(); y+=16;
                  cx.font="10px system-ui"; cx.fillStyle=mutedColor; cx.fillText("CATEGORÍAS",20,y); y+=16;
                  const cols=3, colW=(W-40)/cols;
                  catStats.slice(0,6).forEach((c,i)=>{
                    const x=20+(i%cols)*colW, cy=y+Math.floor(i/cols)*28;
                    const cp=c.count>0?Math.round(c.done/c.count*100):0;
                    cx.font="12px system-ui"; cx.fillStyle=c.color; cx.fillText(`${c.icon} ${c.label}: ${cp}%`,x,cy+12);
                  });
                  y+=Math.ceil(catStats.slice(0,6).length/3)*28+10;
                }
                if(secs.insights && insights.length){
                  cx.strokeStyle=`${acc}30`; cx.lineWidth=1; cx.beginPath(); cx.moveTo(20,y); cx.lineTo(W-20,y); cx.stroke(); y+=16;
                  cx.font="10px system-ui"; cx.fillStyle=mutedColor; cx.fillText("ANÁLISIS",20,y); y+=16;
                  insights.slice(0,3).forEach(ins=>{
                    cx.font="600 12px system-ui"; cx.fillStyle=txtColor; cx.fillText(`${ins.icon} ${ins.title}`,20,y+12);
                    cx.font="11px system-ui"; cx.fillStyle=mutedColor;
                    // word-wrap rough
                    const words=ins.desc.split(" "); let line=""; let ly=y+28;
                    words.forEach(w=>{
                      const test=line+w+" "; if(cx.measureText(test).width>W-40&&line){cx.fillText(line,20,ly);line=w+" ";ly+=16;}else{line=test;}
                    }); if(line) cx.fillText(line,20,ly);
                    y+=52;
                  });
                }
                // Footer
                cx.fillStyle=`${acc}10`; cx.fillRect(0,H-36,W,36);
                cx.font="11px system-ui"; cx.fillStyle=dimColor;
                cx.fillText(`${p1} & ${p2} · Shared Calendar`,20,H-14);
                const ds=new Date().toLocaleDateString("es-ES"); cx.fillText(ds,W-cx.measureText(ds).width-20,H-14);
                cv.toBlob(b=>dlBlob(b,`stats-${p1}-${p2}-${new Date().toISOString().slice(0,10)}.png`),"image/png");
              }} style={{...S.btnPrimary,flex:1,padding:"10px",textAlign:"center"}}>Exportar PNG</button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

function ChatView({ coupleId, personName, p1, p2, chatNotifEnabled }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!coupleId) return;
    loadMessages(coupleId).then(setMessages);
    const ch = subscribeToMessages(coupleId, msg => {
      setMessages(prev => [...prev, msg]);
      if (chatNotifEnabled && msg.sender_name !== personName && document.visibilityState !== "visible") {
        showNotif(`💬 ${msg.sender_name}`, msg.content, { tag: `chat-${msg.id}` });
      }
    });
    return () => supabase.removeChannel(ch);
  }, [coupleId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(coupleId, personName, input.trim());
      setInput("");
    } catch (e) { console.warn("send err", e); }
    finally { setSending(false); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 120px)", maxHeight:680 }}>
      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:8, padding:"4px 0 12px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign:"center", color:"var(--t-text-dim,#3d3360)", padding:40 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>💬</div>
            <div style={{ fontSize:14, fontStyle:"italic", lineHeight:1.6 }}>Todavía no hay mensajes.<br/>¡Empieza la conversación!</div>
          </div>
        )}
        {messages.map(m => {
          const isMe = m.sender_name === personName;
          return (
            <div key={m.id} style={{ display:"flex", flexDirection:"column", alignItems:isMe?"flex-end":"flex-start" }}>
              {!isMe && <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", marginBottom:2, marginLeft:4 }}>{m.sender_name}</div>}
              <div style={{
                maxWidth:"78%", background:isMe?"var(--t-accent-soft,rgba(167,139,250,0.18))":"rgba(128,128,128,0.10)",
                border:`1px solid ${isMe?"var(--t-card-border,rgba(167,139,250,0.3))":"rgba(255,255,255,0.1)"}`,
                borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px",
                padding:"8px 12px", fontSize:14, color:"var(--t-text,#f0e8ff)", lineHeight:1.5,
              }}>
                {m.content}
              </div>
              <div style={{ fontSize:10, color:"var(--t-text-dim,#3d3360)", marginTop:2, marginLeft:4, marginRight:4 }}>
                {new Date(m.created_at).toLocaleTimeString("es", { hour:"2-digit", minute:"2-digit" })}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div style={{ borderTop:"1px solid var(--t-card-border,rgba(167,139,250,0.1))", paddingTop:10, display:"flex", gap:8, alignItems:"center" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Escribe un mensaje..."
          style={{ ...S.input, flex:1 }}
          autoComplete="off"
        />
        <button onClick={send} disabled={sending || !input.trim()}
          style={{ ...S.btnPrimary, padding:"10px 16px", flexShrink:0, minWidth:44 }}>
          {sending ? "⏳" : "➤"}
        </button>
      </div>
    </div>
  );
}

function WeekDetailList({ allW, onGoToWeek }) {
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
        <span style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600 }}>📋 Detalle por semana</span>
        <span style={{ fontSize:12, color:"var(--t-text-dim,#4a4166)", transition:"transform 0.2s", display:"inline-block", transform:open?"rotate(180deg)":"rotate(0deg)" }}>▾</span>
      </button>

      {open&&<div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:0 }}>
        {rows.map(({w,d,t,pct,color},i)=>(
          <div key={w.weekNumber} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0",
            borderTop:i>0?"1px solid rgba(255,255,255,0.04)":"none" }}>
            {/* Week badge */}
            <div style={{ minWidth:34, height:34, borderRadius:9, background:`${color}18`, border:`1px solid ${color}40`,
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ fontSize:9, color, fontWeight:700, lineHeight:1 }}>S{w.weekNumber}</span>
              <span style={{ fontSize:8, color:"var(--t-text-dim,#4a4166)", lineHeight:1.2 }}>{w._yr}</span>
            </div>
            {/* Objective + mini bar */}
            <div style={{ flex:1, minWidth:0 }}>
              {w.epicObjective&&<div style={{ fontSize:11, color:"var(--t-text-muted,#8b7fa8)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginBottom:3 }}>
                {w.epicObjective}
              </div>}
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ flex:1, background:"rgba(128,128,128,0.10)", borderRadius:99, height:5, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:99, transition:"width 0.4s" }} />
                </div>
                <span style={{ fontSize:11, color, fontWeight:600, flexShrink:0, minWidth:36, textAlign:"right" }}>{d}/{t}</span>
              </div>
            </div>
            {/* Navigate */}
            {onGoToWeek&&<button onClick={()=>onGoToWeek(w.weekNumber,w._yr)}
              style={{ background:"rgba(167,139,250,0.1)", border:"1px solid rgba(167,139,250,0.2)", borderRadius:8,
                color:"var(--t-accent,#a78bfa)", fontSize:11, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>
              → Ir
            </button>}
          </div>
        ))}
      </div>}
    </div>
  );
}

function CalendarView({ allDatedMissions, p1, p2, colors, onAddForDay, onDownloadICS, onDownloadPDF, onCycleStatus, onPatchMission, onDeleteMission, onPatchAllFutureSeries, personFilter=[], catFilter=[], goals=[], settings }) {
  const today=new Date();
  const [calYear,setCalYear]=useState(today.getFullYear());
  const [calMonth,setCalMonth]=useState(today.getMonth());
  const [selectedDay,setSelectedDay]=useState(null);
  const [editingMission,setEditingMission]=useState(null);
  const [dragOver,setDragOver]=useState(null);
  const [cellPx,setCellPx]=useState(44);
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

  const applyFilters=ms=>ms.filter(m=>(!personFilter.length||personFilter.includes(m.who))&&(!catFilter.length||getMCats(m).some(c=>catFilter.includes(c))));
  // Precompute each mission's spanning dates once – avoids N×getMissionDates per cell
  const byDate={};
  const datesFor=new Map(); // missionId → dates[]
  applyFilters(allDatedMissions).forEach(m=>{
    const d=getMissionDates(m);
    datesFor.set(m.id,d);
    d.forEach(ds=>{
      if(!byDate[ds])byDate[ds]=[];
      byDate[ds].push(m);
    });
  });
  const spanOf=m=>datesFor.get(m.id)||[m.date];

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

  return (
    <div>
      {/* v3: ICS/PDF moved to OverflowMenu in topbar */}
      {/* Calendar */}
      <div ref={calRef}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:8}}>
            <button onClick={prevM} style={S.btnNav}>‹</button>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:600,minWidth:160,textAlign:"center"}}>{MONTHS[calMonth]} {calYear}</div>
            <button onClick={nextM} style={S.btnNav}>›</button>
          </div>
          {(calYear!==today.getFullYear()||calMonth!==today.getMonth())&&(
            <div style={{textAlign:"center",marginBottom:10}}>
              <button onClick={()=>{setCalYear(today.getFullYear());setCalMonth(today.getMonth());setSelectedDay(null);}} style={{background:"rgba(167,139,250,0.10)",border:"1px solid rgba(167,139,250,0.3)",borderRadius:99,color:"var(--t-accent,#a78bfa)",fontSize:11,fontWeight:600,padding:"4px 14px",cursor:"pointer",fontFamily:"inherit"}}>⟲ Volver a hoy</button>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:3}}>
            {DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:numSz,color:"var(--t-text-dim,#4a4166)",fontWeight:600,padding:"3px 0"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
            {cells.map((day,i)=>{
              if(!day)return<div key={`e${i}`}/>;
              const ds=`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const ms=byDate[ds]||[],isTd=ds===todayStr,isSel=day===selectedDay,isDO=dragOver===ds;
              const multiMs=ms.filter(m=>spanOf(m).length>1);
              const singleMs=ms.filter(m=>spanOf(m).length<=1);
              return<div key={day} onClick={()=>setSelectedDay(isSel?null:day)}
                onDragEnter={e=>{e.preventDefault();setDragOver(ds);}} onDragOver={e=>e.preventDefault()} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDragOver(null);}} onDrop={e=>onDropDay(e,ds)}
                style={{borderRadius:6,minHeight:cellH,overflow:"hidden",cursor:"pointer",
                  background:isDO?"rgba(167,139,250,0.3)":isSel?"rgba(167,139,250,0.22)":ms.length>0?"rgba(167,139,250,0.06)":"rgba(255,255,255,0.02)",
                  border:isDO?"1px solid rgba(167,139,250,0.7)":isSel?"1px solid rgba(167,139,250,0.55)":"1px solid rgba(255,255,255,0.04)",transition:"all 0.12s"}}>
                {/* Multi-day event bars */}
                {multiMs.map(m=>{
                  const mDates=spanOf(m);
                  const isFirst=mDates[0]===ds,isLast=mDates[mDates.length-1]===ds;
                  const bg=m.who==="person1"?clrC.person1:m.who==="person2"?clrC.person2:clrC.together;
                  return<div key={`bar-${m.id}`} title={m.title} draggable onDragStart={e=>{e.stopPropagation();onDragStart(e,m);}} onDragEnd={()=>setDragOver(null)}
                    style={{height:15,display:"flex",alignItems:"center",overflow:"hidden",whiteSpace:"nowrap",
                      marginLeft:isFirst?0:-2,marginRight:isLast?0:-2,marginBottom:1,
                      paddingLeft:isFirst?4:0,paddingRight:isLast?2:0,
                      background:`${bg}35`,borderTop:`2px solid ${bg}99`,
                      borderRadius:isFirst&&isLast?"3px":isFirst?"3px 0 0 3px":isLast?"0 3px 3px 0":"0",
                      opacity:m.status==="DONE"?0.45:1,cursor:"grab"}}>
                    {isFirst&&<span style={{fontSize:7,color:bg,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis"}}>{m.emoji} {m.title}</span>}
                  </div>;
                })}
                {/* Day number + single-day missions */}
                <div style={{padding:"2px 3px"}}>
                  <div style={{fontSize:numSz,fontWeight:600,marginBottom:2,textAlign:"center",color:isTd?"#f472b6":isSel?"#c4b8ff":"#4a4166",width:18,height:18,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 2px",border:isTd?"1.5px solid #f472b6":"1.5px solid transparent",lineHeight:1}}>{day}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:2,justifyContent:"center"}}>
                    {singleMs.slice(0,maxPerCell).map(m=>{const bg=m.who==="person1"?clrC.person1:m.who==="person2"?clrC.person2:clrC.together;return<span key={`${m.id}-${ds}`} draggable onDragStart={e=>{e.stopPropagation();onDragStart(e,m);}} onDragEnd={()=>setDragOver(null)} title={m.title} style={{fontSize:emojiSz,lineHeight:1,background:`${bg}30`,border:`1px solid ${bg}55`,borderRadius:3,padding:"1px 2px",opacity:m.status==="DONE"?0.4:1,cursor:"grab"}}>{m.emoji}</span>;})}
                    {singleMs.length>maxPerCell&&<span style={{fontSize:8,color:"var(--t-text-dim,#4a4166)"}}>+{singleMs.length-maxPerCell}</span>}
                  </div>
                </div>
                {/* v3: density bar per person */}
                {ms.length>0&&(()=>{const p1c=ms.filter(m=>m.who==="person1").length,p2c=ms.filter(m=>m.who==="person2").length,tg=ms.filter(m=>m.who==="together").length;return<div style={{height:2,display:"flex",gap:0,overflow:"hidden"}}>{p1c>0&&<i style={{background:clrC.person1,flex:p1c,height:"100%"}}/>}{p2c>0&&<i style={{background:clrC.person2,flex:p2c,height:"100%"}}/>}{tg>0&&<i style={{background:clrC.together,flex:tg,height:"100%"}}/>}</div>;})()}
              </div>;
            })}
          </div>
        </div>

      {/* Day detail panel */}
      {selectedDay&&<div style={{...S.card,marginTop:12,borderColor:"rgba(167,139,250,0.3)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"var(--t-accent,#a78bfa)",fontWeight:600}}>{selectedDay} de {MONTHS[calMonth]}</div>
          <div style={{display:"flex",gap:6}}>
            {onAddForDay&&<button onClick={()=>onAddForDay(selStr)} style={{...S.btnPrimary,fontSize:11,padding:"5px 10px"}}>+ Añadir</button>}
          </div>
        </div>
        {selMs.length===0?<div style={{color:"var(--t-text-dim,#3d3360)",fontStyle:"italic",fontSize:13}}>Sin misiones para este día</div>:
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {selMs.map(m=>{
              const whoColor=m.who==="person1"?clrC.person1:m.who==="person2"?clrC.person2:clrC.together;
              const isMultiDay=spanOf(m).length>1;
              return<div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid rgba(167,139,250,0.08)"}}>
                <span style={{fontSize:20,flexShrink:0}}>{m.emoji}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,color:m.status==="DONE"?"#4d4566":"var(--t-text,#e2d9ff)",textDecoration:m.status==="DONE"?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {m.title}{isMultiDay&&<span style={{fontSize:10,marginLeft:4,color:"var(--t-accent,#a78bfa)"}}>↔</span>}
                  </div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:2}}>
                    {m.time&&<span style={{fontSize:10,color:"var(--t-accent,#a78bfa)"}}>🕐 {m.time}</span>}
                    {m.duration>0&&<span style={{fontSize:10,color:"#7c6fa0"}}>{m.duration>=60?`${Math.floor(m.duration/60)}h${m.duration%60?m.duration%60+"m":""}`:m.duration+"m"}</span>}
                    {getMCats(m).map(ci=>{const c=CAT_MAP[ci];return c?<span key={ci} style={{fontSize:10,color:c.color}}>{c.icon}</span>:null;})}
                    <span style={{fontSize:10,background:`${whoColor}18`,color:whoColor,border:`1px solid ${whoColor}40`,padding:"0 5px",borderRadius:99}}>{m.who==="person1"?p1:m.who==="person2"?p2:"👫"}</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:4,flexShrink:0}}>
                  <button onClick={()=>onCycleStatus&&onCycleStatus(m.weekNumber,m._yr,m.id)} style={badgeStyle(m.status)}>{STATUS[m.status].icon}</button>
                  <button onClick={()=>openEdit(m)} style={{background:"rgba(167,139,250,0.12)",border:"1px solid rgba(167,139,250,0.25)",borderRadius:7,color:"var(--t-accent,#a78bfa)",fontSize:11,padding:"4px 8px",cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                </div>
              </div>;
            })}
          </div>
        }
      </div>}

      {/* Inline edit modal */}
      {editingMission&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={closeEdit}>
        <div style={{background:"var(--t-card,#1d1733)",border:"1px solid var(--t-card-border,rgba(167,139,250,0.35))",borderRadius:16,padding:20,width:"100%",maxWidth:420,maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <span style={{fontSize:13,fontWeight:600,color:"var(--t-text,#c4b8ff)"}}>✏️ Editar actividad</span>
            <button onClick={closeEdit} style={{background:"none",border:"none",color:"var(--t-text-dim,#6b5f88)",fontSize:20,cursor:"pointer"}}>×</button>
          </div>
          <div style={{marginBottom:10}}><label style={S.label}>Título</label><input value={editingMission.mission.title} onChange={e=>patchEditing({title:e.target.value})} style={S.input} /></div>
          <div style={{marginBottom:10}}>
            <label style={S.label}>Participante</label>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {[{id:"person1",label:p1},{id:"person2",label:p2},{id:"together",label:"👫 Juntos"}].map(w=>(
                <button key={w.id} onClick={()=>patchEditing({who:w.id})}
                  style={{background:editingMission.mission.who===w.id?"var(--t-accent-soft,rgba(167,139,250,0.2))":"rgba(128,128,128,0.06)",border:`1px solid ${editingMission.mission.who===w.id?"var(--t-accent,rgba(167,139,250,0.5))":"var(--t-card-border,rgba(255,255,255,0.08))"}`,borderRadius:8,color:editingMission.mission.who===w.id?"var(--t-accent,#c4b8ff)":"var(--t-text-dim,#6b5f88)",padding:"5px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>{w.label}</button>
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
            <div><label style={S.label}>📆 Fecha inicio</label><input type="date" value={editingMission.mission.date||""} onChange={e=>patchEditing({date:e.target.value||null})} style={{...S.inputSm,colorScheme:"dark"}} /></div>
            <div><label style={S.label}>🕐 Hora inicio</label><input type="time" value={editingMission.mission.time||""} onChange={e=>patchEditing({time:e.target.value||null})} style={{...S.inputSm,colorScheme:"dark"}} /></div>
          </div>
          {editingMission.mission.type==="event"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div><label style={S.label}>🏁 Fecha fin</label><input type="date" value={editingMission.mission.endDate||""} onChange={e=>{const ed=e.target.value||null;const s=editingMission.mission,d=s.date,t=s.time,et=s.endTime;const dur=d&&t&&ed&&et?Math.round((new Date(ed+"T"+et)-new Date(d+"T"+t))/60000):s.duration;patchEditing({endDate:ed,...(dur>0?{duration:dur}:{})});}} style={{...S.inputSm,colorScheme:"dark"}} /></div>
            <div><label style={S.label}>🕐 Hora fin</label><input type="time" value={editingMission.mission.endTime||""} onChange={e=>{const et=e.target.value||null;const s=editingMission.mission,d=s.date,t=s.time,ed=s.endDate;const dur=d&&t&&ed&&et?Math.round((new Date(ed+"T"+et)-new Date(d+"T"+t))/60000):s.duration;patchEditing({endTime:et,...(dur>0?{duration:dur}:{})});}} style={{...S.inputSm,colorScheme:"dark"}} /></div>
          </div>}
          {editingMission.mission.type==="event"&&editingMission.mission.time&&<div style={{marginBottom:8}}>
            <label style={S.label}>🔔 Recordatorio</label>
            <select value={editingMission.mission.reminder||"none"} onChange={e=>patchEditing({reminder:e.target.value})} style={{...S.inputSm,colorScheme:"dark",fontSize:12}}>
              <option value="none">Sin recordatorio</option>
              <option value="ontime">En el momento</option>
              <option value="15min">15 min antes</option>
              <option value="30min">30 min antes</option>
              <option value="1h">1 hora antes</option>
              <option value="1day">1 día antes</option>
            </select>
          </div>}
          <div style={{marginBottom:10}}>
            <label style={S.label}>Estado</label>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {STATUS_ORDER.map(s=><button key={s} onClick={()=>patchEditing({status:s,completedAt:s==="DONE"?Date.now():null})} style={{...badgeStyle(s),opacity:editingMission.mission.status===s?1:0.35}}>{STATUS[s].icon} {STATUS[s].label}</button>)}
            </div>
          </div>
          {(()=>{const gmw=(g,w)=>w==="together"||g.who==="together"||!g.who||g.who===w;const filtered=goals.filter(g=>g.active!==false&&gmw(g,editingMission.mission.who));return filtered.length>0&&<div style={{marginBottom:10}}>
            <label style={S.label}>🏅 Meta</label>
            <select value={editingMission.mission.goalId||""} onChange={e=>patchEditing({goalId:e.target.value||null})} style={{...S.input,fontSize:13,colorScheme:"dark",background:"var(--t-card,rgba(16,10,32,0.95))",color:"var(--t-text,#f8f4ff)"}}>
              <option value="">— Sin meta —</option>
              {filtered.map(g=><option key={g.id} value={g.id}>{g.emoji} {g.title}</option>)}
            </select>
          </div>;})()}
          {editingMission.mission.seriesId && onPatchAllFutureSeries && (
            <div style={{ background:"rgba(52,211,153,0.07)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:10, padding:"10px 12px", marginBottom:10 }}>
              <div style={{ fontSize:11, color:"#34d399", fontWeight:600, marginBottom:6 }}>🔁 Tarea recurrente · {editingMission.mission.seriesPattern==="weekly"?"Semanal":editingMission.mission.seriesPattern==="biweekly"?"Bisemanal":"Mensual"}</div>
              <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:8 }}>Los cambios anteriores aplican solo a esta instancia.</div>
              <button onClick={()=>{
                const fromWkey = isoWeekKey(editingMission.wn, editingMission.yr);
                const { seriesId, title, emoji, who, categories, category, duration, type, reminder, seriesEndDate } = editingMission.mission;
                confirm(`¿Aplicar estos cambios a TODAS las instancias futuras de "${title}"?`, () => {
                  onPatchAllFutureSeries(seriesId, fromWkey, { title, emoji, who, categories, category, duration, type, reminder, seriesEndDate });
                  closeEdit();
                }, { danger: false });
              }} style={{...S.btnSecondary, fontSize:11, padding:"5px 12px"}}>📋 Aplicar a todas las futuras</button>
            </div>
          )}
          <div style={{display:"flex",gap:8,justifyContent:"space-between",marginTop:14}}>
            <button onClick={()=>confirm("¿Eliminar esta actividad?", ()=>{onDeleteMission&&onDeleteMission(editingMission.wn,editingMission.yr,editingMission.mission.id);closeEdit();})} style={{...S.btnSecondary,color:"#f472b6",borderColor:"rgba(244,114,182,0.3)"}}>🗑 Eliminar</button>
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
            {EMOJI_GROUPS[ag].emojis.map((e,ei)=><button key={ei} onClick={()=>{onChange(e);setOpen(false);}} style={{ fontSize:20, background:"none", border:"none", cursor:"pointer", padding:4, borderRadius:8 }}
              onMouseEnter={ev=>ev.currentTarget.style.background="rgba(167,139,250,0.2)"} onMouseLeave={ev=>ev.currentTarget.style.background="none"}>{e}</button>)}
          </div>
        </div>
      </>}
    </div>
  );
}

const PROJECT_EMOJIS = ["🏖️","🗺️","🎉","🏠","🍽️","🎊","✈️","🎸","🏕️","💒","🎭","🎄","🏔️","🚂","🎿","🏄","🎪","🎨","🛳️","🌴","🎠","🚀","💍","🥂"];

function GastosView({ gastos, proyectos, p1, p2, colors, onUpdate, onUpdateProyectos, onUpdateAll }) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [view, setView] = useState("list");
  const [projectId, setProjectId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editProjectId, setEditProjectId] = useState(null);
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0,7));
  const blankExpense = { desc:"", amount:"", cat:"comida", paidBy:"person1", date:new Date().toISOString().slice(0,10), splitP1:50, projectId:null };
  const [form, setForm] = useState(blankExpense);
  const [projectForm, setProjectForm] = useState({ name:"", emoji:"🏖️" });

  // Normalize old split format to numeric splitP1 (% that p1 pays)
  const getSplitP1 = g => {
    if (typeof g.splitP1 === "number") return g.splitP1;
    if (g.split === "full") return g.who === "person1" ? 100 : 0;
    return 50;
  };

  // Balance for any array of expenses
  const computeBalance = exps => {
    const total = exps.reduce((s,g)=>s+(parseFloat(g.amount)||0),0);
    const p1Paid = exps.filter(g=>g.paidBy==="person1").reduce((s,g)=>s+(parseFloat(g.amount)||0),0);
    const p2Paid = exps.filter(g=>g.paidBy==="person2").reduce((s,g)=>s+(parseFloat(g.amount)||0),0);
    // p1Net > 0 means p1 owes p2; < 0 means p2 owes p1
    const p1Net = exps.reduce((s,g)=>{
      const amt=parseFloat(g.amount)||0, sp1=getSplitP1(g)/100;
      return g.paidBy==="person2" ? s+amt*sp1 : s-amt*(1-sp1);
    },0);
    return { total, p1Paid, p2Paid, p1Net };
  };

  const fmtAmt = n => `$${Math.round(+n).toLocaleString("es-CL")}`;
  const monthLabel = m => { if(!m)return""; const [y,mo]=m.split("-"); return `${_SM[parseInt(mo,10)-1]} ${y}`; };

  const scopedGastos = projectId ? gastos.filter(g=>g.projectId===projectId) : gastos;
  const monthGastos  = scopedGastos.filter(g=>g.date?.startsWith(filterMonth));
  const monthBalance = computeBalance(monthGastos);
  const allMonthsSet = [...new Set(scopedGastos.map(g=>g.date?.slice(0,7)).filter(Boolean))].sort((a,b)=>b.localeCompare(a));
  const allMonths    = allMonthsSet.includes(filterMonth) ? allMonthsSet : [filterMonth,...allMonthsSet];
  const filteredList = [...monthGastos].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const catTotals    = GASTO_CATS.map(c=>({...c, total:monthGastos.filter(g=>g.cat===c.id).reduce((s,g)=>s+(parseFloat(g.amount)||0),0)})).filter(c=>c.total>0).sort((a,b)=>b.total-a.total);

  // Stats: last 6 months
  const last6 = Array.from({length:6},(_,i)=>{ const d=new Date(); d.setMonth(d.getMonth()-i); return d.toISOString().slice(0,7); }).reverse();
  const monthlyTotals   = last6.map(m=>({ m, total:scopedGastos.filter(g=>g.date?.startsWith(m)).reduce((s,g)=>s+(parseFloat(g.amount)||0),0) }));
  const maxMonthlyTotal = Math.max(...monthlyTotals.map(x=>x.total),1);

  // Projects with computed balance
  const proyectosWithBal = (proyectos||[]).map(p=>{ const b=computeBalance(gastos.filter(g=>g.projectId===p.id)); return {...p,...b, count:gastos.filter(g=>g.projectId===p.id).length}; });

  // Expense form handlers
  const openAddExpense  = () => { setForm({...blankExpense, projectId:projectId||null}); setEditId(null); setShowForm(true); };
  const openEditExpense = g => { setForm({...g, amount:String(g.amount), splitP1:getSplitP1(g)}); setEditId(g.id); setShowForm(true); };
  const saveExpense = () => {
    const amt=parseFloat(form.amount);
    if (!form.desc.trim()||!amt||isNaN(amt)||amt<=0) return;
    const entry={...form, amount:amt, id:editId||uid(), splitP1:Number(form.splitP1)||50};
    if (editId) onUpdate(gastos.map(g=>g.id===editId?entry:g));
    else onUpdate([...gastos, entry]);
    setShowForm(false); setEditId(null);
  };
  const delExpense = id => onUpdate(gastos.filter(g=>g.id!==id));

  // Project form handlers
  const openAddProject  = () => { setProjectForm({name:"",emoji:"🏖️"}); setEditProjectId(null); setShowProjectForm(true); };
  const openEditProject = p => { setProjectForm({name:p.name,emoji:p.emoji}); setEditProjectId(p.id); setShowProjectForm(true); };
  const saveProject = () => {
    if (!projectForm.name.trim()) return;
    const entry={...projectForm, id:editProjectId||uid(), createdAt:Date.now()};
    if (editProjectId) onUpdateProyectos((proyectos||[]).map(p=>p.id===editProjectId?{...p,...projectForm}:p));
    else onUpdateProyectos([...(proyectos||[]), entry]);
    setShowProjectForm(false); setEditProjectId(null);
  };
  const delProject = id => {
    onUpdateAll({ gastosProyectos:(proyectos||[]).filter(p=>p.id!==id), gastos:gastos.map(g=>g.projectId===id?{...g,projectId:null}:g) });
    setProjectId(null);
  };
  const settleProject = (id, settled) => onUpdateProyectos((proyectos||[]).map(p=>p.id===id?{...p,settled}:p));

  const INP = { background:"var(--t-input-bg,rgba(255,255,255,0.06))", border:"1px solid var(--t-card-border,rgba(167,139,250,0.2))", borderRadius:10, color:"var(--t-text,#f0e8ff)", fontSize:16, padding:"12px 12px", fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" };
  const SEL = { ...INP, fontSize:14, padding:"11px 10px", cursor:"pointer", WebkitAppearance:"none", appearance:"none" };
  const TAB_BTN = (active) => ({ flexShrink:0, padding:"6px 14px", borderRadius:20, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:active?600:400, background:active?"var(--t-accent-soft,rgba(167,139,250,0.2))":"rgba(128,128,128,0.07)", color:active?"var(--t-accent,#a78bfa)":"var(--t-text-dim,#6b5f88)" });
  const BAL_PILL = (owes) => ({ background:owes?"rgba(248,113,113,0.1)":"rgba(52,211,153,0.1)", border:`1px solid ${owes?"rgba(248,113,113,0.3)":"rgba(52,211,153,0.3)"}`, borderRadius:8, padding:"8px 12px", fontSize:12, color:owes?"#f87171":"#34d399", fontWeight:600, textAlign:"center" });

  return (
    <div style={{ padding:"16px 16px 80px", maxWidth:600, margin:"0 auto" }}>

      {/* ── Tab nav: General | Proyectos | + | Stats ── */}
      <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto", paddingBottom:2 }}>
        <button onClick={()=>{setProjectId(null);setView("list");}} style={TAB_BTN(!projectId&&view==="list")}>💸 General</button>
        {(proyectos||[]).map(p=>(
          <button key={p.id} onClick={()=>{setProjectId(p.id);setView("list");}} style={TAB_BTN(projectId===p.id&&view==="list")}>{p.emoji} {p.name}</button>
        ))}
        <button onClick={openAddProject} style={{ flexShrink:0, padding:"6px 12px", borderRadius:20, border:"1px dashed rgba(167,139,250,0.3)", cursor:"pointer", fontFamily:"inherit", fontSize:12, background:"transparent", color:"var(--t-text-dim,#6b5f88)" }}>+ Proyecto</button>
        <button onClick={()=>setView("stats")} style={TAB_BTN(view==="stats")}>📊 Stats</button>
      </div>

      {/* ── Project header (when inside a project) ── */}
      {projectId && (()=>{
        const p=(proyectos||[]).find(x=>x.id===projectId); if(!p)return null;
        const pb=computeBalance(gastos.filter(g=>g.projectId===projectId));
        return (
          <div style={{ ...S.card, marginBottom:14, display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:30 }}>{p.emoji}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:700, color:"var(--t-text,#e2dff5)" }}>{p.name}</div>
              <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginTop:1 }}>{gastos.filter(g=>g.projectId===projectId).length} gastos · {fmtAmt(pb.total)}</div>
              {Math.abs(pb.p1Net)>0.5 && <div style={{ fontSize:11, fontWeight:600, color:pb.p1Net>0?"#f87171":"#34d399", marginTop:2 }}>{pb.p1Net>0?`${p1} debe ${fmtAmt(Math.abs(pb.p1Net))} a ${p2}`:`${p2} debe ${fmtAmt(Math.abs(pb.p1Net))} a ${p1}`}</div>}
              {Math.abs(pb.p1Net)<=0.5&&pb.total>0&&<div style={{ fontSize:11, fontWeight:600, color:"#34d399", marginTop:2 }}>✓ Al día</div>}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
              <button onClick={()=>settleProject(projectId,!p.settled)}
                style={{ fontSize:10, padding:"4px 8px", borderRadius:8, border:`1px solid ${p.settled?"rgba(52,211,153,0.4)":"rgba(167,139,250,0.3)"}`, background:p.settled?"rgba(52,211,153,0.1)":"rgba(128,128,128,0.06)", color:p.settled?"#34d399":"#6b5f88", cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>
                {p.settled?"🔒 Saldado":"Marcar saldado"}
              </button>
              <div style={{ display:"flex", gap:4 }}>
                <button onClick={()=>openEditProject(p)} style={{ background:"none", border:"none", color:"var(--t-text-dim,#6b5f88)", cursor:"pointer", fontSize:13, padding:"2px 5px" }} onMouseEnter={e=>e.currentTarget.style.color="#c4b8ff"} onMouseLeave={e=>e.currentTarget.style.color="#6b5f88"}>✎</button>
                <button onClick={()=>confirm(`¿Eliminar proyecto "${p.name}"?`, ()=>delProject(projectId))} style={{ background:"none", border:"none", color:"var(--t-text-dim,#3d3360)", cursor:"pointer", fontSize:17, padding:"2px 5px" }} onMouseEnter={e=>e.currentTarget.style.color="#f472b6"} onMouseLeave={e=>e.currentTarget.style.color="#3d3360"}>×</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Projects list (General home) ── */}
      {!projectId && view==="list" && (()=>{
        const open   = proyectosWithBal.filter(p=>!p.settled);
        const closed = proyectosWithBal.filter(p=>p.settled);
        const renderCard = p => (
          <button key={p.id} onClick={()=>{setProjectId(p.id);setView("list");}}
            style={{ ...S.card, display:"flex", alignItems:"center", gap:12, padding:"12px 14px", border:"none", cursor:"pointer", textAlign:"left", width:"100%", marginBottom:6, opacity:p.settled?0.6:1 }}>
            <span style={{ fontSize:22 }}>{p.settled?"🔒":p.emoji}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:"var(--t-text,#e2dff5)" }}>{p.name}</div>
              <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)" }}>{p.count} gastos · {fmtAmt(p.total)}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              {p.settled
                ? <div style={{ fontSize:11, color:"#34d399", fontWeight:600 }}>✓ Saldado</div>
                : Math.abs(p.p1Net)>0.5
                  ? <div style={{ fontSize:12, color:p.p1Net>0?"#f87171":"#34d399", fontWeight:700 }}>{p.p1Net>0?`${p1}: −${fmtAmt(Math.abs(p.p1Net))}`:`${p2}: −${fmtAmt(Math.abs(p.p1Net))}`}</div>
                  : p.total>0 ? <div style={{ fontSize:11, color:"#34d399" }}>✓ Al día</div> : null
              }
            </div>
            <span style={{ color:"var(--t-text-dim,#4a4166)" }}>›</span>
          </button>
        );
        if (!open.length && !closed.length) return null;
        return (
          <div style={{ marginBottom:14 }}>
            {open.length>0 && <>
              <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:8 }}>📁 Proyectos activos</div>
              {open.map(renderCard)}
            </>}
            {closed.length>0 && <>
              <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:8, marginTop:open.length?14:0 }}>🔒 Saldados</div>
              {closed.map(renderCard)}
            </>}
          </div>
        );
      })()}

      {/* ── Stats view ── */}
      {view==="stats" && (()=>{
        const allBal=computeBalance(scopedGastos);
        const allCats=GASTO_CATS.map(c=>({...c,total:scopedGastos.filter(g=>g.cat===c.id).reduce((s,g)=>s+(parseFloat(g.amount)||0),0)})).filter(c=>c.total>0).sort((a,b)=>b.total-a.total);
        const activeMonths=new Set(scopedGastos.map(g=>g.date?.slice(0,7)).filter(Boolean)).size||1;
        return (
          <>
            <div style={{ ...S.card, marginBottom:14 }}>
              <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:14 }}>📅 Últimos 6 meses</div>
              <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:90 }}>
                {monthlyTotals.map(({m,total})=>(
                  <div key={m} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                    <div style={{ fontSize:9, color:"var(--t-text-dim,#6b5f88)", height:14, textAlign:"center" }}>{total>0?fmtAmt(total):""}</div>
                    <div style={{ width:"100%", background:"rgba(128,128,128,0.10)", borderRadius:"5px 5px 0 0", height:60, display:"flex", alignItems:"flex-end" }}>
                      <div style={{ width:"100%", background:"var(--t-accent,#a78bfa)", borderRadius:"5px 5px 0 0", height:`${Math.round(total/maxMonthlyTotal*100)}%`, minHeight:total>0?2:0 }} />
                    </div>
                    <div style={{ fontSize:9, color:"var(--t-text-dim,#4a4166)" }}>{monthLabel(m).slice(0,3)}</div>
                  </div>
                ))}
              </div>
            </div>
            {allCats.length>0&&(
              <div style={{ ...S.card, marginBottom:14 }}>
                <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:12 }}>🏷️ Por categoría (total)</div>
                {allCats.map(c=>(
                  <div key={c.id} style={{ marginBottom:9 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{ fontSize:12, color:c.color, fontWeight:600 }}>{c.icon} {c.label}</span>
                      <span style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)" }}>{fmtAmt(c.total)} · {allBal.total>0?Math.round(c.total/allBal.total*100):0}%</span>
                    </div>
                    <div style={{ background:"rgba(128,128,128,0.10)", borderRadius:99, height:5, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${allBal.total>0?c.total/allBal.total*100:0}%`, background:c.color, borderRadius:99 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ ...S.card, marginBottom:14 }}>
              <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:12 }}>👥 Resumen</div>
              <div style={{ display:"flex", gap:10, marginBottom:10 }}>
                <div style={{ flex:1, background:"rgba(128,128,128,0.06)", borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)" }}>{p1} pagó</div>
                  <div style={{ fontSize:17, fontWeight:700, color:colors.person1||"#f472b6" }}>{fmtAmt(allBal.p1Paid)}</div>
                  <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)" }}>{allBal.total>0?Math.round(allBal.p1Paid/allBal.total*100):0}% del total</div>
                </div>
                <div style={{ flex:1, background:"rgba(128,128,128,0.06)", borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)" }}>{p2} pagó</div>
                  <div style={{ fontSize:17, fontWeight:700, color:colors.person2||"#60a5fa" }}>{fmtAmt(allBal.p2Paid)}</div>
                  <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)" }}>{allBal.total>0?Math.round(allBal.p2Paid/allBal.total*100):0}% del total</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:10, marginBottom:Math.abs(allBal.p1Net)>0.5?10:0 }}>
                <div style={{ flex:1, background:"rgba(128,128,128,0.06)", borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)" }}>Total acumulado</div>
                  <div style={{ fontSize:17, fontWeight:700, color:"var(--t-accent,#c4b8ff)" }}>{fmtAmt(allBal.total)}</div>
                </div>
                <div style={{ flex:1, background:"rgba(128,128,128,0.06)", borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)" }}>Promedio/mes</div>
                  <div style={{ fontSize:17, fontWeight:700, color:"var(--t-accent,#c4b8ff)" }}>{fmtAmt(allBal.total/activeMonths)}</div>
                </div>
              </div>
              {Math.abs(allBal.p1Net)>0.5&&<div style={BAL_PILL(allBal.p1Net>0)}>{allBal.p1Net>0?`${p1} le debe ${fmtAmt(Math.abs(allBal.p1Net))} a ${p2}`:`${p2} le debe ${fmtAmt(Math.abs(allBal.p1Net))} a ${p1}`}</div>}
            </div>
            {proyectosWithBal.filter(p=>p.total>0).length>0&&(
              <div style={{ ...S.card }}>
                <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:12 }}>📁 Por proyecto</div>
                {proyectosWithBal.filter(p=>p.total>0).map(p=>(
                  <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontSize:18 }}>{p.emoji}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--t-text,#e2dff5)" }}>{p.name}</div>
                      <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)" }}>{p.count} gastos</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:14, fontWeight:700, color:"var(--t-accent,#c4b8ff)" }}>{fmtAmt(p.total)}</div>
                      {Math.abs(p.p1Net)>0.5&&<div style={{ fontSize:10, color:p.p1Net>0?"#f87171":"#34d399" }}>{p.p1Net>0?`${p1}: −${fmtAmt(Math.abs(p.p1Net))}`:`${p2}: −${fmtAmt(Math.abs(p.p1Net))}`}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        );
      })()}

      {/* ── List view ── */}
      {view==="list" && (
        <>
          {/* Month balance card */}
          <div style={{ ...S.card, marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <span style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600 }}>💸 {monthLabel(filterMonth)}</span>
              <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}
                style={{ background:"rgba(128,128,128,0.08)", border:"1px solid rgba(167,139,250,0.2)", borderRadius:8, color:"#c4b8ff", fontSize:11, padding:"3px 8px", fontFamily:"inherit", cursor:"pointer" }}>
                {allMonths.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </div>
            <div style={{ fontSize:26, fontWeight:700, color:"var(--t-accent,#c4b8ff)", fontFamily:"'Fraunces',serif", letterSpacing:-1, marginBottom:8 }}>{fmtAmt(monthBalance.total)}</div>
            <div style={{ display:"flex", gap:10, marginBottom:10 }}>
              <div style={{ flex:1, background:"rgba(128,128,128,0.06)", borderRadius:8, padding:"8px 10px" }}>
                <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)" }}>{p1} pagó</div>
                <div style={{ fontSize:15, fontWeight:600, color:colors.person1||"#f472b6" }}>{fmtAmt(monthBalance.p1Paid)}</div>
              </div>
              <div style={{ flex:1, background:"rgba(128,128,128,0.06)", borderRadius:8, padding:"8px 10px" }}>
                <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)" }}>{p2} pagó</div>
                <div style={{ fontSize:15, fontWeight:600, color:colors.person2||"#60a5fa" }}>{fmtAmt(monthBalance.p2Paid)}</div>
              </div>
            </div>
            {Math.abs(monthBalance.p1Net)>0.5&&<div style={BAL_PILL(monthBalance.p1Net>0)}>{monthBalance.p1Net>0?`${p1} debe ${fmtAmt(Math.abs(monthBalance.p1Net))} a ${p2}`:`${p2} debe ${fmtAmt(Math.abs(monthBalance.p1Net))} a ${p1}`}</div>}
            {Math.abs(monthBalance.p1Net)<=0.5&&monthBalance.total>0&&<div style={BAL_PILL(false)}>✓ Están al día</div>}
          </div>

          {/* Category breakdown */}
          {catTotals.length>0&&(
            <div style={{ ...S.card, marginBottom:12 }}>
              <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:10 }}>🏷️ Por categoría</div>
              {catTotals.map(c=>(
                <div key={c.id} style={{ marginBottom:7 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                    <span style={{ fontSize:12, color:c.color, fontWeight:600 }}>{c.icon} {c.label}</span>
                    <span style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)" }}>{fmtAmt(c.total)} · {monthBalance.total>0?Math.round(c.total/monthBalance.total*100):0}%</span>
                  </div>
                  <div style={{ background:"rgba(128,128,128,0.10)", borderRadius:99, height:4, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${monthBalance.total>0?c.total/monthBalance.total*100:0}%`, background:c.color, borderRadius:99 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add button */}
          <button onClick={openAddExpense} style={{ ...S.btnPrimary, width:"100%", padding:"11px", fontSize:13, textAlign:"center", display:"flex", alignItems:"center", justifyContent:"center", gap:6, marginBottom:12 }}>
            + Añadir gasto{projectId?` · ${(proyectos||[]).find(p=>p.id===projectId)?.name||""}` : ""}
          </button>

          {/* Expense list */}
          {filteredList.length===0&&(
            <div style={{ textAlign:"center", padding:40, color:"var(--t-text-dim,#3d3360)" }}>
              <div style={{ fontSize:40, marginBottom:10 }}>💸</div>
              <div style={{ fontStyle:"italic", fontSize:13 }}>Sin gastos en {monthLabel(filterMonth)}.<br/>¡Añade el primero!</div>
            </div>
          )}
          {filteredList.map(g=>{
            const cat=GASTO_CATS.find(c=>c.id===g.cat)||GASTO_CATS[GASTO_CATS.length-1];
            const sp1=getSplitP1(g);
            const paidLabel=g.paidBy==="person1"?p1:p2;
            const splitLabel=sp1===50?"÷2":sp1===100?`100% ${p1}`:sp1===0?`100% ${p2}`:`${sp1}%/${100-sp1}%`;
            const projName=g.projectId?(proyectos||[]).find(p=>p.id===g.projectId)?.name:null;
            return (
              <div key={g.id} style={{ ...S.card, marginBottom:6, display:"flex", alignItems:"center", gap:10, padding:"10px 12px" }}>
                <span style={{ fontSize:20, flexShrink:0 }}>{cat.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:2, flexWrap:"wrap" }}>
                    <span style={{ fontSize:13, fontWeight:600, color:"var(--t-text,#e2dff5)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:140 }}>{g.desc}</span>
                    <span style={{ fontSize:9, color:cat.color, background:`${cat.color}22`, borderRadius:4, padding:"1px 4px", flexShrink:0 }}>{cat.label}</span>
                    {projName&&<span style={{ fontSize:9, color:"var(--t-text-muted,#8b7fa8)", background:"rgba(128,128,128,0.10)", borderRadius:4, padding:"1px 4px", flexShrink:0 }}>📁 {projName}</span>}
                  </div>
                  <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)" }}>{g.date} · {paidLabel} pagó · {splitLabel}</div>
                </div>
                <div style={{ fontSize:15, fontWeight:700, color:"var(--t-accent,#c4b8ff)", flexShrink:0 }}>{fmtAmt(g.amount)}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:2, flexShrink:0 }}>
                  <button onClick={()=>openEditExpense(g)} style={{ background:"none", border:"none", color:"var(--t-text-dim,#6b5f88)", cursor:"pointer", fontSize:12, padding:"2px 4px" }} onMouseEnter={e=>e.currentTarget.style.color="#c4b8ff"} onMouseLeave={e=>e.currentTarget.style.color="#6b5f88"}>✎</button>
                  <button onClick={()=>delExpense(g.id)} style={{ background:"none", border:"none", color:"var(--t-text-dim,#3d3360)", cursor:"pointer", fontSize:15, padding:"2px 4px" }} onMouseEnter={e=>e.currentTarget.style.color="#f472b6"} onMouseLeave={e=>e.currentTarget.style.color="#3d3360"}>×</button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ── Add/edit expense modal ── */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
          onClick={e=>{if(e.target===e.currentTarget){setShowForm(false);setEditId(null);}}}>
          <div style={{ background:"var(--t-card,#1d1733)", borderRadius:"18px 18px 0 0", width:"100%", maxWidth:560, padding:"20px 20px 40px", display:"flex", flexDirection:"column", gap:12, maxHeight:"92vh", overflowY:"auto" }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:15, fontWeight:600, color:"var(--t-text,#e2dff5)" }}>{editId?"Editar gasto":"Nuevo gasto"}</span>
              <button onClick={()=>{setShowForm(false);setEditId(null);}} style={{ background:"none", border:"none", color:"var(--t-text-dim,#6b5f88)", fontSize:22, cursor:"pointer" }}>×</button>
            </div>
            {/* Descripción */}
            <input placeholder="Descripción (ej. Cena, Supermercado…)" value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} style={INP} />
            {/* Monto */}
            <div>
              <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:5 }}>Monto</div>
              <input placeholder="0" type="number" inputMode="decimal" min="0" step="any" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={INP} />
            </div>
            {/* Fecha — full width con label, colorScheme:dark para que se vea en iOS */}
            <div>
              <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:5 }}>Fecha</div>
              <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{ ...INP, colorScheme:"dark" }} />
            </div>
            {/* Categoría + Quién pagó */}
            <div style={{ display:"flex", gap:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:5 }}>Categoría</div>
                <select value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))} style={SEL}>
                  {GASTO_CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:5 }}>¿Quién pagó?</div>
                <select value={form.paidBy} onChange={e=>setForm(f=>({...f,paidBy:e.target.value}))} style={SEL}>
                  <option value="person1">{p1}</option>
                  <option value="person2">{p2}</option>
                </select>
              </div>
            </div>
            {/* División con slider */}
            <div>
              <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:6 }}>División del gasto</div>
              {/* Montos en tiempo real */}
              {form.amount && parseFloat(form.amount)>0 && (
                <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                  <div style={{ flex:1, background:"rgba(128,128,128,0.06)", borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                    <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)" }}>{p1} paga</div>
                    <div style={{ fontSize:15, fontWeight:700, color:"var(--t-accent,#c4b8ff)" }}>{fmtAmt(parseFloat(form.amount)*form.splitP1/100)}</div>
                    <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)" }}>{form.splitP1}%</div>
                  </div>
                  <div style={{ flex:1, background:"rgba(128,128,128,0.06)", borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                    <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)" }}>{p2} paga</div>
                    <div style={{ fontSize:15, fontWeight:700, color:"var(--t-accent,#c4b8ff)" }}>{fmtAmt(parseFloat(form.amount)*(100-form.splitP1)/100)}</div>
                    <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)" }}>{100-form.splitP1}%</div>
                  </div>
                </div>
              )}
              <div style={{ display:"flex", gap:5, marginBottom:10, flexWrap:"wrap" }}>
                {[{l:"50/50",v:50},{l:`Solo ${p1}`,v:100},{l:`Solo ${p2}`,v:0},{l:`${p1} 70%`,v:70},{l:`${p2} 70%`,v:30}].map(({l,v})=>(
                  <button key={l} onClick={()=>setForm(f=>({...f,splitP1:v}))}
                    style={{ padding:"5px 10px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:form.splitP1===v?700:400, background:form.splitP1===v?"var(--t-accent-soft,rgba(167,139,250,0.2))":"rgba(128,128,128,0.08)", color:form.splitP1===v?"var(--t-accent,#c4b8ff)":"#6b5f88" }}>{l}</button>
                ))}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", flexShrink:0 }}>0%</span>
                <input type="range" min="0" max="100" step="5" value={form.splitP1} onChange={e=>setForm(f=>({...f,splitP1:Number(e.target.value)}))} style={{ flex:1, accentColor:"var(--t-accent,#a78bfa)", cursor:"pointer" }} />
                <span style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", flexShrink:0 }}>100%</span>
              </div>
            </div>
            {/* Proyecto (opcional) */}
            {(proyectos||[]).length>0&&(
              <div>
                <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:5 }}>Proyecto (opcional)</div>
                <select value={form.projectId||""} onChange={e=>setForm(f=>({...f,projectId:e.target.value||null}))} style={SEL}>
                  <option value="">Sin proyecto</option>
                  {(proyectos||[]).map(p=><option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:4 }}>
              <button onClick={()=>{setShowForm(false);setEditId(null);}} style={S.btnSecondary}>Cancelar</button>
              <button onClick={saveExpense} style={S.btnPrimary}>Guardar ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add/edit project modal ── */}
      {showProjectForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
          onClick={e=>{if(e.target===e.currentTarget){setShowProjectForm(false);setEditProjectId(null);}}}>
          <div style={{ background:"var(--t-card,#1d1733)", borderRadius:"18px 18px 0 0", width:"100%", maxWidth:560, padding:"20px 20px 40px", display:"flex", flexDirection:"column", gap:14 }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:15, fontWeight:600, color:"var(--t-text,#e2dff5)" }}>{editProjectId?"Editar proyecto":"Nuevo proyecto"}</span>
              <button onClick={()=>{setShowProjectForm(false);setEditProjectId(null);}} style={{ background:"none", border:"none", color:"var(--t-text-dim,#6b5f88)", fontSize:22, cursor:"pointer" }}>×</button>
            </div>
            <div>
              <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:5 }}>Nombre</div>
              <input placeholder="ej. Viaje a Chile, Finde playa…" value={projectForm.name} onChange={e=>setProjectForm(f=>({...f,name:e.target.value}))} style={INP} />
            </div>
            <div>
              <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:8 }}>Emoji</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {PROJECT_EMOJIS.map(em=>(
                  <button key={em} onClick={()=>setProjectForm(f=>({...f,emoji:em}))}
                    style={{ width:38, height:38, borderRadius:8, border:`2px solid ${projectForm.emoji===em?"var(--t-accent,#a78bfa)":"transparent"}`, background:projectForm.emoji===em?"var(--t-accent-soft,rgba(167,139,250,0.15))":"rgba(128,128,128,0.06)", cursor:"pointer", fontSize:20, display:"flex", alignItems:"center", justifyContent:"center" }}>{em}</button>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={()=>{setShowProjectForm(false);setEditProjectId(null);}} style={S.btnSecondary}>Cancelar</button>
              <button onClick={saveProject} style={S.btnPrimary}>Guardar ✓</button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}