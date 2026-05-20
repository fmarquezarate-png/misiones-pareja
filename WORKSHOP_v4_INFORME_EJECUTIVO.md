# Informe Ejecutivo · Workshop v4.0.0
## Misiones de Pareja — del bugfix infinito al producto maduro

> **Fecha:** 19 de mayo de 2026
> **Versión actual en producción:** 3.4.1
> **Versión objetivo:** 4.0.0
> **Participantes del workshop:** Coordinador, UI/UX, Programador, Analista, Experto en Datos, Redactor (autor de este informe)
> **Documento de referencia externa:** `v4.0.0IMPLEMENTACION.md` (consultor externo, 1.655 líneas, 4 fases)

---

## 1. Resumen ejecutivo

Misiones de Pareja llega al Workshop v4.0.0 en una posición incómoda y privilegiada a la vez. Incómoda porque la app, salida de una racha de bugfixes críticos (guardado infalible, iOS PWA fix), vive sobre un monolito de **4.276 líneas en `src/App.jsx`** y un único blob JSON en la columna `app_data.data` que, cuando dos personas editan a la vez, **pierde datos silenciosamente en ventanas de hasta 4 segundos**. Privilegiada porque tiene una pareja real, activa, midiendo cada decisión en producción: nada de hipótesis de mercado, nada de personas inventadas, nada de "métricas vanidosas". La app sabe a quién sirve.

El workshop, conducido por cinco expertos durante varias jornadas y contrastado con la implementación recomendada por el consultor externo, llega a tres conclusiones consolidadas:

1. **El cuello de botella real de v4.0 no es la falta de features, es la fragilidad invisible de los cimientos.** La race condition entre Realtime y Save está resuelta a medias. El skip silencioso de `isValidAppData` puede destruir trabajo sin que nadie se entere. La telemetría que el equipo cree tener probablemente no existe. Cualquier feature visible que se construya sobre esto añade superficie de fallo.
2. **El mayor riesgo no técnico es la tentación del scope.** Siete temas. Tres de ellos (Push real, rediseño de Gastos, normalización del schema) son inversiones de semanas. Hacerlos todos en paralelo es la receta para no entregar ninguno bien.
3. **El cambio de modelo de datos (blob → normalizado) es el "punto de no retorno" del año.** Hacerlo bien protege los próximos doce meses; hacerlo mal pierde el trabajo de los próximos doce meses. Exige backup verificado, dual-write transitorio y feature flags por pareja.

**La decisión más importante a tomar antes de arrancar:** confirmar con datos de telemetría si la pareja registra gastos en la app hoy. Si la respuesta es "casi nunca", el rediseño completo de la pestaña Gastos (8-12 días) se aplaza a v4.1 y se libera ese sprint para Push o normalización. Si la respuesta es "varias veces por semana", Gastos entra a v4.0 con prioridad. Sin ese dato, cualquier decisión es fe.

**Inversión estimada:** 10 sprints (~12 semanas calendario, 8-9 semanas de trabajo efectivo), repartidos en seis releases intermedias (3.5 → 3.6 → 3.7 → 3.8 → 3.9 → 4.0). El "salto v4.0" no se entrega en un único día: se entrega en seis incrementos verificables, cada uno con kill-switch.

---

## 2. Diagnóstico actual: lo que el equipo no se atreve a decir

El Analista abrió el workshop con una frase que marcó el tono de todo lo que vino después: la app pesa unas 6.000 líneas de código, y **el 90% de la lógica vive en un único archivo de 4.276 líneas**. No es un detalle estilístico. Es la razón por la que cada keystroke en la vista de Gastos re-renderiza, entre otras cosas, el canvas de Stats. Es la razón por la que extraer cualquier feature exige más diligencia de la que parece. Y es la razón por la que la cobertura de tests es esencialmente cero: no hay forma sensata de testear un componente que es la app entera.

### Mapa de calor de calidad

| Área | Puntuación (1-10) | Notas |
|---|---|---|
| Auth | **8** | Sólido. Supabase Auth + magic link, sin sorpresas. |
| Save | **6** | Race condition resuelta a medias. Sin medición de latencia. |
| Sync Realtime | **5** | Sobrescribe estado local durante ventana de 0.3-4 s post-save. |
| Gastos | **4** | El módulo más débil. Re-render completo en cada keystroke. |
| Goals | **6** | El changelog promete drill-down que no existe en el código. |
| Stats | **5** | Cero memoización. Deep Stats falla en silencio si faltan datos. |
| Gestos | **7** | Swipes bien implementados, limitados a semanas. |
| Themes | **8** | Bien resuelto. Pre-hydrate evita FOUC desde la Fase 1 del consultor. |
| Notificaciones | **3** | Solo notif locales con `setTimeout` en memoria. Mueren al cerrar tab. |

### Los 5 riesgos invisibles

El Analista identificó cinco patologías que el equipo asume resueltas y no lo están. En orden de impacto:

1. **Race condition Realtime/Save.** El equipo cree que `hasPendingSave` cubre el caso. Cubre el debounce timer y el flag `pendingSave`, pero deja al descubierto la ventana entre "el timer disparó `saveWithRetry`" y "`saveData` resolvió OK". En ese intervalo (0.3 a 4 segundos en 4G), un update remoto del partner ejecuta `setData(() => remoteData)` en App.jsx:1061 y **el usuario ve cómo sus cambios desaparecen y vuelven a aparecer**. Es el bug que más mina la confianza.
2. **Payload lineal con todo.** El blob completo se manda en cada save. ~200 KB por semana × 52 semanas = **~10 MB por upsert con fotos en base64**. En 4G, eso son entre 2 y 5 segundos. Y se envía en cada cambio de status. Si una pareja edita 30 misiones en una tarde, **se han movido 300 MB de datos** para guardar 30 enteros.
3. **Telemetría silenciosa.** `track.js:38-43` ignora cualquier error de la tabla `events` además del `42P01`. Dicho de otra forma: el equipo puede creer durante meses que tiene métricas y no tener absolutamente ninguna. Esto invalida cualquier conversación "data-driven" sobre features.
4. **Fechas y timezones rotas en frontera.** Múltiples llamadas a `new Date(m.date)` sin TZ explícita. Una pareja en zonas horarias distintas (Madrid/Santiago, por ejemplo) puede ver el mismo gasto en meses distintos. En Stats esto rompe comparativas; en Gastos rompe balances.
5. **`isValidAppData` skip silencioso (App.jsx:1115).** Si un bug corrompe el estado, la función decide no guardar y no avisa. El usuario sigue editando, los datos no persisten, y nadie se entera hasta que la pareja descubre un día que perdió la semana.

