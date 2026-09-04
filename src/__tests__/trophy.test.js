import { describe, it, expect } from "vitest";
import { trophyLayout, overflowCount, gratitudeParties, rotationToFace, RING_CAPACITY, MAX_RINGS } from "../lib/trophy.js";

const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: `g${i}`, text: `gracias ${i}`, fromName: "Fran", at: 1 + i }));

describe("trophyLayout", () => {
  it("reparte por anillos de RING_CAPACITY", () => {
    const l = trophyLayout(mk(20));
    expect(l).toHaveLength(20);
    expect(l[0].ring).toBe(0);
    expect(l[RING_CAPACITY - 1].ring).toBe(0);
    expect(l[RING_CAPACITY].ring).toBe(1);
    expect(l[RING_CAPACITY * 2].ring).toBe(2);
  });

  it("corta en perRing × maxRings placas", () => {
    expect(trophyLayout(mk(500))).toHaveLength(RING_CAPACITY * MAX_RINGS);
  });

  it("los ángulos del primer anillo cubren la vuelta completa sin repetirse", () => {
    const ring0 = trophyLayout(mk(RING_CAPACITY)).map(p => p.angle);
    expect(new Set(ring0).size).toBe(RING_CAPACITY);
    expect(Math.max(...ring0)).toBeLessThan(360);
    expect(Math.min(...ring0)).toBe(0);
  });

  it("desfasa medio hueco los anillos impares (tresbolillo)", () => {
    const l = trophyLayout(mk(RING_CAPACITY + 1));
    expect(l[RING_CAPACITY].angle).toBe(360 / RING_CAPACITY / 2);
  });

  it("ignora entradas sin id y no revienta con vacío", () => {
    expect(trophyLayout([null, { text: "sin id" }, { id: "ok", text: "x" }])).toHaveLength(1);
    expect(trophyLayout()).toEqual([]);
  });
});

describe("overflowCount", () => {
  it("cuenta las que no caben en la copa", () => {
    expect(overflowCount(mk(30))).toBe(30 - RING_CAPACITY * MAX_RINGS);
    expect(overflowCount(mk(3))).toBe(0);
    expect(overflowCount()).toBe(0);
  });
});

describe("gratitudeParties", () => {
  const ctx = { myName: "Fran", myPersonId: "p1", partnerName: "Ana" };

  it("de mí para mi pareja cuando la mandé yo (por person-id)", () => {
    const p = gratitudeParties({ fromId: "p1", fromName: "Fran" }, ctx);
    expect(p).toEqual({ from: "Fran", to: "Ana", mine: true });
  });

  it("de mi pareja para mí cuando la mandó ella", () => {
    const p = gratitudeParties({ fromId: "p2", fromName: "Ana" }, ctx);
    expect(p).toEqual({ from: "Ana", to: "Fran", mine: false });
  });

  it("sigue funcionando con entradas viejas sin fromId (fallback por nombre)", () => {
    expect(gratitudeParties({ fromName: "Fran" }, ctx).to).toBe("Ana");
    expect(gratitudeParties({ fromName: "Ana" }, ctx).to).toBe("Fran");
  });

  it("usa el nombre guardado si yo me renombré después", () => {
    const p = gratitudeParties({ fromId: "p2", fromName: "Anita" }, ctx);
    expect(p.from).toBe("Anita");
  });

  it("nunca deja huecos vacíos sin nombres configurados", () => {
    const p = gratitudeParties({ fromName: "" }, {});
    expect(p.from).toBeTruthy();
    expect(p.to).toBeTruthy();
  });
});

describe("rotationToFace", () => {
  it("lleva la placa al frente", () => {
    expect(rotationToFace(90, 0)).toBe(-90);
  });

  it("gira por el camino corto, no da la vuelta larga", () => {
    // Estamos en -350°; la placa de 0° está a 10° de distancia, no a 350°.
    const r = rotationToFace(0, -350);
    expect(r).toBe(-360);
    expect(Math.abs(r - (-350))).toBeLessThanOrEqual(180);
  });

  it("no se mueve si ya está de frente", () => {
    expect(rotationToFace(45, -45)).toBe(-45);
  });

  it("el desplazamiento nunca supera media vuelta", () => {
    for (const angle of [0, 45, 90, 135, 180, 225, 270, 315]) {
      for (const cur of [-720, -197, -45, 0, 33, 400]) {
        expect(Math.abs(rotationToFace(angle, cur) - cur)).toBeLessThanOrEqual(180);
      }
    }
  });
});
