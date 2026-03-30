import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ROW_ID = "couple-missions";
const LOCAL_KEY = "couple-missions-backup";
const LOCAL_TS_KEY = "couple-missions-backup-ts";

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

/* ── Supabase CRUD ───────────────────────────────────────────────── */
export async function loadData() {
  try {
    const { data, error } = await supabase
      .from("app_data")
      .select("data")
      .eq("id", ROW_ID)
      .single();

    if (error) {
      console.error("Load error:", error);
      // Fallback: try local backup when Supabase fails
      const local = loadLocalBackup();
      if (local) {
        console.warn("Using local backup from", local.ts);
        return local.data;
      }
      return null;
    }

    const result = data?.data || null;
    // Save local backup whenever we successfully load from Supabase
    if (result) saveLocalBackup(result);
    return result;
  } catch (e) {
    console.error(e);
    // Fallback: try local backup
    const local = loadLocalBackup();
    if (local) {
      console.warn("Using local backup from", local.ts);
      return local.data;
    }
    return null;
  }
}

export async function saveData(appData) {
  // Always save local backup first (instant, synchronous)
  saveLocalBackup(appData);
  try {
    const { error } = await supabase
      .from("app_data")
      .upsert({ id: ROW_ID, data: appData, updated_at: new Date().toISOString() });

    if (error) console.error("Save error:", error);
  } catch (e) {
    console.error(e);
  }
}
