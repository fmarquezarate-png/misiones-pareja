// Salud — la mascota primero, luego cómo va todo.
//
// Orden (pedido por Fran, 28/09/2026):
//   1. Tu mascota, VIVA: pasea, duerme y entrena a tu ritmo, reacciona si la
//      tocas. Si aún no tienes, la eliges aquí.
//   2. El panel: metas de la semana, sueño, pulso, pasos, energía, entrenos.
//   3. La vida de tu mascota: cómo habría estado en cada época del pasado.
//   4. Plegado al final, lo técnico: importar historial, conexión, métricas.
//
// Cada uno ve y cuida SU mascota, que come de SUS datos; la de la pareja se
// puede mirar (y acariciar), pero no configurar.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cargarSalud, cargarHistorialMotor, resumirPorPersona, NOMBRES_METRICA, formatoValor } from "../lib/healthApi.js";
import { simular, ETAPAS, METAS_POR_DEFECTO, isoDia, esSinDato } from "../lib/pet.js";
import { horarioSueno } from "../lib/petBehavior.js";
import { estadoDeDatos } from "../lib/petEstado.js";
import { urlRetrato, nombreEspecie, cargarManifest } from "../lib/petSprites.js";
import { humanDate } from "../lib/dateLabel.js";
import { modoPruebas, fijarModoPruebas } from "../lib/petConfig.js";
import Habitat from "./Habitat.jsx";
import SaludPanel from "./SaludPanel.jsx";
import SaludAjustes from "./SaludAjustes.jsx";
import MetricaDetalle from "./MetricaDetalle.jsx";
import { tarjetasDisponibles, nuevaVersionMetas } from "../lib/saludPanel.js";
import SaludImportar from "./SaludImportar.jsx";
import VidaMascota from "./VidaMascota.jsx";

const card = { background: "var(--t-card,#1d1733)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.16))", borderRadius: 16, padding: "12px 14px", marginBottom: 10 };
const titulo = { fontSize: 11, color: "var(--t-text-muted,#b9b0d0)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, marginBottom: 8 };
const dim = { fontSize: 11.5, color: "var(--t-text-dim,#8f84ad)", lineHeight: 1.5 };
const txt = { fontSize: 13, color: "var(--t-text,#f0e8ff)" };
const chip = activo => ({
  padding: "6px 12px", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
  background: activo ? "var(--t-accent-soft,rgba(167,139,250,0.18))" : "transparent",
  color: activo ? "var(--t-accent,#c4b8ff)" : "var(--t-text-muted,#b9b0d0)",
  border: `1px solid ${activo ? "rgba(167,139,250,0.5)" : "var(--t-card-border,rgba(167,139,250,0.2))"}`,
});

function haceCuanto(iso) {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 2) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}

