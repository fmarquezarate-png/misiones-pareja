// El tour de la app, guiado por Misi.
//
// Sustituye al tutorial de v1 (10 pasos, "Shared Calendar", "14 temas", sin
// Salud, sin mascota, sin Mi Equipo, sin La Copa ni Notitas), que además
// estaba definido DOS veces (TutorialOverlay.jsx y appConstants.js, esta
// última sin usar). Una sola fuente, aquí.
//
// Reglas de este guion:
//  · Cada paso lleva a su sección DE VERDAD (`tab`) para que se vea detrás.
//  · Las rutas que se nombran ("⚙️ → Ajustes → Apariencia…") están
//    comprobadas contra el código (ProfileModal/Topbar), no escritas de
//    memoria. Si cambian, el test de tour lo detecta por las secciones.
//  · Nada de números que caducan: el nº de temas se calcula (THEMES.length).
//  · Misi cambia de emoción según lo que cuenta.

export const CLAVE_TOUR = "mp-tour-v6";

/**
 * @param {{ nombre?: string, temas?: number, tieneMascota?: boolean, tieneEquipo?: boolean }} ctx
 * @returns {Array<{ id, tab, emocion, titulo, texto, cta? }>}
 */
export function pasosTour({ nombre, temas = 15, tieneMascota = false, tieneEquipo = false } = {}) {
  const hola = nombre ? `¡Hola, ${nombre}!` : "¡Hola!";
  return [
    { id: "hola", tab: "home", emocion: "alegre",
      titulo: `${hola} Soy Misi`,
      texto: "Os enseño la casa en un minuto. Voy abriendo cada sección para que la veas detrás de mí. Puedes saltarlo cuando quieras." },
    { id: "inicio", tab: "home", emocion: "alegre",
      titulo: "El Inicio",
      texto: "Vuestro día de un vistazo: lo de hoy, lo próximo, lo atrasado y cómo vais cada uno. Arriba cambia según el momento: una notita, el agradecimiento del día… y si juega tu equipo, el partido en directo." },
    { id: "semana", tab: "current", emocion: "pensando",
      titulo: "La Semana, el corazón",
      texto: "Aquí se reparten las misiones. Añade con «✅ + Tarea» o «📅 + Evento». Toca el estado de una tarea para avanzarla: TBC → ASAP → En curso → Hecho." },
    { id: "calendario", tab: "calendar", emocion: "pensando",
      titulo: "El Calendario",
      texto: "El mes entero. Toca cualquier fila para abrir y editar ese evento; los que duran varios días se ven de punta a punta." },
    { id: "mascota", tab: "salud", emocion: "inspirado",
      titulo: "Salud: tu mascota",
      texto: tieneMascota
        ? "Aquí vive tu mascota. Crece con tus hábitos —sueño, pasos, ejercicio—, se despierta un poco después que tú, entrena contigo y se alegra si la tocas. Si la descuidas mucho, se pone triste."
        : "Aquí vivirá tu mascota: eliges a Broot o a Nix, nace en su huevo y crece con tus hábitos —sueño, pasos, ejercicio—. Se despierta un poco después que tú, entrena contigo y se alegra si la tocas." },
    { id: "panel", tab: "salud", emocion: "pensando",
      titulo: "Tu panel de salud",
      texto: "Debajo, tus metas de la semana y cómo vas de sueño, pulso, pasos y energía. Toca cualquier caja para ver el detalle: tu mejor y tu peor día… o para preguntarme a mí." },
    { id: "equipo", tab: "team", emocion: "inspirado",
      titulo: "Mi Equipo",
      texto: tieneEquipo
        ? "Tu club: partidos en directo, clasificación, pronóstico de la temporada y goleadores. Cuando haya partidos nuevos, te propongo añadirlos al calendario."
        : "Elige tu club y tendrás sus partidos en directo, la clasificación, el pronóstico de la temporada y los goleadores. Hasta te propongo añadir los partidos al calendario." },
    { id: "nosotros", tab: "trophy", emocion: "alegre",
      titulo: "Lo vuestro",
      texto: "En el menú ☰, dentro de «Nosotros»: las Notitas del corcho, La Copa con todos vuestros agradecimientos, las Metas, el Ánimo, los Cumpleaños y la Cápsula del tiempo." },
    { id: "accesos", tab: "home", emocion: "pensando",
      titulo: "Tus atajos",
      texto: "¿Hay secciones que usas mucho? Ponlas en la barra de abajo: ⚙️ → Ajustes → Apariencia → Barra de navegación inferior. Cualquier sección vale, Salud incluida." },
    { id: "misi", tab: "home", emocion: "escribiendo",
      titulo: "Y yo, aquí",
      texto: "Vivo abajo a la derecha (si te estorbo, arrástrame a la otra esquina). Tócame cuando quieras: te respondo sobre vuestras misiones y vuestra semana." },
    { id: "fin", tab: "home", emocion: "alegre",
      titulo: "¡Listo!",
      texto: `En ⚙️ → Ajustes cambias foto, nombre, tema (hay ${temas}) y tipografía, y activas los avisos. Para repetir este tour: ⚙️ → Ajustes → Avisos y más.`,
      cta: tieneMascota ? null : { texto: "Adoptar mi mascota 🥚", tab: "salud" } },
  ];
}
