// ─── Helpers de fecha y URLs externas ────────────────────────────────────────

const _SD = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const _SM = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function weekStartDate(wn, yr) {
  const jan4 = new Date(yr, 0, 4);
  const dow = (jan4.getDay() + 6) % 7; // 0=Mon … 6=Sun
  return new Date(yr, 0, 4 - dow + (wn - 1) * 7);
}

export function fmtShortDate(d) {
  return `${_SD[d.getDay()]} ${d.getDate()} ${_SM[d.getMonth()]}`;
}

export function fmtWeekRange(wn, yr) {
  const mon = weekStartDate(wn, yr);
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  const from = `${mon.getDate()} ${_SM[mon.getMonth()]}`;
  const to   = `${sun.getDate()} ${_SM[sun.getMonth()]}`;
  return mon.getMonth() === sun.getMonth()
    ? `${mon.getDate()}–${sun.getDate()} ${_SM[mon.getMonth()]}`
    : `${from} – ${to}`;
}

export function googleCalendarUrl(mission, name1, name2) {
  if (!mission.date) return null;
  const ds = mission.date.replace(/-/g, "");
  const who = mission.who === "person1" ? name1 : mission.who === "person2" ? name2 : `${name1} & ${name2}`;
  let dates;
  if (mission.time) {
    const [hh, mm] = mission.time.split(":").map(Number);
    const tot = hh * 60 + mm + (mission.duration || 60);
    const eh = String(Math.floor(tot / 60) % 24).padStart(2, "0");
    const em = String(tot % 60).padStart(2, "0");
    dates = `${ds}T${String(hh).padStart(2, "0")}${String(mm).padStart(2, "0")}00/${ds}T${eh}${em}00`;
  } else {
    const nd = new Date(mission.date);
    nd.setDate(nd.getDate() + 1);
    dates = `${ds}/${nd.toISOString().slice(0, 10).replace(/-/g, "")}`;
  }
  const dur = mission.duration;
  const details = `Quién: ${who}${dur ? ` · ${Math.round(dur / 60 * 10) / 10}h` : ""}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(mission.emoji + " " + mission.title)}&dates=${dates}&details=${encodeURIComponent(details)}`;
}
