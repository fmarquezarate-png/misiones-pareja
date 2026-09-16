// Autodiagnóstico de "Mi Equipo".
//
// POR QUÉ EXISTE
// Cuando la conexión en vivo no funciona, TODOS los caminos fallan igual: la
// app cae al respaldo de openfootball en silencio y pinta un `⚠ respaldo` que
// no distingue entre "la función no está desplegada", "está pero sin clave",
// "la clave está caducada", "no has elegido equipo" o "tu móvil tiene guardada
// una versión vieja de la app". Cinco causas distintas, un único síntoma.
//
// Este módulo las separa y dice, para cada una, QUÉ HACER. La parte que decide
// el veredicto es pura y está probada; lo que toca la red vive en `runChecks`.
//
// Regla de CLAUDE.md §5 que lo motiva: "el texto de una excepción es para los
// logs, nunca para la UI" — aquí cada fallo se traduce a qué significa para
// quien lo lee y cuál es el siguiente paso.

export const OK = "ok";
export const AVISO = "aviso";
export const FALLO = "fallo";

// ── Versión de la app ───────────────────────────────────────────────────────
// La PWA cachea agresivamente. Si el service worker no ha cambiado de turno,
// el móvil sigue ejecutando el código de hace días por mucho que se despliegue.
export function interpretVersion(local, remota) {
  if (!remota) {
    return {
      estado: AVISO,
      detalle: `Tienes la v${local}. No he podido preguntarle al servidor cuál es la última (¿sin conexión?).`,
    };
  }
  if (String(local) === String(remota)) {
    return { estado: OK, detalle: `Estás en la última: v${local}.` };
  }
  return {
    estado: FALLO,
    detalle: `Tu móvil tiene guardada la v${local}, pero la publicada es la v${remota}. Estás viendo una copia vieja de la app.`,
    accion: "actualizar",
  };
}

// ── Equipo elegido ──────────────────────────────────────────────────────────
export function interpretTeam(team) {
  if (!team) {
    return {
      estado: FALLO,
      detalle: "Todavía no has elegido equipo, así que no hay nada que mostrar.",
      accion: "elegir-equipo",
    };
  }
  return { estado: OK, detalle: `${team.short} (${team.league === "en.1" ? "Premier" : "LaLiga"}).` };
}

// ── La Edge Function ────────────────────────────────────────────────────────
// `res` es lo que devolvió el intento de llamada:
//   { fallo: "red" }                    -> ni siquiera contestó
//   { data: {...} }                     -> contestó, hay que leer qué dijo
export function interpretProbe(res) {
  if (!res || res.fallo) {
    return {
      estado: FALLO,
      detalle: "El servidor de fútbol no contesta. Es como si la función no estuviera desplegada.",
      accion: "desplegar",
    };
  }
  const d = res.data || {};

  if (d.error === "sin_clave") {
    return {
      estado: FALLO,
      detalle: "La función está desplegada, pero no tiene la clave de football-data.org guardada.",
      accion: "clave",
    };
  }
  // Versión antigua del código: no conoce la acción 'probe' (añadida el 16/09).
  if (d.error === "accion_desconocida") {
    return {
      estado: AVISO,
      detalle: "La función está desplegada y con clave, pero con una versión antigua del código. Vuelve a desplegarla para poder comprobarla del todo.",
      accion: "desplegar",
    };
  }
  if (d.error) {
    return { estado: FALLO, detalle: `La función contestó con un problema (${d.error}).`, accion: "desplegar" };
  }
  if (!d.ok) {
    return { estado: FALLO, detalle: "La función contestó algo que no entiendo.", accion: "desplegar" };
  }

  const up = d.upstream || {};
  if (!up.probado) {
    return { estado: OK, detalle: "Desplegada y con clave." };
  }
  if (up.ok) {
    return { estado: OK, detalle: `Desplegada, con clave y football-data.org responde correctamente.` };
  }
  if (up.status === 403 || up.status === 400) {
    return {
      estado: FALLO,
      detalle: "La clave llegó al servidor, pero football-data.org la rechaza. Suele ser una clave caducada, revocada o mal copiada (un espacio de más al pegarla).",
      accion: "clave-nueva",
    };
  }
  if (up.status === 429) {
    return {
      estado: AVISO,
      detalle: "Has pasado el límite de 10 peticiones por minuto del plan gratuito. Se arregla solo en un minuto.",
    };
  }
  return {
    estado: FALLO,
    detalle: `football-data.org contestó un error (HTTP ${up.status || "?"}${up.mensaje ? ` — ${up.mensaje}` : ""}).`,
    accion: "clave-nueva",
  };
}

