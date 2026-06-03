import { useState } from "react";
import { S } from "../styles.js";
import { DEFAULT_COLORS, THEMES, FONTS } from "../constants.js";
import { getUserPrefs, saveUserPrefs } from "../lib/userPrefs.js";

export default function ProfileModal({ data, update, onClose, onStartTutorial, sessionUserId, onCheckUpdate, onThemeChange, pushSupported, pushSubscribed, pushLoading, pushError, onPushToggle, onShowWrapped }) {
  const settings = data.settings || {};
  const [p1,      setP1]      = useState(settings.person1||"Persona 1");
  const [p2,      setP2]      = useState(settings.person2||"Persona 2");
  const [bday1,   setBday1]   = useState(settings.person1Birthday||"");
  const [bday2,   setBday2]   = useState(settings.person2Birthday||"");
  const [anniv,   setAnniv]   = useState(settings.anniversaryDate||"");
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

  const compressAvatar = (file) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Tiempo de espera procesando imagen")), 10000);
    const done = (fn) => (...args) => { clearTimeout(timer); fn(...args); };
    const reader = new FileReader();
    reader.onerror = done(() => reject(new Error("No se pudo leer el archivo de imagen")));
    reader.onload = e => {
      const img = new Image();
      img.onerror = done(() => reject(new Error("Formato de imagen no válido")));
      img.onload = done(() => {
        const size = 180;
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        const s = Math.min(img.width, img.height);
        const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      });
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  const handlePhoto = async (key, e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const b64 = await compressAvatar(file);
      setPhotos(p=>({...p,[key]:b64}));
    } catch (err) {
      console.warn("[avatar]", err.message);
    } finally {
      e.target.value = "";
    }
  };

  const requestNotifPermission = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  };

  const extractMMDD = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[1]}-${parts[2]}`;
    return dateStr;
  };

  const save = () => {
    const notifications = { chat: notifChat, partnerChanges: notifPartner, eventReminders: notifEvents, goalDeadlines: notifGoals, dailyBriefing: notifBriefing, briefingTime: notifBriefTime };
    if (sessionUserId) saveUserPrefs(sessionUserId, { themeId, fontId });
    update(d=>({...d, settings:{...d.settings,
      person1:p1.trim()||"Persona 1", person2:p2.trim()||"Persona 2",
      colors, coupleEmoji, photos, notifications,
      person1Birthday: extractMMDD(bday1),
      person2Birthday: extractMMDD(bday2),
      anniversaryDate: anniv || null,
    }}));
    onClose();
  };

  const personRow = (key, label, nameVal, setName) => (
    <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:18 }}>
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
        {/* Hero — foto de pareja grande + nombres */}
        <div style={{ position:"relative", padding:"28px 20px 22px", background:"radial-gradient(120% 100% at 50% 0%, var(--t-accent-soft,rgba(167,139,250,0.18)), transparent 70%)", borderRadius:"20px 20px 0 0", textAlign:"center", flexShrink:0 }}>
          <button onClick={onClose} aria-label="Cerrar" style={{ position:"absolute", top:16, right:16, background:"rgba(128,128,128,0.12)", border:"none", color:"var(--t-text-muted,#8b7fa8)", fontSize:20, width:32, height:32, borderRadius:99, cursor:"pointer", lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
          {/* Drag handle */}
          <div style={{ width:36, height:4, borderRadius:99, background:"rgba(255,255,255,0.15)", margin:"0 auto 20px" }} />
          <label style={{ cursor:"pointer", display:"inline-block", position:"relative" }}>
            <div style={{ width:88, height:88, borderRadius:99, background:"var(--t-accent-soft,rgba(167,139,250,0.12))", border:"2px solid var(--t-accent,#a78bfa)", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", margin:"0 auto", boxShadow:"0 0 0 5px var(--t-accent-soft,rgba(167,139,250,0.1)), 0 8px 24px rgba(0,0,0,0.3)" }}>
              {photos.couple
                ? <img src={photos.couple} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" />
                : <span style={{ fontSize:40 }}>{coupleEmoji}</span>}
            </div>
            <div aria-hidden="true" style={{ position:"absolute", bottom:0, right:"calc(50% - 50px)", width:30, height:30, borderRadius:99, background:"var(--t-accent,#a78bfa)", border:"3px solid var(--t-menu-bg,#0f0a1e)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>📷</div>
            <input type="file" accept="image/*" onChange={e=>handlePhoto("couple",e)} style={{ display:"none" }} />
          </label>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:21, fontWeight:600, color:"#f8f4ff", marginTop:14 }}>{p1} <span style={{ color:"var(--t-accent,#a78bfa)" }}>&</span> {p2}</div>
          <div style={{ fontSize:11.5, color:"var(--t-text-dim,#8b7fa8)", marginTop:3 }}>Toca la foto para cambiarla</div>
          {photos.couple && <button onClick={()=>setPhotos(p=>({...p,couple:null}))} style={{ ...S.btnSecondary, fontSize:11, padding:"4px 12px", marginTop:10 }}>✕ Quitar foto</button>}
        </div>

        <div style={{ overflowY:"auto", padding:"4px 20px 20px", flex:1 }}>

          <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", letterSpacing:2, textTransform:"uppercase", fontWeight:600, marginBottom:8, marginTop:8 }}>Emoji sin foto</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:24 }}>
            {COUPLE_EMOJIS.map(e=>(
              <button key={e} onClick={()=>setCoupleEmoji(e)}
                style={{ fontSize:20, background:coupleEmoji===e?"rgba(167,139,250,0.22)":"rgba(128,128,128,0.06)", border:`1px solid ${coupleEmoji===e?"rgba(167,139,250,0.55)":"rgba(255,255,255,0.08)"}`, borderRadius:9, padding:"5px 7px", cursor:"pointer", lineHeight:1, outline:"none" }}>
                {e}
              </button>
            ))}
          </div>

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

          <div style={{ fontSize:10, color:"#d4a017", letterSpacing:2, textTransform:"uppercase", fontWeight:600, marginBottom:12, marginTop:8 }}>Fechas especiales ✦</div>
          <div style={{ background:"rgba(212,160,23,0.06)", border:"1px solid rgba(212,160,23,0.2)", borderRadius:14, padding:"14px 16px", marginBottom:24 }}>
            <div style={{ fontSize:12, color:"rgba(212,160,23,0.7)", marginBottom:12, lineHeight:1.5 }}>
              En estas fechas la app te sorprende con un momento especial. El año solo importa para el aniversario.
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={{ ...S.label, color:"rgba(212,160,23,0.8)" }}>🎂 Cumpleaños de {p1||"Persona 1"}</label>
              <input type="date" value={bday1 ? `2000-${bday1}` : ""} onChange={e => setBday1(extractMMDD(e.target.value))}
                style={{ ...S.input, colorScheme:"dark" }} />
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={{ ...S.label, color:"rgba(212,160,23,0.8)" }}>🎂 Cumpleaños de {p2||"Persona 2"}</label>
              <input type="date" value={bday2 ? `2000-${bday2}` : ""} onChange={e => setBday2(extractMMDD(e.target.value))}
                style={{ ...S.input, colorScheme:"dark" }} />
            </div>
            <div>
              <label style={{ ...S.label, color:"rgba(212,160,23,0.8)" }}>💍 Aniversario</label>
              <input type="date" value={anniv||""} onChange={e => setAnniv(e.target.value)}
                style={{ ...S.input, colorScheme:"dark" }} />
              <div style={{ fontSize:10, color:"rgba(212,160,23,0.45)", marginTop:4 }}>El año se usa para calcular cuántos años lleváis juntos</div>
            </div>
          </div>

          <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", letterSpacing:2, textTransform:"uppercase", fontWeight:600, marginBottom:12, marginTop:8 }}>Push en segundo plano</div>
          <div style={{ background:"rgba(167,139,250,0.06)", border:"1px solid rgba(167,139,250,0.15)", borderRadius:14, padding:"14px 16px", marginBottom:20 }}>
            {!pushSupported ? (
              <div style={{ fontSize:12, color:"var(--t-text-dim,#6b5f88)" }}>⚠️ Tu navegador no soporta notificaciones push</div>
            ) : (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                <div>
                  <div style={{ fontSize:13, color:"#c4b8ff", fontWeight:500 }}>
                    {pushSubscribed ? "🔔 Activadas en este dispositivo" : "🔕 No activas en este dispositivo"}
                  </div>
                  <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginTop:3 }}>
                    {pushSubscribed
                      ? "Recibirás avisos cuando tu pareja actualice"
                      : "Tu pareja puede estar recibiendo notificaciones — vos no"}
                  </div>
                  {pushError && <div style={{ fontSize:12, color:"#f87171", marginTop:8, padding:"8px 10px", background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.3)", borderRadius:8, lineHeight:1.5 }}>⚠️ {pushError}</div>}
                </div>
                <button onClick={onPushToggle} disabled={pushLoading}
                  style={{ ...S.btnPrimary, fontSize:11, padding:"7px 14px", flexShrink:0, opacity:pushLoading?0.6:1,
                    background: pushSubscribed ? "rgba(244,114,182,0.15)" : undefined,
                    border: pushSubscribed ? "1px solid rgba(244,114,182,0.4)" : undefined,
                    color: pushSubscribed ? "#f472b6" : undefined }}>
                  {pushLoading ? "…" : pushSubscribed ? "Desactivar" : "Activar"}
                </button>
              </div>
            )}
          </div>

          <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", letterSpacing:2, textTransform:"uppercase", fontWeight:600, marginBottom:12, marginTop:8 }}>Notificaciones en app</div>
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

          <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", letterSpacing:2, textTransform:"uppercase", fontWeight:600, marginBottom:10 }}>Tema de la app</div>
          <div style={{ marginBottom:8 }}>
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
          </div>

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
          </div>
        </div>
        <div style={{ padding:"14px 20px", borderTop:"1px solid var(--t-card-border,rgba(167,139,250,0.1))", display:"flex", flexDirection:"column", gap:8 }}>
          {onStartTutorial && <button onClick={onStartTutorial} style={{ ...S.btnSecondary, fontSize:12, textAlign:"center", padding:"8px 14px", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>🎓 Ver tutorial de nuevo</button>}
          {onShowWrapped && <button onClick={()=>{ onClose(); onShowWrapped(); }} style={{ ...S.btnSecondary, fontSize:12, textAlign:"center", padding:"8px 14px", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>📋 Revivir Wrapped (última semana)</button>}
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
