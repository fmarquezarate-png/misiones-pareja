// Registro ÚNICO de las secciones de la app.
//
// POR QUÉ (Scanner, 28/09/2026): las secciones estaban copiadas en cuatro
// listas que no coincidían —menú lateral, barra inferior (ALL_TABS), pestañas
// válidas (VALID) y títulos de la cabecera—:
//   · La barra inferior no ofrecía Salud, Mi Equipo, La Copa ni Notitas.
//   · 7 secciones enseñaban la cabecera vacía (Ánimo, Lista, Notitas, La Copa,
//     Mi Equipo, Salud, Diagnóstico).
//   · El mismo icono significaba cosas distintas según la lista (🎯 era
//     "Semana" en una y "Metas" en otra; 📋 "Semana" y "Pendientes").
// Todo sale ahora de aquí, y un test falla si alguien añade una sección en
// App.jsx sin registrarla (o al revés).
//
// Campos: id · nombre (menú) · corto (barra inferior) · icono · grupo ·
// titulo (cabecera, si difiere) · modal (no es pestaña: abre un modal) ·
// oculta (no sale en el menú ni en la barra: solo por enlace/gesto).

export const SECCIONES = [
  { id: "home",        nombre: "Inicio",             corto: "Inicio",     icono: "🏠", grupo: "inicio" },

  { id: "current",     nombre: "Semana actual",      corto: "Semana",     icono: "🎯", grupo: "semana" },
  { id: "calendar",    nombre: "Calendario",         corto: "Calendario", icono: "📅", grupo: "semana" },
  { id: "pending",     nombre: "Pendientes",         corto: "Pendientes", icono: "📋", grupo: "semana" },

  { id: "goals",       nombre: "Metas",              corto: "Metas",      icono: "🏅", grupo: "nosotros" },
  { id: "mood",        nombre: "Ánimo",              corto: "Ánimo",      icono: "🧠", grupo: "nosotros" },
  { id: "notes",       nombre: "Notitas",            corto: "Notitas",    icono: "💌", grupo: "nosotros" },
  { id: "trophy",      nombre: "La Copa",            corto: "La Copa",    icono: "🏆", grupo: "nosotros" },
  { id: "team",        nombre: "Mi Equipo",          corto: "Equipo",     icono: "⚽", grupo: "nosotros" },
  { id: "salud",       nombre: "Salud",              corto: "Salud",      icono: "🩺", grupo: "nosotros" },
  { id: "birthdays",   nombre: "Cumpleaños",         corto: "Cumples",    icono: "🎂", grupo: "nosotros" },
  { id: "timecapsule", nombre: "Cápsula del tiempo", corto: "Cápsula",    icono: "✉️", grupo: "nosotros" },
  { id: "links",       nombre: "Links de Interés",   corto: "Links",      icono: "🔗", grupo: "nosotros" },
  { id: "wishlist",    nombre: "Lista de compras",   corto: "Compras",    icono: "🛍️", grupo: "nosotros" },

  { id: "stats",       nombre: "Stats",              corto: "Stats",      icono: "📊", grupo: "historial" },
  { id: "history",     nombre: "Histórico",          corto: "Histórico",  icono: "🗂️", grupo: "historial" },
  { id: "activity",    nombre: "Actividad",          corto: "Actividad",  icono: "🕐", grupo: "historial", modal: true },
  { id: "gastos",      nombre: "Gastos",             corto: "Gastos",     icono: "💸", grupo: "historial", titulo: "Gastos Compartidos" },
  { id: "chat",        nombre: "Chat",               corto: "Chat",       icono: "💬", grupo: "historial" },
  { id: "system",      nombre: "Sistema Misi",       corto: "Sistema",    icono: "🛡️", grupo: "historial" },

  { id: "diagnostics", nombre: "Diagnóstico",        corto: "Diagnóstico", icono: "🔧", grupo: "oculto", oculta: true },
];

const POR_ID = new Map(SECCIONES.map(s => [s.id, s]));
export const seccion = id => POR_ID.get(id) || null;

/** Pestañas navegables (todo menos los modales): lo que acepta `activeTab`. */
export const IDS_PESTAÑA = SECCIONES.filter(s => !s.modal).map(s => s.id);

/** Lo que se puede poner en la barra inferior. */
export const PARA_BARRA = SECCIONES.filter(s => !s.modal && !s.oculta);

/** Ítems del menú lateral de un grupo, en orden. */
export const delGrupo = grupo => SECCIONES.filter(s => s.grupo === grupo);

/** Título de la cabecera de una sección. */
export function tituloCabecera(id, { semana } = {}) {
  const s = seccion(id);
  if (!s) return "";
  if (id === "current" && semana != null) return `${s.icono} Semana ${semana}`;
  return `${s.icono} ${s.titulo || s.nombre}`;
}

// ── Barra inferior ──────────────────────────────────────────────────────────
export const MAX_BARRA = 5;
export const BARRA_DEFECTO = { enabled: true, tabs: ["home", "current", "calendar", "mood"] };

/**
 * Limpia una configuración guardada: quita ids que ya no existen o que no
 * pueden ir en la barra, duplicados, y recorta al máximo. Antes los ids
 * desconocidos se ocultaban al pintar pero seguían contando: ocupaban un
 * hueco invisible y podían impedir añadir pestañas.
 */
export function sanearBarra(cfg) {
  const valido = new Set(PARA_BARRA.map(s => s.id));
  const tabs = Array.isArray(cfg?.tabs) ? cfg.tabs : BARRA_DEFECTO.tabs;
  const limpios = [...new Set(tabs.filter(id => valido.has(id)))].slice(0, MAX_BARRA);
  return { enabled: cfg?.enabled !== false, tabs: limpios };
}
