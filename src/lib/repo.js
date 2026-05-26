// repo.js — Capa de acceso a datos
//
// HOY (v3.9.2): dual_write_normalized activado → escribe blob + tablas normalizadas
// IMPORTANTE: IDs en el blob son nanoids cortos (uid()), NO UUIDs.
//   Las tablas normalizadas usan UUID como PK y guardan el nanoid en blob_id.
//   Todas las búsquedas por ID usan .eq("blob_id", id).
// SPRINT G (v4.0): cas_version_check → saveWithCAS reemplaza el save directo
//
// DUAL-WRITE WIRING (v3.9.2):
//   insertNormalizedMission / deleteNormalizedMission / updateNormalizedMissionStatus
//   son fire-and-forget desde App.jsx en cada mutación de misión.
//   Gap 1 pendiente (Externo): añadir columnas time/reminder/series_pattern/series_end_date
//   a la tabla missions. Hasta entonces el INSERT omite esos 4 campos (null).

import supabase from "../supabase.js";
import { isEnabled } from "./flags.js";
import { track } from "./track.js";

/* ── Misiones ──────────────────────────────────────────────────────────── */

// Lee todas las misiones de una semana específica
// weekKey: string formato '2026-W20'
// Hoy: lee del blob via data.weeks[weekKey].missions
// Sprint D: leerá de tabla missions WHERE week_key = weekKey
export async function getMissionsForWeek(coupleId, weekKey, blobData) {
  if (isEnabled("dual_write_normalized")) {
    const { data, error } = await supabase
      .from("missions")
      .select("*")
      .eq("couple_id", coupleId)
      .eq("week_key", weekKey);
    if (error) {
      console.error("[repo] getMissionsForWeek error:", error.message);
      return blobData?.weeks?.[weekKey]?.missions || []; // fallback al blob
    }
    return data || [];
  }
  // Hoy: leer del blob
  return blobData?.weeks?.[weekKey]?.missions || [];
}

