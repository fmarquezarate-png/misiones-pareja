import { describe, it, expect } from "vitest";
import { DATE_IDEAS, pickDateIdea } from "../lib/dateIdeas.js";

describe("DATE_IDEAS", () => {
  it("hay ideas y todas tienen título, emoji y categoría", () => {
    expect(DATE_IDEAS.length).toBeGreaterThan(5);
    for (const i of DATE_IDEAS) {
      expect(i.title && i.emoji && i.category).toBeTruthy();
    }
  });
});

describe("pickDateIdea", () => {
  it("selecciona por índice", () => {
    expect(pickDateIdea(0)).toBe(DATE_IDEAS[0]);
    expect(pickDateIdea(2)).toBe(DATE_IDEAS[2]);
  });
  it("rota de forma circular al pasar del final", () => {
    expect(pickDateIdea(DATE_IDEAS.length)).toBe(DATE_IDEAS[0]);
    expect(pickDateIdea(DATE_IDEAS.length + 1)).toBe(DATE_IDEAS[1]);
  });
  it("tolera índices negativos", () => {
    expect(pickDateIdea(-1)).toBe(DATE_IDEAS[DATE_IDEAS.length - 1]);
  });
  it("lista vacía → null", () => {
    expect(pickDateIdea(0, [])).toBeNull();
  });
});
