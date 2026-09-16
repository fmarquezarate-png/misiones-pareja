// useLiveMatch — el partido de tu equipo que se está jugando AHORA, o null.
//
// Vive como hook del ancestro común (App) y no dentro de la pantalla de inicio,
// por la regla de oro de CLAUDE.md §2: si más de un sitio puede necesitar un
// estado, vive arriba. Aquí además es obligatorio por otra razón — el bloque
// del inicio se pinta dentro de una función, y un hook no puede llamarse ahí.
//
// COSTE: el inicio está abierto todo el rato, así que sondear "por si acaso"
// gastaría cuota y batería los 365 días para servir 38 tardes. El bucle mira
// PRIMERO el calendario del equipo (cacheado 10 min en localStorage, así que
// casi siempre es gratis) y solo llama al marcador en vivo dentro de la
// ventana de un partido. Fuera de ella duerme hasta que la ventana se abra.
//
// Con la app en segundo plano no se pide NADA.

import { useEffect, useRef, useState } from "react";
import { proximaVentana, miPartidoEnVivo } from "../lib/live.js";

// `footballApi` arrastra el catálogo de equipos, openfootball y la
// clasificación: ~17KB que NO deben parsearse en cada arranque para una
// función que sirve 38 tardes al año (regla de bundling de CLAUDE.md §5).
// Se carga la primera vez que hace falta, y solo entonces.
let api = null;
const cargarApi = async () => (api ||= await import("../lib/footballApi.js"));

export default function useLiveMatch(teamId) {
  const [match, setMatch] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!teamId) { setMatch(null); return undefined; }

    let vivo = true;
    const parar = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

    const ciclo = async () => {
      timer.current = null;
      if (!vivo || (typeof document !== "undefined" && document.hidden)) return;

      let espera;
      try {
        const { getTeamMatches, getLive } = await cargarApi();
        const fx = await getTeamMatches(teamId);          // cacheado: casi siempre sin red
        if (!vivo) return;
        const v = proximaVentana(fx.matches || []);

        if (v.dentro) {
          const res = await getLive(teamId);
          if (!vivo) return;
          setMatch(miPartidoEnVivo(res, teamId));
          setFetchedAt(res.fetchedAt || null);
          espera = v.esperaMs;
        } else {
          setMatch(null);
          espera = v.esperaMs;
        }
      } catch {
        // Un fallo de red no borra lo que ya se estaba enseñando: se reintenta.
        // (Regla §5: un fallo de red nunca toma decisiones destructivas.)
        espera = 2 * 60e3;
      }

      if (vivo && !document.hidden) timer.current = setTimeout(ciclo, espera);
    };

    const onVis = () => {
      if (document.hidden) parar();
      else if (!timer.current) ciclo();
    };

    // Arranque diferido: esto es un extra, y el historial del proyecto está
    // lleno de arranques lentos por llamadas "best-effort" metidas en la
    // cadena crítica. Que la app termine de cargar primero.
    timer.current = setTimeout(ciclo, 3000);
    document.addEventListener("visibilitychange", onVis);
    return () => { vivo = false; parar(); document.removeEventListener("visibilitychange", onVis); };
  }, [teamId]);

  return { match, fetchedAt };
}
