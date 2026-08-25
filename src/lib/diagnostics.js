// Observabilidad in-app (F-P1-1 del workshop v5). Lee la tabla `events` (la RLS
// `events_select_own` deja al miembro leer los de su pareja) y la resume, para
// poder ver save_error / cas_rpc_error / blob_size SIN abrir la consola de
// Supabase — que fue lo que costó 3 versiones diagnosticar la saga de guardado.
//
// La agregación es PURA (rows → resumen) y testeable; la query es un envoltorio.

import supabase from "../supabase.js";

// Nombres de evento que son fallos accionables (se listan aparte).
const ERROR_NAMES = new Set([
  "save_error", "cas_rpc_error", "cas_no_converge_fallback",
  "week_photo_upload_failed", "capsule_photo_upload_failed", "local_backup_failed",
  "idb_backup_failed", "load_drop_notice",
]);

// Resume una lista de eventos (más-reciente-primero no es obligatorio). Puro.
export function summarizeEvents(rows, nowMs = Date.now()) {
  const list = Array.isArray(rows) ? rows : [];
  const byName = {};
  const blobSamples = []; // { ts, size } de save_ok / save_error
  const errors = [];      // fallos accionables, con su detalle

  for (const e of list) {
    if (!e || !e.name) continue;
    byName[e.name] = (byName[e.name] || 0) + 1;
    const p = e.props || {};
    if (typeof p.blob_size === "number") blobSamples.push({ ts: e.ts, size: p.blob_size });
    if (ERROR_NAMES.has(e.name)) {
      errors.push({ ts: e.ts, name: e.name, message: p.message || p.msg || p.error || "", code: p.code || null, blob_size: typeof p.blob_size === "number" ? p.blob_size : null });
    }
  }

  const names = Object.keys(byName).sort((a, b) => byName[b] - byName[a]);
  // blob_size más reciente y máximo (para vigilar que no vuelva a engordar).
  const sortedBlobs = [...blobSamples].sort((a, b) => Date.parse(b.ts || 0) - Date.parse(a.ts || 0));
  const latestBlob = sortedBlobs[0]?.size ?? null;
  const maxBlob = blobSamples.length ? Math.max(...blobSamples.map(s => s.size)) : null;
  const errorsRecent = errors.sort((a, b) => Date.parse(b.ts || 0) - Date.parse(a.ts || 0)).slice(0, 20);

  return {
    total: list.length,
    names,
    byName,
    errorCount: errors.length,
    errorsRecent,
    latestBlob,
    maxBlob,
    nowMs,
  };
}

// Carga los eventos de la pareja desde `sinceHours` atrás y los resume.
// Lanza si la query falla (el caller muestra el error).
export async function loadEventStats(coupleId, sinceHours = 48) {
  const sinceIso = new Date(Date.now() - sinceHours * 3600e3).toISOString();
  const { data, error } = await supabase
    .from("events")
    .select("name, props, ts")
    .eq("couple_id", coupleId)
    .gte("ts", sinceIso)
    .order("ts", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return { ...summarizeEvents(data), sinceHours };
}
