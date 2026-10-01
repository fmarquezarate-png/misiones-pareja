import { describe, it, expect } from "vitest";
import { welch, pearson, porDiaSemana, percentilSemana, regularidad, hallazgos, MIN_GRUPO } from "../lib/estadisticas.js";
import { sumarDias } from "../lib/pet.js";

const HOY = "2026-10-01";
// Generador determinista (sin Math.random: las pruebas no pueden variar).
const ruido = i => ((i * 7919) % 101) / 100 - 0.5;
const dias = n => Array.from({ length: n }, (_, i) => sumarDias(HOY, -(i + 1)));

describe("pruebas básicas", () => {
  it("Welch detecta una diferencia clara y no inventa una con grupos iguales", () => {
    const a = Array.from({ length: 30 }, (_, i) => 10 + ruido(i)), b = Array.from({ length: 30 }, (_, i) => 8 + ruido(i + 50));
    expect(welch(a, b).t).toBeGreaterThan(5);
    expect(Math.abs(welch(a, a.map((x, i) => x + ruido(i + 9) * 0.01)).t)).toBeLessThan(1);
  });
  it("Pearson: +1, −1 y null sin variación", () => {
    expect(pearson([[1, 2], [2, 4], [3, 6]]).r).toBeCloseTo(1);
    expect(pearson([[1, 3], [2, 2], [3, 1]]).r).toBeCloseTo(-1);
    expect(pearson([[1, 1], [1, 2], [1, 3]])).toBeNull();
  });
});

describe("patrones", () => {
  it("media por día de la semana, sin contar días sin dato (sueño 0 h)", () => {
    const filas = [
      { day: "2026-09-28", metric: "step_count", value: 10000 },   // lunes
      { day: "2026-09-21", metric: "step_count", value: 6000 },    // lunes
      { day: "2026-09-27", metric: "step_count", value: 3000 },    // domingo
      { day: "2026-09-26", metric: "sleep_asleep", value: 0 },
    ];
    const s = porDiaSemana(filas, "step_count");
    expect(s[0]).toMatchObject({ nombre: "lunes", media: 8000, n: 2 });
    expect(s[6]).toMatchObject({ nombre: "domingo", media: 3000, n: 1 });
    expect(s[2].media).toBeNull();
  });
  it("percentil: una semana récord queda arriba del todo", () => {
    const filas = dias(200).map((day, i) => ({ day, metric: "step_count", value: i < 7 ? 20000 : 6000 + ruido(i) * 1000 }));
    const p = percentilSemana(filas, "step_count", HOY);
    expect(p.percentil).toBeGreaterThan(0.95);
  });
  it("regularidad: horario fijo → desviación pequeña", () => {
    const filas = dias(60).map((day, i) => ({ day, metric: "bed_min", value: 30 + ruido(i) * 20 }));
    expect(regularidad(filas, "bed_min", HOY).ahora).toBeLessThan(10);
  });
});

describe("hallazgos", () => {
  it("encuentra que tras dormir bien se anda más, con números", () => {
    const filas = dias(80).flatMap((day, i) => {
      const bien = i % 2 === 0;
      return [{ day, metric: "sleep_asleep", value: bien ? 7.5 : 5.5 }, { day, metric: "step_count", value: (bien ? 11000 : 7000) + ruido(i) * 1500 }];
    });
    const h = hallazgos({ filas, hoy: HOY, metaSueno: 7 });
    const s = h.find(x => x.id === "sueno-pasos");
    expect(s).toBeTruthy();
    expect(s.texto).toMatch(/pasos más/);
  });
  it("con pocos datos o sin diferencia NO se inventa nada", () => {
    const pocos = dias(MIN_GRUPO).flatMap((day, i) => [{ day, metric: "sleep_asleep", value: i % 2 ? 8 : 5 }, { day, metric: "step_count", value: i % 2 ? 12000 : 6000 }]);
    expect(hallazgos({ filas: pocos, hoy: HOY }).find(x => x.id === "sueno-pasos")).toBeUndefined();
    const iguales = dias(80).flatMap((day, i) => [{ day, metric: "sleep_asleep", value: i % 2 ? 8 : 5 }, { day, metric: "step_count", value: 8000 + ruido(i) * 2000 }]);
    expect(hallazgos({ filas: iguales, hoy: HOY }).find(x => x.id === "sueno-pasos")).toBeUndefined();
  });
  it("el día de hoy (en curso) no entra en las comparaciones", () => {
    const filas = [{ day: HOY, metric: "step_count", value: 50 }, ...dias(40).map((day, i) => ({ day, metric: "step_count", value: 8000 + ruido(i) * 100 }))];
    expect(hallazgos({ filas, hoy: HOY }).some(x => /50/.test(x.texto))).toBe(false);
  });
});
