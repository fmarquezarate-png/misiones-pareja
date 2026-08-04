import UpcomingDates from "./UpcomingDates.jsx";
import DateIdea from "./DateIdea.jsx";
import { hasImminentDate } from "../lib/homeHighlight.js";

// Una sola tarjeta del día en el inicio: fechas próximas si hay algo inminente
// (≤7 días), o una idea de plan en pareja en caso contrario. Reduce la densidad
// del inicio sin perder ninguna de las dos funciones.
export default function HomeHighlight({ upcoming = [], onAddIdea, ideaSeed = 0 }) {
  if (hasImminentDate(upcoming, 7)) return <UpcomingDates items={upcoming} max={3} />;
  return <DateIdea onAdd={onAddIdea} seed={ideaSeed} />;
}
