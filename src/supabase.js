import { createClient } from "@supabase/supabase-js";
import { isValidAppData } from "./lib/validation.js";
export { isValidAppData };

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const localKey   = id => `couple-missions-${id}`;
const localTsKey = id => `couple-missions-${id}-ts`;

/* ── Auth ──────────────────────────────────────────────────────────────── */

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) console.error("signInWithGoogle error:", error);
}

export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function resetPasswordForEmail(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  return { error };
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error("signOut error:", error);
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// onAuthChange(callback): callback(session, event) — event es "PASSWORD_RECOVERY"
// cuando el usuario llega desde el link de "olvidé mi contraseña" (Supabase JS
// detecta el token en la URL automáticamente). Los demás callers pueden ignorar
// el 2º argumento.
export function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session, event);
  });
  return subscription;
}

/* ── Couple helpers ────────────────────────────────────────────────────── */

// Devuelve null SOLO cuando genuinamente no hay pareja (sin sesión o sin fila
// en couple_members). Los errores de red/DB LANZAN — antes devolvían null
// también, y el caller (resolve en AppWithAuth) interpretaba ese null como
// "no tiene pareja": borraba el auth-cache y mandaba a onboarding por un
// simple fallo de red. El caller decide qué hacer con el throw (mantener el
// estado actual si hay cache local).
export async function getMyCoupleId() {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw new Error("getUser: " + userErr.message);
  if (!user) return null;
  const { data, error } = await supabase
    .from("couple_members")
    .select("couple_id, person_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) { console.error("getMyCoupleId error:", error); throw new Error("couple_members: " + error.message); }
  return data;
}

export async function createCouple(code, personName) {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return { error: "No hay sesión activa" };

  const { data: existing, error: findErr } = await supabase
    .rpc("find_couple_by_code", { p_code: code.toUpperCase() });

  if (findErr) console.warn("[createCouple] find_couple_by_code error:", findErr.message);
  if (existing && existing.length > 0) return { error: "Ese código ya está en uso, elige otro" };

  const { data: couple, error: coupleErr } = await supabase
    .from("couples")
    .insert({
      code: code.toUpperCase(),
      name: `Pareja ${code.toUpperCase()}`,
      owner_user_id: user.id,
    })
    .select("id")
    .single();

  if (coupleErr) return { error: coupleErr.message };

  const { error: memberErr } = await supabase
    .from("couple_members")
    .insert({ user_id: user.id, couple_id: couple.id, person_name: personName });

  if (memberErr) {
    // Cleanup: la pareja quedó huérfana si el miembro no se pudo insertar.
    // Sin este delete, el usuario no puede reintentar (el código ya existe).
    // Si el delete falla, el Externo deberá limpiar la fila manualmente.
    await supabase.from("couples").delete().eq("id", couple.id).eq("owner_user_id", user.id);
    console.error("[createCouple] couple_members insert failed:", memberErr.message);
    return { error: "Error al crear la pareja: " + memberErr.message };
  }

  return { couple_id: couple.id };
}

export async function joinCouple(code, personName) {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return { error: "No hay sesión activa" };

  const { data: existingMembership } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMembership) return { error: "Ya perteneces a una pareja. Sal de ella antes de unirte a otra." };

  const { data: rows, error: rpcErr } = await supabase
    .rpc("find_couple_by_code", { p_code: code.toUpperCase() });

  if (rpcErr) { console.error("joinCouple rpc error:", rpcErr); return { error: "Error al buscar la pareja" }; }
  if (!rows || rows.length === 0) return { error: "Código de pareja no encontrado" };

  const couple = rows[0];

  const { data: members } = await supabase
    .from("couple_members")
    .select("user_id")
    .eq("couple_id", couple.id);

  if (members && members.length >= 2) return { error: "Esta pareja ya tiene dos miembros" };

  const { error: memberErr } = await supabase
    .from("couple_members")
    .insert({ user_id: user.id, couple_id: couple.id, person_name: personName });

  if (memberErr) return { error: memberErr.message };

  return { couple_id: couple.id };
}

