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
import { METRICAS } from "../lib/pet.js";
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
      <div style={{ display: "flex", gap: 2, marginTop: 3 }}>
        {serie.map((d, i) => (
          <span key={d.dia} style={{ flex: 1, textAlign: "center", fontSize: 9, color: i === serie.length - 1 ? "var(--t-text,#f0e8ff)" : "var(--t-text-dim,#8f84ad)", fontWeight: i === serie.length - 1 ? 700 : 400 }}>
            {letraDe(d.dia)}
          </span>
        ))}
      </div>
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
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
        {serie.map((d, i) => <span key={d.dia} style={{ fontSize: 9, color: i === serie.length - 1 ? "var(--t-text,#f0e8ff)" : "var(--t-text-dim,#8f84ad)", fontWeight: i === serie.length - 1 ? 700 : 400 }}>{letraDe(d.dia)}</span>)}
      </div>
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
        {k.delta == null ? `media de ${k.diasConDato} ${k.diasConDato === 1 ? "día" : "días"} con dato`
          : (
            <span style={{ color: k.bueno == null ? "var(--t-text-muted,#b9b0d0)" : k.bueno ? BUENO : MALO, fontWeight: 600 }}>
              {k.delta > 0 ? "↑" : k.delta < 0 ? "↓" : "→"} {formatoDelta(Math.abs(k.delta))}
              <span style={{ color: "var(--t-text-dim,#8f84ad)", fontWeight: 400 }}> vs. semana anterior</span>
            </span>
          )}
      </div>
      <Grafica serie={k.serie} formato={v => `${formato(v)}${unidad ? " " + unidad : ""}`} />
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

export default function SaludPanel({ filas, entrenos, metas, hoy, coupleId, personName, userId }) {
  const [abierta, setAbierta] = useState(null);
  const k = useMemo(() => ({
    sueno: kpi(filas, "sleep_asleep", hoy),
    pulso: kpi(filas, "resting_heart_rate", hoy, { mejorSi: "baja" }),
    pasos: kpi(filas, "step_count", hoy),
    kcal: kpi(filas, "active_energy", hoy),
  }), [filas, hoy]);
  const semana = useMemo(() => metasSemana(filas, entrenos, metas, hoy), [filas, entrenos, metas, hoy]);
  const reparto = useMemo(() => repartoEntrenos(entrenos, hoy, 90), [entrenos, hoy]);
  const noche = useMemo(() => ultimaNoche(filas, hoy), [filas, hoy]);
  const ultimo = useMemo(() => [...entrenos].sort((a, b) => (a.start_at < b.start_at ? 1 : -1))[0] || null, [entrenos]);
  const tipos = reparto.tipos.length > 5
    ? [...reparto.tipos.slice(0, 4), { nombre: "Otros", n: reparto.tipos.slice(4).reduce((a, t) => a + t.n, 0) }]
    : reparto.tipos;
  const maxTipo = Math.max(1, ...tipos.map(t => t.n));
  const metaDe = tipo => metas.find(m => m.tipo === tipo && m.periodo === "dia")?.objetivo ?? null;
  // Las preguntas sugeridas se pueden responder con los datos que se envían.
  const DEFS = {
    sueno: { metric: "sleep_asleep", nombre: "Sueño", icono: "🌙", unidadLarga: "horas por noche", formato: hm, meta: metaDe("sueno"), mejorSi: "sube",
      sugerencias: ["¿Duermo más los fines de semana?", "¿Mi sueño está mejorando?", "¿Qué noches fueron las peores?"] },
    pulso: { metric: "resting_heart_rate", nombre: "Pulso en reposo", icono: "❤️", unidadLarga: "latidos por minuto", formato: v => `${Math.round(v)} lpm`, meta: null, mejorSi: "baja",
      sugerencias: ["¿Mi pulso en reposo está bajando?", "¿Qué días lo tuve más alto?"] },
    pasos: { metric: "step_count", nombre: "Pasos", icono: "👟", unidadLarga: "pasos al día", formato: miles, meta: metaDe("pasos"), mejorSi: "sube",
      sugerencias: ["¿Qué día de la semana ando más?", "¿Cuántos días llegué a la meta?", "¿Voy mejorando?"] },
    kcal: { metric: "active_energy", nombre: "Energía activa", icono: "🔥", unidadLarga: "kcal al día", formato: v => `${miles(v)} kcal`, meta: null, mejorSi: "sube",
      sugerencias: ["¿Qué días me moví más?", "¿Estoy más activo que al principio?"] },
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* Metas de la semana */}
      <div style={card}>
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
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <Tile icono="🌙" nombre="Sueño" k={k.sueno} formato={hm} formatoDelta={d => `${Math.round(d * 60)} min`} onAbrir={() => setAbierta("sueno")} />
        <Tile icono="❤️" nombre="Pulso en reposo" k={k.pulso} formato={v => Math.round(v)} unidad="lpm" forma="linea" formatoDelta={d => `${Math.round(d)} lpm`} onAbrir={() => setAbierta("pulso")} />
        <Tile icono="👟" nombre="Pasos" k={k.pasos} formato={miles} unidad="al día" formatoDelta={d => miles(d)} onAbrir={() => setAbierta("pasos")} />
        <Tile icono="🔥" nombre="Energía activa" k={k.kcal} formato={miles} unidad="kcal/día" formatoDelta={d => `${miles(d)} kcal`} onAbrir={() => setAbierta("kcal")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
        {/* Última noche */}
        <div style={card}>
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
        </div>

        {/* Último entreno */}
        <div style={card}>
          <div style={titulo}><span aria-hidden>🏃</span>Último entreno</div>
          {!ultimo ? <div style={dim}>Aún no hay entrenos. Crea la automatización de Workouts en Health Auto Export.</div> : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t-text,#f8f4ff)" }}>{ultimo.name}</div>
              <div style={{ ...dim, marginBottom: 10 }}>{humanDate(String(ultimo.start_at).slice(0, 10))} · {String(ultimo.start_at).slice(11, 16)}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {[
                  ["⏱️", ultimo.minutes != null ? `${Math.round(ultimo.minutes)} min` : null, "Duración"],
                  ["🔥", ultimo.kcal != null ? `${miles(ultimo.kcal)} kcal` : null, "Energía"],
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
        </div>
      </div>

      {abierta && <MetricaDetalle def={DEFS[abierta]} filas={filas} hoy={hoy} coupleId={coupleId} personName={personName} userId={userId} onCerrar={() => setAbierta(null)} />}

      {/* Tipos de entreno */}
      <div style={card}>
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
      </div>
    </div>
  );
}
