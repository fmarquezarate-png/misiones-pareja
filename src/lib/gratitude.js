// Gratitud del día (5.11.0): un "gracias" diario a la pareja. Vive en
// data.gratitudes (historial, más reciente primero). Selección pura del par
// del día (lo que yo mandé hoy / lo que me mandó mi pareja hoy).
import { isMineEntry } from "./identity.js";

export const GRATITUDE_MAX = 160;

const dayStart = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();

// Devuelve { mine, received } con las gratitudes de HOY: la última que envié yo
// y la última que me envió mi pareja (array asumido más-reciente-primero).
export function todaysGratitudes(gratitudes = [], myName, today = new Date(), myPersonId = null) {
  const t0 = dayStart(today);
  let mine = null, received = null;
  for (const g of (gratitudes || [])) {
    if (!g?.at) continue;
    const d = new Date(g.at);
    if (isNaN(d.getTime()) || dayStart(d) !== t0) continue;
    if (isMineEntry(g, myName, myPersonId)) { if (!mine) mine = g; }
    else if (!received) received = g;
    if (mine && received) break;
  }
  return { mine, received };
}
