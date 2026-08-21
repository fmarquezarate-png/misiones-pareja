// Autoría estable de entradas compartidas de la pareja (notitas de amor,
// gratitud). Si la entrada tiene `fromId` (person-id) y conocemos el nuestro,
// decidimos por id → sobrevive a que alguien se renombre en Perfil. Si no
// (entradas anteriores a person-id), caemos al nombre. Puro.
export function isMineEntry(entry, myName, myPersonId) {
  if (entry?.fromId && myPersonId) return entry.fromId === myPersonId;
  return entry?.fromName === myName;
}
