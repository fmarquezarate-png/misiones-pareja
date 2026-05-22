// insights.js — Funciones puras para Sprint H (Stats narrativos)
//
// Cada función devuelve: { value, label, sentiment, detail }
// - value: número o string principal (ej: "74%", "6 días", "Cocina")
// - label: texto corto del insight (ej: "Tasa de éxito esta semana")
// - sentiment: "positive" | "neutral" | "negative" | "curious"
// - detail: frase narrativa completa (ej: "Carlos completó el doble que la semana pasada")
//
// Se activan en StatsView.jsx cuando stats_insights_enabled = true (Sprint H)

import { getMCats, CAT_MAP } from "../constants.js";

// ─── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Devuelve las entradas del objeto weeks ordenadas de más antigua a más nueva,
 * filtrando claves vacías/inválidas.
 * El formato "YYYY-Www" ordena lexicográficamente igual que cronológicamente.
 */
function _sortedEntries(weeks) {
  if (!weeks || typeof weeks !== "object") return [];
  return Object.entries(weeks)
    .filter(([key, w]) => key && w && Array.isArray(w.missions))
    .sort((a, b) => a[0].localeCompare(b[0]));
}

/** Misiones DONE de una lista de missions */
function _done(missions) {
  return (missions || []).filter(m => m.status === "DONE");
}

// ─── Función 1: loadBalance ───────────────────────────────────────────────────

/**
 * Calcula quién ha completado más misiones en las últimas 4 semanas.
 *
 * @param {object} weeks  - Objeto de semanas { "YYYY-Www": { missions: [...] } }
 * @param {string} p1     - Nombre de persona 1
 * @param {string} p2     - Nombre de persona 2
 * @returns {{ value: string, label: string, sentiment: string, detail: string } | null}
 */
export function loadBalance(weeks, p1, p2) {
  if (!weeks || typeof weeks !== "object") {
    return { value: "0/0", label: "Reparto de carga", sentiment: "neutral", detail: "Sin datos suficientes para calcular el reparto." };
  }

  const entries = _sortedEntries(weeks);
  const last4 = entries.slice(-4);

  if (last4.length === 0) {
    return { value: "0/0", label: "Reparto de carga", sentiment: "neutral", detail: "Sin datos suficientes para calcular el reparto." };
  }

  let done1 = 0, done2 = 0;

  for (const [, w] of last4) {
    const missions = w.missions || [];
    done1 += missions.filter(m => m.status === "DONE" && m.who === "person1").length;
    done2 += missions.filter(m => m.status === "DONE" && m.who === "person2").length;
  }

  const total = done1 + done2;

  if (total === 0) {
    return { value: "0/0", label: "Reparto de carga", sentiment: "neutral", detail: "Sin misiones completadas en las últimas 4 semanas." };
  }

  const pct1 = Math.round((done1 / total) * 100);
  const pct2 = 100 - pct1;
  const diff = Math.abs(pct1 - pct2);

  let sentiment, detail;

  if (diff <= 20) {
    sentiment = "positive";
    detail = `${p1 || "Persona 1"} y ${p2 || "Persona 2"} se reparten la carga casi a partes iguales (${pct1}% / ${pct2}%). ¡Equipo equilibrado!`;
  } else {
    // El que menos ha hecho recibe el feedback negativo
    const lighter = pct1 < pct2 ? (p1 || "Persona 1") : (p2 || "Persona 2");
    const heavier  = pct1 > pct2 ? (p1 || "Persona 1") : (p2 || "Persona 2");
    sentiment = "negative";
    detail = `${heavier} lleva el ${Math.max(pct1, pct2)}% de las misiones completadas en las últimas 4 semanas. ${lighter} podría asumir un poco más.`;
  }

  return {
    value: `${pct1}/${pct2}`,
    label: "Reparto de carga",
    sentiment,
    detail,
  };
}

// ─── Función 2: consistencyStreak ────────────────────────────────────────────

