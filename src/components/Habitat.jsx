// El hábitat: donde la mascota VIVE.
//
// El cielo es el de su dueño: el sol se calcula para su ubicación (cielo.js,
// sin red) y el tiempo viene de Open-Meteo. Broot vive en tierra; Nix, por su
// forma y sus movimientos, NADA: su hábitat es agua, flota meciéndose y se le
// ve medio cuerpo bajo la superficie.
//
// Qué hace, según `decidirModo` (petBehavior.js):
//   · libre       → pasea en tramos rectos con inercia (planificarPaseo v2).
//   · durmiendo   → duerme en su sitio.
//   · entrenando  → entrena en el centro.
//   · triste      → quieta y triste, hasta que la tocas.
// Tocarla: saltito + su animación más alegre + corazón. Cuenta como cariño.
//
// Reglas: solo transform/opacity en bucle; TODOS los timers por un único
// later()/clearTimers(); cada etapa a su escala (manifest `escala`) para que
// evolucionar se vea más grande, no más pequeño.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PetSprite from "./PetSprite.jsx";
import { elegirAnimacion } from "../lib/petSprites.js";
import { decidirModo, planificarPaseo, animCaricia } from "../lib/petBehavior.js";
import { sol, fase as faseDe, clima as climaDe, paleta, discoSol } from "../lib/cielo.js";
import { ubicacion, pedirUbicacion, tiempoActual } from "../lib/tiempo.js";
import { prefersReducedMotion } from "../utils.js";

const TAM_BASE = 104;       // px de un sprite a escala 1
const ALTO = 260;
const SUELO = 0.56;         // dónde empieza el suelo / el agua (fracción del alto)

const leer = (k, def) => { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* modo privado */ } };

const ICONO = { despejado: "☀️", poco_nuboso: "🌤️", nuboso: "⛅", cubierto: "☁️", niebla: "🌫️", llovizna: "🌦️", lluvia: "🌧️", nieve: "🌨️", tormenta: "⛈️", desconocido: "·" };
// Estrellas fijas: posiciones deterministas (sin Math.random en el render).
const ESTRELLAS = Array.from({ length: 16 }, (_, i) => ({ x: (i * 37 + 11) % 97, y: (i * 23 + 7) % 46, r: i % 3 === 0 ? 2 : 1.2 }));

