// Sección «Estadísticas» del panel de Salud (01/10/2026: «mucha información y
// poca estadística»). Solo pinta: los números salen de src/lib/estadisticas.js,
// que solo enseña lo que pasa sus pruebas (días suficientes y diferencia clara).

import { useMemo, useState } from "react";
import { porDiaSemana, hallazgos, semanaEnElAno, regularidad } from "../lib/estadisticas.js";

const card = { background: "var(--t-card,#1d1733)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.16))", borderRadius: 16, padding: "12px 14px", minWidth: 0 };
const titulo = { fontSize: 12.5, fontWeight: 700, color: "var(--t-text,#f0e8ff)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 };
const sub = { fontSize: 11.5, fontWeight: 700, color: "var(--t-text-muted,#b9b0d0)", margin: "12px 0 6px", textTransform: "uppercase", letterSpacing: 0.6 };
const dim = { fontSize: 11, color: "var(--t-text-dim,#8f84ad)", lineHeight: 1.45 };
const txt = { fontSize: 12.5, color: "var(--t-text,#f0e8ff)", lineHeight: 1.45 };
const miles = n => Math.round(n).toLocaleString("es-ES");
const hm = h => { const H = Math.floor(h), M = Math.round((h - H) * 60); return M === 60 ? `${H + 1}h` : `${H}h ${String(M).padStart(2, "0")}m`; };

const PATRON = {
  step_count: { nombre: "Pasos", formato: miles },
  sleep_asleep: { nombre: "Sueño", formato: hm },
  active_energy: { nombre: "Energía", formato: v => `${miles(v)} kcal` },
};
const NOMBRE_SEMANA = { step_count: "Pasos", sleep_asleep: "Sueño", active_energy: "Energía activa", resting_heart_rate: "Pulso en reposo" };
const LETRA = ["L", "M", "X", "J", "V", "S", "D"];

function chip(activo) {
  return { padding: "8px 12px", minHeight: 36, borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
    background: activo ? "var(--t-accent-soft,rgba(167,139,250,0.18))" : "transparent",
    color: activo ? "var(--t-accent,#c4b8ff)" : "var(--t-text-muted,#b9b0d0)",
    border: `1px solid ${activo ? "rgba(167,139,250,0.5)" : "var(--t-card-border,rgba(167,139,250,0.2))"}` };
}

export default function SaludEstadisticas({ filas, entrenos, hoy, metaSueno = 7 }) {
  const [metrica, setMetrica] = useState("step_count");
  const semana = useMemo(() => porDiaSemana(filas, metrica, { hasta: hoy }), [filas, metrica, hoy]);
  const lista = useMemo(() => hallazgos({ filas, entrenos, hoy, metaSueno }), [filas, entrenos, hoy, metaSueno]);
  const enElAno = useMemo(() => semanaEnElAno(filas, hoy), [filas, hoy]);
  const reg = useMemo(() => regularidad(filas, "bed_min", hoy, 30), [filas, hoy]);
  const max = Math.max(1, ...semana.map(d => d.media || 0));
  const mejor = semana.reduce((a, d) => (d.media != null && (a == null || d.media > a.media) ? d : a), null);
  const fmt = PATRON[metrica].formato;

  return (
    <div style={card}>
      <div style={titulo}><span aria-hidden>📐</span>Estadísticas</div>

      {/* 1. Tu semana frente a tu año */}
      {enElAno.length > 0 && <>
        <div style={{ ...sub, marginTop: 0 }}>Tu última semana frente a tu año</div>
        {enElAno.map(x => (
          <div key={x.metric} style={{ padding: "5px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={txt}>{NOMBRE_SEMANA[x.metric]}</span>
              <span style={{ ...txt, fontWeight: 600 }}>{x.metric === "resting_heart_rate"
                ? `más bajo que el ${Math.round((1 - x.percentil) * 100)} %`
                : `mejor que el ${Math.round(x.percentil * 100)} %`}</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: "rgba(167,139,250,0.12)", marginTop: 4, position: "relative" }}
              role="img" aria-label={`Percentil ${Math.round(x.percentil * 100)}`}>
              <div style={{ position: "absolute", top: -3, left: `calc(${Math.round(x.percentil * 100)}% - 6px)`, width: 12, height: 12, borderRadius: 99, background: "var(--t-accent,#a78bfa)" }} />
            </div>
          </div>
        ))}
        <div style={{ ...dim, marginTop: 4 }}>Comparada con todas tus semanas de los últimos 12 meses (con datos).</div>
      </>}

      {/* 2. Por día de la semana */}
      <div style={sub}>Por día de la semana</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {Object.entries(PATRON).map(([m, p]) => <button key={m} onClick={() => setMetrica(m)} aria-pressed={metrica === m} style={chip(metrica === m)}>{p.nombre}</button>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, alignItems: "end", height: 96 }}
        role="img" aria-label={semana.map(d => `${d.nombre}: ${d.media == null ? "sin datos" : fmt(d.media)}`).join(", ")}>
        {semana.map(d => (
          <div key={d.dia} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 3 }}>
            <span style={{ fontSize: 9.5, color: "var(--t-text-muted,#b9b0d0)", whiteSpace: "nowrap" }}>{d.media == null ? "" : metrica === "step_count" ? `${(d.media / 1000).toFixed(1).replace(".", ",")}k` : metrica === "sleep_asleep" ? hm(d.media) : miles(d.media)}</span>
            <div style={{ width: "100%", maxWidth: 28, height: `${d.media == null ? 0 : Math.max(4, (d.media / max) * 62)}px`, borderRadius: "4px 4px 0 0",
              background: mejor && d.dia === mejor.dia ? "var(--t-accent,#a78bfa)" : "rgba(167,139,250,0.45)" }} />
            <span style={{ fontSize: 10.5, color: "var(--t-text-dim,#8f84ad)" }}>{LETRA[d.dia]}</span>
          </div>
        ))}
      </div>
      {mejor && <div style={{ ...dim, marginTop: 6 }}>Tu {mejor.nombre} es el día con más {PATRON[metrica].nombre.toLowerCase()}: {fmt(mejor.media)} de media ({mejor.n} {mejor.n === 1 ? "semana" : "semanas"}).</div>}

      {/* 3. Patrones que pasan la prueba */}
      <div style={sub}>Patrones en tus datos</div>
      {lista.length === 0
        ? <div style={dim}>Aún no hay ningún patrón claro: con los datos que hay, las diferencias podrían ser casualidad. Se irán viendo al acumular más días.</div>
        : lista.map(h => (
          <div key={h.id} style={{ padding: "7px 0", borderTop: "1px solid rgba(167,139,250,0.08)" }}>
            <div style={txt}><span aria-hidden style={{ marginRight: 6 }}>{h.icono}</span>{h.texto}</div>
            <div style={{ ...dim, marginTop: 2 }}>Comparando {h.detalle}. Es una relación en tus datos, no una causa demostrada.</div>
          </div>
        ))}

      {/* 4. Regularidad */}
      {reg.ahora != null && <>
        <div style={sub}>Regularidad</div>
        <div style={txt}>Te acuestas con una variación de ±{Math.round(reg.ahora)} min{reg.antes != null ? ` (el mes anterior, ±${Math.round(reg.antes)} min)` : ""}.</div>
        <div style={{ ...dim, marginTop: 2 }}>Últimos 30 días, {reg.n} noches. Cuanto más pequeña, más regular es tu horario.</div>
      </>}
    </div>
  );
}
