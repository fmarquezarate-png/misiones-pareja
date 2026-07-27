import { useEffect, useRef, useState } from "react";

// Misi vivo — ya no es un botón fijo en una esquina: deambula libremente por
// la pantalla (dentro de límites seguros, lejos del header y de la barra de
// tabs) y se renderiza con transparencia REAL. Los clips fuente tienen fondo
// blanco de estudio; en vez de intentar disimularlo con un fondo blanco
// alrededor (como antes), aquí se dibuja cada frame en un <canvas> y se
// "recorta" el blanco por chroma-key en cada pixel (con un borde suave para
// evitar halos). Esto funciona igual en iOS Safari y en cualquier navegador,
// a diferencia de los videos con canal alpha (WebM/VP9 alpha no anda en
// Safari), que era la alternativa obvia pero poco fiable.
//
// Mantiene la misma API que el viejo MisiMascot (emotion, unread, onClick,
// liftForTabBar) para no tocar el resto de App.jsx.

const VIDEO_BY_EMOTION = {
  alegre:      "/misi-alegre.mp4",
  pensando:    "/misi-pensando.mp4",   // chat abierto, "atento"
  leyendo:     "/misi-pensando.mp4",   // alias histórico, mismo clip que pensando
  escribiendo: "/misi-escribiendo.mp4", // esperando respuesta de la IA
  cansado:     "/misi-cansado.mp4",     // inactividad media
  durmiendo:   "/misi-durmiendo.mp4",   // inactividad larga
  inspirado:   "/misi-inspirado.mp4",   // festejo (misión completada, racha, etc.)
};

const POSTER_BY_EMOTION = {
  alegre:      "/misi-alegre.jpg",
  pensando:    "/misi-pensando.jpg",
  leyendo:     "/misi-pensando.jpg",
  escribiendo: "/misi-neutral.jpg",
  cansado:     "/misi-cansado.jpg",
  durmiendo:   "/misi-durmiendo.jpg",
  inspirado:   "/misi-inspirado.jpg",
};

const EMOTIONS = {
  alegre:      { label: "Alegre",      cue: "✦" },
  pensando:    { label: "Pensando",    cue: "💭" },
  leyendo:     { label: "Pensando",    cue: "💭" },
  escribiendo: { label: "Escribiendo", cue: "✏️" },
  cansado:     { label: "Cansado",     cue: "😪" },
  durmiendo:   { label: "Durmiendo",   cue: "💤" },
  inspirado:   { label: "Inspirado",   cue: "💡" },
};

const SIZE = 68;          // tamaño visible en CSS px
const RENDER = 160;       // resolución interna del canvas (nítido en pantallas retina)
const MARGIN = 14;        // distancia mínima a los bordes de la pantalla
const HEADER_SAFE = 76;   // no invadir el header
const SPEED = 26;         // px/seg al deambular (calmo, no correteando)
const DOCK = { rightGap: 16, bottomGap: 100 }; // posición fija cuando el chat está abierto

// Zona "hogar" de Misi: en vez de deambular por TODA la pantalla (que tapaba
// eventos y se sentía errático — feedback de Ana/Fran), Misi se mueve dentro de
// una caja acotada anclada a la esquina inferior derecha, justo donde se aparca
// al abrir el chat. Se mueve de forma local y lógica, sin cruzar el contenido.
const ZONE_W = 150;       // ancho de la zona de merodeo
const ZONE_H = 200;       // alto de la zona de merodeo
// Descanso entre movimientos: al llegar a un punto, Misi se queda quieto un
// rato antes de elegir el siguiente — así no está flotando sin parar.
const DWELL_MIN = 1.8, DWELL_MAX = 4.2;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function randomTarget(bounds) {
  const { minX, maxX, minY, maxY } = bounds;
  return {
    x: minX + Math.random() * Math.max(1, maxX - minX),
    y: minY + Math.random() * Math.max(1, maxY - minY),
  };
}

// Caja de merodeo anclada a la esquina inferior derecha (dentro de límites
// seguros: lejos del header y de la barra de tabs). Misi nunca sale de aquí.
function getBounds(liftForTabBar) {
  const w = typeof window !== "undefined" ? window.innerWidth : 400;
  const h = typeof window !== "undefined" ? window.innerHeight : 800;
  const maxX = Math.max(MARGIN, w - SIZE - MARGIN);
  const maxY = Math.max(HEADER_SAFE, h - SIZE - (liftForTabBar ? 168 : 100));
  return {
    minX: Math.max(MARGIN, maxX - ZONE_W),
    maxX,
    minY: Math.max(HEADER_SAFE, maxY - ZONE_H),
    maxY,
  };
}