export default function SaludView({ sessionUserId, coupleId, personName, partnerName, pets = {}, onGuardarMascota }) {
  const [estado, setEstado] = useState("cargando");   // cargando | listo — solo la PRIMERA carga bloquea la pantalla
  const [actualizando, setActualizando] = useState(false);
  const [datos, setDatos] = useState({ filas: [], entrenos: [], error: null });
  const [manifest, setManifest] = useState(null);
  const [errorManifest, setErrorManifest] = useState(false);
  const [quien, setQuien] = useState("yo");            // yo | pareja
  const [historia, setHistoria] = useState(null);
  const [ajustes, setAjustes] = useState(false);
  const [metricaAbierta, setMetricaAbierta] = useState(null);   // { metric, unit } desde «Datos y conexión»
  const [pruebas, setPruebas] = useState(() => modoPruebas());

  // Cuántos días hay que pedir: los 120 de siempre, o desde que nació la
  // mascota más antigua si es anterior (antes se pedían siempre 120 y una
  // mascota de 6 meses se simulaba con la mitad de su vida: otra etapa, otra
  // racha). El servidor pagina, así que no hay tope de filas.
  const nacimientoMin = useMemo(() => Object.values(pets).map(p => p?.nacimiento).filter(Boolean).sort()[0] || null, [pets]);
  const dias = useMemo(() => {
    if (!nacimientoMin) return 120;
    const desde = Math.max(0, Math.round((Date.now() - new Date(nacimientoMin + "T00:00:00").getTime()) / 864e5)) + 14;
    return Math.min(1900, Math.max(120, desde));
  }, [nacimientoMin]);
  const diasRef = useRef(dias);
  diasRef.current = dias;

  // Recarga SIN desmontar nada: los datos buenos se quedan en pantalla mientras
  // llegan los nuevos, y si la red falla se conservan (antes un fallo los
  // reemplazaba por «vacío»: la mascota renacía como huevo y el panel se
  // quedaba sin datos). Solo la primera carga muestra «Despertando…».
  const cargar = useCallback(async () => {
    setActualizando(true);
    const d = await cargarSalud({ dias: diasRef.current });
    setDatos(prev => (d.error && (prev.filas.length || prev.entrenos.length)
      ? { ...prev, error: d.error, obsoleto: true }
      : { ...d, obsoleto: false }));
    setEstado("listo");
    setActualizando(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  // El manifest va aparte y con tiempo límite: si falla, se dice y se puede
  // reintentar; no bloquea los datos (ni al revés).
  const traerManifest = useCallback(() => {
    setErrorManifest(false);
    cargarManifest().then(setManifest).catch(() => setErrorManifest(true));
  }, []);
  useEffect(() => { traerManifest(); }, [traerManifest]);

  // Datos frescos sin tocar nada: al volver a la app y cada 5 minutos con ella abierta.
  useEffect(() => {
    const alVolver = () => { if (!document.hidden) cargar(); };
    document.addEventListener("visibilitychange", alVolver);
    const id = setInterval(() => { if (!document.hidden) cargar(); }, 5 * 60e3);
    return () => { document.removeEventListener("visibilitychange", alVolver); clearInterval(id); };
  }, [cargar]);

  const verHistoria = useCallback(async () => {
    setHistoria("cargando");
    setHistoria(await cargarHistorialMotor());
  }, []);

  const personas = useMemo(() => resumirPorPersona(datos.filas, datos.entrenos), [datos]);
  // La pareja: quien tenga datos o mascota y no sea yo.
  const parejaId = useMemo(() =>
    personas.find(p => p.userId !== sessionUserId)?.userId
    || Object.keys(pets).find(id => id !== sessionUserId) || null, [personas, pets, sessionUserId]);

  const uid = quien === "yo" ? sessionUserId : parejaId;
  const nombre = quien === "yo" ? (personName || "Tú") : (partnerName || "Tu pareja");
  const filas = useMemo(() => datos.filas.filter(f => f.user_id === uid), [datos, uid]);
  const entrenos = useMemo(() => datos.entrenos.filter(w => w.user_id === uid), [datos, uid]);
  const pet = uid ? pets[uid] : null;
  const hoy = isoDia(new Date());

  if (estado === "cargando") return <Marco><div style={card}><div style={dim}>Despertando a tu mascota…</div></div></Marco>;
  if (datos.error === "sin_tablas") return <Marco><div style={card}><div style={txt}>Las tablas de salud todavía no existen.</div><div style={{ ...dim, marginTop: 6 }}>Falta el paso 1 de docs/salud-health-auto-export.md.</div></div></Marco>;

  return (
    <Marco onRecargar={cargar} actualizando={actualizando}>
      {parejaId && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button onClick={() => setQuien("yo")} style={chip(quien === "yo")}>{personName || "Tú"}</button>
          <button onClick={() => setQuien("pareja")} style={chip(quien === "pareja")}>{partnerName || "Tu pareja"}</button>
        </div>
      )}
      {datos.error === "red" && <div style={{ ...card, ...dim }}>No se ha podido conectar{datos.obsoleto ? ": lo que ves es lo último que llegó" : ""}. Se reintentará solo.</div>}

      {/* 1. La mascota */}
      {!manifest ? (errorManifest
          ? <div style={card}><div style={dim}>No se han podido cargar los dibujos de tu mascota.</div>
              <button onClick={traerManifest} style={{ ...chip(false), marginTop: 8, minHeight: 44 }}>Reintentar</button></div>
          : <div style={card}><div style={dim}>Despertando a tu mascota…</div></div>)
        : pet ? <Mascota uid={uid} pet={pet} filas={filas} entrenos={entrenos} manifest={manifest} hoy={hoy} esMia={quien === "yo"} nombreDueño={nombre} pruebas={pruebas}
            onCambiarEspecie={quien === "yo" ? e => onGuardarMascota?.(sessionUserId, { especie: e }) : null} />
        : quien === "yo" ? <Adoptar manifest={manifest} onAdoptar={p => onGuardarMascota?.(sessionUserId, p)} />
        : <div style={card}><div style={dim}>{nombre} todavía no ha elegido su mascota.</div></div>}

      {/* 2. El panel */}
      {filas.length || entrenos.length
        ? <SaludPanel filas={filas} entrenos={entrenos} metas={pet?.metas || METAS_POR_DEFECTO} hoy={hoy} coupleId={coupleId} personName={personName} userId={uid}
            panel={pet?.panel} puedePreguntar={quien === "yo"} onPersonalizar={quien === "yo" && pet ? () => setAjustes(true) : null} />
        : <div style={card}><div style={txt}>Todavía no ha llegado ningún dato de {nombre}.</div>
            <div style={{ ...dim, marginTop: 6 }}>En Health Auto Export, pulsa <b>Export Now</b> en la automatización y vuelve aquí.</div></div>}

      {ajustes && pet && (
        <SaludAjustes panel={pet.panel} metas={pet.metas || METAS_POR_DEFECTO} disponibles={tarjetasDisponibles(filas)}
          onCerrar={() => setAjustes(false)}
          onGuardar={({ panel, cambiosMetas }) => {
            // Un solo parche: se fusiona en el estado fresco (ver App.jsx).
            const parche = { panel };
            if (Object.keys(cambiosMetas).length) Object.assign(parche, nuevaVersionMetas(pet, cambiosMetas, hoy));
            onGuardarMascota?.(sessionUserId, parche);
            setAjustes(false);
          }} />
      )}

      {metricaAbierta && (
        <MetricaDetalle def={defGenerica(metricaAbierta.metric, metricaAbierta.unit)} filas={filas} hoy={hoy} coupleId={coupleId}
          personName={personName} userId={uid} puedePreguntar={quien === "yo"} onCerrar={() => setMetricaAbierta(null)} />
      )}

      {/* 3. La vida de la mascota */}
      <div style={{ ...card, marginTop: 10 }}>
        <div style={titulo}>La vida de {quien === "yo" ? "tu" : "su"} mascota</div>
        {historia === null ? (
          <>
            <div style={{ ...dim, marginBottom: 8 }}>¿En qué estado habría estado en cada época del pasado, según los hábitos reales?</div>
            <button onClick={verHistoria} style={chip(false)}>Ver su historia</button>
          </>
        ) : historia === "cargando" ? <div style={dim}>Cargando todo el historial…</div>
          : historia.error ? <div style={dim}>No se pudo cargar el historial.</div>
          : <VidaMascota filas={historia.filas.filter(f => f.user_id === uid)} entrenos={historia.entrenos.filter(w => w.user_id === uid)} manifest={manifest} especieInicial={pet?.especie} />}
      </div>

      {/* 4. Lo técnico, plegado */}
      <details style={card}>
        <summary style={{ ...titulo, marginBottom: 0, cursor: "pointer" }}>Datos y conexión</summary>
        <div style={{ marginTop: 10 }}>
          {quien === "yo" && <SaludImportar personName={personName} onTerminado={() => { cargar(); setHistoria(null); }} />}
          <Conexion p={personas.find(x => x.userId === uid)} onAbrir={m => setMetricaAbierta(m)} />
          {quien === "yo" && pet && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, ...dim, minHeight: 44 }}>
              <input type="checkbox" checked={pruebas} onChange={e => { fijarModoPruebas(e.target.checked); setPruebas(e.target.checked); }} style={{ width: 20, height: 20 }} />
              Modo pruebas: ver cómo luce cada etapa y cambiar de especie (solo en este dispositivo; no cambia tu mascota real)
            </label>
          )}
        </div>
      </details>
    </Marco>
  );
}

