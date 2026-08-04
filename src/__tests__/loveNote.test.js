import { describe, it, expect } from "vitest";
import { makeLoveNote, LOVE_NOTE_MAX, noteDateLabel } from "../lib/loveNote.js";

describe("makeLoveNote", () => {
  it("construye la notita con autor y timestamp", () => {
    expect(makeLoveNote("Te quiero", "Fran", 123)).toEqual({ text: "Te quiero", fromName: "Fran", at: 123 });
  });
  it("recorta espacios", () => {
    expect(makeLoveNote("  hola  ", "Ana", 1).text).toBe("hola");
  });
  it("texto vacío o solo espacios → null (quitar)", () => {
    expect(makeLoveNote("", "Fran", 1)).toBeNull();
    expect(makeLoveNote("   ", "Fran", 1)).toBeNull();
    expect(makeLoveNote(undefined, "Fran", 1)).toBeNull();
  });
  it("trunca al máximo permitido", () => {
    const long = "x".repeat(LOVE_NOTE_MAX + 50);
    expect(makeLoveNote(long, "Fran", 1).text).toHaveLength(LOVE_NOTE_MAX);
  });
  it("tolera autor/at faltantes", () => {
    expect(makeLoveNote("hey")).toEqual({ text: "hey", fromName: "", at: null });
  });
});

describe("noteDateLabel", () => {
  const now = new Date(2026, 7, 4, 12, 0); // 4 ago 2026
  it("hoy / ayer / fecha corta", () => {
    expect(noteDateLabel(new Date(2026, 7, 4, 9, 0).getTime(), now)).toBe("hoy");
    expect(noteDateLabel(new Date(2026, 7, 3, 22, 0).getTime(), now)).toBe("ayer");
    expect(noteDateLabel(new Date(2026, 6, 20).getTime(), now)).toBe("20 jul");
  });
  it("timestamp vacío o inválido → cadena vacía", () => {
    expect(noteDateLabel(null, now)).toBe("");
    expect(noteDateLabel(NaN, now)).toBe("");
  });
});
