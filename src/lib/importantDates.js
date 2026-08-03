// Fechas importantes (4.1): unifica en una sola lista ordenada los cumpleaños
// de la pareja (settings.person1/2Birthday), el aniversario (settings.anniversaryDate,
// con nº de años) y el array libre `birthdays`. Puro y testeable — `today` se
// inyecta para poder testear sin depender del reloj.

// Días hasta la próxima ocurrencia de un "MM-DD" (hoy = 0). null si es inválido.
export function daysUntilMMDD(mmdd, today = new Date()) {
  const [m, d] = String(mmdd).split("-").map(Number);
  if (!m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(today.getFullYear(), m - 1, d);
  next = new Date(next.getFullYear(), next.getMonth(), next.getDate());
  if (next < base) next = new Date(today.getFullYear() + 1, m - 1, d);
  return Math.round((next - base) / 86400000);
}

// Devuelve las fechas importantes dentro de `windowDays`, ordenadas por cercanía.
export function upcomingDates({ settings = {}, birthdays = [] } = {}, today = new Date(), windowDays = 30) {
  const s = settings || {};
  const items = [];
  const add = (obj) => {
    const du = daysUntilMMDD(obj.mmdd, today);
    if (du === null) return;
    items.push({ ...obj, daysUntil: du });
  };

  if (s.person1Birthday) add({ kind: "birthday", emoji: "🎂", label: `Cumpleaños de ${s.person1 || "Persona 1"}`, mmdd: s.person1Birthday, id: "p1bday" });
  if (s.person2Birthday) add({ kind: "birthday", emoji: "🎂", label: `Cumpleaños de ${s.person2 || "Persona 2"}`, mmdd: s.person2Birthday, id: "p2bday" });

  if (s.anniversaryDate && /^\d{4}-\d{2}-\d{2}$/.test(s.anniversaryDate)) {
    const mmdd = s.anniversaryDate.slice(5);
    const du = daysUntilMMDD(mmdd, today);
    if (du !== null) {
      const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const nextDate = new Date(base.getTime() + du * 86400000);
      const years = nextDate.getFullYear() - parseInt(s.anniversaryDate.slice(0, 4), 10);
      items.push({ kind: "anniversary", emoji: "💍", label: "Aniversario", mmdd, id: "anniv", daysUntil: du, years: years > 0 ? years : null });
    }
  }

  for (const b of (birthdays || [])) {
    if (b?.date) add({ kind: "birthday", emoji: b.emoji || "🎂", label: b.name || "Cumpleaños", mmdd: b.date, id: b.id });
  }

  return items
    .filter(i => i.daysUntil <= windowDays)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

// Texto humano para los días que faltan.
export function daysUntilLabel(daysUntil) {
  if (daysUntil <= 0) return "¡Hoy!";
  if (daysUntil === 1) return "Mañana";
  return `En ${daysUntil} días`;
}