/**
 * Calcula la racha actual de semanas consecutivas con al menos 1 misión
 * completada por la pareja (counting desde la semana más reciente hacia atrás).
 *
 * @param {object} weeks
 * @returns {{ value: string, label: string, sentiment: string, detail: string } | null}
 */
export function consistencyStreak(weeks) {
  if (!weeks || typeof weeks !== "object") {
    return { value: "0 semanas", label: "Racha activa", sentiment: "neutral", detail: "Sin datos para calcular la racha." };
  }

  const entries = _sortedEntries(weeks);

  if (entries.length === 0) {
    return { value: "0 semanas", label: "Racha activa", sentiment: "neutral", detail: "Sin semanas registradas aún." };
  }

  // Recorrer de más reciente a más antigua
  let streak = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    const [, w] = entries[i];
    const hasDone = (w.missions || []).some(m => m.status === "DONE");
    if (hasDone) {
      streak++;
    } else {
      // Si la semana tiene misiones pero ninguna DONE, rompemos la racha.
      // Si no tiene misiones (semana vacía), también la rompemos.
      break;
    }
  }

  const sentiment = streak >= 3 ? "positive" : "neutral";
  const weekLabel = streak === 1 ? "semana" : "semanas";

  let detail;
  if (streak === 0) {
    detail = "Aún no hay ninguna semana con misiones completadas. ¡Esta puede ser la primera!";
  } else if (streak >= 3) {
    detail = `Lleváis ${streak} ${weekLabel} seguidas completando al menos una misión. ¡La constancia es vuestra superpotencia!`;
  } else {
    detail = `Lleváis ${streak} ${weekLabel} activas. Seguid sumando para construir un hábito sólido.`;
  }

  return {
    value: `${streak} ${weekLabel}`,
    label: "Racha activa",
    sentiment,
    detail,
  };
}

// ─── Función 3: topCategory ───────────────────────────────────────────────────

/**
 * La categoría con más misiones completadas en el último mes (~4 semanas).
 *
 * @param {object} weeks
 * @returns {{ value: string, label: string, sentiment: string, detail: string } | null}
 */
export function topCategory(weeks) {
  if (!weeks || typeof weeks !== "object") {
    return { value: "—", label: "Categoría estrella", sentiment: "curious", detail: "Sin datos suficientes para determinar la categoría estrella." };
  }

  const entries = _sortedEntries(weeks);
  const last4 = entries.slice(-4);

  if (last4.length === 0) {
    return { value: "—", label: "Categoría estrella", sentiment: "curious", detail: "Sin semanas registradas aún." };
  }

  // Contar DONE por categoría
  const counts = {}; // { catId: count }

  for (const [, w] of last4) {
    const missions = w.missions || [];
    for (const m of missions) {
      if (m.status !== "DONE") continue;
      const cats = getMCats(m);
      if (!cats || cats.length === 0) continue;
      // Usar el primer elemento si es array
      const catId = Array.isArray(cats) ? cats[0] : cats;
      if (!catId) continue;
      counts[catId] = (counts[catId] || 0) + 1;
    }
  }

  const entries2 = Object.entries(counts);
  if (entries2.length === 0) {
    return { value: "—", label: "Categoría estrella", sentiment: "curious", detail: "Sin misiones completadas con categoría en las últimas 4 semanas." };
  }

  // Ordenar por mayor número de completadas
  entries2.sort((a, b) => b[1] - a[1]);
  const [topId, topCount] = entries2[0];

  const catInfo = CAT_MAP[topId];
  const catLabel = catInfo ? `${catInfo.icon} ${catInfo.label}` : topId;

  return {
    value: catLabel,
    label: "Categoría estrella",
    sentiment: "curious",
    detail: `${topCount} misión${topCount !== 1 ? "es" : ""} completada${topCount !== 1 ? "s" : ""} este mes. ¡${catInfo ? catInfo.label : topId} lidera vuestro tablero!`,
  };
}

// ─── Función 4: completionTrend ───────────────────────────────────────────────

