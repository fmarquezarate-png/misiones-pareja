import { useState, useEffect, useCallback } from "react";
import { loadData, saveData } from "./supabase.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const SEED_VERSION = 4;
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
const DEFAULT_SETTINGS = { person1: "Pololo", person2: "Banana" };
const mk = (id, emoji, title, status, completedAt=null) => ({
  id, emoji, title, status, createdAt: 1739059200000, completedAt,
  date: null, time: null, carriedFrom: null, carriedFromWeek: null,
  category: null, who: "together", estimatedHours: null, realHours: null,
});

const SEED = {
  seedVersion: SEED_VERSION,
  currentWeekNumber: 13, currentYear: 2026,
  settings: DEFAULT_SETTINGS,
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
  const [newM, setNewM] = useState({ emoji:"🎯", title:"", status:"TBC", date:"", time:"", category:null, who:"together", estimatedHours:"", realHours:"" });
  const [editObj, setEditObj] = useState(false);
  const [saved, setSaved] = useState(false);
  const [carriedCount, setCarriedCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState(null);

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
  const wkey = isoWeekKey(data.currentWeekNumber, data.currentYear);
  const week = data.weeks[wkey] || { weekNumber:data.currentWeekNumber, year:data.currentYear, epicObjective:"", missions:[], createdAt:Date.now(), workHours:{person1:0,person2:0} };
  const patchWeek = fn => update(d => ({ ...d, weeks: { ...d.weeks, [wkey]: fn(d.weeks[wkey] || week) } }));

  const addMission = () => {
    if (!newM.title.trim()) return;
    patchWeek(w => ({ ...w, missions:[...(w.missions||[]), { id:uid(), emoji:newM.emoji, title:newM.title.trim(), status:newM.status, date:newM.date||null, time:newM.time||null, createdAt:Date.now(), completedAt:null, carriedFrom:null, carriedFromWeek:null, category:newM.category||null, who:newM.who, estimatedHours:newM.estimatedHours?parseFloat(newM.estimatedHours):null, realHours:null }] }));
    setNewM({ emoji:"🎯", title:"", status:"TBC", date:"", time:"", category:null, who:"together", estimatedHours:"", realHours:"" });
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
        const tot = hh*60+mm+Math.round((m.estimatedHours||1)*60);
        const eh = String(Math.floor(tot/60)%24).padStart(2,"0"), em = String(tot%60).padStart(2,"0");
        lines.push(`DTEND:${ds}T${eh}${em}00`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${ds}`);
        const nd = new Date(m.date); nd.setDate(nd.getDate()+1);
        lines.push(`DTEND;VALUE=DATE:${nd.toISOString().slice(0,10).replace(/-/g,"")}`);
      }
      lines.push(`SUMMARY:${m.emoji} ${m.title}`);
      const parts = [`Semana ${weekData.weekNumber}`,`Estado: ${STATUS[m.status]?.label||m.status}`,`Quién: ${who}`];
      if (m.estimatedHours) parts.push(`Estimado: ${m.estimatedHours}h`);
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
  return `<tr><td class="emoji">${m.emoji}</td><td><div class="title${m.status==="DONE"?" done":""}">${m.title}</div>${m.estimatedHours?`<div class="detail">⏱ ${m.estimatedHours}h est.</div>`:""}</td><td style="font-size:13px;color:#555">${when}</td><td style="font-size:13px;color:#555">${who}</td><td><span class="badge ${m.status}">${STATUS[m.status]?.icon||""} ${STATUS[m.status]?.label||m.status}</span></td></tr>`;
}).join("")}
</tbody></table>
<div class="footer">💞 Misiones de Pareja · misiones-pareja.netlify.app</div>
</body></html>`;
    const win = window.open("","_blank");
    win.document.write(html);
    win.document.close();
    setTimeout(()=>win.print(),600);
  };

  const done = week.missions?.filter(m=>m.status==="DONE").length||0;
  const total = week.missions?.length||0;
  const weekEstH = (week.missions||[]).reduce((s,m)=>s+(m.estimatedHours||0),0);
  const weekRealH = (week.missions||[]).reduce((s,m)=>s+(m.realHours||0),0);
  const pct = total>0?(done/total)*100:0;
  const carried = week.missions?.filter(m=>m.carriedFrom)||[];
  const sortedWeeks = Object.entries(data.weeks).sort((a,b)=>b[0].localeCompare(a[0]));
  const allDated = Object.values(data.weeks).flatMap(w=>(w.missions||[]).filter(m=>m.date).map(m=>({...m,weekNumber:w.weekNumber})));

  return (
    <div style={{ minHeight:"100vh", background:"#0a0714", backgroundImage:"radial-gradient(ellipse at 15% 50%,rgba(167,139,250,0.09) 0%,transparent 55%),radial-gradient(ellipse at 85% 20%,rgba(244,114,182,0.08) 0%,transparent 50%)", fontFamily:"'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif", color:"#f8f4ff" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      {showSettings && <SettingsModal data={data} update={update} onClose={()=>setShowSettings(false)} />}

      <div style={{ maxWidth:640, margin:"0 auto", padding:"28px 16px 80px" }}>

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
        <div style={{ display:"flex", gap:3, background:"rgba(255,255,255,0.04)", borderRadius:12, padding:4, marginBottom:22 }}>
          {[{id:"current",label:"🎯 Semana"},{id:"calendar",label:"📅 Calendario"},{id:"history",label:"🗂️ Historial"},{id:"stats",label:"📊 Stats"}].map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ flex:1, padding:"8px 4px", borderRadius:9, border:"none", cursor:"pointer", fontSize:12, fontWeight:500, fontFamily:"inherit", transition:"all 0.2s", background:activeTab===t.id?"rgba(167,139,250,0.18)":"transparent", color:activeTab===t.id?"#c4b8ff":"#6b5f88" }}>{t.label}</button>
          ))}
        </div>

        {/* Current Week */}
        {activeTab==="current" && <div>
          {carriedCount>0 && <div style={{ background:"rgba(251,146,60,0.1)", border:"1px solid rgba(251,146,60,0.25)", borderRadius:12, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:10, fontSize:13 }}>
            <span style={{ fontSize:20 }}>🔁</span>
            <span style={{ color:"#fdba74" }}><strong>{carriedCount} misión{carriedCount>1?"es":""}</strong> arrastrada{carriedCount>1?"s":""} de la semana anterior</span>
          </div>}
          {!isTodayMonday() && carried.length===0 && (
            <button onClick={runCarryOver} style={{ ...S.btnSecondary, width:"100%", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"10px" }}>🔁 Arrastrar pendientes de semana anterior</button>
          )}
          <div style={{ display:"flex", gap:6, marginBottom:10 }}>
            <button onClick={() => downloadWeekICS(week, wkey, p1, p2)} style={{ ...S.btnSecondary, flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"8px 10px", borderColor:"rgba(52,211,153,0.3)", color:"#34d399", fontSize:12 }}>📅 Google Calendar</button>
            <button onClick={() => downloadWeekPDF(week, wkey, p1, p2)} style={{ ...S.btnSecondary, flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"8px 10px", borderColor:"rgba(167,139,250,0.3)", color:"#a78bfa", fontSize:12 }}>🖨️ PDF semana</button>
          </div>
          <WorkHoursCard week={week} patchWeek={patchWeek} p1={p1} p2={p2} />
          {(weekEstH>0||weekRealH>0)&&<div style={{ ...S.card, marginBottom:14, borderColor:"rgba(96,165,250,0.18)", display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", marginBottom:6, fontWeight:600 }}>⏱ Horas esta semana</div>
              <div style={{ display:"flex", gap:14 }}>
                {weekEstH>0&&<div><span style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:700, color:"#60a5fa" }}>{weekEstH.toFixed(1)}h</span><span style={{ fontSize:11, color:"#6b5f88", marginLeft:4 }}>estimadas</span></div>}
                {weekRealH>0&&<div><span style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:700, color:"#34d399" }}>{weekRealH.toFixed(1)}h</span><span style={{ fontSize:11, color:"#6b5f88", marginLeft:4 }}>reales</span></div>}
              </div>
            </div>
            {weekEstH>0&&weekRealH>0&&<div style={{ fontSize:12, color:weekRealH>weekEstH?"#fb923c":"#34d399", fontWeight:600, textAlign:"right", flexShrink:0 }}>
              {weekRealH>weekEstH?`⚠️ +${(weekRealH-weekEstH).toFixed(1)}h`:weekRealH<weekEstH?`✨ -${(weekEstH-weekRealH).toFixed(1)}h`:"💯 Exacto"}
            </div>}
          </div>}
          <div style={{ ...S.card, marginBottom:14, borderColor:"rgba(244,114,182,0.18)" }}>
            <div style={{ fontSize:10, letterSpacing:2.5, textTransform:"uppercase", color:"#f472b6", marginBottom:8, fontWeight:600 }}>🎯 Objetivo épico</div>
            {editObj
              ? <input autoFocus value={week.epicObjective} onChange={e=>patchWeek(w=>({...w,epicObjective:e.target.value}))} onBlur={()=>setEditObj(false)} onKeyDown={e=>e.key==="Enter"&&setEditObj(false)} placeholder="¿Cuál es la misión épica?" style={S.input} />
              : <div onClick={()=>setEditObj(true)} style={{ cursor:"text", fontSize:16, fontFamily:"'Fraunces',serif", fontWeight:300, color:week.epicObjective?"#f8f4ff":"#3d3360", fontStyle:week.epicObjective?"normal":"italic" }}>{week.epicObjective||"Pulsa para añadir el objetivo épico..."}</div>
            }
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {week.missions?.map(m=>(
              <MissionCard key={m.id} mission={m} p1={p1} p2={p2} onCycleStatus={()=>cycleStatus(m.id)} onDelete={()=>delMission(m.id)} onPatch={p=>patchM(m.id,p)} />
            ))}
            {showAddForm
              ? <AddMissionForm newM={newM} setNewM={setNewM} onAdd={addMission} onCancel={()=>setShowAddForm(false)} p1={p1} p2={p2} />
              : <button onClick={()=>setShowAddForm(true)} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"14px", border:"2px dashed rgba(167,139,250,0.2)", borderRadius:13, background:"transparent", color:"#5a4f80", cursor:"pointer", fontSize:14, fontFamily:"inherit" }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(167,139,250,0.45)";e.currentTarget.style.color="#a78bfa";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(167,139,250,0.2)";e.currentTarget.style.color="#5a4f80";}}><span style={{ fontSize:20 }}>+</span> Nueva misión</button>
            }
          </div>
        </div>}

        {activeTab==="calendar" && <CalendarView allDatedMissions={allDated} />}

        {activeTab==="history" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"flex", gap:8, marginBottom:4 }}>
              <button onClick={() => downloadWeekICS(week, wkey, p1, p2)} style={{ ...S.btnSecondary, flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"10px 14px", borderColor:"rgba(52,211,153,0.3)", color:"#34d399" }}>📅 Exportar semana al calendario (.ics)</button>
              <button onClick={() => downloadWeekPDF(week, wkey, p1, p2)} style={{ ...S.btnSecondary, flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"10px 14px", borderColor:"rgba(96,165,250,0.3)", color:"#a78bfa" }}>🖨️ Imprimir / PDF</button>
            </div>
            {sortedWeeks.map(([key,w]) => {
              const d=w.missions?.filter(m=>m.status==="DONE").length||0,t=w.missions?.length||0,p=t>0?Math.round((d/t)*100):0,cur=key===wkey;
              return (
                <div key={key} onClick={()=>{update(s=>({...s,currentWeekNumber:w.weekNumber,currentYear:w.year||s.currentYear}));setActiveTab("current");}}
                  style={{ ...S.card, cursor:"pointer", borderColor:cur?"rgba(167,139,250,0.45)":"rgba(167,139,250,0.1)", background:cur?"#231e3d":"#1d1733" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                    <div style={{ fontFamily:"'Fraunces',serif", fontWeight:600, fontSize:20, display:"flex", alignItems:"center", gap:8 }}>Semana {w.weekNumber}{cur&&<span style={{ fontSize:10, color:"#a78bfa", background:"rgba(167,139,250,0.15)", padding:"2px 7px", borderRadius:99, fontFamily:"inherit", fontWeight:600 }}>ACTUAL</span>}</div>
                    <div style={{ fontSize:14, color:p===100?"#34d399":"#8b7fa8", fontWeight:600 }}>{d}/{t} {p===100?"🏆":`${p}%`}</div>
                  </div>
                  {w.epicObjective&&<div style={{ fontSize:13, color:"#9d8fc4", marginBottom:8, fontStyle:"italic", fontFamily:"'Fraunces',serif" }}>"{w.epicObjective}"</div>}
                  <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:99, height:4, marginBottom:8 }}>
                    <div style={{ height:"100%", width:`${p}%`, borderRadius:99, background:p===100?"linear-gradient(90deg,#34d399,#60a5fa)":"linear-gradient(90deg,#f472b6,#a78bfa)" }} />
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {w.missions?.slice(0,7).map(m=><span key={m.id} style={{ fontSize:12, color:m.status==="DONE"?"#4d4566":"#8b7fa8", textDecoration:m.status==="DONE"?"line-through":"none" }}>{m.emoji} {m.title.slice(0,20)}{m.title.length>20?"…":""}</span>)}
                    {(w.missions?.length||0)>7&&<span style={{ fontSize:12, color:"#3d3360" }}>+{w.missions.length-7} más</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab==="stats" && <StatsView weeks={data.weeks} p1={p1} p2={p2} />}
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

function AddMissionForm({ newM, setNewM, onAdd, onCancel, p1, p2 }) {
  const WHO = [{ id:"together",label:"Juntos",icon:"👫"},{id:"person1",label:p1,icon:"🙋"},{id:"person2",label:p2,icon:"🙋"}];
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
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginBottom:10 }}>
        <div><label style={S.label}>📆 Fecha</label><input type="date" value={newM.date} onChange={e=>setNewM(p=>({...p,date:e.target.value}))} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
        <div><label style={S.label}>🕐 Hora</label><input type="time" value={newM.time} onChange={e=>setNewM(p=>({...p,time:e.target.value}))} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
        <div><label style={S.label}>⏱ Est. (h)</label><input type="number" min="0" step="0.5" value={newM.estimatedHours} onChange={e=>setNewM(p=>({...p,estimatedHours:e.target.value}))} placeholder="0" style={S.inputSm} /></div>
        <div><label style={S.label}>✅ Real (h)</label><input type="number" min="0" step="0.5" value={newM.realHours} onChange={e=>setNewM(p=>({...p,realHours:e.target.value}))} placeholder="0" style={S.inputSm} /></div>
      </div>
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

function MissionCard({ mission, onCycleStatus, onDelete, onPatch, p1, p2 }) {
  const [expanded, setExpanded] = useState(false);
  const isDone = mission.status==="DONE", isCarried = !!mission.carriedFrom;
  const cat = mission.category ? CAT_MAP[mission.category] : null;
  const WHO = [{ id:"together",label:"Juntos",icon:"👫"},{id:"person1",label:p1,icon:"🙋"},{id:"person2",label:p2,icon:"🙋"}];
  return (
    <div style={{ ...S.card, borderColor:isDone?"rgba(52,211,153,0.15)":isCarried?"rgba(251,146,60,0.2)":"rgba(167,139,250,0.12)", opacity:isDone?0.78:1, transition:"all 0.25s" }}>
      {isCarried&&!isDone&&<div style={{ fontSize:10, color:"#fb923c", letterSpacing:1, marginBottom:6 }}>🔁 Arrastrada</div>}
      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
        <EmojiSelect value={mission.emoji} onChange={e=>onPatch({emoji:e})} />
        <div style={{ flex:1, minWidth:0, cursor:"pointer" }} onClick={()=>setExpanded(v=>!v)}>
          <div style={{ fontSize:14, fontWeight:500, lineHeight:1.4, color:isDone?"#6b5f88":"#f0e8ff", textDecoration:isDone?"line-through":"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={mission.title}>{mission.title}</div>
          <div style={{ display:"flex", gap:4, marginTop:4, flexWrap:"wrap" }}>
            {cat&&<span style={catBadgeStyle(cat.id)}>{cat.icon} {cat.label}</span>}
            {mission.who&&mission.who!=="together"&&<span style={{ background:"rgba(167,139,250,0.1)", color:"#a78bfa", border:"1px solid rgba(167,139,250,0.2)", padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600 }}>🙋 {mission.who==="person1"?p1:p2}</span>}
            {mission.estimatedHours&&<span style={{ background:"rgba(96,165,250,0.08)", color:"#60a5fa", border:"1px solid rgba(96,165,250,0.2)", padding:"2px 7px", borderRadius:99, fontSize:11 }}>⏱ {mission.estimatedHours}h est.</span>}
            {mission.realHours&&<span style={{ background:"rgba(52,211,153,0.08)", color:"#34d399", border:"1px solid rgba(52,211,153,0.2)", padding:"2px 7px", borderRadius:99, fontSize:11 }}>✅ {mission.realHours}h</span>}
            {mission.date&&<span style={{ background:"rgba(255,255,255,0.05)", color:"#6b5f88", border:"1px solid rgba(255,255,255,0.08)", padding:"2px 7px", borderRadius:99, fontSize:11 }}>📆 {mission.date}{mission.time?` · 🕐 ${mission.time}`:""}</span>}
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
              {WHO.map(w=><button key={w.id} onClick={()=>onPatch({who:w.id})} style={{ background:mission.who===w.id?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.04)", border:`1px solid ${mission.who===w.id?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`, borderRadius:8, color:mission.who===w.id?"#c4b8ff":"#6b5f88", padding:"5px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>{w.icon} {w.label}</button>)}
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8 }}>
            <div><label style={S.label}>📆 Fecha</label><input type="date" value={mission.date||""} onChange={e=>onPatch({date:e.target.value||null})} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
            <div><label style={S.label}>🕐 Hora</label><input type="time" value={mission.time||""} onChange={e=>onPatch({time:e.target.value||null})} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
            <div><label style={S.label}>⏱ Est. (h)</label><input type="number" min="0" step="0.5" value={mission.estimatedHours||""} onChange={e=>onPatch({estimatedHours:parseFloat(e.target.value)||null})} placeholder="0" style={S.inputSm} /></div>
            <div><label style={S.label}>✅ Real (h)</label><input type="number" min="0" step="0.5" value={mission.realHours||""} onChange={e=>onPatch({realHours:parseFloat(e.target.value)||null})} placeholder="0" style={S.inputSm} /></div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsModal({ data, update, onClose }) {
  const [p1, setP1] = useState(data.settings?.person1||"Pololo");
  const [p2, setP2] = useState(data.settings?.person2||"Banana");
  const save = () => { update(d=>({...d,settings:{...d.settings,person1:p1.trim()||"Pololo",person2:p2.trim()||"Banana"}})); onClose(); };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#1d1733", border:"1px solid rgba(167,139,250,0.3)", borderRadius:18, padding:24, width:"100%", maxWidth:380 }}>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:600, marginBottom:20 }}>⚙️ Configuración</div>
        <div style={{ marginBottom:14 }}><label style={S.label}>Nombre persona 1</label><input value={p1} onChange={e=>setP1(e.target.value)} style={S.input} placeholder="Pololo" /></div>
        <div style={{ marginBottom:20 }}><label style={S.label}>Nombre persona 2</label><input value={p2} onChange={e=>setP2(e.target.value)} style={S.input} placeholder="Banana" /></div>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={S.btnSecondary}>Cancelar</button>
          <button onClick={save} style={S.btnPrimary}>Guardar ✓</button>
        </div>
      </div>
    </div>
  );
}

function StatsView({ weeks, p1, p2 }) {
  const allW = Object.values(weeks), allM = allW.flatMap(w=>w.missions||[]);
  const total=allM.length, done=allM.filter(m=>m.status==="DONE").length;
  const pct=total>0?Math.round((done/total)*100):0, wc=allW.length;

  const sortedSeries = Object.entries(weeks).sort((a,b)=>a[0].localeCompare(b[0]));
  let bestStreak=0, currStreak=0, currStreakNow=0;
  for (const [,w] of sortedSeries) {
    const d=w.missions?.filter(m=>m.status==="DONE").length||0, t=w.missions?.length||0;
    if (t>0 && d===t) { currStreak++; bestStreak=Math.max(bestStreak,currStreak); currStreakNow=currStreak; } else { currStreak=0; }
  }

  const bySt = STATUS_ORDER.map(s => ({ s, count:allM.filter(m=>m.status===s).length }));
  const maxSt = Math.max(...bySt.map(x=>x.count), 1);
  const totalEst = allM.reduce((s,m)=>s+(m.estimatedHours||0),0);
  const totalReal = allM.reduce((s,m)=>s+(m.realHours||0),0);
  const catStats = CATEGORIES.map(c => {
    const ms=allM.filter(m=>m.category===c.id);
    return { ...c, real:ms.reduce((s,m)=>s+(m.realHours||0),0), est:ms.reduce((s,m)=>s+(m.estimatedHours||0),0), count:ms.length, done:ms.filter(m=>m.status==="DONE").length };
  }).filter(c=>c.count>0).sort((a,b)=>b.count-a.count);
  const ph = key => { const ms=allM.filter(m=>m.who===key); return { count:ms.length, done:ms.filter(m=>m.status==="DONE").length }; };
  const ph1=ph("person1"), ph2=ph("person2"), phT=ph("together");
  const totalWork1=allW.reduce((s,w)=>s+(w.workHours?.person1||0),0), totalWork2=allW.reduce((s,w)=>s+(w.workHours?.person2||0),0);
  const series=sortedSeries.map(([,w])=>{ const d=w.missions?.filter(m=>m.status==="DONE").length||0,t=w.missions?.length||0; return { label:`S${w.weekNumber}`, pct:t>0?Math.round((d/t)*100):0, realH:(w.missions||[]).reduce((s,m)=>s+(m.realHours||0),0), estH:(w.missions||[]).reduce((s,m)=>s+(m.estimatedHours||0),0), total:t, done:d }; });
  const maxH=Math.max(...series.map(s=>Math.max(s.realH,s.estH)),1);

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
  const bestW = sortedSeries.reduce((best,[k,w])=>{ const d=w.missions?.filter(m=>m.status==="DONE").length||0,t=w.missions?.length||0,p=t>0?d/t:0; return p>best.p?{p,wn:w.weekNumber,obj:w.epicObjective}:best; },{p:0,wn:0,obj:""});
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
  if (totalEst>0&&totalReal>0) {
    const eff = Math.round((totalReal/totalEst)*100);
    insights.push({ icon:"⏱", title:`Eficiencia temporal: ${eff}%`, desc:eff>120?`Tardáis un ${eff-100}% más de lo esperado. Intentad ser más realistas al estimar.`:eff<80?`Sois más rápidos de lo que estimáis 🚀 (${100-eff}% menos tiempo del esperado).`:`Estimáis el tiempo con mucha precisión. Casi perfectos! 🎯` });
  }
  if (currStreakNow>=2) insights.push({ icon:"🔥", title:`Racha activa: ${currStreakNow} semana${currStreakNow>1?"s":""} al 100%`, desc:`Lleváis ${currStreakNow} semanas seguidas completando todo. ¡Imparables!` });

  if(total===0) return <div style={{ textAlign:"center", color:"#3d3360", padding:50 }}><div style={{ fontSize:40, marginBottom:12 }}>📊</div><div style={{ fontStyle:"italic" }}>Sin datos aún.</div></div>;

  // Donut chart for status
  const donutTotal = bySt.reduce((s,x)=>s+x.count,0);
  let donutOffset=0;
  const donutSegments = bySt.filter(x=>x.count>0).map(({s,count})=>{ const pct2=(count/donutTotal)*100; const seg={s,pct:pct2,offset:donutOffset}; donutOffset+=pct2; return seg; });
  const C=15.9155, R=5; // SVG circumference helper

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

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

      {/* Est vs Real + horas por semana */}
      {(totalEst>0||totalReal>0)&&<div style={S.card}>
        <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", marginBottom:12, fontWeight:600 }}>⏱ Horas estimadas vs reales</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
          {[{label:"Estimadas",val:totalEst,color:"#60a5fa"},{label:"Reales",val:totalReal,color:"#34d399"}].map(({label,val,color})=>(
            <div key={label} style={{ background:`${color}10`, border:`1px solid ${color}25`, borderRadius:10, padding:"12px", textAlign:"center" }}>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:700, color }}>{val.toFixed(1)}h</div>
              <div style={{ fontSize:11, color:"#6b5f88", marginTop:3 }}>{label}</div>
            </div>
          ))}
        </div>
        {totalEst>0&&totalReal>0&&<>
          <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:8, height:10, overflow:"hidden", marginBottom:6, position:"relative" }}>
            <div style={{ position:"absolute", height:"100%", width:`${Math.min((totalReal/totalEst)*100,100)}%`, background:totalReal>totalEst?"linear-gradient(90deg,#fb923c,#f472b6)":"linear-gradient(90deg,#34d399,#60a5fa)", borderRadius:8 }} />
            <div style={{ position:"absolute", height:"100%", width:2, left:`${Math.min((totalEst/(Math.max(totalEst,totalReal)))*100,100)}%`, background:"rgba(255,255,255,0.3)" }} />
          </div>
          <div style={{ fontSize:12, color:"#8b7fa8", textAlign:"center" }}>
            {totalReal>totalEst?`⚠️ ${(totalReal-totalEst).toFixed(1)}h más de lo esperado (${Math.round((totalReal/totalEst)*100)}%)`
              :totalReal<totalEst?`✨ ${(totalEst-totalReal).toFixed(1)}h menos de lo esperado (${Math.round((totalReal/totalEst)*100)}%)`
              :"💯 Estimación perfecta"}
          </div>
        </>}
        {/* Horas por semana dual bar */}
        {series.some(s=>s.realH>0||s.estH>0)&&<>
          <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#6b5f88", marginTop:14, marginBottom:10, fontWeight:600 }}>Horas por semana</div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:70 }}>
            {series.filter(w=>w.estH>0||w.realH>0).map(w=>(
              <div key={w.label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                <div style={{ width:"100%", display:"flex", gap:1, alignItems:"flex-end", height:56 }}>
                  {w.estH>0&&<div style={{ flex:1, borderRadius:"3px 3px 0 0", height:`${(w.estH/maxH)*100}%`, background:"rgba(96,165,250,0.5)", minHeight:3 }} title={`${w.estH}h est.`} />}
                  {w.realH>0&&<div style={{ flex:1, borderRadius:"3px 3px 0 0", height:`${(w.realH/maxH)*100}%`, background:"rgba(52,211,153,0.7)", minHeight:3 }} title={`${w.realH}h real`} />}
                </div>
                <div style={{ fontSize:9, color:"#4a4166" }}>{w.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop:6 }}>
            <span style={{ fontSize:10, color:"rgba(96,165,250,0.8)" }}>■ Estimadas</span>
            <span style={{ fontSize:10, color:"rgba(52,211,153,0.8)" }}>■ Reales</span>
          </div>
        </>}
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
                {c.real>0&&<span style={{ color:"#34d399" }}>{c.real}h real</span>}
                {c.est>0&&<span style={{ color:"#60a5fa" }}>~{c.est}h est.</span>}
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

function CalendarView({ allDatedMissions }) {
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
        <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"#a78bfa", marginBottom:12, fontWeight:600 }}>{selectedDay} de {MONTHS[calMonth]}</div>
        {selMs.length===0?<div style={{ color:"#3d3360", fontStyle:"italic", fontSize:14 }}>Sin misiones asignadas 🙂</div>:
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {selMs.map(m=><div key={m.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:22, flexShrink:0 }}>{m.emoji}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, color:m.status==="DONE"?"#4d4566":"#e2d9ff", textDecoration:m.status==="DONE"?"line-through":"none" }}>{m.title}</div>
                <div style={{ fontSize:11, color:"#4a4166" }}>Semana {m.weekNumber}{m.time?<span style={{ color:"#a78bfa", fontWeight:600 }}> · 🕐 {m.time}</span>:""}{m.category?` · ${CAT_MAP[m.category]?.icon} ${CAT_MAP[m.category]?.label}`:""}</div>
              </div>
              <span style={badgeStyle(m.status)}>{STATUS[m.status].icon} {STATUS[m.status].label}</span>
            </div>)}
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