Como el Analista resumió, **el peor tipo de bug**:

> *"Es silencioso, no reproducible, destruye confianza. Es el que no aparece en ningún issue porque la víctima asume que se equivocó ella."*
> — Analista

### Lo que el changelog miente

El changelog v3.2.1 promete celdas clickeables en el historial de Goals. **El código actual no las tiene.** Las celdas son `<div>` con atributo `title`, sin `onClick`. O la mejora se hizo en una rama que nunca llegó a `main`, o se redactó como aspiracional. En cualquier caso es una señal de que **el changelog no se valida contra el código real**, y eso es deuda de proceso, no solo de producto. La buena noticia: convertir esas celdas en botones reales (Tema 6) es **la mejora de mayor ROI y menor esfuerzo de todo el workshop** (~60 líneas).

### La salud financiera del save flow

Si traducimos los números del Analista y el Programador a una factura mensual de ancho de banda:

- Blob completo: **~200 KB sin fotos, ~10 MB con fotos en base64**
- Saves por sesión activa: **15-40 (debounced a 1 s)**
- Ventana de race condition Realtime: **0.3-4 segundos**
- Tiempo medio de upsert en 4G con blob de 10 MB: **2-5 segundos**

Estos números son la prueba de que **Tema 2 (optimización de save) no es opcional, es prerrequisito de cualquier escalado**. El Coordinador, fiel a su sesgo declarado, insiste en que no se toque sin telemetría que grite. El Programador y el Experto en Datos coinciden en que la telemetría ya está gritando en otro idioma: el del consumo móvil del usuario.

---

## 3. Las cinco visiones del workshop

### 3.1 · El Coordinador — el guardián del scope

> *"Mi sesgo declarado para este workshop: prefiero menos features mejor terminadas que un v4.0 inflado. Y digo NO temprano y fuerte."*
> — Coordinador

Su aporte central es haber convertido siete temas en una matriz Impacto/Esfuerzo legible, y haber escrito **diez sprints (A-J)** con releases intermedias verificables. No es accidental que sus tres líneas rojas se lean como un manifiesto de contención: Tema 2 no entra sin datos, Tema 3 no entra sin uso real, v4.0 no son siete features mediocres.

Sus tres aportes mayores:

1. **El Sprint A como sprint cero obligatorio.** Antes de tocar ninguna feature, instalar telemetría y feature flags. Sin eso, todo lo demás es opinión.
2. **El Sprint C como "punto de no retorno".** Antes de iniciar la normalización del schema, backup SQL verificado por escrito. No es ceremonia: es la diferencia entre una migración y un desastre.
3. **La comunicación al usuario antes de Fase 2.** Tono honesto, plan B explícito: *"Tengo plan de marcha atrás listo, en menos de 1 hora restauramos si algo falla."*

**Cómo dialoga con los demás:** el Coordinador es el contrapeso natural del UI/UX (que querría rediseñarlo todo) y del Programador (que está listo para refactorizar). Su tensión más fértil es con el Experto en Datos: ambos respetan el riesgo, pero el Coordinador prefiere aplazar y el Experto en Datos prefiere blindar. La síntesis de esa tensión es el dual-write transitorio.

**Su línea roja:** "v4.0 es push + datos normalizados + 2-3 features visibles, no 7 mediocres."

### 3.2 · El UI/UX — la postal mental de Marta

> *"Marta va de pie en la línea 5, una mano en la barra, la otra con el móvil, guantes finos, batería al 23%. Si nuestra interfaz no funciona en ese contexto, no funciona."*
> — UI/UX

El diseñador entró al workshop con una herramienta narrativa, no analítica, y fue precisamente esa herramienta la que reorganizó el debate. Marta no es una persona de marketing: es un filtro de prioridades. Cada decisión técnica se valida contra ella. ¿La acción primaria está en la esquina superior derecha? Marta no llega con el pulgar. ¿La acción exige tres taps? Marta cierra la app antes de terminar.

Sus tres aportes mayores:

1. **Los cinco principios de diseño v4.0** (recogidos íntegros en la sección 6 de este informe), que sirven a partir de ahora como criterio de aceptación de cualquier vista nueva.
2. **El reframe de "Logros" como timeline emocional.** Pasar de "lista plana de logros" a "diario de la pareja" con racha y récord semanal cambia la temperatura del módulo entero.
3. **Stats narrativos tipo Spotify Wrapped.** En vez de nueve gráficos densos, **tarjetas verticales con scroll snap, cada una al 70-80% del viewport**, con narrativa amistosa. Es el contraste exacto con la trampa del scope que advierte el Coordinador en Tema 7.

**Cómo dialoga con los demás:** el UI/UX y el Analista están de acuerdo en que Gastos es la peor tab del producto, pero por motivos diferentes. El Analista la diagnostica como código (450 líneas inline, sin memoización, hardcoded a CLP); el UI/UX la diagnostica como experiencia (selector de moneda innecesario, descripción larga obligatoria, Splitwise-clon donde solo hay dos personas). La recomendación final (sección 4.3) integra ambas lecturas.

