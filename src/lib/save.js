// save.js — helpers puros del núcleo de guardado (rediseño v4.2.0)
//
// El path de guardado usa CAS (Compare-And-Swap) con rebase-on-conflict:
// cuando la pareja guarda primero, en vez de DESCARTAR el cambio local (bug
// histórico de pérdida de datos), recargamos los datos frescos de la pareja y
// RE-APLICAMOS encima los mutadores locales no confirmados.
//
// Estos helpers se mantienen puros para poder testearlos sin montar React.

/**
 * Re-aplica una lista de mutadores (funciones puras estado→estado) sobre una
 * base fresca. Si el resultado no pasa la validación, devuelve la base sin
 * cambios (nunca persistimos datos corruptos).
 *
 * @param {object} fresh   estado fresco traído de la DB (datos de la pareja)
 * @param {Array<(d:object)=>object>} mutators  mutadores locales sin confirmar
 * @param {(d:object)=>boolean} isValid  validador estructural
 * @param {(reason:string)=>void} [onDrop]  callback opcional cuando se descarta
 *        la intención del usuario (telemetría) — "mutator_threw" | "invalid_result".
 *        Se mantiene como callback para no romper la pureza de este módulo.
 * @returns {object} estado fusionado (fresh + intención local) o fresh si inválido
 */
export function rebaseMutators(fresh, mutators, isValid, onDrop) {
  let rebased = fresh;
  for (const m of mutators) {
    try {
      rebased = m(rebased);
    } catch {
      // Un mutador que falla sobre datos frescos (p.ej. la misión que tocaba
      // ya no existe) se ignora — la intención ya no aplica. Pero un descarte
      // de intención del usuario NO puede ser invisible: lo señalamos.
      try { onDrop?.("mutator_threw"); } catch { /* telemetría nunca rompe el save */ }
    }
  }
  if (isValid(rebased)) return rebased;
  try { onDrop?.("invalid_result"); } catch { /* idem */ }
  return fresh;
}
