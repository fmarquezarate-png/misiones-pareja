import { describe, it, expect } from "vitest";
import {
  scorerKey, mergeScorers, participaciones, hasAssists,
  sortScorers, filterMyTeam, totales, compsConGoleadores, MODOS,
} from "../lib/scorers.js";

const liga = comp => ({ comp, scorers: [] });

describe("scorerKey", () => {
  // Acentos, mayúsculas y espacios de más sí se ignoran. La puntuación se
  // convierte en espacio (mismo `norm` que usa todo el proyecto), así que
  // "F.C." y "FC" NO son la misma cadena — y da igual: las dos competiciones
  // vienen de la misma API, que devuelve siempre la misma grafía del club.
  it("ignora acentos, mayúsculas y espacios de más", () => {
    expect(scorerKey({ name: "Robert Lewandowski", teamName: "FC Barcelona" }))
      .toBe(scorerKey({ name: "róbert  LEWANDOWSKI", teamName: "FC  Barcelona " }));
  });
  it("distingue el mismo nombre en equipos distintos", () => {
    expect(scorerKey({ name: "Juan Pérez", teamName: "Getafe CF" }))
      .not.toBe(scorerKey({ name: "Juan Pérez", teamName: "CA Osasuna" }));
  });
});

describe("mergeScorers", () => {
  it("suma goles del mismo jugador en dos competiciones", () => {
    const r = mergeScorers([
      { comp: "Liga", scorers: [{ name: "Lewandowski", teamName: "FC Barcelona", goals: 8, assists: 2 }] },
      { comp: "Champions", scorers: [{ name: "Lewandowski", teamName: "FC Barcelona", goals: 3, assists: 1 }] },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].goals).toBe(11);
    expect(r[0].assists).toBe(3);
    expect(r[0].porComp).toEqual({ Liga: { g: 8, a: 2 }, Champions: { g: 3, a: 1 } });
  });

  it("no junta a dos jugadores homónimos de equipos distintos", () => {
    const r = mergeScorers([{ comp: "Liga", scorers: [
      { name: "Juan Pérez", teamName: "Getafe CF", goals: 4 },
      { name: "Juan Pérez", teamName: "CA Osasuna", goals: 2 },
    ] }]);
    expect(r).toHaveLength(2);
  });

  // `null` significa "la fuente no publica este dato", que NO es cero.
  // Sumarlo como 0 convertiría un dato desconocido en un dato inventado.
  it("null + null sigue siendo null, no 0", () => {
    const r = mergeScorers([
      { comp: "Liga", scorers: [{ name: "X", teamName: "T", goals: 2, assists: null }] },
      { comp: "Champions", scorers: [{ name: "X", teamName: "T", goals: 1, assists: null }] },
    ]);
    expect(r[0].assists).toBeNull();
  });

  it("si una competición sí publica asistencias, se cuenta la que hay", () => {
    const r = mergeScorers([
      { comp: "Liga", scorers: [{ name: "X", teamName: "T", goals: 2, assists: null }] },
      { comp: "Champions", scorers: [{ name: "X", teamName: "T", goals: 1, assists: 4 }] },
    ]);
    expect(r[0].assists).toBe(4);
  });

  it("aguanta listas vacías y jugadores sin nombre", () => {
    expect(mergeScorers([liga("Liga")])).toEqual([]);
    expect(mergeScorers([{ comp: "Liga", scorers: [{ goals: 3 }] }])).toEqual([]);
    expect(mergeScorers()).toEqual([]);
  });
});

describe("participaciones y hasAssists", () => {
  it("suma goles y asistencias", () => {
    expect(participaciones({ goals: 8, assists: 3 })).toBe(11);
  });
  it("con asistencias desconocidas devuelve solo los goles", () => {
    expect(participaciones({ goals: 8, assists: null })).toBe(8);
  });
  it("hasAssists distingue 'sin datos' de 'cero asistencias'", () => {
    expect(hasAssists([{ assists: null }, { assists: null }])).toBe(false);
    expect(hasAssists([{ assists: null }, { assists: 0 }])).toBe(true);
    expect(hasAssists([])).toBe(false);
  });
});

