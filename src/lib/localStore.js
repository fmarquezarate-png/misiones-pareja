// Persistencia local DURABLE del blob de la app.
//
// Por qué existe: localStorage (~5MB, síncrono) revienta con QuotaExceededError
// cuando el blob lleva fotos en base64, y iOS lo desaloja por presión/ITP. Cuando
// eso pasa NO queda copia local → una carga con mala señal u offline cae a la
// pantalla de error y la app no se puede usar. IndexedDB aguanta cientos de MB y
// sobrevive mejor, así que es la fuente durable; localStorage se mantiene como
// caché rápida (lectura síncrona en el arranque). Escribimos en ambas y leemos
// la más reciente.

const DB_NAME = "misiones-pareja";
const STORE = "backups";
const DB_VERSION = 1;

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("no-indexeddb")); return; }
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); }
    catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("indexeddb-open-failed"));
    req.onblocked = () => reject(new Error("indexeddb-blocked"));
  });
  // Si falla la apertura, permitir reintentar en la próxima llamada.
  _dbPromise.catch(() => { _dbPromise = null; });
  return _dbPromise;
}

export async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("idb-set-failed"));
    tx.onabort = () => reject(tx.error || new Error("idb-set-aborted"));
  });
}

export async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error || new Error("idb-get-failed"));
  });
}

export async function idbDel(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("idb-del-failed"));
  });
}

// Elige la copia más reciente entre dos { data, ts }. Puro y testeable — el
// corazón de "no perder ni degradar datos" cuando IDB y localStorage divergen.
export function pickFreshest(a, b) {
  const okA = a && a.data;
  const okB = b && b.data;
  if (!okA && !okB) return null;
  if (!okA) return b;
  if (!okB) return a;
  const ta = Date.parse(a.ts) || 0;
  const tb = Date.parse(b.ts) || 0;
  return ta >= tb ? a : b;
}
