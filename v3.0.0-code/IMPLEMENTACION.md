# IMPLEMENTACIÓN v3.0.0 — Misiones de Pareja

> **Hola Claude Code** 👋
> Este paquete contiene el **rediseño v3.0.0** de la app. Es un cambio mayor de UI con archivos nuevos + 2 archivos reescritos + ediciones quirúrgicas en `App.jsx`.
>
> ## ⚠️ MUY IMPORTANTE — NO PIERDAS NADA
>
> El usuario ya ha trabajado intensamente en el repo. **NO BORRES, NO REEMPLACES SIN LEER, NO REGENERES** funciones existentes. La regla de oro:
>
> 1. **NUNCA reemplaces App.jsx entero** — solo aplica los parches puntuales descritos abajo.
> 2. **PRESERVA toda la lógica existente**: Supabase sync, debounced save, weekNumber/year handling, carriedFrom rollover, DnD, edición inline, themes, fonts, settings, goals, stats, chat, expenses (si existen), PWA registration. Todo eso sigue.
> 3. **NO toques** `constants.js`, `utils.js`, `supabase.js`, `main.jsx`, `EmojiSelect.jsx`, `AddMissionForm.jsx`, `WorkHoursCard.jsx`, `SettingsModal.jsx`, `GoalsView.jsx`, `StatsView.jsx`. Quedan tal cual.
> 4. Si una función o branch no se menciona en este doc, **déjalo exactamente como está**.
> 5. Lee el archivo de destino COMPLETO antes de editar. Si dudas, pregunta antes de cambiar.

---

## Resumen de cambios

| # | Cambio | Archivos |
|---|---|---|
| 1 | Logo "MP-mark" en topbar | nuevo `Brand.jsx` + parche en `App.jsx` |
| 2 | Toast del botón "Actualizar versión" | nuevo `Toast.jsx` + parche en `App.jsx` |
| 3 | Tira de días L–D siempre visible | nuevo `WeekStrip.jsx` + parche en Home/Week |
| 4 | Home convertido en dashboard | nuevo `HomeDashboard.jsx` + parche en `App.jsx` |
| 5 | Vista timeline en Semana | nuevo `WeekTimeline.jsx` + parche en `App.jsx` |
| 6 | Drawer de filtros + botón único | nuevo `FilterDrawer.jsx` + parche en `App.jsx` |
| 7 | Menú ⋯ para acciones secundarias | nuevo `OverflowMenu.jsx` + parche en `App.jsx` |
| 8 | Riel de color por persona en cards | reescrito `MissionCard.jsx` |
| 9 | Hoy con anillo + barra densidad en calendario | reescrito `CalendarView.jsx` |
| 10 | Latido del Home (gradiente respira) | clase CSS en `index.css` + uso en HomeDashboard |
| 11 | Hook de Wrapped semanal (CTA) | prop opcional en `HomeDashboard.jsx` |
| 12 | Tokens nuevos en `styles.js` | extiende `S` con nuevos helpers (NO rompe consumers) |

Bump de versión: en `constants.js` cambia `APP_VERSION = "2.5.0"` → `APP_VERSION = "3.0.0"`.

---

## Pasos de aplicación

### 1. Copiar archivos nuevos
Copia directamente desde `mejoras/v3.0.0-code/src/` a tu `src/`:

```
src/components/Brand.jsx          ← NUEVO
src/components/Toast.jsx          ← NUEVO
src/components/WeekStrip.jsx      ← NUEVO
src/components/HomeDashboard.jsx  ← NUEVO
src/components/WeekTimeline.jsx   ← NUEVO
src/components/FilterDrawer.jsx   ← NUEVO
src/components/OverflowMenu.jsx   ← NUEVO
```

### 2. Reescribir 2 archivos (revisa antes el original)
```
src/components/MissionCard.jsx    ← REESCRITO  (rieles + pop)
src/views/CalendarView.jsx        ← REESCRITO  (today ring + density bars + sin botones export)
```
**Diff con el original**: ambos preservan 100% la API y las props existentes; solo añaden visuales. Compáralos antes de pegar.

### 3. Extender styles.js
Reemplaza `src/styles.js` con la nueva versión (mantiene todos los exports antiguos: `S`, `badgeStyle`, `catBadgeStyle`, y añade nuevos: `S.hero`, `S.weekHero`, `S.widget`, `S.chip`).

### 4. Añadir keyframe CSS global
En `src/index.css` (o donde tengas estilos globales), añade al final:

```css
@keyframes mc-pop {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.28); }
  100% { transform: scale(1); }
}

@keyframes home-breathe {
  0%, 100% { background-position: 0% 50%, 100% 50%; }
  50%      { background-position: 10% 60%, 90% 40%; }
}

.home-breathe-bg {
  animation: home-breathe 8s ease-in-out infinite;
}
```

