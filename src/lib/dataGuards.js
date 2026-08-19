// Guardas de integridad de datos (v4.25.0) — funciones PURAS, sin red ni
// estado, para poder testearlas sin mocks (mismo criterio que validation.js).
//
// Origen: el blob `app_data` es la única fuente de verdad y un save corrupto
// que pase isValidAppData() (que solo valida FORMA) puede destruir datos
// reales. Estas guardas validan MAGNITUD: ¿este estado nuevo elimina una
// porción sospechosa de lo que había? ¿este backup es digno de restaurarse?
//
// Regla de CLAUDE.md que implementan: "cualquier fallback/escritura silenciosa
// de datos vacíos es una decisión destructiva disfrazada — debe bloquear con
// aviso visible, no continuar como si nada."

import { isValidAppData } from "./validation.js";

// Bloquear si el nuevo estado conserva menos del 60% de las misiones (caída >40%).
// 40% y no 30%: borrar varias misiones viejas de una vez es legítimo y frecuente
// (limpiar una semana, borrar una serie recurrente) — 30% daría falsos positivos.
export const DROP_THRESHOLD = 0.4;
// El umbral porcentual solo aplica si había al menos 5 misiones — con 2-4,
// borrar una sola ya supera cualquier porcentaje y molestaría sin motivo.
export const MIN_PREV_FOR_DROP = 5;
// Vaciar del todo (quedar en 0) se bloquea si había al menos 3 — borrar la
// última o penúltima misión de una pareja nueva no debe pedir confirmación.
export const MIN_PREV_FOR_WIPE = 3;
// Backups más viejos que esto no se ofrecen para restaurar automáticamente.
export const MAX_BACKUP_AGE_DAYS = 90;

// Total de misiones del blob, contando todas las semanas. 0 para cualquier
// estructura rara — nunca lanza (se usa en paths de error).
export function countMissions(d) {
  if (!d || typeof d !== "object" || !d.weeks || typeof d.weeks !== "object") return 0;
  let n = 0;
  for (const w of Object.values(d.weeks)) n += Array.isArray(w?.missions) ? w.missions.length : 0;
  return n;
}

function countArray(d, key) {
  return Array.isArray(d?.[key]) ? d[key].length : 0;
}

export function countProtectedItems(d) {
  return {
    missions: countMissions(d),
    gastos: countArray(d, "gastos"),
    gastosProyectos: countArray(d, "gastosProyectos"),
  };
}

function assessDrop(prev, next, label, opts) {
  const { threshold, minPrevDrop, minPrevWipe } = opts;
  if (typeof prev !== "number" || !Number.isFinite(prev)) return null;
  if (next === 0 && prev >= minPrevWipe) {
    return { blocked: true, reason: `${label}_wipe`, prev, next, label };
  }
  if (prev >= minPrevDrop && next < prev * (1 - threshold)) {
    return { blocked: true, reason: `${label}_mass_drop`, prev, next, label };
  }
  return null;
}

// ¿Es seguro persistir `nextData` cuando el último estado CONFIRMADO tenía
// `prevCount` misiones? Devuelve { blocked, reason?, prev, next }.
// prevCount == null → sin referencia (primer arranque, restore) → nunca bloquea.
export function assessWrite(prevCount, nextData, opts = {}) {
  const {
    threshold = DROP_THRESHOLD,
    minPrevDrop = MIN_PREV_FOR_DROP,
    minPrevWipe = MIN_PREV_FOR_WIPE,
  } = opts;
  const next = countMissions(nextData);
  if (typeof prevCount !== "number" || !Number.isFinite(prevCount)) {
    return { blocked: false, prev: null, next };
  }
  const blocked = assessDrop(prevCount, next, "missions", { threshold, minPrevDrop, minPrevWipe });
  if (blocked) return { ...blocked, reason: blocked.reason.replace("missions_", ""), prev: prevCount };
  return { blocked: false, prev: prevCount, next };
}

export function assessProtectedWrite(prevCounts, nextData, opts = {}) {
  const {
    threshold = DROP_THRESHOLD,
    minPrevDrop = MIN_PREV_FOR_DROP,
    minPrevWipe = MIN_PREV_FOR_WIPE,
  } = opts;
  const nextCounts = countProtectedItems(nextData);
  if (!prevCounts || typeof prevCounts !== "object") {
    return { blocked: false, prev: null, next: nextCounts };
  }

  for (const label of ["missions", "gastos", "gastosProyectos"]) {
    const blocked = assessDrop(prevCounts[label], nextCounts[label], label, { threshold, minPrevDrop, minPrevWipe });
    if (blocked) return { ...blocked, prev: prevCounts[label], next: nextCounts[label], prevCounts, nextCounts };
  }

  return { blocked: false, prev: prevCounts, next: nextCounts };
}

// ¿Esta fila de app_data_backups sirve para ofrecerla como restauración?
// Checks: pareja correcta, estructura válida, tiene semanas y misiones,
// timestamp parseable, ni futuro (>24h) ni más viejo que maxAgeDays.
// opts.now permite tests deterministas.
export function isBackupUsable(row, coupleId, opts = {}) {
  const { maxAgeDays = MAX_BACKUP_AGE_DAYS, now = Date.now() } = opts;
  if (!row || typeof row !== "object") return false;
  if (!coupleId || !row.couple_id || String(row.couple_id) !== String(coupleId)) return false;
  if (!isValidAppData(row.data)) return false;
  if (Object.keys(row.data.weeks).length === 0) return false;
  if (countMissions(row.data) === 0) return false;
  const ts = Date.parse(row.created_at);
  if (!Number.isFinite(ts)) return false;
  if (ts > now + 24 * 3600 * 1000) return false;
  if (now - ts > maxAgeDays * 24 * 3600 * 1000) return false;
  return true;
}
