// Hoja «Personalizar»: qué tarjetas ver y en qué orden, el periodo de las
// gráficas, qué secciones mostrar y las metas (diarias y semanal).
//
// Todo se edita en local y se aplica con «Guardar»: nada cambia a medias. Las
// metas nuevas rigen DESDE HOY (el pasado se sigue juzgando con las de
// entonces — ver metasEn en pet.js). Cada botón mide ≥44 px.

import { useState } from "react";
import { Z } from "../lib/zLayers.js";
import { TARJETAS, SECCIONES, PERIODOS_TARJETA, LIMITES_META, sanearPanel, moverTarjeta, acotarMeta, ORDEN_TARJETAS } from "../lib/saludPanel.js";
import { METRICAS } from "../lib/pet.js";

const dim = { fontSize: 11.5, color: "var(--t-text-dim,#8f84ad)", lineHeight: 1.45 };
const h = { fontSize: 11, color: "var(--t-text-muted,#b9b0d0)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, margin: "16px 0 8px" };
const boton = activo => ({
  minHeight: 44, minWidth: 44, padding: "0 14px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
  background: activo ? "var(--t-accent-soft,rgba(167,139,250,0.18))" : "transparent",
  color: activo ? "var(--t-accent,#c4b8ff)" : "var(--t-text-muted,#b9b0d0)",
  border: `1px solid ${activo ? "rgba(167,139,250,0.5)" : "var(--t-card-border,rgba(167,139,250,0.25))"}`,
});
const fila = { display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderTop: "1px solid rgba(167,139,250,0.08)" };

const etiquetaMeta = { pasos: "Pasos al día", sueno: "Sueño por noche (h)", ejercicio: "Ejercicio al día (min)", kcal: "Energía activa a la semana (kcal)" };

export default function SaludAjustes({ panel, metas, disponibles, onGuardar, onCerrar }) {
  const [cfg, setCfg] = useState(() => sanearPanel(panel));
  // Metas: solo las que el usuario tiene, con su valor actual.
  const [valores, setValores] = useState(() => Object.fromEntries(metas.map(m => [m.tipo, m.objetivo])));
  const [aviso, setAviso] = useState(null);

  // Ofrecer las tarjetas con datos + las ya elegidas (aunque hoy no tengan).
  const ofrecidas = ORDEN_TARJETAS.filter(id => disponibles.includes(id) || cfg.tarjetas.includes(id));
  const alternar = id => setCfg(c => {
    const en = c.tarjetas.includes(id);
    if (en && c.tarjetas.length === 1) { setAviso("Deja al menos una tarjeta."); return c; }
    setAviso(null);
    return { ...c, tarjetas: en ? c.tarjetas.filter(x => x !== id) : [...c.tarjetas, id] };
  });
  const paso = (tipo, sentido) => setValores(v => {
    const l = LIMITES_META[tipo];
    return { ...v, [tipo]: acotarMeta(tipo, (v[tipo] ?? l.min) + sentido * l.paso) };
  });
  const escribir = (tipo, texto) => setValores(v => ({ ...v, [tipo]: texto === "" ? "" : Number(texto.replace(",", ".")) }));

  const guardar = () => {
    const cambios = {};
    for (const m of metas) {
      const v = acotarMeta(m.tipo, valores[m.tipo]);
      if (v != null && v !== m.objetivo) cambios[m.tipo] = v;
    }
    onGuardar({ panel: sanearPanel(cfg), cambiosMetas: cambios });
  };

  return (
    <>
      <div onClick={onCerrar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: Z.SHEET }} />
      <div role="dialog" aria-label="Personalizar el panel de salud" style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: Z.SHEET + 1, maxHeight: "90vh", overflowY: "auto",
        background: "var(--t-card,#1d1733)", borderTop: "1px solid var(--t-card-border,rgba(167,139,250,0.3))",
        borderRadius: "18px 18px 0 0", padding: "14px 16px calc(24px + env(safe-area-inset-bottom))", maxWidth: 760, margin: "0 auto",
      }}>
        <div style={{ width: 32, height: 3, background: "rgba(128,128,128,0.3)", borderRadius: 99, margin: "0 auto 12px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--t-text,#f8f4ff)" }}>⚙️ Personalizar</div>
          <button onClick={onCerrar} aria-label="Cerrar" style={boton(false)}>✕</button>
        </div>

        <div style={h}>Tarjetas</div>
        <div style={dim}>Elige cuáles ver y en qué orden. Solo aparecen las métricas de las que llegan datos.</div>
        <div style={{ marginTop: 6 }}>
          {/* Primero las elegidas, en su orden; después las demás */}
          {[...cfg.tarjetas, ...ofrecidas.filter(id => !cfg.tarjetas.includes(id))].filter(id => ofrecidas.includes(id)).map(id => {
            const t = TARJETAS[id], en = cfg.tarjetas.includes(id), i = cfg.tarjetas.indexOf(id);
            return (
              <div key={id} style={fila}>
                <button onClick={() => alternar(id)} role="checkbox" aria-checked={en} aria-label={`${t.nombre}: ${en ? "visible" : "oculta"}`}
                  style={{ ...boton(en), flex: 1, textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>
                  <span aria-hidden>{en ? "☑" : "☐"}</span><span aria-hidden>{t.icono}</span>{t.nombre}
                </button>
                {en && <>
                  <button onClick={() => setCfg(c => ({ ...c, tarjetas: moverTarjeta(c.tarjetas, id, -1) }))} disabled={i === 0} aria-label={`Subir ${t.nombre}`} style={{ ...boton(false), opacity: i === 0 ? 0.35 : 1 }}>↑</button>
                  <button onClick={() => setCfg(c => ({ ...c, tarjetas: moverTarjeta(c.tarjetas, id, 1) }))} disabled={i === cfg.tarjetas.length - 1} aria-label={`Bajar ${t.nombre}`} style={{ ...boton(false), opacity: i === cfg.tarjetas.length - 1 ? 0.35 : 1 }}>↓</button>
                </>}
              </div>
            );
          })}
        </div>
        {aviso && <div style={{ ...dim, color: "#fbbf24", marginTop: 4 }}>{aviso}</div>}

        <div style={h}>Periodo de las gráficas</div>
        <div style={{ display: "flex", gap: 8 }}>
          {PERIODOS_TARJETA.map(p => <button key={p} onClick={() => setCfg(c => ({ ...c, dias: p }))} aria-pressed={cfg.dias === p} style={boton(cfg.dias === p)}>{p} días</button>)}
        </div>

        <div style={h}>Secciones</div>
        <div style={{ display: "grid", gap: 6 }}>
          {Object.entries(SECCIONES).map(([k, nombre]) => (
            <button key={k} role="checkbox" aria-checked={cfg.secciones[k]} onClick={() => setCfg(c => ({ ...c, secciones: { ...c.secciones, [k]: !c.secciones[k] } }))}
              style={{ ...boton(cfg.secciones[k]), textAlign: "left" }}>
              <span aria-hidden>{cfg.secciones[k] ? "☑" : "☐"}</span> {nombre}
            </button>
          ))}
        </div>

        <div style={h}>Metas</div>
        <div style={dim}>Las metas nuevas valen <b>desde hoy</b>: el pasado se sigue midiendo con las de entonces, así que tu mascota no retrocede por cambiar una meta.</div>
        <div style={{ marginTop: 6 }}>
          {metas.map(m => {
            const l = LIMITES_META[m.tipo];
            if (!l) return null;
            return (
              <div key={m.id} style={{ ...fila, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 150px", fontSize: 13, color: "var(--t-text,#f0e8ff)" }}>
                  {etiquetaMeta[m.tipo] || METRICAS[m.tipo]?.nombre || m.tipo}
                  <div style={dim}>{l.min.toLocaleString("es-ES")}–{l.max.toLocaleString("es-ES")}</div>
                </div>
                <button onClick={() => paso(m.tipo, -1)} aria-label={`Bajar ${METRICAS[m.tipo]?.nombre || m.tipo}`} style={boton(false)}>−</button>
                <input inputMode="decimal" value={valores[m.tipo] ?? ""} onChange={e => escribir(m.tipo, e.target.value)}
                  aria-label={etiquetaMeta[m.tipo] || m.tipo}
                  style={{ width: 84, minHeight: 44, textAlign: "center", borderRadius: 12, fontSize: 15, fontFamily: "inherit", fontWeight: 600,
                    background: "var(--t-input-bg,rgba(128,128,128,0.1))", color: "var(--t-text,#f0e8ff)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.25))" }} />
                <button onClick={() => paso(m.tipo, 1)} aria-label={`Subir ${METRICAS[m.tipo]?.nombre || m.tipo}`} style={boton(false)}>+</button>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button onClick={onCerrar} style={{ ...boton(false), flex: 1 }}>Cancelar</button>
          <button onClick={guardar} style={{ ...boton(true), flex: 2, color: "#fff", background: "linear-gradient(135deg,#a78bfa,#7c3aed)", border: "none" }}>Guardar</button>
        </div>
      </div>
    </>
  );
}
