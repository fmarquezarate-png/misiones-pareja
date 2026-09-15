import TeamCrest from "./TeamCrest.jsx";

// El icono de una misión se guarda como TEXTO (`mission.emoji`) y ese texto
// viaja a sitios donde no cabe una imagen: el cuerpo de las notificaciones
// push, el enlace a Google Calendar, la exportación ICS. Por eso un escudo NO
// se guarda como icono: el icono sigue siendo un emoji de verdad (⚽) y el
// equipo va en un campo aparte y opcional, `mission.crest` = id del equipo.
// Así la notificación dice "⚽ Barça – Madrid" (correcto en cualquier sitio) y
// dentro de la app se pinta el escudo.
export const BALL = "⚽";

// Compatibilidad: las misiones guardadas antes de v5.30.0 marcaban el Barça con
// el par blaugrana como icono. Se siguen viendo con su escudo.
export const BARCA_LEGACY = "🔵🔴";

export default function MissionEmoji({ emoji, crest, size = 20, style }) {
  if (crest) return <TeamCrest teamId={crest} size={size} style={style} />;
  if (emoji === BARCA_LEGACY) return <TeamCrest teamId="barcelona" size={size} style={style} />;
  return <span style={{ fontSize: size, ...style }}>{emoji}</span>;
}
