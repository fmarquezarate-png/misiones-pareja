import { describe, it, expect, vi } from "vitest";
import { isoWeekKey, getWeekAndYear, isoWeeksInYear, haptic, prefersReducedMotion } from "../utils.js";

describe("haptic", () => {
  it("nunca lanza, aunque no haya navigator.vibrate (jsdom)", () => {
    expect(() => haptic()).not.toThrow();
    expect(() => haptic([10, 40, 20])).not.toThrow();
  });
  it("llama navigator.vibrate cuando existe y no hay reduced-motion", () => {
    const spy = vi.fn();
    const orig = navigator.vibrate;
    navigator.vibrate = spy;
    haptic(12);
    expect(spy).toHaveBeenCalledWith(12);
    navigator.vibrate = orig;
  });
  it("prefersReducedMotion no lanza", () => {
    expect(() => prefersReducedMotion()).not.toThrow();
  });
});

describe("isoWeekKey", () => {
  it("formatea semana con padding de cero", () => {
    expect(isoWeekKey(1, 2026)).toBe("2026-W01");
  });

  it("formatea semana de dos dígitos sin padding", () => {
    expect(isoWeekKey(21, 2026)).toBe("2026-W21");
  });

  it("formatea semana 53 correctamente", () => {
    expect(isoWeekKey(53, 2026)).toBe("2026-W53");
  });
});

describe("getWeekAndYear", () => {
  it("devuelve la semana y año correctos para el 1 de enero de 2026", () => {
    // 1 de enero de 2026 es jueves → semana 1 de 2026
    const result = getWeekAndYear(new Date(2026, 0, 1));
    expect(result.week).toBe(1);
    expect(result.year).toBe(2026);
  });

  it("devuelve semana 21 para el 18 de mayo de 2026", () => {
    // 18-may-2026 → W21
    const result = getWeekAndYear(new Date(2026, 4, 18));
    expect(result.week).toBe(21);
    expect(result.year).toBe(2026);
  });

  it("el 29 de diciembre de 2025 pertenece a la semana 1 de 2026", () => {
    // ISO: el lunes 29-dic-2025 pertenece a W01-2026
    const result = getWeekAndYear(new Date(2025, 11, 29));
    expect(result.week).toBe(1);
    expect(result.year).toBe(2026);
  });
});

describe("isoWeeksInYear", () => {
  it("2026 tiene 53 semanas ISO", () => {
    expect(isoWeeksInYear(2026)).toBe(53);
  });

  it("2025 tiene 52 semanas ISO", () => {
    expect(isoWeeksInYear(2025)).toBe(52);
  });

  it("2020 tiene 53 semanas ISO", () => {
    expect(isoWeeksInYear(2020)).toBe(53);
  });
});
