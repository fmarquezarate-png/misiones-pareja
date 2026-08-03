// Recap semanal (4.4): decide si mostrar el banner de "cierre de semana" en el
// inicio. Lo mantiene fresco (solo a principios de semana) y no redundante con
// el pop-up automático del lunes (comparten la marca de "ya visto"). Puro.

// date: fecha actual; prevWeekHasMissions: la semana previa tiene datos;
// alreadySeen: ya se abrió/cerró el recap de esa semana (localStorage).
export function shouldOfferWrapped(date, prevWeekHasMissions, alreadySeen) {
  if (!prevWeekHasMissions || alreadySeen) return false;
  if (!date || typeof date.getDay !== "function") return false;
  const day = date.getDay(); // 0=Dom … 6=Sáb
  return day >= 1 && day <= 3; // Lun, Mar, Mié
}
