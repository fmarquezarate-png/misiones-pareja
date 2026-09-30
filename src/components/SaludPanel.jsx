// Panel de salud: cómo va todo lo demás, debajo de la mascota.
//
// Diseñado con la guía de visualización del proyecto:
//  · KPIs como "stat tiles": valor + variación + minigráfica de 7 días, con
//    HOY resaltado y el resto atenuado (énfasis, no un color por barra).
//  · Un día sin dato se pinta como un punto en la base, NUNCA como una barra
//    a cero: son cosas distintas (regla esSinDato).
//  · La flecha de variación lleva icono + texto, y su color dice si es bueno
//    para ESA métrica (el pulso en reposo mejora al bajar).
//  · Fases del sueño: barra apilada (no donut) con la paleta validada contra
//    los 15 temas (--t-viz-1..4, publicada por ThemeInjector), orden fijo.
//  · Los números van en tinta de texto, nunca en el color de la serie.

import { useMemo, useState } from "react";
import MetricaDetalle from "./MetricaDetalle.jsx";
import { kpi, metasSemana, repartoEntrenos, ultimaNoche } from "../lib/healthStats.js";
import { METRICAS, diaLocalDe, horaLocalDe } from "../lib/pet.js";
import { TARJETAS, sanearPanel, formatoDetalle } from "../lib/saludPanel.js";
import { TEXTO_NIVEL, UMBRAL } from "../lib/deporteCalendario.js";
import { humanDate } from "../lib/dateLabel.js";

const card = { background: "var(--t-card,#1d1733)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.16))", borderRadius: 16, padding: "12px 14px", minWidth: 0 };
const titulo = { fontSize: 12.5, fontWeight: 700, color: "var(--t-text,#f0e8ff)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 };
const dim = { fontSize: 11, color: "var(--t-text-dim,#8f84ad)", lineHeight: 1.45 };
const BUENO = "#34d399", MALO = "#f87171";
const LETRA = ["D", "L", "M", "X", "J", "V", "S"];
const letraDe = dia => LETRA[new Date(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8, 10)).getDay()];

const hm = h => { const H = Math.floor(h), M = Math.round((h - H) * 60); return M === 60 ? `${H + 1}h` : `${H}h ${String(M).padStart(2, "0")}m`; };
const reloj = m => { const x = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };
const miles = n => Math.round(n).toLocaleString("es-ES");

// ── Minigráfica de 7 barras, hoy resaltado ─────────────────────────────────
function Barras({ serie, formato }) {
  const max = Math.max(1, ...serie.map(d => d.valor ?? 0));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 38 }}>
        {serie.map((d, i) => {
          const hoy = i === serie.length - 1;
          const etiqueta = `${humanDate(d.dia)}: ${d.valor == null ? "sin dato" : formato(d.valor)}`;
          return (
            <div key={d.dia} title={etiqueta} aria-label={etiqueta} role="img"
              style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              {d.valor == null
                ? <span style={{ width: 4, height: 4, borderRadius: 2, background: "var(--t-text-dim,#8f84ad)", opacity: 0.6 }} />
                : <span style={{
                    width: "100%", height: `${Math.max(6, (d.valor / max) * 100)}%`, borderRadius: "4px 4px 0 0",
                    background: "var(--t-accent,#a78bfa)", opacity: hoy ? 1 : 0.42,
                  }} />}
            </div>
          );
        })}
      </div>
      {serie.length <= 14 && <div style={{ display: "flex", gap: 2, marginTop: 3 }}>
        {serie.map((d, i) => (
          <span key={d.dia} style={{ flex: 1, textAlign: "center", fontSize: 9, color: i === serie.length - 1 ? "var(--t-text,#f0e8ff)" : "var(--t-text-dim,#8f84ad)", fontWeight: i === serie.length - 1 ? 700 : 400 }}>
            {letraDe(d.dia)}
          </span>
        ))}
      </div>}
    </div>
  );
}

