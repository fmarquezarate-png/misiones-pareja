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
