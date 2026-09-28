// El hábitat: donde la mascota VIVE.
//
// Lo que hace, según `decidirModo` (petBehavior.js):
//   · libre       → pasea sola por la pantalla con el sprite de caminar de la
//                   dirección en la que va; al llegar se para un rato (feliz).
//   · durmiendo   → duerme en su rincón, con el cielo de noche.
//   · entrenando  → entrena en el centro.
//   · triste      → quieta y triste, hasta que la tocas.
// Tocarla la pone contenta (su animación más alegre, una vez) y cuenta como
// cariño: sin caricias en 2 días, se pone triste.
//
// Higiene de temporizadores (CLAUDE.md §5, celebraciones): TODOS pasan por
// `later()` y se limpian juntos. Ninguno sobrevive al desmontaje.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PetSprite from "./PetSprite.jsx";
import { elegirAnimacion } from "../lib/petSprites.js";
import { decidirModo, planificarPaseo, animCaricia } from "../lib/petBehavior.js";
import { prefersReducedMotion } from "../utils.js";

const TAM = 104;                       // px del sprite en el hábitat
const ALTO = 250;

const leer = (k, def) => { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* modo privado */ } };

export default function Habitat({ userId, manifest, especie, etapa, horario, entrenos = [], nombre, soloVer = false }) {
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
  const [pos, setPos] = useState({ x: 0.5, y: 0.62 });
  // Posición también en una ref: el paseo la lee para planificar el siguiente
  // paso. Leerla dentro de un `setPos(p => …)` obligaría a lanzar timers
  // desde un updater, que React puede ejecutar dos veces (dos paseos a la vez).
  const posRef = useRef(pos);
  const moverA = useCallback(p => { posRef.current = p; setPos(p); }, []);
  const [viaje, setViaje] = useState(0);                 // ms de la transición en curso
  const [animId, setAnimId] = useState(null);            // animación del paseo
  const [caricia, setCaricia] = useState(null);          // { id, t } mientras reacciona
  const [corazones, setCorazones] = useState([]);
  const [ultimaCaricia, setUltimaCaricia] = useState(() => leer(claveCaricia, null));

  const anims = useMemo(() => new Set(Object.keys(manifest?.pets?.[especie]?.stages?.[etapa]?.anims || {})), [manifest, especie, etapa]);
  const esHuevo = etapa === "huevo";
  const reducir = prefersReducedMotion();

  // Primera vez que se ve a la mascota: cuenta como caricia (no nace triste).
  useEffect(() => {
    if (ultimaCaricia == null && !soloVer) { const t = Date.now(); guardar(claveCaricia, t); setUltimaCaricia(t); }
  }, [ultimaCaricia, claveCaricia, soloVer]);

  // Entrenos que la app ve por primera vez: si llegan tarde, entrena desde ahí.
  const vistos = useMemo(() => {
    const v = leer(claveVistos, {});
    const t = Date.now();
    let cambio = false;
    for (const w of entrenos) {
      const k = `${w.start_at}|${w.name}`;
      if (!v[k]) { v[k] = t; cambio = true; }
    }
    if (cambio) guardar(claveVistos, v);
    return v;
  }, [entrenos, claveVistos]);

  const { modo, motivo } = useMemo(
    () => decidirModo({ ahora, horario, entrenos, ultimaCaricia, vistos }),
    [ahora, horario, entrenos, ultimaCaricia, vistos]);

  // Reloj del hábitat: se reevalúa cada 30 s y al volver a la app.
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
  // Solo en modo libre, con la pantalla visible, sin reducir-movimiento y si
  // la etapa sabe andar. Cada paso: ir (sprite de caminar) → parar (feliz).
  useEffect(() => {
    clearTimers();
    if (modo !== "libre" || !visible || reducir || esHuevo || caricia) {
      setViaje(0);
      if (modo !== "libre") moverA({ x: 0.5, y: modo === "durmiendo" ? 0.7 : 0.62 });
      return;
    }
    const paso = () => {
      const plan = planificarPaseo(posRef.current, Math.random, { ancho, alto: ALTO }, anims);
      setAnimId(plan.anim);
      setViaje(plan.ms);
      moverA(plan.destino);
      later(() => { setAnimId(null); setViaje(0); later(paso, plan.pausaMs); }, plan.ms);
    };
    later(paso, 1200);
    return clearTimers;
  }, [modo, visible, reducir, esHuevo, caricia, ancho, anims, later, clearTimers, moverA]);

  useEffect(() => clearTimers, [clearTimers]);

  // Red de seguridad: la caricia dura como mucho 3 s aunque la animación no
  // avise de que ha terminado (una tira de 1 fotograma, reducir-movimiento…).
  useEffect(() => {
    if (!caricia) return undefined;
    const id = setTimeout(() => setCaricia(null), 3000);
    return () => clearTimeout(id);
  }, [caricia]);

  // ── Tocarla ───────────────────────────────────────────────────────────────
  const tocar = () => {
    const t = Date.now();
    guardar(claveCaricia, t);
    setUltimaCaricia(t);
    const id = t;
    setCorazones(c => [...c, id]);
    later(() => setCorazones(c => c.filter(x => x !== id)), 1400);
    if (modo === "durmiendo" || modo === "entrenando") return;    // no la despiertes ni la cortes
    clearTimers();
    setViaje(0);
    setCaricia({ id: animCaricia(anims), t });
  };

  // ── Qué sprite toca ───────────────────────────────────────────────────────
  const animo = { libre: "feliz", durmiendo: "durmiendo", entrenando: "entrenando", triste: "triste" }[modo];
  let anim;
  if (caricia && anims.has(caricia.id)) anim = { id: caricia.id, ...manifest.pets[especie].stages[etapa].anims[caricia.id], loop: false };
  // (si la etapa no tiene esa animación, el saltito basta y el efecto de abajo
  // la devuelve a pasear)
  else if (animId && anims.has(animId)) anim = { id: animId, ...manifest.pets[especie].stages[etapa].anims[animId] };
  else anim = elegirAnimacion(manifest, especie, etapa, animo);

  const noche = modo === "durmiendo";
  // La posición (0..1) se reparte sobre el espacio ÚTIL, descontando el
  // sprite: con `pos.x * ancho - TAM/2` el borde del recorrido dejaba medio
  // cuerpo fuera de la pantalla (medido: x = −8 px).
  const px = pos.x * Math.max(0, ancho - TAM);
  const py = pos.y * (ALTO - TAM);

  return (
    <div>
      <div
        ref={caja}
        onClick={tocar}
        role="button"
        aria-label={`${nombre || "Tu mascota"}: ${motivo} Tócala para hacerle caso.`}
        style={{
          position: "relative", height: ALTO, borderRadius: 18, overflow: "hidden", cursor: "pointer",
          background: noche
            ? "linear-gradient(180deg,#0b0a24 0%,#1b1640 62%,#241c3f 62%,#1c1633 100%)"
            : "linear-gradient(180deg,#2b2a6e 0%,#6b5bb8 45%,#b58bd6 62%,#3d6b4f 62%,#2c4f3a 100%)",
          border: "1px solid var(--t-card-border,rgba(167,139,250,0.2))",
          transition: "background 1.2s ease",
          touchAction: "manipulation",
        }}
      >
        {noche && <span aria-hidden style={{ position: "absolute", top: 18, right: 26, fontSize: 22, opacity: 0.85 }}>🌙</span>}
        <div style={{
          position: "absolute", left: 0, top: 0,
          transform: `translate(${px}px, ${py}px)`,
          transition: viaje ? `transform ${viaje}ms linear` : "transform 0.6s ease",
          willChange: "transform",
        }}>
          {/* Reacción al tocarla: el huevo se tambalea; la mascota da un
              saltito. Hace falta en todas las etapas: muchas no tienen una
              animación de "alegría" y la caricia no se notaba. */}
          <div key={caricia?.t || "quieta"} style={{ animation: caricia ? (esHuevo ? "mpWiggle 0.5s ease 2" : "mpHop 0.55s ease-out 2") : undefined }}>
            <PetSprite
              anim={anim}
              size={TAM}
              onFin={caricia ? () => setCaricia(null) : undefined}
            />
          </div>
          {corazones.map(id => (
            <span key={id} aria-hidden style={{
              position: "absolute", left: TAM / 2 - 8, top: 0, fontSize: 18, pointerEvents: "none",
              animation: "mpHeart 1.3s ease-out forwards",
            }}>{modo === "durmiendo" ? "💤" : modo === "entrenando" ? "💪" : "💜"}</span>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--t-text-muted,#b9b0d0)", marginTop: 8, lineHeight: 1.45, textAlign: "center" }}>
        {esHuevo && modo === "libre" ? "Está calentita en su huevo. Cuida tus hábitos para que eclosione." : motivo}
      </div>
    </div>
  );
}
