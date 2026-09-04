import { describe, it, expect } from "vitest";
import { PIN_COLORS, PAPER_COLORS, hashId, noteVisual, pinHex, normalizePin } from "../lib/corkboard.js";

describe("hashId", () => {
  it("es determinista para el mismo id", () => {
    expect(hashId("abc123")).toBe(hashId("abc123"));
  });

  it("distingue ids distintos", () => {
    expect(hashId("abc123")).not.toBe(hashId("abc124"));
  });

  it("no revienta con null/undefined", () => {
    expect(typeof hashId(null)).toBe("number");
    expect(typeof hashId(undefined)).toBe("number");
  });
});

describe("noteVisual", () => {
  it("da siempre el mismo papel e inclinación para el mismo id", () => {
    const a = noteVisual("nota-1");
    const b = noteVisual("nota-1");
    expect(a).toEqual(b);
  });

  it("el papel es uno de la paleta y la inclinación va de -3 a 3", () => {
    for (const id of ["a", "b", "c", "zz9", "nota-larga-con-guiones", "1", ""]) {
      const v = noteVisual(id);
      expect(PAPER_COLORS).toContain(v.paper);
      expect(v.rotation).toBeGreaterThanOrEqual(-3);
      expect(v.rotation).toBeLessThanOrEqual(3);
      expect(Number.isInteger(v.rotation)).toBe(true);
    }
  });

  it("reparte papeles distintos entre notas distintas", () => {
    const papers = new Set(["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8"].map(id => noteVisual(id).paper));
    expect(papers.size).toBeGreaterThan(1);
  });
});

describe("pinHex", () => {
  it("devuelve el hex del color pedido", () => {
    expect(pinHex("blue")).toBe(PIN_COLORS.find(p => p.id === "blue").hex);
  });

  it("cae al primer color si el id no existe o falta", () => {
    expect(pinHex("naranja-fluor")).toBe(PIN_COLORS[0].hex);
    expect(pinHex(undefined)).toBe(PIN_COLORS[0].hex);
  });
});

describe("normalizePin", () => {
  it("deja pasar los ids válidos", () => {
    for (const p of PIN_COLORS) expect(normalizePin(p.id)).toBe(p.id);
  });

  it("normaliza cualquier basura al color por defecto", () => {
    expect(normalizePin(undefined)).toBe(PIN_COLORS[0].id);
    expect(normalizePin(null)).toBe(PIN_COLORS[0].id);
    expect(normalizePin("<script>")).toBe(PIN_COLORS[0].id);
    expect(normalizePin(42)).toBe(PIN_COLORS[0].id);
  });
});
