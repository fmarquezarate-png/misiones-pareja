// Detalle de una métrica: se abre al tocar su caja en el panel de salud.
//
// Periodo (7 / 30 / 90 días), gráfica con la media marcada, día más alto y
// más bajo, cobertura, tendencia y racha de la meta — y la posibilidad de
// preguntarle a Misi. Para eso, SOLO esta métrica y este periodo se envían a
// la IA de Misi (OpenAI, a través de la Edge Function misi-chat): se dice en
// pantalla antes de enviar nada.

import { useEffect, useMemo, useRef, useState } from "react";
import { detalleMetrica, porSemanas, resumenParaIA, porMeses, extremosMensuales, resumenHistoricoParaIA, diasEntre } from "../lib/healthStats.js";
import { cargarMetricaCompleta } from "../lib/healthApi.js";
import { askMisi } from "../lib/misi.js";
import { withTimeout } from "../utils.js";
import { humanDate } from "../lib/dateLabel.js";
import { Z } from "../lib/zLayers.js";

const dim = { fontSize: 11.5, color: "var(--t-text-dim,#8f84ad)", lineHeight: 1.5 };
const chip = activo => ({
  padding: "5px 11px", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
  background: activo ? "var(--t-accent-soft,rgba(167,139,250,0.18))" : "transparent",
  color: activo ? "var(--t-accent,#c4b8ff)" : "var(--t-text-muted,#b9b0d0)",
  border: `1px solid ${activo ? "rgba(167,139,250,0.5)" : "var(--t-card-border,rgba(167,139,250,0.2))"}`,
});
// "todo" = el historial completo, por meses (Fran: "quiero ver históricamente
// el mejor y el peor dato", no solo 90 días).
const PERIODOS = [7, 30, 90, "todo"];
const SUGERENCIAS_HISTORICO = ["¿He mejorado con los años?", "¿Qué épocas fueron mejores y peores?", "¿Se nota algún patrón según la época del año?"];

