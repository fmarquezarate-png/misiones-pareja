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

// Sube una foto (Blob o dataURL) al bucket `photos` y devuelve su URL pública.
// userId = carpeta propia (lo exige la RLS del bucket: `{userId}/...`). Lanza si falla.
export async function uploadWeekPhoto(userId, weekKey, fileOrDataUrl) {
  if (!userId) throw new Error("uploadWeekPhoto: sin userId");
  const blob = typeof fileOrDataUrl === "string" ? dataUrlToBlob(fileOrDataUrl) : fileOrDataUrl;
  const path = `${userId}/weeks/${String(weekKey).replace(/[^\w-]/g, "")}-${uid()}.${extFromMime(blob.type)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
  if (error) throw new Error("upload: " + error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("upload: sin publicUrl");
  return data.publicUrl;
}
