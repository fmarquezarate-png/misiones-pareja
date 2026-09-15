import { describe, it, expect } from "vitest";
import { buildStandings, standingsAround, teamForm, teamTimeline, resultFor, playedMatches } from "../lib/standings.js";

// Forma REAL de openfootball: score.ft = [local, visitante].
const M = (date, t1, t2, ft, time) => ({ round: "x", date, time, team1: t1, team2: t2, ...(ft ? { score: { ft } } : {}) });
const BAR = "FC Barcelona", MAD = "Real Madrid CF", SEV = "Sevilla FC", ESP = "RCD Espanyol de Barcelona";

const LIGA = [
  M("2026-08-16", BAR, SEV, [2, 0]),
  M("2026-08-17", MAD, ESP, [1, 1]),
  M("2026-08-23", SEV, MAD, [0, 3]),
  M("2026-08-24", ESP, BAR, [1, 4]),
  M("2026-08-30", BAR, MAD, [1, 0]),
  M("2026-09-06", MAD, BAR, [2, 0]),
  M("2026-09-13", SEV, ESP, [1, 0]),
  M("2026-09-20", BAR, ESP, null, "21:00"),      // por jugar
  M("2026-09-27", MAD, SEV, null, "18:30"),      // por jugar
];

describe("buildStandings", () => {
  const t = buildStandings(LIGA);
  const row = name => t.find(r => r.name === name);

  it("cuenta partidos, puntos, goles y diferencia", () => {
    const b = row("Barça");
    expect(b.pj).toBe(4);
    expect(b.g).toBe(3); expect(b.e).toBe(0); expect(b.p).toBe(1);
    expect(b.pts).toBe(9);
    expect(b.gf).toBe(7); expect(b.gc).toBe(3); expect(b.dg).toBe(4);
  });

  it("reparte un punto a cada uno en el empate", () => {
    expect(row("Espanyol").pts).toBe(1);
    expect(row("Madrid").e).toBe(1);
  });

  it("ignora los partidos sin marcador", () => {
    expect(row("Barça").pj).toBe(4);           // no cuenta el del día 20
    expect(playedMatches(LIGA)).toHaveLength(7);
  });

  it("asigna posiciones consecutivas desde 1", () => {
    expect(t.map(r => r.pos)).toEqual(t.map((_, i) => i + 1));
  });

  it("desempata por enfrentamiento directo cuando el cruce está COMPLETO", () => {
    // Barça y Madrid acaban con 9 y 10... comprobamos el mecanismo con un caso
    // construido: dos equipos igualados a puntos con ida y vuelta jugada.
    const cruce = [
      M("2026-01-10", BAR, MAD, [3, 0]),
      M("2026-02-10", MAD, BAR, [1, 0]),
      M("2026-03-10", BAR, SEV, [0, 3]),
      M("2026-03-11", MAD, SEV, [0, 3]),
    ];
    const tabla = buildStandings(cruce);
    const bar = tabla.find(r => r.name === "Barça");
    const mad = tabla.find(r => r.name === "Madrid");
    expect(bar.pts).toBe(mad.pts);                 // empatados a 3
    expect(bar.pos).toBeLessThan(mad.pos);         // 3-0 y 0-1 → gana el Barça el cruce
  });

  it("si el cruce NO está completo, no aplica el directo: usa diferencia general", () => {
    const soloIda = [
      M("2026-01-10", BAR, MAD, [1, 0]),           // solo UN partido entre ellos
      M("2026-02-10", MAD, SEV, [5, 0]),
      M("2026-03-01", SEV, BAR, [3, 0]),
    ];
    // Los tres a 3 puntos; Madrid con +5 de diferencia y el Barça con -2.
    const tabla = buildStandings(soloIda);
    const bar = tabla.find(r => r.name === "Barça");
    const mad = tabla.find(r => r.name === "Madrid");
    expect(bar.pts).toBe(mad.pts);
    expect(mad.pos).toBeLessThan(bar.pos);         // Madrid tiene mejor diferencia
  });

  it("no revienta sin datos", () => {
    expect(buildStandings([])).toEqual([]);
    expect(buildStandings(null)).toEqual([]);
    expect(buildStandings([{ date: "2026-01-01", team1: BAR, team2: MAD }])).toHaveLength(0);
  });
});

