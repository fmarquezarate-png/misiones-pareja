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
  // ⚠️ false desde v4.5.2: `patchM` (edición de campos en la vista de semana actual)
  // NO sincronizaba la tabla `missions` — 4º black hole no documentado. Con el flag en
  // true, toda edición de fecha/hora/persona desde la vista principal desaparecía al
  // recargar (la app leía la versión vieja de la tabla). Además la tabla carece de
  // columnas endDate/endTime/goalId. El blob es la única fuente de verdad completa.
  // No reactivar hasta: (1) todos los mutadores dual-write, (2) schema completo, (3) Scanner sign-off.
  read_from_normalized: false,
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
