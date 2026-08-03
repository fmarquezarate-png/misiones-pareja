// Lógica pura de reacciones/kudos (3.1). Estado: reactions[targetId] = { emoji:
// [personId...] }. Se extrae aquí para poder testearla sin instanciar nada.

// Devuelve el nuevo mapa de reacciones tras alternar la reacción `emoji` de
// `myId` sobre `targetId`. `added` fija la intención (true = añadir, false =
// quitar), calculada por el caller sobre el estado fresco → el reducer es puro
// e idempotente (seguro ante el rebase de conflicto CAS). Limpia entradas
// vacías para no dejar basura en el blob.
export function applyReactionToggle(reactions, targetId, emoji, myId, added) {
  const all = { ...(reactions || {}) };
  const forTarget = { ...(all[targetId] || {}) };
  const who = (forTarget[emoji] || []).filter(x => x !== myId);
  if (added) who.push(myId);
  if (who.length) forTarget[emoji] = who; else delete forTarget[emoji];
  if (Object.keys(forTarget).length) all[targetId] = forTarget; else delete all[targetId];
  return all;
}

// ¿Ya reaccionó `myId` con `emoji` a `targetId`? (para calcular la intención)
export function hasReacted(reactions, targetId, emoji, myId) {
  return !!(reactions?.[targetId]?.[emoji] || []).includes(myId);
}