// Chroma-key: recorta pixels cercanos al blanco de estudio, con degradado
// suave para no dejar un borde duro alrededor del robot.
function keyOutWhite(imageData) {
  const d = imageData.data;
  const HARD = 232;  // por encima de esto → totalmente transparente
  const SOFT = 196;  // por debajo de esto → totalmente opaco
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const whiteness = Math.min(r, g, b);
    if (whiteness >= HARD) {
      d[i + 3] = 0;
    } else if (whiteness > SOFT) {
      d[i + 3] = Math.round(255 * (1 - (whiteness - SOFT) / (HARD - SOFT)));
    }
  }
  return imageData;
}

function MisiCanvas({ emotion, size, style, videoRef, onFirstFrame }) {
  const canvasRef = useRef(null);
  const drawCanvasRef = useRef(null); // offscreen, resolución baja para el pixel loop
  const rafRef = useRef(null);
  const readyRef = useRef(false);

  // (Re)cargar el video fuente cuando cambia la emoción.
  useEffect(() => {
    readyRef.current = false;
    const v = videoRef.current;
    if (!v) return;
    v.src = VIDEO_BY_EMOTION[emotion] || VIDEO_BY_EMOTION.alegre;
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    const onCanPlay = () => {
      readyRef.current = true;
      onFirstFrame?.();
      v.play().catch(() => {});
    };
    v.addEventListener("canplay", onCanPlay, { once: true });
    v.load();
    return () => v.removeEventListener("canplay", onCanPlay);
  }, [emotion, videoRef, onFirstFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = RENDER;
    canvas.height = RENDER;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!drawCanvasRef.current) drawCanvasRef.current = document.createElement("canvas");
    const off = drawCanvasRef.current;
    off.width = RENDER;
    off.height = RENDER;
    const offCtx = off.getContext("2d", { willReadFrequently: true });

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const v = videoRef.current;
      if (!v || !readyRef.current || v.paused || v.readyState < 2) return;
      offCtx.drawImage(v, 0, 0, RENDER, RENDER);
      let frame;
      try {
        frame = offCtx.getImageData(0, 0, RENDER, RENDER);
      } catch {
        return; // frame no disponible todavía
      }
      keyOutWhite(frame);
      ctx.clearRect(0, 0, RENDER, RENDER);
      ctx.putImageData(frame, 0, 0);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [videoRef]);

  return <canvas ref={canvasRef} width={RENDER} height={RENDER} style={{ ...style, width: size, height: size }} />;
}

function EmotionBadge({ emotion }) {
  const e = EMOTIONS[emotion] || EMOTIONS.alegre;
  const anim = emotion === "escribiendo" ? "misi-bounce 0.6s ease-in-out infinite"
    : (emotion === "pensando" || emotion === "leyendo") ? "misi-pulse 1.4s ease-in-out infinite"
    : emotion === "durmiendo" ? "misi-float-slow 3s ease-in-out infinite"
    : emotion === "cansado" ? "misi-float-slow 2.2s ease-in-out infinite"
    : emotion === "inspirado" ? "misi-bump 0.5s ease-in-out infinite"
    : "misi-pulse 2s ease-in-out infinite";
  return (
    <span aria-hidden="true" style={{
      position: "absolute", top: -4, right: -4, fontSize: 14, lineHeight: 1,
      animation: anim, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
    }}>{e.cue}</span>
  );
}

