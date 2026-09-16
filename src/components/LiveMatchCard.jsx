// Tarjeta de partido en vivo para la PANTALLA DE INICIO.
//
// Solo aparece mientras el partido de tu equipo se está jugando de verdad
// (IN_PLAY o PAUSED). En cuanto pita el final vuelve todo lo de siempre —la
// notita, el agradecimiento, la idea del día— sin que haya que tocar nada.
//
// Es un botón entero: toda la tarjeta lleva a Mi Equipo → En vivo. Regla de
// blancos táctiles de CLAUDE.md §5 (el episodio del lápiz de Calendario): la
// acción principal se dispara desde toda la fila, no desde un icono pequeño.

import TeamCrest from "./TeamCrest.jsx";
import { estadoEnVivo, marcadorEnVivo, frescura } from "../lib/live.js";
import { teamById } from "../lib/teams.js";

const nombreCorto = (id, crudo) =>
  teamById(id)?.short || String(crudo || "").replace(/\s+(FC|CF|AFC|SAD|CP)$/i, "");

export default function LiveMatchCard({ match, teamId, fetchedAt, onOpen }) {
  if (!match) return null;

  const est = estadoEnVivo(match);
  const [gl, gv] = marcadorEnVivo(match) || [0, 0];
  const fresco = frescura(fetchedAt);
  const soyLocal = match.homeId === teamId;
  const gano = soyLocal ? gl > gv : gv > gl;
  const pierdo = soyLocal ? gl < gv : gv < gl;

  const Lado = ({ id, crudo, goles, mio }) => (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <TeamCrest teamId={id} size={42} />
      <span style={{
        fontSize: 12, lineHeight: 1.25, textAlign: "center",
        color: mio ? "var(--t-text,#f8f4ff)" : "var(--t-text-muted,#b9b0d0)",
        fontWeight: mio ? 700 : 500,
      }}>{nombreCorto(id, crudo)}</span>
      <span style={{
        fontSize: 34, fontWeight: 800, lineHeight: 1,
        fontFamily: "'Fraunces',serif", fontVariantNumeric: "tabular-nums",
        color: "var(--t-text,#f8f4ff)",
      }}>{goles}</span>
    </div>
  );

  return (
    <button
      onClick={onOpen}
      aria-label={`Partido en vivo: ${nombreCorto(match.homeId, match.home)} ${gl}, ${nombreCorto(match.awayId, match.away)} ${gv}. Ver detalle.`}
      style={{
        width: "100%", boxSizing: "border-box", textAlign: "left", cursor: "pointer",
        fontFamily: "inherit", padding: "14px 16px 12px", borderRadius: 16,
        background: "linear-gradient(135deg, rgba(248,113,113,0.13), var(--t-card,#1d1733) 55%)",
        border: "1px solid rgba(248,113,113,0.42)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 10, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase",
          color: est.color,
        }}>
          {/* Solo `opacity` en bucle: compone en GPU y el reset global de
              prefers-reduced-motion lo deja fijo en su fotograma final. */}
          <span style={{ animation: est.pulso ? "mpLivePulse 1.6s ease-in-out infinite" : undefined }}>●</span>
          En vivo · {est.texto}
        </span>
        <span style={{ fontSize: 10, color: fresco.fresco ? "var(--t-text-dim,#8f84ad)" : "#fbbf24" }}>
          {fresco.fresco ? fresco.texto : `⚠ ${fresco.texto}`}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <Lado id={match.homeId} crudo={match.home} goles={gl} mio={soyLocal} />
        <span style={{
          alignSelf: "center", paddingTop: 34, fontSize: 13,
          color: "var(--t-text-dim,#8f84ad)", fontWeight: 700,
        }}>–</span>
        <Lado id={match.awayId} crudo={match.away} goles={gv} mio={!soyLocal} />
      </div>

      <div style={{
        marginTop: 10, paddingTop: 9, borderTop: "1px solid var(--t-card-border,rgba(167,139,250,0.16))",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}>
        <span style={{ fontSize: 11.5, color: "var(--t-text-muted,#b9b0d0)", minWidth: 0 }}>
          {gano ? "¡Vamos ganando! 🔥" : pierdo ? "Vamos por detrás 😬" : "Vamos empatados 😤"}
          {match.comp ? ` · ${match.comp}` : ""}
        </span>
        <span style={{ fontSize: 11.5, color: "var(--t-accent,#c4b8ff)", fontWeight: 700, flexShrink: 0 }}>
          Ver detalle →
        </span>
      </div>
    </button>
  );
}
