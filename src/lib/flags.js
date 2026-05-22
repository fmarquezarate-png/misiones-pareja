const STORAGE_KEY = "mp_flags";

const DEFAULTS = {
  push_enabled: true,
  expenses_v2_enabled: false,
  stats_insights_enabled: true,
  goals_drilldown_enabled: true,
  dual_write_normalized: true,
  cas_version_check: true,
  idb_offline_queue: false,
  read_from_normalized: false, // Sprint G-2: flip lectura blob → tablas normalizadas (pendiente implementación)
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
