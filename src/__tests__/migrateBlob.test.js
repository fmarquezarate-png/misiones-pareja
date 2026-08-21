import { describe, it, expect } from "vitest";
import { migrateBlob } from "../lib/migrateBlob.js";

describe("migrateBlob", () => {
  it("añade birthdays: [] si falta", () => {
    const { data, changed } = migrateBlob({ weeks: {} });
    expect(data.birthdays).toEqual([]);
    expect(changed).toBe(true);
  });

  it("migra loveNote (objeto único) → loveNotes (array), conservando el histórico", () => {
    const { data } = migrateBlob({ weeks: {}, loveNote: { text: "te quiero", fromName: "Fran", at: 1 } });
    expect(data.loveNotes).toHaveLength(1);
    expect(data.loveNotes[0]).toMatchObject({ text: "te quiero", fromName: "Fran", at: 1 });
    expect(data.loveNotes[0].id).toBeTruthy();
  });

  it("sin loveNote previo → loveNotes: []", () => {
    expect(migrateBlob({ weeks: {} }).data.loveNotes).toEqual([]);
  });

  it("es idempotente: re-ejecutar sobre un blob migrado no cambia nada", () => {
    const once = migrateBlob({ weeks: {}, loveNote: { text: "x", fromName: "A", at: 2 } }).data;
    const twice = migrateBlob(once);
    expect(twice.changed).toBe(false);
    expect(twice.data.loveNotes).toEqual(once.loveNotes);
    expect(twice.data.birthdays).toEqual(once.birthdays);
  });

  it("no toca loveNotes si ya existe", () => {
    const existing = [{ id: "x", text: "hi" }];
    const { data, changed } = migrateBlob({ weeks: {}, birthdays: [], loveNotes: existing });
    expect(data.loveNotes).toBe(existing);
    expect(changed).toBe(false);
  });
});