**Su línea roja:** *"Si tengo que elegir una sola batalla para v4.0.0, es la pestaña Gastos. Es donde más sangra el usuario y donde más alegría podemos generar arreglándola bien."*

### 3.3 · El Programador — pragmatismo con código real

> *"La base está más sana de lo que parece — el cuello de botella real son 3 cosas: el monolito App.jsx, el blob JSON único, y la ausencia de push real."*
> — Programador

El Programador no llegó con una visión, llegó con un plan. Sus cinco sprints (v3.5 a v4.0) son la articulación más operativa del workshop. Mientras el Coordinador defiende el scope y el UI/UX defiende al usuario, el Programador defiende **el orden de las decisiones técnicas**.

Sus tres aportes mayores:

1. **El orden contraintuitivo del roadmap.** Push primero "porque es lo más wow" es la trampa. El Programador propone: v3.5 wins de cliente sin backend (Logros + Goals drill-down + Insights), v3.6 mobile-first UX, v3.7 bulletproof save, v3.8 Push real, v4.0 Expenses 2.0. **Cliente antes que servidor; sólido antes que llamativo.**
2. **La estrategia de extracción modular sin Big Bang.** Mover GastosView a `src/views/expenses/`, crear schema separado, migración con feature flag, sin tocar el blob hasta que el flag esté verde. Es la misma filosofía del consultor externo, aterrizada con líneas de archivo concretas.
3. **Los handlers de iOS PWA.** Sí funciona iOS 16.4+ si está añadida a pantalla de inicio. Riesgo a tratar: VAPID keys no se pueden rotar sin re-suscribir, y iOS invalida suscripción si quitan la PWA.

**Cómo dialoga con los demás:** el Programador y el Experto en Datos hablan el mismo idioma, pero sobre piezas distintas del problema. El Programador piensa en componentes y archivos; el Experto en Datos piensa en filas y consistencia. Coinciden, casi al pie de la letra, en el dual-write como estrategia de migración.

**Su línea roja:** *"La tentación es atacar Push primero porque es lo más wow. Resistila. Si haces Push antes que el guardado optimizado, vas a tener race conditions visibles para el usuario."*

### 3.4 · El Experto en Datos — el guardián de la integridad

> *"El modelo BLOB único en `data jsonb` es una bomba de relojería que ya escuchamos hacer tic. Cada save de 200KB compite con cada otro save de 200KB, y el last-write-wins de Postgres sin version field significa que hoy mismo, en producción, perdemos datos silenciosamente cuando dos personas editan en la misma ventana de 700ms."*
> — Experto en Datos

Si el Analista diagnostica el presente, el Experto en Datos diseña el futuro. Sus aportaciones son las más quirúrgicas del workshop: cada problema viene con su DDL listo, cada riesgo con su trigger SQL.

Sus tres aportes mayores:

1. **La columna `version bigint` con UPDATE condicionado.** Es la solución de raíz a la race condition que el equipo cree resuelta. CAS (compare-and-swap) a nivel de fila: si la versión no coincide, se re-fetch y se mergea. Cero pérdidas silenciosas.
2. **Una sola policy `for all` por tabla con `using` y `with check` idénticos.** Elimina el gotcha de SELECT más estricto que UPDATE, que es una clase entera de bugs de seguridad. Para siempre.
3. **El dual-write transitorio como contrato de migración.** Source-of-truth blob durante 2-3 semanas, escribir también a tablas normalizadas, job nocturno de verificación, flip de read cuando consistencia >99.9%. **Big-bang no.**

**Las 7 garantías irrompibles v4.0** que propone (sección 6 de este informe) son el manifiesto técnico del workshop. No son aspiracionales: son medibles, alarmables y verificables por dashboard.

**Cómo dialoga con los demás:** su tensión más rica es con el Coordinador. El Coordinador quiere aplazar lo que no tenga telemetría; el Experto en Datos quiere blindar antes de que la telemetría sea posible. La salida de esa tensión es el Sprint A (telemetría + feature flags) como prerrequisito de todo.

**Su línea roja:** *"Additive-only en primera fase. Drop de columnas/tablas en migration separada DESPUÉS de >95% de clientes nuevos. No te atrevas a borrar `couples.data` hasta 30 días después de Fase 2 completa."*

### 3.5 · El Analista — la voz incómoda

El Analista ocupó el rol más ingrato del workshop: el de quien señala lo que el equipo prefiere no mirar. Sus tres aportes mayores son tres dedos en tres llagas:

1. **El skip silencioso de `isValidAppData`.** No hay bug más caro que el que oculta el daño.
2. **El payload de 10 MB por upsert con fotos.** No hay decisión de UX que sobreviva a esa factura.
3. **El changelog miente.** No hay disciplina de producto sin disciplina de documentación.

**Cómo dialoga con los demás:** el Analista valida o invalida lo que los otros cuatro proponen. Cuando el UI/UX propone bottom sheet en Goals, el Analista confirma: el 80% del código ya existe (`GoalCard` tiene `setDetailIdx(i)` en línea 182), solo falta abrir algo útil. Cuando el Coordinador propone empezar por telemetría, el Analista confirma: la telemetría actual probablemente no existe.

**Su línea roja:** "El changelog miente. Si seguimos así, la app va a entregar features que el código no contiene, y ningún roadmap aguanta eso dos versiones seguidas."

---

## 4. Análisis tema por tema

### Tema 1 — Notificaciones push reales (Web Push + VAPID)

**El problema en una frase.** Hoy solo hay notificaciones locales con `setTimeout` en memoria: si el usuario cierra la tab, el aviso muere; en iOS PWA prácticamente no funciona; los recordatorios de Goals solo disparan si la app está abierta el día correcto.

