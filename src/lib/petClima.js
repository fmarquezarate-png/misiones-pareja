// La lluvia del hábitat: gotas, ondas y nubes. Puro — se prueba con rng con
// semilla. Los dibujos (nubes de lluvia, ondas en el agua, charcos) salen de
// las hojas de entorno (public/mascotas/clima/).
//
// Por qué así: la lluvia anterior era un degradado diagonal repetido más un
// velo gris sobre TODA la escena — oscurecía a la mascota y parecía una
// persiana. Ahora son gotas sueltas (dos capas: lejos, tenues y lentas; cerca,
// más largas y rápidas), ondas al caer en el agua / charcos en el prado, y solo
// se apaga el CIELO, no la mascota.

export const GOTAS = { 1: 52, 2: 90 };          // según cl.lluvia (1 = lluvia/llovizna, 2 = fuerte)
export const GOTAS_TORMENTA = 120;

/** Filtro del panorama con el cielo cubierto: apaga el color, no oscurece a la mascota. */
export function filtroCubierto({ tormenta = false, lluvia = 0 } = {}) {
  if (tormenta) return "saturate(0.6) brightness(0.8)";
  return lluvia ? "saturate(0.72) brightness(0.88)" : "saturate(0.8) brightness(0.92)";
}

/** Velo solo sobre el cielo (degradado desde arriba), no sobre toda la escena. */
export function velCielo({ tormenta = false, lluvia = 0 } = {}) {
  const a = tormenta ? 0.62 : lluvia ? 0.46 : 0.34;
  return `linear-gradient(to bottom, rgba(64,76,96,${a}) 0%, rgba(64,76,96,${(a * 0.55).toFixed(2)}) 45%, rgba(64,76,96,0) 78%)`;
}

/**
 * Gotas para un ancho/alto dado. `cerca` = capa delantera.
 * @returns {Array<{ x:number, dx:number, dy:number, dur:number, delay:number, largo:number, op:number, cerca:boolean }>}
 */
export function gotas({ intensidad = 1, tormenta = false, ancho, alto }, rng) {
  const n = tormenta ? GOTAS_TORMENTA : GOTAS[intensidad] || GOTAS[1];
  const out = [];
  for (let i = 0; i < n; i++) {
    const cerca = i % 3 === 0;
    const largo = cerca ? 15 + Math.round(rng() * 9) : 8 + Math.round(rng() * 6);
    const dur = cerca ? 0.55 + rng() * 0.2 : 0.85 + rng() * 0.3;
    const dy = alto + 40;
    out.push({
      x: Math.round(rng() * (ancho + 60)) - 30,
      dy, dx: -Math.round(dy * 0.22),               // caen con una inclinación suave
      dur: +dur.toFixed(2), delay: +(-rng() * dur).toFixed(2),   // delay negativo: ya están cayendo al montar
      largo, op: +(cerca ? 0.7 + rng() * 0.25 : 0.4 + rng() * 0.15).toFixed(2), cerca,
    });
  }
  return out;
}

/**
 * Ondas al caer la lluvia: en el agua (Nix) a lo largo de la superficie, o
 * charcos en el prado (Broot) por el suelo.
 */
export function rizos({ agua, ancho, alto, horizonte }, rng, n = 6) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const y = agua
      ? Math.round(horizonte * alto + 4 + rng() * 10)                       // franja de la superficie
      : Math.round(horizonte * alto + 20 + rng() * (alto - horizonte * alto - 44));
    const cerca = !agua && y > horizonte * alto + (alto - horizonte * alto) * 0.5;
    out.push({
      x: Math.round(rng() * (ancho - 40)), y,
      id: agua ? `onda_${i % 2}` : `charco_${i % 2}`,
      escala: agua ? 0.32 + rng() * 0.16 : (cerca ? 0.55 : 0.38) + rng() * 0.12,
      delay: +(rng() * 2.4).toFixed(2), dur: +(1.5 + rng()).toFixed(2),
    });
  }
  return out;
}