function Marco({ children, onRecargar, actualizando = false }) {
  return (
    <div style={{ padding: "12px 12px 120px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--t-text,#f8f4ff)", fontFamily: "'Fraunces',serif" }}>🩺 Salud</div>
        {onRecargar && <button onClick={onRecargar} disabled={actualizando} style={{ ...chip(false), minHeight: 44, opacity: actualizando ? 0.6 : 1 }}>{actualizando ? "Actualizando…" : "↻ Recargar"}</button>}
      </div>
      {children}
    </div>
  );
}

// ── La mascota: cabecera + hábitat ──────────────────────────────────────────
function Mascota({ uid, pet, filas, entrenos, manifest, hoy, esMia, nombreDueño, onCambiarEspecie, pruebas }) {
  const [vista, setVista] = useState(null);    // vista previa de otra etapa (no se guarda)
  const sim = useMemo(() => simular({ nacimiento: pet.nacimiento, filas, entrenos, metas: pet.metas || METAS_POR_DEFECTO, metasHistorial: pet.metasHistorial, hoy }), [pet, filas, entrenos, hoy]);
  const horario = useMemo(() => horarioSueno(filas, hoy), [filas, hoy]);
  const datosEstado = useMemo(() => estadoDeDatos({ filas, sim, hoy }), [filas, sim, hoy]);
  const etapa = (pruebas && vista) || sim.etapaId;
  const sig = ETAPAS[sim.etapa + 1];
  const ultimoCambio = sim.eventos[sim.eventos.length - 1] || null;

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--t-text,#f8f4ff)" }}>
            {pet.nombre || nombreEspecie(manifest, pet.especie)}
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t-accent,#c4b8ff)", marginLeft: 8 }}>{ETAPAS[sim.etapa].nombre}</span>
          </div>
          <div style={dim}>{esMia ? "Tu" : `La de ${nombreDueño}:`} {nombreEspecie(manifest, pet.especie)} · nació {humanDate(pet.nacimiento)}</div>
        </div>
      </div>
      <Habitat key={uid} userId={uid} manifest={manifest} especie={pet.especie} etapa={etapa} horario={horario}
        entrenos={entrenos} nombre={pet.nombre} estado={datosEstado} />
      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--t-text-muted,#b9b0d0)", marginBottom: 4 }}>
          <span>{sig ? `Hacia ${sig.nombre}` : "Forma final"}</span>
          <span>{Math.round(sim.progreso * 100)} %</span>
        </div>
        <div style={{ height: 6, borderRadius: 99, background: "var(--t-accent-soft,rgba(167,139,250,0.16))", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.max(3, sim.progreso * 100)}%`, borderRadius: 99, background: "var(--t-accent,#a78bfa)" }} />
        </div>
      </div>
      {ultimoCambio && (
        <div style={{ ...dim, marginTop: 8 }}>
          {ultimoCambio.tipo === "evoluciona" ? "▲ Evolucionó" : "▼ Se encogió"} a {ETAPAS.find(e => e.id === ultimoCambio.a)?.nombre} el {humanDate(ultimoCambio.dia)}.
        </div>
      )}
      {/* Vista previa (solo en modo pruebas): ver cada etapa sin tocar la real. */}
      {pruebas && <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
        <span style={{ ...dim, marginRight: 2 }}>Vista previa:</span>
        {ETAPAS.map(e => (
          <button key={e.id} onClick={() => setVista(e.id === sim.etapaId ? null : e.id)} style={{ ...chip(etapa === e.id), padding: "4px 9px", fontSize: 11 }}>
            {e.nombre}{e.id === sim.etapaId ? " ·" : ""}
          </button>
        ))}
      </div>}
      {pruebas && vista && <div style={{ ...dim, marginTop: 6 }}>Estás viendo cómo será en {ETAPAS.find(e => e.id === vista).nombre}. Su etapa real es {ETAPAS[sim.etapa].nombre}.</div>}
      {/* Fase de pruebas: cambiar de especie sin perder nada (misma fecha de
          nacimiento, mismas metas). Solo la dueña o el dueño. */}
      {pruebas && onCambiarEspecie && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
          <span style={{ ...dim, marginRight: 2 }}>Especie (pruebas):</span>
          {Object.keys(manifest.pets).map(e => (
            <button key={e} onClick={() => e !== pet.especie && onCambiarEspecie(e)} style={{ ...chip(pet.especie === e), padding: "4px 9px", fontSize: 11 }}>
              {nombreEspecie(manifest, e)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Adoptar ─────────────────────────────────────────────────────────────────
function Adoptar({ manifest, onAdoptar }) {
  const [especie, setEspecie] = useState(null);
  const [nombre, setNombre] = useState("");
  const especies = Object.keys(manifest?.pets || {});
  return (
    <div style={card}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--t-text,#f8f4ff)", marginBottom: 4 }}>Elige tu mascota</div>
      <div style={{ ...dim, marginBottom: 12 }}>Nace hoy, en su huevo, y crece con tus hábitos: dormir, moverte y entrenar. Solo come de tus datos.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {especies.map(e => (
          <button key={e} onClick={() => setEspecie(e)} style={{
            padding: "12px 8px", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "center",
            background: especie === e ? "var(--t-accent-soft,rgba(167,139,250,0.18))" : "transparent",
            border: `1.5px solid ${especie === e ? "var(--t-accent,#a78bfa)" : "var(--t-card-border,rgba(167,139,250,0.2))"}`,
          }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
              {["huevo", "jr", "upf"].map(et => urlRetrato(manifest, e, et) && (
                <img key={et} src={urlRetrato(manifest, e, et)} alt="" draggable={false} style={{ width: et === "upf" ? 56 : 40, height: et === "upf" ? 56 : 40, alignSelf: "flex-end" }} />
              ))}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t-text,#f0e8ff)", marginTop: 6 }}>{nombreEspecie(manifest, e)}</div>
          </button>
        ))}
      </div>
      {especie && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={nombre} onChange={e => setNombre(e.target.value.slice(0, 20))} placeholder={`Nombre (opcional, p. ej. ${nombreEspecie(manifest, especie)})`}
            style={{ flex: 1, minWidth: 160, padding: "9px 12px", borderRadius: 10, fontSize: 14, fontFamily: "inherit",
              background: "var(--t-input-bg,rgba(128,128,128,0.1))", color: "var(--t-text,#f0e8ff)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.25))" }} />
          <button onClick={() => onAdoptar({ especie, nombre: nombre.trim() || null, nacimiento: isoDia(new Date()), metas: METAS_POR_DEFECTO })}
            style={{ padding: "9px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#a78bfa,#7c3aed)" }}>
            Adoptar 🥚
          </button>
        </div>
      )}
    </div>
  );
}

// Detalle de CUALQUIER métrica que llegue (no solo las cuatro del panel): la vista
// «Todo», los extremos y las preguntas a Misi funcionan igual para todas.
function defGenerica(metric, unit) {
  const nombre = NOMBRES_METRICA[metric] || metric;
  return {
    metric, nombre, icono: "📈", unidadLarga: unit && unit !== "count" ? unit : nombre.toLowerCase(),
    formato: v => formatoValor(metric, v, unit), meta: null, mejorSi: "neutral",
    sugerencias: ["¿Cómo ha cambiado con el tiempo?", "¿Cuándo tuve el valor más alto y el más bajo?"],
  };
}

// ── Conexión: qué llega y qué no ────────────────────────────────────────────
// Health Auto Export solo puede mandar lo que HAY en Apple Salud. Aquí se ve, métrica
// por métrica, qué está llegando (con cuántos días y desde cuándo; tócala para ver todo
// su historial) y qué métricas conocidas no llegan.
function Conexion({ p, onAbrir }) {
  if (!p) return <div style={dim}>Todavía no ha llegado nada.</div>;
  const fresco = p.ultimoEnvio && Date.now() - new Date(p.ultimoEnvio).getTime() < 3 * 3600e3;
  const resumen = new Map();
  for (const f of p.filas) {
    const r = resumen.get(f.metric) || { dias: new Set(), desde: f.day };
    r.dias.add(f.day); if (f.day < r.desde) r.desde = f.day;
    resumen.set(f.metric, r);
  }
  // distance_walking_running es el mismo dato con otro nombre; las fases del sueño (sleep_*) dependen del reloj.
  const noLlegan = Object.keys(NOMBRES_METRICA).filter(m => !resumen.has(m) && !m.startsWith("sleep_") && m !== "distance_walking_running");
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: fresco ? "#34d399" : "#fbbf24" }}>{fresco ? "●" : "⚠"} Último envío {haceCuanto(p.ultimoEnvio)}</div>
      <div style={{ ...dim, marginBottom: 8 }}>{p.numDias} días con datos · {p.entrenos.length} entrenos · <b>toca una métrica para ver todo su historial</b></div>
      {p.metricas.map(m => {
        const r = resumen.get(m.metric);
        return (
          <button key={m.metric} onClick={() => onAbrir?.({ metric: m.metric, unit: m.unit })}
            aria-label={`${NOMBRES_METRICA[m.metric] || m.metric}: ver historial`}
            style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 0", minHeight: 44, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
              background: "transparent", border: "none", borderTop: "1px solid rgba(167,139,250,0.08)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: "var(--t-text,#f0e8ff)" }}>{NOMBRES_METRICA[m.metric] || m.metric} <span aria-hidden style={{ color: "var(--t-text-dim,#8f84ad)" }}>›</span></div>
              <div style={{ fontSize: 10, color: "var(--t-text-dim,#8f84ad)" }}>{r ? `${r.dias.size} días con dato desde ${humanDate(r.desde)}` : ""}{m.source ? ` · ${m.source}` : ""}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 12.5, color: esSinDato(m.metric, m.value) ? "#fbbf24" : "var(--t-text,#f0e8ff)" }}>
                {esSinDato(m.metric, m.value) ? "sin dato" : formatoValor(m.metric, m.value, m.unit)}
              </div>
              <div style={{ fontSize: 10, color: "var(--t-text-dim,#8f84ad)" }}>último: {humanDate(m.day)}</div>
            </div>
          </button>
        );
      })}

      <div style={{ ...titulo, marginTop: 14 }}>Lo que NO está llegando</div>
      <div style={{ ...dim, marginBottom: 6 }}>
        Health Auto Export solo manda lo que existe en la app <b>Salud</b> del iPhone. Si tu reloj guarda algo en su propia app y no lo comparte con Salud, aquí no puede aparecer.
      </div>
      {noLlegan.length ? <div style={dim}>{noLlegan.map(m => NOMBRES_METRICA[m]).join(" · ")}</div> : <div style={dim}>Llega todo lo que la app conoce.</div>}
      <div style={{ ...dim, marginTop: 10, padding: "8px 10px", borderRadius: 10, background: "rgba(167,139,250,0.08)" }}>
        <b>¿Y el estrés?</b> Apple Salud no tiene una medida de «estrés» propia: la que da tu reloj se queda en su app (Huawei Health, Zepp…). Lo más parecido que sí pasa a Salud es la <b>variabilidad cardiaca</b> (HRV){resumen.has("heart_rate_variability") ? ", que ya te está llegando" : ", que ahora mismo no llega"} y los <b>minutos de mindfulness</b>{resumen.has("mindful_minutes") ? ", que también llegan" : ""}. Para saber si un dato de tu reloj llega a Salud: abre la app Salud del iPhone → Explorar → busca la medida; si no está ahí, no puede llegar aquí.
      </div>
    </div>
  );
}
