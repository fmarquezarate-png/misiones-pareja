import { describe, it, expect } from "vitest";
import { isMineEntry } from "../lib/identity.js";

describe("isMineEntry", () => {
  it("decide por person-id cuando la entrada lo tiene y conocemos el nuestro", () => {
    expect(isMineEntry({ fromId: "person1", fromName: "Fran" }, "Ana", "person1")).toBe(true);
    expect(isMineEntry({ fromId: "person2", fromName: "Fran" }, "Fran", "person1")).toBe(false);
  });
  it("sobrevive a un renombrado: id manda sobre el nombre", () => {
    // La entrada la escribió person1 con el nombre viejo; hoy me llamo distinto
    // pero mi person-id sigue siendo person1 → sigue siendo mía.
    expect(isMineEntry({ fromId: "person1", fromName: "Nombre Viejo" }, "Nombre Nuevo", "person1")).toBe(true);
  });
  it("cae al nombre en entradas antiguas sin fromId", () => {
    expect(isMineEntry({ fromName: "Fran" }, "Fran", "person1")).toBe(true);
    expect(isMineEntry({ fromName: "Ana" }, "Fran", "person1")).toBe(false);
  });
  it("cae al nombre si no conocemos nuestro person-id", () => {
    expect(isMineEntry({ fromId: "person1", fromName: "Fran" }, "Fran", null)).toBe(true);
  });
  it("tolera entrada nula", () => {
    expect(isMineEntry(null, "Fran", "person1")).toBe(false);
  });
});