### 5. Parches en App.jsx (quirúrgicos)

**5.1 — Imports (al inicio del archivo, junto a los otros imports):**
```jsx
import Brand from "./components/Brand.jsx";
import { ToastProvider, useToast } from "./components/Toast.jsx";
import HomeDashboard from "./components/HomeDashboard.jsx";
import WeekTimeline from "./components/WeekTimeline.jsx";
import FilterDrawer, { FilterButton } from "./components/FilterDrawer.jsx";
import OverflowMenu, { OverflowButton } from "./components/OverflowMenu.jsx";
```

**5.2 — Envolver el árbol en `<ToastProvider>`:**
Donde hoy está el `return (<div>...)` raíz del componente App, envuélvelo:
```jsx
return (
  <ToastProvider>
    {/* ...todo el contenido actual... */}
  </ToastProvider>
);
```

**5.3 — Reemplazar el brand en el topbar.**
Busca el span/elemento que dibuja `💞 Misiones` (o equivalente — texto literal del logo actual) y reemplázalo por:
```jsx
<Brand />
```
**No borres** los handlers que tenía alrededor (menú hamburguesa, settings).

**5.4 — Botón "Actualizar versión" → toast.**
Busca el handler que actualmente recarga la app (`window.location.reload()` o similar dentro del flujo de "comprobar versión"). Refactor:
```jsx
const toast = useToast(); // dentro del componente

const checkUpdate = async () => {
  toast.show({ kind: "loading", text: "Actualizando…" });
  try {
    // ... lógica existente para chequear versión y pedir reload de SW si aplica ...
    // si hay nueva versión:
    toast.show({ kind: "success", text: "¡App actualizada!" });
    setTimeout(() => window.location.reload(), 1200);
    // si NO hay nueva versión:
    // toast.show({ kind: "success", text: "Ya tienes la última versión" });
  } catch (err) {
    toast.show({
      kind: "error",
      text: "No se pudo actualizar",
      action: { label: "Reintentar", onClick: checkUpdate },
    });
  }
};
```
**Mantén** la lógica de service worker actual; solo cambia el feedback visual.

**5.5 — Menú ⋯ en topbar.**
Donde estén hoy los botones grandes de Calendario (Google Calendar .ics + PDF), o el botón de "Actualizar versión" si está suelto: muévelos a `<OverflowMenu>` en el topbar:
```jsx
const [popOpen, setPopOpen] = useState(false);
// ... en el topbar:
<OverflowButton onClick={() => setPopOpen(o => !o)} />
<OverflowMenu open={popOpen} onClose={() => setPopOpen(false)} items={[
  { icon: "↻", label: "Actualizar versión", onClick: checkUpdate, badge: hasUpdate ? "NUEVA" : null },
  { divider: true },
  { icon: "📅", label: "Exportar a Google Calendar (.ics)", onClick: handleDownloadICS },
  { icon: "🖨", label: "Imprimir / PDF", onClick: handleDownloadPDF },
  { icon: "📎", label: "Compartir resumen", onClick: handleShare }, // si existe
]} />
```
**Conserva** los handlers `handleDownloadICS`, `handleDownloadPDF` tal cual están definidos hoy. Solo cambia DÓNDE se invocan.

**5.6 — Home: usar HomeDashboard.**
Donde hoy renderizas la vista Home (lista de Pendientes / Eventos):
```jsx
{view === "home" && (
  <HomeDashboard
    week={week}
    wkey={wkey}
    missions={missions}
    weekDays={weekDays}              // [Date,Date,...] L-D
    today={new Date()}
    p1={p1} p2={p2}
    colors={colors}
    goals={goals}
    onCycleStatus={onCycleStatus}
    onPatchMission={onPatchMission}
    onDeleteMission={onDeleteMission}
    breathe={true}                    // latido del Home (atrevida #1)
    showWrappedHook={lastWeekClosed}  // hook de Wrapped (atrevida #2)
    onOpenWrapped={() => setView("wrapped")}
  />
)}
```
**No borres** la vista antigua si te da seguridad; ponla detrás de un flag temporal `LEGACY_HOME=false` y cuando confirmemos la quitamos del todo.

**5.7 — Semana: usar WeekTimeline + WeekStrip.**
En la vista Semana, sobre las cards actuales agrupadas por status, añade el header editorial y la opción de timeline:
```jsx
{view === "week" && (
  <>
    <WeekStrip days={weekDays} today={new Date()} />
    {/* Header editorial — número grande + objetivo épico — opcional, ver styles.js → S.weekHero */}
    {/* Toggle Lista | Timeline */}
    {weekViewMode === "timeline"
      ? <WeekTimeline
          missions={visibleMissions}
          weekDays={weekDays}
          today={new Date()}
          renderCard={m => <MissionCard mission={m} {...cardProps} />}
        />
      : (/* ...la lista por status que ya existe... */)
    }
  </>
)}
```

