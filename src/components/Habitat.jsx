// El hábitat: donde la mascota VIVE.
//
// El cielo es el de su dueño: el sol se calcula para su ubicación (cielo.js,
// sin red) y el tiempo viene de Open-Meteo. Broot vive en tierra; Nix, por su
// forma y sus movimientos, NADA: su hábitat es agua, flota meciéndose y se le
// ve medio cuerpo bajo la superficie.
//
// Qué hace, según `decidirModo` (petBehavior.js):
//   · libre       → pasea en tramos rectos con inercia, al paso de su sprite (planificarPaseo v3).
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
import VidaAmbiente from "./VidaAmbiente.jsx";
import { permitido } from "../lib/petAmbiente.js";
import { elegirAnimacion, precargarEtapa, fondoDe, spriteUrl } from "../lib/petSprites.js";
import { decidirModo, planificarPaseo, animCaricia, marchaDe, elegirSprite } from "../lib/petBehavior.js";
import { sol, fase as faseDe, clima as climaDe, paleta, discoSol } from "../lib/cielo.js";
import { ubicacion, pedirUbicacion, tiempoActual } from "../lib/tiempo.js";
import { prefersReducedMotion } from "../utils.js";

const TAM_BASE = 104;       // px de un sprite a escala 1
const ALTO = 260;
const SUELO_POR_DEFECTO = 0.56;   // dónde empieza el suelo / el agua (fracción del alto) si no hay panorama
const MARGEN = 6;           // px entre el cuerpo y las paredes
const PISO_MIN = 12;        // px bajo el horizonte donde pisa lo más lejano
const ESCALA_FONDO = 0.9;   // profundidad: lo lejano se ve un 10 % más pequeño
const ESCALA_FRENTE = 1.06;
const EASING = "cubic-bezier(0.25, 0.05, 0.75, 0.95)";   // arranque y parada suaves, media marcha casi lineal
const VISTOS_MAX_MS = 7 * 864e5;

const leer = (k, def) => { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* modo privado */ } };

const ICONO = { despejado: "☀️", poco_nuboso: "🌤️", nuboso: "⛅", cubierto: "☁️", niebla: "🌫️", llovizna: "🌦️", lluvia: "🌧️", nieve: "🌨️", tormenta: "⛈️", desconocido: "·" };
// Estrellas fijas: posiciones deterministas (sin Math.random en el render).
const ESTRELLAS = Array.from({ length: 16 }, (_, i) => ({ x: (i * 37 + 11) % 97, y: (i * 23 + 7) % 46, r: i % 3 === 0 ? 2 : 1.2 }));