describe("sortScorers", () => {
  const rows = [
    { name: "B", goals: 5, assists: 9 },
    { name: "A", goals: 9, assists: 1 },
    { name: "C", goals: 5, assists: 2 },
  ];
  it("ordena por goles", () => {
    expect(sortScorers(rows, "goles").map(r => r.name)).toEqual(["A", "B", "C"]);
  });
  it("ordena por asistencias", () => {
    expect(sortScorers(rows, "asistencias").map(r => r.name)).toEqual(["B", "C", "A"]);
  });
  // Sin desempate estable la lista bailaría al volver a entrar.
  it("empate total se desempata por nombre", () => {
    const e = [{ name: "Zz", goals: 3, assists: 1 }, { name: "Aa", goals: 3, assists: 1 }];
    expect(sortScorers(e, "goles").map(r => r.name)).toEqual(["Aa", "Zz"]);
  });
  it("no muta la lista original", () => {
    const orig = [...rows];
    sortScorers(rows, "goles");
    expect(rows).toEqual(orig);
  });
});

describe("filterMyTeam", () => {
  it("se queda con los del equipo, por nombre exacto", () => {
    const rows = [
      { name: "Lewandowski", teamName: "FC Barcelona", goals: 8 },
      { name: "Mbappé", teamName: "Real Madrid CF", goals: 9 },
    ];
    expect(filterMyTeam(rows, "barcelona").map(r => r.name)).toEqual(["Lewandowski"]);
  });

  // El caso trampa documentado en CLAUDE.md §5: "RCD Espanyol de Barcelona"
  // CONTIENE "Barcelona". Un filtro por `includes` colaría al Espanyol.
  it("no cuela al Espanyol en el Barça", () => {
    const rows = [{ name: "Alguien", teamName: "RCD Espanyol de Barcelona", goals: 4 }];
    expect(filterMyTeam(rows, "barcelona")).toEqual([]);
  });

  it("sin equipo devuelve todo", () => {
    const rows = [{ name: "X", teamName: "Y" }];
    expect(filterMyTeam(rows, null)).toBe(rows);
  });

  it("un equipo que no está en el catálogo no rompe el filtro", () => {
    const rows = [{ name: "X", teamName: "Sporting de Lisboa", goals: 3 }];
    expect(filterMyTeam(rows, "barcelona")).toEqual([]);
  });
});

describe("totales", () => {
  it("suma el bloque", () => {
    expect(totales([{ goals: 8, assists: 3 }, { goals: 2, assists: 1 }]))
      .toEqual({ goles: 10, asistencias: 4, jugadores: 2 });
  });
  it("las asistencias desconocidas no cuentan como 0 en el total", () => {
    expect(totales([{ goals: 8, assists: null }, { goals: 2, assists: 1 }]))
      .toEqual({ goles: 10, asistencias: 1, jugadores: 2 });
  });
  it("lista vacía", () => {
    expect(totales()).toEqual({ goles: 0, asistencias: 0, jugadores: 0 });
  });
});

describe("compsConGoleadores", () => {
  // La Copa del Rey no está en el plan gratuito de football-data: ofrecer un
  // botón para ella sería prometer datos que nunca llegan.
  it("solo ofrece liga, Champions y la suma", () => {
    const c = compsConGoleadores("es.1", "LaLiga");
    expect(c.map(x => x.id)).toEqual(["es.1", "cl", "todas"]);
    expect(c[0].label).toBe("LaLiga");
  });
});

describe("MODOS", () => {
  it("cada modo apunta a un campo real de las filas", () => {
    const fila = mergeScorers([{ comp: "Liga", scorers: [{ name: "X", teamName: "T", goals: 3, assists: 2 }] }])[0];
    for (const m of Object.values(MODOS)) expect(fila[m.campo]).toBeDefined();
  });
});
