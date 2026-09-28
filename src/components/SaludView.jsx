// Salud — pantalla de PRUEBA de la integración con Health Auto Export.
//
// Sirve para dos cosas antes de que exista la mascota de verdad:
//  1. Ver qué está llegando de cada uno, cuándo fue el último envío y qué
//     métricas trae de verdad cada iPhone. Con eso decidimos el panel de salud
//     sobre datos reales, no sobre lo que "debería" mandar la app.
//  2. Pasar el historial real por el motor de la mascota (`pet.js`) y ver qué
//     saldría: etapa, ánimo y POR QUÉ.

import { useCallback, useEffect, useMemo, useState } from "react";
import { cargarSalud, resumirPorPersona, NOMBRES_METRICA, formatoValor } from "../lib/healthApi.js";
import { simular, animo, ETAPAS, METAS_POR_DEFECTO, METRICAS, sumarDias, isoDia } from "../lib/pet.js";
import { humanDate } from "../lib/dateLabel.js";

const card = { background: "var(--t-card,#1d1733)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.16))", borderRadius: 14, padding: "12px 14px", marginBottom: 10 };
const titulo = { fontSize: 11, color: "var(--t-text-muted,#b9b0d0)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, marginBottom: 8 };
const dim = { fontSize: 11.5, color: "var(--t-text-dim,#8f84ad)", lineHeight: 1.5 };
const txt = { fontSize: 13, color: "var(--t-text,#f0e8ff)" };

function haceCuanto(iso) {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 2) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

export default function SaludView({ sessionUserId, personName, partnerName }) {
  const [estado, setEstado] = useState("cargando");   // cargando | listo
  const [datos, setDatos] = useState({ filas: [], entrenos: [], error: null });

  const cargar = useCallback(async () => {
    setEstado("cargando");
    setDatos(await cargarSalud({ dias: 120 }));
    setEstado("listo");
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const personas = useMemo(() => {
    const r = resumirPorPersona(datos.filas, datos.entrenos);
    // Tú primero, tu pareja después.
    return r.sort((a, b) => (b.userId === sessionUserId) - (a.userId === sessionUserId));
  }, [datos, sessionUserId]);

  return (
    <div style={{ padding: "12px 12px 120px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--t-text,#f8f4ff)", fontFamily: "'Fraunces',serif" }}>🩺 Salud</div>
          <div style={dim}>Prueba de la conexión con Health Auto Export</div>
        </div>
        <button onClick={cargar} disabled={estado === "cargando"} style={{
          padding: "7px 12px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
          color: "var(--t-accent,#c4b8ff)", background: "transparent", border: "1px solid var(--t-card-border,rgba(167,139,250,0.3))",
          opacity: estado === "cargando" ? 0.5 : 1,
        }}>{estado === "cargando" ? "Cargando…" : "↻ Recargar"}</button>
      </div>

      {estado === "cargando" ? <div style={card}><div style={dim}>Leyendo tus datos…</div></div>
        : datos.error === "sin_tablas" ? (
          <div style={card}>
            <div style={txt}>Las tablas de salud todavía no existen.</div>
            <div style={{ ...dim, marginTop: 6 }}>Falta el paso 1 de <b>docs/salud-health-auto-export.md</b>: ejecutar el SQL en Supabase.</div>
          </div>
        ) : datos.error === "red" ? (
          <div style={card}>
            <div style={txt}>No se ha podido conectar.</div>
            <div style={{ ...dim, marginTop: 6 }}>Comprueba la conexión y pulsa Recargar.</div>
          </div>
        ) : personas.length === 0 ? (
          <div style={card}>
            <div style={txt}>Todavía no ha llegado nada.</div>
            <div style={{ ...dim, marginTop: 6 }}>
              En Health Auto Export, entra en tu automatización y pulsa <b>Export Now</b> (o <i>Manual Export</i>).
              La respuesta debe decir <code>"ok": true</code>. Luego vuelve aquí y pulsa Recargar.
            </div>
          </div>
        ) : (
          <>
            {personas.map(p => (
              <Persona key={p.userId} p={p} nombre={p.userId === sessionUserId ? `${personName || "Tú"} (tú)` : (partnerName || "Tu pareja")} />
            ))}
            {personas.length === 1 && (
              <div style={card}>
                <div style={dim}>
                  Solo han llegado datos de <b>{personas[0].userId === sessionUserId ? "ti" : (partnerName || "tu pareja")}</b>.
                  Cuando {personas[0].userId === sessionUserId ? (partnerName || "tu pareja") : "tú"} haga su primer envío, aparecerá aquí.
                </div>
              </div>
            )}
          </>
        )}
    </div>
  );
}

function Persona({ p, nombre }) {
  const hoy = isoDia(new Date());
  const ultimos7 = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i - 6));
  const val = (dia, metric) => p.filas.find(f => f.day === dia && f.metric === metric)?.value;

  // Prueba del motor: "si tu mascota hubiera nacido el primer día con datos".
  const sim = useMemo(() => p.primerDia
    ? simular({ nacimiento: p.primerDia, filas: p.filas, entrenos: p.entrenos, hoy })
    : null, [p, hoy]);
  const an = sim ? animo(sim) : null;
  const evol = sim?.eventos.filter(e => e.tipo === "evoluciona").length || 0;
  const desevol = sim?.eventos.filter(e => e.tipo === "desevoluciona").length || 0;

  const fresco = p.ultimoEnvio && Date.now() - new Date(p.ultimoEnvio).getTime() < 3 * 3600e3;

  return (
    <>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ ...txt, fontSize: 15, fontWeight: 700 }}>{nombre}</div>
          <span style={{ fontSize: 11, fontWeight: 600, color: fresco ? "#34d399" : "#fbbf24" }}>
            {fresco ? "●" : "⚠"} último envío {haceCuanto(p.ultimoEnvio)}
          </span>
        </div>
        <div style={{ ...dim, marginTop: 4 }}>
          {p.numDias} {p.numDias === 1 ? "día" : "días"} con datos
          {p.primerDia ? ` · del ${humanDate(p.primerDia)} al ${humanDate(p.ultimoDia)}` : ""}
          {" · "}{p.entrenos.length} {p.entrenos.length === 1 ? "entreno" : "entrenos"}
        </div>
        {!fresco && p.ultimoEnvio && (
          <div style={{ ...dim, marginTop: 6, color: "#fbbf24" }}>
            Hace más de 3 horas que no llega nada. Si la automatización está cada hora, revisa que siga activa en Health Auto Export.
          </div>
        )}
      </div>

      <div style={card}>
        <div style={titulo}>Últimos 7 días</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr>
              {["", "Pasos", "Sueño", "Ejerc.", "kcal"].map(h => (
                <th key={h} style={{ fontSize: 10, color: "var(--t-text-dim,#8f84ad)", fontWeight: 700, textAlign: h ? "right" : "left", paddingBottom: 6 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ultimos7.map(d => {
              const pasos = val(d, "step_count"), sueno = val(d, "sleep_asleep"), ej = val(d, "apple_exercise_time"), kcal = val(d, "active_energy");
              const celda = (v, meta, fmt) => (
                <td style={{ fontSize: 12.5, textAlign: "right", padding: "5px 0",
                  color: v == null ? "var(--t-text-dim,#8f84ad)" : meta != null && v >= meta ? "#34d399" : "var(--t-text,#f0e8ff)" }}>
                  {v == null ? "·" : fmt(v)}
                </td>
              );
              return (
                <tr key={d} style={{ borderTop: "1px solid rgba(167,139,250,0.08)" }}>
                  <td style={{ fontSize: 12, color: "var(--t-text-muted,#b9b0d0)", padding: "5px 0" }}>{humanDate(d)}</td>
                  {celda(pasos, 8000, v => Math.round(v).toLocaleString("es-ES"))}
                  {celda(sueno, 7, v => formatoValor("sleep_asleep", v))}
                  {celda(ej, 30, v => `${Math.round(v)}′`)}
                  {celda(kcal, null, v => Math.round(v))}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ ...dim, marginTop: 8 }}>En verde, meta cumplida. Un punto (·) es que ese día no llegó el dato — no que fuera cero.</div>
      </div>

      {sim && (
        <div style={card}>
          <div style={titulo}>Prueba del motor de la mascota</div>
          <div style={{ ...dim, marginBottom: 8 }}>
            Si tu mascota hubiera nacido el {humanDate(p.primerDia)} con las metas por defecto
            ({METAS_POR_DEFECTO.map(m => `${METRICAS[m.tipo].nombre.toLowerCase()} ${m.objetivo.toLocaleString("es-ES")}${METRICAS[m.tipo].unidad ? " " + METRICAS[m.tipo].unidad : ""}/${m.periodo === "dia" ? "día" : "semana"}`).join(" · ")}):
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "baseline", flexWrap: "wrap" }}>
            <Dato n={ETAPAS[sim.etapa].nombre} label="etapa" destacado />
            <Dato n={Math.round(sim.xp)} label="vitalidad" />
            <Dato n={`${Math.round(sim.progreso * 100)}%`} label={ETAPAS[sim.etapa + 1] ? `hacia ${ETAPAS[sim.etapa + 1].nombre}` : "etapa final"} />
          </div>
          <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden", margin: "10px 0" }}>
            <div style={{ height: "100%", width: `${Math.max(2, sim.progreso * 100)}%`, background: "linear-gradient(90deg,#a78bfa,#34d399)" }} />
          </div>
          <div style={txt}>Ánimo ahora: <b>{an.animo}</b></div>
          <div style={{ ...dim, marginTop: 2 }}>{an.motivo}</div>
          <div style={{ ...dim, marginTop: 8 }}>
            En este tiempo habría evolucionado {evol} {evol === 1 ? "vez" : "veces"}
            {desevol ? ` y retrocedido ${desevol}` : ""}.
          </div>
        </div>
      )}

      <details style={card}>
        <summary style={{ ...titulo, marginBottom: 0, cursor: "pointer" }}>Todo lo que llega ({p.metricas.length} métricas)</summary>
        <div style={{ marginTop: 8 }}>
          {p.metricas.map(m => (
            <div key={m.metric} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", borderTop: "1px solid rgba(167,139,250,0.08)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: "var(--t-text,#f0e8ff)" }}>{NOMBRES_METRICA[m.metric] || m.metric}</div>
                <div style={{ fontSize: 10, color: "var(--t-text-dim,#8f84ad)" }}>{m.metric}{m.source ? ` · ${m.source}` : ""}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 12.5, color: "var(--t-text,#f0e8ff)" }}>{formatoValor(m.metric, m.value, m.unit)}</div>
                <div style={{ fontSize: 10, color: "var(--t-text-dim,#8f84ad)" }}>{humanDate(m.day)}</div>
              </div>
            </div>
          ))}
        </div>
      </details>
    </>
  );
}

function Dato({ n, label, destacado }) {
  return (
    <div>
      <div style={{ fontSize: destacado ? 20 : 16, fontWeight: 700, lineHeight: 1.1, color: destacado ? "var(--t-accent,#c4b8ff)" : "var(--t-text,#f8f4ff)" }}>{n}</div>
      <div style={{ fontSize: 10, color: "var(--t-text-dim,#8f84ad)" }}>{label}</div>
    </div>
  );
}
