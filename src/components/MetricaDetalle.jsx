// Detalle de una métrica: se abre al tocar su caja en el panel de salud.
//
// Periodo (7 / 30 / 90 días), gráfica con la media marcada, día más alto y
// más bajo, cobertura, tendencia y racha de la meta — y la posibilidad de
// preguntarle a Misi. Para eso, SOLO esta métrica y este periodo se envían a
// la IA de Misi (OpenAI, a través de la Edge Function misi-chat): se dice en
// pantalla antes de enviar nada.

import { useMemo, useState } from "react";
import { detalleMetrica, porSemanas, resumenParaIA } from "../lib/healthStats.js";
import { askMisi } from "../lib/misi.js";
import { humanDate } from "../lib/dateLabel.js";
import { Z } from "../lib/zLayers.js";

const dim = { fontSize: 11.5, color: "var(--t-text-dim,#8f84ad)", lineHeight: 1.5 };
const chip = activo => ({
  padding: "5px 11px", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
  background: activo ? "var(--t-accent-soft,rgba(167,139,250,0.18))" : "transparent",
  color: activo ? "var(--t-accent,#c4b8ff)" : "var(--t-text-muted,#b9b0d0)",
  border: `1px solid ${activo ? "rgba(167,139,250,0.5)" : "var(--t-card-border,rgba(167,139,250,0.2))"}`,
});
const PERIODOS = [7, 30, 90];

