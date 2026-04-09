import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Keys are couple-specific so each partner's browser stores their shared data
// correctly and old solo-mode backups don't interfere.
const localKey    = id => `couple-missions-${id}`;
const localTsKey  = id => `couple-missions-${id}-ts`;

/* ── Auth ────────────────────────────────────────────────────────── */

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "https://unrivaled-rugelach-43b291.netlify.app",
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
  return subscription; // call subscription.unsubscribe() to clean up
}

/* ── Couple helpers ──────────────────────────────────────────────── */

export async function getMyCoupleId() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("couple_members")
    .select("couple_id, person_name")
    .eq("user_id", session.user.id)
    .maybeSingle(); // maybeSingle: no error when row doesn't exist
  if (error) { console.error("getMyCoupleId error:", error); return null; }
  return data; // null if not in a couple yet
}

export async function createCouple(code, personName) {
  const session = await getSession();
  if (!session) return { error: "No hay sesión activa" };

  // Check code is not taken
  const { data: existing } = await supabase
    .from("couples")
    .select("id")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (existing) return { error: "Ese código ya está en uso, elige otro" };

  // Create couple row
  const { data: couple, error: coupleErr } = await supabase
    .from("couples")
    .insert({
      code: code.toUpperCase(),
      name: `Pareja ${code.toUpperCase()}`,
      owner_user_id: session.user.id,
    })
    .select("id")
    .single();

  if (coupleErr) return { error: coupleErr.message };

  // Add creator as member
  const { error: memberErr } = await supabase
    .from("couple_members")
    .insert({ user_id: session.user.id, couple_id: couple.id, person_name: personName });

  if (memberErr) return { error: memberErr.message };

  return { couple_id: couple.id };
}

export async function joinCouple(code, personName) {
  const session = await getSession();
  if (!session) return { error: "No hay sesión activa" };

  // Find couple by code
  const { data: couple, error: findErr } = await supabase
    .from("couples")
    .select("id")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (findErr) { console.error("joinCouple error:", findErr); return { error: "Error al buscar la pareja" }; }
  if (!couple) return { error: "Código de pareja no encontrado" };

  // Check not already 2 members
  const { data: members } = await supabase
    .from("couple_members")
    .select("user_id")
    .eq("couple_id", couple.id);

  if (members && members.length >= 2) return { error: "Esta pareja ya tiene dos miembros" };

  // Join
  const { error: memberErr } = await supabase
    .from("couple_members")
    .insert({ user_id: session.user.id, couple_id: couple.id, person_name: personName });

  if (memberErr) return { error: memberErr.message };

  return { couple_id: couple.id };
}

/* ── localStorage helpers ────────────────────────────────────────── */

function saveLocalBackup(appData, coupleId) {
  try {
    const key = coupleId ? localKey(coupleId) : "couple-missions-backup";
    localStorage.setItem(key, JSON.stringify(appData));
    localStorage.setItem(coupleId ? localTsKey(coupleId) : "couple-missions-backup-ts", new Date().toISOString());
  } catch { /* quota exceeded – silent */ }
}

export function loadLocalBackup(coupleId) {
  try {
    const key = coupleId ? localKey(coupleId) : "couple-missions-backup";
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return { data: JSON.parse(raw), ts: localStorage.getItem(coupleId ? localTsKey(coupleId) : "couple-missions-backup-ts") };
  } catch { return null; }
}

/* ── Export / Import ─────────────────────────────────────────────── */

export function exportData(appData) {
  const blob = new Blob([JSON.stringify(appData, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `couple-missions-backup-${new Date().toISOString().slice(0,10)}.json`;
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

/* ── Supabase CRUD (couple-aware) ────────────────────────────────── */

export async function loadData(coupleId) {
  try {
    // limit(1) + array instead of .maybeSingle() → never throws on duplicates
    const { data: rows, error } = await supabase
      .from("app_data")
      .select("data")
      .eq("couple_id", coupleId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Load error:", error);
      const local = loadLocalBackup(coupleId);
      if (local) { console.warn("Using local backup from", local.ts); return local.data; }
      return null;
    }

    const result = rows?.[0]?.data ?? null;
    if (result) saveLocalBackup(result, coupleId); // couple-specific cache
    return result;
  } catch (e) {
    console.error("Load exception:", e);
    const local = loadLocalBackup(coupleId);
    if (local) { console.warn("Using local backup from", local.ts); return local.data; }
    return null;
  }
}

export async function saveData(appData, coupleId) {
  saveLocalBackup(appData, coupleId); // couple-specific cache
  if (!coupleId) return;

  try {
    // SELECT first then INSERT or UPDATE → works without UNIQUE constraint
    const { data: existing } = await supabase
      .from("app_data")
      .select("couple_id")
      .eq("couple_id", coupleId)
      .limit(1);

    const ts = new Date().toISOString();
    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from("app_data")
        .update({ data: appData, updated_at: ts })
        .eq("couple_id", coupleId);
      if (error) console.error("Save (update) error:", error);
    } else {
      const { error } = await supabase
        .from("app_data")
        .insert({ couple_id: coupleId, data: appData, updated_at: ts });
      if (error) console.error("Save (insert) error:", error);
    }
  } catch (e) {
    console.error("Save exception:", e);
  }
}

/* ── Realtime: notify when partner saves ─────────────────────────── */

export function subscribeToUpdates(coupleId, onUpdate) {
  // Listen to "*" (INSERT + UPDATE + DELETE) so the partner gets notified
  // even on the very first save (INSERT), not only on subsequent saves (UPDATE).
  const channel = supabase
    .channel(`couple-${coupleId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_data", filter: `couple_id=eq.${coupleId}` },
      payload => {
        const newData = payload.new?.data;
        if (newData) onUpdate(newData);
      }
    )
    .subscribe();
  return channel; // call supabase.removeChannel(channel) to unsubscribe
}

export default supabase;
