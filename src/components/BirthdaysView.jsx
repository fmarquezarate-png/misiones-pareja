import { useState } from "react";
import { uid } from "../utils.js";
import { S } from "../styles.js";

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS_IN_MONTH = [31,29,28,31,30,31,30,31,31,30,31,30,31]; // 29 for feb (leap)

function daysUntil(mmdd) {
  const today = new Date();
  const [m, d] = mmdd.split("-").map(Number);
  let next = new Date(today.getFullYear(), m - 1, d);
  if (next < today && !(next.getDate() === today.getDate() && next.getMonth() === today.getMonth())) {
    next = new Date(today.getFullYear() + 1, m - 1, d);
  }
  const diff = Math.round((next - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  return diff;
}

function fmtDate(mmdd) {
  const [m, d] = mmdd.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]}`;
}

const EMOJIS = ["🎂","🎁","🎉","🎊","🥳","👶","👦","👧","👨","👩","👴","👵","💝","🌟","⭐","🦋","🐾"];

export default function BirthdaysView({ birthdays = [], onAdd, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName]   = useState("");
  const [emoji, setEmoji] = useState("🎂");
  const [month, setMonth] = useState("01");
  const [day, setDay]     = useState("01");

  const sorted = [...birthdays].sort((a, b) => {
    const da = daysUntil(a.date);
    const db = daysUntil(b.date);
    return da - db;
  });

  const maxDay = DAYS_IN_MONTH[parseInt(month)] || 31;

  const handleAdd = () => {
    if (!name.trim()) return;
    const date = `${month}-${day.padStart(2, "0")}`;
    onAdd({ id: uid(), name: name.trim(), emoji, date });
    setName(""); setEmoji("🎂"); setMonth("01"); setDay("01");
    setShowForm(false);
  };

  return (
    <div style={{ padding: "16px 16px 120px" }}>
      <style>{`
        @keyframes bd-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--t-text,#f8f4ff)", fontFamily: "'Fraunces',serif" }}>🎂 Cumpleaños</div>
          <div style={{ fontSize: 12, color: "var(--t-text-dim,#6b5f88)", marginTop: 2 }}>Recordatorios el día anterior</div>
        </div>
        <button onClick={() => setShowForm(v => !v)} style={{
          background: showForm ? "rgba(244,114,182,0.12)" : "var(--t-accent-soft,rgba(167,139,250,0.12))",
          border: `1px solid ${showForm ? "rgba(244,114,182,0.35)" : "rgba(167,139,250,0.3)"}`,
          borderRadius: 10, color: showForm ? "#f472b6" : "var(--t-accent,#a78bfa)",
          fontSize: 13, fontWeight: 600, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit",
        }}>
          {showForm ? "✕ Cancelar" : "+ Añadir"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{
          background: "var(--t-card,#1d1733)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.2))",
          borderRadius: 14, padding: 16, marginBottom: 20,
          animation: "bd-in 0.25s ease-out both",
        }}>
          <div style={{ fontSize: 11, color: "var(--t-text-dim,#6b5f88)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Nuevo cumpleaños</div>

          {/* Emoji picker */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setEmoji(e)} style={{
                fontSize: 18, background: emoji === e ? "rgba(167,139,250,0.2)" : "rgba(128,128,128,0.06)",
                border: `1px solid ${emoji === e ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 8, padding: "4px 6px", cursor: "pointer", lineHeight: 1,
              }}>{e}</button>
            ))}
          </div>

          {/* Name */}
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Nombre (ej: Mamá, Papá, Ana...)"
            style={{ ...S.input, marginBottom: 12 }}
          />

          {/* Month + Day selectors */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Mes</label>
              <select value={month} onChange={e => setMonth(e.target.value)} style={{ ...S.input, appearance: "none" }}>
                {MONTHS.map((m, i) => (
                  <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>
                ))}
              </select>
            </div>
            <div style={{ width: 90 }}>
              <label style={S.label}>Día</label>
              <select value={day} onChange={e => setDay(e.target.value)} style={{ ...S.input, appearance: "none" }}>
                {Array.from({ length: maxDay }, (_, i) => String(i + 1).padStart(2, "0")).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <button onClick={handleAdd} style={{ ...S.btnPrimary, width: "100%", textAlign: "center", justifyContent: "center" }}>
            Guardar cumpleaños ✓
          </button>
        </div>
      )}

      {/* List */}
      {sorted.length === 0 && !showForm ? (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--t-text-dim,#6b5f88)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎂</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t-text-muted,#8b7fa8)", marginBottom: 6 }}>Sin cumpleaños registrados</div>
          <div style={{ fontSize: 12, lineHeight: 1.6 }}>Añade los cumpleaños importantes para recibir<br />un recordatorio el día anterior</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map(b => {
            const days = daysUntil(b.date);
            const isToday    = days === 0;
            const isTomorrow = days === 1;
            const gold = "#d4a017";
            const accent = isToday ? gold : isTomorrow ? "#f472b6" : "var(--t-accent,#a78bfa)";

            return (
              <div key={b.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                background: isToday
                  ? "rgba(212,160,23,0.08)"
                  : isTomorrow
                    ? "rgba(244,114,182,0.06)"
                    : "var(--t-card,rgba(29,23,51,0.8))",
                border: `1px solid ${isToday ? "rgba(212,160,23,0.35)" : isTomorrow ? "rgba(244,114,182,0.2)" : "var(--t-card-border,rgba(167,139,250,0.1))"}`,
                borderRadius: 12, padding: "12px 14px",
                animation: "bd-in 0.3s ease-out both",
              }}>
                <span style={{ fontSize: 24, flexShrink: 0, filter: isToday ? `drop-shadow(0 0 8px ${gold})` : "none" }}>{b.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: isToday ? gold : "var(--t-text,#f8f4ff)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {b.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--t-text-dim,#6b5f88)", marginTop: 2 }}>
                    {fmtDate(b.date)}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {isToday ? (
                    <div style={{ fontSize: 11, fontWeight: 700, color: gold, letterSpacing: 1 }}>¡HOY! 🎉</div>
                  ) : isTomorrow ? (
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#f472b6" }}>¡MAÑANA!</div>
                  ) : (
                    <div style={{ fontSize: 11, color: accent, fontWeight: 600 }}>
                      {days < 365 ? `en ${days}d` : "en +1 año"}
                    </div>
                  )}
                  <button onClick={() => onDelete(b.id)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--t-text-dim,#4a4166)", fontSize: 16, padding: "4px 0 0",
                    lineHeight: 1, display: "block", marginTop: 2,
                  }} title="Eliminar">×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
