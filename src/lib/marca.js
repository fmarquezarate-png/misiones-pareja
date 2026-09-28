// El nombre de la app, en UN solo sitio.
//
// Convivían "Shared Calendar" (icono del móvil, cabecera, login, PDF) y
// "Misiones de Pareja" (notificaciones, vista de invitado, informes). Fran
// eligió "Shared Calendar" (28/09/2026). Todo texto de cara al usuario usa
// esta constante; módulo diminuto a propósito para que lo pueda importar
// también el service worker sin arrastrar constants.js.
//
// OJO: NO es lo mismo que los nombres internos. `localStore.js` guarda la
// copia offline en una base de datos llamada "misiones-pareja": cambiarla
// dejaría a todo el mundo sin su copia local. Esa se queda como está.
export const APP_NAME = "Shared Calendar";
