// Catálogo de equipos (v5.30.0) — LaLiga y Premier League.
//
// Cada equipo trae sus dos colores y su patrón de camiseta, y con eso la app
// DIBUJA un escudo reconocible sin depender de ningún archivo. Si existe
// `/escudos/{id}.png`, se usa ese en su lugar (ver MissionEmoji). Así se puede
// elegir cualquier equipo desde el primer día y los escudos oficiales se van
// añadiendo cuando se quiera, sin tocar código.
//
// `names` son los nombres EXACTOS tal y como vienen en openfootball. Se compara
// por igualdad, nunca por "incluye": "RCD Espanyol de Barcelona" contiene
// "Barcelona", así que un `includes` metería los partidos del Espanyol en el
// calendario del culé. Ese fallo apareció de verdad al explorar los datos.

export const LEAGUES = [
  { id: "es.1", name: "LaLiga",         short: "LaLiga",  emoji: "🇪🇸" },
  { id: "en.1", name: "Premier League", short: "Premier", emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
];

// pattern: stripes (verticales) · halves (mitades) · solid (liso) · sash (banda)
export const TEAMS = [
  // ── LaLiga ────────────────────────────────────────────────────────────────
  { id:"barcelona",   league:"es.1", short:"Barça",      colors:["#004D98","#A50044"], pattern:"stripes", names:["FC Barcelona"] },
  { id:"real-madrid", league:"es.1", short:"Madrid",     colors:["#FFFFFF","#FEBE10"], pattern:"solid",   names:["Real Madrid CF"] },
  { id:"atletico",    league:"es.1", short:"Atleti",     colors:["#CB3524","#FFFFFF"], pattern:"stripes", names:["Club Atlético de Madrid"] },
  { id:"athletic",    league:"es.1", short:"Athletic",   colors:["#EE2523","#FFFFFF"], pattern:"stripes", names:["Athletic Club"] },
  { id:"sevilla",     league:"es.1", short:"Sevilla",    colors:["#FFFFFF","#D81920"], pattern:"solid",   names:["Sevilla FC"] },
  { id:"betis",       league:"es.1", short:"Betis",      colors:["#00954C","#FFFFFF"], pattern:"stripes", names:["Real Betis Balompié"] },
  { id:"real-sociedad",league:"es.1",short:"Real Soc.",  colors:["#0067B1","#FFFFFF"], pattern:"stripes", names:["Real Sociedad de Fútbol"] },
  { id:"villarreal",  league:"es.1", short:"Villarreal", colors:["#FFE667","#005187"], pattern:"solid",   names:["Villarreal CF"] },
  { id:"valencia",    league:"es.1", short:"Valencia",   colors:["#FFFFFF","#F18E00"], pattern:"solid",   names:["Valencia CF"] },
  { id:"celta",       league:"es.1", short:"Celta",      colors:["#8AC3EE","#FFFFFF"], pattern:"solid",   names:["RC Celta de Vigo"] },
  { id:"espanyol",    league:"es.1", short:"Espanyol",   colors:["#0067B1","#FFFFFF"], pattern:"stripes", names:["RCD Espanyol de Barcelona"] },
  { id:"osasuna",     league:"es.1", short:"Osasuna",    colors:["#D91A21","#0A346F"], pattern:"solid",   names:["CA Osasuna"] },
  { id:"rayo",        league:"es.1", short:"Rayo",       colors:["#FFFFFF","#E53027"], pattern:"sash",    names:["Rayo Vallecano de Madrid"] },
  { id:"getafe",      league:"es.1", short:"Getafe",     colors:["#005999","#FFFFFF"], pattern:"solid",   names:["Getafe CF"] },
  { id:"alaves",      league:"es.1", short:"Alavés",     colors:["#0761AF","#FFFFFF"], pattern:"stripes", names:["Deportivo Alavés"] },
  { id:"elche",       league:"es.1", short:"Elche",      colors:["#00913F","#FFFFFF"], pattern:"stripes", names:["Elche CF"] },
  { id:"levante",     league:"es.1", short:"Levante",    colors:["#004FA3","#B4023B"], pattern:"stripes", names:["Levante UD"] },
  { id:"malaga",      league:"es.1", short:"Málaga",     colors:["#00A2E1","#FFFFFF"], pattern:"stripes", names:["Málaga CF"] },
  { id:"deportivo",   league:"es.1", short:"Dépor",      colors:["#009CDE","#FFFFFF"], pattern:"solid",   names:["RC Deportivo La Coruña"] },
  { id:"racing",      league:"es.1", short:"Racing",     colors:["#00AA4F","#FFFFFF"], pattern:"stripes", names:["Real Racing Club de Santander"] },

  // ── Premier League ────────────────────────────────────────────────────────
  { id:"arsenal",     league:"en.1", short:"Arsenal",    colors:["#EF0107","#FFFFFF"], pattern:"solid",   names:["Arsenal FC"] },
  { id:"aston-villa", league:"en.1", short:"Villa",      colors:["#95BFE5","#670E36"], pattern:"halves",  names:["Aston Villa FC"] },
  { id:"bournemouth", league:"en.1", short:"Bournemouth",colors:["#DA291C","#000000"], pattern:"stripes", names:["AFC Bournemouth"] },
  { id:"brentford",   league:"en.1", short:"Brentford",  colors:["#E30613","#FFFFFF"], pattern:"stripes", names:["Brentford FC"] },
  { id:"brighton",    league:"en.1", short:"Brighton",   colors:["#0057B8","#FFFFFF"], pattern:"stripes", names:["Brighton & Hove Albion FC"] },
  { id:"chelsea",     league:"en.1", short:"Chelsea",    colors:["#034694","#FFFFFF"], pattern:"solid",   names:["Chelsea FC"] },
  { id:"coventry",    league:"en.1", short:"Coventry",   colors:["#78D0F3","#FFFFFF"], pattern:"solid",   names:["Coventry City FC"] },
  { id:"crystal-palace",league:"en.1",short:"Palace",    colors:["#1B458F","#C4122E"], pattern:"stripes", names:["Crystal Palace FC"] },
  { id:"everton",     league:"en.1", short:"Everton",    colors:["#003399","#FFFFFF"], pattern:"solid",   names:["Everton FC"] },
  { id:"fulham",      league:"en.1", short:"Fulham",     colors:["#FFFFFF","#000000"], pattern:"solid",   names:["Fulham FC"] },
  { id:"hull",        league:"en.1", short:"Hull",       colors:["#F5A12D","#000000"], pattern:"stripes", names:["Hull City AFC"] },
  { id:"ipswich",     league:"en.1", short:"Ipswich",    colors:["#0044A9","#FFFFFF"], pattern:"solid",   names:["Ipswich Town FC"] },
  { id:"leeds",       league:"en.1", short:"Leeds",      colors:["#FFFFFF","#1D428A"], pattern:"solid",   names:["Leeds United FC"] },
  { id:"liverpool",   league:"en.1", short:"Liverpool",  colors:["#C8102E","#00B2A9"], pattern:"solid",   names:["Liverpool FC"] },
  { id:"man-city",    league:"en.1", short:"City",       colors:["#6CABDD","#FFFFFF"], pattern:"solid",   names:["Manchester City FC"] },
  { id:"man-united",  league:"en.1", short:"United",     colors:["#DA291C","#FBE122"], pattern:"solid",   names:["Manchester United FC"] },
  { id:"newcastle",   league:"en.1", short:"Newcastle",  colors:["#241F20","#FFFFFF"], pattern:"stripes", names:["Newcastle United FC"] },
  { id:"forest",      league:"en.1", short:"Forest",     colors:["#DD0000","#FFFFFF"], pattern:"solid",   names:["Nottingham Forest FC"] },
  { id:"sunderland",  league:"en.1", short:"Sunderland", colors:["#EB172B","#FFFFFF"], pattern:"stripes", names:["Sunderland AFC"] },
  { id:"tottenham",   league:"en.1", short:"Tottenham",  colors:["#FFFFFF","#132257"], pattern:"solid",   names:["Tottenham Hotspur FC"] },
];

const BY_ID = Object.fromEntries(TEAMS.map(t => [t.id, t]));
// Índice nombre-exacto → equipo. Se normaliza solo el espaciado y las mayúsculas.
const norm = s => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
const BY_NAME = {};
for (const t of TEAMS) for (const n of t.names) BY_NAME[norm(n)] = t;

export function teamById(id) { return BY_ID[id] || null; }

// Resuelve el nombre que viene de la fuente de datos. Igualdad exacta: nunca
// `includes` (ver la nota de arriba sobre el Espanyol).
export function teamByName(name) { return BY_NAME[norm(name)] || null; }

export function teamsOfLeague(leagueId) { return TEAMS.filter(t => t.league === leagueId); }

// Etiqueta corta para un partido: "Barça – Madrid", con el equipo propio primero
// solo si es el local (se respeta quién juega en casa).
export function matchLabel(homeName, awayName) {
  const h = teamByName(homeName), a = teamByName(awayName);
  return `${h ? h.short : homeName} – ${a ? a.short : awayName}`;
}
