// Interruptores de la mascota.
//
// Modo pruebas: vista previa de etapas y cambio de especie, para revisar los
// sprites. Fran (28/09/2026): «en el futuro no: solo debería ver el estado
// REAL de mi mascota». Desde la v6.0.0 viene APAGADO; queda un interruptor
// discreto en Salud → Datos y conexión, solo para revisar el aspecto de las
// etapas. Es una preferencia de este dispositivo (localStorage): no cambia
// nada de la mascota real ni de sus datos.
const CLAVE = "mp-pet-pruebas";

export function modoPruebas() {
  try { return localStorage.getItem(CLAVE) === "1"; } catch { return false; }
}
export function fijarModoPruebas(on) {
  try { if (on) localStorage.setItem(CLAVE, "1"); else localStorage.removeItem(CLAVE); } catch { /* modo privado: no se guarda */ }
}
