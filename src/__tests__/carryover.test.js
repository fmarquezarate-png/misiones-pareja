import { describe, it, expect } from "vitest";
import {
  mergeMissionsInto,
  applyCarryOver,
  repairMisplacedMissions,
  syncCarryDone,
} from "../lib/appUtils.js";
import { getWeekAndYear, isoWeekKey } from "../utils.js";

// Semana mínima válida para estas funciones puras.
const wk = (weekNumber, year, missions = []) => ({
  weekNumber, year, epicObjective: "", missions,
  createdAt: 0, workHours: { person1: 0, person2: 0 },
});

describe("mergeMissionsInto — append granular idempotente (fix 0.3)", () => {
  it("añade las misiones nuevas a una semana existente", () => {
    const data = { weeks: { "2026-W10": wk(10, 2026, [{ id: "A", title: "vieja" }]) } };
    const out = mergeMissionsInto(data, "2026-W10", [{ id: "C1", title: "carry", carriedFrom: "orig1" }]);
    expect(out.weeks["2026-W10"].missions.map(m => m.id)).toEqual(["A", "C1"]);
  });

  it("REBASE: aplicado sobre datos frescos de la pareja, conserva lo suyo Y añade lo nuestro", () => {
    // La pareja agregó la misión P mientras nosotros carreábamos C1.
    const partnerFresh = { weeks: { "2026-W10": wk(10, 2026, [{ id: "P", title: "de la pareja" }]) } };
    const out = mergeMissionsInto(partnerFresh, "2026-W10", [{ id: "C1", title: "carry", carriedFrom: "orig1" }]);
    expect(out.weeks["2026-W10"].missions.map(m => m.id).sort()).toEqual(["C1", "P"]);
  });

  it("no re-agrega un carry cuyo original (carriedFrom) ya está presente", () => {
    const data = { weeks: { "2026-W10": wk(10, 2026, [{ id: "X", carriedFrom: "orig1", title: "ya carreada" }]) } };
    const out = mergeMissionsInto(data, "2026-W10", [{ id: "C1", carriedFrom: "orig1", title: "dup" }]);
    expect(out).toBe(data); // sin cambios → misma referencia
  });

  it("no re-agrega una serie (seriesId) ya instanciada esta semana", () => {
    const data = { weeks: { "2026-W10": wk(10, 2026, [{ id: "S", seriesId: "s1", title: "serie" }]) } };
    const out = mergeMissionsInto(data, "2026-W10", [{ id: "S2", seriesId: "s1", title: "serie" }]);
    expect(out).toBe(data);
  });

  it("no re-agrega un carry cuyo título ya existe", () => {
    const data = { weeks: { "2026-W10": wk(10, 2026, [{ id: "T", title: "Comprar pan" }]) } };
    const out = mergeMissionsInto(data, "2026-W10", [{ id: "C1", carriedFrom: "orig1", title: "Comprar pan" }]);
    expect(out).toBe(data);
  });

  it("no duplica por id ya presente (doble undo / doble invoke)", () => {
    const data = { weeks: { "2026-W10": wk(10, 2026, [{ id: "C1", title: "carry", carriedFrom: "orig1" }]) } };
    const out = mergeMissionsInto(data, "2026-W10", [{ id: "C1", title: "carry", carriedFrom: "orig1" }]);
    expect(out).toBe(data);
  });

  it("crea la semana si no existe, usando weekMeta", () => {
    const data = { weeks: {} };
    const out = mergeMissionsInto(data, "2026-W10", [{ id: "C1", title: "carry" }], { wn: 10, yr: 2026 });
    expect(out.weeks["2026-W10"].weekNumber).toBe(10);
    expect(out.weeks["2026-W10"].missions.map(m => m.id)).toEqual(["C1"]);
  });

  it("no-op si la lista está vacía o la semana no existe sin meta", () => {
    const data = { weeks: {} };
    expect(mergeMissionsInto(data, "2026-W10", [])).toBe(data);
    expect(mergeMissionsInto(data, "2026-W10", [{ id: "C1" }])).toBe(data);
  });
});

