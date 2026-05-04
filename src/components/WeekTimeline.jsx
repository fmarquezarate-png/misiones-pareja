import { useMemo } from "react";

const DOW_SHORT = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

export default function WeekTimeline({ missions, today = new Date(), weekDays, renderCard, showSinFecha = true }) {
  const todayKey = fmt(today);

  const grouped = useMemo(() => {
    const map = {};
    missions.forEach(m => {
      const k = m.date || "_none";
      if (!map[k]) map[k] = [];
      map[k].push(m);
    });
    return map;
  }, [missions]);

  const visibleDays = weekDays.map(d => fmt(d));
  const sinFecha = grouped["_none"] || [];

  return (
    <div style={{ position:"relative", paddingLeft:18, marginTop:6 }}>
      <div style={{
        position:"absolute", left:5, top:0, bottom:0, width:1.5,
        background:"linear-gradient(180deg,#f472b6,#a78bfa,#34d399)",
        opacity:0.5, borderRadius:99,
      }} />

      {visibleDays.map((dKey, i) => {
        const items = grouped[dKey] || [];
        const isToday = dKey === todayKey;
        const dateObj = weekDays[i];
        const dowIdx = (dateObj.getDay() + 6) % 7;
        const label = `${DOW_SHORT[dowIdx]} ${dateObj.getDate()}`;
        const isEmpty = items.length === 0;

        return (
          <div key={dKey} style={{ marginBottom:14, position:"relative" }}>
            <div style={{
              position:"absolute", left:-17, top:4, width:10, height:10,
              borderRadius:99,
              background: isToday ? "#f472b6" : "#a78bfa",
              border:"2px solid #080512",
              boxShadow: isToday ? "0 0 0 4px rgba(244,114,182,0.2)" : "none",
            }} />
            <div style={{
              fontSize:9.5, letterSpacing:1.5, textTransform:"uppercase",
              color: isToday ? "#f472b6" : "#8b7fa8",
              fontWeight:700, marginBottom:6,
            }}>
              {isToday ? `Hoy · ${label}` : label}
            </div>
            {isEmpty ? (
              <div style={{ fontSize:11.5, color:"#6b5f88", fontStyle:"italic", paddingLeft:2 }}>
                Día libre 🌿
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {items.map(m => renderCard(m))}
              </div>
            )}
          </div>
        );
      })}

      {showSinFecha && sinFecha.length > 0 && (
        <div style={{ marginBottom:14, position:"relative", marginTop:8 }}>
          <div style={{
            position:"absolute", left:-17, top:4, width:10, height:10,
            borderRadius:99, background:"#34d399", border:"2px solid #080512",
          }} />
          <div style={{
            fontSize:9.5, letterSpacing:1.5, textTransform:"uppercase",
            color:"#34d399", fontWeight:700, marginBottom:6,
          }}>
            Sin fecha
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {sinFecha.map(m => renderCard(m))}
          </div>
        </div>
      )}
    </div>
  );
}
