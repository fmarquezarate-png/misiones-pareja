import { describe, it, expect } from "vitest";
import { applyReactionToggle, hasReacted } from "../lib/reactions.js";

describe("applyReactionToggle", () => {
  it("añade una reacción a un target sin reacciones previas", () => {
    const out = applyReactionToggle({}, "m1", "👏", "person1", true);
    expect(out).toEqual({ m1: { "👏": ["person1"] } });
  });

  it("suma una segunda persona a la misma reacción", () => {
    const prev = { m1: { "👏": ["person1"] } };
    const out = applyReactionToggle(prev, "m1", "👏", "person2", true);
    expect(out.m1["👏"].sort()).toEqual(["person1", "person2"]);
  });

  it("quita mi reacción y limpia el emoji si queda vacío", () => {
    const prev = { m1: { "👏": ["person1"] } };
    const out = applyReactionToggle(prev, "m1", "👏", "person1", false);
    expect(out.m1).toBeUndefined(); // target limpio del mapa
  });

  it("al quitar, conserva la reacción del otro", () => {
    const prev = { m1: { "👏": ["person1", "person2"] } };
    const out = applyReactionToggle(prev, "m1", "👏", "person1", false);
    expect(out.m1["👏"]).toEqual(["person2"]);
  });

  it("no duplica si añado dos veces (idempotente ante rebase)", () => {
    let out = applyReactionToggle({}, "m1", "❤️", "person1", true);
    out = applyReactionToggle(out, "m1", "❤️", "person1", true);
    expect(out.m1["❤️"]).toEqual(["person1"]);
  });

  it("no muta el estado de entrada", () => {
    const prev = { m1: { "👏": ["person1"] } };
    const snapshot = JSON.stringify(prev);
    applyReactionToggle(prev, "m1", "🔥", "person2", true);
    expect(JSON.stringify(prev)).toBe(snapshot);
  });

  it("varios emojis coexisten en el mismo target", () => {
    let out = applyReactionToggle({}, "m1", "👏", "person1", true);
    out = applyReactionToggle(out, "m1", "🔥", "person2", true);
    expect(Object.keys(out.m1).sort()).toEqual(["👏", "🔥"]);
  });
});

describe("hasReacted", () => {
  const state = { m1: { "👏": ["person1"] } };
  it("true si esa persona ya reaccionó con ese emoji", () => {
    expect(hasReacted(state, "m1", "👏", "person1")).toBe(true);
  });
  it("false si no reaccionó / otro emoji / target inexistente", () => {
    expect(hasReacted(state, "m1", "👏", "person2")).toBe(false);
    expect(hasReacted(state, "m1", "🔥", "person1")).toBe(false);
    expect(hasReacted(state, "zzz", "👏", "person1")).toBe(false);
    expect(hasReacted(undefined, "m1", "👏", "person1")).toBe(false);
  });
});
