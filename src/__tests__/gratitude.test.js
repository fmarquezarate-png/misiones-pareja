import { describe, it, expect } from "vitest";
import { todaysGratitudes, GRATITUDE_MAX } from "../lib/gratitude.js";

const today = new Date(2026, 7, 4, 15, 0);
const at = (h) => new Date(2026, 7, 4, h, 0).getTime();
const yesterday = new Date(2026, 7, 3, 10, 0).getTime();

describe("todaysGratitudes", () => {
  it("separa la mía y la recibida de hoy", () => {
    const g = todaysGratitudes([
      { id: "1", fromName: "Fran", text: "por el café", at: at(9) },
      { id: "2", fromName: "Ana",  text: "por escuchar", at: at(8) },
    ], "Fran", today);
    expect(g.mine.text).toBe("por el café");
    expect(g.received.text).toBe("por escuchar");
  });

  it("toma la más reciente de cada uno (array newest-first)", () => {
    const g = todaysGratitudes([
      { id: "3", fromName: "Fran", text: "nueva", at: at(14) },
      { id: "1", fromName: "Fran", text: "vieja", at: at(9) },
    ], "Fran", today);
    expect(g.mine.text).toBe("nueva");
    expect(g.received).toBeNull();
  });

  it("ignora gratitudes de otros días", () => {
    const g = todaysGratitudes([
      { id: "9", fromName: "Fran", text: "de ayer", at: yesterday },
    ], "Fran", today);
    expect(g.mine).toBeNull();
    expect(g.received).toBeNull();
  });

  it("tolera lista vacía / entradas inválidas", () => {
    expect(todaysGratitudes([], "Fran", today)).toEqual({ mine: null, received: null });
    expect(todaysGratitudes([{ fromName: "Fran" }, null], "Fran", today)).toEqual({ mine: null, received: null });
  });

  it("GRATITUDE_MAX es un límite razonable", () => {
    expect(GRATITUDE_MAX).toBeGreaterThan(50);
  });
});
