import { describe, it, expect } from "vitest";
import { sol, fase, clima, paleta, discoSol } from "../lib/cielo.js";

const BCN = { lat: 41.39, lon: 2.17 };
const utc = (s) => new Date(s);

describe("sol (fórmula astronómica, sin red)", () => {
  // Mediodía solar en el solsticio de verano: 90 − 41,39 + 23,44 ≈ 72°.
  it("solsticio de verano a mediodía en Barcelona ≈ 72°", () => {
    const { elevacion } = sol(utc("2026-06-21T11:52:00Z"), BCN.lat, BCN.lon);
    expect(elevacion).toBeGreaterThan(70.5);
    expect(elevacion).toBeLessThan(73.5);
  });
  it("equinoccio a mediodía ≈ 48–49°", () => {
    const { elevacion } = sol(utc("2026-09-22T11:45:00Z"), BCN.lat, BCN.lon);
    expect(elevacion).toBeGreaterThan(47);
    expect(elevacion).toBeLessThan(50.5);
  });
  it("a medianoche el sol está bajo el horizonte", () => {
    expect(sol(utc("2026-09-28T22:00:00Z"), BCN.lat, BCN.lon).elevacion).toBeLessThan(-20);
  });
  it("por la mañana el ángulo horario es negativo, por la tarde positivo", () => {
    expect(sol(utc("2026-09-28T07:30:00Z"), BCN.lat, BCN.lon).anguloHorario).toBeLessThan(0);
    expect(sol(utc("2026-09-28T16:00:00Z"), BCN.lat, BCN.lon).anguloHorario).toBeGreaterThan(0);
  });
});

describe("fase", () => {
  it("día, dorada, crepúsculo y noche", () => {
    expect(fase({ elevacion: 40, anguloHorario: 0 }).id).toBe("dia");
    expect(fase({ elevacion: 5, anguloHorario: -60 }).nombre).toBe("amanecer");
    expect(fase({ elevacion: 5, anguloHorario: 60 }).nombre).toBe("atardecer");
    expect(fase({ elevacion: -3, anguloHorario: 80 }).id).toBe("crepusculo");
    expect(fase({ elevacion: -30, anguloHorario: 180 }).id).toBe("noche");
  });
  it("en Barcelona a las 21:30 de un 28 de septiembre ya es de noche", () => {
    expect(fase(sol(utc("2026-09-28T19:30:00Z"), BCN.lat, BCN.lon)).id).toBe("noche");
  });
});

describe("clima (códigos WMO de Open-Meteo)", () => {
  it("traduce los códigos", () => {
    expect(clima(0).id).toBe("despejado");
    expect(clima(3)).toMatchObject({ id: "cubierto", gris: true });
    expect(clima(45).niebla).toBe(true);
    expect(clima(63)).toMatchObject({ id: "lluvia", lluvia: 1 });
    expect(clima(65).lluvia).toBe(2);
    expect(clima(73).nieve).toBe(true);
    expect(clima(95).tormenta).toBe(true);
  });
  // Sin datos del tiempo NO se inventa un clima: se dice.
  it("sin código, lo dice en vez de inventar", () => {
    expect(clima(undefined)).toMatchObject({ id: "desconocido", texto: "sin datos del tiempo", nubes: 0 });
  });
});

describe("paleta y disco del sol", () => {
  it("con lluvia el cielo se vuelve gris", () => {
    expect(paleta("dia", clima(63)).arriba).not.toBe(paleta("dia", clima(0)).arriba);
  });
  it("Nix tiene agua en vez de tierra", () => {
    expect(paleta("dia", {}, { agua: true }).suelo).not.toBe(paleta("dia", {}).suelo);
  });
  it("de noche no hay sol; de día está dentro del cielo", () => {
    expect(discoSol({ elevacion: -20, anguloHorario: 170 })).toBeNull();
    const d = discoSol({ elevacion: 45, anguloHorario: -30 });
    expect(d.x).toBeGreaterThan(0); expect(d.x).toBeLessThan(0.5);   // mañana: a la izquierda (este)
    expect(d.y).toBeLessThan(0.5);
  });
});