export default function MetricaDetalle({ def, filas, hoy, coupleId, personName, onCerrar }) {
  const [dias, setDias] = useState(30);
  const [sel, setSel] = useState(null);
  const [pregunta, setPregunta] = useState("");
  const [respuesta, setRespuesta] = useState(null);   // null | "pensando" | { texto } | { error }

  const d = useMemo(() => detalleMetrica(filas, def.metric, hoy, dias, { meta: def.meta, mejorSi: def.mejorSi }), [filas, def, hoy, dias]);
  // 90 días en barras diarias no se leen: se agrupan por semanas.
  const barras = useMemo(() => (dias > 30 ? porSemanas(d.serie) : d.serie), [d, dias]);
  const max = Math.max(1, ...barras.map(b => b.valor ?? 0));
  const f = v => def.formato(v);

  const preguntar = async texto => {
    const q = (texto ?? pregunta).trim();
    if (!q) return;
    setPregunta(q);
    setRespuesta("pensando");
    try {
      const txt = await askMisi({ coupleId, personName, message: resumenParaIA({ nombre: def.nombre, unidad: def.unidadLarga, dias, detalle: d, pregunta: q }) });
      setRespuesta({ texto: txt });
    } catch {
      setRespuesta({ error: "Misi no ha podido responder ahora. Prueba en un rato." });
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
          {PERIODOS.map(p => <button key={p} onClick={() => { setDias(p); setSel(null); }} style={chip(dias === p)}>{p} días</button>)}
        </div>

        {/* Gráfica: la media como línea fina de referencia; tocar una barra la lee */}
        <div style={{ position: "relative", height: 120, display: "flex", alignItems: "flex-end", gap: dias > 30 ? 4 : dias > 7 ? 2 : 6 }}>
          {d.media != null && (
            <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: `${(d.media / max) * 100}%`, borderTop: "1px solid var(--t-text-dim,#8f84ad)", opacity: 0.6 }}>
              <span style={{ position: "absolute", right: 0, top: -15, fontSize: 10, color: "var(--t-text-muted,#b9b0d0)" }}>media {f(d.media)}</span>
            </div>
          )}
          {barras.map(b => {
            const activa = sel?.dia === b.dia;
            return (
              <button key={b.dia} onClick={() => setSel(activa ? null : b)}
                aria-label={`${dias > 30 ? "Semana del " : ""}${humanDate(b.dia)}: ${b.valor == null ? "sin dato" : f(b.valor)}`}
                style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0, border: "none", background: "transparent", cursor: "pointer" }}>
                {b.valor == null
                  ? <span style={{ width: 4, height: 4, borderRadius: 2, background: "var(--t-text-dim,#8f84ad)", opacity: 0.6 }} />
                  : <span style={{ width: "100%", height: `${Math.max(3, (b.valor / max) * 100)}%`, borderRadius: "4px 4px 0 0",
                      background: "var(--t-accent,#a78bfa)", opacity: activa ? 1 : sel ? 0.35 : 0.75 }} />}
              </button>
            );
          })}
        </div>
        <div style={{ ...dim, marginTop: 6, minHeight: 18 }}>
          {sel ? <><b style={{ color: "var(--t-text,#f0e8ff)" }}>{dias > 30 ? "Semana del " : ""}{humanDate(sel.dia)}</b>: {sel.valor == null ? "sin dato" : `${f(sel.valor)}${dias > 30 ? " de media" : ""}`}</>
            : dias > 30 ? "Cada barra es la media de una semana. Toca una para verla." : "Toca una barra para ver ese día."}
        </div>

        {/* Los números */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "12px 0" }}>
          <Dato titulo="Media" valor={d.media == null ? "—" : f(d.media)} nota={`${d.conDato} de ${d.total} días con dato`} />
          <Dato titulo="Tendencia" valor={tend == null ? "—" : `${tend > 0 ? "↑" : tend < 0 ? "↓" : "→"} ${Math.abs(Math.round(tend * 100))} %`}
            nota="2.ª mitad del periodo vs 1.ª" color={tend == null || Math.abs(tend) < 0.02 ? null : (def.mejorSi === "baja" ? tend < 0 : tend > 0) ? "#34d399" : "#f87171"} />
          <Dato titulo={def.mejorSi === "baja" ? "Mejor día (más bajo)" : "Día más alto"} valor={d.mejor ? f(d.mejor.valor) : "—"} nota={d.mejor ? humanDate(d.mejor.dia) : ""} />
          <Dato titulo={def.mejorSi === "baja" ? "Día más alto" : "Día más bajo"} valor={d.peor ? f(d.peor.valor) : "—"} nota={d.peor ? humanDate(d.peor.dia) : ""} />
          {d.racha != null && <Dato titulo={`Racha ≥ ${f(def.meta)}`} valor={`${d.racha} ${d.racha === 1 ? "día" : "días"}`} nota="seguidos hasta hoy" />}
        </div>

        {/* Preguntarle a Misi */}
        <div style={{ borderTop: "1px solid var(--t-card-border,rgba(167,139,250,0.16))", paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t-text,#f0e8ff)", marginBottom: 6 }}>🤖 Pregúntale a Misi</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {def.sugerencias.map(s => <button key={s} onClick={() => preguntar(s)} style={{ ...chip(false), fontSize: 11.5 }}>{s}</button>)}
          </div>
          <form onSubmit={e => { e.preventDefault(); preguntar(); }} style={{ display: "flex", gap: 6 }}>
            <input value={pregunta} onChange={e => setPregunta(e.target.value.slice(0, 300))} placeholder={`Pregunta lo que quieras sobre ${def.nombre.toLowerCase()}…`}
              style={{ flex: 1, minWidth: 0, padding: "9px 12px", borderRadius: 10, fontSize: 14, fontFamily: "inherit",
                background: "var(--t-input-bg,rgba(128,128,128,0.1))", color: "var(--t-text,#f0e8ff)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.25))" }} />
            <button type="submit" disabled={respuesta === "pensando"} style={{ padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#a78bfa,#7c3aed)", opacity: respuesta === "pensando" ? 0.6 : 1 }}>
              {respuesta === "pensando" ? "…" : "Preguntar"}
            </button>
          </form>
          <div style={{ ...dim, marginTop: 6 }}>Se envían a la IA de Misi (OpenAI) tu pregunta y los valores diarios de {def.nombre.toLowerCase()} de estos {dias} días. Nada más.</div>
          {respuesta && respuesta !== "pensando" && (
            <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, background: "rgba(167,139,250,0.08)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.2))", fontSize: 13, color: respuesta.error ? "#fbbf24" : "var(--t-text,#f0e8ff)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {respuesta.error || respuesta.texto}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Dato({ titulo, valor, nota, color }) {
  return (
    <div style={{ padding: "8px 10px", borderRadius: 12, background: "rgba(167,139,250,0.06)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.14))" }}>
      <div style={{ fontSize: 10.5, color: "var(--t-text-dim,#8f84ad)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>{titulo}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || "var(--t-text,#f8f4ff)", marginTop: 2 }}>{valor}</div>
      {nota && <div style={{ fontSize: 11, color: "var(--t-text-muted,#b9b0d0)" }}>{nota}</div>}
    </div>
  );
}