/**
 * Tendencia de tasa de completado: compara las últimas 4 semanas con las 4 anteriores.
 *
 * @param {object} weeks
 * @returns {{ value: string, label: string, sentiment: string, detail: string } | null}
 */
export function completionTrend(weeks) {
  if (!weeks || typeof weeks !== "object") {
    return { value: "—", label: "Tendencia", sentiment: "neutral", detail: "Sin datos suficientes para calcular la tendencia." };
  }

  const entries = _sortedEntries(weeks);

  // Necesitamos al least algunas semanas con misiones
  const withMissions = entries.filter(([, w]) => (w.missions || []).length > 0);

  if (withMissions.length < 2) {
    return { value: "—", label: "Tendencia", sentiment: "neutral", detail: "Se necesitan más semanas de datos para calcular la tendencia." };
  }

  /**
   * Calcula la tasa media de completado para un slice de entries.
   * Solo incluye semanas que tengan al menos 1 misión.
   */
  function avgRate(slice) {
    const valid = slice.filter(([, w]) => (w.missions || []).length > 0);
    if (valid.length === 0) return null;
    const rates = valid.map(([, w]) => {
      const ms = w.missions || [];
      const total = ms.length;
      const done  = ms.filter(m => m.status === "DONE").length;
      return total > 0 ? done / total : 0;
    });
    return rates.reduce((s, r) => s + r, 0) / rates.length;
  }

  const recent = withMissions.slice(-4);
  const prev   = withMissions.slice(-8, -4);

  const recentRate = avgRate(recent);
  const prevRate   = avgRate(prev);

  if (recentRate === null) {
    return { value: "—", label: "Tendencia", sentiment: "neutral", detail: "Sin datos recientes para calcular la tendencia." };
  }

  if (prevRate === null) {
    // Solo hay datos recientes, sin período anterior para comparar
    const pct = Math.round(recentRate * 100);
    return {
      value: `${pct}%`,
      label: "Tendencia",
      sentiment: pct >= 70 ? "positive" : pct >= 40 ? "neutral" : "negative",
      detail: `Tasa de completado actual: ${pct}%. Aún no hay datos anteriores para comparar la evolución.`,
    };
  }

  const recentPct = Math.round(recentRate * 100);
  const prevPct   = Math.round(prevRate * 100);
  const delta     = recentPct - prevPct;
  const sign      = delta > 0 ? "+" : "";

  let sentiment, detail;

  if (delta > 5) {
    sentiment = "positive";
    detail = `Pasasteis de un ${prevPct}% a un ${recentPct}% de completitud. ¡Claramente vais a más!`;
  } else if (delta < -5) {
    sentiment = "negative";
    detail = `Bajasteis de un ${prevPct}% a un ${recentPct}%. Esta semana es la oportunidad de remontar.`;
  } else {
    sentiment = "neutral";
    detail = `Rondáis el ${recentPct}% de completitud, similar al mes anterior. Consistencia sólida.`;
  }

  return {
    value: `${sign}${delta}%`,
    label: "Tendencia",
    sentiment,
    detail,
  };
}

// ─── Función 5: procrastinationAlert ─────────────────────────────────────────

/**
 * Detecta misiones que llevan más de 2 semanas arrastradas sin completarse.
 *
 * Una misión "arrastrada" tiene `carriedFrom` !== null/undefined y su status
 * no es "DONE". Si además `carriedFromWeek` existe, podemos calcular cuántas
 * semanas lleva: tomamos la semana más antigua mencionada en carriedFromWeek
 * comparada con la semana actual de la misión.
 *
 * Para simplificar el conteo de "más de 2 semanas" usamos la heurística:
 * si la misión tiene carriedFrom y está en una semana que no es la primera
 * vez que aparece (i.e. ya ha sido arrastrada al menos 2 veces), contamos.
 * Como carriedFromWeek puede ser un string "YYYY-Www", comparamos con la
 * semana en la que vive actualmente la misión.
 *
 * @param {object} weeks
 * @returns {{ value: string, label: string, sentiment: string, detail: string } | null}
 */
