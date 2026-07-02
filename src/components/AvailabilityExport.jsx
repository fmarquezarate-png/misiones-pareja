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

const defaultFrom = () => ymd(new Date());
const defaultTo = () => { const d = new Date(); d.setDate(d.getDate() + 13); return ymd(d); };

export default function AvailabilityExport({ weeks, p1, p2, onClose }) {
  const savedCfg = (() => { try { return JSON.parse(localStorage.getItem(CFG_KEY) || "{}"); } catch { return {}; } })();
  const [from, setFrom] = useState(defaultFrom);
  const [to,   setTo]   = useState(defaultTo);
  const [cutoff,       setCutoff]       = useState(savedCfg.cutoff ?? "");
  const [noTimeBlocks, setNoTimeBlocks] = useState(savedCfg.noTimeBlocks ?? true);
  const [includeTasks, setIncludeTasks] = useState(savedCfg.includeTasks ?? false);
  const [overrides, setOverrides] = useState({}); // ymd -> boolean (free) — solo esta sesión
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(CFG_KEY, JSON.stringify({ cutoff, noTimeBlocks, includeTasks })); } catch { /* modo privado */ }
  }, [cutoff, noTimeBlocks, includeTasks]);

  // Qué bloquea cada día según los parámetros elegidos
  const blockersByDay = useMemo(() => {
    const map = {};
    for (const w of Object.values(weeks || {})) {
      for (const m of (w.missions || [])) {
        if (!m.date || m.status === "DONE") continue;
        const isEvent = m.type === "event";
        if (!isEvent && !includeTasks) continue;
        const end = (isEvent && m.endDate && m.endDate > m.date) ? m.endDate : m.date;
        let d = parseYmd(m.date);
        const endD = parseYmd(end);
        let guard = 0;
        while (d <= endD && guard < 60) {
          const key = ymd(d);
          const isStartDay = key === m.date;
          // El día de inicio respeta la hora de corte; los días intermedios de un
          // evento multi-día bloquean completos.
          const blocks = isStartDay
            ? (m.time ? (!cutoff || m.time >= cutoff) : noTimeBlocks)
            : true;
          if (blocks) (map[key] = map[key] || []).push({ emoji: m.emoji, title: m.title, time: isStartDay ? m.time : null });
          d.setDate(d.getDate() + 1); guard++;
        }
      }
    }
    return map;
  }, [weeks, includeTasks, cutoff, noTimeBlocks]);

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

  const dayLabel = key => {
    const d = parseYmd(key);
    return `${DAYS_ES[d.getDay()]} ${d.getDate()} ${MONTHS_ES[d.getMonth()]}`;
  };
  const rangeLabel = days.length
    ? `${dayLabel(days[0])} — ${dayLabel(days[days.length - 1])} ${parseYmd(days[days.length - 1]).getFullYear()}`
    : "";

  const copyText = async () => {
    const lines = [`🎾 Disponibilidad ${p1} & ${p2}`, rangeLabel, ""];
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
    const headerH = 128, dowH = 44, legendH = 96;
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
    ctx.fillText(`Disponibilidad — ${p1} & ${p2}`, gap + 6, 58);
    ctx.fillStyle = "#6b7280"; ctx.font = "27px system-ui, sans-serif";
    ctx.fillText(rangeLabel, gap + 6, 100);

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

        {/* Rango */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
          <div><label style={S.label}>Desde</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
          <div><label style={S.label}>Hasta</label><input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...S.inputSm, colorScheme:"dark" }} /></div>
        </div>

        {/* Parámetros de qué bloquea */}
        <div style={{ background:"rgba(128,128,128,0.06)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.15))", borderRadius:12, padding:"12px 14px", marginBottom:14 }}>
          <div style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:10 }}>Qué ocupa un día</div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <span style={{ fontSize:12.5, color:"#c4b8ff", flex:1 }}>Solo eventos a partir de las</span>
            <input type="time" value={cutoff} onChange={e => setCutoff(e.target.value)} style={{ ...S.inputSm, colorScheme:"dark", width:100, textAlign:"center" }} />
            {cutoff && <button onClick={() => setCutoff("")} style={{ background:"none", border:"none", color:"var(--t-text-dim,#4a4166)", cursor:"pointer", fontSize:14, padding:2 }}>×</button>}
          </div>
          <div style={{ fontSize:10.5, color:"var(--t-text-dim,#6b5f88)", marginBottom:12, marginTop:-6 }}>Vacío = cualquier hora ocupa. Con 17:00, un evento de la mañana no bloquea el partido de la tarde.</div>
          {[
            [noTimeBlocks, setNoTimeBlocks, "Los eventos sin hora ocupan el día"],
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
                    title={(blockersByDay[key] || []).map(b => `${b.emoji || ""} ${b.title}${b.time ? ` (${b.time})` : ""}`).join(", ") || "Libre"}
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
                    {(blockersByDay[key] || []).map(b => `${b.emoji || ""} ${b.title}${b.time ? ` (${b.time})` : ""}`).join(" · ") || "marcado a mano"}
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
