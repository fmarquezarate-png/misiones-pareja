import { describe, it, expect } from "vitest";
import { seasonOf, teamFixtures, fixtureKey, fixtureToMission, mergeFixtures, leagueUrl } from "../lib/football.js";
import { teamByName, teamById, matchLabel, TEAMS, LEAGUES } from "../lib/teams.js";

// Datos con la forma REAL de openfootball (comprobada contra el archivo vivo).
const MATCHES = [
  { round: "Matchday 1", date: "2026-08-16", time: "19:00", team1: "RCD Espanyol de Barcelona", team2: "Levante UD" },
  { round: "Matchday 2", date: "2026-08-23", time: "21:30", team1: "Elche CF", team2: "FC Barcelona" },
  { round: "Matchday 3", date: "2026-08-30", team1: "FC Barcelona", team2: "Real Madrid CF" },   // sin hora aún
  { round: "Matchday 4", date: "2026-09-13", time: "18:30", team1: "Sevilla FC", team2: "FC Barcelona" },
];

describe("catálogo de equipos", () => {
  it("tiene las dos ligas completas", () => {
    expect(LEAGUES.map(l => l.id)).toEqual(["es.1", "en.1"]);
    for (const lg of LEAGUES) {
      expect(TEAMS.filter(t => t.league === lg.id)).toHaveLength(20);
    }
  });

  it("no hay ids repetidos", () => {
    expect(new Set(TEAMS.map(t => t.id)).size).toBe(TEAMS.length);
  });

  it("todos declaran dos colores y un patrón conocido", () => {
    for (const t of TEAMS) {
      expect(t.colors, t.id).toHaveLength(2);
      for (const c of t.colors) expect(c, `${t.id} ${c}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(["stripes", "halves", "solid", "sash"], t.id).toContain(t.pattern);
    }
  });

  it("resuelve por nombre EXACTO — el Espanyol no es el Barça", () => {
    // El fallo real: "RCD Espanyol de Barcelona" contiene "Barcelona".
    expect(teamByName("FC Barcelona").id).toBe("barcelona");
    expect(teamByName("RCD Espanyol de Barcelona").id).toBe("espanyol");
    expect(teamByName("Barcelona")).toBe(null);        // no es el nombre de la fuente
    expect(teamByName("")).toBe(null);
    expect(teamByName(null)).toBe(null);
  });

  it("tolera espaciado y mayúsculas, no nombres parciales", () => {
    expect(teamByName("  fc   barcelona ").id).toBe("barcelona");
  });

  it("matchLabel usa los nombres cortos y respeta quién es local", () => {
    expect(matchLabel("FC Barcelona", "Real Madrid CF")).toBe("Barça – Madrid");
    expect(matchLabel("Real Madrid CF", "FC Barcelona")).toBe("Madrid – Barça");
  });
});

describe("seasonOf", () => {
  it("de julio en adelante ya es la temporada siguiente", () => {
    expect(seasonOf(new Date(2026, 6, 1))).toBe("2026-27");
    expect(seasonOf(new Date(2026, 11, 31))).toBe("2026-27");
    expect(seasonOf(new Date(2027, 0, 15))).toBe("2026-27");
    expect(seasonOf(new Date(2026, 5, 30))).toBe("2025-26");
  });

  it("arma la URL de la liga", () => {
    expect(leagueUrl("es.1", "2026-27")).toContain("/2026-27/es.1.json");
  });
});

describe("teamFixtures", () => {
  it("solo trae los partidos de MI equipo", () => {
    const f = teamFixtures(MATCHES, "barcelona", { fromDate: "2026-08-01" });
    expect(f).toHaveLength(3);
    expect(f.every(m => m.team1 === "FC Barcelona" || m.team2 === "FC Barcelona")).toBe(true);
  });

  it("no cuela los del Espanyol", () => {
    const f = teamFixtures(MATCHES, "barcelona", { fromDate: "2026-08-01" });
    expect(f.some(m => m.team1.includes("Espanyol") || m.team2.includes("Espanyol"))).toBe(false);
  });

  it("descarta lo anterior a la fecha de corte", () => {
    const f = teamFixtures(MATCHES, "barcelona", { fromDate: "2026-09-01" });
    expect(f).toHaveLength(1);
    expect(f[0].date).toBe("2026-09-13");
  });

  it("respeta el tope y devuelve en orden cronológico", () => {
    const f = teamFixtures(MATCHES, "barcelona", { fromDate: "2026-08-01", limit: 2 });
    expect(f.map(m => m.date)).toEqual(["2026-08-23", "2026-08-30"]);
  });

  it("con un equipo desconocido o sin datos devuelve vacío", () => {
    expect(teamFixtures(MATCHES, "no-existe")).toEqual([]);
    expect(teamFixtures(null, "barcelona")).toEqual([]);
    expect(teamFixtures([{ date: null }], "barcelona")).toEqual([]);
  });
});

describe("fixtureToMission", () => {
  const uid = () => "fixed-id";

  it("crea un evento con título legible y el escudo del RIVAL", () => {
    const m = fixtureToMission(MATCHES[1], "barcelona", { uid });   // Elche – Barça
    expect(m.title).toBe("Elche – Barça");
    expect(m.crest).toBe("elche");
    expect(m.type).toBe("event");
    expect(m.date).toBe("2026-08-23");
    expect(m.time).toBe("21:30");
  });

  it("el icono es un emoji de verdad: viaja bien a push y exportaciones", () => {
    expect(fixtureToMission(MATCHES[1], "barcelona", { uid }).emoji).toBe("⚽");
  });

  it("un partido sin hora anunciada se crea sin hora, no con una inventada", () => {
    const m = fixtureToMission(MATCHES[2], "barcelona", { uid });
    expect(m.time).toBe(null);
    expect(m.date).toBe("2026-08-30");
  });

  it("lleva la marca que permite reconocerlo en la próxima sincronización", () => {
    expect(fixtureToMission(MATCHES[1], "barcelona", { uid }).fixtureKey).toBe(fixtureKey(MATCHES[1]));
  });

  it("nace como evento de los dos y en la categoría de ocio", () => {
    const m = fixtureToMission(MATCHES[1], "barcelona", { uid });
    expect(m.who).toBe("together");
    expect(m.categories).toEqual(["ocio"]);
  });
});

describe("fixtureKey", () => {
  it("no depende del orden de los equipos ni de la hora", () => {
    const a = { date: "2026-08-30", time: "21:00", team1: "FC Barcelona", team2: "Real Madrid CF" };
    const b = { date: "2026-08-30", time: "18:30", team1: "Real Madrid CF", team2: "FC Barcelona" };
    expect(fixtureKey(a)).toBe(fixtureKey(b));
  });

  it("distingue partidos en días distintos", () => {
    expect(fixtureKey({ date: "2026-08-30", team1: "A", team2: "B" }))
      .not.toBe(fixtureKey({ date: "2026-09-06", team1: "A", team2: "B" }));
  });
});

describe("mergeFixtures", () => {
  const uid = () => Math.random().toString(36).slice(2);
  const incoming = teamFixtures(MATCHES, "barcelona", { fromDate: "2026-08-01" })
    .map(m => fixtureToMission(m, "barcelona", { uid }));

  it("en un calendario vacío, todo es nuevo", () => {
    const { nuevos, actualizados } = mergeFixtures([], incoming);
    expect(nuevos).toHaveLength(3);
    expect(actualizados).toHaveLength(0);
  });

  it("sincronizar dos veces NO duplica nada", () => {
    const { nuevos } = mergeFixtures(incoming, incoming);
    expect(nuevos).toHaveLength(0);
  });

  it("cuando la liga anuncia la hora, actualiza el partido en vez de duplicarlo", () => {
    const yaImportado = incoming.map(m => m.date === "2026-08-30" ? { ...m, time: null } : m);
    const conHora = incoming.map(m => m.date === "2026-08-30" ? { ...m, time: "21:00" } : m);
    const { nuevos, actualizados } = mergeFixtures(yaImportado, conHora);
    expect(nuevos).toHaveLength(0);
    expect(actualizados).toHaveLength(1);
    expect(actualizados[0].patch).toEqual({ time: "21:00" });
  });

  it("no toca un partido que ya marcaste como visto", () => {
    const visto = incoming.map(m => ({ ...m, status: "DONE", time: null }));
    const { actualizados } = mergeFixtures(visto, incoming);
    expect(actualizados).toHaveLength(0);
  });

  it("ignora lo que no vino de la sincronización (tus eventos propios)", () => {
    const mios = [{ id: "x", title: "Cena", date: "2026-08-23" }];   // sin fixtureKey
    const { nuevos } = mergeFixtures(mios, incoming);
    expect(nuevos).toHaveLength(3);
  });
});

describe("teamById", () => {
  it("resuelve y devuelve null con basura", () => {
    expect(teamById("barcelona").short).toBe("Barça");
    expect(teamById("nope")).toBe(null);
  });
});
