import { describe, it, expect } from "vitest";
import { computeStreakDelta } from "../lib/streak.js";
import { getWeekAndYear, isoWeekKey } from "../utils.js";

const now = new Date(2026, 7, 15, 12, 0); // 15 ago 2026
const wkey = isoWeekKey(getWeekAndYear(now).week, getWeekAndYear(now).year);
const colors = { person1: "#f472b6", person2: "#a78bfa" };

function weeksWith(missions) { return { [wkey]: { missions } }; }

describe("computeStreakDelta", () => {
  it("calcula el delta del anillo al completar una misión activa", () => {
    const weeks = weeksWith([
      { id: "a", who: "person1", status: "DONE", date: "2026-08-10" },
      { id: "b", who: "person1", status: "TBC",  date: "2026-08-11" },
    ]);
    const r = computeStreakDelta(weeks, { id: "b", who: "person1" }, colors, now);
    expect(r).not.toBeNull();
    expect(r.beforePct).toBe(50);   // 1 de 2 hecha
    expect(r.afterPct).toBe(100);   // 2 de 2
    expect(r.delta).toBe(50);
    expect(r.color).toBe(colors.person1);
  });

  it("incluye misiones 'together' en el conteo de la persona", () => {
    const weeks = weeksWith([
      { id: "a", who: "together", status: "DONE", date: "2026-08-10" },
      { id: "b", who: "person2",  status: "TBC",  date: "2026-08-11" },
    ]);
    const r = computeStreakDelta(weeks, { id: "b", who: "person2" }, colors, now);
    expect(r.beforePct).toBe(50);
    expect(r.color).toBe(colors.person2);
  });

  it("excluye eventos, futuras y completedLate", () => {
    const weeks = weeksWith([
      { id: "ev", who: "person1", type: "event", status: "DONE", date: "2026-08-10" },
      { id: "fut", who: "person1", status: "TBC", date: "2026-08-30" }, // futura
      { id: "late", who: "person1", status: "DONE", completedLate: true, date: "2026-08-09" },
      { id: "x", who: "person1", status: "TBC", date: "2026-08-12" },
    ]);
    const r = computeStreakDelta(weeks, { id: "x", who: "person1" }, colors, now);
    expect(r.beforePct).toBe(0); // solo 'x' cuenta (0 de 1 hecha antes)
    expect(r.afterPct).toBe(100);
  });

  it("null si la misión no está en la ventana activa o no existe", () => {
    expect(computeStreakDelta(weeksWith([]), { id: "z", who: "person1" }, colors, now)).toBeNull();
    expect(computeStreakDelta(weeksWith([]), null, colors, now)).toBeNull();
  });
});
