import { describe, it, expect } from "vitest";
import { makeLoveNote, LOVE_NOTE_MAX } from "../lib/loveNote.js";

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
