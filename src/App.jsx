import { useState, useEffect, useCallback } from "react";
import { loadData, saveData } from "./supabase.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const SEED_VERSION = 5;
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
];
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
const prevWeekFn = (wn, yr) => wn === 1 ? { wn: 52, yr: yr - 1 } : { wn: wn - 1, yr };

// ─── Seed ─────────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = { person1: "Pololo", person2: "Banana", colors: { person1:"#f472b6", person2:"#a78bfa", together:"#34d399" } };
const DEFAULT_COLORS = { person1:"#f472b6", person2:"#a78bfa", together:"#34d399" };

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
  category: null, who: "together", duration: null,
});

const SEED = {
  seedVersion: SEED_VERSION,
  currentWeekNumber: 13, currentYear: 2026,
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
  return { current, target:goal.target, pct:goal.target>0?Math.min((current/goal.target)*100,100):0 };
}

function computeGoalHistory(goal, weeks) {
  const now = new Date();
  const allDone = Object.values(weeks).flatMap(w =>
    (w.missions||[]).filter(m => m.goalId===goal.id && m.status==="DONE")
      .map(m => ({ ...m, wn:w.weekNumber, wy:w.year||now.getFullYear() }))
  );
  const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  if (goal.period==="weekly") {
    return Array.from({length:8},(_,i)=>{
      const d = new Date(now); d.setDate(d.getDate()-(7-i)*7);
      const { week:wn, year:wy } = getWeekAndYear(d);
      const count = allDone.filter(m=>m.wn===wn&&m.wy===wy).length;
      return { label:`S${wn}`, count, met:count>=goal.target };
    });
  } else if (goal.period==="monthly") {
    return Array.from({length:6},(_,i)=>{
      const d = new Date(now.getFullYear(), now.getMonth()-(5-i), 1);
      const mo=d.getMonth(), yr=d.getFullYear();
      const count = allDone.filter(m=>{
        if (m.date){const md=new Date(m.date);return md.getMonth()===mo&&md.getFullYear()===yr;}
        const approx=new Date(m.wy,0,1+(m.wn-1)*7);
        return approx.getMonth()===mo&&approx.getFullYear()===yr;
      }).length;
      return { label:MONTHS_SHORT[mo], count, met:count>=goal.target };
    });
  } else {
    return Array.from({length:4},(_,i)=>{
      const yr = now.getFullYear()-(3-i);
      const count = allDone.filter(m=>{
        if(m.date)return new Date(m.date).getFullYear()===yr;
        return m.wy===yr;
      }).length;
      return { label:String(yr), count, met:count>=goal.target };
    });
  }
}