// ── Frescura de los datos que se están pintando ─────────────────────────────
export function diasDeRetraso(fechaISO, hoyISO) {
  if (!fechaISO || !hoyISO) return null;
  const a = Date.UTC(+fechaISO.slice(0, 4), +fechaISO.slice(5, 7) - 1, +fechaISO.slice(8, 10));
  const b = Date.UTC(+hoyISO.slice(0, 4), +hoyISO.slice(5, 7) - 1, +hoyISO.slice(8, 10));
  return Math.round((b - a) / 864e5);
}

export function interpretDatos({ source, staleUntil, ultimoResultado }, hoyISO) {
  if (source === "live") {
    return { estado: OK, detalle: "Los datos que estás viendo vienen de la conexión en vivo." };
  }
  if (source === "openfootball") {
    const dias = diasDeRetraso(staleUntil || ultimoResultado, hoyISO);
    const cola = dias == null ? "" : ` El último resultado que trae es de hace ${dias} ${dias === 1 ? "día" : "días"}.`;
    return {
      estado: FALLO,
      detalle: `Estás viendo la fuente de respaldo, no la de en vivo.${cola}`,
      accion: "desplegar",
    };
  }
  return { estado: FALLO, detalle: "No se han podido cargar datos de ninguna de las dos fuentes.", accion: "reintentar" };
}

// ── Partidos en el calendario ───────────────────────────────────────────────
export function interpretCalendario({ autoSuggest, enCalendario, disponibles }) {
  if (autoSuggest === false) {
    return {
      estado: AVISO,
      detalle: `Tienes desactivado "Proponer partidos", así que la app no te avisa cuando hay partidos nuevos.${enCalendario ? ` Ya tienes ${enCalendario} en el calendario.` : ""}`,
    };
  }
  if (!disponibles) {
    return { estado: AVISO, detalle: "No hay partidos futuros cargados todavía, así que no hay nada que proponer." };
  }
  if (!enCalendario) {
    return {
      estado: AVISO,
      detalle: `Hay ${disponibles} ${disponibles === 1 ? "partido" : "partidos"} por venir y ninguno está en tu calendario aún.`,
      accion: "ir-partidos",
    };
  }
  return { estado: OK, detalle: `${enCalendario} ${enCalendario === 1 ? "partido añadido" : "partidos añadidos"} al calendario.` };
}

// ── Qué hacer, en castellano ────────────────────────────────────────────────
export const PASOS = {
  actualizar: "Pulsa «Actualizar la app» aquí abajo. Si aun así no cambia, cierra la app del todo (deslízala fuera del multitarea) y vuelve a abrirla.",
  "elegir-equipo": "Vuelve a la pestaña Partidos y elige tu equipo.",
  desplegar: "En GitHub: pestaña Actions → «Desplegar Edge Function» → Run workflow. Cuando salga el ✅, vuelve aquí y pulsa Verificar otra vez.",
  clave: "Falta el secreto FOOTBALL_DATA_KEY. En GitHub: Settings → Secrets and variables → Actions → New repository secret, con ese nombre exacto y tu clave de football-data.org. Luego vuelve a desplegar (Actions → Run workflow).",
  "clave-nueva": "Saca una clave nueva en football-data.org/client/register, actualiza el secreto FOOTBALL_DATA_KEY en GitHub (Settings → Secrets and variables → Actions) y vuelve a desplegar.",
  reintentar: "Comprueba que tienes conexión y pulsa Verificar otra vez.",
  "ir-partidos": "Ve a la pestaña Partidos y usa el + de cada partido para añadirlo.",
};