export default function MetricaDetalle({ def, filas, hoy, coupleId, personName, userId, onCerrar, puedePreguntar = true }) {
  const [dias, setDias] = useState(30);
  const [sel, setSel] = useState(null);
  const [pregunta, setPregunta] = useState("");
  const [respuesta, setRespuesta] = useState(null);   // null | "pensando" | { texto } | { error }

  // Histórico completo: se pide solo al pulsar "Todo", y solo esta métrica.
  const [historico, setHistorico] = useState(null);     // null | "cargando" | { filas, error }
  const todo = dias === "todo";
  // Ojo: la respuesta solo se descarta si la hoja se CIERRA. Con un
  // "vivo = false" en la limpieza de este mismo efecto, el propio
  // setHistorico("cargando") lo volvía a disparar, la limpieza marcaba la
  // petición como abandonada y la respuesta se tiraba: "Cargando…" para siempre.
  const montada = useRef(true);
  useEffect(() => () => { montada.current = false; }, []);
  useEffect(() => {
    if (!todo || historico || !userId) return;
    setHistorico("cargando");
    cargarMetricaCompleta(userId, def.metric).then(r => { if (montada.current) setHistorico(r); });
  }, [todo, historico, userId, def.metric]);

  const filasUsadas = todo && historico?.filas?.length ? historico.filas : filas;
  const nDias = todo
    ? (historico?.filas?.length ? diasEntre(historico.filas[0].day, hoy) : 1)
    : dias;
  const d = useMemo(() => detalleMetrica(filasUsadas, def.metric, hoy, nDias, { meta: def.meta, mejorSi: def.mejorSi }), [filasUsadas, def, hoy, nDias]);
  const meses = useMemo(() => (todo ? porMeses(d.serie) : []), [d, todo]);
  const extremos = useMemo(() => extremosMensuales(meses, { mejorSi: def.mejorSi }), [meses, def.mejorSi]);
  // 90 días en barras diarias no se leen: por semanas. El histórico: por meses.
  const barras = useMemo(() => (todo ? meses : nDias > 30 ? porSemanas(d.serie) : d.serie), [d, nDias, todo, meses]);
  const agrupado = todo ? "Mes de " : nDias > 30 ? "Semana del " : "";
  const max = Math.max(1, ...barras.map(b => b.valor ?? 0));
  const f = v => def.formato(v);

  const preguntar = async texto => {
    const q = (texto ?? pregunta).trim();
    if (!q) return;
    setPregunta(q);
    setRespuesta("pensando");
    try {
      const mensaje = todo
        ? resumenHistoricoParaIA({ nombre: def.nombre, unidad: def.unidadLarga, detalle: d, meses, extremos, pregunta: q })
        : resumenParaIA({ nombre: def.nombre, unidad: def.unidadLarga, dias: nDias, detalle: d, pregunta: q });
      const txt = await withTimeout(askMisi({ coupleId, personName, message: mensaje }), 30000, "misi_salud");
      setRespuesta({ texto: txt });
    } catch (e) {
      // El mensaje amable para la persona; el motivo real debajo, pequeño.
      // Tragárselo (como en la primera versión) dejaba a ciegas: con Misi ya
      // pasó en v4.23.1 y la regla es enseñar el detalle.
      setRespuesta({ error: "Misi no ha podido responder ahora. Prueba en un rato.", detalle: String(e?.message || e).slice(0, 220) });
    }
  };

  const tend = d.tendencia;
  return (
    <>
      <div onClick={onCerrar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: Z.SHEET }} />
      <div role="dialog" aria-label={`Detalle de ${def.nombre}`} style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: Z.SHEET + 1, maxHeight: "86vh", overflowY: "auto",
        background: "var(--t-card,#1d1733)", borderTop: "1px solid var(--t-card-border,rgba(167,139,250,0.3))",
        borderRadius: "18px 18px 0 0", padding: "14px 16px calc(24px + env(safe-area-inset-bottom))",
        maxWidth: 760, margin: "0 auto",
      }}>
        <div style={{ width: 32, height: 3, background: "rgba(128,128,128,0.3)", borderRadius: 99, margin: "0 auto 12px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--t-text,#f8f4ff)" }}><span aria-hidden>{def.icono}</span> {def.nombre}</div>
          <button onClick={onCerrar} aria-label="Cerrar" style={{ ...chip(false), padding: "4px 10px" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {PERIODOS.map(p => <button key={p} onClick={() => { setDias(p); setSel(null); setRespuesta(null); }} style={chip(dias === p)}>{p === "todo" ? "Todo" : `${p} días`}</button>)}
        </div>

        {/* Gráfica: la media como línea fina de referencia; tocar una barra la lee */}
        {todo && historico === "cargando" && <div style={{ ...dim, marginBottom: 6 }}>Cargando todo tu historial…</div>}
        {todo && historico?.error && <div style={{ ...dim, marginBottom: 6, color: "#fbbf24" }}>No se pudo cargar el historial completo; se muestran los últimos 120 días.</div>}
        {/* Si el "histórico" apenas va más allá de los últimos meses, lo más
            probable es que el historial antiguo no se haya importado: se dice
            y se dice cómo, en vez de enseñar una gráfica corta sin explicar. */}
        {todo && historico?.filas && (historico.filas.length === 0 || diasEntre(historico.filas[0].day, hoy) < 200) && (
          <div style={{ ...dim, marginBottom: 8, padding: "8px 10px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", color: "var(--t-text-muted,#b9b0d0)" }}>
            {historico.filas.length === 0 ? `Todavía no hay datos de ${def.nombre.toLowerCase()}.` : `Solo hay datos de ${def.nombre.toLowerCase()} desde ${humanDate(historico.filas[0].day)}.`}{" "}
            Si tienes más historial en tu iPhone, impórtalo en <b>Salud → Datos y conexión → Importar historial completo</b>.
          </div>
        )}
        <div style={{ position: "relative", height: 120, display: "flex", alignItems: "flex-end", gap: todo ? 1 : nDias > 30 ? 4 : nDias > 7 ? 2 : 6 }}>
          {d.media != null && (
            <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: `${(d.media / max) * 100}%`, borderTop: "1px solid var(--t-text-dim,#8f84ad)", opacity: 0.6 }}>
              <span style={{ position: "absolute", right: 0, top: -17, fontSize: 10, color: "var(--t-text-muted,#b9b0d0)", background: "var(--t-card,#1d1733)", padding: "0 5px", borderRadius: 6 }}>media {f(d.media)}</span>
            </div>
          )}
          {barras.map(b => {
            const activa = sel?.dia === b.dia;
            return (
              <button key={b.dia} onClick={() => setSel(activa ? null : b)}
                aria-label={`${agrupado}${todo ? b.mes : humanDate(b.dia)}: ${b.valor == null ? "sin dato" : f(b.valor)}`}
                style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0, border: "none", background: "transparent", cursor: "pointer" }}>
                {b.valor == null
                  ? <span style={{ width: 4, height: 4, borderRadius: 2, background: "var(--t-text-dim,#8f84ad)", opacity: 0.6 }} />
                  : <span style={{ width: "100%", height: `${Math.max(3, (b.valor / max) * 100)}%`, borderRadius: "4px 4px 0 0",
                      background: "var(--t-accent,#a78bfa)", opacity: activa ? 1 : sel ? 0.35 : 0.75 }} />}
              </button>
            );
          })}
        </div>
        {/* En el histórico, los años bajo la gráfica (en cada enero). */}
        {todo && (
          <div aria-hidden style={{ display: "flex", gap: 1, marginTop: 3 }}>
            {barras.map((b, i) => (
              <span key={b.mes} style={{ flex: 1, fontSize: 9, color: "var(--t-text-dim,#8f84ad)", overflow: "visible", whiteSpace: "nowrap" }}>
                {b.mes.endsWith("-01") || i === 0 ? b.mes.slice(0, 4) : ""}
              </span>
            ))}
          </div>
        )}
        <div style={{ ...dim, marginTop: 6, minHeight: 18 }}>
          {sel ? <><b style={{ color: "var(--t-text,#f0e8ff)" }}>{agrupado}{todo ? nombreMes(sel.mes) : humanDate(sel.dia)}</b>: {sel.valor == null ? "sin dato" : `${f(sel.valor)}${agrupado ? " de media" : ""}${todo ? ` (${sel.dias} días con dato)` : ""}`}</>
            : todo ? "Cada barra es la media de un mes. Toca una para verla."
            : nDias > 30 ? "Cada barra es la media de una semana. Toca una para verla." : "Toca una barra para ver ese día."}
        </div>

        {/* Los números */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "12px 0" }}>
          <Dato titulo={todo ? "Media histórica" : "Media"} valor={d.media == null ? "—" : f(d.media)} nota={todo && d.serie.length ? `${d.conDato} días con dato desde ${nombreMes(d.serie[0].dia.slice(0, 7))}` : `${d.conDato} de ${d.total} días con dato`} />
          <Dato titulo="Tendencia" valor={tend == null ? "—" : `${tend > 0 ? "↑" : tend < 0 ? "↓" : "→"} ${Math.abs(Math.round(tend * 100))} %`}
            nota="2.ª mitad del periodo vs 1.ª" color={tend == null || Math.abs(tend) < 0.02 || (def.mejorSi !== "sube" && def.mejorSi !== "baja") ? null : (def.mejorSi === "baja" ? tend < 0 : tend > 0) ? "#34d399" : "#f87171"} />
          {/* Rótulo SIEMPRE por el valor (más alto / más bajo); cuál es «el mejor» va en
              la nota, y solo si la métrica tiene dirección (el pulso en reposo mejora al
              bajar; el peso o la longitud de paso no son «mejores» por sí mismos). */}
          <Dato titulo={`Día más alto${todo ? " de siempre" : ""}`} valor={d.mas ? f(d.mas.valor) : "—"}
            nota={d.mas ? `${humanDate(d.mas.dia)}${d.mejor && d.mejor === d.mas ? " · tu mejor día" : ""}` : ""} />
          <Dato titulo={`Día más bajo${todo ? " de siempre" : ""}`} valor={d.menos ? f(d.menos.valor) : "—"}
            nota={d.menos ? `${humanDate(d.menos.dia)}${d.mejor && d.mejor === d.menos ? " · tu mejor día" : ""}` : ""} />
          {todo && <Dato titulo="Mes más alto" valor={extremos.alto ? f(extremos.alto.valor) : "—"}
            nota={extremos.alto ? `${nombreMes(extremos.alto.mes)} · de media${extremos.mejor && extremos.mejor === extremos.alto ? " · tu mejor mes" : ""}` : "sin meses completos"} />}
          {todo && <Dato titulo="Mes más bajo" valor={extremos.bajo ? f(extremos.bajo.valor) : "—"}
            nota={extremos.bajo ? `${nombreMes(extremos.bajo.mes)} · de media${extremos.mejor && extremos.mejor === extremos.bajo ? " · tu mejor mes" : ""}` : ""} />}
          {d.racha != null && <Dato titulo={`Racha ≥ ${f(def.meta)}`} valor={`${d.racha} ${d.racha === 1 ? "día" : "días"}`} nota="seguidos hasta hoy" />}
        </div>

        {/* Preguntarle a Misi. Solo sobre TUS datos: al mirar a tu pareja no se envían sus datos de salud a la IA. */}
        {puedePreguntar && <div style={{ borderTop: "1px solid var(--t-card-border,rgba(167,139,250,0.16))", paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t-text,#f0e8ff)", marginBottom: 6 }}>🤖 Pregúntale a Misi</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {/* Con el histórico solo viajan medias mensuales: preguntas que se
                puedan responder con eso (no "¿qué día de la semana…?"). */}
            {(todo ? SUGERENCIAS_HISTORICO : def.sugerencias).map(s => <button key={s} onClick={() => preguntar(s)} style={{ ...chip(false), fontSize: 11.5 }}>{s}</button>)}
          </div>
          <form onSubmit={e => { e.preventDefault(); preguntar(); }} style={{ display: "flex", gap: 6 }}>
            <input value={pregunta} onChange={e => setPregunta(e.target.value.slice(0, 300))} placeholder={`Pregunta lo que quieras sobre ${def.nombre.toLowerCase()}…`}
              style={{ flex: 1, minWidth: 0, padding: "9px 12px", borderRadius: 10, fontSize: 14, fontFamily: "inherit",
                background: "var(--t-input-bg,rgba(128,128,128,0.1))", color: "var(--t-text,#f0e8ff)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.25))" }} />
            <button type="submit" disabled={respuesta === "pensando"} style={{ padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#a78bfa,#7c3aed)", opacity: respuesta === "pensando" ? 0.6 : 1 }}>
              {respuesta === "pensando" ? "…" : "Preguntar"}
            </button>
          </form>
          <div style={{ ...dim, marginTop: 6 }}>Se envían a la IA de Misi (OpenAI) tu pregunta y {todo ? `las medias mensuales de ${def.nombre.toLowerCase()} de todo tu historial` : `los valores diarios de ${def.nombre.toLowerCase()} de estos ${nDias} días`}. Nada más.</div>
          {respuesta && respuesta !== "pensando" && (
            <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, background: "rgba(167,139,250,0.08)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.2))", fontSize: 13, color: respuesta.error ? "#fbbf24" : "var(--t-text,#f0e8ff)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {respuesta.error || respuesta.texto}
              {respuesta.detalle && <div style={{ fontSize: 11, color: "var(--t-text-dim,#8f84ad)", marginTop: 6 }}>Motivo técnico: {respuesta.detalle}</div>}
            </div>
          )}
        </div>}
      </div>
    </>
  );
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = ym => (ym ? `${MESES[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}` : "");

function Dato({ titulo, valor, nota, color }) {
  return (
    <div style={{ padding: "8px 10px", borderRadius: 12, background: "rgba(167,139,250,0.06)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.14))" }}>
      <div style={{ fontSize: 10.5, color: "var(--t-text-dim,#8f84ad)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>{titulo}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || "var(--t-text,#f8f4ff)", marginTop: 2 }}>{valor}</div>
      {nota && <div style={{ fontSize: 11, color: "var(--t-text-muted,#b9b0d0)" }}>{nota}</div>}
    </div>
  );
}