**5.8 — Calendario: filtros como drawer.**
La fila de chips de filtros que está hoy encima del calendario se reemplaza por un único botón:
```jsx
const [filtersOpen, setFiltersOpen] = useState(false);
const filterCount = (personFilter !== "all" ? 1 : 0) + catFilter.length;

// donde estaba la fila de chips:
<FilterButton count={filterCount} onClick={() => setFiltersOpen(true)} />

// y al final del árbol:
<FilterDrawer
  open={filtersOpen}
  onClose={() => setFiltersOpen(false)}
  filters={{ who: personFilter==="all" ? [] : [personFilter], cat: catFilter }}
  setFilters={f => {
    setPersonFilter(f.who[0] || "all");
    setCatFilter(f.cat);
  }}
  persons={[
    { id:"person1",  name:p1, emoji:"🙋", color:colors.person1 },
    { id:"person2",  name:p2, emoji:"🙋", color:colors.person2 },
    { id:"together", name:"Juntos", emoji:"👫", color:colors.together },
  ]}
  categories={CATEGORIES.map(c => ({ id:c.id, label:c.label, emoji:c.icon, color:c.color }))}
/>
```
**Mantén** el contrato actual de `personFilter` (string) y `catFilter` (array) — la UI lo traduce.

### 6. Bump de versión
En `src/constants.js`, cambia:
```js
export const APP_VERSION = "3.0.0";
```

---

## Checklist de QA antes del commit

- [ ] La app compila sin warnings nuevos (`npm run dev`).
- [ ] Login + Supabase sync siguen funcionando (creas misión → aparece en otro device).
- [ ] El logo MP se ve bien en topbar (no roto, no demasiado grande).
- [ ] Botón "Actualizar versión" muestra toast loading → success y recarga.
- [ ] Botón "Actualizar versión" muestra toast error con "Reintentar" si falla (test: desconectar wifi).
- [ ] Tira de días L–D con HOY en pink visible en Home y Semana.
- [ ] Home: hero editorial + widgets renderizan; cifras coinciden con misiones.
- [ ] Calendario: HOY muestra anillo pink (no fill); días con misiones muestran barra de densidad por persona.
- [ ] Filtros por persona y categoría funcionan desde el drawer.
- [ ] Menú ⋯ abre y cierra; .ics y PDF funcionan desde ahí.
- [ ] DnD de misiones entre días sigue funcionando.
- [ ] Edición inline de misiones desde el calendario sigue funcionando.
- [ ] Otras vistas (Pendientes, Metas, Stats, Chat) intactas.
- [ ] Themes (los 15) siguen aplicándose correctamente.

## Mensaje de commit sugerido

```
feat(v3.0.0): rediseño UI mayor — dashboard home, semana editorial, drawer filtros, identidad

• Brand component (MP-mark logo) reemplaza el emoji 💞 en topbar
• HomeDashboard: hero editorial + widgets compactos (ASAP, próximo, pulso, meta, hoy)
• WeekStrip persistente: días L–D con HOY en pink en Home y Semana
• WeekTimeline: vista timeline opcional agrupada por día con riel de color
• Riel de color por persona (3px) en MissionCard
• Pop animation del emoji de status al ciclar
• Calendario: HOY con anillo pink en lugar de fill bg
• Calendario: barra de densidad por persona en footer de cada celda
• FilterDrawer: filtros consolidados en drawer inferior con contador
• OverflowMenu: .ics, PDF y "Actualizar versión" movidos al menú ⋯
• Toast del botón "Actualizar versión": loading → success/error + reintentar (FIX BUG)
• Latido del Home: gradiente respira sutilmente (8s loop)
• Hook de Wrapped semanal: CTA al cierre de semana

Migration notes:
- API de MissionCard, CalendarView, badgeStyle, S sin cambios — backward compatible
- constants.js, utils.js, supabase.js NO modificados
- Themes (15) intactos
- Schema de datos en Supabase intacto
```

---

## Si te atascas

- **¿No encuentras dónde está el logo actual?** Busca por el string `💞` en `App.jsx` o por el componente que envuelve el header mobile.
- **¿No encuentras el botón "Actualizar versión"?** Busca por "actualiz" (case-insensitive) o por `serviceWorker` / `registerSW`.
- **¿La API de `weekDays` no existe?** Constrúyela inline: `const weekDays = Array.from({length:7},(_,i)=>{ const d=new Date(week.start); d.setDate(d.getDate()+i); return d; });` (ajusta a la forma real del objeto `week`).
- **¿Algo se rompe?** **Para. Pregunta al usuario antes de borrar nada.**

¡Suerte! 💞 → MP
