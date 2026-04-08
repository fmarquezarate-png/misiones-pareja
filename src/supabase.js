import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const LOCAL_KEY    = "couple-missions-backup";
const LOCAL_TS_KEY = "couple-missions-backup-ts";

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

function saveLocalBackup(appData) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(appData));
    localStorage.setItem(LOCAL_TS_KEY, new Date().toISOString());
  } catch { /* quota exceeded – silent */ }
}

export function loadLocalBackup() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return { data: JSON.parse(raw), ts: localStorage.getItem(LOCAL_TS_KEY) };
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
    const { data, error } = await supabase
      .from("app_data")          // ← app_data, not couples
      .select("data")
      .eq("couple_id", coupleId)
      .maybeSingle();            // null (not error) when row doesn't exist yet

    if (error) {
      console.error("Load error:", error);
      const local = loadLocalBackup();
      if (local) { console.warn("Using local backup from", local.ts); return local.data; }
      return null;
    }

    const result = data?.data || null;
    if (result) saveLocalBackup(result);
    return result;
  } catch (e) {
    console.error(e);
    const local = loadLocalBackup();
    if (local) { console.warn("Using local backup from", local.ts); return local.data; }
    return null;
  }
}

export async function saveData(appData, coupleId) {
  saveLocalBackup(appData);
  if (!coupleId) return; // no coupleId = no-op in v2.0.0

  try {
    const { error } = await supabase
      .from("app_data")
      .upsert(
        { couple_id: coupleId, data: appData, updated_at: new Date().toISOString() },
        { onConflict: "couple_id" } // ← tell Supabase which col to check for duplicates
      );
    if (error) console.error("Save error:", error);
  } catch (e) {
    console.error(e);
  }
}

/* ── Realtime: notify when partner saves ─────────────────────────── */

export function subscribeToUpdates(coupleId, onUpdate) {
  const channel = supabase
    .channel(`couple-${coupleId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "app_data", filter: `couple_id=eq.${coupleId}` },
      payload => { onUpdate(payload.new?.data); }
    )
    .subscribe();
  return channel; // call supabase.removeChannel(channel) to unsubscribe
}

export default supabase;
