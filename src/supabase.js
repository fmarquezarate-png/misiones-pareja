import { createClient } from "@supabase/supabase-js";

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
      redirectTo: "https://the-shared-calendar.netlify.app",
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) console.error("signInWithGoogle error:", error);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error("signOut error:", error);
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return subscription;
}

/* ── Couple helpers ────────────────────────────────────────────────────── */

export async function getMyCoupleId() {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return null;
  const { data, error } = await supabase
    .from("couple_members")
    .select("couple_id, person_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) { console.error("getMyCoupleId error:", error); return null; }
  return data;
}

export async function createCouple(code, personName) {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return { error: "No hay sesión activa" };

  const { data: existing } = await supabase
    .rpc("find_couple_by_code", { p_code: code.toUpperCase() });

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

  if (memberErr) return { error: memberErr.message };

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

function saveLocalBackup(appData, coupleId) {
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
        if (!parsed.weeks || !parsed.settings) reject(new Error("Formato inválido"));
        else resolve(parsed);
      } catch { reject(new Error("JSON inválido")); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/* ── Supabase CRUD ─────────────────────────────────────────────────────── */

export async function loadData(coupleId, opts = {}) {
  try {
    if (!opts.force) {
      const local = loadLocalBackup(coupleId);
      if (local?.data && isValidAppData(local.data)) {
        const { data: check, error: checkErr } = await supabase
          .rpc("should_reload_from_db", { p_couple_id: coupleId });

        if (!checkErr && check?.should_reload === false) {
          console.debug("[loadData] Sirviendo desde cache local. Razón:", check.reason);
          return local.data;
        }
      }
    }

    const { data: rows, error } = await supabase
      .from("app_data")
      .select("data")
      .eq("id", coupleId)
      .limit(1);

    if (error) { console.error("loadData error:", error.message); return null; }

    const result = rows?.[0]?.data ?? null;
    if (result) {
      saveLocalBackup(result, coupleId);
      supabase.rpc("mark_cache_loaded", { p_couple_id: coupleId }).catch(e =>
        console.warn("mark_cache_loaded error (non-fatal):", e)
      );
    }
    return result;
  } catch (e) {
    console.error("loadData exception:", e);
    return null;
  }
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

export function isValidAppData(d) {
  return !!(d && typeof d === "object" && d.weeks && typeof d.weeks === "object" && d.settings);
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

        // FIX 3: Si hay un guardado pendiente local, ignorar la actualización remota.
        // El guardado pendiente prevalece — es el estado más reciente del usuario local.
        if (typeof hasPendingSave === "function" && hasPendingSave()) {
          console.debug("[Realtime] Ignorando update remoto: hay guardado local pendiente.");
          return;
        }

        saveLocalBackup(newData, coupleId);
        onUpdate(newData);
      }
    )
    .subscribe();
  return channel;
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

export function subscribeToMessages(coupleId, onMessage) {
  const channel = supabase
    .channel(`chat-${coupleId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `couple_id=eq.${coupleId}` },
      payload => { if (payload.new) onMessage(payload.new); }
    )
    .subscribe();
  return channel;
}

export default supabase;