export default function Habitat({ userId, manifest, especie, etapa, horario, entrenos = [], nombre, estado = null }) {
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
  const [pos, setPos] = useState({ x: 0.5, y: 0.55 });
  const posRef = useRef(pos);
  const dirRef = useRef(1);
  const moverA = useCallback(p => { posRef.current = p; setPos(p); }, []);
  const [viaje, setViaje] = useState(0);
  const [animId, setAnimId] = useState(null);
  const [quieta, setQuieta] = useState(false);     // pausa: fotograma congelado + respiración
  const [caricia, setCaricia] = useState(null);
  const [corazones, setCorazones] = useState([]);
  const mascota = useRef(null);
  const [ultimaCaricia, setUltimaCaricia] = useState(() => leer(claveCaricia, null));
  const [vistos, setVistos] = useState(() => leer(claveVistos, {}));
  const [ubi, setUbi] = useState(() => ubicacion());
  const [tiempo, setTiempo] = useState(null);
  const [avisoUbi, setAvisoUbi] = useState(null);

  const etapaDef = manifest?.pets?.[especie]?.stages?.[etapa];
  const anims = useMemo(() => new Set(Object.keys(etapaDef?.anims || {})), [etapaDef]);
  const tam = Math.round(TAM_BASE * (etapaDef?.escala || 1));
  const cuerpo = etapaDef?.cuerpo || { x0: 0.1, x1: 0.9, y0: 0.3, y1: 0.95 };
  const esHuevo = etapa === "huevo";
  const agua = especie === "nix";
  const fondo = fondoDe(especie);
  const SUELO = fondo ? fondo.horizonte : SUELO_POR_DEFECTO;
  const reducir = prefersReducedMotion();
  const marcha = useMemo(() => marchaDe(etapaDef, tam), [etapaDef, tam]);
  useEffect(() => { precargarEtapa(etapaDef); }, [etapaDef]);

  // Geometría: la posición se mide en el PUNTO DE APOYO del cuerpo (no en la
  // esquina del lienzo), así todas las etapas pisan el mismo suelo y ninguna
  // se sale por los lados aunque el dibujo tenga aire alrededor.
  const cuerpoAncho = (cuerpo.x1 - cuerpo.x0) * tam;
  const centroX = ((cuerpo.x0 + cuerpo.x1) / 2) * tam;
  const pieY = cuerpo.y1 * tam;

  useEffect(() => {
    if (ultimaCaricia == null) { const t = Date.now(); guardar(claveCaricia, t); setUltimaCaricia(t); }
  }, [ultimaCaricia, claveCaricia]);

  // Entrenos vistos: cuándo se enteró la app de cada uno (para entrenar 15 min
  // desde que lo ve si llegó con la sincronización). Se escribe en un efecto —
  // no en el render — y se poda: nada crece sin límite.
  useEffect(() => {
    const t = Date.now();
    const v = { ...vistos };
    let cambio = false;
    for (const w of entrenos) { const k = `${w.start_at}|${w.name}`; if (!v[k]) { v[k] = t; cambio = true; } }
    for (const k of Object.keys(v)) if (t - v[k] > VISTOS_MAX_MS) { delete v[k]; cambio = true; }
    if (cambio) { guardar(claveVistos, v); setVistos(v); }
  }, [entrenos, vistos, claveVistos]);

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
  const sueloPx = ALTO * SUELO;
  const util = { ancho: Math.max(1, ancho - cuerpoAncho - 2 * MARGEN), alto: Math.max(1, ALTO - MARGEN - (sueloPx + PISO_MIN)) };
  const utilRef = useRef(util);
  utilRef.current = util;
  // El ritmo del día (sueño) se lee al planificar cada tramo: cambiarlo no reinicia el paseo.
  const energiaRef = useRef(1);
  energiaRef.current = estado?.energia ?? 1;

  // Dónde está DE VERDAD ahora (a mitad de un tramo, la transición lleva el
  // cuerpo entre dos puntos). Al interrumpir el paseo se re-ancla ahí: sin
  // esto, el siguiente tramo nacía desde el destino ya abandonado y saltaba.
  const anclar = useCallback(() => {
    const el = mascota.current;
    if (!el || typeof window.DOMMatrixReadOnly === "undefined") return posRef.current;
    const m = new window.DOMMatrixReadOnly(getComputedStyle(el).transform);
    const u = utilRef.current;
    const x = (m.m41 + centroX - MARGEN - cuerpoAncho / 2) / u.ancho;
    const y = (m.m42 + pieY - (sueloPx + PISO_MIN)) / u.alto;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return posRef.current;
    const p = { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
    posRef.current = p; setPos(p);
    return p;
  }, [centroX, cuerpoAncho, pieY, sueloPx]);

  useEffect(() => {
    clearTimers();
    if (modo !== "libre" || !visible || reducir || esHuevo || caricia) {
      setViaje(0);
      setQuieta(false);
      setAnimId(null);
      if (modo !== "libre" || esHuevo) moverA({ x: 0.5, y: 0.5 });
      else anclar();
      return;
    }
    const paso = () => {
      const plan = planificarPaseo(posRef.current, Math.random, utilRef.current, anims, dirRef.current, marcha, energiaRef.current);
      dirRef.current = plan.dir;
      setAnimId(plan.anim);
      setQuieta(false);
      setViaje(plan.ms);
      moverA(plan.destino);
      later(() => {
        setViaje(0);
        // La pausa normal: de pie mirando hacia donde iba (no celebrando).
        if (plan.pausa.tipo === "feliz") { setAnimId("feliz"); setQuieta(false); }
        else setQuieta(true);
        later(paso, plan.pausaMs);
      }, plan.ms);
    };
    later(paso, 1200);
    return clearTimers;
  }, [modo, visible, reducir, esHuevo, caricia, anims, marcha, later, clearTimers, moverA, anclar]);

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
    // El corazón se retira solo al acabar su animación (onAnimationEnd): sin
    // timers que clearTimers() pudiera cancelar dejándolo pegado para siempre.
    setCorazones(c => [...c.slice(-4), t]);
    if (modo === "durmiendo" || modo === "entrenando") return;
    clearTimers();
    anclar();
    setViaje(0);
    setCaricia({ id: animCaricia(anims), t });
  };

  // ── Sprite ────────────────────────────────────────────────────────────────
  const animo = { libre: "feliz", durmiendo: "durmiendo", entrenando: "entrenando", triste: "triste" }[modo];
  const eleccion = elegirSprite({ modo, caricia: caricia?.id, animId, anims });
  let anim;
  if (eleccion.id) anim = { id: eleccion.id, ...etapaDef.anims[eleccion.id], loop: eleccion.loop };
  else anim = elegirAnimacion(manifest, especie, etapa, animo);
  const enPausa = !caricia && modo === "libre" && (quieta || eleccion.quieto);
  const congelado = enPausa && (eleccion.quieto || animId?.startsWith("caminar"));

  const px = MARGEN + cuerpoAncho / 2 + pos.x * util.ancho - centroX;
  const py = sueloPx + PISO_MIN + pos.y * util.alto - pieY;
  const escala = ESCALA_FONDO + (ESCALA_FRENTE - ESCALA_FONDO) * pos.y;

  return (
    <div>
      <div ref={caja} onClick={tocar} role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tocar(); } }}
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

        {/* Nubes: derivan despacio (con panorama, el cielo despejado ya trae las suyas y solo se dibujan las del tiempo cubierto); con reducir-movimiento se quedan quietas y visibles */}
        {Array.from({ length: fondo && !cl.gris ? 0 : cl.nubes }, (_, i) => (
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

        {/* Panorama de la especie: suelo/agua real, fundido por arriba con el cielo dinámico */}
        {fondo && (
          <div aria-hidden style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: `url(${spriteUrl(fondo.src, fondo.v)})`, backgroundSize: "cover", backgroundPosition: "center bottom",
            WebkitMaskImage: `linear-gradient(to bottom, transparent ${fondo.fade[0]}px, #000 ${fondo.fade[1]}px)`,
            maskImage: `linear-gradient(to bottom, transparent ${fondo.fade[0]}px, #000 ${fondo.fade[1]}px)`,
          }} />
        )}

        {/* Visitantes: mariposas y pájaros (Broot), gaviotas (Nix). Solo de día y con buen tiempo. */}
        <VidaAmbiente especie={especie} ancho={ancho} alto={ALTO} activo={!!fondo && permitido({ fase: f.id, clima: cl, visible, reducir })} />

        {/* Agua: ondas en la superficie (solo sin panorama: el panorama ya trae las suyas) */}
        {agua && !fondo && [0, 1, 2].map(i => (
          <span key={i} aria-hidden style={{
            position: "absolute", left: `${8 + i * 31}%`, top: sueloPx + 14 + i * 22, width: 60, height: 2, borderRadius: 2,
            background: "#fff", animation: `mpOnda ${3 + i}s ease-in-out ${i * 0.8}s infinite`, opacity: 0.2,
          }} />
        ))}

        {/* La mascota */}
        <div ref={mascota} style={{
          position: "absolute", left: 0, top: 0,
          transform: `translate(${px}px, ${py}px) scale(${escala.toFixed(3)})`,
          transformOrigin: `${centroX}px ${pieY}px`,
          transition: viaje ? `transform ${viaje}ms ${EASING}` : "transform 0.6s ease",
          willChange: "transform",
        }}>
          {/* Aura de hoy: dorada con racha, verde con la meta de pasos. Solo opacidad. */}
          {estado?.aura && !esHuevo && (
            <span aria-hidden style={{
              position: "absolute", left: centroX - cuerpoAncho * 0.9, width: cuerpoAncho * 1.8, top: pieY - (cuerpo.y1 - cuerpo.y0) * tam * 1.15,
              height: (cuerpo.y1 - cuerpo.y0) * tam * 1.3, borderRadius: "50%", pointerEvents: "none",
              background: `radial-gradient(closest-side, ${estado.aura === "racha" ? "rgba(255,196,64,0.55)" : "rgba(52,211,153,0.45)"}, transparent 72%)`,
              animation: reducir ? undefined : "mpAura 3.2s ease-in-out infinite",
              opacity: reducir ? 0.7 : undefined,
            }} />
          )}
          <div style={{ animation: agua ? "mpBob 2.6s ease-in-out infinite" : enPausa ? "mpRespira 2.8s ease-in-out infinite" : undefined, transformOrigin: "50% 100%" }}>
            <div key={caricia?.t || "quieta"} style={{ position: "relative", animation: caricia && !reducir ? (esHuevo ? "mpWiggle 0.5s ease 2" : "mpHop 0.55s ease-out 2") : undefined }}>
              <PetSprite anim={anim} size={tam} frame={congelado ? 0 : null}
                onFin={caricia ? () => setCaricia(null) : undefined} />
              {/* Medio cuerpo bajo el agua: la línea de flotación y el agua por delante */}
              {/* Línea de flotación ajustada al CUERPO de cada etapa (manifest
                  `cuerpo`): en Prime y UPF el cuerpo va más abajo y es más
                  estrecho que el lienzo, y una línea fija no le cuadraba. */}
              {agua && (
                <span aria-hidden style={{
                  position: "absolute",
                  left: Math.round((cuerpo.x0 - 0.05) * tam), width: Math.round((cuerpo.x1 - cuerpo.x0 + 0.1) * tam),
                  top: Math.round((cuerpo.y0 + (cuerpo.y1 - cuerpo.y0) * 0.55) * tam), bottom: 0,
                  background: fondo ? "linear-gradient(180deg, rgba(40,150,205,0.16) 0%, rgba(30,120,185,0.34) 100%)" : `linear-gradient(180deg, ${pal.suelo}55 0%, ${pal.suelo}dd 45%, ${pal.suelo} 100%)`,
                  borderTop: "2px solid rgba(255,255,255,0.35)", borderRadius: "40% 40% 0 0 / 12px 12px 0 0",
                }} />
              )}
            </div>
          </div>
          {/* Poca energía tras dormir poco: un zzz suave sobre la cabeza (transform/opacity). */}
          {modo === "libre" && !esHuevo && estado?.sueno?.nivel === "corta" && !reducir && (
            <span aria-hidden style={{ position: "absolute", left: centroX + cuerpoAncho * 0.25, top: cuerpo.y0 * tam - 6, fontSize: 15, fontWeight: 700, color: "#fff", pointerEvents: "none", animation: "mpZzz 3.4s ease-in-out infinite" }}>💤</span>
          )}
          {corazones.map(id => (
            <span key={id} aria-hidden onAnimationEnd={() => setCorazones(c => c.filter(x => x !== id))}
              style={{ position: "absolute", left: centroX - 8, top: cuerpo.y0 * tam - 10, fontSize: 18, pointerEvents: "none", animation: "mpHeart 1.3s ease-out forwards" }}>
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
        {(noche || f.id === "crepusculo") && <div aria-hidden style={{ position: "absolute", inset: 0, background: "#070a24", opacity: noche ? (fondo ? 0.55 : 0.28) : (fondo ? 0.26 : 0.14), pointerEvents: "none", transition: "opacity 1.5s ease" }} />}
        {/* Cielo cubierto / tormenta: el panorama es de día despejado, se apaga con un velo gris */}
        {fondo && cl.gris && !noche && <div aria-hidden style={{ position: "absolute", inset: 0, background: cl.tormenta ? "rgba(40,48,66,0.5)" : "rgba(96,108,124,0.34)", pointerEvents: "none" }} />}

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
        {esHuevo && modo === "libre" ? "Está calentita en su huevo. Cuida tus hábitos para que eclosione."
          : modo === "libre" && estado?.burbuja ? <><span aria-hidden>{estado.burbuja.icono} </span>{estado.burbuja.texto}</> : motivo}
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