// ── Resumen de una tacada ───────────────────────────────────────────────────
export function resumen(checks = []) {
  const fallos = checks.filter(c => c.estado === FALLO);
  const avisos = checks.filter(c => c.estado === AVISO);
  if (fallos.length) {
    return { estado: FALLO, texto: fallos.length === 1 ? "Hay 1 cosa que arreglar." : `Hay ${fallos.length} cosas que arreglar.` };
  }
  if (avisos.length) return { estado: AVISO, texto: "Todo lo importante funciona. Hay algún detalle opcional." };
  return { estado: OK, texto: "Todo correcto. No queda nada por hacer." };
}

// ── El runner (lo único que toca la red) ────────────────────────────────────
// Cada comprobación va envuelta: si una revienta, las demás siguen. Un
// diagnóstico que se cae a la primera no diagnostica nada.
export async function runChecks({ team, cfg = {}, enCalendario = 0, appVersion }) {
  clearFootballCache();
  const hoy = new Date().toISOString().slice(0, 10);
  const out = [];

  // 1. ¿Está el móvil ejecutando la última versión publicada?
  let remota = null;
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (r.ok) remota = (await r.json())?.v || null;
  } catch { /* sin conexión */ }
  out.push({ id: "version", titulo: "Versión de la app", ...interpretVersion(appVersion, remota) });

  // 2. ¿Hay equipo elegido? Si no, lo demás no tiene sentido.
  out.push({ id: "equipo", titulo: "Tu equipo", ...interpretTeam(team) });

  // 3. La Edge Function, con ping real a football-data.
  let probe;
  try {
    const { default: supabase } = await import("../supabase.js");
    const { data, error } = await supabase.functions.invoke("football", { body: { action: "probe" } });
    probe = error ? { fallo: "red" } : { data };
  } catch { probe = { fallo: "red" }; }
  out.push({ id: "funcion", titulo: "Servidor de datos en vivo", ...interpretProbe(probe) });

  // 4. ¿Qué fuente está contestando de verdad ahora mismo?
  if (team) {
    try {
      const { getTeamMatches } = await import("./footballApi.js");
      const d = await getTeamMatches(team.id);
      const conResultado = (d.matches || []).filter(m => m.ft).map(m => m.date).sort();
      out.push({
        id: "datos", titulo: "Frescura de los datos",
        ...interpretDatos({
          source: d.source, staleUntil: d.staleUntil,
          ultimoResultado: conResultado[conResultado.length - 1] || null,
        }, hoy),
      });
      const futuros = (d.matches || []).filter(m => m.date >= hoy).length;
      out.push({ id: "calendario", titulo: "Partidos en el calendario", ...interpretCalendario({ autoSuggest: cfg.autoSuggest, enCalendario, disponibles: futuros }) });
    } catch {
      out.push({ id: "datos", titulo: "Frescura de los datos", estado: FALLO, detalle: "No se han podido cargar los partidos.", accion: "reintentar" });
    }
  }

  return out;
}

// ── Limpieza de la caché de datos de fútbol ─────────────────────────────────
// La app cachea 10 minutos en localStorage. Antes de diagnosticar hay que
// tirarla: si no, se estaría diagnosticando la respuesta de hace un rato.
export function clearFootballCache(storage) {
  const st = storage || (typeof localStorage !== "undefined" ? localStorage : null);
  if (!st) return 0;
  const fuera = [];
  try {
    for (let i = 0; i < st.length; i++) {
      const k = st.key(i);
      if (k && k.startsWith("mp-fapi-")) fuera.push(k);
    }
    fuera.forEach(k => st.removeItem(k));
  } catch { /* modo privado */ }
  return fuera.length;
}
