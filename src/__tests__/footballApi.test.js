import { describe, it, expect } from "vitest";
import { normalizeLiveMatch, matchTeamId, compLabel, stageLabel, lastResultDate } from "../lib/footballApi.js";

describe("normalizeLiveMatch", () => {
  // Forma real de football-data v4.
  const M = {
    utcDate: "2026-09-19T19:00:00Z",
    status: "SCHEDULED",
    matchday: 7,
    competition: { code: "PD", name: "Primera Division" },
    homeTeam: { name: "Sevilla FC", shortName: "Sevilla" },
    awayTeam: { name: "FC Barcelona", shortName: "Barça" },
    score: { fullTime: { home: null, away: null } },
  };

  it("convierte la fecha UTC a fecha y hora LOCAL", () => {
    const n = normalizeLiveMatch(M);
    expect(n.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(n.time).toMatch(/^\d{2}:\d{2}$/);
  });

  it("traduce la competición y la jornada", () => {
    const n = normalizeLiveMatch(M);
    expect(n.comp).toBe("Liga");
    expect(n.round).toBe("J 7");
  });

  it("resuelve los dos equipos contra el catálogo", () => {
    const n = normalizeLiveMatch(M);
    expect(n.homeId).toBe("sevilla");
    expect(n.awayId).toBe("barcelona");
  });

  it("sin marcador deja ft en null, no en ceros", () => {
    expect(normalizeLiveMatch(M).ft).toBe(null);
  });

  it("con marcador lo devuelve como [local, visitante]", () => {
    const jugado = { ...M, status: "FINISHED", score: { fullTime: { home: 1, away: 3 } } };
    expect(normalizeLiveMatch(jugado).ft).toEqual([1, 3]);
  });

  it("un 0-0 es un resultado, no 'sin marcador'", () => {
    const cero = { ...M, status: "FINISHED", score: { fullTime: { home: 0, away: 0 } } };
    expect(normalizeLiveMatch(cero).ft).toEqual([0, 0]);
  });

  it("usa la fase cuando no hay jornada (eliminatorias)", () => {
    const ko = { ...M, matchday: null, stage: "QUARTER_FINALS", competition: { code: "CL" } };
    const n = normalizeLiveMatch(ko);
    expect(n.comp).toBe("Champions");
    expect(n.round).toBe("Cuartos");
  });

  it("descarta entradas sin fecha utilizable", () => {
    expect(normalizeLiveMatch(null)).toBe(null);
    expect(normalizeLiveMatch({})).toBe(null);
    expect(normalizeLiveMatch({ utcDate: "no-es-fecha" })).toBe(null);
  });
});

describe("matchTeamId", () => {
  it("resuelve por nombre completo o corto", () => {
    expect(matchTeamId({ name: "FC Barcelona" })).toBe("barcelona");
    expect(matchTeamId({ name: "Otro", shortName: "Sevilla FC" })).toBe("sevilla");
  });

  it("un rival fuera del catálogo devuelve null, no un equipo cualquiera", () => {
    expect(matchTeamId({ name: "Bayern München" })).toBe(null);
    expect(matchTeamId(null)).toBe(null);
  });

  it("no confunde al Espanyol con el Barça", () => {
    expect(matchTeamId({ name: "RCD Espanyol de Barcelona" })).toBe("espanyol");
  });
});

describe("etiquetas", () => {
  it("traduce los códigos de competición conocidos", () => {
    expect(compLabel("PD")).toBe("Liga");
    expect(compLabel("CL")).toBe("Champions");
    expect(compLabel("CDR")).toBe("Copa");
  });

  it("con un código desconocido devuelve el código, no vacío", () => {
    expect(compLabel("XYZ")).toBe("XYZ");
    expect(compLabel(null)).toBe("—");
  });

  it("traduce las fases de eliminatoria", () => {
    expect(stageLabel("SEMI_FINALS")).toBe("Semis");
    expect(stageLabel("LEAGUE_STAGE")).toBe("Fase liga");
    expect(stageLabel("RARO")).toBe(null);
  });
});

describe("lastResultDate", () => {
  it("encuentra la fecha del último resultado publicado — el dato del retraso", () => {
    const ms = [
      { date: "2026-09-07", score: { ft: [1, 0] } },
      { date: "2026-09-13", score: {} },              // jugado, sin marcador
      { date: "2026-08-30", score: { ft: [2, 2] } },
    ];
    expect(lastResultDate(ms)).toBe("2026-09-07");
  });

  it("sin resultados devuelve null", () => {
    expect(lastResultDate([{ date: "2026-09-13" }])).toBe(null);
    expect(lastResultDate([])).toBe(null);
  });
});
