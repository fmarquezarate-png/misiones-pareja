import { useState, useMemo, useEffect } from "react";
import { S } from "../styles.js";
import { dlBlob } from "../utils.js";

// Exportar disponibilidad: calendario verde/rojo entre dos fechas para
// coordinar partidos (liga de pádel) con los rivales. El cálculo automático
// se corrige con un toque por día (override manual) antes de exportar.

const pad2 = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseYmd = s => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, m - 1, dd); };
const DAYS_ES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const CFG_KEY = "mp-avail-cfg";

// "HH:MM" ± minutos → "HH:MM" (acotado a 00:00–23:59, no cruza de día)
const addMin = (hhmm, min) => {
  const [h, m] = hhmm.split(":").map(Number);
  const t = Math.max(0, Math.min(h * 60 + m + min, 23 * 60 + 59));
  return `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`;
};
// Duración asumida cuando un evento tiene hora de inicio pero ni fin ni duración
const DEFAULT_EVENT_MIN = 60;

const defaultFrom = () => ymd(new Date());
const defaultTo = () => { const d = new Date(); d.setDate(d.getDate() + 13); return ymd(d); };

export default function AvailabilityExport({ weeks, p1, p2, colors, onClose }) {
  const savedCfg = (() => { try { return JSON.parse(localStorage.getItem(CFG_KEY) || "{}"); } catch { return {}; } })();
  const [from, setFrom] = useState(defaultFrom);
  const [to,   setTo]   = useState(defaultTo);
  // Franja de juego: [winFrom, winTo]. Un día está OCUPADO si alguna actividad
  // SE SOLAPA con esa franja — no si "empieza después de X" (modelo anterior,
  // que marcaba libre un evento de 19:00–20:30 con corte a las 19:30 porque
  // solo miraba la hora de inicio, ignorando que el evento invade la franja).
  // savedCfg.cutoff: migración de la config vieja → franja "desde".
  const [winFrom, setWinFrom] = useState(savedCfg.winFrom ?? savedCfg.cutoff ?? "");
  const [winTo,   setWinTo]   = useState(savedCfg.winTo ?? "");
  const [noTimeBlocks, setNoTimeBlocks] = useState(savedCfg.noTimeBlocks ?? true);
  const [includeTasks, setIncludeTasks] = useState(savedCfg.includeTasks ?? false);
  // De quién es la disponibilidad: "together" = liga mixta (ambas agendas cuentan),
  // "person1"/"person2" = liga individual (solo su agenda + eventos juntos)
  const [who, setWho] = useState(savedCfg.who ?? "together");
  const [overrides, setOverrides] = useState({}); // ymd -> boolean (free) — solo esta sesión
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(CFG_KEY, JSON.stringify({ winFrom, winTo, noTimeBlocks, includeTasks, who })); } catch { /* modo privado */ }
  }, [winFrom, winTo, noTimeBlocks, includeTasks, who]);

  const winStart = winFrom || "00:00";
  const winEnd   = winTo   || "23:59";

  // Qué bloquea cada día según los parámetros elegidos
  const blockersByDay = useMemo(() => {
    const map = {};
    for (const w of Object.values(weeks || {})) {
      for (const m of (w.missions || [])) {
        if (!m.date || m.status === "DONE") continue;
        const isEvent = m.type === "event";
        if (!isEvent && !includeTasks) continue;
        // Liga individual: los eventos solo del otro no ocupan mi calendario.
        // Los "juntos" ocupan siempre; en mixto ("together") ocupa todo.
        if (who !== "together" && m.who !== "together" && m.who !== who) continue;
        const spanEnd = (isEvent && m.endDate && m.endDate > m.date) ? m.endDate : m.date;
        let d = parseYmd(m.date);
        const endD = parseYmd(spanEnd);
        let guard = 0;
        while (d <= endD && guard < 60) {
          const key = ymd(d);
          const isStartDay = key === m.date;
          const isEndDay   = key === spanEnd;
          // Rango horario que la actividad ocupa EN ESTE día concreto:
          //  - día de inicio: desde su hora hasta su fin (endTime si es el mismo
          //    día; si sigue al día siguiente, hasta 23:59; sin fin conocido,
          //    inicio + duración, o 1h asumida)
          //  - días intermedios de un multi-día: 00:00–23:59
          //  - día final de un multi-día: 00:00 hasta su endTime
          //  - sin hora: día completo (si el toggle lo permite)
          let evStart, evEnd;
          if (!m.time && isStartDay) {
            if (!noTimeBlocks) { d.setDate(d.getDate() + 1); guard++; continue; }
            evStart = "00:00"; evEnd = "23:59";
          } else if (isStartDay) {
            evStart = m.time;
            const sameDayEnd = m.endTime && (!m.endDate || m.endDate === m.date);
            evEnd = spanEnd > m.date ? "23:59"
              : sameDayEnd ? m.endTime
              : m.duration ? addMin(m.time, m.duration)
              : addMin(m.time, DEFAULT_EVENT_MIN);
          } else if (isEndDay) {
            evStart = "00:00"; evEnd = m.endTime || "23:59";
          } else {
            evStart = "00:00"; evEnd = "23:59";
          }
          // Solape de intervalos: la actividad ocupa el día si su rango horario
          // se cruza con la franja de juego
          const blocks = evStart < winEnd && evEnd > winStart;
          if (blocks) (map[key] = map[key] || []).push({ emoji: m.emoji, title: m.title, range: m.time ? `${evStart}–${evEnd}` : null });
          d.setDate(d.getDate() + 1); guard++;
        }
      }
    }
    return map;
  }, [weeks, includeTasks, winStart, winEnd, noTimeBlocks, who]);

  const days = useMemo(() => {
    const out = [];
    if (!from || !to || from > to) return out;
    let d = parseYmd(from);
    const endD = parseYmd(to);
    let guard = 0;
    while (d <= endD && guard < 92) { out.push(ymd(d)); d.setDate(d.getDate() + 1); guard++; }
    return out;
  }, [from, to]);

  const isFree = key => overrides[key] ?? !(blockersByDay[key]?.length > 0);
  const toggleDay = key => setOverrides(o => ({ ...o, [key]: !isFree(key) }));

  const freeCount = days.filter(isFree).length;
  const lead = days.length ? (parseYmd(days[0]).getDay() + 6) % 7 : 0; // lunes = 0

  const whoTitle = who === "person1" ? p1 : who === "person2" ? p2 : `${p1} & ${p2}`;

  const dayLabel = key => {
    const d = parseYmd(key);
    return `${DAYS_ES[d.getDay()]} ${d.getDate()} ${MONTHS_ES[d.getMonth()]}`;
  };
  const rangeLabel = days.length
    ? `${dayLabel(days[0])} — ${dayLabel(days[days.length - 1])} ${parseYmd(days[days.length - 1]).getFullYear()}`
    : "";
  // La franja horaria considerada va SIEMPRE visible en lo que se comparte
  // (imagen y texto) — sin esto, quien recibe el calendario asume que un día
  // "libre" lo está las 24hs, cuando en realidad solo se evaluó una franja.
  const windowLabel = (winFrom || winTo)
    ? `🕐 Horario considerado: ${winStart}–${winEnd}`
    : `🕐 Horario considerado: todo el día`;

  const copyText = async () => {
    const lines = [`🎾 Disponibilidad ${whoTitle}`, rangeLabel, windowLabel, ""];
    for (const key of days) lines.push(`${isFree(key) ? "✅" : "❌"} ${dayLabel(key)}`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard denegado — sin fallback silencioso posible */ }
  };

  const downloadPng = () => {
    const cell = 132, gap = 12, cols = 7;
    const rows = Math.ceil((lead + days.length) / cols);
    // headerH +46 respecto al original para hacerle lugar al chip de horario
    // sin pisar la fila de días de la semana.
    const headerH = 174, dowH = 44, legendH = 96;
    const W = gap + cols * (cell + gap);
    const H = headerH + dowH + rows * (cell + gap) + legendH;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    const rr = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#111827"; ctx.font = "bold 42px system-ui, sans-serif";
    ctx.fillText(`Disponibilidad — ${whoTitle}`, gap + 6, 58);
    ctx.fillStyle = "#6b7280"; ctx.font = "27px system-ui, sans-serif";
    ctx.fillText(rangeLabel, gap + 6, 100);

    // Chip de franja horaria — destacado a propósito, para que quien reciba
    // la imagen entienda de un vistazo que "libre" es dentro de esa franja,
    // no el día entero (pedido explícito: que no haga falta aclararlo aparte).
    ctx.font = "bold 24px system-ui, sans-serif";
    const winChipPad = 18;
    const winChipW = ctx.measureText(windowLabel).width + winChipPad * 2;
    ctx.fillStyle = "#fef3c7"; rr(gap + 4, 116, winChipW, 40, 10); ctx.fill();
    ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 2; rr(gap + 4, 116, winChipW, 40, 10); ctx.stroke();
    ctx.fillStyle = "#92400e";
    ctx.fillText(windowLabel, gap + 4 + winChipPad, 143);

    // Cabecera de días de semana (lun..dom)
    ctx.font = "bold 22px system-ui, sans-serif"; ctx.fillStyle = "#9ca3af"; ctx.textAlign = "center";
    const DOW = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
    DOW.forEach((d, i) => ctx.fillText(d, gap + i * (cell + gap) + cell / 2, headerH + 28));

    days.forEach((key, idx) => {
      const pos = lead + idx;
      const col = pos % cols, row = Math.floor(pos / cols);
      const x = gap + col * (cell + gap);
      const y = headerH + dowH + row * (cell + gap);
      const free = isFree(key);
      const d = parseYmd(key);

      ctx.fillStyle = free ? "#d1fae5" : "#f3f4f6";
      rr(x, y, cell, cell, 16); ctx.fill();
      ctx.strokeStyle = free ? "#10b981" : "#e5e7eb"; ctx.lineWidth = free ? 4 : 2;
      rr(x, y, cell, cell, 16); ctx.stroke();

      ctx.fillStyle = free ? "#065f46" : "#b0b7c3";
      ctx.font = "bold 44px system-ui, sans-serif";
      ctx.fillText(String(d.getDate()), x + cell / 2, y + 66);
      ctx.font = "20px system-ui, sans-serif";
      ctx.fillStyle = free ? "#047857" : "#c3c9d4";
      ctx.fillText(MONTHS_ES[d.getMonth()], x + cell / 2, y + 96);
      if (!free) {
        ctx.strokeStyle = "#fca5a5"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + 22, y + cell - 20); ctx.lineTo(x + cell - 22, y + 20); ctx.stroke();
      }
    });

    // Leyenda
    const ly = headerH + dowH + rows * (cell + gap) + 40;
    ctx.textAlign = "left";
    ctx.fillStyle = "#d1fae5"; rr(gap + 6, ly - 22, 30, 30, 8); ctx.fill();
    ctx.strokeStyle = "#10b981"; ctx.lineWidth = 3; rr(gap + 6, ly - 22, 30, 30, 8); ctx.stroke();
    ctx.fillStyle = "#111827"; ctx.font = "24px system-ui, sans-serif";
    ctx.fillText("Podemos jugar", gap + 48, ly + 2);
    ctx.fillStyle = "#f3f4f6"; rr(gap + 260, ly - 22, 30, 30, 8); ctx.fill();
    ctx.strokeStyle = "#e5e7eb"; rr(gap + 260, ly - 22, 30, 30, 8); ctx.stroke();
    ctx.fillStyle = "#111827";
    ctx.fillText("Ocupados", gap + 302, ly + 2);
    ctx.fillStyle = "#c3c9d4"; ctx.font = "19px system-ui, sans-serif"; ctx.textAlign = "right";
    ctx.fillText("Misiones de Pareja", W - gap - 6, ly + 2);

    canvas.toBlob(blob => { if (blob) dlBlob(blob, `disponibilidad-${from}-a-${to}.png`); }, "image/png");
  };

  const busyDays = days.filter(k => !isFree(k));

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", zIndex:180, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background:"var(--t-menu-bg,#0f0a1e)", borderTop:"1px solid var(--t-card-border,rgba(167,139,250,0.15))", borderRadius:"20px 20px 0 0", width:"100%", maxWidth:640, maxHeight:"92vh", overflowY:"auto", padding:"20px 18px calc(20px + env(safe-area-inset-bottom))" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, color:"var(--t-text,#f8f4ff)" }}>🎾 Exportar disponibilidad</div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background:"rgba(255,255,255,0.06)", border:"none", borderRadius:8, color:"var(--t-text-muted,#8b7fa8)", fontSize:18, cursor:"pointer", padding:"4px 9px", lineHeight:1 }}>×</button>
        </div>
        <div style={{ fontSize:11.5, color:"var(--t-text-muted,#8b7fa8)", marginBottom:16, lineHeight:1.5 }}>
          Verde = podéis jugar. Toca cualquier día para corregirlo a mano antes de exportar.
        </div>

        {/* De quién es la disponibilidad (liga mixta / individual) */}
        <div style={{ marginBottom:12 }}>
          <label style={S.label}>¿Disponibilidad de quién?</label>
          <div style={{ display:"flex", gap:6 }}>
            {[["together", `👫 Ambos`, colors?.together || "#34d399"], ["person1", p1, colors?.person1 || "#f472b6"], ["person2", p2, colors?.person2 || "#a78bfa"]].map(([id, label, c]) => {
              const sel = who === id;
              return (
                <button key={id} onClick={() => setWho(id)}
                  style={{ flex:1, background:sel?`${c}22`:"rgba(128,128,128,0.06)", border:`1px solid ${sel?c:"rgba(255,255,255,0.08)"}`, borderRadius:10, color:sel?c:"var(--t-text-muted,#6b5f88)", padding:"8px 6px", cursor:"pointer", fontSize:12.5, fontFamily:"inherit", fontWeight:sel?700:400 }}>
                  {label}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize:10.5, color:"var(--t-text-dim,#6b5f88)", marginTop:6, lineHeight:1.5 }}>
            {who === "together"
              ? "Liga mixta: los eventos de cualquiera de los dos ocupan el día."
              : `Liga individual: solo ocupan los eventos de ${who === "person1" ? p1 : p2} y los de «juntos» — la agenda del otro no cuenta.`}
          </div>
        </div>

        {/* Rango */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
          <div><label style={S.label}>Desde</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
          <div><label style={S.label}>Hasta</label><input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
        </div>

        {/* Franja de juego — la regla es de SOLAPE, no de hora de inicio */}
        <div style={{ background:"rgba(128,128,128,0.06)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.15))", borderRadius:12, padding:"12px 14px", marginBottom:14 }}>
          <div style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:4 }}>🕐 ¿A qué hora se jugaría?</div>
          <div style={{ fontSize:10.5, color:"var(--t-text-dim,#6b5f88)", marginBottom:10, lineHeight:1.5 }}>Deja ambas vacías si el partido puede ser a cualquier hora del día.</div>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:12 }}>
            <div style={{ flex:1 }}>
              <label style={{ ...S.label, marginBottom:4 }}>Desde</label>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <input type="time" value={winFrom} onChange={e => setWinFrom(e.target.value)} style={{ ...S.inputSm, colorScheme:"dark", textAlign:"center" }} />
                {winFrom && <button onClick={() => setWinFrom("")} aria-label="Quitar" style={{ background:"none", border:"none", color:"var(--t-text-dim,#4a4166)", cursor:"pointer", fontSize:14, padding:2 }}>×</button>}
              </div>
            </div>
            <div style={{ flex:1 }}>
              <label style={{ ...S.label, marginBottom:4 }}>Hasta</label>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <input type="time" value={winTo} onChange={e => setWinTo(e.target.value)} style={{ ...S.inputSm, colorScheme:"dark", textAlign:"center" }} />
                {winTo && <button onClick={() => setWinTo("")} aria-label="Quitar" style={{ background:"none", border:"none", color:"var(--t-text-dim,#4a4166)", cursor:"pointer", fontSize:14, padding:2 }}>×</button>}
              </div>
            </div>
          </div>
          {/* Explicación dinámica de la regla, en palabras y con ejemplo */}
          <div style={{ background:"rgba(167,139,250,0.07)", border:"1px solid rgba(167,139,250,0.18)", borderRadius:9, padding:"9px 11px", marginBottom:12, fontSize:11, color:"#c4b8ff", lineHeight:1.6 }}>
            {(winFrom || winTo) ? (
              <>Un día se marca <strong style={{ color:"rgba(244,63,94,0.9)" }}>❌ ocupado</strong> si alguna actividad <strong>se cruza</strong> con la franja <strong>{winStart}–{winEnd}</strong>, aunque haya empezado antes. Ej.: un evento de {addMin(winStart, -30)} a {addMin(winStart, 60)} invade la franja → ❌ ocupa. Uno que termina a las {winStart} o antes → ✅ no ocupa.</>
            ) : (
              <>Sin franja definida: <strong>cualquier</strong> actividad con fecha ocupa su día, a cualquier hora. Define una franja (ej. 19:30–23:00) para que lo de la mañana no bloquee el partido de la tarde.</>
            )}
          </div>
          {[
            [noTimeBlocks, setNoTimeBlocks, "Los eventos sin hora ocupan el día entero"],
            [includeTasks, setIncludeTasks, "Las tareas con fecha también ocupan"],
          ].map(([val, set, label]) => (
            <div key={label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontSize:12.5, color:"#c4b8ff" }}>{label}</span>
              <button onClick={() => set(v => !v)}
                style={{ width:40, height:22, borderRadius:99, background:val?"var(--t-accent,#a78bfa)":"rgba(255,255,255,0.1)", border:"none", cursor:"pointer", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                <span style={{ position:"absolute", top:3, left:val?20:3, width:16, height:16, borderRadius:99, background:"#fff", transition:"left 0.2s", display:"block" }} />
              </button>
            </div>
          ))}
          <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", marginTop:4, fontStyle:"italic" }}>Los eventos con hora de inicio pero sin fin se asumen de 1 hora.</div>
        </div>

        {/* Preview del calendario */}
        {days.length === 0 ? (
          <div style={{ textAlign:"center", color:"var(--t-text-muted,#8b7fa8)", fontSize:13, padding:"20px 0" }}>Elige un rango de fechas válido (máx. 3 meses)</div>
        ) : (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:4 }}>
              {["L","M","X","J","V","S","D"].map((d,i) => <div key={i} style={{ textAlign:"center", fontSize:10, color:"var(--t-text-dim,#4a4166)", fontWeight:600 }}>{d}</div>)}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:10 }}>
              {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} />)}
              {days.map(key => {
                const free = isFree(key);
                const d = parseYmd(key);
                const overridden = overrides[key] !== undefined && overrides[key] !== !(blockersByDay[key]?.length > 0);
                return (
                  <button key={key} onClick={() => toggleDay(key)}
                    title={(blockersByDay[key] || []).map(b => `${b.emoji || ""} ${b.title}${b.range ? ` (${b.range})` : ""}`).join(", ") || "Libre"}
                    style={{
                      aspectRatio:"1", borderRadius:10, cursor:"pointer", fontFamily:"inherit",
                      background: free ? "rgba(16,185,129,0.18)" : "rgba(244,63,94,0.08)",
                      border: `1.5px solid ${free ? "#10b981" : "rgba(244,63,94,0.35)"}`,
                      color: free ? "#34d399" : "rgba(244,63,94,0.75)",
                      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:1, padding:0, position:"relative",
                    }}>
                    <span style={{ fontSize:14, fontWeight:700, lineHeight:1 }}>{d.getDate()}</span>
                    <span style={{ fontSize:8, opacity:0.8 }}>{MONTHS_ES[d.getMonth()]}</span>
                    {overridden && <span style={{ position:"absolute", top:2, right:4, fontSize:8 }}>✎</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize:11.5, color:"var(--t-text-muted,#8b7fa8)", marginBottom:12 }}>
              <strong style={{ color:"#34d399" }}>{freeCount}</strong> de {days.length} días disponibles
            </div>

            {busyDays.length > 0 && (
              <div style={{ background:"rgba(128,128,128,0.05)", borderRadius:10, padding:"10px 12px", marginBottom:14, maxHeight:130, overflowY:"auto" }}>
                <div style={{ fontSize:10, letterSpacing:1, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", marginBottom:6 }}>Por qué están ocupados</div>
                {busyDays.map(key => (
                  <div key={key} style={{ fontSize:11, color:"var(--t-text-muted,#8b7fa8)", marginBottom:3 }}>
                    <span style={{ color:"rgba(244,63,94,0.8)", fontWeight:600 }}>{dayLabel(key)}:</span>{" "}
                    {(blockersByDay[key] || []).map(b => `${b.emoji || ""} ${b.title}${b.range ? ` (${b.range})` : ""}`).join(" · ") || "marcado a mano"}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:"flex", gap:8 }}>
              <button onClick={copyText} style={{ ...S.btnSecondary, flex:1, fontSize:13, padding:"11px 8px" }}>{copied ? "✓ Copiado" : "📋 Copiar texto"}</button>
              <button onClick={downloadPng} style={{ ...S.btnPrimary, flex:1.4, fontSize:13, padding:"11px 8px" }}>📷 Descargar imagen</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