export default function Habitat({ userId, manifest, especie, etapa, horario, entrenos = [], nombre }) {
  const caja = useRef(null);
  const timers = useRef(new Set());
  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => { timers.current.delete(id); fn(); }, ms);
    timers.current.add(id);
    return id;
  }, []);
  const clearTimers = useCallback(() => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);

  const claveCaricia = `mp-pet-caricia-${userId}`;
  const claveVistos = `mp-pet-vistos-${userId}`;

  const [ancho, setAncho] = useState(340);
  const [ahora, setAhora] = useState(() => new Date());
  const [visible, setVisible] = useState(typeof document === "undefined" || !document.hidden);
  const [pos, setPos] = useState({ x: 0.5, y: 0.7 });
  const posRef = useRef(pos);
  const dirRef = useRef(1);
  const moverA = useCallback(p => { posRef.current = p; setPos(p); }, []);
  const [viaje, setViaje] = useState(0);
  const [animId, setAnimId] = useState(null);
  const [caricia, setCaricia] = useState(null);
  const [corazones, setCorazones] = useState([]);
  const [ultimaCaricia, setUltimaCaricia] = useState(() => leer(claveCaricia, null));
  const [ubi, setUbi] = useState(() => ubicacion());
  const [tiempo, setTiempo] = useState(null);
  const [avisoUbi, setAvisoUbi] = useState(null);

  const etapaDef = manifest?.pets?.[especie]?.stages?.[etapa];
  const anims = useMemo(() => new Set(Object.keys(etapaDef?.anims || {})), [etapaDef]);
  const tam = Math.round(TAM_BASE * (etapaDef?.escala || 1));
  const esHuevo = etapa === "huevo";
  const agua = especie === "nix";
  const reducir = prefersReducedMotion();

  useEffect(() => {
    if (ultimaCaricia == null) { const t = Date.now(); guardar(claveCaricia, t); setUltimaCaricia(t); }
  }, [ultimaCaricia, claveCaricia]);

  const vistos = useMemo(() => {
    const v = leer(claveVistos, {});
    const t = Date.now();
    let cambio = false;
    for (const w of entrenos) { const k = `${w.start_at}|${w.name}`; if (!v[k]) { v[k] = t; cambio = true; } }
    if (cambio) guardar(claveVistos, v);
    return v;
  }, [entrenos, claveVistos]);

  const { modo, motivo } = useMemo(
    () => decidirModo({ ahora, horario, entrenos, ultimaCaricia, vistos }),
    [ahora, horario, entrenos, ultimaCaricia, vistos]);

  // ── Cielo ─────────────────────────────────────────────────────────────────
  const posSol = useMemo(() => sol(ahora, ubi.lat, ubi.lon), [ahora, ubi]);
  const f = faseDe(posSol);
  const cl = climaDe(tiempo?.codigo);
  const pal = paleta(f.id, cl, { agua });
  const disco = discoSol(posSol);
  const noche = f.id === "noche";

  useEffect(() => {
    let vivo = true;
    const pedir = () => tiempoActual(ubi).then(t => { if (vivo) setTiempo(t); });
    pedir();
    const id = setInterval(pedir, 30 * 60e3);
    return () => { vivo = false; clearInterval(id); };
  }, [ubi]);

  const usarMiUbicacion = async e => {
    e.stopPropagation();
    setAvisoUbi("Buscando…");
    try { setUbi(await pedirUbicacion()); setAvisoUbi(null); }
    catch (err) { setAvisoUbi(err.message === "denegada" ? "Sin permiso de ubicación: sigue con Barcelona." : "No se pudo obtener la ubicación."); }
  };

  // Reloj: 30 s, y al volver a la app.
  useEffect(() => {
    const onVis = () => { setVisible(!document.hidden); if (!document.hidden) setAhora(new Date()); };
    document.addEventListener("visibilitychange", onVis);
    const id = setInterval(() => setAhora(new Date()), 30e3);
    return () => { document.removeEventListener("visibilitychange", onVis); clearInterval(id); };
  }, []);

  useEffect(() => {
    const el = caja.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── El paseo ──────────────────────────────────────────────────────────────
  const util = { ancho: Math.max(1, ancho - tam), alto: Math.max(1, ALTO - tam) };
  useEffect(() => {
    clearTimers();
    if (modo !== "libre" || !visible || reducir || esHuevo || caricia) {
      setViaje(0);
      if (modo !== "libre" || esHuevo) moverA({ x: 0.5, y: 0.78 });
      return;
    }
    const paso = () => {
      const plan = planificarPaseo(posRef.current, Math.random, util, anims, dirRef.current);
      dirRef.current = plan.dir;
      setAnimId(plan.anim);
      setViaje(plan.ms);
      moverA(plan.destino);
      later(() => { setAnimId(null); setViaje(0); later(paso, plan.pausaMs); }, plan.ms);
    };
    later(paso, 1200);
    return clearTimers;
    // util se recalcula en cada render; basta con sus dimensiones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, visible, reducir, esHuevo, caricia, util.ancho, util.alto, anims, later, clearTimers, moverA]);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (!caricia) return undefined;
    const id = setTimeout(() => setCaricia(null), 3000);
    return () => clearTimeout(id);
  }, [caricia]);

  const tocar = () => {
    const t = Date.now();
    guardar(claveCaricia, t);
    setUltimaCaricia(t);
    setCorazones(c => [...c, t]);
    later(() => setCorazones(c => c.filter(x => x !== t)), 1400);
    if (modo === "durmiendo" || modo === "entrenando") return;
    clearTimers();
    setViaje(0);
    setCaricia({ id: animCaricia(anims), t });
  };

  // ── Sprite ────────────────────────────────────────────────────────────────
  const animo = { libre: "feliz", durmiendo: "durmiendo", entrenando: "entrenando", triste: "triste" }[modo];
  let anim;
  if (caricia && anims.has(caricia.id)) anim = { id: caricia.id, ...etapaDef.anims[caricia.id], loop: false };
  else if (animId && anims.has(animId)) anim = { id: animId, ...etapaDef.anims[animId] };
  else anim = elegirAnimacion(manifest, especie, etapa, animo);

  const px = pos.x * util.ancho;
  const py = pos.y * util.alto;
  const sueloPx = ALTO * SUELO;

  return (
    <div>
      <div ref={caja} onClick={tocar} role="button"
        aria-label={`${nombre || "Tu mascota"}: ${motivo} ${cl.texto}. Tócala para hacerle caso.`}
        style={{
          position: "relative", height: ALTO, borderRadius: 18, overflow: "hidden", cursor: "pointer",
          background: `linear-gradient(180deg, ${pal.arriba} 0%, ${pal.abajo} ${SUELO * 100}%, ${pal.suelo} ${SUELO * 100}%, ${pal.suelo} 100%)`,
          border: "1px solid var(--t-card-border,rgba(167,139,250,0.2))",
          transition: "background 1.5s ease", touchAction: "manipulation",
        }}>

        {/* Estrellas (noche despejada) */}
        {noche && cl.nubes < 3 && ESTRELLAS.map((s, i) => (
          <span key={i} aria-hidden style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, width: s.r, height: s.r, borderRadius: "50%", background: "#fff", opacity: 0.8 }} />
        ))}

        {/* Sol (posición real) o luna */}
        {disco && !cl.gris && (
          <span aria-hidden style={{
            position: "absolute", left: 0, top: 0, width: 30, height: 30, borderRadius: "50%",
            background: f.id === "dia" ? "#ffe58a" : "#ffb36b",
            boxShadow: `0 0 26px 8px ${f.id === "dia" ? "rgba(255,229,138,0.55)" : "rgba(255,160,90,0.5)"}`,
            transform: `translate(${disco.x * ancho - 15}px, ${disco.y * ALTO - 15}px)`, transition: "transform 1s linear",
          }} />
        )}
        {noche && !cl.gris && <span aria-hidden style={{ position: "absolute", top: 16, right: 22, fontSize: 22 }}>🌙</span>}

        {/* Nubes: derivan despacio; con reducir-movimiento se quedan quietas y visibles */}
        {Array.from({ length: cl.nubes }, (_, i) => (
          <span key={i} aria-hidden style={{
            position: "absolute", left: `${10 + i * 28}%`, top: `${8 + (i % 2) * 12}%`, width: 96, height: 44,
            opacity: noche ? 0.35 : cl.gris ? 0.9 : 0.8,
            // Tres bollos redondos sobre una base en forma de píldora: con
            // bollos grandes que llenaban la caja, la nube se veía cuadrada.
            background: `radial-gradient(circle at 30% 58%, ${cl.gris ? "#d5dbe3" : "#fff"} 0 18px, transparent 19px),
                         radial-gradient(circle at 55% 40%, ${cl.gris ? "#d5dbe3" : "#fff"} 0 22px, transparent 23px),
                         radial-gradient(circle at 76% 62%, ${cl.gris ? "#d5dbe3" : "#fff"} 0 15px, transparent 16px),
                         linear-gradient(${cl.gris ? "#d5dbe3" : "#fff"}, ${cl.gris ? "#d5dbe3" : "#fff"}) 14px 30px / 70px 14px no-repeat`,
            borderRadius: 14,
            animation: `mpNube ${80 + i * 25}s linear ${-i * 30}s infinite`,
          }} />
        ))}

        {/* Agua: ondas en la superficie */}
        {agua && [0, 1, 2].map(i => (
          <span key={i} aria-hidden style={{
            position: "absolute", left: `${8 + i * 31}%`, top: sueloPx + 14 + i * 22, width: 60, height: 2, borderRadius: 2,
            background: "#fff", animation: `mpOnda ${3 + i}s ease-in-out ${i * 0.8}s infinite`, opacity: 0.2,
          }} />
        ))}

        {/* La mascota */}
        <div style={{
          position: "absolute", left: 0, top: 0,
          transform: `translate(${px}px, ${py}px)`,
          transition: viaje ? `transform ${viaje}ms linear` : "transform 0.6s ease",
          willChange: "transform",
        }}>
          <div style={{ animation: agua ? "mpBob 2.6s ease-in-out infinite" : undefined }}>
            <div key={caricia?.t || "quieta"} style={{ position: "relative", animation: caricia ? (esHuevo ? "mpWiggle 0.5s ease 2" : "mpHop 0.55s ease-out 2") : undefined }}>
              <PetSprite anim={anim} size={tam} onFin={caricia ? () => setCaricia(null) : undefined} />
              {/* Medio cuerpo bajo el agua: la línea de flotación y el agua por delante */}
              {agua && (
                <span aria-hidden style={{
                  position: "absolute", left: -6, right: -6, bottom: 0, height: Math.round(tam * 0.34),
                  background: `linear-gradient(180deg, ${pal.suelo}55 0%, ${pal.suelo}dd 45%, ${pal.suelo} 100%)`,
                  borderTop: "2px solid rgba(255,255,255,0.35)", borderRadius: "40% 40% 0 0 / 12px 12px 0 0",
                }} />
              )}
            </div>
          </div>
          {corazones.map(id => (
            <span key={id} aria-hidden style={{ position: "absolute", left: tam / 2 - 8, top: 0, fontSize: 18, pointerEvents: "none", animation: "mpHeart 1.3s ease-out forwards" }}>
              {modo === "durmiendo" ? "💤" : modo === "entrenando" ? "💪" : "💜"}
            </span>
          ))}
        </div>

        {/* Lluvia / nieve / niebla / tormenta */}
        {(cl.lluvia || cl.nieve) && (
          <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            <div style={{
              position: "absolute", left: 0, right: 0, top: 0, height: "200%",
              background: cl.nieve
                ? "radial-gradient(circle, rgba(255,255,255,0.9) 0 1.6px, transparent 2px) 0 0 / 26px 26px, radial-gradient(circle, rgba(255,255,255,0.7) 0 1.2px, transparent 1.6px) 13px 13px / 26px 26px"
                : `repeating-linear-gradient(105deg, transparent 0 9px, rgba(210,225,255,${cl.lluvia > 1 ? 0.45 : 0.3}) 9px 10px, transparent 10px 19px)`,
              animation: `mpLluvia ${cl.nieve ? 7 : cl.lluvia > 1 ? 0.45 : 0.7}s linear infinite`,
            }} />
          </div>
        )}
        {cl.niebla && <div aria-hidden style={{ position: "absolute", inset: 0, background: "rgba(225,228,236,0.38)", pointerEvents: "none" }} />}
        {cl.tormenta && <div aria-hidden style={{ position: "absolute", inset: 0, background: "#fff", opacity: 0, animation: "mpRayo 9s linear infinite", pointerEvents: "none" }} />}
        {/* La noche también oscurece a la mascota: está en la misma luz */}
        {(noche || f.id === "crepusculo") && <div aria-hidden style={{ position: "absolute", inset: 0, background: "#070a24", opacity: noche ? 0.28 : 0.14, pointerEvents: "none" }} />}

        {/* Procedencia del cielo: dónde y qué tiempo, o que no hay datos */}
        <span style={{
          position: "absolute", left: 10, top: 9, fontSize: 11, fontWeight: 600, color: "#fff",
          background: "rgba(10,8,30,0.38)", borderRadius: 99, padding: "3px 9px", pointerEvents: "none",
        }}>
          {tiempo?.codigo != null
            // De noche, un cielo despejado o casi despejado es una luna, no un sol.
            ? `${noche && (cl.id === "despejado" || cl.id === "poco_nuboso") ? "🌙" : noche && cl.id === "nuboso" ? "☁️" : ICONO[cl.id]} ${tiempo.temp != null ? Math.round(tiempo.temp) + "° · " : ""}${ubi.nombre}`
            : `${ubi.nombre} · ${tiempo ? "sin datos del tiempo" : "…"}`}
        </span>
      </div>

      <div style={{ fontSize: 12.5, color: "var(--t-text-muted,#b9b0d0)", marginTop: 8, lineHeight: 1.45, textAlign: "center" }}>
        {esHuevo && modo === "libre" ? "Está calentita en su huevo. Cuida tus hábitos para que eclosione." : motivo}
      </div>
      {ubi.porDefecto && (
        <div style={{ textAlign: "center", marginTop: 6 }}>
          <button onClick={usarMiUbicacion} style={{
            fontSize: 11.5, padding: "5px 11px", borderRadius: 99, cursor: "pointer", fontFamily: "inherit",
            color: "var(--t-accent,#c4b8ff)", background: "transparent", border: "1px solid var(--t-card-border,rgba(167,139,250,0.25))",
          }}>📍 Usar mi ubicación para el cielo</button>
          {avisoUbi && <div style={{ fontSize: 11, color: "var(--t-text-dim,#8f84ad)", marginTop: 4 }}>{avisoUbi}</div>}
        </div>
      )}
    </div>
  );
}
