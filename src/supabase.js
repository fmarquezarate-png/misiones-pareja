import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const LOCAL_KEY = "couple-missions-backup";
const LOCAL_TS_KEY = "couple-missions-backup-ts";
const LEGACY_ROW_ID = "couple-missions";

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
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
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

/* ── Auth ────────────────────────────────────────────────────────── */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) console.error("Sign-in error:", error);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error("Sign-out error:", error);
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) { console.error("Session error:", error); return null; }
  return data?.session || null;
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return {
    unsubscribe: () => data?.subscription?.unsubscribe?.(),
  };
}

/* ── Couples ─────────────────────────────────────────────────────── */
// Schema expected:
//   couples:         id (uuid pk) · code (text unique) · data (jsonb) · updated_at (timestamptz)
//   couple_members:  couple_id (uuid fk) · user_id (uuid fk auth.users) · person_name (text)
//                    primary key (couple_id, user_id)
//   RLS: a user can read/write couples/couple_members rows whose couple_id
//        exists in couple_members where user_id = auth.uid().

export async function getMyCoupleId() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("couple_members")
    .select("couple_id, person_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) { console.error("getMyCoupleId error:", error); return null; }
  if (!data) return null;
  return { couple_id: data.couple_id, person_name: data.person_name };
}

export async function createCouple(code, personName) {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return { error: "No hay sesión activa" };

  // Check if code already exists
  const { data: existing } = await supabase
    .from("couples")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (existing) return { error: "Ese código ya está en uso. Elige otro." };

  // Create couple
  const { data: couple, error: cErr } = await supabase
    .from("couples")
    .insert({ code, data: null })
    .select("id")
    .single();
  if (cErr) { console.error("createCouple error:", cErr); return { error: "No se pudo crear la pareja." }; }

  // Add creator as member
  const { error: mErr } = await supabase
    .from("couple_members")
    .insert({ couple_id: couple.id, user_id: user.id, person_name: personName });
  if (mErr) { console.error("member insert error:", mErr); return { error: "No se pudo registrar al miembro." }; }

  return { couple_id: couple.id };
}

export async function joinCouple(code, personName) {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return { error: "No hay sesión activa" };

  // Find couple by code
  const { data: couple, error: fErr } = await supabase
    .from("couples")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (fErr) { console.error("joinCouple lookup error:", fErr); return { error: "No se pudo buscar la pareja." }; }
  if (!couple) return { error: "Código no encontrado. Comprueba con tu pareja." };

  // Insert (or upsert) member
  const { error: mErr } = await supabase
    .from("couple_members")
    .upsert(
      { couple_id: couple.id, user_id: user.id, person_name: personName },
      { onConflict: "couple_id,user_id" }
    );
  if (mErr) { console.error("member upsert error:", mErr); return { error: "No se pudo unirse a la pareja." }; }

  return { couple_id: couple.id };
}

/* ── Realtime sync ───────────────────────────────────────────────── */
export function subscribeToUpdates(coupleId, callback) {
  if (!coupleId) return null;
  const channel = supabase
    .channel(`couples:${coupleId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "couples", filter: `id=eq.${coupleId}` },
      payload => { callback(payload?.new?.data || null); }
    )
    .subscribe();
  return channel;
}

/* ── Supabase CRUD (couple-scoped) ───────────────────────────────── */
export async function loadData(coupleId) {
  // Legacy single-row mode (no coupleId): keep for backup/import flow
  if (!coupleId) {
    try {
      const { data, error } = await supabase
        .from("app_data")
        .select("data")
        .eq("id", LEGACY_ROW_ID)
        .single();
      if (error) {
        const local = loadLocalBackup();
        return local ? local.data : null;
      }
      const result = data?.data || null;
      if (result) saveLocalBackup(result);
      return result;
    } catch {
      const local = loadLocalBackup();
      return local ? local.data : null;
    }
  }

  try {
    const { data, error } = await supabase
      .from("couples")
      .select("data")
      .eq("id", coupleId)
      .single();

    if (error) {
      console.error("Load error:", error);
      const local = loadLocalBackup();
      if (local) {
        console.warn("Using local backup from", local.ts);
        return local.data;
      }
      return null;
    }

    const result = data?.data || null;
    if (result) saveLocalBackup(result);
    return result;
  } catch (e) {
    console.error(e);
    const local = loadLocalBackup();
    if (local) {
      console.warn("Using local backup from", local.ts);
      return local.data;
    }
    return null;
  }
}

export async function saveData(appData, coupleId) {
  // Always save local backup first (instant, synchronous)
  saveLocalBackup(appData);

  // Legacy single-row mode: keep for backup/import flow
  if (!coupleId) {
    try {
      const { error } = await supabase
        .from("app_data")
        .upsert({ id: LEGACY_ROW_ID, data: appData, updated_at: new Date().toISOString() });
      if (error) console.error("Save error:", error);
    } catch (e) {
      console.error(e);
    }
    return;
  }

  try {
    const { error } = await supabase
      .from("couples")
      .update({ data: appData, updated_at: new Date().toISOString() })
      .eq("id", coupleId);
    if (error) console.error("Save error:", error);
  } catch (e) {
    console.error(e);
  }
}

export default supabase;
