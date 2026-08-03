import { describe, it, expect } from "vitest";
import { shouldOfferWrapped } from "../lib/wrapped.js";

const monday    = new Date(2026, 7, 3); // getDay()===1
const wednesday = new Date(2026, 7, 5); // getDay()===3
const thursday  = new Date(2026, 7, 6); // getDay()===4
const sunday    = new Date(2026, 7, 2); // getDay()===0

describe("shouldOfferWrapped", () => {
  it("ofrece Lun-Mié si hay datos previos y no se ha visto", () => {
    expect(shouldOfferWrapped(monday, true, false)).toBe(true);
    expect(shouldOfferWrapped(wednesday, true, false)).toBe(true);
  });
  it("no ofrece de jueves en adelante ni domingo", () => {
    expect(shouldOfferWrapped(thursday, true, false)).toBe(false);
    expect(shouldOfferWrapped(sunday, true, false)).toBe(false);
  });
  it("no ofrece si la semana previa no tiene misiones", () => {
    expect(shouldOfferWrapped(monday, false, false)).toBe(false);
  });
  it("no ofrece si ya se vio el recap de esa semana", () => {
    expect(shouldOfferWrapped(monday, true, true)).toBe(false);
  });
  it("tolera fecha inválida", () => {
    expect(shouldOfferWrapped(null, true, false)).toBe(false);
    expect(shouldOfferWrapped({}, true, false)).toBe(false);
  });
});
