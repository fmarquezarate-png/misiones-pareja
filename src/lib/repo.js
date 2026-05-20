// repo.js — Capa de acceso a datos
//
// HOY (v3.6): dual_write_normalized activado → escribe blob + tablas normalizadas
// IMPORTANTE: IDs en el blob son nanoids cortos (uid()), NO UUIDs.
//   Las tablas normalizadas usan UUID como PK y guardan el nanoid en blob_id.
//   Todas las búsquedas por ID usan .eq("blob_id", id).
// SPRINT G (v4.0): cas_version_check → saveWithCAS reemplaza el save directo

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