// ── Línea (para el pulso: una tendencia, no una magnitud desde cero) ────────
function Linea({ serie, formato }) {
  const vals = serie.map(d => d.valor).filter(v => v != null);
  if (vals.length < 2) return <Barras serie={serie} formato={formato} />;
  const lo = Math.min(...vals) - 2, hi = Math.max(...vals) + 2;
  const W = 100, H = 38, x = i => (i / (serie.length - 1)) * W, y = v => H - ((v - lo) / (hi - lo)) * H;
  const pts = serie.map((d, i) => (d.valor == null ? null : [x(i), y(d.valor)])).filter(Boolean);
  const ult = serie[serie.length - 1];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 38, overflow: "visible" }}
        role="img" aria-label={serie.map(d => `${humanDate(d.dia)}: ${d.valor == null ? "sin dato" : formato(d.valor)}`).join(", ")}>
        <polyline points={pts.map(p => p.join(",")).join(" ")} fill="none" stroke="var(--t-accent,#a78bfa)" strokeWidth="2"
          vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
        {ult.valor != null && <circle cx={x(serie.length - 1)} cy={y(ult.valor)} r="4" fill="var(--t-accent,#a78bfa)"
          stroke="var(--t-card,#1d1733)" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
      </svg>
      {serie.length <= 14 && <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
        {serie.map((d, i) => <span key={d.dia} style={{ fontSize: 9, color: i === serie.length - 1 ? "var(--t-text,#f0e8ff)" : "var(--t-text-dim,#8f84ad)", fontWeight: i === serie.length - 1 ? 700 : 400 }}>{letraDe(d.dia)}</span>)}
      </div>}
    </div>
  );
}

function Tile({ icono, nombre, k, formato, unidad, forma = "barras", formatoDelta, onAbrir }) {
  const Grafica = forma === "linea" ? Linea : Barras;
  // Toda la caja abre el detalle (regla de blancos táctiles, CLAUDE.md §5).
  return (
    <div style={{ ...card, cursor: "pointer" }} role="button" tabIndex={0} onClick={onAbrir}
      onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onAbrir?.())}
      aria-label={`${nombre}: ver detalle`}>
      <div style={{ ...titulo, justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span aria-hidden>{icono}</span>{nombre}</span>
        <span aria-hidden style={{ fontSize: 13, color: "var(--t-text-dim,#8f84ad)" }}>›</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 2 }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: "var(--t-text,#f8f4ff)", letterSpacing: -0.5 }}>
          {k.actual == null ? "—" : formato(k.actual)}
        </span>
        {unidad && k.actual != null && <span style={{ fontSize: 11.5, color: "var(--t-text-muted,#b9b0d0)" }}>{unidad}</span>}
      </div>
      <div style={{ ...dim, marginBottom: 8, minHeight: 16 }}>
        {k.delta == null ? `media de ${k.diasConDato} ${k.diasConDato === 1 ? "día" : "días"} con dato${k.cerrados ? " cerrados" : ""}`
          : (
            <span style={{ color: k.bueno == null ? "var(--t-text-muted,#b9b0d0)" : k.bueno ? BUENO : MALO, fontWeight: 600 }}>
              {k.delta > 0 ? "↑" : k.delta < 0 ? "↓" : "→"} {formatoDelta(Math.abs(k.delta))}
              <span style={{ color: "var(--t-text-dim,#8f84ad)", fontWeight: 400 }}> vs. {k.n === 7 ? "semana anterior" : `${k.n} días antes`}</span>
            </span>
          )}
      </div>
      <Grafica serie={k.serie} formato={v => `${formato(v)}${unidad ? " " + unidad : ""}`} />
      {k.hoyValor != null && <div style={{ ...dim, marginTop: 4 }}>Hoy, por ahora: <b style={{ color: "var(--t-text,#f0e8ff)", fontWeight: 600 }}>{formato(k.hoyValor)}</b></div>}
    </div>
  );
}

