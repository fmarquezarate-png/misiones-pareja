import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ROW_ID = "couple-missions";

export async function loadData() {
  try {
    const { data, error } = await supabase
      .from("app_data")
      .select("data")
      .eq("id", ROW_ID)
      .single();

    if (error) {
      console.error("Load error:", error);
      return null;
    }

    return data?.data || null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function saveData(appData) {
  try {
    const { error } = await supabase
      .from("app_data")
      .upsert({ id: ROW_ID, data: appData, updated_at: new Date().toISOString() });

    if (error) console.error("Save error:", error);
  } catch (e) {
    console.error(e);
  }
}
