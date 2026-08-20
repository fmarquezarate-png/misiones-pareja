import { describe, it, expect } from "vitest";
import { pickFreshest } from "../lib/localStore.js";

const A = { data: { weeks: {} }, ts: "2026-08-04T10:00:00.000Z" };
const B = { data: { weeks: {} }, ts: "2026-08-04T12:00:00.000Z" };

describe("pickFreshest", () => {
  it("devuelve la más reciente por ts", () => {
    expect(pickFreshest(A, B)).toBe(B);
    expect(pickFreshest(B, A)).toBe(B);
  });
  it("si una no tiene datos, devuelve la otra", () => {
    expect(pickFreshest(null, A)).toBe(A);
    expect(pickFreshest(A, null)).toBe(A);
    expect(pickFreshest({ data: null }, A)).toBe(A);
  });
  it("ambas vacías → null", () => {
    expect(pickFreshest(null, null)).toBeNull();
    expect(pickFreshest({ data: null }, undefined)).toBeNull();
  });
  it("empate de ts → prefiere la primera (IDB, la durable)", () => {
    const a = { data: { x: 1 }, ts: "2026-08-04T10:00:00.000Z" };
    const b = { data: { x: 2 }, ts: "2026-08-04T10:00:00.000Z" };
    expect(pickFreshest(a, b)).toBe(a);
  });
  it("ts inválido/ausente cuenta como 0", () => {
    const noTs = { data: { x: 1 } };
    expect(pickFreshest(noTs, B)).toBe(B); // B tiene ts real, gana
    expect(pickFreshest(noTs, { data: { x: 2 } })).toBe(noTs); // 0 vs 0 → primera
  });
});