export function procrastinationAlert(weeks) {
  if (!weeks || typeof weeks !== "object") {
    return { value: "0 misiones", label: "Arrastrando hace semanas", sentiment: "positive", detail: "Sin misiones pendientes arrastradas. ¡Todo al día!" };
  }

  const entries = _sortedEntries(weeks);

  if (entries.length === 0) {
    return { value: "0 misiones", label: "Arrastrando hace semanas", sentiment: "positive", detail: "Sin semanas registradas aún." };
  }

  // Para cada semana, construimos un mapa de semanaKey → índice de orden
  const weekIndexMap = {};
  entries.forEach(([key], idx) => { weekIndexMap[key] = idx; });

  let longPendingCount = 0;
  const longPendingTitles = [];

  for (const [currentKey, w] of entries) {
    const currentIdx = weekIndexMap[currentKey] ?? 0;
    const missions = w.missions || [];

    for (const m of missions) {
      // Solo misiones no completadas y que hayan sido arrastradas
      if (m.status === "DONE") continue;
      if (!m.carriedFrom) continue;

      // Determinar desde qué semana se originó
      const originKey = m.carriedFromWeek || null;

      if (originKey && weekIndexMap[originKey] !== undefined) {
        const originIdx = weekIndexMap[originKey];
        const weeksCarried = currentIdx - originIdx;
        if (weeksCarried >= 2) {
          longPendingCount++;
          if (longPendingTitles.length < 3) {
            longPendingTitles.push(m.title || "Sin título");
          }
        }
      } else {
        // No tenemos la semana de origen exacta, pero sabemos que fue arrastrada al menos 1 vez.
        // Si carriedFrom es truthy sin más datos, contamos como >=2 semanas solo si
        // hay evidencia de múltiples arrastres (campo carriedFrom suele ser el id de la misión original).
        // Ser conservadores: contar solo si hay carriedFromWeek.
        // Si no hay carriedFromWeek, ignoramos (podría ser solo 1 semana).
      }
    }
  }

  let sentiment, detail;
  const missionLabel = longPendingCount === 1 ? "misión" : "misiones";

  if (longPendingCount === 0) {
    sentiment = "positive";
    detail = "¡Sin misiones arrastrando más de 2 semanas! Vais al día.";
  } else if (longPendingCount <= 2) {
    sentiment = "neutral";
    const titles = longPendingTitles.slice(0, 2).map(t => `"${t}"`).join(" y ");
    detail = `${titles} llevan pendientes más de 2 semanas. Puede ser el momento de darles prioridad o descartarlas.`;
  } else {
    sentiment = "negative";
    const sample = longPendingTitles.slice(0, 3).map(t => `"${t}"`).join(", ");
    detail = `${longPendingCount} misiones llevan más de 2 semanas sin completarse, incluyendo ${sample}. Revisad si siguen siendo relevantes.`;
  }

  return {
    value: `${longPendingCount} ${missionLabel}`,
    label: "Arrastrando hace semanas",
    sentiment,
    detail,
  };
}

// ─── Función 6: generateInsights ─────────────────────────────────────────────

/**
 * Orquestador: devuelve los 3-5 insights más relevantes, ordenados por impacto.
 * Orden de prioridad: negative (alertas) → positive (celebraciones) → curious → neutral
 *
 * @param {object} weeks
 * @param {string} p1
 * @param {string} p2
 * @returns {Array<{ value: string, label: string, sentiment: string, detail: string }>}
 */
export function generateInsights(weeks, p1, p2) {
  const all = [
    consistencyStreak(weeks),
    loadBalance(weeks, p1, p2),
    completionTrend(weeks),
    topCategory(weeks),
    procrastinationAlert(weeks),
  ].filter(i => i !== null);

  // Priorizar: negative primero (alertas), luego positive (celebraciones), luego curious
  const order = { negative: 0, positive: 1, curious: 2, neutral: 3 };
  return all
    .sort((a, b) => (order[a.sentiment] ?? 3) - (order[b.sentiment] ?? 3))
    .slice(0, 5);
}
