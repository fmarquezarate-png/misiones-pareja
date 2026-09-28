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

import { useCallback, useEffect, useMemo, useState } from "react";
import { cargarSalud, cargarHistorialMotor, resumirPorPersona, NOMBRES_METRICA, formatoValor } from "../lib/healthApi.js";
import { simular, ETAPAS, METAS_POR_DEFECTO, isoDia, esSinDato } from "../lib/pet.js";
import { horarioSueno } from "../lib/petBehavior.js";
import { retrato, nombreEspecie } from "../lib/petSprites.js";
import { humanDate } from "../lib/dateLabel.js";
import Habitat from "./Habitat.jsx";
import SaludPanel from "./SaludPanel.jsx";
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

export default function SaludView({ sessionUserId, personName, partnerName, pets = {}, onGuardarMascota }) {
  const [estado, setEstado] = useState("cargando");
  const [datos, setDatos] = useState({ filas: [], entrenos: [], error: null });
  const [manifest, setManifest] = useState(null);
  const [quien, setQuien] = useState("yo");            // yo | pareja
  const [historia, setHistoria] = useState(null);

  const cargar = useCallback(async () => {
    setEstado("cargando");
    const [d, m] = await Promise.all([
      cargarSalud({ dias: 120 }),
      fetch("/mascotas/manifest.json").then(r => r.json()).catch(() => null),
    ]);
    setDatos(d); setManifest(m); setEstado("listo");
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

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
    <Marco onRecargar={cargar}>
      {parejaId && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button onClick={() => setQuien("yo")} style={chip(quien === "yo")}>{personName || "Tú"}</button>
          <button onClick={() => setQuien("pareja")} style={chip(quien === "pareja")}>{partnerName || "Tu pareja"}</button>
        </div>
      )}
      {datos.error === "red" && <div style={{ ...card, ...dim }}>No se ha podido conectar. Lo que ves puede estar desactualizado.</div>}

      {/* 1. La mascota */}
      {!manifest ? null
        : pet ? <Mascota uid={uid} pet={pet} filas={filas} entrenos={entrenos} manifest={manifest} hoy={hoy} esMia={quien === "yo"} nombreDueño={nombre} />
        : quien === "yo" ? <Adoptar manifest={manifest} onAdoptar={p => onGuardarMascota?.(sessionUserId, p)} />
        : <div style={card}><div style={dim}>{nombre} todavía no ha elegido su mascota.</div></div>}

      {/* 2. El panel */}
      {filas.length || entrenos.length
        ? <SaludPanel filas={filas} entrenos={entrenos} metas={pet?.metas || METAS_POR_DEFECTO} hoy={hoy} />
        : <div style={card}><div style={txt}>Todavía no ha llegado ningún dato de {nombre}.</div>
            <div style={{ ...dim, marginTop: 6 }}>En Health Auto Export, pulsa <b>Export Now</b> en la automatización y vuelve aquí.</div></div>}

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
          <Conexion p={personas.find(x => x.userId === uid)} />
        </div>
      </details>
    </Marco>
  );
}

function Marco({ children, onRecargar }) {
  return (
    <div style={{ padding: "12px 12px 120px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--t-text,#f8f4ff)", fontFamily: "'Fraunces',serif" }}>🩺 Salud</div>
        {onRecargar && <button onClick={onRecargar} style={chip(false)}>↻ Recargar</button>}
      </div>
      {children}
    </div>
  );
}

// ── La mascota: cabecera + hábitat ──────────────────────────────────────────
function Mascota({ uid, pet, filas, entrenos, manifest, hoy, esMia, nombreDueño }) {
  const [vista, setVista] = useState(null);    // vista previa de otra etapa (no se guarda)
  const sim = useMemo(() => simular({ nacimiento: pet.nacimiento, filas, entrenos, metas: pet.metas || METAS_POR_DEFECTO, hoy }), [pet, filas, entrenos, hoy]);
  const horario = useMemo(() => horarioSueno(filas, hoy), [filas, hoy]);
  const etapa = vista || sim.etapaId;
  const sig = ETAPAS[sim.etapa + 1];

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
      <Habitat userId={uid} manifest={manifest} especie={pet.especie} etapa={etapa} horario={horario}
        entrenos={entrenos} nombre={pet.nombre} />
      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--t-text-muted,#b9b0d0)", marginBottom: 4 }}>
          <span>{sig ? `Hacia ${sig.nombre}` : "Forma final"}</span>
          <span>{Math.round(sim.progreso * 100)} %</span>
        </div>
        <div style={{ height: 6, borderRadius: 99, background: "var(--t-accent-soft,rgba(167,139,250,0.16))", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.max(3, sim.progreso * 100)}%`, borderRadius: 99, background: "var(--t-accent,#a78bfa)" }} />
        </div>
      </div>
      {/* Vista previa: para ver cómo será, sin tocar la etapa real. */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
        <span style={{ ...dim, marginRight: 2 }}>Vista previa:</span>
        {ETAPAS.map(e => (
          <button key={e.id} onClick={() => setVista(e.id === sim.etapaId ? null : e.id)} style={{ ...chip(etapa === e.id), padding: "4px 9px", fontSize: 11 }}>
            {e.nombre}{e.id === sim.etapaId ? " ·" : ""}
          </button>
        ))}
      </div>
      {vista && <div style={{ ...dim, marginTop: 6 }}>Estás viendo cómo será en {ETAPAS.find(e => e.id === vista).nombre}. Su etapa real es {ETAPAS[sim.etapa].nombre}.</div>}
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
              {["huevo", "jr", "upf"].map(et => retrato(manifest, e, et) && (
                <img key={et} src={`/mascotas/${retrato(manifest, e, et)}`} alt="" draggable={false} style={{ width: et === "upf" ? 56 : 40, height: et === "upf" ? 56 : 40, alignSelf: "flex-end" }} />
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

// ── Conexión: último envío y todo lo que llega ──────────────────────────────
function Conexion({ p }) {
  if (!p) return <div style={dim}>Todavía no ha llegado nada.</div>;
  const fresco = p.ultimoEnvio && Date.now() - new Date(p.ultimoEnvio).getTime() < 3 * 3600e3;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: fresco ? "#34d399" : "#fbbf24" }}>{fresco ? "●" : "⚠"} Último envío {haceCuanto(p.ultimoEnvio)}</div>
      <div style={{ ...dim, marginBottom: 8 }}>{p.numDias} días con datos en los últimos 120 · {p.entrenos.length} entrenos</div>
      {p.metricas.map(m => (
        <div key={m.metric} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", borderTop: "1px solid rgba(167,139,250,0.08)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: "var(--t-text,#f0e8ff)" }}>{NOMBRES_METRICA[m.metric] || m.metric}</div>
            <div style={{ fontSize: 10, color: "var(--t-text-dim,#8f84ad)" }}>{m.metric}{m.source ? ` · ${m.source}` : ""}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 12.5, color: esSinDato(m.metric, m.value) ? "#fbbf24" : "var(--t-text,#f0e8ff)" }}>
              {esSinDato(m.metric, m.value) ? "sin dato" : formatoValor(m.metric, m.value, m.unit)}
            </div>
            <div style={{ fontSize: 10, color: "var(--t-text-dim,#8f84ad)" }}>{humanDate(m.day)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
