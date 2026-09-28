// Tiempo actual (Open-Meteo) y ubicación del dispositivo.
//
// · La ubicación vive en ESTE dispositivo (localStorage), no en los datos de
//   la pareja: es una preferencia de cada móvil y cada uno está donde está.
//   Hasta que la persona la activa, se usa Barcelona — y se dice.
// · Open-Meteo: sin clave y con CORS (regla de fuentes externas, CLAUDE.md
//   §5). Caché de 30 min: el tiempo no cambia cada minuto y así no se pide
//   en cada visita. Todo con tiempo límite (regla de red, el cuelgue de iOS).

import { withTimeout } from "../utils.js";
import { UBICACION_DEFECTO } from "./cielo.js";

const CLAVE_UBI = "mp-ubicacion";
const CLAVE_TIEMPO = "mp-tiempo";
const TTL_MS = 30 * 60e3;

export function ubicacion() {
  try {
    const u = JSON.parse(localStorage.getItem(CLAVE_UBI) || "null");
    if (u && Number.isFinite(u.lat) && Number.isFinite(u.lon)) return { ...u, porDefecto: false };
  } catch { /* sin almacenamiento */ }
  return UBICACION_DEFECTO;
}

/** Pide la ubicación al navegador (sale el aviso de permiso). */
export function pedirUbicacion() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("sin_geolocalizacion")); return; }
    navigator.geolocation.getCurrentPosition(
      p => {
        // Con ~1 km de precisión basta para el tiempo, y es menos dato guardado.
        const u = { lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100, nombre: "Tu ubicación" };
        try { localStorage.setItem(CLAVE_UBI, JSON.stringify(u)); localStorage.removeItem(CLAVE_TIEMPO); } catch { /* */ }
        resolve({ ...u, porDefecto: false });
      },
      e => reject(new Error(e.code === 1 ? "denegada" : "no_disponible")),
      { timeout: 10000, maximumAge: 6 * 3600e3 },
    );
  });
}

/** @returns {{ codigo:number|null, temp:number|null, fuente:'open-meteo'|'cache'|'ninguna', hora:number|null }} */
export async function tiempoActual({ lat, lon }) {
  let cache = null;
  try { cache = JSON.parse(localStorage.getItem(CLAVE_TIEMPO) || "null"); } catch { /* */ }
  const mismaZona = cache && Math.abs(cache.lat - lat) < 0.05 && Math.abs(cache.lon - lon) < 0.05;
  if (mismaZona && Date.now() - cache.hora < TTL_MS) return { ...cache, fuente: "cache" };

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto&forecast_days=1`;
    const r = await withTimeout(fetch(url), 8000, "open-meteo");
    if (!r.ok) throw new Error("http_" + r.status);
    const j = await r.json();
    const out = { lat, lon, codigo: j?.current?.weather_code ?? null, temp: j?.current?.temperature_2m ?? null, hora: Date.now() };
    try { localStorage.setItem(CLAVE_TIEMPO, JSON.stringify(out)); } catch { /* */ }
    return { ...out, fuente: "open-meteo" };
  } catch {
    // Sin red: la última lectura, si es de hace menos de 6 h; si no, nada.
    if (mismaZona && Date.now() - cache.hora < 6 * 3600e3) return { ...cache, fuente: "cache" };
    return { lat, lon, codigo: null, temp: null, hora: null, fuente: "ninguna" };
  }
}
