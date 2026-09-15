import { useEffect, useMemo, useState } from "react";
import { LEAGUES, teamsOfLeague, teamById, teamByName } from "../lib/teams.js";
import { fetchLeague, teamFixtures, fixtureToMission, mergeFixtures } from "../lib/football.js";
import { buildStandings, standingsAround, teamForm, teamTimeline, resultFor } from "../lib/standings.js";
import { humanDate } from "../lib/dateLabel.js";
import TeamCrest from "./TeamCrest.jsx";
import { uid } from "../utils.js";

const SECCIONES = [
  { id: "calendario",   label: "Calendario" },
  { id: "clasificacion",label: "Clasificación" },
  { id: "ajustes",      label: "Ajustes" },
];

const COLOR_R = { G: "#34d399", E: "#94a3b8", P: "#f87171" };

function Racha({ form }) {
  if (!form.length) return null;
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {form.map((r, i) => (
        <span key={i} style={{
          width: 18, height: 18, borderRadius: 5, fontSize: 10, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `${COLOR_R[r]}22`, color: COLOR_R[r], border: `1px solid ${COLOR_R[r]}55`,
        }}>{r}</span>
      ))}
    </div>
  );
}

function FilaPartido({ m, teamId, onAdd, yaEsta }) {
  const res = resultFor(m, teamId);
  const rival = (() => {
    const h = teamByName(m.team1), a = teamByName(m.team2);
    const soyLocal = h && h.id === teamId;
    const r = soyLocal ? a : h;
    return { team: r, nombre: r ? r.short : (soyLocal ? m.team2 : m.team1), casa: soyLocal };
  })();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0", borderBottom: "1px solid rgba(167,139,250,0.08)" }}>
      {rival.team ? <TeamCrest teamId={rival.team.id} size={20} /> : <span style={{ width: 20 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--t-text,#f0e8ff)" }}>
          {rival.casa ? "vs " : "en "}{rival.nombre}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--t-text-dim,#8f84ad)", marginTop: 1 }}>
          {humanDate(m.date)}{m.time ? ` · ${m.time}` : (res ? "" : " · sin hora")}
          {m.round ? ` · ${m.round.replace("Matchday", "J")}` : ""}
        </div>
      </div>
      {res ? (
        <span style={{ fontSize: 13, fontWeight: 700, color: COLOR_R[res.r], flexShrink: 0 }}>{res.marcador}</span>
      ) : onAdd ? (
        <button onClick={() => onAdd(m)} disabled={yaEsta} title={yaEsta ? "Ya está en el calendario" : "Añadir al calendario"}
          style={{
            background: yaEsta ? "none" : "rgba(52,211,153,0.15)", border: `1px solid ${yaEsta ? "transparent" : "rgba(52,211,153,0.4)"}`,
            borderRadius: 8, color: yaEsta ? "var(--t-text-dim,#8f84ad)" : "#34d399", fontSize: 11, fontWeight: 600,
            padding: "5px 10px", cursor: yaEsta ? "default" : "pointer", fontFamily: "inherit", flexShrink: 0,
          }}>{yaEsta ? "✓" : "+"}</button>
      ) : null}
    </div>
  );
}

export default function TeamView({ settings = {}, allMissions = [], onPatchSettings, onImport }) {
  const cfg = settings.team || {};
  const teamId = cfg.id || settings.myTeam || null;     // myTeam: forma de v5.30.0
  const team = teamById(teamId);
  const [sec, setSec] = useState("calendario");
  const [matches, setMatches] = useState(null);
  const [state, setState] = useState("idle");
  const [picking, setPicking] = useState(!team);

  useEffect(() => {
    let vivo = true;
    if (!team) return;
    setState("loading");
    fetchLeague(team.league).then(ms => {
      if (!vivo) return;
      setMatches(ms);
      setState(ms ? "ready" : "error");
    });
    return () => { vivo = false; };
  }, [team]);

  const tabla = useMemo(() => matches ? buildStandings(matches) : [], [matches]);
  const linea = useMemo(() => matches && team ? teamTimeline(matches, team.id, { pasados: 3, proximos: 5 }) : { pasados: [], proximos: [] }, [matches, team]);
  const form = useMemo(() => matches && team ? teamForm(matches, team.id, 5) : [], [matches, team]);
  const mia = tabla.find(r => r.teamId === teamId);

  const setCfg = patch => onPatchSettings?.({ ...cfg, id: teamId, ...patch });

  const yaImportado = m => {
    const one = fixtureToMission(m, teamId, { uid });
    return mergeFixtures(allMissions, [one]).nuevos.length === 0;
  };
  const addOne = m => {
    const one = fixtureToMission(m, teamId, { uid, });
    one.who = cfg.who || "together";
    const { nuevos, actualizados } = mergeFixtures(allMissions, [one]);
    onImport?.(nuevos, actualizados);
  };
  const addAll = () => {
    if (!matches || !team) return;
    const hoy = new Date().toISOString().slice(0, 10);
    const cand = teamFixtures(matches, team.id, { fromDate: hoy, limit: 5 })
      .map(m => { const x = fixtureToMission(m, team.id, { uid }); x.who = cfg.who || "together"; return x; });
    const { nuevos, actualizados } = mergeFixtures(allMissions, cand);
    onImport?.(nuevos, actualizados);
  };

  // ── Elegir equipo ──────────────────────────────────────────────────────────
  if (!team || picking) {
    return (
      <div style={{ padding: "12px 12px 120px" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--t-text,#f8f4ff)", fontFamily: "'Fraunces',serif", marginBottom: 4 }}>⚽ Mi equipo</div>
        <div style={{ fontSize: 12, color: "var(--t-text-dim,#8f84ad)", marginBottom: 14 }}>Elige a quién sigues</div>
        {LEAGUES.map(lg => (
          <div key={lg.id} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "var(--t-text-muted,#b9b0d0)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>{lg.name}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 8 }}>
              {teamsOfLeague(lg.id).map(t => (
                <button key={t.id} onClick={() => { setCfg({ id: t.id }); setPicking(false); }}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 4px",
                    background: t.id === teamId ? "var(--t-accent-soft,rgba(167,139,250,0.14))" : "var(--t-card,#1d1733)",
                    border: `1px solid ${t.id === teamId ? "rgba(167,139,250,0.5)" : "var(--t-card-border,rgba(167,139,250,0.16))"}`,
                    borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                  }}>
                  <TeamCrest teamId={t.id} size={30} />
                  <span style={{ fontSize: 9.5, color: "var(--t-text-muted,#b9b0d0)", textAlign: "center", lineHeight: 1.2 }}>{t.short}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {team && (
          <button onClick={() => setPicking(false)} style={{
            marginTop: 4, padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
            fontSize: 13, color: "var(--t-text-muted,#b9b0d0)", background: "none", border: "1px solid var(--t-card-border,rgba(167,139,250,0.2))",
          }}>Cancelar</button>
        )}
      </div>
    );
  }

  const liga = LEAGUES.find(l => l.id === team.league);

  return (
    <div style={{ padding: "12px 12px 120px" }}>
      {/* Cabecera */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <TeamCrest teamId={team.id} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: "var(--t-text,#f8f4ff)", fontFamily: "'Fraunces',serif" }}>{team.short}</div>
          <div style={{ fontSize: 11.5, color: "var(--t-text-dim,#8f84ad)", marginTop: 2 }}>
            {liga?.name}{mia ? ` · ${mia.pos}º con ${mia.pts} pts` : ""}
          </div>
        </div>
        <Racha form={form} />
      </div>

      {/* Secciones */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {SECCIONES.map(s => (
          <button key={s.id} onClick={() => setSec(s.id)} style={{
            flex: 1, padding: "7px 4px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
            fontSize: 12, fontWeight: 600,
            background: sec === s.id ? "var(--t-accent-soft,rgba(167,139,250,0.16))" : "transparent",
            border: `1px solid ${sec === s.id ? "rgba(167,139,250,0.4)" : "var(--t-card-border,rgba(167,139,250,0.14))"}`,
            color: sec === s.id ? "var(--t-accent,#c4b8ff)" : "var(--t-text-muted,#b9b0d0)",
          }}>{s.label}</button>
        ))}
      </div>

      {state === "loading" && <div style={{ fontSize: 13, color: "var(--t-text-dim,#8f84ad)", padding: "20px 0", textAlign: "center" }}>Cargando…</div>}
      {state === "error" && (
        <div style={{ ...card(), fontSize: 12.5, color: "var(--t-text-muted,#b9b0d0)" }}>
          No he podido consultar el calendario ahora mismo. Se reintenta al volver a entrar.
        </div>
      )}

      {state === "ready" && sec === "calendario" && (
        <>
          <div style={card()}>
            <div style={secTitle()}>Próximos 5</div>
            {linea.proximos.length
              ? linea.proximos.map((m, i) => <FilaPartido key={i} m={m} teamId={team.id} onAdd={addOne} yaEsta={yaImportado(m)} />)
              : <div style={vacio()}>No hay más partidos publicados</div>}
            {linea.proximos.length > 0 && (
              <button onClick={addAll} style={btnPrimary()}>Añadir los 5 al calendario</button>
            )}
          </div>
          <div style={{ ...card(), marginTop: 10 }}>
            <div style={secTitle()}>Últimos 3</div>
            {linea.pasados.length
              ? linea.pasados.map((m, i) => <FilaPartido key={i} m={m} teamId={team.id} />)
              : <div style={vacio()}>Todavía no hay resultados esta temporada</div>}
          </div>
        </>
      )}

      {state === "ready" && sec === "clasificacion" && (
        <div style={card()}>
          <div style={secTitle()}>{liga?.name}</div>
          <Tabla tabla={tabla} teamId={team.id} />
          <div style={{ fontSize: 10.5, color: "var(--t-text-dim,#8f84ad)", marginTop: 10, lineHeight: 1.45 }}>
            Calculada desde los resultados publicados, así que se actualiza en cuanto entra un marcador.
          </div>
        </div>
      )}

      {sec === "ajustes" && (
        <div style={card()}>
          <div style={secTitle()}>Ajustes</div>

          <Fila label="Equipo">
            <button onClick={() => setPicking(true)} style={btnGhost()}>
              <TeamCrest teamId={team.id} size={18} /><span style={{ marginLeft: 6 }}>{team.short}</span>
            </button>
          </Fila>

          <Fila label="Proponer partidos" hint="Un aviso cuando haya partidos nuevos que añadir">
            <Toggle on={cfg.autoSuggest !== false} onChange={v => setCfg({ autoSuggest: v })} />
          </Fila>

          <Fila label="¿De quién es el evento?" hint="La app tiene un solo calendario compartido; esto decide a quién se le asigna el partido">
            <div style={{ display: "flex", gap: 6 }}>
              {[{ id: "person1", label: "Solo yo" }, { id: "together", label: "Los dos" }].map(o => (
                <button key={o.id} onClick={() => setCfg({ who: o.id })} style={{
                  ...btnGhost(),
                  background: (cfg.who || "together") === o.id ? "var(--t-accent-soft,rgba(167,139,250,0.18))" : "transparent",
                  color: (cfg.who || "together") === o.id ? "var(--t-accent,#c4b8ff)" : "var(--t-text-muted,#b9b0d0)",
                }}>{o.label}</button>
              ))}
            </div>
          </Fila>
        </div>
      )}
    </div>
  );
}

function Tabla({ tabla, teamId }) {
  const { cabeza, entorno, hayHueco } = standingsAround(tabla, teamId, { top: 5, around: 1 });
  if (!tabla.length) return <div style={vacio()}>La temporada aún no ha empezado</div>;
  const fila = r => (
    <div key={r.key} style={{
      display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", borderRadius: 8,
      background: r.teamId === teamId ? "var(--t-accent-soft,rgba(167,139,250,0.14))" : "transparent",
    }}>
      <span style={{ width: 18, fontSize: 11, color: "var(--t-text-dim,#8f84ad)", textAlign: "right" }}>{r.pos}</span>
      {r.teamId ? <TeamCrest teamId={r.teamId} size={18} /> : <span style={{ width: 18 }} />}
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--t-text,#f0e8ff)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
      <span style={{ width: 26, fontSize: 11, color: "var(--t-text-dim,#8f84ad)", textAlign: "center" }}>{r.pj}</span>
      <span style={{ width: 30, fontSize: 11, color: "var(--t-text-dim,#8f84ad)", textAlign: "center" }}>{r.dg > 0 ? `+${r.dg}` : r.dg}</span>
      <span style={{ width: 26, fontSize: 12.5, fontWeight: 700, color: "var(--t-text,#f0e8ff)", textAlign: "right" }}>{r.pts}</span>
    </div>
  );
  return (
    <div>
      <div style={{ display: "flex", gap: 8, padding: "0 4px 4px", fontSize: 9.5, color: "var(--t-text-dim,#8f84ad)", textTransform: "uppercase", letterSpacing: 0.5 }}>
        <span style={{ width: 18 }} /><span style={{ width: 18 }} />
        <span style={{ flex: 1 }}>Equipo</span>
        <span style={{ width: 26, textAlign: "center" }}>PJ</span>
        <span style={{ width: 30, textAlign: "center" }}>DG</span>
        <span style={{ width: 26, textAlign: "right" }}>Pts</span>
      </div>
      {cabeza.map(fila)}
      {hayHueco && <div style={{ textAlign: "center", color: "var(--t-text-dim,#8f84ad)", fontSize: 12, padding: "2px 0" }}>···</div>}
      {entorno.map(fila)}
    </div>
  );
}

function Fila({ label, hint, children }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid rgba(167,139,250,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 13, color: "var(--t-text,#f0e8ff)" }}>{label}</span>
        {children}
      </div>
      {hint && <div style={{ fontSize: 10.5, color: "var(--t-text-dim,#8f84ad)", marginTop: 4, lineHeight: 1.45 }}>{hint}</div>}
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on} style={{
      width: 44, height: 26, borderRadius: 99, cursor: "pointer", border: "none", padding: 3, flexShrink: 0,
      background: on ? "linear-gradient(135deg,#34d399,#10b981)" : "rgba(128,128,128,0.25)",
      display: "flex", justifyContent: on ? "flex-end" : "flex-start",
    }}>
      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", display: "block" }} />
    </button>
  );
}

const card = () => ({ background: "var(--t-card,#1d1733)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.16))", borderRadius: 14, padding: "12px 14px" });
const secTitle = () => ({ fontSize: 11, color: "var(--t-text-muted,#b9b0d0)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, marginBottom: 8 });
const vacio = () => ({ fontSize: 12.5, color: "var(--t-text-dim,#8f84ad)", fontStyle: "italic", padding: "6px 0" });
const btnPrimary = () => ({ marginTop: 10, padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", border: "none", background: "linear-gradient(135deg,#34d399,#10b981)" });
const btnGhost = () => ({ display: "flex", alignItems: "center", padding: "6px 12px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, color: "var(--t-text-muted,#b9b0d0)", background: "transparent", border: "1px solid var(--t-card-border,rgba(167,139,250,0.2))" });