describe("applyCarryOver", () => {
  const build = (prevMissions) => ({
    currentWeekNumber: 10, currentYear: 2026,
    weeks: {
      "2026-W09": wk(9, 2026, prevMissions),
      "2026-W10": wk(10, 2026, []),
    },
  });

  it("arrastra las no completadas de la semana previa con carriedFrom seteado", () => {
    const out = applyCarryOver(build([{ id: "a", title: "pendiente", status: "TBC" }]));
    const carried = out.weeks["2026-W10"].missions;
    expect(carried).toHaveLength(1);
    expect(carried[0].carriedFrom).toBe("a");
    expect(carried[0].carriedFromWeek).toBe("2026-W09");
    expect(carried[0].id).not.toBe("a"); // id nuevo
  });

  it("no arrastra las completadas (DONE)", () => {
    const out = applyCarryOver(build([{ id: "a", title: "hecha", status: "DONE" }]));
    expect(out.weeks["2026-W10"].missions).toHaveLength(0);
  });

  it("preserva el status ASAP al arrastrar (no lo baja a TBC)", () => {
    const out = applyCarryOver(build([{ id: "a", title: "urgente", status: "ASAP" }]));
    expect(out.weeks["2026-W10"].missions[0].status).toBe("ASAP");
  });

  it("instancia una serie semanal en la semana nueva (status TBC, id nuevo)", () => {
    const out = applyCarryOver(build([{ id: "s", title: "serie", status: "TBC", seriesPattern: "weekly", seriesId: "s1" }]));
    // Se arrastra como pendiente (carry) Y se instancia la serie: dedupe por título evita duplicar,
    // así que al menos existe la instancia de serie con seriesId.
    const hasSeries = out.weeks["2026-W10"].missions.some(m => m.seriesId === "s1");
    expect(hasSeries).toBe(true);
  });

  it("no re-arrastra algo que ya está carreado en la semana actual", () => {
    const data = build([{ id: "a", title: "pendiente", status: "TBC" }]);
    data.weeks["2026-W10"].missions = [{ id: "x", title: "pendiente", carriedFrom: "a" }];
    const out = applyCarryOver(data);
    expect(out).toBe(data); // nada nuevo → misma referencia (return data)
  });
});

describe("applyCarryOver — eventos recurrentes (feature nueva)", () => {
  const buildEv = (prevMissions) => ({
    currentWeekNumber: 10, currentYear: 2026,
    weeks: { "2026-W09": wk(9, 2026, prevMissions), "2026-W10": wk(10, 2026, []) },
  });

  it("instancia un evento recurrente semanal CON fecha real (mismo día de semana), no date:null", () => {
    // 2026-02-25 es miércoles.
    const out = applyCarryOver(buildEv([{ id: "e", title: "cita", type: "event", status: "TBC", date: "2026-02-25", time: "18:00", endTime: "19:00", seriesPattern: "weekly", seriesId: "s1" }]));
    const inst = out.weeks["2026-W10"].missions.find(m => m.seriesId === "s1");
    expect(inst).toBeTruthy();
    expect(inst.type).toBe("event");
    expect(inst.date).toBeTruthy();
    expect(inst.time).toBe("18:00");
    expect(inst.endTime).toBe("19:00");
    // mismo día de la semana que el original
    expect(new Date(inst.date + "T00:00").getDay()).toBe(new Date("2026-02-25T00:00").getDay());
  });

  it("desplaza endDate el mismo delta en eventos recurrentes multi-día", () => {
    const out = applyCarryOver(buildEv([{ id: "e", title: "viaje", type: "event", status: "TBC", date: "2026-02-25", endDate: "2026-02-27", seriesPattern: "weekly", seriesId: "s1" }]));
    const inst = out.weeks["2026-W10"].missions.find(m => m.seriesId === "s1");
    const span = Math.round((new Date(inst.endDate + "T00:00") - new Date(inst.date + "T00:00")) / 86400000);
    expect(span).toBe(2); // conserva la duración de 2 días
  });

  it("NO arrastra un evento no completado como pendiente sin fecha (toCarry excluye eventos)", () => {
    const out = applyCarryOver(buildEv([{ id: "e", title: "cena", type: "event", status: "TBC", date: "2026-02-25" }]));
    expect(out.weeks["2026-W10"].missions).toHaveLength(0);
  });

  it("una TAREA recurrente sigue instanciándose sin fecha (date:null)", () => {
    const out = applyCarryOver(buildEv([{ id: "t", title: "regar", type: "task", status: "TBC", seriesPattern: "weekly", seriesId: "s2" }]));
    const inst = out.weeks["2026-W10"].missions.find(m => m.seriesId === "s2");
    expect(inst.date).toBe(null);
  });
});