/* ── localStorage helpers ──────────────────────────────────────────────── */

export function saveLocalBackup(appData, coupleId) {
  try {
    localStorage.setItem(localKey(coupleId), JSON.stringify(appData));
    localStorage.setItem(localTsKey(coupleId), new Date().toISOString());
  } catch { /* quota exceeded – silent */ }
}

export function loadLocalBackup(coupleId) {
  try {
    const key = coupleId ? localKey(coupleId) : "couple-missions-backup";
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return { data: JSON.parse(raw), ts: localStorage.getItem(coupleId ? localTsKey(coupleId) : "couple-missions-backup-ts") };
  } catch (e) {
    if (e instanceof DOMException && e.name === "SecurityError") return { error: "unavailable" };
    return null;
  }
}

/* ── Export / Import ───────────────────────────────────────────────────── */

export function exportData(appData) {
  const blob = new Blob([JSON.stringify(appData, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `shared-calendar-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.weeks || typeof parsed.weeks !== "object" || !parsed.settings) {
          reject(new Error("Formato inválido: falta weeks o settings"));
          return;
        }
        const badWeek = Object.values(parsed.weeks).find(
          w => w && w.missions !== undefined && !Array.isArray(w.missions)
        );
        if (badWeek) { reject(new Error("Formato inválido: missions debe ser un array")); return; }
        resolve(parsed);
      } catch { reject(new Error("JSON inválido")); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/* ── Supabase CRUD ─────────────────────────────────────────────────────── */

export async function loadData(coupleId) {
  try {
    const { data: rows, error } = await supabase
      .from("app_data")
      .select("data")
      .eq("id", coupleId)
      .limit(1);

    if (error) { console.error("loadData error:", error.message); return null; }

    const result = rows?.[0]?.data ?? null;
    if (result) saveLocalBackup(result, coupleId);
    return result;
  } catch (e) {
    console.error("loadData exception:", e);
    return null;
  }
}

export async function loadDataWithVersion(coupleId) {
  try {
    const { data: rows, error } = await supabase
      .from("app_data")
      .select("data, version")
      .eq("id", coupleId)
      .limit(1);
    if (error) { console.error("loadDataWithVersion error:", error.message); return { data: null, version: null }; }
    const row = rows?.[0];
    return { data: row?.data ?? null, version: row?.version ?? null };
  } catch (e) {
    console.error("loadDataWithVersion exception:", e);
    return { data: null, version: null };
  }
}

// ── Sprint G-2: helpers de conversión fila → formato blob ──────────────────

// goalIdMap: Map<UUID → nanoid> built from goalRows; passed in from loadFromNormalized
// so missionRowToBlob never uses the DB UUID as goalId
function missionRowToBlob(row, goalIdMap) {
  return {
    id:             row.blob_id ?? row.id,
    title:          row.title,
    emoji:          row.emoji ?? null,
    who:            row.who,
    status:         row.status,
    type:           row.type ?? null,
    categories:     row.categories ?? [],
    duration:       row.duration ?? null,
    date:           row.date ? String(row.date) : null,
    time:           row.time ?? null,
    reminder:       row.reminder ?? null,
    goalId:         goalIdMap?.get(row.goal_id) ?? row.goal_id ?? null,
    seriesId:       row.series_blob_id ?? null,
    seriesPattern:  row.series_pattern ?? null,
    seriesEndDate:  row.series_end_date ? String(row.series_end_date) : null,
    carriedFrom:    row.carried_from_blob_id ?? null,
    carriedFromWeek: row.carried_from_week ?? null,
    completedAt:    row.completed_at ?? null,
    completedLate:  row.completed_late ?? false,
    notes:          row.notes ?? null,
  };
}

function goalRowToBlob(row) {
  return {
    id:        row.blob_id ?? row.id,
    title:     row.title,
    emoji:     row.emoji ?? null,
    who:       row.who,
    period:    row.period,
    target:    row.target,
    goalType:  row.goal_type,
    active:    row.active,
    startDate: row.start_date ? String(row.start_date) : null,
    deadline:  row.deadline ? String(row.deadline) : null,
  };
}

// Lee missions + goals de tablas normalizadas; settings y metadatos de semana
// (label, epicGoal) siguen viniendo del blob. Fallback a blob si las tablas fallan.
export async function loadFromNormalized(coupleId) {
  const blob = await loadData(coupleId);
  if (!blob) return null;

  const [{ data: missionRows, error: mErr }, { data: goalRows, error: gErr }] = await Promise.all([
    supabase.from("missions").select("*").eq("couple_id", coupleId),
    supabase.from("goals").select("*").eq("couple_id", coupleId),
  ]);

  if (mErr) {
    console.error("[loadFromNormalized] missions error:", mErr.message);
    console.warn("[loadFromNormalized] fallback → blob (error de red en missions)");
    return blob;
  }
  if (gErr) {
    console.error("[loadFromNormalized] goals error:", gErr.message);
    console.warn("[loadFromNormalized] fallback → blob (error de red en goals)");
    return blob;
  }

  // Safety: si la tabla tiene 0 filas o está significativamente más escasa que el blob,
  // algo falla (RLS silencioso, tabla desactualizada, etc.) → fallback al blob.
  const blobMissionCount = Object.values(blob.weeks ?? {}).reduce(
    (sum, w) => sum + (w.missions?.length ?? 0), 0
  );
  if ((!missionRows || missionRows.length === 0) && blobMissionCount > 0) {
    console.warn(`[loadFromNormalized] tabla missions vacía pero blob tiene ${blobMissionCount} misiones → fallback a blob`);
    return blob;
  }
  if (blobMissionCount > 5 && missionRows.length < blobMissionCount * 0.8) {
    const pct = Math.round(missionRows.length / blobMissionCount * 100);
    console.warn(`[loadFromNormalized] tabla tiene solo ${pct}% de misiones vs blob (${missionRows.length}/${blobMissionCount}) → fallback por tabla desactualizada`);
    return blob;
  }

  // Reconstruir weeks: esqueleto del blob preserva label/epicGoal/weekNumber/year,
  // missions[] se reemplaza con los datos normalizados
  // Build goalIdMap: DB UUID → blob nanoid, so missions get the correct nanoid goalId
  const goalIdMap = new Map(
    (goalRows || []).filter(r => r.blob_id).map(r => [r.id, r.blob_id])
  );

  // Build blob mission index to restore fields the normalized table doesn't have yet
  // (endDate, endTime, createdAt, seriesStartWeek/Year). Without this, events lose
  // their multi-day duration on every load because end_date/end_time columns don't exist.
  const blobMissionMap = new Map();
  for (const wdata of Object.values(blob.weeks ?? {})) {
    for (const m of (wdata.missions ?? [])) {
      if (m.id) blobMissionMap.set(m.id, m);
    }
  }

  const weeks = {};
  for (const [wkey, wdata] of Object.entries(blob.weeks ?? {})) {
    weeks[wkey] = { ...wdata, missions: [] };
  }
  for (const row of missionRows) {
    const wkey = row.week_key;
    if (!weeks[wkey]) {
      weeks[wkey] = { weekNumber: row.week_number, year: row.year, label: "", epicObjective: "", workHours: { person1: 0, person2: 0 }, createdAt: Date.now(), missions: [] };
    }
    const m = missionRowToBlob(row, goalIdMap);
    const blobM = blobMissionMap.get(m.id);
    if (blobM) {
      if (blobM.endDate        != null) m.endDate        = blobM.endDate;
      if (blobM.endTime        != null) m.endTime        = blobM.endTime;
      if (blobM.createdAt      != null) m.createdAt      = blobM.createdAt;
      if (blobM.seriesStartWeek != null) m.seriesStartWeek = blobM.seriesStartWeek;
      if (blobM.seriesStartYear != null) m.seriesStartYear = blobM.seriesStartYear;
    }
    weeks[wkey].missions.push(m);
  }

  const goals = goalRows.map(goalRowToBlob);
  console.debug(`[loadFromNormalized] ${missionRows.length} misiones, ${goals.length} metas desde tablas`);
  return { ...blob, weeks, goals };
}

/**
 * saveData — guardado infalible
 *
 * FIX 1: El upsert ya no lanza error si el SELECT post-upsert devuelve vacío
 *         por restricciones de RLS. Verificamos el error real de Supabase,
 *         no la presencia de filas devueltas.
 *
 * FIX 2: Siempre guarda en localStorage ANTES del intento a Supabase.
 *         Si Supabase falla, el dato está a salvo localmente.
 *
 * FIX 3: Expone la función getLatestData para que saveWithRetry siempre
 *         use los datos más recientes al reintentar, no los datos stale
 *         del primer intento fallido.
 */
export async function saveData(appData, coupleId) {
  // Guardar siempre en local primero — el dato nunca se pierde
  saveLocalBackup(appData, coupleId);

  if (!coupleId) return;

  const { error } = await supabase
    .from("app_data")
    .upsert({ id: coupleId, data: appData });

  // FIX 1: Solo tiramos error si Supabase reporta un error real.
  // No comprobamos filas devueltas — RLS puede impedirlo aunque el upsert fue exitoso.
  if (error) {
    // Detectar sesión expirada para dar feedback específico al usuario
    if (error.code === "PGRST301" || error.message?.includes("JWT")) {
      throw Object.assign(new Error("Sesión expirada. Por favor vuelve a iniciar sesión."), { code: "SESSION_EXPIRED" });
    }
    throw new Error("Error al guardar: " + error.message);
  }
}

/**
 * saveWithRetry — reintentos con datos siempre frescos
 *
 * FIX 2: Acepta un getter `getLatestData` (función que devuelve el estado
 *        más reciente) además del dato inicial. En cada reintento usa los
 *        datos más actuales disponibles, evitando sobrescribir con datos stale.
 *
 * Uso desde App.jsx:
 *   saveWithRetry(data, coupleId, { getLatestData: () => appDataRef.current })
 *
 * Si no se pasa getLatestData, funciona igual que antes (compatible hacia atrás).
 */
export async function saveWithRetry(appData, coupleId, opts = {}) {
  const { retries = 3, baseDelay = 2000, getLatestData } = opts;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // En reintentos (attempt > 0), usar el estado más reciente si está disponible
      const dataToSave = (attempt > 0 && typeof getLatestData === "function")
        ? getLatestData()
        : appData;
      await saveData(dataToSave, coupleId);
      return;
    } catch (e) {
      lastErr = e;
      // No reintentar si es error de sesión — el usuario debe re-autenticarse
      if (e.code === "SESSION_EXPIRED") throw e;
      if (attempt < retries) await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)));
    }
  }
  console.error("[saveWithRetry] all attempts failed:", lastErr?.message);
  throw lastErr;
}

/* ── Realtime ──────────────────────────────────────────────────────────── */

/**
 * subscribeToUpdates — protección contra race condition
 *
 * FIX 3: Acepta un segundo parámetro `hasPendingSave` (función que devuelve
 *        true si hay un guardado local pendiente en cola). Si el usuario local
 *        tiene cambios sin guardar, ignoramos la actualización remota para
 *        no pisar su trabajo.
 *
 * Uso desde App.jsx:
 *   subscribeToUpdates(coupleId, onUpdate, () => saveQueueRef.current > 0)
 *
 * Si no se pasa hasPendingSave, funciona igual que antes (compatible hacia atrás).
 */
export function subscribeToUpdates(coupleId, onUpdate, hasPendingSave) {
  const channel = supabase
    .channel(`couple-${coupleId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_data", filter: `id=eq.${coupleId}` },
      payload => {
        const newData = payload.new?.data;
        if (!newData || !isValidAppData(newData)) return;
        // La versión viene en el payload de realtime — la propagamos para mantener
        // dataVersionRef en sync con la DB y evitar conflictos CAS falsos.
        const newVersion = typeof payload.new?.version === "number" ? payload.new.version : null;

        // FIX 3: Si hay un guardado pendiente local, ignorar la actualización remota.
        // El guardado pendiente prevalece — es el estado más reciente del usuario local.
        // (El rebase-on-conflict de saveWithCAS recupera los cambios de la pareja igualmente.)
        if (typeof hasPendingSave === "function" && hasPendingSave()) {
          console.debug("[Realtime] Ignorando update remoto: hay guardado local pendiente.");
          return;
        }

        saveLocalBackup(newData, coupleId);
        onUpdate(newData, newVersion);
      }
    )
    .subscribe();
  return channel;
}

/* ── Modo invitado (solo lectura, sin sesión) ─────────────────────────────── */

// Llama a la Edge Function get-shared-view — devuelve null si el link es
// inválido/revocado o si algo falla (nunca lanza, GuestView decide qué mostrar).
export async function fetchSharedView(coupleId, token) {
  try {
    const { data, error } = await supabase.functions.invoke("get-shared-view", { body: { coupleId, token } });
    if (error) { console.warn("[guest] fetchSharedView error:", error.message); return null; }
    return data;
  } catch (e) {
    console.warn("[guest] fetchSharedView failed:", e);
    return null;
  }
}

/* ── Chat ──────────────────────────────────────────────────────────────── */

export async function loadMessages(coupleId, limit = 60) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) { console.error("loadMessages error:", error); return []; }
  return data || [];
}

export async function sendMessage(coupleId, senderName, content, emoji = "💬") {
  const { error } = await supabase
    .from("messages")
    .insert({ couple_id: coupleId, sender_name: senderName, content, emoji });
  if (error) throw new Error("Send message failed: " + error.message);
}

// channelName debe ser único por suscriptor — dos canales con el mismo nombre
// sobre el mismo cliente fallan al suscribirse (ChatView y el contador de
// no-leídos en App conviven con nombres distintos).
export function subscribeToMessages(coupleId, onMessage, channelName = `chat-${coupleId}`) {
  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `couple_id=eq.${coupleId}` },
      payload => { if (payload.new) onMessage(payload.new); }
    )
    .subscribe();
  return channel;
}

