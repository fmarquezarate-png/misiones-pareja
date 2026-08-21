// Fotos de semana FUERA del blob (v5.14.0). Antes cada foto de semana se
// guardaba como base64 dentro de app_data.data → el blob creció a ~4MB y cada
// guardado lo reescribía entero (+ copia a backups) → timeouts de 8s en el
// servidor → "error al guardar". Ahora las fotos van al bucket público `photos`
// de Storage y en el blob queda solo la URL (`week.photoUrl`).

import supabase from "../supabase.js";
import { uid } from "../utils.js";

const BUCKET = "photos";

// dataURL base64 → Blob (para subir a Storage). Puro salvo por atob/Blob.
export function dataUrlToBlob(dataUrl) {
  const s = String(dataUrl);
  const comma = s.indexOf(",");
  const meta = s.slice(0, comma);
  const b64 = s.slice(comma + 1);
  const mime = (meta.match(/data:([^;]+)/) || [])[1] || "image/jpeg";
  const bin = globalThis.atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// Extensión de archivo a partir del mime (jpeg→jpg). Puro.
export function extFromMime(mime) {
  const e = String(mime || "").split("/")[1] || "jpg";
  return e === "jpeg" ? "jpg" : e.replace(/[^a-z0-9]/gi, "") || "jpg";
}

// ¿Es una foto que todavía vive como base64 en el blob (pendiente de migrar)?
export function isInlinePhoto(v) {
  return typeof v === "string" && v.startsWith("data:");
}

// Aplica una migración de fotos de semana: para cada clave en urlMap cuya foto
// SIGUE siendo base64, sustituye `photo` (base64) por `photoUrl` (Storage). Puro.
// El guard `isInlinePhoto` evita pisar una foto nueva que llegó por realtime a
// mitad de la migración. Nunca corrompe `weeks`.
export function applyWeekPhotoMigration(weeks, urlMap) {
  const nw = { ...(weeks || {}) };
  for (const k of Object.keys(urlMap || {})) {
    if (nw[k] && isInlinePhoto(nw[k].photo)) nw[k] = { ...nw[k], photoUrl: urlMap[k], photo: null };
  }
  return nw;
}

// Igual para el array de cápsulas del tiempo (identificadas por id). Puro.
export function applyCapsulePhotoMigration(capsules, urlMap) {
  return (capsules || []).map(c =>
    (c && isInlinePhoto(c.photo) && (urlMap || {})[c.id])
      ? { ...c, photoUrl: urlMap[c.id], photo: null }
      : c
  );
}

// Sube una foto (Blob o dataURL) al bucket `photos` bajo `{userId}/{kind}/...` y
// devuelve su URL pública. `{userId}/` lo EXIGE la RLS del bucket. Lanza si falla.
export async function uploadPhoto(userId, kind, key, fileOrDataUrl) {
  if (!userId) throw new Error("uploadPhoto: sin userId");
  const blob = typeof fileOrDataUrl === "string" ? dataUrlToBlob(fileOrDataUrl) : fileOrDataUrl;
  const safeKind = String(kind || "misc").replace(/[^\w-]/g, "") || "misc";
  const safeKey = String(key || "x").replace(/[^\w-]/g, "");
  const path = `${userId}/${safeKind}/${safeKey}-${uid()}.${extFromMime(blob.type)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
  if (error) throw new Error("upload: " + error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("upload: sin publicUrl");
  return data.publicUrl;
}

// Foto de semana (kind="weeks") — se mantiene la firma para los callers existentes.
export function uploadWeekPhoto(userId, weekKey, fileOrDataUrl) {
  return uploadPhoto(userId, "weeks", weekKey, fileOrDataUrl);
}

// Foto de cápsula del tiempo (kind="capsules").
export function uploadCapsulePhoto(userId, capsuleId, fileOrDataUrl) {
  return uploadPhoto(userId, "capsules", capsuleId, fileOrDataUrl);
}

// Extrae el path del objeto a partir de su URL pública del bucket `photos`. Puro.
// Devuelve null si la URL no apunta a este bucket (p.ej. es todavía un dataURL).
export function storagePathFromUrl(url) {
  const s = String(url || "");
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = s.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(s.slice(i + marker.length).split("?")[0]) || null;
}

// Borra una foto de Storage a partir de su URL pública. Best-effort (no lanza):
// una foto huérfana no debe romper la operación del usuario.
export async function deletePhotoByUrl(url) {
  const path = storagePathFromUrl(url);
  if (!path) return false;
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    return !error;
  } catch { return false; }
}
