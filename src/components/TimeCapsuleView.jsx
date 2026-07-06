import { useState } from "react";
import { S } from "../styles.js";
import { localDateStr } from "../utils.js";

// Cápsula del tiempo: mensajes/fotos escritos hoy que se abren en una fecha
// futura (aniversario, cumpleaños, "dentro de un año"). Una vez sellada, nadie
// puede abrirla antes de tiempo — ni siquiera quien la escribió.
export default function TimeCapsuleView({ capsules = [], p1, p2, colors, sessionPersonId, anniversaryDate, onCreate, onDelete, onView }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [photo, setPhoto] = useState(null);
  const [unlockDate, setUnlockDate] = useState("");
  const [compressing, setCompressing] = useState(false);

  const today = localDateStr();
  const sealed   = capsules.filter(c => c.unlockDate > today).sort((a, b) => a.unlockDate.localeCompare(b.unlockDate));
  const openable = capsules.filter(c => c.unlockDate <= today && !c.viewedAt);
  const opened   = capsules.filter(c => c.unlockDate <= today && c.viewedAt).sort((a, b) => b.unlockDate.localeCompare(a.unlockDate));

  const nextAnniversaryDate = () => {
    if (!anniversaryDate) return "";
    const mmdd = anniversaryDate.slice(5);
    const y = new Date().getFullYear();
    const candidate = `${y}-${mmdd}`;
    return candidate > today ? candidate : `${y + 1}-${mmdd}`;
  };

  const personName = who => who === "person1" ? p1 : who === "person2" ? p2 : "Los dos";
  const personColor = who => who === "person1" ? colors.person1 : who === "person2" ? colors.person2 : colors.together;

  const daysUntil = date => Math.ceil((new Date(date + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000);

  const handlePhoto = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    setCompressing(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
        reader.onload = ev => {
          const img = new Image();
          img.onerror = () => reject(new Error("Formato de imagen no válido"));
          img.onload = () => {
            const maxPx = 800;
            const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
            const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            canvas.getContext("2d").drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", 0.75));
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      });
      setPhoto(dataUrl);
    } catch { /* silencioso — el usuario simplemente no ve preview y puede reintentar */ }
    finally { setCompressing(false); e.target.value = ""; }
  };

  const resetForm = () => { setTitle(""); setMessage(""); setPhoto(null); setUnlockDate(""); setShowForm(false); };

  const submit = () => {
    if (!message.trim() || !unlockDate || unlockDate <= today) return;
    onCreate({
      title: title.trim(), message: message.trim(), photo,
      unlockDate, from: sessionPersonId || "together",
    });
    resetForm();
  };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:700, color:"var(--t-text,#f8f4ff)" }}>✉️ Cápsula del tiempo</div>
        {!showForm && (
          <button onClick={() => { setShowForm(true); setUnlockDate(nextAnniversaryDate()); }}
            style={{ background:"var(--t-btn-grad,linear-gradient(135deg,#f472b6,#a78bfa))", border:"none", borderRadius:12, color:"#fff", padding:"8px 16px", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600 }}>
            + Nueva
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ ...S.card, marginBottom:18, borderColor:"rgba(167,139,250,0.3)" }}>
          <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", lineHeight:1.6, marginBottom:12, fontStyle:"italic" }}>
            Escribe algo para leer en el futuro. Una vez sellada, nadie puede abrirla antes de la fecha — ni tú.
          </div>
          <div style={{ marginBottom:10 }}>
            <label style={S.label}>Título (opcional)</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Para nuestro 5º aniversario" style={S.input} maxLength={80} />
          </div>
          <div style={{ marginBottom:10 }}>
            <label style={S.label}>Mensaje</label>
            <textarea value={message} onChange={e => setMessage(e.target.value.slice(0, 2000))} placeholder="Lo que quieras decirle a quien lea esto en el futuro…"
              rows={5} style={{ ...S.input, resize:"vertical", fontFamily:"inherit" }} />
            <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", textAlign:"right", marginTop:2 }}>{message.length}/2000</div>
          </div>
          <div style={{ marginBottom:10 }}>
            <label style={S.label}>Foto (opcional)</label>
            {photo ? (
              <div style={{ position:"relative", display:"inline-block" }}>
                <img src={photo} alt="" style={{ width:100, height:100, objectFit:"cover", borderRadius:10, border:"1px solid rgba(167,139,250,0.25)" }} />
                <button onClick={() => setPhoto(null)} style={{ position:"absolute", top:-6, right:-6, background:"#1d1733", border:"1px solid rgba(255,255,255,0.15)", borderRadius:99, width:22, height:22, color:"#f472b6", cursor:"pointer", fontSize:13, lineHeight:1 }}>×</button>
              </div>
            ) : (
              <label style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(128,128,128,0.08)", border:"1px dashed rgba(167,139,250,0.3)", borderRadius:10, padding:"9px 14px", cursor:"pointer", fontSize:12, color:"var(--t-text-muted,#8b7fa8)" }}>
                {compressing ? "Procesando…" : "📷 Añadir foto"}
                <input type="file" accept="image/*" onChange={handlePhoto} disabled={compressing} style={{ display:"none" }} />
              </label>
            )}
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={S.label}>Se abre el</label>
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              <input type="date" value={unlockDate} min={today} onChange={e => setUnlockDate(e.target.value)} style={{ ...S.inputSm, colorScheme:"dark", width:160 }} />
              {anniversaryDate && (
                <button onClick={() => setUnlockDate(nextAnniversaryDate())}
                  style={{ background:"rgba(212,160,23,0.1)", border:"1px solid rgba(212,160,23,0.3)", borderRadius:8, color:"#d4a017", padding:"5px 10px", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>
                  💍 Próximo aniversario
                </button>
              )}
            </div>
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button onClick={resetForm} style={S.btnSecondary}>Cancelar</button>
            <button onClick={submit} disabled={!message.trim() || !unlockDate || unlockDate <= today} style={{ ...S.btnPrimary, opacity:(!message.trim()||!unlockDate||unlockDate<=today)?0.5:1 }}>🔒 Sellar cápsula</button>
          </div>
        </div>
      )}

      {openable.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:"#fbbf24", fontWeight:700, marginBottom:8 }}>🎁 Listas para abrir</div>
          {openable.map(c => (
            <button key={c.id} onClick={() => onView(c.id)}
              style={{ display:"flex", alignItems:"center", gap:10, width:"100%", background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.4)", borderRadius:14, padding:"14px 16px", marginBottom:8, cursor:"pointer", fontFamily:"inherit", textAlign:"left", animation:"tc-pulse 2s ease-in-out infinite" }}>
              <span style={{ fontSize:26 }}>🎁</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color:"#fbbf24" }}>{c.title || "Una cápsula del tiempo"}</div>
                <div style={{ fontSize:11, color:"rgba(251,191,36,0.7)" }}>Escrita por {personName(c.from)} · lista desde hoy</div>
              </div>
              <span style={{ fontSize:11, color:"#fbbf24", fontWeight:700 }}>Abrir →</span>
            </button>
          ))}
          <style>{`@keyframes tc-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(251,191,36,0.3);} 50%{box-shadow:0 0 0 6px rgba(251,191,36,0.08);} }`}</style>
        </div>
      )}

      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:8 }}>🔒 Selladas ({sealed.length})</div>
        {sealed.length === 0 ? (
          <div style={{ fontSize:12, color:"var(--t-text-dim,#4a4166)", fontStyle:"italic" }}>No hay cápsulas esperando su fecha.</div>
        ) : sealed.map(c => {
          const d = daysUntil(c.unlockDate);
          return (
            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(128,128,128,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"10px 14px", marginBottom:6 }}>
              <span style={{ fontSize:20, flexShrink:0 }}>🔒</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, color:"var(--t-text,#f0e8ff)", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.title || "Cápsula sellada"}</div>
                <div style={{ fontSize:11, color:personColor(c.from) }}>{personName(c.from)} · se abre el {c.unlockDate} ({d===1?"mañana":`en ${d} días`})</div>
              </div>
              {c.from === sessionPersonId && (
                <button onClick={() => onDelete(c.id)} title="Eliminar (solo tú puedes borrar la tuya antes de que se abra)"
                  style={{ background:"none", border:"none", color:"var(--t-text-dim,#3d3360)", cursor:"pointer", fontSize:16, flexShrink:0 }}>×</button>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <div style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:8 }}>📖 Abiertas ({opened.length})</div>
        {opened.length === 0 ? (
          <div style={{ fontSize:12, color:"var(--t-text-dim,#4a4166)", fontStyle:"italic" }}>Todavía no se abrió ninguna.</div>
        ) : opened.map(c => (
          <button key={c.id} onClick={() => onView(c.id)}
            style={{ display:"flex", alignItems:"center", gap:10, width:"100%", background:"rgba(128,128,128,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"10px 14px", marginBottom:6, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
            <span style={{ fontSize:20, flexShrink:0 }}>{c.photo ? "🖼️" : "💌"}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, color:"var(--t-text,#f0e8ff)", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.title || "Cápsula del tiempo"}</div>
              <div style={{ fontSize:11, color:personColor(c.from) }}>{personName(c.from)} · abierta el {c.unlockDate}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