// ─── Carry-over ───────────────────────────────────────────────────────────────
function applyCarryOver(data) {
  const { currentWeekNumber:cwn, currentYear:cyr } = data;
  const { wn:pwn, yr:pyr } = prevWeekFn(cwn, cyr);
  const prevKey = isoWeekKey(pwn, pyr), currKey = isoWeekKey(cwn, cyr);
  const prevW = data.weeks[prevKey]; if (!prevW) return data;
  const currW = data.weeks[currKey] || { weekNumber:cwn, year:cyr, epicObjective:"", missions:[], createdAt:Date.now(), workHours:{person1:0,person2:0} };
  const existingCarriedIds = new Set((currW.missions||[]).filter(m=>m.carriedFrom).map(m=>m.carriedFrom));
  const existingTitles = new Set((currW.missions||[]).map(m=>m.title));
  const toCarry = (prevW.missions||[]).filter(m => m.status!=="DONE" && !existingCarriedIds.has(m.id) && !existingTitles.has(m.title));
  if (!toCarry.length) return data;
  const carried = toCarry.map(m => ({ ...m, id:uid(), carriedFrom:m.id, carriedFromWeek:prevKey, date:null, createdAt:Date.now(), completedAt:null, status:m.status==="ASAP"?"ASAP":"TBC" }));
  return { ...data, weeks: { ...data.weeks, [currKey]: { ...currW, missions:[...(currW.missions||[]), ...carried] } } };
}
function syncCarryDone(data, weekKey, missionId) {
  const week = data.weeks[weekKey]; if (!week) return data;
  const mission = week.missions.find(m=>m.id===missionId);
  if (!mission?.carriedFrom || !mission?.carriedFromWeek) return data;
  const origWeek = data.weeks[mission.carriedFromWeek]; if (!origWeek) return data;
  return { ...data, weeks: { ...data.weeks, [mission.carriedFromWeek]: { ...origWeek, missions: origWeek.missions.map(m => m.id===mission.carriedFrom ? {...m, status:"DONE", completedAt:Date.now()} : m) } } };
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  card: { background:"#1d1733", border:"1px solid rgba(167,139,250,0.12)", borderRadius:14, padding:"14px 16px" },
  input: { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(167,139,250,0.25)", borderRadius:8, padding:"8px 12px", color:"#f8f4ff", fontSize:14, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" },
  inputSm: { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(167,139,250,0.2)", borderRadius:7, padding:"5px 8px", color:"#f8f4ff", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" },
  btnNav: { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(167,139,250,0.2)", borderRadius:8, color:"#a78bfa", fontSize:22, width:38, height:38, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit", lineHeight:1, flexShrink:0 },
  btnPrimary: { background:"linear-gradient(135deg,#f472b6,#a78bfa)", border:"none", borderRadius:8, color:"#fff", padding:"7px 14px", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"inherit" },
  btnSecondary: { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#8b7fa8", padding:"7px 14px", cursor:"pointer", fontSize:13, fontFamily:"inherit" },
  label: { fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", fontWeight:600, marginBottom:6, display:"block" },
};
const badgeStyle = s => ({ background:STATUS[s].bg, color:STATUS[s].color, border:`1px solid ${STATUS[s].border}`, padding:"3px 8px", borderRadius:99, fontSize:11, fontWeight:600, fontFamily:"inherit", letterSpacing:0.3, cursor:"pointer", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:4 });
const catBadgeStyle = catId => { const c = CAT_MAP[catId]; if (!c) return {}; return { background:`${c.color}18`, color:c.color, border:`1px solid ${c.color}40`, padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600, display:"flex", alignItems:"center", gap:3, whiteSpace:"nowrap" }; };

// ─── App ──────────────────────────────────────────────────────────────────────
export default function CoupleMissions() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("current");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newM, setNewM] = useState({ emoji:"🎯", title:"", status:"TBC", date:"", time:"", category:null, who:"together", duration:"", goalId:null });
  const [editObj, setEditObj] = useState(false);
  const [saved, setSaved] = useState(false);
  const [carriedCount, setCarriedCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState(null);
  const [histPersonFilter, setHistPersonFilter] = useState("all");
  const [histWeekRange, setHistWeekRange] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        let base = await loadData();
        if (base) {
          if (!base.seedVersion || base.seedVersion < SEED_VERSION) {
            base = { ...SEED, settings: base.settings || SEED.settings, weeks: { ...SEED.weeks, ...base.weeks }, seedVersion: SEED_VERSION };
          }
        } else {
          base = { ...SEED };
        }
        if (!base.settings) base.settings = DEFAULT_SETTINGS;
        if (!base.goals) base.goals = SEED.goals;
        if (isTodayMonday()) base = applyCarryOver(base);
        setData(base);
        await saveData(base);
      } catch(e) {
        console.error(e);
        setError("No se pudo conectar con la base de datos. Comprueba tu conexión.");
        setData({ ...SEED });
      }
      setLoading(false);
    })();
  }, []);

  const persist = useCallback(async next => {
    setSaving(true);
    await saveData(next);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }, []);

  const update = useCallback(fn => {
    setData(p => { const n = fn(p); persist(n); return n; });
  }, [persist]);

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
  const wkey = isoWeekKey(data.currentWeekNumber, data.currentYear);
  const week = data.weeks[wkey] || { weekNumber:data.currentWeekNumber, year:data.currentYear, epicObjective:"", missions:[], createdAt:Date.now(), workHours:{person1:0,person2:0} };
  const patchWeek = fn => update(d => ({ ...d, weeks: { ...d.weeks, [wkey]: fn(d.weeks[wkey] || week) } }));

  const addMission = () => {
    if (!newM.title.trim()) return;
    patchWeek(w => ({ ...w, missions:[...(w.missions||[]), { id:uid(), emoji:newM.emoji, title:newM.title.trim(), status:newM.status, date:newM.date||null, time:newM.time||null, createdAt:Date.now(), completedAt:null, carriedFrom:null, carriedFromWeek:null, category:newM.category||null, who:newM.who, duration:newM.duration?parseFloat(newM.duration):null, goalId:newM.goalId||null }] }));
    setNewM({ emoji:"🎯", title:"", status:"TBC", date:"", time:"", category:null, who:"together", duration:"", goalId:null });
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
  const changeWeek = d => update(s => { let wn=s.currentWeekNumber+d,yr=s.currentYear; if(wn>52){wn=1;yr++;} if(wn<1){wn=52;yr--;} return {...s,currentWeekNumber:wn,currentYear:yr}; });
  const { week:todayWeek, year:todayYear } = getWeekAndYear();
  const isCurrentWeek = data.currentWeekNumber===todayWeek && data.currentYear===todayYear;
  const goToToday = () => { update(s=>({...s,currentWeekNumber:todayWeek,currentYear:todayYear})); setActiveTab("current"); };
  const runCarryOver = () => update(d => applyCarryOver(d));

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

  const pct = total>0?(done/total)*100:0;
  const carried = week.missions?.filter(m=>m.carriedFrom)||[];
  const sortedWeeks = Object.entries(data.weeks).sort((a,b)=>b[0].localeCompare(a[0]));
  const allDated = Object.values(data.weeks).flatMap(w=>(w.missions||[]).filter(m=>m.date).map(m=>({...m,weekNumber:w.weekNumber})));

  return (
    <div style={{ minHeight:"100vh", background:"#0a0714", backgroundImage:"radial-gradient(ellipse at 15% 50%,rgba(167,139,250,0.09) 0%,transparent 55%),radial-gradient(ellipse at 85% 20%,rgba(244,114,182,0.08) 0%,transparent 50%)", fontFamily:"'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif", color:"#f8f4ff" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      {showSettings && <SettingsModal data={data} update={update} onClose={()=>setShowSettings(false)} />}

      <div style={{ maxWidth:640, margin:"0 auto", padding:"28px 16px 140px" }}>

        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:24, position:"relative" }}>
          <button onClick={()=>setShowSettings(true)} style={{ position:"absolute", right:0, top:0, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(167,139,250,0.2)", borderRadius:8, color:"#6b5f88", width:34, height:34, cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>⚙️</button>
          <div style={{ fontSize:13, color:"#8b7fa8", letterSpacing:1, marginBottom:12 }}>💞 {p1} & {p2}</div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:14, marginBottom:8 }}>
            <button onClick={()=>changeWeek(-1)} style={S.btnNav}>‹</button>
            <div>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:40, fontWeight:700, lineHeight:1, letterSpacing:-1 }}>Semana {data.currentWeekNumber}</div>
              <div style={{ fontSize:12, color:"#6b5f88", marginTop:2 }}>{data.currentYear}</div>
            </div>
            <button onClick={()=>changeWeek(1)} style={S.btnNav}>›</button>
          </div>
          {!isCurrentWeek && (
            <div style={{ marginBottom:8 }}>
              <button onClick={goToToday} style={{ background:"rgba(244,114,182,0.12)", border:"1px solid rgba(244,114,182,0.3)", borderRadius:99, color:"#f472b6", fontSize:12, fontWeight:600, padding:"5px 14px", cursor:"pointer", fontFamily:"inherit" }}>📍 Volver a hoy</button>
            </div>
          )}
          {total>0 && <>
            <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:99, height:7, overflow:"hidden", margin:"0 20px" }}>
              <div style={{ height:"100%", width:`${pct}%`, background:"linear-gradient(90deg,#f472b6,#a78bfa)", borderRadius:99, transition:"width 0.6s" }} />
            </div>
            <div style={{ fontSize:12, color:"#8b7fa8", marginTop:7 }}>{done} de {total} completadas {pct===100?"🎉":`(${Math.round(pct)}%)`}</div>
          </>}
          {/* Sync indicator */}
          <div style={{ position:"absolute", left:0, top:0, fontSize:11, color:saving?"#fb923c":saved?"#34d399":"transparent", transition:"color 0.3s" }}>
            {saving?"⟳ Guardando…":saved?"✓ Guardado":"·"}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:3, background:"rgba(255,255,255,0.04)", borderRadius:12, padding:4, marginBottom:22, overflowX:"auto", scrollbarWidth:"none" }}>
          {[{id:"current",label:"🎯 Semana"},{id:"calendar",label:"📅 Cal."},{id:"history",label:"🗂️ Hist."},{id:"goals",label:"🏅 Metas"},{id:"stats",label:"📊 Stats"}].map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ flexShrink:0, padding:"8px 10px", borderRadius:9, border:"none", cursor:"pointer", fontSize:11, fontWeight:500, fontFamily:"inherit", transition:"all 0.2s", background:activeTab===t.id?"rgba(167,139,250,0.18)":"transparent", color:activeTab===t.id?"#c4b8ff":"#6b5f88", whiteSpace:"nowrap" }}>{t.label}</button>
          ))}
        </div>

        {/* Current Week */}
        {activeTab==="current" && <div>
          {carriedCount>0 && <div style={{ background:"rgba(251,146,60,0.1)", border:"1px solid rgba(251,146,60,0.25)", borderRadius:12, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:10, fontSize:13 }}>
            <span style={{ fontSize:20 }}>🔁</span>
            <span style={{ color:"#fdba74" }}><strong>{carriedCount} misión{carriedCount>1?"es":""}</strong> arrastrada{carriedCount>1?"s":""} de la semana anterior</span>
          </div>}
          <WorkHoursCard week={week} patchWeek={patchWeek} p1={p1} p2={p2} />
          <div style={{ textAlign:"right", marginBottom:4 }}>
            <button onClick={runCarryOver} style={{ background:"none", border:"none", color:"#4a4166", fontSize:11, cursor:"pointer", fontFamily:"inherit", padding:"2px 4px" }}
              onMouseEnter={e=>e.currentTarget.style.color="#a78bfa"} onMouseLeave={e=>e.currentTarget.style.color="#4a4166"}>🔁 Recuperar tareas pendientes</button>
          </div>
          <div style={{ ...S.card, marginBottom:14, borderColor:"rgba(244,114,182,0.18)" }}>
            <div style={{ fontSize:10, letterSpacing:2.5, textTransform:"uppercase", color:"#f472b6", marginBottom:8, fontWeight:600 }}>🎯 Objetivo épico</div>
            {editObj
              ? <input autoFocus value={week.epicObjective} onChange={e=>patchWeek(w=>({...w,epicObjective:e.target.value}))} onBlur={()=>setEditObj(false)} onKeyDown={e=>e.key==="Enter"&&setEditObj(false)} placeholder="¿Cuál es la misión épica?" style={S.input} />
              : <div onClick={()=>setEditObj(true)} style={{ cursor:"text", fontSize:16, fontFamily:"'Fraunces',serif", fontWeight:300, color:week.epicObjective?"#f8f4ff":"#3d3360", fontStyle:week.epicObjective?"normal":"italic" }}>{week.epicObjective||"Pulsa para añadir el objetivo épico..."}</div>
            }
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {week.missions?.map(m=>(
              <MissionCard key={m.id} mission={m} p1={p1} p2={p2} colors={colors} goals={data.goals||[]} onCycleStatus={()=>cycleStatus(m.id)} onDelete={()=>delMission(m.id)} onPatch={p=>patchM(m.id,p)} />
            ))}
            {showAddForm
              ? <AddMissionForm newM={newM} setNewM={setNewM} onAdd={addMission} onCancel={()=>setShowAddForm(false)} p1={p1} p2={p2} goals={data.goals||[]} />
              : <button onClick={()=>setShowAddForm(true)} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"14px", border:"2px dashed rgba(167,139,250,0.2)", borderRadius:13, background:"transparent", color:"#5a4f80", cursor:"pointer", fontSize:14, fontFamily:"inherit" }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(167,139,250,0.45)";e.currentTarget.style.color="#a78bfa";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(167,139,250,0.2)";e.currentTarget.style.color="#5a4f80";}}><span style={{ fontSize:20 }}>+</span> Nueva misión</button>
            }
          </div>
        </div>}

        {activeTab==="calendar" && <CalendarView
          allDatedMissions={allDated} week={week} wkey={wkey} p1={p1} p2={p2} weeks={data.weeks} colors={colors}
          onAddForDay={(date) => { setNewM(p=>({...p, date})); setShowAddForm(true); setActiveTab("current"); }}
          onDownloadICS={() => downloadWeekICS(week, wkey, p1, p2)}
          onDownloadPDF={() => downloadWeekPDF(week, wkey, p1, p2)}
        />}

        {activeTab==="history" && (() => {
          const allHistSorted = Object.entries(data.weeks).sort((a,b)=>b[0].localeCompare(a[0]));
          const histFiltered = histWeekRange==="all" ? allHistSorted : allHistSorted.slice(0, parseInt(histWeekRange));
          const filterHM = ms => histPersonFilter==="all" ? ms : ms.filter(m=>m.who===histPersonFilter);
          return (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {/* Filter bar */}
            <div style={{ ...S.card, padding:"10px 14px" }}>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                <div>
                  <div style={S.label}>Persona</div>
                  <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
                    {[["all","Todos"],["person1",p1],["person2",p2],["together","Juntos"]].map(([v,l])=>(
                      <button key={v} onClick={()=>setHistPersonFilter(v)} style={{ background:histPersonFilter===v?"rgba(244,114,182,0.2)":"rgba(255,255,255,0.04)", border:`1px solid ${histPersonFilter===v?"rgba(244,114,182,0.4)":"rgba(255,255,255,0.08)"}`, borderRadius:7, color:histPersonFilter===v?"#f472b6":"#6b5f88", padding:"4px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={S.label}>Semanas</div>
                  <div style={{ display:"flex", gap:3 }}>
                    {[["all","Todas"],["8","8 últ."],["4","4 últ."]].map(([v,l])=>(
                      <button key={v} onClick={()=>setHistWeekRange(v)} style={{ background:histWeekRange===v?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.04)", border:`1px solid ${histWeekRange===v?"rgba(167,139,250,0.4)":"rgba(255,255,255,0.08)"}`, borderRadius:7, color:histWeekRange===v?"#a78bfa":"#6b5f88", padding:"4px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Export buttons */}
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => downloadWeekICS(week, wkey, p1, p2)} style={{ ...S.btnSecondary, flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"9px 10px", borderColor:"rgba(52,211,153,0.3)", color:"#34d399", fontSize:12 }}>📅 .ics semana actual</button>
              <button onClick={() => downloadFilteredPDF(histFiltered, histPersonFilter, p1, p2)} style={{ ...S.btnSecondary, flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"9px 10px", borderColor:"rgba(167,139,250,0.3)", color:"#a78bfa", fontSize:12 }}>🖨️ PDF filtrado ({histFiltered.length} sem.)</button>
            </div>
            {/* Week cards */}
            {histFiltered.map(([key,w]) => {
              const filtMs = filterHM(w.missions||[]);
              const d=filtMs.filter(m=>m.status==="DONE").length, t=filtMs.length, p=t>0?Math.round((d/t)*100):0, cur=key===wkey;
              return (
                <div key={key} style={{ ...S.card, borderColor:cur?"rgba(167,139,250,0.45)":"rgba(167,139,250,0.1)", background:cur?"#231e3d":"#1d1733", padding:"12px 14px" }}>
                  <div onClick={()=>{update(s=>({...s,currentWeekNumber:w.weekNumber,currentYear:w.year||s.currentYear}));setActiveTab("current");}} style={{ cursor:"pointer", marginBottom:w.epicObjective?5:8 }}>
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
                      <div style={{ fontSize:10, color:"#4a4166", marginTop:3 }}>{p}%{histPersonFilter!=="all"?` (${histPersonFilter==="person1"?p1:histPersonFilter==="person2"?p2:"Juntos"})`:""}</div>
                    </div>
                    {w.photo
                      ? <div style={{ position:"relative", flexShrink:0 }}>
                          <img src={w.photo} style={{ width:44, height:44, borderRadius:8, objectFit:"cover", display:"block", border:"1px solid rgba(167,139,250,0.25)" }} alt="foto" />
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
                  {w.photo&&<div style={{ marginTop:8, position:"relative" }}>
                    <img src={w.photo} style={{ width:"100%", borderRadius:10, maxHeight:200, objectFit:"cover", display:"block" }} alt="foto semana" />
                    <a href={w.photo} download={`semana-${w.weekNumber}-${w.year||""}.jpg`}
                      style={{ position:"absolute", bottom:8, right:8, background:"rgba(0,0,0,0.55)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:7, color:"#f8f4ff", fontSize:11, padding:"4px 9px", textDecoration:"none", backdropFilter:"blur(4px)" }}>⬇ Guardar foto</a>
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
  return (
    <div style={{ ...S.card, borderColor:"rgba(167,139,250,0.3)" }}>
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10 }}>
        <EmojiSelect value={newM.emoji} onChange={e=>setNewM(p=>({...p,emoji:e}))} />
        <input autoFocus value={newM.title} onChange={e=>setNewM(p=>({...p,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&onAdd()} placeholder="Nombre de la misión..." style={S.input} />
      </div>
      <div style={{ marginBottom:10 }}>
        <label style={S.label}>Categoría</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
          {CATEGORIES.map(c=>(
            <button key={c.id} onClick={()=>setNewM(p=>({...p,category:p.category===c.id?null:c.id}))}
              style={{ ...catBadgeStyle(c.id), cursor:"pointer", border:`1px solid ${c.color}${newM.category===c.id?"":"20"}`, opacity:newM.category===c.id||!newM.category?1:0.4 }}>
              {c.icon} {c.label}
            </button>
          ))}
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
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
        <div><label style={S.label}>📆 Fecha</label><input type="date" value={newM.date} onChange={e=>setNewM(p=>({...p,date:e.target.value}))} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
        <div><label style={S.label}>🕐 Hora</label><input type="time" value={newM.time} onChange={e=>setNewM(p=>({...p,time:e.target.value}))} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
        <div><label style={S.label}>⏱ Duración (h)</label><input type="number" min="0" step="0.5" value={newM.duration} onChange={e=>setNewM(p=>({...p,duration:e.target.value}))} placeholder="1" style={S.inputSm} /></div>
      </div>
      {activeGoals.length>0&&<div style={{ marginBottom:10 }}>
        <label style={S.label}>🏅 ¿Cuenta para alguna meta?</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
          {activeGoals.map(g=>{
            const sel=newM.goalId===g.id;
            return <button key={g.id} onClick={()=>setNewM(p=>({...p,goalId:sel?null:g.id}))} style={{ background:sel?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.04)", border:`1px solid ${sel?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:8, color:sel?"#c4b8ff":"#6b5f88", padding:"4px 10px", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>{g.emoji} {g.title}</button>;
          })}
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

function MissionCard({ mission, onCycleStatus, onDelete, onPatch, p1, p2, colors, goals }) {
  const [expanded, setExpanded] = useState(false);
  const isDone = mission.status==="DONE", isCarried = !!mission.carriedFrom;
  const cat = mission.category ? CAT_MAP[mission.category] : null;
  const clr = colors || DEFAULT_COLORS;
  const whoColor = mission.who==="person1"?clr.person1:mission.who==="person2"?clr.person2:clr.together;
  const WHO = [{ id:"together",label:"Juntos",icon:"👫"},{id:"person1",label:p1,icon:"🙋"},{id:"person2",label:p2,icon:"🙋"}];
  const gcalUrl = googleCalendarUrl(mission, p1, p2);
  return (
    <div style={{ ...S.card, borderColor:isDone?"rgba(52,211,153,0.15)":isCarried?"rgba(251,146,60,0.2)":`${whoColor}22`, opacity:isDone?0.78:1, transition:"all 0.25s" }}>
      {isCarried&&!isDone&&<div style={{ fontSize:10, color:"#fb923c", letterSpacing:1, marginBottom:6 }}>🔁 Arrastrada</div>}
      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
        <EmojiSelect value={mission.emoji} onChange={e=>onPatch({emoji:e})} />
        <div style={{ flex:1, minWidth:0, cursor:"pointer" }} onClick={()=>setExpanded(v=>!v)}>
          <div style={{ fontSize:14, fontWeight:500, lineHeight:1.4, color:isDone?"#6b5f88":"#f0e8ff", textDecoration:isDone?"line-through":"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={mission.title}>{mission.title}</div>
          <div style={{ display:"flex", gap:4, marginTop:4, flexWrap:"wrap" }}>
            {cat&&<span style={catBadgeStyle(cat.id)}>{cat.icon} {cat.label}</span>}
            {mission.who==="together"&&<span style={{ background:`${clr.together}18`, color:clr.together, border:`1px solid ${clr.together}40`, padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600 }}>👫 Juntos</span>}
            {mission.who==="person1"&&<span style={{ background:`${clr.person1}18`, color:clr.person1, border:`1px solid ${clr.person1}40`, padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600 }}>🙋 {p1}</span>}
            {mission.who==="person2"&&<span style={{ background:`${clr.person2}18`, color:clr.person2, border:`1px solid ${clr.person2}40`, padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600 }}>🙋 {p2}</span>}
            {(mission.duration||mission.estimatedHours)&&<span style={{ background:"rgba(96,165,250,0.08)", color:"#60a5fa", border:"1px solid rgba(96,165,250,0.2)", padding:"2px 7px", borderRadius:99, fontSize:11 }}>⏱ {mission.duration||mission.estimatedHours}h</span>}
            {mission.date&&<span style={{ background:"rgba(255,255,255,0.05)", color:"#6b5f88", border:"1px solid rgba(255,255,255,0.08)", padding:"2px 7px", borderRadius:99, fontSize:11 }}>📆 {mission.date}{mission.time?` · 🕐 ${mission.time}`:""}</span>}
            {mission.goalId&&(()=>{const g=(goals||[]).find(x=>x.id===mission.goalId);return g?<span style={{ background:"rgba(167,139,250,0.12)", color:"#a78bfa", border:"1px solid rgba(167,139,250,0.25)", padding:"2px 7px", borderRadius:99, fontSize:11 }}>🏅 {g.emoji} {g.title}</span>:null;})()}
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
            <label style={S.label}>Categoría</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {CATEGORIES.map(c=><button key={c.id} onClick={()=>onPatch({category:mission.category===c.id?null:c.id})} style={{ ...catBadgeStyle(c.id), cursor:"pointer", border:`1px solid ${c.color}${mission.category===c.id?"":"20"}`, opacity:mission.category===c.id||!mission.category?1:0.4 }}>{c.icon} {c.label}</button>)}
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
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom: gcalUrl?8:0 }}>
            <div><label style={S.label}>📆 Fecha</label><input type="date" value={mission.date||""} onChange={e=>onPatch({date:e.target.value||null})} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
            <div><label style={S.label}>🕐 Hora</label><input type="time" value={mission.time||""} onChange={e=>onPatch({time:e.target.value||null})} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
            <div><label style={S.label}>⏱ Duración (h)</label><input type="number" min="0" step="0.5" value={mission.duration||""} onChange={e=>onPatch({duration:parseFloat(e.target.value)||null})} placeholder="1" style={S.inputSm} /></div>
          </div>
          {(goals||[]).filter(g=>g.active!==false).length>0&&<div style={{ marginBottom:8 }}>
            <label style={S.label}>🏅 ¿Cuenta para alguna meta?</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {(goals||[]).filter(g=>g.active!==false).map(g=>{
                const sel=mission.goalId===g.id;
                return <button key={g.id} onClick={()=>onPatch({goalId:sel?null:g.id})} style={{ background:sel?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.04)", border:`1px solid ${sel?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:8, color:sel?"#c4b8ff":"#6b5f88", padding:"4px 10px", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>{g.emoji} {g.title}</button>;
              })}
            </div>
          </div>}
          {gcalUrl&&<a href={gcalUrl} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, color:"#34d399", background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:7, padding:"5px 10px", textDecoration:"none", marginTop:4 }}>📅 Añadir a Google Calendar</a>}
        </div>
      )}
    </div>
  );
}

function SettingsModal({ data, update, onClose }) {
  const [p1, setP1] = useState(data.settings?.person1||"Pololo");
  const [p2, setP2] = useState(data.settings?.person2||"Banana");
  const [colors, setColors] = useState({ ...DEFAULT_COLORS, ...(data.settings?.colors||{}) });
  const setColor = (key, val) => setColors(c=>({...c,[key]:val}));
  const save = () => { update(d=>({...d,settings:{...d.settings,person1:p1.trim()||"Pololo",person2:p2.trim()||"Banana",colors}})); onClose(); };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#1d1733", border:"1px solid rgba(167,139,250,0.3)", borderRadius:18, padding:24, width:"100%", maxWidth:400 }}>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:600, marginBottom:20 }}>⚙️ Configuración</div>
        <div style={{ marginBottom:14 }}>
          <label style={S.label}>Persona 1</label>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input value={p1} onChange={e=>setP1(e.target.value)} style={{ ...S.input, flex:1 }} placeholder="Pololo" />
            <input type="color" value={colors.person1} onChange={e=>setColor("person1",e.target.value)}
              style={{ width:36, height:36, border:"none", borderRadius:8, cursor:"pointer", background:"none", padding:2 }} title="Color persona 1" />
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={S.label}>Persona 2</label>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input value={p2} onChange={e=>setP2(e.target.value)} style={{ ...S.input, flex:1 }} placeholder="Banana" />
            <input type="color" value={colors.person2} onChange={e=>setColor("person2",e.target.value)}
              style={{ width:36, height:36, border:"none", borderRadius:8, cursor:"pointer", background:"none", padding:2 }} title="Color persona 2" />
          </div>
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={S.label}>Actividades juntos</label>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <div style={{ flex:1, fontSize:13, color:"#6b5f88", fontStyle:"italic" }}>Color para actividades en pareja</div>
            <input type="color" value={colors.together} onChange={e=>setColor("together",e.target.value)}
              style={{ width:36, height:36, border:"none", borderRadius:8, cursor:"pointer", background:"none", padding:2 }} title="Color juntos" />
          </div>
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"space-between", alignItems:"center" }}>
          <button onClick={()=>setColors(DEFAULT_COLORS)} style={{ ...S.btnSecondary, fontSize:11 }}>↺ Colores por defecto</button>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={onClose} style={S.btnSecondary}>Cancelar</button>
            <button onClick={save} style={S.btnPrimary}>Guardar ✓</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsView({ weeks, p1, p2, colors, onGoToWeek }) {
  const clr = { ...DEFAULT_COLORS, ...(colors||{}) };
  const [stWho, setStWho] = useState("all");
  const [stRange, setStRange] = useState("all");

  // ── Datos filtrados ──────────────────────────────────────────────────────
  const sortedAll = Object.entries(weeks).sort((a,b)=>a[0].localeCompare(b[0]));
  const rangedEntries = stRange==="all" ? sortedAll : sortedAll.slice(-parseInt(stRange));
  const allW = rangedEntries.map(([,w]) => {
    const ms = stWho==="all" ? (w.missions||[]) : (w.missions||[]).filter(m=>m.who===stWho);
    return { ...w, missions:ms };
  });
  const allM = allW.flatMap(w=>w.missions||[]);
  const total=allM.length, done=allM.filter(m=>m.status==="DONE").length;
  const pct=total>0?Math.round((done/total)*100):0, wc=allW.length;

  const sortedSeries = rangedEntries;
  let bestStreak=0, currStreak=0, currStreakNow=0;
  for (const w of allW) {
    const d=w.missions?.filter(m=>m.status==="DONE").length||0, t=w.missions?.length||0;
    if (t>0 && d===t) { currStreak++; bestStreak=Math.max(bestStreak,currStreak); currStreakNow=currStreak; } else { currStreak=0; }
  }

  const bySt = STATUS_ORDER.map(s => ({ s, count:allM.filter(m=>m.status===s).length }));
  const maxSt = Math.max(...bySt.map(x=>x.count), 1);
  const totalDuration = allM.reduce((s,m)=>s+(m.duration||m.estimatedHours||0),0);
  const catStats = CATEGORIES.map(c => {
    const ms=allM.filter(m=>m.category===c.id);
    return { ...c, dur:ms.reduce((s,m)=>s+(m.duration||m.estimatedHours||0),0), count:ms.length, done:ms.filter(m=>m.status==="DONE").length };
  }).filter(c=>c.count>0).sort((a,b)=>b.count-a.count);
  const ph = key => { const ms=allM.filter(m=>m.who===key); return { count:ms.length, done:ms.filter(m=>m.status==="DONE").length }; };
  const ph1=ph("person1"), ph2=ph("person2"), phT=ph("together");
  const totalWork1=allW.reduce((s,w)=>s+(w.workHours?.person1||0),0), totalWork2=allW.reduce((s,w)=>s+(w.workHours?.person2||0),0);
  const series=allW.map(w=>{ const d=w.missions?.filter(m=>m.status==="DONE").length||0,t=w.missions?.length||0; return { label:`S${w.weekNumber}`, pct:t>0?Math.round((d/t)*100):0, durH:(w.missions||[]).reduce((s,m)=>s+(m.duration||m.estimatedHours||0),0), total:t, done:d, weekNumber:w.weekNumber, year:w.year||new Date().getFullYear() }; });
  const maxH=Math.max(...series.map(s=>s.durH),1);

  // AI Insights
  const insights = [];
  if (series.length>=3) {
    const last3 = series.slice(-3), prev3 = series.slice(-6,-3);
    const avgLast = last3.reduce((s,w)=>s+w.pct,0)/last3.length;
    const avgPrev = prev3.length>0 ? prev3.reduce((s,w)=>s+w.pct,0)/prev3.length : avgLast;
    if (avgLast>avgPrev+10) insights.push({ icon:"📈", title:"Tendencia al alza 🔥", desc:`Últimas 3 semanas promedio: ${Math.round(avgLast)}% — mejorasteis ${Math.round(avgLast-avgPrev)} puntos respecto a las anteriores.` });
    else if (avgLast<avgPrev-10) insights.push({ icon:"📉", title:"Bajada de ritmo", desc:`Últimas 3 semanas al ${Math.round(avgLast)}% vs ${Math.round(avgPrev)}% anteriores. ¡A por todas esta semana!` });
    else insights.push({ icon:"➡️", title:"Ritmo constante", desc:`Mantened el ${Math.round(avgLast)}% de completitud de las últimas semanas. Eso es consistencia 💪` });
  }
  const bestW = allW.reduce((best,w)=>{ const d=w.missions?.filter(m=>m.status==="DONE").length||0,t=w.missions?.length||0,p=t>0?d/t:0; return p>best.p?{p,wn:w.weekNumber,obj:w.epicObjective}:best; },{p:0,wn:0,obj:""});
  if (bestW.wn) insights.push({ icon:"🏆", title:`Mejor semana: la ${bestW.wn}${bestW.obj?` — "${bestW.obj}"`:""}`, desc:`${Math.round(bestW.p*100)}% de completitud. ¡Vuestra semana récord!` });
  if (catStats.length>0) {
    const bestCat = [...catStats].sort((a,b)=>b.done/Math.max(b.count,1)-a.done/Math.max(a.count,1))[0];
    if (bestCat.count>1) insights.push({ icon:bestCat.icon, title:`${bestCat.label}: vuestra categoría estrella`, desc:`${Math.round((bestCat.done/bestCat.count)*100)}% de completitud en ${bestCat.count} misiones. ¡Puntos fuertes!` });
  }
  const totalP1only = ph("person1").count, totalP2only = ph("person2").count;
  if (totalP1only+totalP2only>0) {
    const leadName = totalP1only>totalP2only?p1:p2;
    const leadCount = Math.max(totalP1only,totalP2only);
    const diff = Math.abs(totalP1only-totalP2only);
    if (diff>2) insights.push({ icon:"👫", title:`${leadName} lleva más misiones individuales`, desc:`${leadName} tiene ${leadCount} misiones propias vs ${Math.min(totalP1only,totalP2only)} de la otra persona. ¿Equilibráis?` });
    else insights.push({ icon:"⚖️", title:"Equilibrio perfecto entre vosotros", desc:`Las misiones individuales están muy bien repartidas (${totalP1only} vs ${totalP2only}). ¡Equipo!` });
  }
  if (totalDuration>0) {
    insights.push({ icon:"⏱", title:`${totalDuration.toFixed(1)}h de actividades planificadas`, desc:`Duración total registrada en ${wc} semana${wc!==1?"s":""}.` });
  }
  if (currStreakNow>=2) insights.push({ icon:"🔥", title:`Racha activa: ${currStreakNow} semana${currStreakNow>1?"s":""} al 100%`, desc:`Lleváis ${currStreakNow} semanas seguidas completando todo. ¡Imparables!` });

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
              <div>
                <div style={{ fontSize:13, color:"#e2d9ff", fontWeight:600, marginBottom:2 }}>{ins.title}</div>
                <div style={{ fontSize:12, color:"#8b7fa8", lineHeight:1.5 }}>{ins.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>}

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8 }}>
        {[{label:"Semanas",value:wc,icon:"📅"},{label:"Misiones",value:total,icon:"📝"},{label:"Completadas",value:`${pct}%`,icon:"🏆"},{label:"Racha récord",value:bestStreak>0?`${bestStreak}🔥`:"—",icon:"⚡"}].map(s=>(
          <div key={s.label} style={{ ...S.card, textAlign:"center", padding:"14px 6px" }}>
            <div style={{ fontSize:22, marginBottom:3 }}>{s.icon}</div>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:700, color:"#f8f4ff", lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:9, color:"#6b5f88", textTransform:"uppercase", letterSpacing:1, marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Status donut + bars side by side */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", marginBottom:14, fontWeight:600 }}>📊 Distribución de estados</div>
        <div style={{ display:"flex", gap:16, alignItems:"center" }}>
          {/* Donut SVG */}
          <div style={{ flexShrink:0 }}>
            <svg viewBox="0 0 36 36" width={90} height={90} style={{ transform:"rotate(-90deg)" }}>
              <circle cx="18" cy="18" r={C/(2*Math.PI)*2*Math.PI/C*C} strokeWidth="3.8" fill="none" stroke="rgba(255,255,255,0.05)" r="15.9155"/>
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

      {/* Completion % per week - improved chart */}
      {series.length>1&&<div style={S.card}>
        <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", marginBottom:16, fontWeight:600 }}>✅ Progreso semana a semana</div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:100, paddingBottom:0 }}>
          {series.map((w,i)=>{
            const isLast=i===series.length-1;
            return <div key={w.label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
              <div style={{ fontSize:9, color:isLast?"#f472b6":"#6b5f88", fontWeight:isLast?700:400 }}>{w.pct>0?`${w.pct}%`:""}</div>
              <div style={{ width:"100%", borderRadius:"4px 4px 0 0", minHeight:3, height:`${Math.max(w.pct,3)}%`,
                background:w.pct===100?"linear-gradient(0deg,#34d399,#60a5fa)":isLast?"linear-gradient(0deg,#f472b6,#fb923c)":"linear-gradient(0deg,#f472b6,#a78bfa)",
                opacity:isLast?1:0.7, boxShadow:isLast?"0 0 8px rgba(244,114,182,0.5)":"none" }} />
              <div style={{ fontSize:9, color:isLast?"#f472b6":"#4a4166", fontWeight:isLast?700:400 }}>{w.label}</div>
            </div>;
          })}
        </div>
      </div>}

      {/* Duración por semana */}
      {series.some(s=>s.durH>0)&&<div style={S.card}>
        <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", marginBottom:12, fontWeight:600 }}>⏱ Duración por semana</div>
        <div style={{ textAlign:"center", marginBottom:12 }}>
          <span style={{ fontFamily:"'Fraunces',serif", fontSize:32, fontWeight:700, color:"#60a5fa" }}>{totalDuration.toFixed(1)}h</span>
          <span style={{ fontSize:12, color:"#6b5f88", marginLeft:8 }}>total planificadas</span>
        </div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:70 }}>
          {series.filter(w=>w.durH>0).map(w=>(
            <div key={w.label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
              <div style={{ fontSize:9, color:"#6b5f88" }}>{w.durH>0?`${w.durH}h`:""}</div>
              <div style={{ width:"100%", borderRadius:"3px 3px 0 0", height:`${(w.durH/maxH)*100}%`, background:"rgba(96,165,250,0.6)", minHeight:3 }} />
              <div style={{ fontSize:9, color:"#4a4166" }}>{w.label}</div>
            </div>
          ))}
        </div>
      </div>}

      {/* Per person with mini visual bars */}
      <div style={S.card}>
        <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", marginBottom:14, fontWeight:600 }}>👥 Participación por persona</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[{name:p1,h:ph1,color:"#f472b6"},{name:p2,h:ph2,color:"#a78bfa"},{name:"Juntos",h:phT,color:"#34d399"}].map(({name,h,color})=>{
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

      {/* By category */}
      {catStats.length>0&&<div style={S.card}>
        <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", marginBottom:14, fontWeight:600 }}>🏷️ Por categoría</div>
        {catStats.map(c=>{ const maxC=Math.max(...catStats.map(x=>x.count),1); const cpct=c.count>0?Math.round((c.done/c.count)*100):0; return (
          <div key={c.id} style={{ marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, alignItems:"center" }}>
              <span style={{ fontSize:13, color:c.color, fontWeight:600 }}>{c.icon} {c.label}</span>
              <div style={{ display:"flex", gap:8, fontSize:12, alignItems:"center" }}>
                {c.dur>0&&<span style={{ color:"#60a5fa" }}>⏱ {c.dur}h</span>}
                <span style={{ color:cpct===100?"#34d399":"#6b5f88", fontWeight:600 }}>{c.done}/{c.count} ({cpct}%)</span>
              </div>
            </div>
            <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:99, height:7, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${(c.count/maxC)*100}%`, background:c.color, borderRadius:99, opacity:0.75 }} />
            </div>
          </div>
        );})}
      </div>}

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
    </div>
  );
}

function CalendarView({ allDatedMissions, week, wkey, p1, p2, weeks, colors, onAddForDay, onDownloadICS, onDownloadPDF }) {
  const today=new Date();
  const [calYear,setCalYear]=useState(today.getFullYear());
  const [calMonth,setCalMonth]=useState(today.getMonth());
  const [selectedDay,setSelectedDay]=useState(null);
  const MONTHS=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const DAYS=["L","M","X","J","V","S","D"];
  const prevM=()=>{if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1);setSelectedDay(null);};
  const nextM=()=>{if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1);setSelectedDay(null);};
  const firstDow=(new Date(calYear,calMonth,1).getDay()+6)%7, daysInM=new Date(calYear,calMonth+1,0).getDate();
  const todayStr=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const byDate={};
  allDatedMissions.forEach(m=>{if(!m.date)return;if(!byDate[m.date])byDate[m.date]=[];byDate[m.date].push(m);});
  const cells=[...Array(firstDow).fill(null),...Array.from({length:daysInM},(_,i)=>i+1)];
  const selStr=selectedDay?`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(selectedDay).padStart(2,"0")}`:null;
  const selMs=selStr?(byDate[selStr]||[]):[];
  return (
    <div>
      {/* Download buttons */}
      <div style={{ display:"flex", gap:6, marginBottom:18 }}>
        <button onClick={onDownloadICS} style={{ ...S.btnSecondary, flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"9px 10px", borderColor:"rgba(52,211,153,0.3)", color:"#34d399", fontSize:12 }}>📅 Google Calendar (.ics)</button>
        <button onClick={onDownloadPDF} style={{ ...S.btnSecondary, flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"9px 10px", borderColor:"rgba(167,139,250,0.3)", color:"#a78bfa", fontSize:12 }}>🖨️ PDF semana</button>
      </div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:16, marginBottom:20 }}>
        <button onClick={prevM} style={S.btnNav}>‹</button>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:600, minWidth:180, textAlign:"center" }}>{MONTHS[calMonth]} {calYear}</div>
        <button onClick={nextM} style={S.btnNav}>›</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:4 }}>
        {DAYS.map(d=><div key={d} style={{ textAlign:"center", fontSize:11, color:"#4a4166", fontWeight:600, padding:"4px 0" }}>{d}</div>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
        {cells.map((day,i)=>{
          if(!day)return <div key={`e${i}`}/>;
          const ds=`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const ms=byDate[ds]||[],isTd=ds===todayStr,isSel=day===selectedDay;
          return <div key={day} onClick={()=>setSelectedDay(isSel?null:day)}
            style={{ borderRadius:10, minHeight:54, padding:"5px 4px", cursor:ms.length>0||isTd?"pointer":"default",
              background:isSel?"rgba(167,139,250,0.25)":isTd?"rgba(244,114,182,0.1)":ms.length>0?"rgba(167,139,250,0.07)":"rgba(255,255,255,0.02)",
              border:isSel?"1px solid rgba(167,139,250,0.6)":isTd?"1px solid rgba(244,114,182,0.4)":"1px solid rgba(255,255,255,0.04)",transition:"all 0.15s" }}>
            <div style={{ fontSize:11, fontWeight:600, marginBottom:3, textAlign:"center", color:isTd?"#f472b6":isSel?"#c4b8ff":"#4a4166" }}>{day}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:1, justifyContent:"center" }}>
              {ms.slice(0,4).map(m=><span key={m.id} title={m.title} style={{ fontSize:14, lineHeight:1.2, opacity:m.status==="DONE"?0.35:0.9 }}>{m.emoji}</span>)}
              {ms.length>4&&<span style={{ fontSize:9, color:"#4a4166" }}>+{ms.length-4}</span>}
            </div>
          </div>;
        })}
      </div>
      {selectedDay&&<div style={{ ...S.card, marginTop:16, borderColor:"rgba(167,139,250,0.3)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"#a78bfa", fontWeight:600 }}>{selectedDay} de {MONTHS[calMonth]}</div>
          <div style={{ display:"flex", gap:6 }}>
            {selMs.some(m=>m.date)&&<button onClick={()=>selMs.filter(m=>m.date).forEach((m,i)=>setTimeout(()=>window.open(googleCalendarUrl(m,p1,p2),"_blank"),i*300))} style={{ ...S.btnSecondary, fontSize:11, padding:"5px 10px" }} title="Se pueden bloquear si tienes popups desactivados">📅 Todos al GCal</button>}
            {onAddForDay&&<button onClick={()=>onAddForDay(selStr)} style={{ ...S.btnPrimary, fontSize:11, padding:"5px 10px", display:"flex", alignItems:"center", gap:4 }}>+ Añadir misión</button>}
          </div>
        </div>
        {selMs.length===0?<div style={{ color:"#3d3360", fontStyle:"italic", fontSize:14 }}>Sin misiones asignadas 🙂</div>:
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {selMs.map(m=>{
              const clr = colors || DEFAULT_COLORS;
              const whoColor = m.who==="person1"?clr.person1:m.who==="person2"?clr.person2:clr.together;
              const whoLabel = m.who==="person1"?p1:m.who==="person2"?p2:"Juntos";
              const whoIcon = m.who==="together"?"👫":"🙋";
              const gcalUrl = googleCalendarUrl(m, p1, p2);
              return <div key={m.id} style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                <span style={{ fontSize:22, flexShrink:0, marginTop:2 }}>{m.emoji}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:m.status==="DONE"?"#4d4566":"#e2d9ff", textDecoration:m.status==="DONE"?"line-through":"none" }}>{m.title}</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:3 }}>
                    <span style={{ fontSize:11, color:"#4a4166" }}>S{m.weekNumber}</span>
                    {m.time&&<span style={{ fontSize:11, color:"#a78bfa", fontWeight:600 }}>🕐 {m.time}</span>}
                    {m.category&&<span style={{ fontSize:11, color:"#6b5f88" }}>{CAT_MAP[m.category]?.icon} {CAT_MAP[m.category]?.label}</span>}
                    <span style={{ fontSize:11, background:`${whoColor}18`, color:whoColor, border:`1px solid ${whoColor}40`, padding:"1px 6px", borderRadius:99 }}>{whoIcon} {whoLabel}</span>
                    {gcalUrl&&<a href={gcalUrl} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"#34d399", textDecoration:"none" }} title="Añadir a Google Calendar">📅 GCal</a>}
                  </div>
                </div>
                <span style={badgeStyle(m.status)}>{STATUS[m.status].icon} {STATUS[m.status].label}</span>
              </div>;
            })}
          </div>
        }
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
          <div style={{ display:"flex", flexWrap:"wrap", gap:3, padding:"8px 10px 10px" }}>
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
          <label style={S.label}>Mínimo</label>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <button onClick={()=>setForm(f=>({...f,target:Math.max(1,f.target-1)}))} style={{ ...S.btnSecondary, padding:"4px 10px", fontSize:16 }}>−</button>
            <span style={{ fontFamily:"'Fraunces',serif", fontSize:22, color:"#f8f4ff", minWidth:20, textAlign:"center" }}>{form.target}</span>
            <button onClick={()=>setForm(f=>({...f,target:f.target+1}))} style={{ ...S.btnSecondary, padding:"4px 10px", fontSize:16 }}>+</button>
          </div>
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
  const met = progress.current>=progress.target;
  return (
    <div style={{ ...S.card, borderColor:met?`${clr.together}50`:"rgba(167,139,250,0.12)", transition:"border-color 0.3s" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <span style={{ fontSize:28 }}>{goal.emoji}</span>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:"#f0e8ff" }}>{goal.title}</div>
            <div style={{ display:"flex", gap:5, marginTop:3, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, background:`${whoColor}18`, color:whoColor, border:`1px solid ${whoColor}40`, padding:"1px 6px", borderRadius:99 }}>{whoIcon} {whoLabel}</span>
              <span style={{ fontSize:11, color:"#6b5f88" }}>{PERIOD_EMOJI[goal.period]} {PERIOD_LABEL[goal.period]} · mín. {goal.target}×</span>
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
          <span style={{ color:met?"#34d399":"#f8f4ff", fontWeight:600 }}>{met?"✅ ":""}{progress.current}/{progress.target}</span>
        </div>
        <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:99, height:8, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${progress.pct}%`, background:met?"linear-gradient(90deg,#34d399,#60a5fa)":`linear-gradient(90deg,${whoColor},${whoColor}99)`, borderRadius:99, transition:"width 0.5s" }} />
        </div>
      </div>
      {/* Historial */}
      {history.length>0&&<div>
        <div style={{ fontSize:9, letterSpacing:1.5, textTransform:"uppercase", color:"#4a4166", marginBottom:5 }}>Historial</div>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {history.map((h,i)=>(
            <div key={i} title={`${h.label}: ${h.count}/${goal.target}`}
              style={{ minWidth:28, height:28, borderRadius:7, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontSize:10, gap:1,
                background:h.met?"rgba(52,211,153,0.15)":"rgba(255,255,255,0.04)",
                border:`1px solid ${h.met?"rgba(52,211,153,0.35)":"rgba(255,255,255,0.07)"}`,
                color:h.met?"#34d399":"#4a4166", padding:"0 4px" }}>
              <span style={{ fontSize:11 }}>{h.met?"✅":"·"}</span>
              <span style={{ fontSize:8 }}>{h.label}</span>
            </div>
          ))}
        </div>
      </div>}
    </div>
  );
}

function GoalsView({ goals, weeks, cwn, cyr, p1, p2, colors, onAdd, onUpdate, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [form, setForm] = useState({ emoji:"🏅", title:"", who:"together", period:"monthly", target:1 });

  const openNew = () => { setEditGoal(null); setForm({emoji:"🏅",title:"",who:"together",period:"monthly",target:1}); setShowForm(true); };
  const openEdit = g => { setEditGoal(g); setForm({emoji:g.emoji,title:g.title,who:g.who,period:g.period,target:g.target}); setShowForm(true); };
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