**Visión consolidada del equipo.** Los cinco expertos coinciden en que Push es la feature más visible de v4.0 y la que más justifica el salto de versión. Coinciden también en que **iOS 16.4+ funciona solo si la PWA está instalada en pantalla de inicio**, y en que esto exige onboarding contextual. El UI/UX advierte contra pedir permiso al primer uso ("anti-patrón clásico"); el Programador propone el plan de cinco pasos con VAPID + Edge Function; el Experto en Datos blinda la tabla `push_subscriptions` con `unique(couple_id, endpoint)` y manejo de `410 Gone`; el Analista certifica que hoy no hay nada de infraestructura; el Coordinador la mete en P1 con 5/5 de valor.

**Recomendación final.** **Push entra a v4.0 como bandera, ubicada en el Sprint E (v3.7.0 fase 1) y Sprint F (v3.8.0 fase 2)**, después del bulletproof save. Sin save sólido, push genera el peor bug posible: *"me llegó la notif pero no veo el cambio"* (cita del Programador).

**Plan de acción.**
1. **Sprint E · día 1-2:** generar VAPID keys, configurar env vars (Netlify + Supabase), crear tabla `push_subscriptions`.
2. **Sprint E · día 3-4:** migrar a `injectManifest` para SW propio con handlers `push` y `notificationclick`.
3. **Sprint E · día 5:** módulo `src/lib/push.js` con `subscribeToPush()` y manejo de iOS standalone.
4. **Sprint F · día 1-3:** Edge Function `send-push` (Deno) con triggers SQL en `app_data` y `messages`, cron `pg_cron` cada 5 min para event reminders.
5. **Sprint F · día 4-5:** UI contextual (mini-prompt antes del prompt nativo, configuración granular con 4 switches, inbox interno con campana).

**Riesgos a mitigar.** VAPID keys no rotables sin re-suscribir (custodia estricta de la private key como secret de Supabase). iOS invalida suscripción si el usuario quita la PWA (handler `pushsubscriptionchange` obligatorio). Sin save sólido previo, race conditions visibles.

**Métrica de éxito.** ≥80% de notificaciones disparadas confirmadas como entregadas en <60 s; ≥0 incidencias del tipo "me llegó la notif pero no veo el cambio" durante las primeras dos semanas.

### Tema 2 — Guardado automático: optimizaciones avanzadas

**El problema en una frase.** El save actual envía blobs completos de hasta 10 MB en cada cambio, tiene una race window de 0.3-4 s con Realtime y, en ciertos estados, se salta el guardado sin avisar.

**Visión consolidada del equipo.** El Coordinador lo coloca en P3 ("no se toca sin telemetría que grite"). El Analista grita: la race condition no está resuelta, el payload escala lineal con fotos, y el skip silencioso pierde trabajo. El Programador propone dirty-tracking por semana + JSONB patch + columna `version`. El Experto en Datos eleva la apuesta a CAS (compare-and-swap) a nivel de fila con re-fetch + merge en conflicto, alinea las policies de RLS con una sola policy `for all`, y reemplaza `localStorage` por IndexedDB para la queue offline. El UI/UX define los tres niveles de feedback: microestado en topbar, banner discreto cuando el partner edita, modal honesto en conflicto.

**Recomendación final.** **Tema 2 entra a v4.0 como prerrequisito de Push**, contra la priorización P3 del Coordinador. La razón: las métricas que el Coordinador pedía ya existen en cifras crudas del Analista (10 MB por upsert, 0.3-4 s de race window). La telemetría llegará en Sprint A para confirmar magnitud, pero **el orden técnico es claro: bulletproof save antes de Push**.

**Plan de acción.**
1. **Sprint G · día 1:** añadir columna `version` + trigger `bump_app_data_version` + UPDATE condicionado.
2. **Sprint G · día 2-3:** función `update(fn)` que devuelve `dirtyWeekKeys`; RPC `save_patch(coupleId, patch, version)` con `data || $patch`.
3. **Sprint G · día 4:** alinear policies SELECT/UPDATE con función `couple_owns(target)` y una sola policy `for all`.
4. **Sprint G · día 5-6:** IndexedDB con `idb-keyval` reemplaza localStorage; drain en `online`, `visibilitychange→visible`, Background Sync (Android).
5. **Sprint G · día 7:** `beforeunload` con `navigator.sendBeacon` como último recurso; eliminar el skip silencioso de `isValidAppData` y reemplazarlo por error visible con auto-reporte a `events`.

**Riesgos a mitigar.** Cualquier regresión en save destruye confianza por meses. Feature flag `cas_version_check` con kill-switch <5 min. Beta de dos usuarios devs antes que pareja real.

**Métrica de éxito.** Save p95 <2 s; conflict rate <2%; queue depth <10 mediana; **cero ediciones perdidas** medidas vía checksum diario.

### Tema 3 — Pestaña Gastos: rediseño completo

**El problema en una frase.** Es la peor tab del producto en código (450 líneas inline, hardcoded a CLP, sin memoización, escribe el array completo en cada gasto) y en experiencia (selector de moneda innecesario, descripción larga obligatoria, lenguaje de Splitwise para una pareja de dos).

**Visión consolidada del equipo.** El UI/UX lo declara **su batalla principal de v4.0**. El Programador propone extraer a `<ExpensesView>` standalone con schema separado en Supabase y migración con feature flag. El Experto en Datos diseña el schema completo (`expense_projects`, `expenses`, `expense_splits`) con constraint `check_splits_sum` deferrable y triggers `touch_updated_at`. El Analista enumera los cinco problemas críticos. **El Coordinador la coloca en P1 condicional: depende de dato real de uso.**

**Recomendación final.** **Gastos depende del Sprint A.** Si la telemetría confirma ≥3 gastos registrados por semana en promedio durante 2-3 semanas, Gastos entra al Sprint G (v3.9.0) como inversión completa de 8-12 días. Si la telemetría dice "casi nunca", Gastos se aplaza a v4.1 y ese sprint se usa para Stats v1 + mejoras móvil/web acotadas. **No invertimos 12 días en construir una catedral vacía.**