function Meter({ progreso, hecho }) {
  return (
    <div style={{ height: 6, borderRadius: 99, background: "var(--t-accent-soft,rgba(167,139,250,0.16))", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.max(progreso > 0 ? 4 : 0, progreso * 100)}%`, borderRadius: 99, background: hecho ? BUENO : "var(--t-accent,#a78bfa)" }} />
    </div>
  );
}

export default function SaludPanel({ filas, entrenos, deporteCalendario = null, metas, hoy, coupleId, personName, userId, panel, puedePreguntar = true, onPersonalizar }) {
  const [abierta, setAbierta] = useState(null);
  const cfg = useMemo(() => sanearPanel(panel), [panel]);
  const metaDe = tipo => metas.find(m => m.tipo === tipo && m.periodo === "dia")?.objetivo ?? null;
  const k = useMemo(() => Object.fromEntries(cfg.tarjetas.map(id => {
    const t = TARJETAS[id];
    return [id, kpi(filas, t.metric, hoy, { mejorSi: t.mejorSi || "neutral", n: cfg.dias, cerrados: !!t.cerrados })];
  })), [filas, hoy, cfg]);
  const semana = useMemo(() => metasSemana(filas, entrenos, metas, hoy), [filas, entrenos, metas, hoy]);
  const reparto = useMemo(() => repartoEntrenos(entrenos, hoy, 90), [entrenos, hoy]);
  const noche = useMemo(() => ultimaNoche(filas, hoy), [filas, hoy]);
  // Orden por INSTANTE (Date.parse): los del reloj vienen en UTC con huso y los del
  // calendario en hora local sin huso; comparar el texto los mezclaba.
  const ultimo = useMemo(() => [...entrenos].sort((a, b) => (Date.parse(b.start_at) || 0) - (Date.parse(a.start_at) || 0))[0] || null, [entrenos]);
  const [verTodoDeporte, setVerTodoDeporte] = useState(false);
  const tipos = reparto.tipos.length > 5
    ? [...reparto.tipos.slice(0, 4), { nombre: "Otros", n: reparto.tipos.slice(4).reduce((a, t) => a + t.n, 0) }]
    : reparto.tipos;
  const maxTipo = Math.max(1, ...tipos.map(t => t.n));
  // Detalle de una tarjeta: sale del MISMO registro que la tarjeta (antes había una tabla aparte que se desincronizaba).
  const defDe = id => { const t = TARJETAS[id]; return { metric: t.metric, nombre: t.nombre, icono: t.icono, unidadLarga: t.unidadLarga,
    formato: formatoDetalle(id), meta: t.meta ? metaDe(t.meta) : null, mejorSi: t.mejorSi || "neutral", sugerencias: t.sugerencias }; };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {onPersonalizar && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onPersonalizar} style={{ padding: "10px 14px", minHeight: 44, borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
            color: "var(--t-accent,#c4b8ff)", background: "transparent", border: "1px solid var(--t-card-border,rgba(167,139,250,0.3))" }}>
            <span aria-hidden>⚙️</span> Personalizar panel y metas
          </button>
        </div>
      )}
      {/* Metas de la semana */}
      {cfg.secciones.metas && <div style={card}>
        <div style={titulo}><span aria-hidden>🎯</span>Metas de la semana</div>
        {semana.map(m => {
          const meta = METRICAS[m.tipo];
          const diaria = m.periodo === "dia";
          const hecho = diaria ? false : m.progreso >= 1;
          const prog = diaria ? (m.dias ? m.cumplidos / m.dias : 0) : m.progreso;
          return (
            <div key={m.id} style={{ padding: "7px 0", borderTop: "1px solid rgba(167,139,250,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 12.5, color: "var(--t-text,#f0e8ff)" }}>
                  {/* "Pasos ≥ 8000 al día", no "Pasos ≥ 8000 pasos al día". */}
                  {meta?.nombre} {diaria ? "≥ " : ""}{miles(m.objetivo)}{meta?.unidad && meta.unidad !== meta.nombre?.toLowerCase() ? ` ${meta.unidad}` : ""}{diaria ? " al día" : " en la semana"}
                </span>
                <span style={{ fontSize: 12, color: "var(--t-text-muted,#b9b0d0)", flexShrink: 0 }}>
                  {diaria ? `${m.cumplidos}/${m.dias} días` : m.valor == null ? "sin datos" : `${miles(m.valor)} / ${miles(m.objetivo)}`}
                  {hecho && <span style={{ color: BUENO, marginLeft: 4 }} aria-label="cumplida">✓</span>}
                </span>
              </div>
              <Meter progreso={prog} hecho={hecho} />
              {diaria && m.conDato < m.dias && (
                <div style={{ ...dim, marginTop: 3 }}>{m.dias - m.conDato} {m.dias - m.conDato === 1 ? "día" : "días"} sin dato — no cuentan como fallados.</div>
              )}
            </div>
          );
        })}
      </div>}

      {/* KPIs: las tarjetas que la persona ha elegido, en su orden */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {cfg.tarjetas.map(id => {
          const t = TARJETAS[id];
          return <Tile key={id} icono={t.icono} nombre={t.nombre} k={k[id]} formato={t.formato} unidad={t.unidad} forma={t.forma} formatoDelta={t.delta} onAbrir={() => setAbierta(id)} />;
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
        {/* Última noche */}
        {cfg.secciones.noche && <div style={card}>
          <div style={titulo}><span aria-hidden>😴</span>Última noche</div>
          {!noche ? <div style={dim}>Aún no hay ninguna noche registrada.</div> : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: "var(--t-text,#f8f4ff)" }}>{hm(noche.total)}</span>
                <span style={dim}>{humanDate(noche.dia)}{noche.acostarse != null && noche.despertar != null ? ` · ${reloj(noche.acostarse)} → ${reloj(noche.despertar)}` : ""}</span>
              </div>
              {noche.fases.length ? (
                <>
                  <div style={{ display: "flex", gap: 2, height: 12, borderRadius: 6, overflow: "hidden", margin: "8px 0" }} role="img"
                    aria-label={noche.fases.map(f => `${f.nombre} ${hm(f.horas)}`).join(", ")}>
                    {noche.fases.map((f, i) => (
                      <span key={f.nombre} style={{ flex: f.horas, background: `var(--t-viz-${i + 1})` }} />
                    ))}
                  </div>
                  {/* Una fase por línea, valor sin partir: en dos columnas
                      estrechas "2h 09m (26 %)" acababa en tres renglones. */}
                  <div style={{ display: "grid", gap: 4 }}>
                    {noche.fases.map((f, i) => (
                      <span key={f.nombre} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--t-text-muted,#b9b0d0)" }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: `var(--t-viz-${i + 1})`, flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{f.nombre}</span>
                        <b style={{ color: "var(--t-text,#f0e8ff)", fontWeight: 600, whiteSpace: "nowrap" }}>{hm(f.horas)}</b>
                        <span style={{ whiteSpace: "nowrap", minWidth: 40, textAlign: "right" }}>{Math.round((f.horas / noche.fases.reduce((a, x) => a + x.horas, 0)) * 100)} %</span>
                      </span>
                    ))}
                  </div>
                </>
              ) : <div style={{ ...dim, marginTop: 6 }}>Tu reloj no manda las fases del sueño (profundo, REM…), solo el total.</div>}
            </>
          )}
        </div>}

        {/* Último entreno */}
        {cfg.secciones.entreno && <div style={card}>
          <div style={titulo}><span aria-hidden>🏃</span>Último entreno</div>
          {!ultimo ? <div style={dim}>Aún no hay entrenos. Crea la automatización de Workouts en Health Auto Export.</div> : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t-text,#f8f4ff)" }}>{ultimo.name}</div>
              <div style={{ ...dim, marginBottom: 10 }}>
                {humanDate(diaLocalDe(String(ultimo.start_at)))}{horaLocalDe(String(ultimo.start_at)) ? ` · ${horaLocalDe(String(ultimo.start_at))}` : ""}
                {ultimo.source === "calendario" && <> · <span aria-hidden>📅</span> de tu calendario, {TEXTO_NIVEL[ultimo.nivel]}</>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {[
                  ["⏱️", ultimo.minutes != null ? `${Math.round(ultimo.minutes)} min` : null, "Duración"],
                  ["🔥", ultimo.kcal != null ? `${ultimo.source === "calendario" && ultimo.nivel !== "confirmado" ? "≈ " : ""}${miles(ultimo.kcal)} kcal` : null, ultimo.source === "calendario" ? (ultimo.nivel === "confirmado" ? "Energía (medida por el reloj)" : "Energía (estimada)") : "Energía"],
                  ["📍", ultimo.distance_km != null ? `${ultimo.distance_km.toFixed(1).replace(".", ",")} km` : null, "Distancia"],
                  ["❤️", ultimo.avg_hr != null ? `${Math.round(ultimo.avg_hr)} lpm` : null, "Pulso medio"],
                ].filter(([, v]) => v).map(([ic, v, l]) => (
                  <div key={l}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--t-text,#f0e8ff)" }}><span aria-hidden>{ic}</span> {v}</div>
                    <div style={dim}>{l}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>}
      </div>

      {/* Deporte del calendario: el pádel, el gym… que el reloj no guarda como entreno */}
      {cfg.secciones.deporte && deporteCalendario?.evaluados?.length > 0 && (() => {
        const lista = [...deporteCalendario.evaluados].reverse();
        const vis = verTodoDeporte ? lista : lista.slice(0, 6);
        const r = deporteCalendario.resumen;
        const color = { confirmado: BUENO, probable: "var(--t-accent,#c4b8ff)", sin_reloj: "var(--t-text-muted,#b9b0d0)", no_coincide: "#fbbf24" };
        return (
          <div style={card}>
            <div style={titulo}><span aria-hidden>📅</span>Deporte del calendario</div>
            <div style={{ ...dim, marginBottom: 8 }}>
              Lo que apuntas en el calendario (pádel, gym…) cuenta como entreno aunque el reloj no lo guarde así. Se cruza con tu día:
              pulso máximo ≥ {UMBRAL.pulso}, +{UMBRAL.kcal} kcal y +{miles(UMBRAL.pasos)} pasos sobre tu día normal. Dos señales = confirmado.
              {" "}{r.confirmados} confirmados · {r.probables} probables · {r.sinReloj} sin reloj{r.noCoincide ? ` · ${r.noCoincide} que el reloj no vio` : ""}{r.enReloj ? ` · ${r.enReloj} ya registrados por el reloj` : ""}.
            </div>
            {deporteCalendario.tipos?.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${deporteCalendario.tipos.length}, 1fr)`, gap: 8, marginBottom: 8 }}>
                {deporteCalendario.tipos.map(t => (
                  <div key={t.nombre} style={{ padding: "8px 10px", borderRadius: 12, background: "rgba(167,139,250,0.06)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.14))" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--t-text,#f0e8ff)" }}>{t.nombre}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--t-text,#f8f4ff)", marginTop: 2 }}>{t.kcalMedidas != null ? `~${miles(t.kcalMedidas)} kcal` : "—"}</div>
                    <div style={{ fontSize: 11, color: "var(--t-text-muted,#b9b0d0)", lineHeight: 1.4 }}>
                      {t.partidos} partidos · {t.confirmados} con reloj{t.pulsoMax != null ? ` · pulso máx ${Math.round(t.pulsoMax)}` : ""}
                      <br />{t.usandose ? "✓ la app ya usa tu valor propio" : `aprendiendo: faltan ${Math.max(0, 15 - t.confirmados)} con reloj`}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {vis.map(e => (
              <div key={e.id + e.dia} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 0", borderTop: "1px solid rgba(167,139,250,0.08)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: "var(--t-text,#f0e8ff)" }}><span aria-hidden>{e.emoji || "🏅"}</span> {e.titulo}</div>
                  <div style={{ fontSize: 11, color: "var(--t-text-dim,#8f84ad)" }}>
                    {e.variante ? `${e.variante} · ` : ""}{humanDate(e.dia)}{e.inicio != null ? ` · ${String(Math.floor(e.inicio / 60)).padStart(2, "0")}:${String(e.inicio % 60).padStart(2, "0")}` : ""} · {e.minutos} min
                    {e.pulsoMax != null ? ` · pulso máx ${Math.round(e.pulsoMax)}` : ""}{e.delta?.pasos != null ? ` · ${e.delta.pasos >= 0 ? "+" : ""}${miles(e.delta.pasos)} pasos` : ""}
                    {e.picoEnHora === true ? " · el pico fue a esa hora" : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--t-text,#f0e8ff)" }}>{e.cuenta ? `${e.nivel === "confirmado" ? "" : "≈ "}${miles(e.kcal)} kcal` : "—"}</div>
                  <div style={{ fontSize: 10.5, color: color[e.nivel] }}>{TEXTO_NIVEL[e.nivel]}</div>
                </div>
              </div>
            ))}
            {lista.length > 6 && (
              <button onClick={() => setVerTodoDeporte(v => !v)} style={{ marginTop: 6, minHeight: 44, width: "100%", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
                color: "var(--t-accent,#c4b8ff)", background: "transparent", border: "1px solid var(--t-card-border,rgba(167,139,250,0.25))" }}>
                {verTodoDeporte ? "Ver menos" : `Ver los ${lista.length}`}
              </button>
            )}
          </div>
        );
      })()}

      {abierta && <MetricaDetalle def={defDe(abierta)} filas={filas} hoy={hoy} coupleId={coupleId} personName={personName} userId={userId} puedePreguntar={puedePreguntar} onCerrar={() => setAbierta(null)} />}

      {/* Tipos de entreno */}
      {cfg.secciones.tipos && <div style={card}>
        <div style={titulo}><span aria-hidden>📊</span>Tus entrenos · últimos 90 días</div>
        {!reparto.total ? <div style={dim}>Sin entrenos en los últimos 90 días.</div> : (
          <>
            <div style={{ ...dim, marginBottom: 8 }}>{reparto.total} sesiones</div>
            {tipos.map(t => (
              <div key={t.nombre} style={{ display: "grid", gridTemplateColumns: "minmax(90px, 34%) 1fr auto", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <span style={{ fontSize: 12.5, color: "var(--t-text,#f0e8ff)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.nombre}>{t.nombre}</span>
                <div style={{ height: 10, borderRadius: "0 4px 4px 0", background: "var(--t-accent,#a78bfa)", width: `${(t.n / maxTipo) * 100}%`, minWidth: 4 }} />
                <span style={{ fontSize: 12, color: "var(--t-text-muted,#b9b0d0)", textAlign: "right" }}>{t.n} · {Math.round((t.n / reparto.total) * 100)} %</span>
              </div>
            ))}
          </>
        )}
      </div>}
    </div>
  );
}
