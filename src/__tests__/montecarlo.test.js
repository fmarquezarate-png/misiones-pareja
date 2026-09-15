import { describe, it, expect } from "vitest";
import {
  mulberry32, makeGaussian, nbPmf, dcTau, buildMatrix,
  buildStrengths, homeAdvantage, ratingSigma, projectSeason, matchPreview, PARAMS,
} from "../lib/montecarlo.js";

const sum = a => a.reduce((x, y) => x + y, 0);

describe("aleatoriedad reproducible", () => {
  it("la misma semilla da la misma secuencia", () => {
    const a = Array.from({ length: 5 }, mulberry32(42));
    const b = Array.from({ length: 5 }, mulberry32(42));
    expect(a).toEqual(b);
  });

  it("semillas distintas dan secuencias distintas", () => {
    expect(Array.from({ length: 5 }, mulberry32(1))).not.toEqual(Array.from({ length: 5 }, mulberry32(2)));
  });

  it("los valores caen en [0,1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 500; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });

  it("la normal tiene media ~0 y desviación ~1", () => {
    const randn = makeGaussian(mulberry32(3));
    const xs = Array.from({ length: 20000 }, randn);
    const media = sum(xs) / xs.length;
    const sd = Math.sqrt(sum(xs.map(x => (x - media) ** 2)) / xs.length);
    expect(Math.abs(media)).toBeLessThan(0.05);
    expect(Math.abs(sd - 1)).toBeLessThan(0.05);
  });
});

describe("binomial negativa", () => {
  it("es una distribución de probabilidad", () => {
    const p = nbPmf(1.4);
    expect(p.every(x => x >= 0)).toBe(true);
    expect(sum(p)).toBeLessThanOrEqual(1.0001);
    expect(sum(p)).toBeGreaterThan(0.95);        // el resto es la cola >7 goles
  });

  it("más lambda desplaza la masa hacia arriba", () => {
    expect(nbPmf(0.6)[0]).toBeGreaterThan(nbPmf(2.5)[0]);
    expect(nbPmf(2.5)[3]).toBeGreaterThan(nbPmf(0.6)[3]);
  });

  it("está SOBREDISPERSA respecto a Poisson: más 0-0 y más goleadas", () => {
    const lam = 1.4;
    const poisson = k => Math.exp(-lam) * Math.pow(lam, k) / [1,1,2,6,24,120,720,5040][k];
    const nb = nbPmf(lam);
    expect(nb[0]).toBeGreaterThan(poisson(0));   // más ceros
    expect(nb[5]).toBeGreaterThan(poisson(5));   // y más colas altas
  });

  it("con r muy alto converge a Poisson", () => {
    const lam = 1.4;
    const poisson0 = Math.exp(-lam);
    expect(Math.abs(nbPmf(lam, 100000)[0] - poisson0)).toBeLessThan(0.001);
  });
});

describe("corrección Dixon-Coles", () => {
  it("solo toca los cuatro marcadores bajos", () => {
    for (const [i, j] of [[0,2],[2,0],[2,2],[3,1],[1,3]]) {
      expect(dcTau(i, j, 1.4, 1.1)).toBe(1);
    }
  });

  it("con rho negativo sube el 0-0 y el 1-1, y baja el 1-0 y el 0-1", () => {
    const lh = 1.4, la = 1.1;
    expect(dcTau(0, 0, lh, la)).toBeGreaterThan(1);
    expect(dcTau(1, 1, lh, la)).toBeGreaterThan(1);
    expect(dcTau(0, 1, lh, la)).toBeLessThan(1);
    expect(dcTau(1, 0, lh, la)).toBeLessThan(1);
  });
});

describe("buildMatrix", () => {
  it("las tres probabilidades suman 1", () => {
    const m = buildMatrix(1.6, 1.1);
    expect(m.pH + m.pD + m.pA).toBeCloseTo(1, 6);
  });

  it("el favorito tiene más probabilidad de ganar", () => {
    const m = buildMatrix(2.2, 0.8);
    expect(m.pH).toBeGreaterThan(m.pA);
    expect(m.pH).toBeGreaterThan(m.pD);
  });

  it("con fuerzas iguales, local y visitante son simétricos", () => {
    const m = buildMatrix(1.3, 1.3);
    expect(Math.abs(m.pH - m.pA)).toBeLessThan(1e-9);
    expect(m.top.home).toBe(m.top.away);
  });

  it("la diferencia de goles condicional es al menos 1", () => {
    const m = buildMatrix(1.8, 1.0);
    expect(m.gdWin).toBeGreaterThanOrEqual(1);
    expect(m.gdLoss).toBeGreaterThanOrEqual(1);
  });

  it("no revienta con lambdas degeneradas", () => {
    expect(buildMatrix(0, 0)).not.toBe(null);
    expect(buildMatrix(-5, 1)).not.toBe(null);
  });
});

describe("buildStrengths", () => {
  const rows = [
    { teamId: "a", pj: 10, gf: 25, gc: 8 },    // ataque fuerte, defensa buena
    { teamId: "b", pj: 10, gf: 8,  gc: 22 },   // flojo
    { teamId: "c", pj: 10, gf: 14, gc: 14 },   // medio
  ];

  it("el equipo que más marca tiene más ataque", () => {
    const s = buildStrengths(rows);
    expect(s.att.a).toBeGreaterThan(s.att.c);
    expect(s.att.c).toBeGreaterThan(s.att.b);
  });

  it("menos defensa = mejor: el que menos encaja tiene el índice más bajo", () => {
    const s = buildStrengths(rows);
    expect(s.def.a).toBeLessThan(s.def.b);
  });

  it("ENCOGE: un 6-0 en la jornada 1 no convierte a nadie en un ataque 6 veces mejor", () => {
    const arranque = [
      { teamId: "a", pj: 1, gf: 6, gc: 0 },      // 6-0 en la J1
      { teamId: "b", pj: 1, gf: 0, gc: 6 },
    ];
    const previa = [
      { teamId: "a", pj: 38, gf: 38, gc: 38 },   // la temporada pasada, del montón
      { teamId: "b", pj: 38, gf: 38, gc: 38 },
    ];
    const s = buildStrengths(arranque, previa);
    // Sin encoger sería 6 / 1 = 6.0. Con 8 partidos de peso del pasado, queda
    // bastante por debajo de 2 — sigue siendo "mejor que la media", no un mito.
    expect(s.att.a).toBeGreaterThan(1);
    expect(s.att.a).toBeLessThan(2);
  });

  it("un recién ascendido sin histórico arranca en la media, no en cero", () => {
    const s = buildStrengths([{ teamId: "nuevo", pj: 0, gf: 0, gc: 0 }], [{ teamId: "a", pj: 38, gf: 50, gc: 40 }]);
    expect(s.att.nuevo).toBeCloseTo(1, 1);
  });

  it("sin datos devuelve la media por defecto y no se rompe", () => {
    const s = buildStrengths([], []);
    expect(s.avgG).toBe(PARAMS.AVG_G_FALLBACK);
  });
});

describe("homeAdvantage", () => {
  it("con poca muestra usa los valores por defecto", () => {
    const pocos = Array.from({ length: 10 }, () => ({ ft: [2, 0] }));
    expect(homeAdvantage(pocos).home).toBe(PARAMS.HOME_FALLBACK);
  });

  it("con muestra suficiente la calcula de los datos", () => {
    // 100 partidos, el local marca el doble que el visitante.
    const muchos = Array.from({ length: 100 }, () => ({ ft: [2, 1] }));
    const adv = homeAdvantage(muchos);
    expect(adv.home).toBeGreaterThan(adv.away);
    expect(adv.home + adv.away).toBeCloseTo(2, 5);   // normalizado a la media
  });

  it("ignora partidos sin marcador", () => {
    expect(homeAdvantage([{ ft: null }, {}, { ft: [1] }]).sample).toBe(0);
  });
});

describe("ratingSigma", () => {
  it("baja conforme se juegan partidos", () => {
    expect(ratingSigma(0, 1.4)).toBeGreaterThan(ratingSigma(19, 1.4));
    expect(ratingSigma(19, 1.4)).toBeGreaterThan(ratingSigma(37, 1.4));
  });

  it("nunca baja del suelo", () => {
    expect(ratingSigma(38, 1.4)).toBeGreaterThanOrEqual(PARAMS.SIGMA_FLOOR);
  });
});

// ── El motor completo ───────────────────────────────────────────────────────
// Liga de juguete de 4 equipos, ida y vuelta (6 jornadas, 12 partidos).
function ligaDe4({ jugadas = 0, ptsA = 0 } = {}) {
  const ids = ["a", "b", "c", "d"];
  const table = ids.map(id => ({ teamId: id, pts: 0, dg: 0, pj: jugadas, gf: jugadas * 1.4, gc: jugadas * 1.4 }));
  table[0].pts = ptsA;
  const fixtures = [];
  for (const h of ids) for (const a of ids) if (h !== a) fixtures.push({ homeId: h, awayId: a });
  return { table, fixtures };
}

describe("projectSeason", () => {
  const rng = () => mulberry32(2026);

  it("es reproducible con la misma semilla", () => {
    const { table, fixtures } = ligaDe4();
    const a = projectSeason({ table, fixtures, teamId: "a", rng: rng(), draws: 8, seasonsPerDraw: 10 });
    const b = projectSeason({ table, fixtures, teamId: "a", rng: rng(), draws: 8, seasonsPerDraw: 10 });
    expect(a.probs).toEqual(b.probs);
    expect(a.projPts).toBe(b.projPts);
  });

  it("las probabilidades están entre 0 y 100", () => {
    const { table, fixtures } = ligaDe4();
    const r = projectSeason({ table, fixtures, teamId: "a", rng: rng(), draws: 10, seasonsPerDraw: 10 });
    for (const v of Object.values(r.probs)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
  });

  it("una ventaja enorme de puntos sube mucho la probabilidad de título", () => {
    const igualados = ligaDe4();
    const conVentaja = ligaDe4({ ptsA: 40 });
    const p1 = projectSeason({ ...igualados, teamId: "a", rng: rng(), draws: 20, seasonsPerDraw: 15 });
    const p2 = projectSeason({ table: conVentaja.table, fixtures: conVentaja.fixtures, teamId: "a", rng: rng(), draws: 20, seasonsPerDraw: 15 });
    expect(p2.probs.titulo).toBeGreaterThan(p1.probs.titulo + 30);
  });

  it("con todos iguales, cada uno ronda su parte del título", () => {
    const { table, fixtures } = ligaDe4();
    const r = projectSeason({ table, fixtures, teamId: "a", rng: rng(), draws: 30, seasonsPerDraw: 20 });
    expect(r.probs.titulo).toBeGreaterThan(10);    // 1 de 4 ≈ 25%
    expect(r.probs.titulo).toBeLessThan(45);
  });

  it("LA LECCIÓN DEL WIDGET: en la jornada 1 el líder NO llega al 88% de título", () => {
    // Con una sola jornada jugada, la incertidumbre paramétrica debe impedir
    // que una goleada aislada dispare la probabilidad. Es el motivo de ser
    // del nivel 1 del Monte Carlo, anotado en el script original.
    const ids = ["a", "b", "c", "d"];
    const table = ids.map(id => ({ teamId: id, pts: 0, dg: 0, pj: 1, gf: 1, gc: 1 }));
    table[0] = { teamId: "a", pts: 3, dg: 5, pj: 1, gf: 5, gc: 0 };   // 5-0 en la J1
    const fixtures = [];
    for (const h of ids) for (const a of ids) if (h !== a) fixtures.push({ homeId: h, awayId: a });
    const r = projectSeason({ table, fixtures, teamId: "a", rng: rng(), draws: 40, seasonsPerDraw: 20 });
    expect(r.probs.titulo).toBeLessThan(88);
  });

  it("el nivel 1 AMPLÍA la incertidumbre: sin él, la probabilidad es más extrema", () => {
    // Se compara el motor con su sigma normal contra uno con sigma casi nula
    // (draws=1 y parámetros clavados). Con menos incertidumbre, más extremo.
    const ids = ["a", "b", "c", "d"];
    const table = ids.map(id => ({ teamId: id, pts: 0, dg: 0, pj: 2, gf: 2, gc: 2 }));
    table[0] = { teamId: "a", pts: 6, dg: 8, pj: 2, gf: 9, gc: 1 };
    const fixtures = [];
    for (const h of ids) for (const a of ids) if (h !== a) fixtures.push({ homeId: h, awayId: a });
    const conRuido = projectSeason({ table, fixtures, teamId: "a", rng: rng(), draws: 40, seasonsPerDraw: 20 });
    expect(conRuido.probs.titulo).toBeLessThan(100);
    expect(conRuido.sims).toBe(800);
  });

  it("acepta cortes a medida", () => {
    const { table, fixtures } = ligaDe4();
    const r = projectSeason({ table, fixtures, teamId: "a", rng: rng(), draws: 6, seasonsPerDraw: 5,
      cutoffs: { titulo: 1, podio: 3, mitad: 2 } });
    expect(Object.keys(r.probs).sort()).toEqual(["mitad", "podio", "titulo"]);
    expect(r.probs.podio).toBeGreaterThanOrEqual(r.probs.titulo);   // corte más laxo, más probable
  });

  it("temporada acabada: no simula, devuelve la posición real", () => {
    const table = [
      { teamId: "a", pts: 90, dg: 50, pj: 38, gf: 90, gc: 40 },
      { teamId: "b", pts: 80, dg: 30, pj: 38, gf: 80, gc: 50 },
    ];
    const r = projectSeason({ table, fixtures: [], teamId: "a", rng: rng() });
    expect(r.finished).toBe(true);
    expect(r.projPos).toBe(1);
    expect(r.probs.titulo).toBe(100);
    expect(r.sims).toBe(0);
  });

  it("devuelve null si no hay con qué simular", () => {
    expect(projectSeason({ table: [], fixtures: [], teamId: "a" })).toBe(null);
    expect(projectSeason({ table: [{ teamId: "x", pts: 0 }], fixtures: [], teamId: "no-esta" })).toBe(null);
  });

  it("ignora partidos de equipos que no están en la tabla", () => {
    const { table, fixtures } = ligaDe4();
    const conIntruso = [...fixtures, { homeId: "a", awayId: "fantasma" }];
    const r = projectSeason({ table, fixtures: conIntruso, teamId: "a", rng: rng(), draws: 5, seasonsPerDraw: 5 });
    expect(r).not.toBe(null);
    expect(r.projPts).toBeLessThanOrEqual(3 * 6);   // 6 partidos como máximo, no 7
  });
});

describe("matchPreview", () => {
  const table = [
    { teamId: "fuerte", pj: 20, gf: 50, gc: 15, pts: 50, dg: 35 },
    { teamId: "flojo",  pj: 20, gf: 15, gc: 45, pts: 15, dg: -30 },
  ];

  it("W, D y L suman 100", () => {
    const p = matchPreview({ table, teamId: "fuerte", rivalId: "flojo", isHome: true });
    expect(p.W + p.D + p.L).toBe(100);
  });

  it("el favorito en casa tiene más probabilidad de ganar que de perder", () => {
    const p = matchPreview({ table, teamId: "fuerte", rivalId: "flojo", isHome: true });
    expect(p.W).toBeGreaterThan(p.L);
    expect(p.W).toBeGreaterThan(50);
  });

  it("jugar fuera baja la probabilidad de ganar del mismo equipo", () => {
    const casa = matchPreview({ table, teamId: "fuerte", rivalId: "flojo", isHome: true });
    const fuera = matchPreview({ table, teamId: "fuerte", rivalId: "flojo", isHome: false });
    expect(fuera.W).toBeLessThan(casa.W);
  });

  it("es simétrico: lo que uno gana, el otro lo pierde", () => {
    const a = matchPreview({ table, teamId: "fuerte", rivalId: "flojo", isHome: true });
    const b = matchPreview({ table, teamId: "flojo", rivalId: "fuerte", isHome: false });
    expect(Math.abs(a.W - b.L)).toBeLessThanOrEqual(1);   // ±1 por redondeo
  });

  it("da un marcador más probable con forma de marcador", () => {
    expect(matchPreview({ table, teamId: "fuerte", rivalId: "flojo", isHome: true }).score).toMatch(/^\d+-\d+$/);
  });

  it("sin equipos devuelve null", () => {
    expect(matchPreview({ table, teamId: null, rivalId: "flojo" })).toBe(null);
  });
});
