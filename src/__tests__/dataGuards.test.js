import { describe, it, expect } from "vitest";
import { countMissions, assessWrite, isBackupUsable } from "../lib/dataGuards.js";

// Helpers: blobs mínimos con N misiones repartidas en semanas
const blobWith = (n) => {
  const missions = Array.from({ length: n }, (_, i) => ({ id: `m${i}`, title: `M${i}` }));
  return { weeks: { "2026-W01": { missions } }, settings: { person1: "A", person2: "B" } };
};
const EMPTY = { weeks: {}, settings: { person1: "A", person2: "B" } };
const NOW = Date.parse("2026-07-13T12:00:00Z");
const COUPLE = "42a03092-617d-4a3c-9ea3-ffbd2212d45c";
const backupRow = (over = {}) => ({
  couple_id: COUPLE,
  data: blobWith(52),
  created_at: "2026-07-12T09:00:00Z",
  ...over,
});

describe("countMissions", () => {
  it("suma misiones de todas las semanas", () => {
    const d = { weeks: { a: { missions: [{}, {}] }, b: { missions: [{}] }, c: {} } };
    expect(countMissions(d)).toBe(3);
  });
  it("devuelve 0 para estructuras rotas sin lanzar", () => {
    expect(countMissions(null)).toBe(0);
    expect(countMissions({})).toBe(0);
    expect(countMissions({ weeks: null })).toBe(0);
    expect(countMissions({ weeks: { w: { missions: "no-array" } } })).toBe(0);
  });
});

describe("assessWrite — escritura normal permitida", () => {
  it("permite guardar sin referencia previa (primer arranque / restore)", () => {
    expect(assessWrite(null, blobWith(10)).blocked).toBe(false);
    expect(assessWrite(undefined, EMPTY).blocked).toBe(false);
  });
  it("permite ediciones normales: mismo conteo, -1, o crecer", () => {
    expect(assessWrite(50, blobWith(50)).blocked).toBe(false);
    expect(assessWrite(50, blobWith(49)).blocked).toBe(false);
    expect(assessWrite(10, blobWith(30)).blocked).toBe(false);
  });
  it("permite caídas bajo el umbral (30% con umbral 40%)", () => {
    expect(assessWrite(50, blobWith(35)).blocked).toBe(false);
  });
  it("no molesta a parejas con pocas misiones (bajo minPrevDrop)", () => {
    expect(assessWrite(4, blobWith(1)).blocked).toBe(false); // -75% pero prev<5
    expect(assessWrite(2, blobWith(0)).blocked).toBe(false); // borrar las últimas 2
  });
});

describe("assessWrite — caída masiva bloqueada", () => {
  it("bloquea una caída del 60% (50 → 20)", () => {
    const v = assessWrite(50, blobWith(20));
    expect(v).toMatchObject({ blocked: true, reason: "mass_drop", prev: 50, next: 20 });
  });
  it("bloquea justo pasado el umbral (50 → 29 es -42%)", () => {
    expect(assessWrite(50, blobWith(29)).blocked).toBe(true);
  });
  it("bloquea un vaciado total habiendo datos (app_data vacío entrante)", () => {
    const v = assessWrite(10, EMPTY);
    expect(v).toMatchObject({ blocked: true, reason: "wipe", prev: 10, next: 0 });
  });
  it("bloquea el vaciado desde el mínimo configurado (3 → 0)", () => {
    expect(assessWrite(3, blobWith(0)).blocked).toBe(true);
  });
  it("bloquea también si el 'vacío' es un blob corrupto que cuenta 0", () => {
    // app_data corrupto (weeks roto) cuenta 0 misiones → mismo bloqueo que un wipe
    expect(assessWrite(10, { weeks: null }).blocked).toBe(true);
  });
});

describe("isBackupUsable — backup válido", () => {
  it("acepta un backup sano de la pareja correcta", () => {
    expect(isBackupUsable(backupRow(), COUPLE, { now: NOW })).toBe(true);
  });
});

describe("isBackupUsable — backup inválido", () => {
  it("rechaza pareja distinta o couple_id nulo (trigger con cast fallido)", () => {
    expect(isBackupUsable(backupRow(), "otra-pareja", { now: NOW })).toBe(false);
    expect(isBackupUsable(backupRow({ couple_id: null }), COUPLE, { now: NOW })).toBe(false);
  });
  it("rechaza data corrupta o absurdamente vacía", () => {
    expect(isBackupUsable(backupRow({ data: null }), COUPLE, { now: NOW })).toBe(false);
    expect(isBackupUsable(backupRow({ data: { weeks: null, settings: {} } }), COUPLE, { now: NOW })).toBe(false);
    expect(isBackupUsable(backupRow({ data: EMPTY }), COUPLE, { now: NOW })).toBe(false);
    expect(isBackupUsable(backupRow({ data: blobWith(0) }), COUPLE, { now: NOW })).toBe(false);
  });
  it("rechaza timestamps irrazonables: ilegible, futuro, demasiado viejo", () => {
    expect(isBackupUsable(backupRow({ created_at: "???" }), COUPLE, { now: NOW })).toBe(false);
    expect(isBackupUsable(backupRow({ created_at: "2026-07-20T00:00:00Z" }), COUPLE, { now: NOW })).toBe(false);
    expect(isBackupUsable(backupRow({ created_at: "2026-01-01T00:00:00Z" }), COUPLE, { now: NOW })).toBe(false);
  });
});

describe("flujo combinado — los 3 escenarios críticos de carga", () => {
  it("app_data vacío entrante + backup válido → la escritura se bloquea y el backup califica", () => {
    expect(assessWrite(52, EMPTY).blocked).toBe(true);
    expect(isBackupUsable(backupRow(), COUPLE, { now: NOW })).toBe(true);
  });
  it("app_data corrupto + backup válido → escritura bloqueada, backup usable", () => {
    expect(assessWrite(52, { weeks: undefined }).blocked).toBe(true);
    expect(isBackupUsable(backupRow(), COUPLE, { now: NOW })).toBe(true);
  });
  it("carga normal → nada bloquea", () => {
    expect(assessWrite(52, blobWith(51)).blocked).toBe(false);
  });
});