**Plan de acción (si entra a v4.0).**
1. **Sprint G · día 1-2:** crear tablas `expense_categories`, `expense_projects`, `expenses`, `expense_splits` con RLS y triggers. Migración additive-only.
2. **Sprint G · día 3-4:** extraer `GastosView` (líneas 3824-4277 de App.jsx) a `src/views/expenses/` modularizado en form/lista/stats/modales/proyectos.
3. **Sprint G · día 5-6:** implementar UX del UI/UX: hero card de balance, pills horizontales de proyectos, lista agrupada por día, FAB persistente, hoja inferior con 3 inputs.
4. **Sprint G · día 7-8:** backfill desde blob, dual-write detrás de flag `expenses_v2_enabled`, job nocturno de comparación.
5. **Sprint G · día 9-10:** flip de read, inferir categoría por keyword, eliminar selector de moneda (asumir EUR), quitar descripción larga obligatoria.

**Riesgos a mitigar.** Migración de gastos existentes sin pérdida (checksum por importe total). Hardcoded de CLP en `fmtAmt` que rompe parejas en EUR/USD. Comparativas hostiles ("Marta hizo el doble que tú").

**Métrica de éxito.** Tiempo medio para añadir un gasto: <8 s desde tap en FAB hasta confirmación visual (hoy: >20 s con form completo). Uso semanal de la tab: +50% respecto a baseline pre-rediseño.

### Tema 4 — Diferencias web vs móvil

**El problema en una frase.** Hoy prácticamente no hay diferenciación: `maxWidth:640` hardcoded en la raíz (App.jsx:1726) hace que el desktop se vea como un móvil con franjas vacías.

**Visión consolidada del equipo.** El UI/UX propone tab bar inferior fijo de 60 px en móvil (agrupando 8 tabs a 5 + "Más"), sidebar izquierda colapsable en web ≥1024 px, panel derecho contextual en Calendario/Stats, y keyboard shortcuts (n, /, g+c, ?, Esc). El Programador insiste en **no duplicar layout**: hook `useIsTouch()` + `useViewport()`. El Coordinador lo coloca en P2 ("entra solo si sobra sprint, máximo 3 mejoras concretas"). El Analista certifica que la safe-area-inset ya está bien usada y que `useSwipe` solo cubre semanas.

**Recomendación final.** **Tres mejoras concretas, no rediseño completo:**
1. Quitar el `maxWidth:640` global. Layout adaptativo con breakpoint a 1024 px.
2. Sidebar izquierda colapsable en web (240 px ↔ 64 px).
3. Keyboard shortcuts mínimos: N (nueva misión), / (foco buscador), 1-8 (cambiar tab), Esc (cerrar modales).

**Plan de acción.**
1. **Sprint H · día 1:** hooks `useIsTouch()` + `useViewport()`.
2. **Sprint H · día 2:** quitar maxWidth:640, breakpoint a 1024 px.
3. **Sprint H · día 3:** sidebar colapsable web.
4. **Sprint H · día 4:** keyboard shortcuts + cheatsheet (`?`).

**Riesgos a mitigar.** Cualquier cambio de layout puede romper safe-area en iOS. Test obligatorio en iPhone real antes de merge.

**Métrica de éxito.** Lighthouse mobile score sin regresión. Encuesta cualitativa al usuario web: "¿usas más la app desde el ordenador?".

### Tema 5 — Submenú en Pendientes y Logros

**El problema en una frase.** Render embebido en switch tab (App.jsx:1974-2096, ~120 líneas inline), cero reutilización entre Pending y Logros, sin filtros por persona ni categoría.

**Visión consolidada del equipo.** El Coordinador lo declara P1 quick win (1-2 días). El UI/UX lo reframea como "timeline emocional" con stats hero cards horizontales, pills filtro por persona y categoría, lista cronológica agrupada por día tipo diario, microinteracción fade-in escalonado. El Programador propone componente reutilizable `<PillFilter>` con dos filas. El Analista confirma que dedup actual por `title+who` lowercase trim puede colapsar tareas legítimas distintas.

**Recomendación final.** **Quick win sin debate: entra al Sprint B (v3.5.0)**, dos días de trabajo, alto ROI emocional para el usuario. Es uno de los dos entregables que justifican la primera release intermedia.

**Plan de acción.**
1. **Sprint B · día 1:** crear `<PillFilter>` reutilizable con dos filas (persona/categoría) y contadores. Reusar en Pending.
2. **Sprint B · día 2:** reframe de Logros como timeline emocional: hero cards horizontales ("Esta semana: 14 logros", "Racha: 6 días"), agrupación por día ("Hoy · 4 logros", "Ayer · 2"), fade-in escalonado, fix de dedup.

**Riesgos a mitigar.** Memoización obligatoria (sin `useMemo`, 500 misiones × keystroke = O(N) por tecla).

**Métrica de éxito.** Tiempo medio en la tab Logros: +30% (proxy de "se mira con más placer").

### Tema 6 — Goals: click en celda de historial → drill-down

**El problema en una frase.** Las celdas son `<div>` sin `onClick`, **el changelog promete clickeabilidad que no existe**, y el usuario no puede ver qué misiones contó cada celda.

**Visión consolidada del equipo.** El UI/UX define la vista en detalle: bottom sheet en móvil o panel derecho en web, header con icono+título+período, barra de progreso fina de 4 px, lista misiones DONE con timestamp y autor, misiones pendientes en gris al final, footer con "Editar meta" + "Ver semana en calendario". El Programador certifica que *"ya tienen el 80% — `GoalCard` tiene `setDetailIdx(i)` en línea 182 pero no abre nada útil"*. El Experto en Datos: mientras el blob viva, calcular cliente con `useMemo` por `(weekRange, version)`. El Analista lo declara **la mejora de mayor ROI / menor esfuerzo del workshop (~60 líneas)**. El Coordinador la coloca en P1 (3-4 días).

