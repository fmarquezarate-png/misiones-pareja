// "Nuestro momento" (4.3): ideas de plan en pareja. Al elegir una se prellena
// el formulario de evento (título/emoji/categoría) para que la pareja solo
// tenga que ponerle fecha. Datos + selección puros y testeables.

export const DATE_IDEAS = [
  { title: "Cena a la luz de las velas en casa", emoji: "🕯️", category: "pareja" },
  { title: "Ver el atardecer juntos",            emoji: "🌅", category: "pareja" },
  { title: "Ruta de senderismo",                 emoji: "🥾", category: "deporte" },
  { title: "Noche de juegos de mesa",            emoji: "🎲", category: "ocio" },
  { title: "Picnic en el parque",                emoji: "🧺", category: "ocio" },
  { title: "Maratón de pelis con manta",         emoji: "🍿", category: "ocio" },
  { title: "Cocinar una receta nueva juntos",    emoji: "🍳", category: "casa" },
  { title: "Escapada de un día a un pueblo",     emoji: "🚗", category: "viaje" },
  { title: "Clase de baile en casa",             emoji: "💃", category: "pareja" },
  { title: "Desayuno especial en la cama",       emoji: "🥐", category: "pareja" },
  { title: "Visitar un museo o una expo",        emoji: "🖼️", category: "ocio" },
  { title: "Sesión de spa casero",               emoji: "🧖", category: "salud" },
  { title: "Paseo en bici juntos",               emoji: "🚴", category: "deporte" },
  { title: "Noche de estrellas y mantita",       emoji: "✨", category: "pareja" },
  { title: "Probar un restaurante nuevo",        emoji: "🍽️", category: "social" },
  { title: "Tarde de café y libros",             emoji: "☕", category: "ocio" },
];

// Selección circular tolerante a índices negativos o fuera de rango.
export function pickDateIdea(index, ideas = DATE_IDEAS) {
  if (!ideas.length) return null;
  const i = ((index % ideas.length) + ideas.length) % ideas.length;
  return ideas[i];
}
