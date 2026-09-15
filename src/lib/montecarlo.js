// Motor de proyección de liga (v5.33.0) — port del widget de Scriptable de Fran.
//
// Cuatro capas, en el mismo orden que el original:
//
//   1. FUERZAS        ataque/defensa por equipo, encogidas hacia la temporada
//                     anterior (`PRIOR_MATCHES` partidos de peso). Un recién
//                     ascendido arranca en la media, no en el vacío.
//   2. BINOMIAL NEG.  los goles reales están sobredispersos respecto a Poisson:
//                     hay más goleadas y más 0-0 de lo que Poisson predice.
//   3. DIXON-COLES    corrección de los marcadores bajos (0-0, 1-0, 0-1, 1-1),
//                     donde Poisson/NB se equivocan sistemáticamente.
//   4. MATRIZ         de ella sale TODO: 1X2, marcador más probable y la
//                     diferencia de goles esperada condicional a ganar/perder.
//
// Y sobre eso, Monte Carlo a DOS NIVELES:
//
//   Nivel 1 (paramétrico): no sabemos de verdad cuánto vale cada equipo. Cada
//     bloque de simulaciones usa un universo distinto de ratings, sorteado
//     alrededor del estimado con una desviación que depende de cuánta muestra
//     hay (`ratingSigma`).
//   Nivel 2 (resultados): dentro de ese universo, se simulan temporadas.
//
// Ignorar el nivel 1 es lo que disparaba el título al 88% en la jornada 2 — está
// anotado en el script original y es la razón de ser de esta estructura.
//
// TODO ES PURO: el generador aleatorio se inyecta, así que las pruebas son
// reproducibles y el motor se puede ejecutar sin red.

// ── Parámetros (los mismos del widget) ──────────────────────────────────────
export const PARAMS = {
  MAXG: 7,                  // tope de goles en la matriz (0..7)
  NB_R: 8,                  // dispersión binomial negativa (mayor = más Poisson)
  DC_RHO: -0.13,            // ajuste Dixon-Coles de marcadores bajos
  PRIOR_MATCHES: 8,         // peso de la temporada pasada, en partidos
  DRAWS: 60,                // universos de ratings distintos
  SEASONS_PER_DRAW: 20,     // temporadas por universo (60×20 = 1200)
  SIGMA_FLOOR: 0.10,        // incertidumbre mínima de un rating
  SIGMA_DRIFT: 0.18,        // lo que un equipo puede cambiar en una temporada
  HOME_FALLBACK: 1.13,      // ventaja de local si no se puede calcular
  AWAY_FALLBACK: 0.89,
  AVG_G_FALLBACK: 1.35,     // goles por equipo y partido
};

