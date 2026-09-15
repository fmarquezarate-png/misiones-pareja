import { useEffect, useState } from "react";
import { LEAGUES, teamsOfLeague, teamById } from "../lib/teams.js";
import { fetchLeague, teamFixtures, fixtureToMission, mergeFixtures } from "../lib/football.js";
import { humanDate } from "../lib/dateLabel.js";
import TeamCrest from "./TeamCrest.jsx";
import { uid } from "../utils.js";

// Propone añadir al calendario los partidos del equipo que sigas.
//
// Densidad (regla del workshop v5): si no hay nada que proponer, la tarjeta NO
// se dibuja. Solo aparece cuando de verdad hay partidos nuevos que añadir, o
// la primera vez para elegir equipo.
const DIAS = 21;          // ventana de propuesta
const DISMISS_KEY = "mp-team-card-dismissed";

export default function TeamMatchesCard({ myTeam, allMissions = [], onChooseTeam, onImport }) {
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState(null);      // misiones listas para añadir
  const [updates, setUpdates] = useState([]);        // horas que la liga ya anunció
  const [state, setState] = useState("idle");        // idle | loading | error | ready
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  const team = teamById(myTeam);

  useEffect(() => {
    let vivo = true;
    if (!team) { setState("idle"); setPending(null); return; }
    setState("loading");
    fetchLeague(team.league).then(matches => {
      if (!vivo) return;
      if (!matches) { setState("error"); return; }
      const hoy = new Date().toISOString().slice(0, 10);
      const hasta = new Date(Date.now() + DIAS * 86400000).toISOString().slice(0, 10);
      const fixtures = teamFixtures(matches, team.id, { fromDate: hoy }).filter(m => m.date <= hasta);
      const candidatos = fixtures.map(m => fixtureToMission(m, team.id, { uid }));
      const { nuevos, actualizados } = mergeFixtures(allMissions, candidatos);
      setPending(nuevos);
      setUpdates(actualizados);
      setState("ready");
    });
    return () => { vivo = false; };
  }, [team, allMissions]);

  // Nada que ofrecer: la tarjeta desaparece en vez de ocupar sitio.
  if (team && state === "ready" && !pending?.length && !updates.length) return null;
  if (!team && dismissed && !picking) return null;
  if (team && state === "loading") return null;      // sin parpadeo de "cargando"

  const card = {
    margin: "0 0 4px", padding: "14px 16px", borderRadius: 16,
    background: "linear-gradient(135deg, rgba(52,211,153,0.10), rgba(96,165,250,0.08))",
    border: "1px solid rgba(52,211,153,0.25)",
  };

  // ── Elegir equipo ──────────────────────────────────────────────────────────
  if (picking || !team) {
    if (!picking) {
      return (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontSize: 13, color: "var(--t-text,#f0e8ff)", lineHeight: 1.4 }}>
              <span style={{ marginRight: 6 }}>⚽</span>
              ¿Sigues a algún equipo? Te propongo sus partidos para el calendario.
            </div>
            <button onClick={() => { setDismissed(true); try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* privado */ } }}
              aria-label="Ahora no" title="Ahora no"
              style={{ width: 40, height: 40, marginRight: -10, marginTop: -8, flexShrink: 0, borderRadius: 99, cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, color: "var(--t-text-muted,#b9b0d0)", background: "transparent", border: "none" }}>✕</button>
          </div>
          <button onClick={() => setPicking(true)} style={{
            marginTop: 10, padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
            fontSize: 13, fontWeight: 600, color: "#fff", border: "none",
            background: "linear-gradient(135deg,#34d399,#10b981)",
          }}>Elegir equipo</button>
        </div>
      );
    }
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t-text,#f0e8ff)" }}>Elige tu equipo</div>
          <button onClick={() => setPicking(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--t-text-muted,#b9b0d0)", fontFamily: "inherit" }}>Cancelar</button>
        </div>
        {LEAGUES.map(lg => (
          <div key={lg.id} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: "var(--t-text-dim,#8f84ad)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 5 }}>{lg.name}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {teamsOfLeague(lg.id).map(t => (
                <button key={t.id} onClick={() => { onChooseTeam?.(t.id); setPicking(false); }} title={t.short}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, borderRadius: 8, lineHeight: 0 }}>
                  <TeamCrest teamId={t.id} size={26} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Propuesta ──────────────────────────────────────────────────────────────
  if (state === "error") {
    return (
      <div style={card}>
        <div style={{ fontSize: 12.5, color: "var(--t-text-muted,#b9b0d0)" }}>
          ⚽ No he podido consultar el calendario del {team.short} ahora mismo. Lo reintento la próxima vez que abras la app.
        </div>
      </div>
    );
  }

  const n = pending?.length || 0;
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: n ? 10 : 0 }}>
        <TeamCrest teamId={team.id} size={22} />
        <div style={{ flex: 1, fontSize: 13, color: "var(--t-text,#f0e8ff)", lineHeight: 1.4 }}>
          {n > 0
            ? <>El <b>{team.short}</b> juega <b>{n}</b> {n === 1 ? "partido" : "partidos"} en las próximas 3 semanas</>
            : <>Hay <b>{updates.length}</b> {updates.length === 1 ? "horario confirmado" : "horarios confirmados"} del {team.short}</>}
        </div>
        <button onClick={() => setPicking(true)} title="Cambiar de equipo"
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--t-text-muted,#b9b0d0)", fontFamily: "inherit", flexShrink: 0 }}>Cambiar</button>
      </div>

      {n > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
          {pending.slice(0, 4).map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <TeamCrest teamId={m.crest} size={16} />
              <span style={{ color: "var(--t-text,#f0e8ff)", flex: 1, minWidth: 0 }}>{m.title}</span>
              <span style={{ color: "var(--t-text-dim,#8f84ad)", flexShrink: 0 }}>
                {humanDate(m.date)}{m.time ? ` · ${m.time}` : " · sin hora"}
              </span>
            </div>
          ))}
          {n > 4 && <div style={{ fontSize: 11, color: "var(--t-text-dim,#8f84ad)" }}>y {n - 4} más</div>}
        </div>
      )}

      <button onClick={() => { onImport?.(pending || [], updates); setPending([]); setUpdates([]); }} style={{
        padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
        fontSize: 13, fontWeight: 600, color: "#fff", border: "none",
        background: "linear-gradient(135deg,#34d399,#10b981)",
      }}>{n > 0 ? "Añadir al calendario" : "Actualizar horarios"}</button>

      <div style={{ fontSize: 10.5, color: "var(--t-text-dim,#8f84ad)", marginTop: 8, lineHeight: 1.45 }}>
        Los partidos sin horario confirmado se añaden solo con el día; la hora se rellena sola cuando la liga la anuncia.
      </div>
    </div>
  );
}
