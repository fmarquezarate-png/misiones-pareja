import { T } from "../styles.js";

// Letra del día según la fecha real (getDay: 0=domingo … 6=sábado).
// Antes se usaba un array fijo por índice porque la tira era siempre Lun→Dom;
// con la ventana móvil la posición 0 ya no es lunes, así que hay que
// derivar la letra de cada fecha.
const DOW_BY_DATE = ["D", "L", "M", "X", "J", "V", "S"];

// Ventana MÓVIL centrada en hoy: por defecto 2 días atrás + hoy + 4 adelante
// (7 días). Antes era la semana ISO fija Lun→Dom, que el fin de semana dejaba
// ver casi puro futuro con poca info — pedido de Ana.
function buildRollingDays(refDate = new Date(), back = 2, fwd = 4) {
  const d = new Date(refDate);
  d.setHours(0, 0, 0, 0);
  return Array.from({ length: back + 1 + fwd }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() - back + i);
    return x;
  });
}

const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

export default function WeekStrip({ missions = [], onSelectDay, selected, colors }) {
  const clr = { person1: "#f472b6", person2: "#a78bfa", together: "#34d399", ...colors };
  const today = new Date();
  const todayStr = fmtDate(today);
  const days = buildRollingDays(today);

  const counts = {};
  (missions || []).forEach(m => {
    if (!m?.date) return;
    counts[m.date] = (counts[m.date] || 0) + 1;
  });

  return (
    <div style={{ display:"grid", gridTemplateColumns:`repeat(${days.length}, 1fr)`, gap:5, margin:"6px 0 4px" }}>
      {days.map((d) => {
        const ds = fmtDate(d);
        const isToday = ds === todayStr;
        const isSel = ds === selected;
        const isPast = ds < todayStr;
        const has = (counts[ds] || 0) > 0;
        return (
          <button key={ds}
            onClick={() => onSelectDay && onSelectDay(ds)}
            style={{
              textAlign:"center",
              padding:"7px 2px",
              borderRadius:9,
              cursor: onSelectDay ? "pointer" : "default",
              fontFamily:"inherit",
              transition:"all .15s",
              // Días pasados un poco atenuados — el foco es hoy y lo que viene.
              opacity: isPast && !isSel ? 0.55 : 1,
              background: isToday
                ? `${clr.person1}22`
                : isSel
                  ? `${clr.person2}22`
                  : has
                    ? `${clr.person2}0a`
                    : "rgba(255,255,255,0.03)",
              border: `1px solid ${isToday ? clr.person1 + "66" : isSel ? clr.person2 + "77" : has ? clr.person2 + "2e" : "rgba(255,255,255,0.05)"}`,
            }}>
            <div style={{
              fontSize: 9,
              letterSpacing: 1.5,
              color: isToday ? clr.person1 : T.faint,
              fontWeight: 700,
              marginBottom: 2,
            }}>{DOW_BY_DATE[d.getDay()]}</div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              fontFamily: T.fontDisplay,
              color: isToday ? clr.person1 : T.fg2,
              lineHeight: 1,
            }}>{d.getDate()}</div>
            {has && (
              <div style={{
                margin:"3px auto 0",
                width: 4, height: 4, borderRadius: 99,
                background: isToday ? clr.person1 : clr.person2,
                opacity: 0.7,
              }}/>
            )}
          </button>
        );
      })}
    </div>
  );
}