// ── Aleatoriedad inyectable ─────────────────────────────────────────────────
// mulberry32: rápido, buena distribución y SEMILLABLE. Con semilla fija, dos
// ejecuciones dan el mismo resultado → las pruebas pueden comprobar números.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Normal estándar por Box-Muller, con el segundo valor guardado (como el original).
export function makeGaussian(rng = Math.random) {
  let spare = null;
  return function randn() {
    if (spare !== null) { const g = spare; spare = null; return g; }
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}

// ── Capa 2: binomial negativa ───────────────────────────────────────────────
export function nbPmf(lambda, r = PARAMS.NB_R, kMax = PARAMS.MAXG) {
  const lam = Math.max(0.05, lambda);
  const p = r / (r + lam);
  const out = new Array(kMax + 1);
  out[0] = Math.pow(p, r);
  for (let k = 1; k <= kMax; k++) out[k] = out[k - 1] * ((r + k - 1) / k) * (1 - p);
  return out;
}

// ── Capa 3: corrección Dixon-Coles ──────────────────────────────────────────
export function dcTau(i, j, lh, la, rho = PARAMS.DC_RHO) {
  if (i === 0 && j === 0) return 1 - lh * la * rho;
  if (i === 0 && j === 1) return 1 + lh * rho;
  if (i === 1 && j === 0) return 1 + la * rho;
  if (i === 1 && j === 1) return 1 - rho;
  return 1;
}

// ── Capa 4: la matriz de marcadores ─────────────────────────────────────────
// De aquí sale todo lo demás. `gdWin`/`gdLoss` son la diferencia de goles media
// CONDICIONAL a que gane el local / el visitante — que es lo que hay que sumar
// al simular, no un 1 fijo.
export function buildMatrix(lh, la, p = PARAMS) {
  const H = nbPmf(lh, p.NB_R, p.MAXG);
  const A = nbPmf(la, p.NB_R, p.MAXG);
  const cells = [];
  let total = 0;
  for (let i = 0; i <= p.MAXG; i++) {
    for (let j = 0; j <= p.MAXG; j++) {
      const prob = Math.max(0, H[i] * A[j] * dcTau(i, j, lh, la, p.DC_RHO));
      cells.push({ i, j, p: prob });
      total += prob;
    }
  }
  if (total <= 0) return null;
  for (const c of cells) c.p /= total;

  let pH = 0, pD = 0, pA = 0, gdH = 0, gdA = 0;
  let best = cells[0];
  for (const c of cells) {
    if (c.p > best.p) best = c;
    if (c.i > c.j) { pH += c.p; gdH += c.p * (c.i - c.j); }
    else if (c.i === c.j) pD += c.p;
    else { pA += c.p; gdA += c.p * (c.j - c.i); }
  }
  return {
    pH, pD, pA,
    gdWin: pH > 0 ? gdH / pH : 1,
    gdLoss: pA > 0 ? gdA / pA : 1,
    top: { home: best.i, away: best.j },
  };
}

// ── Capa 1: fuerzas de ataque y defensa ─────────────────────────────────────
// `rows`: [{ teamId, pj, gf, gc }] de la temporada en curso.
// `prior`: lo mismo de la anterior (opcional pero muy recomendable en agosto).
export function buildStrengths(rows = [], prior = []) {
  const cur = {}, pri = {};
  // Se incluyen también los de 0 partidos: con `pj: 0` el encogido les asigna
  // la media, que es lo correcto para un recién ascendido en la jornada 1. Si
  // se filtraran, quedarían fuera de `ids` y el simulador les aplicaría un
  // `?? 1` en silencio, sin que nadie lo viera.
  for (const r of rows) if (r?.teamId) cur[r.teamId] = { gf: r.gf || 0, gc: r.gc || 0, pj: r.pj || 0 };
  for (const r of prior) if (r?.teamId && r.pj > 0) pri[r.teamId] = { gf: r.gf || 0, gc: r.gc || 0, pj: r.pj };

  const avgOf = map => {
    let gf = 0, pj = 0;
    for (const id in map) { if (!map[id].pj) continue; gf += map[id].gf; pj += map[id].pj; }
    return pj > 0 ? gf / pj : null;
  };
  const totalPJ = Object.values(cur).reduce((s, t) => s + t.pj, 0);
  // Con poca muestra manda la temporada pasada para fijar la media de goles.
  const avgG = (totalPJ >= 60 ? avgOf(cur) : (avgOf(pri) ?? avgOf(cur))) ?? PARAMS.AVG_G_FALLBACK;

  const att = {}, def = {}, played = {};
  const ids = new Set([...Object.keys(cur), ...Object.keys(pri)]);
  for (const id of ids) {
    const c = cur[id] || { gf: 0, gc: 0, pj: 0 };
    const p = pri[id];
    const pGF = p ? p.gf / p.pj : avgG;     // sin histórico → arranca en la media
    const pGC = p ? p.gc / p.pj : avgG;
    const attRate = (c.gf + PARAMS.PRIOR_MATCHES * pGF) / (c.pj + PARAMS.PRIOR_MATCHES);
    const defRate = (c.gc + PARAMS.PRIOR_MATCHES * pGC) / (c.pj + PARAMS.PRIOR_MATCHES);
    att[id] = attRate / avgG;
    def[id] = defRate / avgG;
    played[id] = c.pj;
  }
  return { att, def, avgG, played, sampleMatches: totalPJ };
}

// Ventaja de campo calculada de los partidos ya jugados de la propia liga.
// `played`: [{ homeId, awayId, ft:[gh,ga] }]. Con poca muestra, valores por defecto.
export function homeAdvantage(played = []) {
  let hg = 0, ag = 0, n = 0;
  for (const m of played) {
    if (!Array.isArray(m?.ft) || m.ft.length < 2) continue;
    hg += m.ft[0]; ag += m.ft[1]; n++;
  }
  if (n < 30) return { home: PARAMS.HOME_FALLBACK, away: PARAMS.AWAY_FALLBACK, sample: n };
  const avg = (hg + ag) / (2 * n);
  if (avg <= 0) return { home: PARAMS.HOME_FALLBACK, away: PARAMS.AWAY_FALLBACK, sample: n };
  return { home: (hg / n) / avg, away: (ag / n) / avg, sample: n };
}

// Cuanta menos muestra, más ancha la incertidumbre del rating. El "drift" (que
// un equipo cambie de verdad durante la temporada: lesiones, fichajes, bajones)
// pesa entero en agosto y se diluye conforme avanza.
export function ratingSigma(playedGames, avgG, totalRounds = 38, p = PARAMS) {
  const pj = playedGames || 0;
  const nEff = pj + p.PRIOR_MATCHES;
  const se = Math.max(p.SIGMA_FLOOR, 1 / Math.sqrt(Math.max(1, nEff * avgG)));
  const drift = p.SIGMA_DRIFT * Math.max(0.25, 1 - pj / totalRounds);
  return Math.sqrt(se * se + drift * drift);
}

// ── Monte Carlo ─────────────────────────────────────────────────────────────
// table:    [{ teamId, pts, dg, pj, gf, gc }] — situación actual
// fixtures: [{ homeId, awayId }] — lo que queda por jugar
// cutoffs:  { titulo: 1, champions: 4, ... } → "acabar entre los N primeros"
//
// Devuelve { probs, projPts, projPos, sims } o null si no hay con qué simular.
export function projectSeason({
  table = [], fixtures = [], prior = [], playedMatches = [],
  teamId, cutoffs = { titulo: 1, champions: 4 },
  rng = Math.random, draws = PARAMS.DRAWS, seasonsPerDraw = PARAMS.SEASONS_PER_DRAW,
  totalRounds = 38,
} = {}) {
  if (!table.length || !teamId) return null;
  const state = {};
  for (const r of table) if (r?.teamId) state[r.teamId] = { pts: r.pts || 0, gd: r.dg || 0 };
  if (!state[teamId]) return null;

  const valid = fixtures.filter(f => f && state[f.homeId] && state[f.awayId]);
  const str = buildStrengths(table, prior);
  const adv = homeAdvantage(playedMatches);
  const randn = makeGaussian(rng);
  const ids = Object.keys(state);

  // Temporada acabada: la clasificación actual ES el resultado.
  if (!valid.length) {
    const pos = finalPosition(state, teamId);
    const probs = {};
    for (const [k, cut] of Object.entries(cutoffs)) probs[k] = pos <= cut ? 100 : 0;
    return { probs, projPts: state[teamId].pts, projPos: pos, sims: 0, finished: true, adv, avgG: str.avgG };
  }

  const sigma = {};
  for (const id of ids) sigma[id] = ratingSigma(str.played[id] ?? 0, str.avgG, totalRounds);

  const keys = Object.keys(cutoffs);
  const hits = keys.map(() => 0);
  let ptsSum = 0, posSum = 0, done = 0;

  for (let k = 0; k < draws; k++) {
    // Nivel 1: un universo de ratings distinto en cada bloque.
    const att = {}, def = {};
    for (const id of ids) {
      att[id] = (str.att[id] ?? 1) * Math.exp(sigma[id] * randn());
      def[id] = (str.def[id] ?? 1) * Math.exp(sigma[id] * randn());
    }
    const games = [];
    for (const f of valid) {
      const mx = buildMatrix(
        att[f.homeId] * def[f.awayId] * str.avgG * adv.home,
        att[f.awayId] * def[f.homeId] * str.avgG * adv.away
      );
      if (mx) games.push({ h: f.homeId, a: f.awayId, pH: mx.pH, pHD: mx.pH + mx.pD, gdW: mx.gdWin, gdL: mx.gdLoss });
    }
    if (!games.length) continue;

    // Nivel 2: temporadas dentro de ese universo.
    for (let s = 0; s < seasonsPerDraw; s++) {
      const pts = {}, gd = {};
      for (const id of ids) { pts[id] = state[id].pts; gd[id] = state[id].gd; }
      for (const g of games) {
        const r = rng();
        if (r < g.pH) { pts[g.h] += 3; gd[g.h] += g.gdW; gd[g.a] -= g.gdW; }
        else if (r < g.pHD) { pts[g.h] += 1; pts[g.a] += 1; }
        else { pts[g.a] += 3; gd[g.a] += g.gdL; gd[g.h] -= g.gdL; }
      }
      const myPts = pts[teamId], myGd = gd[teamId];
      let better = 0;
      for (const id of ids) {
        if (id === teamId) continue;
        if (pts[id] > myPts || (pts[id] === myPts && gd[id] > myGd)) better++;
      }
      keys.forEach((kk, i) => { if (better < cutoffs[kk]) hits[i]++; });
      ptsSum += myPts;
      posSum += better + 1;
      done++;
    }
  }
  if (!done) return null;

  const probs = {};
  keys.forEach((kk, i) => { probs[kk] = Math.round(100 * hits[i] / done); });
  return {
    probs,
    projPts: Math.round(ptsSum / done),
    projPos: Math.round(posSum / done),
    sims: done,
    adv, avgG: str.avgG,
    sampleMatches: str.sampleMatches,
  };
}

function finalPosition(state, teamId) {
  const me = state[teamId];
  let better = 0;
  for (const id in state) {
    if (id === teamId) continue;
    if (state[id].pts > me.pts || (state[id].pts === me.pts && state[id].gd > me.gd)) better++;
  }
  return better + 1;
}

// ── Pronóstico de un partido suelto ─────────────────────────────────────────
// Devuelve { W, D, L, score } desde el punto de vista de `teamId`.
export function matchPreview({ table = [], prior = [], playedMatches = [], teamId, rivalId, isHome = true } = {}) {
  if (!teamId || !rivalId) return null;
  const str = buildStrengths(table, prior);
  const adv = homeAdvantage(playedMatches);
  const aMe = str.att[teamId] ?? 1, dMe = str.def[teamId] ?? 1;
  const aRi = str.att[rivalId] ?? 1, dRi = str.def[rivalId] ?? 1;
  const lh = (isHome ? aMe * dRi : aRi * dMe) * str.avgG * adv.home;
  const la = (isHome ? aRi * dMe : aMe * dRi) * str.avgG * adv.away;
  const mx = buildMatrix(lh, la);
  if (!mx) return null;
  const win = isHome ? mx.pH : mx.pA;
  const lose = isHome ? mx.pA : mx.pH;
  // Se redondea el mayor primero y el resto se ajusta, para que sumen 100.
  let W = Math.round(win * 100), D = Math.round(mx.pD * 100);
  let L = 100 - W - D;
  if (L < 0) { L = 0; D = Math.max(0, 100 - W); }
  const mine = isHome ? mx.top.home : mx.top.away;
  const theirs = isHome ? mx.top.away : mx.top.home;
  return { W, D, L, score: `${mine}-${theirs}`, raw: { win, draw: mx.pD, lose } };
}
