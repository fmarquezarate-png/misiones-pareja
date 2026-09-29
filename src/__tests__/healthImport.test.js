import { describe, it, expect } from "vitest";
import { trocear, validar, limpiarEntreno, NO_ENVIAR, MAX_TROZO, INTIMO_RE, CAMPOS_ENTRENO, esIntimo } from "../lib/healthImport.js";
import * as servidor from "../../supabase/functions/health-ingest/parse.js";

const dato = (fecha, qty = 1) => ({ date: `${fecha} 00:00:00 +0200`, qty, source: "iPhone" });
const archivo = (metrics, workouts = []) => ({ data: { metrics, workouts } });

describe("validar", () => {
  it("acepta un archivo de Health Auto Export", () => {
    expect(validar(archivo([{ name: "step_count", units: "count", data: [dato("2026-01-01")] }]))).toBeNull();
  });
  it("rechaza otra cosa con un motivo legible", () => {
    expect(validar({ foo: 1 })).toMatch(/Health Auto Export/);
    expect(validar(null)).toBeTruthy();
    expect(validar({ data: {} })).toMatch(/métricas ni entrenos/);
  });
});

describe("trocear", () => {
  it("un trozo por año, en orden", () => {
    const t = trocear(archivo([{ name: "step_count", units: "count", data: [
      dato("2024-05-01"), dato("2022-01-01"), dato("2023-03-03"),
    ] }]));
    expect(t.map(x => x.etiqueta)).toEqual(["2022", "2023", "2024"]);
    expect(t.every(x => x.datos === 1)).toBe(true);
  });

  it("cada dato va a un solo trozo, sin perder ni duplicar", () => {
    const data = Array.from({ length: 400 }, (_, i) => dato(`202${2 + (i % 4)}-0${1 + (i % 9)}-1${i % 10}`, i));
    const t = trocear(archivo([{ name: "step_count", units: "count", data }]));
    expect(t.reduce((a, x) => a + x.datos, 0)).toBe(400);
  });

  // Lo íntimo no sale del teléfono.
  it("la actividad sexual no se envía", () => {
    const t = trocear(archivo([
      { name: "sexual_activity", units: "count", data: [{ date: "2022-05-07 00:00:00 +0200", Unspecified: 1 }] },
      { name: "step_count", units: "count", data: [dato("2022-05-07")] },
    ]));
    const nombres = t.flatMap(x => x.cuerpo.data.metrics.map(m => m.name));
    expect(nombres).not.toContain("sexual_activity");
    expect(nombres).toContain("step_count");
    expect(NO_ENVIAR.has("sexual_activity")).toBe(true);
  });

  it("un año que no cabe se parte en trimestres", () => {
    const relleno = "x".repeat(200);
    const data = Array.from({ length: 12 }, (_, m) => ({ ...dato(`2024-${String(m + 1).padStart(2, "0")}-01`), source: relleno }));
    const t = trocear(archivo([{ name: "step_count", units: "count", data }]), { max: 1500 });
    expect(t.map(x => x.etiqueta)).toEqual(["2024 T1", "2024 T2", "2024 T3", "2024 T4"]);
    expect(t.reduce((a, x) => a + x.datos, 0)).toBe(12);
  });

  it("el sueño se reparte por su fecha", () => {
    const t = trocear(archivo([{ name: "sleep_analysis", units: "hr", data: [
      { totalSleep: 7, sleepEnd: "2025-01-01 07:00:00 +0100", sleepStart: "2024-12-31 23:50:00 +0100" },
    ] }]));
    expect(t).toHaveLength(1);
  });

  it("los entrenos se reparten por su inicio", () => {
    const t = trocear(archivo([], [{ name: "Correr", start: "2023-06-01 08:00:00 +0200", end: "2023-06-01 08:40:00 +0200" }]));
    expect(t[0].etiqueta).toBe("2023");
    expect(t[0].cuerpo.data.workouts).toHaveLength(1);
  });

  it("el límite por defecto deja margen bajo los 2,5 MB del servidor", () => {
    expect(MAX_TROZO).toBeLessThan(2_500_000);
  });
});

describe("limpiarEntreno", () => {
  it("quita lo pesado que el importador no usa", () => {
    const w = limpiarEntreno({
      name: "Correr", start: "a", end: "b", duration: 2426,
      heartRateData: Array(3000).fill({ qty: 150 }), route: [{ lat: 1 }], location: "Interior",
      heartRate: { avg: { qty: 150 }, max: { qty: 190 }, min: { qty: 90 } },
    });
    expect(w.heartRateData).toBeUndefined();
    expect(w.route).toBeUndefined();
    expect(w.duration).toBe(2426);
    expect(w.heartRate).toEqual({ avg: { qty: 150 } });
  });
});


describe("el importador de la app y el del servidor no divergen", () => {
  // Eran dos listas copiadas a mano; si una crece y la otra no, lo íntimo
  // viaja al servidor o el servidor guarda lo que la app quitaba.
  it("misma lista de lo íntimo", () => {
    expect([...NO_ENVIAR].sort()).toEqual([...servidor.NUNCA].sort());
  });
  it("mismo patrón", () => {
    expect(INTIMO_RE.source).toBe(servidor.INTIMO_RE.source);
    expect(INTIMO_RE.flags).toBe(servidor.INTIMO_RE.flags);
  });
  it("mismos campos de entreno", () => {
    expect(CAMPOS_ENTRENO).toEqual(servidor.CAMPOS_ENTRENO);
  });
  it("lo íntimo nuevo tampoco viaja", () => {
    expect(esIntimo("contraceptive")).toBe(true);
    const t = trocear({ data: { metrics: [{ name: "pregnancy_test_result", units: "x", data: [{ date: "2022-05-07 00:00:00 +0200", qty: 1 }] }], workouts: [] } });
    expect(t).toEqual([]);
  });
});
