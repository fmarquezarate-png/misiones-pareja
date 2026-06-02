import { T } from "../styles.js";

const DOW = ["L","M","X","J","V","S","D"];

function buildWeekDays(refDate = new Date()) {
  const d = new Date(refDate);
  d.setHours(0,0,0,0);
  const dow = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    return x;
  });
}

const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

export default function WeekStrip({ missions = [], onSelectDay, selected, colors }) {
  const clr = { person1: "#f472b6", person2: "#a78bfa", together: "#34d399", ...colors };
  const today = new Date();
  const todayStr = fmtDate(today);
  const days = buildWeekDays(today);

  const counts = {};
  (missions || []).forEach(m => {
    if (!m?.date) return;
    counts[m.date] = (counts[m.date] || 0) + 1;
  });

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:5, margin:"6px 0 4px" }}>
      {days.map((d, i) => {
        const ds = fmtDate(d);
        const isToday = ds === todayStr;
        const isSel = ds === selected;
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
            }}>{DOW[i]}</div>
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
