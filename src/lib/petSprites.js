// Qué animación toca pintar, según mascota, etapa y ánimo.
//
// El problema: no todas las etapas traen todas las animaciones. Solo Nix Jr
// tiene "cansado", "llorar", "alegría" y "celebración"; los huevos solo tienen
// "idle" (y Broot, además, "eclosión"). Si el motor dice "cansado" y la etapa
// no lo tiene, hay que caer en la animación más parecida — nunca en un hueco
// ni en un sprite roto. Cada ánimo tiene su cadena de alternativas, y el
// último recurso es siempre una animación que existe.

export const PREFERENCIAS = {
  durmiendo:  ["dormir", "cansado", "triste", "feliz", "idle"],
  entrenando: ["entrenar", "alegria", "feliz", "idle"],
  celebrando: ["celebracion", "alegria", "feliz", "idle"],
  feliz:      ["feliz", "alegria", "idle"],
  normal:     ["feliz", "idle"],
  cansado:    ["cansado", "dormir", "triste", "feliz", "idle"],
  triste:     ["triste", "llorar", "cansado", "feliz", "idle"],
};

/**
 * @param {object} manifest   public/mascotas/manifest.json
 * @param {string} especie    "broot" | "nix"
 * @param {string} etapa      "huevo" | "jr" | "pro" | "prime" | "upf"
 * @param {string} animo      uno de PREFERENCIAS
 * @returns {{ id, src, frames, fps, loop } | null}
 */
export function elegirAnimacion(manifest, especie, etapa, animo) {
  const st = manifest?.pets?.[especie]?.stages?.[etapa];
  if (!st?.anims) return null;
  // El huevo no tiene ánimos: siempre su idle (la eclosión se pinta aparte).
  const cadena = etapa === "huevo" ? ["idle"] : (PREFERENCIAS[animo] || PREFERENCIAS.normal);
  for (const id of cadena) {
    const a = st.anims[id];
    if (a) return { id, ...a };
  }
  // Último recurso: la primera que exista. Mejor algo que nada.
  const [id, a] = Object.entries(st.anims)[0] || [];
  return id ? { id, ...a } : null;
}

export function retrato(manifest, especie, etapa) {
  return manifest?.pets?.[especie]?.stages?.[etapa]?.portrait || null;
}

// Nombre de la especie tal como viene en el manifest.
export function nombreEspecie(manifest, especie) {
  return manifest?.pets?.[especie]?.name || especie;
}

// ── URLs versionadas ────────────────────────────────────────────────────────
// El service worker sirve los sprites con CacheFirst (un año): sin versión en
// la URL, un sprite regenerado no llegaba jamás a una PWA ya instalada. El
// manifest lleva un hash de contenido por archivo (scripts/sprites/escala.py)
// y aquí se añade a la URL: archivo nuevo = URL nueva = caché nueva.
export const spriteUrl = (src, v) => (src ? `/mascotas/${src}${v ? `?v=${v}` : ""}` : null);

export function urlRetrato(manifest, especie, etapa) {
  const st = manifest?.pets?.[especie]?.stages?.[etapa];
  return st?.portrait ? spriteUrl(st.portrait, st.portraitV) : null;
}

// Precarga todas las tiras de una etapa en la caché del navegador. Sin esto,
// cada cambio de animación (caminar → pausa → caricia) pedía la imagen en ese
// instante y el sprite parpadeaba un fotograma vacío.
const precargadas = new Set();
export function precargarEtapa(etapaDef) {
  if (typeof Image === "undefined") return;
  for (const a of Object.values(etapaDef?.anims || {})) {
    const url = spriteUrl(a.src, a.v);
    if (!url || precargadas.has(url)) continue;
    precargadas.add(url);
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }
}

// ── Fondos del hábitat ──────────────────────────────────────────────────────
// Un panorama por especie (public/mascotas/fondos/). `horizonte` = fracción de
// la altura donde acaba el cielo y empieza el suelo/agua en la imagen; `fade` =
// px (sobre 260 de alto) entre los que el borde superior se funde con el cielo
// DINÁMICO (sol real, nubes, estrellas y tiempo se pintan detrás). Subir `v`
// al cambiar el archivo (el SW sirve /mascotas con CacheFirst).
export const FONDOS = {
  nix:   { src: "fondos/nix.webp",   v: "1", horizonte: 0.38, fade: [58, 90] },
  broot: { src: "fondos/broot.webp", v: "1", horizonte: 0.5,  fade: [44, 84] },
};
export const fondoDe = especie => FONDOS[especie] || null;

// ── Carga del manifest ──────────────────────────────────────────────────────
// Antes: fetch sin tiempo límite dentro de un Promise.all con los datos. Un
// cuelgue de WKWebView (regla de red de CLAUDE.md §5) dejaba "Despertando a tu
// mascota…" para siempre, y si fallaba la mascota desaparecía sin aviso.
let manifestEnMemoria = null;
export async function cargarManifest() {
  if (manifestEnMemoria) return manifestEnMemoria;
  const { withTimeoutRetry } = await import("../utils.js");
  const r = await withTimeoutRetry(() => fetch("/mascotas/manifest.json", { cache: "no-cache" }), 8000, "manifest", 1);
  if (!r.ok) throw new Error(`manifest_http_${r.status}`);
  const m = await r.json();
  if (!m?.pets) throw new Error("manifest_invalido");
  manifestEnMemoria = m;
  return m;
}