export default function MisiLiveLayer({ emotion = "alegre", unread = 0, onClick, liftForTabBar = false }) {
  const reduce = prefersReducedMotion();
  const videoRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [bump, setBump] = useState(false);

  // --- Deambular: posición animada por rAF, con blandas curvas hacia un
  // waypoint aleatorio que se renueva cada pocos segundos. Se congela (dock
  // fijo abajo a la derecha, como antes) si el usuario pidió menos
  // movimiento o si el chat está abierto (para no tapar la conversación).
  const boundsRef = useRef(getBounds(liftForTabBar));
  const dock = () => {
    const w = typeof window !== "undefined" ? window.innerWidth : 400;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    return { x: w - SIZE - DOCK.rightGap, y: h - SIZE - (liftForTabBar ? DOCK.bottomGap + 68 : DOCK.bottomGap) };
  };
  const [pos, setPos] = useState(() => dock());
  const posRef = useRef(pos);
  const targetRef = useRef(dock());
  const frozen = reduce; // el "dock" al abrir el chat se maneja abajo con `docked`
  const [docked, setDocked] = useState(false);

  useEffect(() => {
    boundsRef.current = getBounds(liftForTabBar);
    const onResize = () => { boundsRef.current = getBounds(liftForTabBar); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [liftForTabBar]);

  // Detecta "chat abierto" vía la prop emotion (pensando/leyendo) para
  // aparcarse quieto y no molestar mientras se conversa.
  useEffect(() => {
    setDocked(emotion === "pensando" || emotion === "leyendo");
  }, [emotion]);

  useEffect(() => {
    if (frozen) return;
    let raf;
    let lastTs = performance.now();
    let dwell = 0; // segundos de descanso restantes tras llegar a un punto

    const loop = (ts) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      if (document.hidden) return;

      const cur = posRef.current;

      if (docked) {
        // Chat abierto → va (rápido) a su posición de aparcado fija.
        targetRef.current = dock();
      } else {
        // Merodeo: solo elige un punto nuevo cuando ya llegó al anterior y
        // terminó su descanso — así se mueve a ratos, no sin parar.
        const tgt = targetRef.current;
        const arrived = Math.hypot(tgt.x - cur.x, tgt.y - cur.y) <= 0.6;
        if (arrived) {
          dwell -= dt;
          if (dwell <= 0) {
            targetRef.current = randomTarget(boundsRef.current);
            dwell = DWELL_MIN + Math.random() * (DWELL_MAX - DWELL_MIN);
          }
        }
      }

      const tgt = targetRef.current;
      const dx = tgt.x - cur.x, dy = tgt.y - cur.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.5) {
        const step = Math.min(dist, SPEED * dt * (docked ? 2.8 : 1));
        const next = { x: cur.x + (dx / dist) * step, y: cur.y + (dy / dist) * step };
        posRef.current = next;
        setPos(next);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozen, docked]);

  useEffect(() => {
    if (unread > 0) { setBump(true); const t = setTimeout(() => setBump(false), 600); return () => clearTimeout(t); }
  }, [unread]);

  // Pausar el video (batería) si la pestaña está oculta.
  useEffect(() => {
    const onVis = () => {
      const v = videoRef.current;
      if (!v) return;
      if (document.hidden) v.pause();
      else v.play?.().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const label = EMOTIONS[emotion]?.label ?? "";
  const wrapperStyle = {
    position: "fixed",
    left: frozen ? undefined : pos.x,
    top: frozen ? undefined : pos.y,
    right: frozen ? 16 : undefined,
    bottom: frozen ? (liftForTabBar ? 168 : 100) : undefined,
    zIndex: 350,
    width: SIZE, height: SIZE,
    border: "none", background: "transparent", cursor: "pointer", padding: 0,
    transition: frozen ? "none" : undefined,
    animation: bump ? "misi-bump 0.5s ease" : "misi-float 3.4s ease-in-out infinite",
    filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.45))",
  };

  return (
    <button onClick={onClick} aria-label={`Abrir chat con Misi — ${label}`} title="Misi" style={wrapperStyle}>
      <style>{`
        @keyframes misi-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes misi-float-slow { 0%,100% { transform: translateY(0); opacity:0.85; } 50% { transform: translateY(-2px); opacity:1; } }
        @keyframes misi-bump { 0%,100% { transform: scale(1); } 30% { transform: scale(1.18); } 60% { transform: scale(0.95); } }
        @keyframes misi-pulse { 0%,100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes misi-bounce { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-3px) rotate(-8deg); } }
      `}</style>
      {reduce ? (
        <img src={POSTER_BY_EMOTION[emotion] || POSTER_BY_EMOTION.alegre} alt="Misi"
          style={{ width: SIZE, height: SIZE, borderRadius: "50%", objectFit: "cover" }} />
      ) : (
        <>
          {!ready && (
            <img src={POSTER_BY_EMOTION[emotion] || POSTER_BY_EMOTION.alegre} alt="Misi"
              style={{ position: "absolute", inset: 0, width: SIZE, height: SIZE, borderRadius: "50%", objectFit: "cover" }} />
          )}
          <video ref={videoRef} muted playsInline style={{ display: "none" }} aria-hidden="true" />
          <MisiCanvas
            emotion={emotion}
            size={SIZE}
            videoRef={videoRef}
            onFirstFrame={() => setReady(true)}
            style={{ position: "absolute", inset: 0, opacity: ready ? 1 : 0, transition: "opacity 0.2s ease" }}
          />
        </>
      )}
      <EmotionBadge emotion={emotion} />
      {unread > 0 && (
        <span style={{
          position: "absolute", top: -2, left: -2, background: "#f43f5e", color: "#fff",
          fontSize: 10, fontWeight: 700, borderRadius: 99, minWidth: 17, height: 17, padding: "0 4px",
          display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--t-bg,#0a0714)",
        }}>{unread > 9 ? "9+" : unread}</span>
      )}
    </button>
  );
}
