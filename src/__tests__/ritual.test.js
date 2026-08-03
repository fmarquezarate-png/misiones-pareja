import { describe, it, expect } from "vitest";
import { shouldShowPlanningRitual, ritualDefaults, RITUAL_DAYS, RITUAL_STEPS } from "../lib/ritual.js";

// Domingo 2026-08-02 (getDay()===0), Lunes 2026-08-03 (getDay()===1)
const sunday = new Date(2026, 7, 2);
const monday = new Date(2026, 7, 3);
const WK = "2026-W31";

describe("shouldShowPlanningRitual", () => {
  it("oculto si no está activado", () => {
    expect(shouldShowPlanningRitual({ enabled: false, day: 0 }, sunday, WK)).toBe(false);
    expect(shouldShowPlanningRitual(undefined, sunday, WK)).toBe(false);
    expect(shouldShowPlanningRitual(null, sunday, WK)).toBe(false);
  });

  it("visible el día elegido si está activado y no se hizo esta semana", () => {
    expect(shouldShowPlanningRitual({ enabled: true, day: 0 }, sunday, WK)).toBe(true);
  });

  it("oculto si hoy no es el día elegido", () => {
    expect(shouldShowPlanningRitual({ enabled: true, day: 0 }, monday, WK)).toBe(false);
    expect(shouldShowPlanningRitual({ enabled: true, day: 1 }, sunday, WK)).toBe(false);
  });

  it("oculto si ya se completó esta misma semana", () => {
    expect(shouldShowPlanningRitual({ enabled: true, day: 0, lastDoneWeek: WK }, sunday, WK)).toBe(false);
  });

  it("vuelve a mostrarse en una semana distinta", () => {
    expect(shouldShowPlanningRitual({ enabled: true, day: 0, lastDoneWeek: "2026-W30" }, sunday, WK)).toBe(true);
  });

  it("day por defecto es domingo (0) si falta", () => {
    expect(shouldShowPlanningRitual({ enabled: true }, sunday, WK)).toBe(true);
  });

  it("tolera fecha inválida sin romper", () => {
    expect(shouldShowPlanningRitual({ enabled: true, day: 0 }, null, WK)).toBe(false);
    expect(shouldShowPlanningRitual({ enabled: true, day: 0 }, {}, WK)).toBe(false);
  });
});

describe("ritual constantes", () => {
  it("defaults desactivado", () => {
    expect(ritualDefaults()).toEqual({ enabled: false, day: 0, lastDoneWeek: null });
  });
  it("7 días seleccionables y 4 pasos", () => {
    expect(RITUAL_DAYS).toHaveLength(7);
    expect(RITUAL_STEPS).toHaveLength(4);
    expect(RITUAL_DAYS.map(d => d.id).sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
