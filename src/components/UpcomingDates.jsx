import { daysUntilLabel } from "../lib/importantDates.js";

// Tarjeta "Próximas fechas" en el inicio. Solo se renderiza si el caller pasa
// items (upcomingDates ya filtró por ventana). Muestra hasta `max`.
export default function UpcomingDates({ items = [], max = 3 }) {
  if (!items.length) return null;
  const shown = items.slice(0, max);
  return (
    <div style={{
      margin: "0 0 4px", padding: "14px 16px", borderRadius: 16,
      background: "linear-gradient(135deg, rgba(244,114,182,0.12), rgba(167,139,250,0.10))",
      border: "1px solid rgba(244,114,182,0.28)",
    }}>
      <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, color: "var(--t-text-dim,#6b5f88)", marginBottom: 10 }}>
        💫 Próximas fechas
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.map(it => {
          const soon = it.daysUntil <= 3;
          return (
            <div key={it.id || it.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{it.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "var(--t-text,#f0e8ff)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {it.label}{it.kind === "anniversary" && it.years ? ` · ${it.years} años` : ""}
                </div>
              </div>
              <span style={{
                flexShrink: 0, fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
                color: soon ? "#f472b6" : "var(--t-text-muted,#8b7fa8)",
                background: soon ? "rgba(244,114,182,0.15)" : "rgba(128,128,128,0.1)",
              }}>{daysUntilLabel(it.daysUntil)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
