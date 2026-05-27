const STORAGE_KEY = "mp_flags";

const DEFAULTS = {
  push_enabled: true,
  expenses_v2_enabled: false,
  stats_insights_enabled: true,
  goals_drilldown_enabled: true,
  dual_write_normalized: true,
  // Temporalmente desactivado hasta que Externo deshabilite los triggers de push
  // en app_data (trg_push_on_app_data_update + trg_notify_push_on_app_data_update).
  // Esos triggers corren net.http_post dentro de la misma transacción FOR UPDATE
  // de save_app_data_cas → extienden el lock → timeouts intermitentes en saves.
  // Reactivar una vez confirmado por Externo que los triggers están deshabilitados.
  cas_version_check: false,
  idb_offline_queue: false,
  read_from_normalized: true, // Sprint G-2 completo: tabla missions sincronizada via dual-write (v3.9.2+). Backfill verificado 26/05 — 222 filas vs 220 blob. Fuente de verdad: tabla missions.
};

function loadOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function isEnabled(flagName) {
  const overrides = loadOverrides();
  return flagName in overrides ? Boolean(overrides[flagName]) : Boolean(DEFAULTS[flagName] ?? false);
}

export function setFlag(flagName, value) {
  const overrides = loadOverrides();
  overrides[flagName] = value;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function getAllFlags() {
  const overrides = loadOverrides();
  return { ...DEFAULTS, ...overrides };
}

export function resetFlags() {
  localStorage.removeItem(STORAGE_KEY);
}

if (typeof window !== "undefined") window.__mpFlags = { isEnabled, setFlag, getAllFlags, resetFlags };

if (import.meta.env.DEV) {
  console.log("[flags] Flags activos:", getAllFlags());
}