**Recomendación final.** **Entra al Sprint B (v3.5.0) junto con el submenú de Logros.** Es el ejemplo perfecto del principio "menos features mejor terminadas": una mejora de 60 líneas que tapa una mentira del changelog y cumple una promesa rota.

**Plan de acción.**
1. **Sprint B · día 1:** extender `computeGoalHistory` con flag `includeMissions: true`.
2. **Sprint B · día 2:** crear `GoalPeriodDetail.jsx` (bottom sheet móvil, modal desktop), reusar `MissionCard` en modo readonly.
3. **Sprint B · día 3:** wiring de `setDetailIdx(i)` para que abra el detalle. Microcopy: "Esta semana superaste la anterior por 2 logros ↑".

**Riesgos a mitigar.** Cero. Es la mejora más barata y segura del workshop.

**Métrica de éxito.** Drill-down abierto al menos una vez por sesión activa en >50% de visitas a Goals.

### Tema 7 — Stats: deducciones inteligentes / análisis profundo

**El problema en una frase.** 11 secciones, 485 líneas, sin memoización, Deep Stats falla en silencio cuando faltan datos, gráficos densos donde el usuario querría una historia.

**Visión consolidada del equipo.** El Coordinador lo marca P2 con explícita advertencia: "trampa de scope, empezar con 3-5 insights estáticos". El UI/UX propone el feed Spotify Wrapped con scroll vertical snap, tarjetas al 70-80% del viewport, tipos de tarjeta (Comparativa amistosa, Streak, Categoría estrella, Tendencia, Insight curioso). El Programador propone `src/lib/insights.js` con funciones puras (`loadBalance`, `consistencyStreak`, `procrastinationByCat`, etc.) cada una devolviendo `{value, label, sentiment, detail}`. El Experto en Datos plantea la vista materializada `stats_weekly` refrescada por `pg_notify` para garantizar que ambos miembros vean exactamente los mismos números. El Analista: 6/11 secciones actuales están bien calculadas, las otras 5 silencian fallos.

**Recomendación final.** **Stats v1 estático con 3-5 insights** en Sprint H (v3.8.0). El "feed Spotify Wrapped" completo se aplaza a v4.1. Razón: trampa de scope confirmada por tres expertos independientes.

**Plan de acción.**
1. **Sprint H · día 1-2:** `src/lib/insights.js` con 5 funciones puras + tests unitarios.
2. **Sprint H · día 3:** hero con 3-4 insight cards horizontales arriba; gráficos detallados abajo sin cambios.
3. **Sprint H · día 4:** filtro Semana/Mes/Año + memoización agresiva.
4. **Sprint H · día 5:** fix del Deep Stats silencioso (mostrar "Aún no hay datos suficientes" en vez de null).

**Riesgos a mitigar.** Comparativas hostiles. Microcopy obligatorio: celebrar, nunca avergonzar. Drift entre persona1 y persona2 (medido vía `events.kind='stats_drift'`).

**Métrica de éxito.** ≥3 insights generados por pareja por semana; <1% drift entre los números que ven los dos miembros.

---

## 5. Roadmap consolidado v3.5 → v4.0

### Tabla de sprints A-J

| Sprint | Release | Duración | Entregable | Hito visible al usuario |
|---|---|---|---|---|
| **A** | — | 5 días | Telemetría real + feature flags + decisión data-driven sobre Gastos | (invisible) Ahora medimos qué usas |
| **B** | **v3.5.0** | 5 días | Submenú Logros + Goals drill-down + reframe timeline emocional | "Ahora puedes filtrar tus logros y abrir cada semana de tus metas" |
| **C** | — | 3 días | **BACKUP SQL obligatorio** + diseño schema normalizado | (invisible) Punto de no retorno técnico |
| **D** | **v3.6.0** | 7 días | Fase 2 parcial: normalización de eventos y metas con dual-write | (invisible) Datos más sólidos |
| **E** | **v3.7.0** | 6 días | Push fase 1: VAPID + suscripción + Edge Function + UI contextual | "Activa las notificaciones cuando te asignen una misión" |
| **F** | **v3.8.0** | 6 días | Push fase 2: triggers completos + drill-down completo de Goals | "Recibe avisos de tu pareja y de tus metas" |
| **G** | **v3.9.0** | 10 días | Gastos rediseñado (si Sprint A confirmó uso) **o** bulletproof save + alineación RLS | "Ahora añadir un gasto son 3 segundos" / "Hemos blindado el guardado" |
| **H** | — | 5 días | Stats v1 con 3-5 insights + mejoras web/móvil acotadas | "Tus stats ahora cuentan historias" |
| **I** | — | 5 días | Hardening: tests, observabilidad, alertas, kill-switches | (invisible) Más seguro |
| **J** | **v4.0.0** | 3 días | Lanzamiento, comunicación, plan de rollback documentado | "Misiones de Pareja 4.0 está aquí" |

Total: ~55 días de trabajo efectivo, ~12 semanas calendario incluyendo testing y buffers.

### Puntos de no retorno

1. **Sprint C — backup SQL.** Antes de cualquier toque al schema, exportar `couples.data` completo a `backup-pre-v4-2026-MM-DD.json`. Confirmar con el usuario que el backup está en al menos dos sitios físicos distintos (su disco + Drive/Dropbox). Sin esto, no se inicia el Sprint D.
2. **Sprint D — primera migración additive-only.** Drop de columnas/tablas en migration separada DESPUÉS de >95% de clientes nuevos, tal como dicta el Experto en Datos.
3. **Sprint E — VAPID keys generadas.** Una vez emitidas y desplegadas, **no se pueden rotar sin re-suscribir a todos los usuarios**. Tratar la private key como secret crítico de Supabase.

### Definición de "hecho" para v4.0.0

Checklist obligatorio antes de marcar v4.0 como release:

