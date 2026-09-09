import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Z, Z_ORDER, Z_IN_VIEW_MAX } from "../lib/zLayers.js";

describe("escala de capas", () => {
  it("está estrictamente ordenada de abajo arriba", () => {
    const vals = Z_ORDER.map(k => Z[k]);
    expect(vals.every((v, i) => i === 0 || v > vals[i - 1])).toBe(true);
  });

  it("declara exactamente las capas del orden, sin sobrantes ni huecos", () => {
    expect(Object.keys(Z).sort()).toEqual([...Z_ORDER].sort());
  });

  it("el diálogo que bloquea está por encima de TODO lo que puede taparlo", () => {
    // La razón de existir de este módulo: el write-guard y las confirmaciones
    // estaban en 900, por debajo del toast y de las celebraciones.
    for (const k of ["AMBIENT", "MASCOT", "FAB", "SHEET", "CELEBRATION", "BANNER", "TOAST"]) {
      expect(Z.DIALOG).toBeGreaterThan(Z[k]);
    }
  });

  it("solo los destellos decorativos van por encima del diálogo", () => {
    const above = Z_ORDER.filter(k => Z[k] > Z.DIALOG);
    expect(above).toEqual(["SPARKLES"]);
  });

  it("todas las capas globales quedan por encima de las capas internas de vista", () => {
    for (const k of Z_ORDER) expect(Z[k]).toBeGreaterThan(Z_IN_VIEW_MAX);
  });
});

describe("nadie se salta la escala", () => {
  // Guard-rail: cualquier overlay global nuevo debe importar Z en vez de
  // inventarse un número. Se permite el rango interno de vista (<= 300).
  const dir = join(dirname(fileURLToPath(import.meta.url)), "../components");
  const files = readdirSync(dir).filter(f => f.endsWith(".jsx"));

  it("ningún componente usa un z-index global inventado", () => {
    const offenders = [];
    for (const f of files) {
      if (f === "DevBackfillPanel.jsx") continue;           // panel de desarrollo, no navega
      const src = readFileSync(join(dir, f), "utf8");
      for (const m of src.matchAll(/zIndex\s*:\s*(\d+)/g)) {
        const v = Number(m[1]);
        if (v > Z_IN_VIEW_MAX) offenders.push(`${f}: ${v}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
