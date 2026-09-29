import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { gotas, rizos, GOTAS, GOTAS_TORMENTA, filtroCubierto, velCielo } from "../lib/petClima.js";
import { rngConSemilla } from "../lib/petBehavior.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "mascotas", "clima");

describe("gotas", () => {
  const base = { ancho: 340, alto: 260 };
  it("más gotas cuanto más fuerte llueve", () => {
    const n = o => gotas({ ...base, ...o }, rngConSemilla(1)).length;
    expect(n({ intensidad: 1 })).toBe(GOTAS[1]);
    expect(n({ intensidad: 2 })).toBe(GOTAS[2]);
    expect(n({ intensidad: 2, tormenta: true })).toBe(GOTAS_TORMENTA);
    expect(GOTAS[1]).toBeLessThan(GOTAS[2]);
  });
  it("hay dos capas y la delantera es más larga, rápida y visible", () => {
    const g = gotas({ ...base, intensidad: 2 }, rngConSemilla(3));
    const cerca = g.filter(x => x.cerca), lejos = g.filter(x => !x.cerca);
    expect(cerca.length).toBeGreaterThan(0); expect(lejos.length).toBeGreaterThan(cerca.length);
    const media = (xs, k) => xs.reduce((a, x) => a + x[k], 0) / xs.length;
    expect(media(cerca, "largo")).toBeGreaterThan(media(lejos, "largo"));
    expect(media(cerca, "dur")).toBeLessThan(media(lejos, "dur"));
    expect(media(cerca, "op")).toBeGreaterThan(media(lejos, "op"));
  });
  it("ya están cayendo al montar (delay negativo) y caen hacia abajo y a un lado", () => {
    for (const x of gotas({ ...base, intensidad: 1 }, rngConSemilla(5))) { expect(x.delay).toBeLessThanOrEqual(0); expect(x.dy).toBeGreaterThan(base.alto); expect(x.dx).toBeLessThan(0); }
  });
  it("es reproducible con la misma semilla", () => {
    expect(gotas({ ...base }, rngConSemilla(9))).toEqual(gotas({ ...base }, rngConSemilla(9)));
  });
});

describe("rizos", () => {
  const horizonte = 0.4;
  it("en el agua caen en la franja de la superficie; en el prado, por el suelo", () => {
    for (const r of rizos({ agua: true, ancho: 340, alto: 260, horizonte }, rngConSemilla(2), 30)) {
      expect(r.y).toBeGreaterThanOrEqual(Math.round(horizonte * 260 + 4)); expect(r.y).toBeLessThanOrEqual(Math.round(horizonte * 260 + 14)); expect(r.id).toMatch(/^onda_/);
    }
    for (const r of rizos({ agua: false, ancho: 340, alto: 260, horizonte: 0.5 }, rngConSemilla(2), 30)) {
      expect(r.y).toBeGreaterThan(130); expect(r.y).toBeLessThan(260); expect(r.id).toMatch(/^charco_/);
    }
  });
});

describe("cielo cubierto", () => {
  it("apaga el color pero no oscurece de más; el velo es solo del cielo", () => {
    expect(filtroCubierto({ lluvia: 1 })).toContain("brightness(0.88)");
    expect(filtroCubierto({ tormenta: true })).toContain("brightness(0.8)");
    const v = velCielo({ lluvia: 1 });
    expect(v).toMatch(/rgba\(64,76,96,0\) 78%/);         // abajo, transparente del todo
  });
});

describe("archivos", () => {
  it("existen todos los dibujos que usa el clima", () => {
    for (const id of ["nube_lluvia_0", "nube_lluvia_1", "onda_0", "onda_1", "charco_0", "charco_1", "burbuja_g", "burbuja_m", "burbuja_p", "salpicadura_0"]) expect(existsSync(join(raiz, `${id}.webp`)), id).toBe(true);
  });
});