- [ ] Push funcionando en iOS (instalada en home), Android (Chrome) y desktop (Chrome/Firefox/Safari).
- [ ] Telemetría con eventos críticos confirmada en dashboard (no solo "creemos que llega").
- [ ] Backup automático verificado (checksum diario).
- [ ] Migración a schema normalizado sin pérdida (checksum entre blob y tablas durante 14 días consecutivos).
- [ ] Feature flags operativos con kill-switch <5 min.
- [ ] Cero regresiones en save medidas por p95 latency.
- [ ] Cero regresiones en iOS PWA (test en dispositivo real, no simulador).
- [ ] Drill-down de Goals funcional.
- [ ] Submenú de Logros funcional.
- [ ] Documentación actualizada (incluido changelog que **no mienta**).
- [ ] Plan de rollback documentado por feature flag.
- [ ] Comunicación al usuario redactada y enviada con plan B explícito.

---

## 6. Las 7 garantías irrompibles v4.0

El Experto en Datos formalizó siete contratos técnicos que la app cumplirá a partir de v4.0. Las publicamos aquí como **compromiso público**:

| # | Garantía técnica | Traducción al usuario |
|---|---|---|
| **1** | Bloqueo <100 ms → cambio llega <5 s al desbloquear | "Tus cambios se ven al instante y se guardan en cuanto el móvil vuelve a tener señal" |
| **2** | No-loss en concurrencia: ediciones distintas misma semana, ambas presentes | "Si los dos editáis a la vez, nadie pierde su trabajo" |
| **3** | Conflicto explícito: misma misión, posterior gana, anterior en `events.kind='conflict'` | "Si los dos cambiáis la misma cosa, gana el último — pero queda registro" |
| **4** | Offline durable: hasta 1000 ediciones IndexedDB FIFO sin perder orden | "Puedes usar la app sin conexión todo el día y nada se pierde" |
| **5** | RLS consistente: una sola policy `for all` por tabla | "Solo tú y tu pareja veis vuestros datos. Punto." |
| **6** | Schema forward-compatible: cliente viejo no borra keys que no conoce | "Aunque uno actualice antes que la otra, nada se rompe" |
| **7** | Stats convergentes: ambas personas ven mismos números <2 s. Drift >1% alerta | "Tus números y los suyos son siempre los mismos" |

Estas garantías no son slogans. Cada una tiene su métrica, su alerta y su test de aceptación en el dashboard de `events`.

---

## 7. Estrategia de riesgo y comunicación

### Plan de rollback por feature flag

Cada feature mayor de v4.0 va detrás de un flag por pareja, controlable desde Supabase sin redeploy:

| Flag | Cubre | Kill-switch |
|---|---|---|
| `push_enabled` | Suscripción y entrega de Push | <30 s |
| `expenses_v2_enabled` | Nueva pestaña Gastos (lectura y escritura) | <1 min |
| `stats_insights_enabled` | Tarjetas de insights en Stats | <30 s |
| `goals_drilldown_enabled` | Bottom sheet de detalle de Goals | <30 s |
| `dual_write_normalized` | Escritura simultánea blob + tablas normalizadas | <5 min |
| `cas_version_check` | Concurrencia con `version bigint` | <5 min |
| `idb_offline_queue` | Queue offline en IndexedDB | <1 min |

**Regla de oro del Experto en Datos:** rollout devs → 5 beta couples → 50% → 100%. Ante cualquier alerta, **se desactiva primero, se diagnostica después.**

### Comunicación al usuario antes de cada hito

Tres comunicaciones obligatorias durante el ciclo v3.5 → v4.0:

1. **Antes del Sprint C (backup + Fase 2):** mensaje honesto, sin tecnicismos, plan B explícito. Texto sugerido del Coordinador: *"Vamos a renovar cómo guardamos vuestros datos. Tengo plan de marcha atrás listo, en menos de 1 hora restauramos si algo falla. Hoy hago backup; si veis algo raro esta semana, decidme."*
2. **Antes del Sprint E (Push):** invitación contextual, no genérica. *"Si quieres saber al instante cuando Carlos te asigne algo, activa las notificaciones desde Ajustes."*
3. **Antes del Sprint J (lanzamiento v4.0):** changelog que **no mienta**, validado contra el código real. Nota de release con las 7 garantías irrompibles traducidas al usuario.

### Indicadores de salud post-deploy

Dashboard en Supabase con cuatro alertas mínimas:

- **Save p95 >2 s:** ralentización del guardado.
- **Conflict rate >2%:** algo no se está mergeando bien.
- **Queue depth >10 mediana:** sincronización offline acumulándose.
- **Stats drift >1%:** persona1 y persona2 ven números distintos.

Más Sentry para errores no controlados y monitoreo Netlify para builds rotos.

### Cuándo dar marcha atrás

**Criterios objetivos para revert inmediato:**
- Cualquier reporte de pérdida de datos confirmada por el usuario.
- Cualquier regresión en iOS PWA reproducible en dispositivo real.
- Conflict rate sostenido >5% durante más de 1 hora.
- Save p95 sostenido >5 s durante más de 1 hora.

Revert vía Netlify rollback (<5 min) + feature flag off (<30 s) + comunicación honesta al usuario en <1 hora.

---

## 8. Decisiones que requieren input del owner

Antes de arrancar el Sprint A, el owner del producto (que es el usuario y el cliente al mismo tiempo) debe responder cinco preguntas concretas. Sin estas respuestas, varias decisiones del roadmap son fe:

