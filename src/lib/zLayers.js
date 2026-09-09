// Escala de capas (v5.27.0).
//
// Los z-index se habían ido asignando a ojo, componente a componente, hasta
// tener 34 valores distintos entre 1 y 9999 sin ningún orden pensado. El
// resultado era un bug real: `ConfirmModal` estaba en 900 — por DEBAJO del
// toast (1000), del botón del día especial (1200), del chat de Misi, de las
// encuestas y de las celebraciones (2000/2100). Es decir, el diálogo que
// bloquea para pedir una decisión —incluido el write-guard que protege contra
// perder misiones— podía quedar tapado y la app parecía congelada.
//
// Regla: una decisión que bloquea SIEMPRE va encima de todo lo demás.
//
// Por debajo de `AMBIENT` viven las capas internas de cada vista (cabeceras
// pegajosas, popovers anclados, drawers): no se tocan desde aquí porque solo
// compiten entre hermanos dentro de su propia vista.
export const Z_IN_VIEW_MAX = 300;

export const Z = {
  AMBIENT:     400,  // decorado de fondo (confeti, globos) — pointer-events: none
  MASCOT:      500,  // Misi
  FAB:         600,  // botones flotantes (día especial, partido)
  SHEET:       700,  // paneles a pantalla completa: chat, encuestas, informes, ritual
  CELEBRATION: 800,  // celebraciones (juntos, cumple/aniversario, partido, progreso)
  BANNER:      850,  // avisos persistentes del sistema (mantenimiento)
  TOAST:       900,  // avisos efímeros
  DIALOG:     1000,  // decisiones que bloquean — confirmar, write-guard. SIEMPRE arriba.
  SPARKLES:   1100,  // destellos decorativos, pointer-events: none, no tapan nada
};

// Orden esperado, de abajo arriba. La prueba lo verifica para que nadie meta
// una capa nueva a ojo y vuelva a enterrar el diálogo.
export const Z_ORDER = [
  "AMBIENT", "MASCOT", "FAB", "SHEET", "CELEBRATION", "BANNER", "TOAST", "DIALOG", "SPARKLES",
];
