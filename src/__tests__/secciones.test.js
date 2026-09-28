// Red de seguridad del registro único de secciones (src/lib/secciones.js).
// Nació de una auditoría (28/09/2026): cuatro listas de secciones que no
// coincidían — la barra inferior no ofrecía Salud, 7 cabeceras vacías, el
// mismo icono con dos significados.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SECCIONES, seccion, IDS_PESTAÑA, PARA_BARRA, tituloCabecera, sanearBarra, MAX_BARRA, BARRA_DEFECTO } from "../lib/secciones.js";
import { ALL_TABS } from "../components/BottomTabBar.jsx";
import { pasosTour } from "../lib/tour.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(SRC, "App.jsx"), "utf8");
const renders = new Set([...app.matchAll(/activeTab\s*===\s*"([a-z]+)"\s*&&/g)].map(m => m[1]));

describe("registro de secciones ↔ App.jsx", () => {
  // Si alguien añade una pantalla en App sin registrarla, no aparecería en
  // el menú ni en la barra: justo lo que pasó con Salud.
  it("toda pantalla que App pinta está registrada", () => {
    for (const id of renders) expect(seccion(id), `"${id}" se pinta en App.jsx pero no está en secciones.js`).toBeTruthy();
  });
  it("toda sección navegable del registro tiene pantalla en App", () => {
    for (const id of IDS_PESTAÑA) expect(renders.has(id), `"${id}" está registrada pero App.jsx no la pinta`).toBe(true);
  });
  it("App usa el registro para las pestañas válidas (no una lista propia)", () => {
    expect(app).toMatch(/const VALID = IDS_PESTAÑA/);
  });
});

describe("coherencia del registro", () => {
  it("ids únicos", () => {
    expect(new Set(SECCIONES.map(s => s.id)).size).toBe(SECCIONES.length);
  });
  // El fallo que encontró la auditoría: 🎯 era Semana en una lista y Metas en otra.
  it("cada icono significa una sola cosa", () => {
    const iconos = SECCIONES.map(s => s.icono);
    expect(new Set(iconos).size).toBe(iconos.length);
  });
  it("toda sección tiene nombre, nombre corto e icono", () => {
    for (const s of SECCIONES) {
      expect(s.nombre, s.id).toBeTruthy();
      expect(s.corto, s.id).toBeTruthy();
      expect(s.icono, s.id).toBeTruthy();
      expect(s.corto.length, `${s.id}: el nombre corto no cabe en la barra`).toBeLessThanOrEqual(11);
    }
  });
  // Antes 7 secciones enseñaban la cabecera vacía.
  it("ninguna pestaña tiene la cabecera vacía", () => {
    for (const id of IDS_PESTAÑA) expect(tituloCabecera(id).length, id).toBeGreaterThan(2);
    expect(tituloCabecera("current", { semana: 40 })).toBe("🎯 Semana 40");
  });
});

describe("barra inferior", () => {
  it("se puede poner Salud (y Mi Equipo, La Copa, Notitas)", () => {
    const ids = ALL_TABS.map(t => t.id);
    for (const id of ["salud", "team", "trophy", "notes"]) expect(ids).toContain(id);
  });
  it("no ofrece modales ni secciones ocultas", () => {
    const ids = ALL_TABS.map(t => t.id);
    expect(ids).not.toContain("activity");
    expect(ids).not.toContain("diagnostics");
    expect(ALL_TABS).toHaveLength(PARA_BARRA.length);
  });
  // Un id guardado que ya no existe ocupaba un hueco invisible.
  it("sanear quita ids desconocidos, duplicados y lo que sobra", () => {
    expect(sanearBarra({ enabled: true, tabs: ["home", "fantasma", "home", "salud"] }).tabs).toEqual(["home", "salud"]);
    expect(sanearBarra({ tabs: ["home", "current", "calendar", "mood", "salud", "team", "chat"] }).tabs).toHaveLength(MAX_BARRA);
    expect(sanearBarra({ tabs: ["activity", "diagnostics"] }).tabs).toEqual([]);
  });
  it("sin configuración guardada, la de por defecto", () => {
    expect(sanearBarra(null)).toEqual(BARRA_DEFECTO);
    expect(sanearBarra({ enabled: false, tabs: ["home"] }).enabled).toBe(false);
  });
});

describe("tour de Misi", () => {
  const pasos = pasosTour({ nombre: "Fran", temas: 15 });
  it("cada paso lleva a una sección que existe", () => {
    for (const p of pasos) expect(seccion(p.tab), `${p.id} → ${p.tab}`).toBeTruthy();
  });
  it("recorre lo nuevo: Salud, Mi Equipo y La Copa", () => {
    const tabs = pasos.map(p => p.tab);
    for (const id of ["salud", "team", "trophy"]) expect(tabs).toContain(id);
  });
  it("no queda el nombre viejo ni números fijos de temas", () => {
    const texto = pasos.map(p => p.titulo + p.texto).join(" ");
    expect(texto).not.toMatch(/Shared Calendar|14 temas/);
    expect(texto).toContain("hay 15");
  });
  it("personaliza el saludo", () => {
    expect(pasos[0].titulo).toContain("Fran");
  });
  it("si no tiene mascota, invita a adoptarla al final", () => {
    expect(pasosTour({ tieneMascota: false }).at(-1).cta?.tab).toBe("salud");
    expect(pasosTour({ tieneMascota: true }).at(-1).cta).toBeNull();
  });
  it("cada paso cabe en una burbuja (texto corto)", () => {
    for (const p of pasos) expect(p.texto.length, p.id).toBeLessThanOrEqual(260);
  });
});
