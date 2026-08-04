import { describe, it, expect } from "vitest";
import { hasImminentDate } from "../lib/homeHighlight.js";

describe("hasImminentDate", () => {
  it("true si alguna fecha está dentro de la ventana", () => {
    expect(hasImminentDate([{ daysUntil: 3 }, { daysUntil: 20 }], 7)).toBe(true);
    expect(hasImminentDate([{ daysUntil: 0 }], 7)).toBe(true);
    expect(hasImminentDate([{ daysUntil: 7 }], 7)).toBe(true);
  });
  it("false si todas están fuera de la ventana", () => {
    expect(hasImminentDate([{ daysUntil: 8 }, { daysUntil: 30 }], 7)).toBe(false);
  });
  it("false con lista vacía o inválida", () => {
    expect(hasImminentDate([], 7)).toBe(false);
    expect(hasImminentDate(undefined, 7)).toBe(false);
    expect(hasImminentDate([{}], 7)).toBe(false);
  });
});