// Actualiza el status de una misión
// Hoy: devuelve el nuevo state para que App.jsx haga el save del blob
// Sprint D: hará UPDATE en tabla missions + dual-write al blob
export async function updateMissionStatus(coupleId, weekKey, missionId, newStatus, blobData, saveFn) {
  if (isEnabled("dual_write_normalized")) {
    // blob_id = el nanoid del blob; id en tabla = UUID generado en backfill
    const { error } = await supabase
      .from("missions")
      .update({
        status: newStatus,
        completed_at: newStatus === "DONE" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("blob_id", missionId)
      .eq("couple_id", coupleId);

    if (error) {
      console.error("[repo] updateMissionStatus error:", error.message);
      track("dual_write_error", { table: "missions", op: "update_status", error: error.message });
    }
    // blob sigue siendo source of truth — siempre guarda también
  }
  return saveFn();
}

/* ── Metas ─────────────────────────────────────────────────────────────── */

// Lee todas las metas activas de una pareja
export async function getGoals(coupleId, blobData) {
  if (isEnabled("dual_write_normalized")) {
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("couple_id", coupleId)
      .eq("active", true);
    if (error) {
      console.error("[repo] getGoals error:", error.message);
      return blobData?.goals || []; // fallback
    }
    return data || [];
  }
  return blobData?.goals || [];
}

// Crea o actualiza una meta
export async function upsertGoal(coupleId, goal, blobData, saveFn) {
  if (isEnabled("dual_write_normalized")) {
    // Buscar fila existente por blob_id (nanoid), luego UPDATE o INSERT
    const { data: existing } = await supabase
      .from("goals")
      .select("id")
      .eq("blob_id", goal.id)
      .eq("couple_id", coupleId)
      .limit(1);

    const payload = {
      blob_id:    goal.id,
      couple_id:  coupleId,
      title:      goal.title,
      emoji:      goal.emoji,
      who:        goal.who,
      period:     goal.period,
      target:     goal.target,
      goal_type:  goal.goalType || "min",
      active:     goal.active !== false,
      start_date: goal.startDate || null,
      deadline:   goal.deadline || null,
    };

    const { error } = existing?.length
      ? await supabase.from("goals").update(payload).eq("blob_id", goal.id).eq("couple_id", coupleId)
      : await supabase.from("goals").insert(payload);

    if (error) {
      console.error("[repo] upsertGoal error:", error.message);
      track("dual_write_error", { table: "goals", op: "upsert", error: error.message });
    }
  }
  return saveFn();
}

// Lee configuración de la pareja desde couple_settings o del blob
export async function getSettings(coupleId, blobData) {
  if (isEnabled("dual_write_normalized")) {
    const { data, error } = await supabase
      .from("couple_settings")
      .select("*")
      .eq("couple_id", coupleId)
      .single();
    if (error || !data) return blobData?.settings || {};
    return data;
  }
  return blobData?.settings || {};
}

/* ── Dual-write de misiones (Sprint G-2 prep) ──────────────────────────── */

// INSERT una nueva misión en la tabla normalizada.
// Gap 1 cerrado por Externo (26/05): columnas time/reminder/series_pattern/series_end_date disponibles.
export async function insertNormalizedMission(coupleId, weekKey, weekNumber, year, m) {
  if (!isEnabled("dual_write_normalized")) return;
  const { error } = await supabase.from("missions").insert({
    blob_id:          m.id,
    couple_id:        coupleId,
    week_key:         weekKey,
    week_number:      weekNumber,
    year,
    title:            m.title,
    emoji:            m.emoji ?? null,
    who:              m.who,
    status:           m.status ?? "TBC",
    type:             m.type ?? "task",
    categories:       m.categories ?? [],
    duration:         m.duration ?? null,
    date:             m.date ?? null,
    time:             m.time ?? null,
    reminder:         m.reminder !== "none" ? (m.reminder ?? null) : null,
    series_pattern:   m.seriesPattern ?? null,
    series_end_date:  m.seriesEndDate ? m.seriesEndDate : null,
    carried_from_week: m.carriedFromWeek ?? null,
    completed_at:     m.completedAt ? new Date(m.completedAt).toISOString() : null,
    completed_late:   m.completedLate ?? false,
    notes:            m.notes ?? null,
  });
  if (error) {
    console.error("[repo] insertNormalizedMission:", error.message);
    track("dual_write_error", { table: "missions", op: "insert", error: error.message });
  }
}

// DELETE una misión por blob_id (nanoid del blob).
export async function deleteNormalizedMission(coupleId, blobId) {
  if (!isEnabled("dual_write_normalized")) return;
  const { error } = await supabase
    .from("missions")
    .delete()
    .eq("blob_id", blobId)
    .eq("couple_id", coupleId);
  if (error) {
    console.error("[repo] deleteNormalizedMission:", error.message);
    track("dual_write_error", { table: "missions", op: "delete", error: error.message });
  }
}

// UPDATE solo el status de una misión (operación más frecuente).
export async function updateNormalizedMissionStatus(coupleId, blobId, newStatus) {
  if (!isEnabled("dual_write_normalized")) return;
  const { error } = await supabase
    .from("missions")
    .update({
      status:       newStatus,
      completed_at: newStatus === "DONE" ? new Date().toISOString() : null,
      updated_at:   new Date().toISOString(),
    })
    .eq("blob_id", blobId)
    .eq("couple_id", coupleId);
  if (error) {
    console.error("[repo] updateNormalizedMissionStatus:", error.message);
    track("dual_write_error", { table: "missions", op: "update_status", error: error.message });
  }
}

/* ── Save con CAS (preparado para Sprint G) ────────────────────────────── */

// Save con Compare-And-Swap usando la columna version
// p_version: la version leída al cargar los datos
// Devuelve { success: true, newVersion } o { success: false, conflict: true }
export async function saveWithCAS(coupleId, data, version) {
  if (isEnabled("cas_version_check")) {
    const { data: row, error } = await supabase
      .rpc("save_app_data_cas", {
        p_couple_id: coupleId,
        p_data: data,
        p_version: version,
      });
    if (error) return { success: false, error };
    if (!row) return { success: false, conflict: true }; // version mismatch
    return { success: true, newVersion: row.version };
  }
  // Hoy: no usar CAS, el flag está desactivado
  return { success: false, casDisabled: true };
}