// Repairs blob data where missions have goalId set to a DB UUID instead of the blob nanoid.
// Caused by read_from_normalized:true being active while missionRowToBlob used row.goal_id (UUID).
// Returns repaired data object if any missions were fixed, or null if no repair was needed.
export async function repairGoalIdLinks(coupleId, data) {
  const goalNanoids = new Set((data.goals || []).map(g => g.id));
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let hasCorrupted = false;
  for (const week of Object.values(data.weeks || {})) {
    for (const m of week.missions || []) {
      if (m.goalId && UUID_RE.test(m.goalId) && !goalNanoids.has(m.goalId)) {
        hasCorrupted = true;
        break;
      }
    }
    if (hasCorrupted) break;
  }
  if (!hasCorrupted) return null;

  const { data: goalRows } = await supabase
    .from("goals")
    .select("id, blob_id")
    .eq("couple_id", coupleId);

  const uuidToNanoid = new Map(
    (goalRows || []).filter(r => r.blob_id).map(r => [r.id, r.blob_id])
  );

  let repaired = 0;
  const weeks = {};
  for (const [wkey, week] of Object.entries(data.weeks || {})) {
    const missions = (week.missions || []).map(m => {
      if (m.goalId && UUID_RE.test(m.goalId) && !goalNanoids.has(m.goalId)) {
        const nanoid = uuidToNanoid.get(m.goalId);
        if (nanoid) { repaired++; return { ...m, goalId: nanoid }; }
      }
      return m;
    });
    weeks[wkey] = { ...week, missions };
  }

  if (repaired === 0) return null;
  console.info(`[repairGoalIdLinks] repaired ${repaired} missions with corrupted goalId (UUID→nanoid)`);
  return { ...data, weeks };
}

export default supabase;