1. **¿La pareja registra gastos en la app hoy?** Pregunta gatillo del workshop. Si en la telemetría de las primeras dos semanas del Sprint A se ven ≥3 gastos/semana, **Gastos entra a v4.0**. Si no, se aplaza a v4.1 sin culpa.
2. **¿Aceptamos una ventana de 24 h de "modo lectura" durante la Fase 2 de normalización?** El consultor externo y el Programador proponen evitarla con dual-write transitorio, pero si la pareja prefiere una migración limpia con ventana, simplifica todo. Nuestra recomendación: no, dual-write es la opción correcta.
3. **¿Push como bandera de v4.0 (Sprint E-F) o adelantarla a v3.7 sin save optimizado previo?** Riesgo: race conditions visibles del tipo "me llegó la notif pero no veo el cambio". Nuestra recomendación: respetar el orden Programador (save primero, push después).
4. **¿Quién es el "responsable de comunicación" al usuario en cada release?** Hoy esta función está implícita en el Coordinador. Conviene formalizarla: una persona dueña de redactar y enviar los mensajes pre y post-deploy.
5. **¿Aceptamos eliminar el selector de moneda y asumir EUR como default?** Lo propone el UI/UX. Si la pareja usa CLP, la respuesta es no y hay que internacionalizar `fmtAmt` (hoy hardcoded). Si la pareja usa EUR, la respuesta es sí y se simplifica el form de Gastos.

---

## 9. Anexo: cita literal del consultor externo

El documento `v4.0.0IMPLEMENTACION.md` (1.655 líneas) llega a conclusiones notablemente compatibles con las del workshop, organizadas en cuatro fases:

> **Fase 1 — Cimientos invisibles (1-2 semanas, riesgo bajo):** flush síncrono en `visibilitychange`, fix de FOUC de themes, ErrorBoundary global, telemetría propia (tabla `events` + helper `track()`), bundle visualizer.
>
> **Fase 2 — Supabase del blob al esquema (2-3 semanas, riesgo medio, mitigado por dual-write):** 7 tablas nuevas (`members`, `missions`, `goals`, `expenses`, `chat_messages`, `week_photos`, `couple_settings`), RLS vía helper `is_couple_member()`, Storage bucket `couple-assets`, capa `repo.js`, dual-write detrás de flag `USE_NORMALIZED`, backfill script, switch progresivo sin downtime.
>
> **Fase 3 — Push notifications end-to-end (1 semana, riesgo bajo, depende de Fase 2):** VAPID keys, tabla `push_subscriptions`, handlers `push` / `notificationclick` / `pushsubscriptionchange` en SW, Edge Function `send-push`, opt-in contextual.
>
> **Fase 4 — Refactor App.jsx por features + PWA polish (en curso, riesgo bajo):** estructura `src/features/*`, hook `useMissions` con CRUD optimista + realtime, React Router con lazy load (-40% primer paint), JSDoc tipos sin migración a `.ts`, app shortcuts, splash iOS, status bar dinámico, share target, Vitest con tests críticos (fechas, rollover, backfill).
>
> — Consultor externo, `v4.0.0IMPLEMENTACION.md`

**Cómo lo incorporamos / dónde nos desviamos:**
- **Adoptamos íntegramente** Fase 1 (telemetría, ErrorBoundary, flush en visibility) como Sprint A. Es la pieza más urgente y más barata.
- **Adoptamos casi íntegramente** Fase 2, con la matización del Experto en Datos: añadir columna `version bigint` con CAS para resolver la race condition de raíz, no solo el patrón dual-write.
- **Adoptamos** Fase 3 con un matiz del UI/UX: el permiso de Push se pide contextualmente (primera asignación a la pareja), nunca al primer uso.
- **Nos desviamos** en Fase 4: el refactor completo de App.jsx por features y la migración a React Router no caben en v4.0 sin sacrificar Push o Gastos. Se aplazan a v4.1, conservando solo el refactor parcial de `<ExpensesView>` y la extracción de la lógica de Stats a `src/lib/insights.js`.

El consultor termina con cuatro "no te atrevas si..." que la app hereda como ley: no borrar `couples.data` hasta 30 días después de Fase 2, no cambiar el shape de `id` durante dual-write, no deshabilitar RLS ni temporalmente, no probar push en producción sin staging previo.

---

## 10. Cierre del redactor

Misiones de Pareja es, hoy, una app de productividad ligera disfrazada de algo más íntimo. Funciona porque la pareja que la usa quiere que funcione, y porque las decisiones de UX han sabido evitar el lenguaje corporativo. Llamamos "misiones" a lo que otras apps llaman "tareas". Llamamos "para ti" a lo que otras apps llaman "asignar a". Esa terquedad de tono es, probablemente, el activo más valioso del producto.

El Workshop v4.0.0 confirma que el siguiente paso no es añadir más cosas, sino **madurar la infraestructura para que las cosas que ya hay no se rompan en silencio**. Es un movimiento contraintuitivo: la versión que tiene más visibilidad (push, drill-down, Gastos rediseñado) es también la que más invierte en lo invisible (CAS, dual-write, telemetría real, RLS alineada). Esa contradicción aparente es, en realidad, la marca de una app que crece. Las primeras versiones suman features; las versiones maduras protegen lo que ya tienen.

Si tuviera que sintetizar el consenso del workshop en una frase, sería esta:

> **v4.0 no es un release de funcionalidades, es un contrato de fiabilidad con dos personas que confían sus datos a esta app todos los días.**

Las 7 garantías irrompibles del Experto en Datos, los 5 principios de diseño del UI/UX, las 3 líneas rojas del Coordinador, los 5 sprints del Programador y los 5 riesgos invisibles del Analista convergen en el mismo punto: hacer pocas cosas, bien, sin perder ni un byte de trabajo de la pareja.

**Próximo paso inmediato (esta semana):** arrancar el Sprint A. Telemetría real, feature flags operativos, y una decisión data-driven sobre Gastos antes del 31 de mayo. Sin esto, todo lo demás es opinión.

Que el viaje de v3.4.1 a v4.0.0 sea, sobre todo, un viaje silencioso para el usuario. Si la pareja no se entera de que migramos el schema, no se entera de que cambiamos la queue offline, no se entera de que añadimos CAS — y solo se entera de que ahora reciben avisos al instante, de que sus stats cuentan historias, y de que sus logros tienen un lugar más bonito donde vivir — habremos hecho bien nuestro trabajo.

— *El Redactor, 19 de mayo de 2026*
