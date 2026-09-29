// "¿En qué estado habría estado mi mascota en cada época?"
//
// Simula la mascota desde el PRIMER día con datos y lo resume mes a mes con
// `lineaTemporal`. Es un "qué habría pasado": la mascota de verdad nace el día
// en que se adopta — y eso se dice en pantalla, para que nadie lo confunda.

import { useMemo, useState } from "react";
import { simular, lineaTemporal, ETAPAS } from "../lib/pet.js";
import { urlRetrato, nombreEspecie } from "../lib/petSprites.js";

const MESES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
// La racha del MES (hábitos), no el ánimo de la mascota: «triste» solo existe por
// falta de cariño. Los colores no usan el verde/rojo de estado a propósito.
const FONDO = {
  buena: "rgba(52,211,153,0.30)",
  regular: "rgba(167,139,250,0.16)",
  floja: "rgba(96,165,250,0.30)",
  "sin datos": "transparent",
};
const dim = { fontSize: 11.5, color: "var(--t-text-dim,#8f84ad)", lineHeight: 1.5 };

export default function VidaMascota({ filas, entrenos, manifest, especieInicial }) {
  const [especie, setEspecie] = useState(especieInicial || "broot");
  const [sel, setSel] = useState(null);

  const primerDia = useMemo(() => filas.reduce((m, f) => (!m || f.day < m ? f.day : m), null), [filas]);
  const sim = useMemo(() => primerDia ? simular({ nacimiento: primerDia, filas, entrenos }) : null, [primerDia, filas, entrenos]);
  const meses = useMemo(() => (sim ? lineaTemporal(sim) : []), [sim]);

  if (!sim) return <div style={dim}>No hay datos suficientes todavía.</div>;

  const porAño = new Map();
  for (const m of meses) {
    const [a, mm] = m.mes.split("-");
    if (!porAño.has(a)) porAño.set(a, Array(12).fill(null));
    porAño.get(a)[+mm - 1] = m;
  }
  const detalle = sel && meses.find(m => m.mes === sel);
  const nombreEtapa = id => ETAPAS.find(e => e.id === id)?.nombre || id;
  const src = etapa => urlRetrato(manifest, especie, etapa);

  return (
    <div>
      <div style={{ ...dim, marginBottom: 10 }}>
        Tu mascota nace el día que la adoptes. Esto es <b>cómo habría sido</b> si hubiera nacido el{" "}
        {primerDia.split("-").reverse().join("/")}, alimentándose de tus hábitos reales. Hoy estaría en{" "}
        <b style={{ color: "var(--t-accent,#c4b8ff)" }}>{nombreEtapa(sim.etapaId)}</b>.
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {Object.keys(manifest?.pets || {}).map(e => (
          <button key={e} onClick={() => setEspecie(e)} style={{
            flex: 1, padding: "6px 10px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: especie === e ? "var(--t-accent-soft,rgba(167,139,250,0.18))" : "transparent",
            color: especie === e ? "var(--t-accent,#c4b8ff)" : "var(--t-text-muted,#b9b0d0)",
            border: `1px solid ${especie === e ? "rgba(167,139,250,0.5)" : "var(--t-card-border,rgba(167,139,250,0.2))"}`,
          }}>
            {/* El icono de CADA botón es su especie, no la seleccionada. */}
            <img src={urlRetrato(manifest, e, "jr") || ""} alt="" draggable={false} style={{ width: 20, height: 20 }} />
            Con {nombreEspecie(manifest, e)}
          </button>
        ))}
      </div>

      {/* Cabecera de meses */}
      <div style={{ display: "grid", gridTemplateColumns: "34px repeat(12, 1fr)", gap: 3, marginBottom: 3 }}>
        <span />
        {MESES.map((m, i) => <span key={i} style={{ fontSize: 9.5, color: "var(--t-text-dim,#8f84ad)", textAlign: "center" }}>{m}</span>)}
      </div>

      {[...porAño.entries()].map(([año, fila]) => (
        <div key={año} style={{ display: "grid", gridTemplateColumns: "34px repeat(12, 1fr)", gap: 3, marginBottom: 3 }}>
          <span style={{ fontSize: 10.5, color: "var(--t-text-muted,#b9b0d0)", alignSelf: "center" }}>{año}</span>
          {fila.map((m, i) => {
            if (!m) return <span key={i} />;
            const sube = m.eventos.some(e => e.tipo === "evoluciona");
            const baja = m.eventos.some(e => e.tipo === "desevoluciona");
            return (
              <button key={i} onClick={() => setSel(sel === m.mes ? null : m.mes)}
                aria-label={`${MESES_LARGO[i]} ${año}: ${nombreEtapa(m.etapa)}, racha ${m.racha}`}
                style={{
                  position: "relative", aspectRatio: "1", padding: 0, cursor: "pointer", borderRadius: 6,
                  background: FONDO[m.racha],
                  border: sel === m.mes ? "1.5px solid var(--t-accent,#c4b8ff)"
                    : m.racha === "sin datos" ? "1px dashed rgba(167,139,250,0.25)" : "1px solid transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                {src(m.etapa) && <img src={src(m.etapa)} alt="" draggable={false} loading="lazy" style={{ width: "86%", height: "86%", objectFit: "contain" }} />}
                {(sube || baja) && (
                  <span style={{ position: "absolute", top: -3, right: -2, fontSize: 9, fontWeight: 800, color: sube ? "#34d399" : "#f87171" }}>
                    {sube ? "▲" : "▼"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
        {["buena", "regular", "floja", "sin datos"].map(a => (
          <span key={a} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, color: "var(--t-text-dim,#8f84ad)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: FONDO[a], border: a === "sin datos" ? "1px dashed rgba(167,139,250,0.4)" : "none" }} />
            {a}
          </span>
        ))}
        <span style={{ fontSize: 10.5, color: "#34d399" }}>▲ evoluciona</span>
        <span style={{ fontSize: 10.5, color: "#f87171" }}>▼ retrocede</span>
      </div>

      {detalle && (
        <div style={{ marginTop: 10, padding: "9px 11px", borderRadius: 10, background: "rgba(167,139,250,0.08)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.2))" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t-text,#f0e8ff)" }}>
            {MESES_LARGO[+detalle.mes.slice(5) - 1]} {detalle.mes.slice(0, 4)} · {nombreEtapa(detalle.etapa)}
          </div>
          <div style={dim}>
            {detalle.media == null ? "Sin datos este mes."
              : `Un mes de racha ${detalle.racha}: cumplió de media el ${Math.round(detalle.media * 100)} % de las metas diarias, con datos ${detalle.diasConDatos} días.`}
            {detalle.eventos.map((e, k) => (
              <span key={k}><br />{e.tipo === "evoluciona" ? "▲ Evolucionó" : "▼ Retrocedió"} a {nombreEtapa(e.a)} el {e.dia.split("-").reverse().join("/")}.</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
