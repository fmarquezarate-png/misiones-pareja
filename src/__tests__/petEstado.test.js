import { describe, it, expect } from "vitest";
import { estadoDeDatos, energiaPorSueno, nivelSueno, rachaPerfecta, ENERGIA } from "../lib/petEstado.js";
import { simular, sumarDias } from "../lib/pet.js";

const hoy = "2026-10-20";
const fila = (day, metric, value) => ({ day, metric, value });
const dia = (d, o) => Object.entries(o).map(([m, v]) => fila(d, m, v));
const estado = (extraHoy, previos = []) => {
  const filas = [...previos, ...dia(hoy, extraHoy)];
  return estadoDeDatos({ filas, sim: simular({ nacimiento: "2026-10-01", filas, hoy }), hoy });
};

describe("energía y sueño", () => {
  it("dormir poco baja el ritmo, dormir bien lo sube un poco; sin dato es neutro", () => {
    expect(energiaPorSueno(4.2)).toBe(0.6);
    expect(energiaPorSueno(5.5)).toBe(0.75);
    expect(energiaPorSueno(6.5)).toBe(0.9);
    expect(energiaPorSueno(7.2)).toBe(1);
    expect(energiaPorSueno(8)).toBe(ENERGIA.max);
    expect(energiaPorSueno(null)).toBe(1);
    expect(energiaPorSueno(NaN)).toBe(1);
  });
  it("niveles de sueño", () => {
    expect([nivelSueno(5), nivelSueno(6.4), nivelSueno(7.5), nivelSueno(undefined)]).toEqual(["corta", "justa", "descansada", null]);
  });
  it("una mala noche NUNCA la pone triste ni enferma", () => {
    const e = estado({ sleep_asleep: 4.5, step_count: 6000 });
    expect(e.energia).toBe(0.6);
    expect(e.burbuja.texto).not.toMatch(/triste|enferm|mal/i);
  });
});

describe("pasos de hoy", () => {
  it("meta lograda: aura y mensaje", () => {
    const e = estado({ step_count: 9500 });
    expect(e.pasos.cumplida).toBe(true);
    expect(e.aura).toBe("pasos");
    expect(e.burbuja.icono).toBe("✨");
  });
  it("a medias: progreso, sin aura", () => {
    const e = estado({ step_count: 4000 });
    expect(e.pasos.frac).toBeCloseTo(0.5);
    expect(e.aura).toBeNull();
  });
});

describe("sin datos = neutro", () => {
  it("sin nada de hoy: sin efectos, sin mensajes, ritmo normal", () => {
    const e = estado({});
    expect(e).toMatchObject({ energia: 1, sueno: null, pasos: null, pulso: null, aura: null, burbuja: null });
    expect(e.insignias).toEqual([]);
  });
  it("un 'sin dato' (0 pasos, sueño < 2 h) no cuenta como día flojo", () => {
    const e = estado({ step_count: 0, sleep_asleep: 1 });
    expect(e.sueno).toBeNull();
    expect(e.pasos).toBeNull();
  });
});

describe("pulso en reposo", () => {
  const previos = Array.from({ length: 20 }, (_, i) => fila(sumarDias(hoy, -21 + i), "resting_heart_rate", 60)).flat();
  it("compara con la mediana de las semanas anteriores", () => {
    expect(estado({ resting_heart_rate: 68 }, previos).pulso).toMatchObject({ valor: 68, base: 60, diff: 8, nivel: "alto" });
    expect(estado({ resting_heart_rate: 59 }, previos).pulso.nivel).toBe("normal");
    expect(estado({ resting_heart_rate: 55 }, previos).pulso.nivel).toBe("bajo");
  });
  it("con poco historial no opina", () => {
    expect(estado({ resting_heart_rate: 90 }).pulso).toBeNull();
  });
});

describe("racha", () => {
  it("cuenta días perfectos seguidos; los sin dato ni suman ni cortan", () => {
    const h = [{ puntuacion: 1 }, { puntuacion: null }, { puntuacion: 1 }, { puntuacion: 0.5 }, { puntuacion: 1 }, { puntuacion: 1 }];
    expect(rachaPerfecta(h)).toBe(2);
    expect(rachaPerfecta(h, true)).toBe(3);
    expect(rachaPerfecta([])).toBe(0);
  });
});
