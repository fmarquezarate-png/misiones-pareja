const STORAGE_KEY = "mp_flags";

let _cache = null;

function invalidateCache() {
  _cache = null;
}

const DEFAULTS = {
  push_enabled: true,
  expenses_v2_enabled: false,
  stats_insights_enabled: true,
  goals_drilldown_enabled: true,
  dual_write_normalized: true,
  cas_version_check: true,
  idb_offline_queue: false,
  // true desde v4.2.1: 9 huérfanas eliminadas por Externo (01/06), tabla 100% consistente con blob.
  // Dual-write cubre todos los paths (v4.1.3). Safety check 80% activo en loadFromNormalized.
  read_from_normalized: true,
};

function loadOverrides() {
  if (_cache !== null) return _cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _cache = raw ? JSON.parse(raw) : {};
  } catch {
    _cache = {};
  }
  return _cache;
}

export function isEnabled(flagName) {
  const overrides = loadOverrides();
  return flagName in overrides ? Boolean(overrides[flagName]) : Boolean(DEFAULTS[flagName] ?? false);
}

export function setFlag(flagName, value) {
  const overrides = loadOverrides();
  overrides[flagName] = value;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  invalidateCache();
}

export function getAllFlags() {
  const overrides = loadOverrides();
  return { ...DEFAULTS, ...overrides };
}

export function resetFlags() {
  localStorage.removeItem(STORAGE_KEY);
  invalidateCache();
}

if (typeof window !== "undefined") window.__mpFlags = { isEnabled, setFlag, getAllFlags, resetFlags };

if (import.meta.env.DEV) {
  console.log("[flags] Flags activos:", getAllFlags());
}