describe("standingsAround", () => {
  const t = buildStandings(LIGA);

  it("si el equipo está entre los primeros, no repite filas", () => {
    const lider = t[0].teamId;
    const { cabeza, entorno, hayHueco } = standingsAround(t, lider, { top: 4 });
    expect(cabeza).toHaveLength(Math.min(4, t.length));
    expect(entorno).toHaveLength(0);
    expect(hayHueco).toBe(false);
  });

  it("si está más abajo, muestra la cabeza y su entorno", () => {
    const larga = buildStandings(LIGA).concat(
      Array.from({ length: 12 }, (_, i) => ({ teamId: `x${i}`, name: `X${i}`, key: `x${i}`, pj: 4, g: 0, e: 0, p: 4, gf: 0, gc: 9, dg: -9, pts: 0, pos: 5 + i }))
    );
    const { cabeza, entorno, hayHueco } = standingsAround(larga, "x8", { top: 4, around: 1 });
    expect(cabeza).toHaveLength(4);
    expect(entorno.map(r => r.teamId)).toContain("x8");
    expect(hayHueco).toBe(true);
  });

  it("con un equipo que no está en la tabla, devuelve solo la cabeza", () => {
    const { cabeza, entorno } = standingsAround(t, "no-existe");
    expect(cabeza.length).toBeGreaterThan(0);
    expect(entorno).toHaveLength(0);
  });
});

describe("teamForm", () => {
  it("da la racha del más antiguo al más reciente", () => {
    expect(teamForm(LIGA, "barcelona")).toEqual(["G", "G", "G", "P"]);
  });

  it("respeta el tope", () => {
    expect(teamForm(LIGA, "barcelona", 2)).toEqual(["G", "P"]);
  });

  it("el Espanyol no contamina la racha del Barça", () => {
    // "RCD Espanyol de Barcelona" contiene "Barcelona": la trampa de siempre.
    expect(teamForm(LIGA, "espanyol")).toEqual(["E", "P", "P"]);
  });
});

describe("teamTimeline", () => {
  const { pasados, proximos } = teamTimeline(LIGA, "barcelona", { pasados: 3, proximos: 5, hoy: "2026-09-15" });

  it("devuelve los últimos jugados, del más reciente hacia atrás", () => {
    expect(pasados).toHaveLength(3);
    expect(pasados[0].date).toBe("2026-09-06");
    expect(pasados[2].date).toBe("2026-08-24");
  });

  it("devuelve los próximos en orden, solo de hoy en adelante", () => {
    expect(proximos.map(m => m.date)).toEqual(["2026-09-20"]);
  });

  it("un partido YA JUGADO sin marcador publicado NO desaparece", () => {
    // El bug real: se filtraba por tener resultado, así que los partidos que la
    // fuente aún no había actualizado se caían de las dos listas.
    const conLimbo = [...LIGA, M("2026-09-14", "FC Barcelona", "Sevilla FC", null, "21:00")];
    const { pasados, proximos } = teamTimeline(conLimbo, "barcelona", { pasados: 3, proximos: 5, hoy: "2026-09-15" });
    const todos = [...pasados, ...proximos].map(m => m.date);
    expect(todos).toContain("2026-09-14");
    expect(pasados.map(m => m.date)).toContain("2026-09-14");   // va en pasados, sin marcador
  });

  it("no mezcla partidos de otros equipos", () => {
    for (const m of [...pasados, ...proximos]) {
      expect(m.team1 === "FC Barcelona" || m.team2 === "FC Barcelona").toBe(true);
    }
  });
});

describe("resultFor", () => {
  it("da el marcador desde el punto de vista del equipo", () => {
    expect(resultFor(LIGA[3], "barcelona")).toMatchObject({ propios: 4, ajenos: 1, r: "G", marcador: "1–4" });
    expect(resultFor(LIGA[5], "barcelona")).toMatchObject({ propios: 0, ajenos: 2, r: "P" });
    expect(resultFor(LIGA[1], "espanyol")).toMatchObject({ r: "E" });
  });

  it("sin marcador devuelve null", () => {
    expect(resultFor(LIGA[7], "barcelona")).toBe(null);
  });
});
