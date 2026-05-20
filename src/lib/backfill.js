// backfill.js — Migración one-shot de blob JSON a tablas normalizadas
//
// CUÁNDO USAR: Una vez por pareja, cuando dual_write_normalized se active (Sprint D).
// PREREQUISITO: Tablas missions, goals, couple_settings deben existir en Supabase (SQL D-1 a D-4).
// SEGURIDAD: Usa upsert con onConflict — idempotente, se puede re-ejecutar sin duplicar datos.
// ROLLBACK: Si falla, el blob sigue siendo la source of truth. No hay pérdida de datos.

import supabase from "../supabase.js";

export async function backfillMissions(coupleId, blobData) {
  const weeks = blobData?.weeks || {};
  const rows = [];

  for (const [weekKey, week] of Object.entries(weeks)) {
    const [yearStr, wnStr] = weekKey.split("-W");
    const year = parseInt(yearStr) || new Date().getFullYear();
    const weekNumber = parseInt(wnStr) || 1;

    for (const m of (week.missions || [])) {
      rows.push({
        id:               m.id,
        couple_id:        coupleId,
        week_key:         weekKey,
        week_number:      weekNumber,
        year:             year,
        title:            m.title || "",
        emoji:            m.emoji || null,
        who:              m.who || "together",
        status:           m.status || "TODO",
        type:             m.type || null,
        categories:       m.categories || [],
        duration:         m.duration || null,
        date:             m.date || null,
        goal_id:          m.goalId || null,
        series_id:        m.seriesId || null,
        carried_from:     m.carriedFrom || null,
        carried_from_week: m.carriedFromWeek || null,
        completed_at:     m.completedAt ? new Date(m.completedAt).toISOString() : null,
        completed_late:   m.completedLate || false,
        notes:            m.notes || null,
      });
    }
  }

  if (!rows.length) return { ok: true, inserted: 0 };

  // Upsert en batches de 500 para no superar límites de payload
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase
      .from("missions")
      .upsert(batch, { onConflict: "id" });
    if (error) return { ok: false, error: error.message, batch: i };
    inserted += batch.length;
  }
  return { ok: true, inserted };
}

export async function backfillGoals(coupleId, blobData) {
  const goals = blobData?.goals || [];
  if (!goals.length) return { ok: true, inserted: 0 };

  const rows = goals.map(g => ({
    id:         g.id,
    couple_id:  coupleId,
    title:      g.title || "",
    emoji:      g.emoji || null,
    who:        g.who || "together",
    period:     g.period || "monthly",
    target:     g.target || 1,
    goal_type:  g.goalType || "min",
    active:     g.active !== false,
    start_date: g.startDate || null,
    deadline:   g.deadline || null,
  }));

  const { error } = await supabase
    .from("goals")
    .upsert(rows, { onConflict: "id" });

  if (error) return { ok: false, error: error.message };
  return { ok: true, inserted: rows.length };
}

export async function backfillSettings(coupleId, blobData) {
  const s = blobData?.settings || {};
  const row = {
    couple_id:      coupleId,
    person1_name:   blobData?.person1 || "Persona 1",
    person2_name:   blobData?.person2 || "Persona 2",
    color_person1:  blobData?.colors?.person1 || "#a78bfa",
    color_person2:  blobData?.colors?.person2 || "#60a5fa",
    color_together: blobData?.colors?.together || "#34d399",
    theme:          blobData?.theme || "galaxy",
    notif_chat:     s?.notifications?.chat !== false,
    notif_partner:  s?.notifications?.partnerChanges !== false,
    notif_events:   s?.notifications?.eventReminders !== false,
    notif_goals:    s?.notifications?.goalDeadlines !== false,
    notif_daily:    s?.notifications?.dailyBriefing === true,
  };

  const { error } = await supabase
    .from("couple_settings")
    .upsert(row, { onConflict: "couple_id" });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function runFullBackfill(coupleId, blobData) {
  console.log("[backfill] Iniciando migración para pareja:", coupleId);

  const results = {};

  results.missions = await backfillMissions(coupleId, blobData);
  if (!results.missions.ok) {
    console.error("[backfill] Fallo en missions:", results.missions.error);
    return { ok: false, step: "missions", ...results };
  }
  console.log("[backfill] missions OK:", results.missions.inserted, "filas");

  results.goals = await backfillGoals(coupleId, blobData);
  if (!results.goals.ok) {
    console.error("[backfill] Fallo en goals:", results.goals.error);
    return { ok: false, step: "goals", ...results };
  }
  console.log("[backfill] goals OK:", results.goals.inserted, "filas");

  results.settings = await backfillSettings(coupleId, blobData);
  if (!results.settings.ok) {
    console.error("[backfill] Fallo en settings:", results.settings.error);
    return { ok: false, step: "settings", ...results };
  }
  console.log("[backfill] settings OK");

  console.log("[backfill] Migración completa:", results);
  return { ok: true, ...results };
}

// Compara el blob con las tablas normalizadas y devuelve un reporte
export async function verifyBackfill(coupleId, blobData) {
  const blobMissionCount = Object.values(blobData?.weeks || {})
    .reduce((sum, w) => sum + (w.missions?.length || 0), 0);
  const blobGoalCount = (blobData?.goals || []).length;

  const { count: dbMissions } = await supabase
    .from("missions").select("*", { count: "exact", head: true })
    .eq("couple_id", coupleId);

  const { count: dbGoals } = await supabase
    .from("goals").select("*", { count: "exact", head: true })
    .eq("couple_id", coupleId);

  return {
    missions: { blob: blobMissionCount, db: dbMissions, match: blobMissionCount === dbMissions },
    goals:    { blob: blobGoalCount,    db: dbGoals,    match: blobGoalCount === dbGoals },
    consistent: blobMissionCount === dbMissions && blobGoalCount === dbGoals,
  };
}