describe("repairMisplacedMissions", () => {
  it("mueve una misión cuya fecha cae en otra semana a la correcta", () => {
    // Fecha real de la misión: 2026-03-04 → su semana ISO.
    const date = "2026-03-04";
    const { week: wn, year: yr } = getWeekAndYear(new Date(date));
    const correctKey = isoWeekKey(wn, yr);
    const wrongKey = "2026-W01"; // deliberadamente mal ubicada
    const data = { weeks: { [wrongKey]: wk(1, 2026, [{ id: "m", title: "evento", date }]) } };
    const { data: fixed, moved } = repairMisplacedMissions(data);
    expect(moved).toBe(1);
    expect(fixed.weeks[wrongKey].missions).toHaveLength(0);
    expect(fixed.weeks[correctKey].missions.map(m => m.id)).toContain("m");
  });

  it("es idempotente: una segunda pasada no mueve nada", () => {
    const date = "2026-03-04";
    const data = { weeks: { "2026-W01": wk(1, 2026, [{ id: "m", title: "evento", date }]) } };
    const { data: once } = repairMisplacedMissions(data);
    const { moved } = repairMisplacedMissions(once);
    expect(moved).toBe(0);
  });

  it("no toca misiones sin fecha", () => {
    const data = { weeks: { "2026-W10": wk(10, 2026, [{ id: "m", title: "sin fecha", date: null }]) } };
    const { moved } = repairMisplacedMissions(data);
    expect(moved).toBe(0);
  });
});

describe("syncCarryDone", () => {
  it("marca DONE el original de la semana anterior y completedLate salvo ASAP", () => {
    const data = {
      weeks: {
        "2026-W09": wk(9, 2026, [{ id: "orig", title: "t", status: "TBC" }]),
        "2026-W10": wk(10, 2026, [{ id: "carry", title: "t", status: "DONE", carriedFrom: "orig", carriedFromWeek: "2026-W09" }]),
      },
    };
    const out = syncCarryDone(data, "2026-W10", "carry");
    const orig = out.weeks["2026-W09"].missions[0];
    expect(orig.status).toBe("DONE");
    expect(orig.completedLate).toBe(true);
  });

  it("no marca completedLate si el original era ASAP", () => {
    const data = {
      weeks: {
        "2026-W09": wk(9, 2026, [{ id: "orig", title: "t", status: "ASAP" }]),
        "2026-W10": wk(10, 2026, [{ id: "carry", title: "t", status: "DONE", carriedFrom: "orig", carriedFromWeek: "2026-W09" }]),
      },
    };
    const out = syncCarryDone(data, "2026-W10", "carry");
    expect(out.weeks["2026-W09"].missions[0].completedLate).toBe(false);
  });

  it("no hace nada si la misión no es un carry", () => {
    const data = { weeks: { "2026-W10": wk(10, 2026, [{ id: "m", title: "t", status: "DONE" }]) } };
    expect(syncCarryDone(data, "2026-W10", "m")).toBe(data);
  });
});
