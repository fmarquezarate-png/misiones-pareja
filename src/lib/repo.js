// repo.js — Capa de acceso a datos
//
// HOY (v3.5): todas las funciones leen/escriben desde el blob JSON en app_data.data
// SPRINT D (v3.7): dual_write_normalized activado → escribe en blob + tablas normalizadas
// SPRINT G (v4.0): cas_version_check activado → saveWithCAS reemplaza el save directo
//
// El interface de cada función no cambia entre fases — solo la implementación interna.
// App.jsx llama a repo.js; repo.js decide qué backend usar según los feature flags.

import supabase from "../supabase.js";
import { isEnabled } from "./flags.js";

/* ── Misiones ──────────────────────────────────────────────────────────── */

// Lee todas las misiones de una semana específica
// weekKey: string formato '2026-W20'
// Hoy: lee del blob via data.weeks[weekKey].missions
// Sprint D: leerá de tabla missions WHERE week_key = weekKey
export async function getMissionsForWeek(coupleId, weekKey, blobData) {
  if (isEnabled("dual_write_normalized")) {
    // futuro: const { data } = await supabase.from("missions").select("*").eq("couple_id", coupleId).eq("week_key", weekKey);
    // return data || [];
  }
  // Hoy: leer del blob
  return blobData?.weeks?.[weekKey]?.missions || [];
}

// Actualiza el status de una misión
// Hoy: devuelve el nuevo state para que App.jsx haga el save del blob
// Sprint D: hará UPDATE en tabla missions + dual-write al blob
export async function updateMissionStatus(coupleId, weekKey, missionId, newStatus, blobData, saveFn) {
  if (isEnabled("dual_write_normalized")) {
    // futuro: await supabase.from("missions").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", missionId).eq("couple_id", coupleId);
  }
  // Hoy: delegar al save de blob existente
  return saveFn();
}

/* ── Metas ─────────────────────────────────────────────────────────────── */

// Lee todas las metas activas de una pareja
export async function getGoals(coupleId, blobData) {
  if (isEnabled("dual_write_normalized")) {
    // futuro: const { data } = await supabase.from("goals").select("*").eq("couple_id", coupleId).eq("active", true);
    // return data || [];
  }
  return blobData?.goals || [];
}

// Crea o actualiza una meta
export async function upsertGoal(coupleId, goal, blobData, saveFn) {
  if (isEnabled("dual_write_normalized")) {
    // futuro: dual-write a tabla goals
  }
  return saveFn();
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
