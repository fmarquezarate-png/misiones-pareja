import { useEffect, useMemo, useState } from "react";
import { LEAGUES, teamsOfLeague, teamById } from "../lib/teams.js";
import { getStandings, getTeamMatches, getScorers } from "../lib/footballApi.js";
import { fixtureToMission, mergeFixtures, fixtureKey } from "../lib/football.js";
import { humanDate } from "../lib/dateLabel.js";
import TeamCrest from "./TeamCrest.jsx";
import { uid } from "../utils.js";

const SECCIONES = [
  { id: "calendario",   label: "Partidos" },
  { id: "clasificacion",label: "Tablas" },
  { id: "jugadores",    label: "Goleadores" },
  { id: "ajustes",      label: "Ajustes" },
];

const COLOR_R = { G: "#34d399", E: "#94a3b8", P: "#f87171" };

// Aviso de procedencia: nunca se pintan datos viejos como si fueran frescos.
function Fuente({ source, staleUntil, updatedAt }) {
  if (source === "live") {
    const min = updatedAt ? Math.round((Date.now() - updatedAt) / 60000) : null;
    return <span style={pill("#34d399")}>● en vivo{min !== null && min > 1 ? ` · hace ${min} min` : ""}</span>;
  }
  if (source === "openfootball") {
    return (
      <span style={pill("#fb923c")} title="La fuente de respaldo va con retraso">
        ⚠ respaldo{staleUntil ? ` · hasta ${humanDate(staleUntil)}` : ""}
      </span>
    );
  }
  return <span style={pill("#94a3b8")}>sin datos</span>;
}

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
  const soyLocal = m.homeId === teamId;
  const rivalId = soyLocal ? m.awayId : m.homeId;
  const rivalNombre = (() => {
    const t = rivalId && teamById(rivalId);
    if (t) return t.short;
    return (soyLocal ? m.away : m.home).replace(/\s+(FC|CF|AFC|SAD|CP)$/i, "");
  })();
  const jugado = !!m.ft;
  const res = jugado ? (() => {
    const propios = soyLocal ? m.ft[0] : m.ft[1];
    const ajenos = soyLocal ? m.ft[1] : m.ft[0];
    return { marcador: `${m.ft[0]}–${m.ft[1]}`, r: propios > ajenos ? "G" : propios === ajenos ? "E" : "P" };
  })() : null;
  // Fecha pasada sin marcador: la fuente todavía no lo ha publicado. Antes
  // estos partidos desaparecían de las dos listas; ahora se dicen.
  const pendiente = !jugado && m.date < new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0", borderBottom: "1px solid rgba(167,139,250,0.08)" }}>
      {rivalId ? <TeamCrest teamId={rivalId} size={20} /> : <span style={{ width: 20, textAlign: "center", fontSize: 13 }}>⚽</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--t-text,#f0e8ff)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {soyLocal ? "vs " : "en "}{rivalNombre}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--t-text-dim,#8f84ad)", marginTop: 1 }}>
          {humanDate(m.date)}{m.time ? ` · ${m.time}` : ""}
          {m.comp ? ` · ${m.comp}` : ""}{m.round ? ` · ${m.round}` : ""}
        </div>
      </div>
      {res ? <span style={{ fontSize: 13, fontWeight: 700, color: COLOR_R[res.r], flexShrink: 0 }}>{res.marcador}</span>
        : pendiente ? <span style={{ fontSize: 10.5, color: "var(--t-text-dim,#8f84ad)", flexShrink: 0, fontStyle: "italic" }}>sin resultado aún</span>
        : onAdd ? (
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
  const teamId = cfg.id || settings.myTeam || null;
  const team = teamById(teamId);
  const [sec, setSec] = useState("calendario");
  const [data, setData] = useState(null);          // { source, matches }
  const [tabla, setTabla] = useState(null);
  const [comp, setComp] = useState(null);          // competición de la tabla
  const [scorers, setScorers] = useState(null);
  const [state, setState] = useState("idle");
  const [picking, setPicking] = useState(!team);

  // Competiciones en las que juega ahora mismo, deducidas de sus partidos.
  const comps = useMemo(() => {
    const set = new Map();
    for (const m of data?.matches || []) if (m.comp) set.set(m.comp, (set.get(m.comp) || 0) + 1);
    return [...set.entries()].map(([name, n]) => ({ name, n }));
  }, [data]);

  useEffect(() => {
    let vivo = true;
    if (!team) return;
    setState("loading");
    getTeamMatches(team.id).then(d => { if (vivo) { setData(d); setState(d.matches.length ? "ready" : "error"); } });
    return () => { vivo = false; };
  }, [team]);

  useEffect(() => {
    if (!team) return;
    const c = comp || team.league;
    let vivo = true;
    getStandings(c).then(t => { if (vivo) setTabla(t); });
    return () => { vivo = false; };
  }, [team, comp]);

  useEffect(() => {
    if (!team || sec !== "jugadores") return;
    let vivo = true;
    getScorers(comp || team.league).then(s => { if (vivo) setScorers(s); });
    return () => { vivo = false; };
  }, [team, sec, comp]);

  const hoy = new Date().toISOString().slice(0, 10);
  const pasados = (data?.matches || []).filter(m => m.date < hoy).slice(-3).reverse();
  const proximos = (data?.matches || []).filter(m => m.date >= hoy).slice(0, 5);
  const form = (data?.matches || []).filter(m => m.ft).slice(-5).map(m => {
    const soyLocal = m.homeId === teamId;
    const propios = soyLocal ? m.ft[0] : m.ft[1], ajenos = soyLocal ? m.ft[1] : m.ft[0];
    return propios > ajenos ? "G" : propios === ajenos ? "E" : "P";
  });
  const mia = tabla?.table?.find(r => r.teamId === teamId);

  const setCfg = patch => onPatchSettings?.({ ...cfg, id: teamId, ...patch });

  // Un partido normalizado → misión, reusando la lógica ya probada.
  const toFixture = m => ({ date: m.date, time: m.time, team1: m.home, team2: m.away });
  const yaImportado = m => mergeFixtures(allMissions, [{ fixtureKey: fixtureKey(toFixture(m)) }]).nuevos.length === 0;
  const addOne = m => {
    const one = fixtureToMission(toFixture(m), teamId, { uid });
    one.who = cfg.who || "together";
    if (m.comp && m.comp !== "Liga") one.title += ` · ${m.comp}`;
    onImport?.(...Object.values(mergeFixtures(allMissions, [one])));
  };
  const addAll = () => {
    const cand = proximos.map(m => {
      const x = fixtureToMission(toFixture(m), teamId, { uid });
      x.who = cfg.who || "together";
      if (m.comp && m.comp !== "Liga") x.title += ` · ${m.comp}`;
      return x;
    });
    const { nuevos, actualizados } = mergeFixtures(allMissions, cand);
    onImport?.(nuevos, actualizados);
  };

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
                <button key={t.id} onClick={() => { setCfg({ id: t.id }); setPicking(false); setData(null); setTabla(null); setComp(null); }}
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
        {team && <button onClick={() => setPicking(false)} style={btnGhost()}>Cancelar</button>}
      </div>
    );
  }

  const liga = LEAGUES.find(l => l.id === team.league);
  const compsTabla = [{ id: team.league, label: liga?.short || "Liga" }, { id: "cl", label: "Champions" }];

  return (
    <div style={{ padding: "12px 12px 120px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <TeamCrest teamId={team.id} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: "var(--t-text,#f8f4ff)", fontFamily: "'Fraunces',serif" }}>{team.short}</div>
          <div style={{ fontSize: 11.5, color: "var(--t-text-dim,#8f84ad)", marginTop: 2 }}>
            {liga?.name}{mia ? ` · ${mia.pos}º con ${mia.pts} pts` : ""}
          </div>
        </div>
        <Racha form={form} />
      </div>
      <div style={{ marginBottom: 12 }}><Fuente source={data?.source} staleUntil={data?.staleUntil} updatedAt={data?.updatedAt} /></div>

      <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
        {SECCIONES.map(s => (
          <button key={s.id} onClick={() => setSec(s.id)} style={{
            flex: 1, padding: "7px 2px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
            fontSize: 11.5, fontWeight: 600,
            background: sec === s.id ? "var(--t-accent-soft,rgba(167,139,250,0.16))" : "transparent",
            border: `1px solid ${sec === s.id ? "rgba(167,139,250,0.4)" : "var(--t-card-border,rgba(167,139,250,0.14))"}`,
            color: sec === s.id ? "var(--t-accent,#c4b8ff)" : "var(--t-text-muted,#b9b0d0)",
          }}>{s.label}</button>
        ))}
      </div>

      {state === "loading" && <div style={{ fontSize: 13, color: "var(--t-text-dim,#8f84ad)", padding: "20px 0", textAlign: "center" }}>Cargando…</div>}

      {sec === "calendario" && state !== "loading" && (
        <>
          {comps.length > 1 && (
            <div style={{ ...card(), marginBottom: 10 }}>
              <div style={secTitle()}>Compitiendo en</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {comps.map(c => (
                  <span key={c.name} style={{ ...pill("#a78bfa"), fontSize: 11 }}>{c.name} · {c.n}</span>
                ))}
              </div>
            </div>
          )}
          <div style={card()}>
            <div style={secTitle()}>Próximos 5</div>
            {proximos.length
              ? proximos.map((m, i) => <FilaPartido key={i} m={m} teamId={team.id} onAdd={addOne} yaEsta={yaImportado(m)} />)
              : <div style={vacio()}>No hay más partidos publicados</div>}
            {proximos.length > 0 && <button onClick={addAll} style={btnPrimary()}>Añadir los {proximos.length} al calendario</button>}
          </div>
          <div style={{ ...card(), marginTop: 10 }}>
            <div style={secTitle()}>Últimos 3</div>
            {pasados.length
              ? pasados.map((m, i) => <FilaPartido key={i} m={m} teamId={team.id} />)
              : <div style={vacio()}>Todavía no hay partidos jugados</div>}
          </div>
        </>
      )}

      {sec === "clasificacion" && (
        <div style={card()}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {compsTabla.map(c => (
              <button key={c.id} onClick={() => setComp(c.id)} style={{
                ...btnGhost(), flex: 1, justifyContent: "center",
                background: (comp || team.league) === c.id ? "var(--t-accent-soft,rgba(167,139,250,0.18))" : "transparent",
                color: (comp || team.league) === c.id ? "var(--t-accent,#c4b8ff)" : "var(--t-text-muted,#b9b0d0)",
              }}>{c.label}</button>
            ))}
          </div>
          {!tabla ? <div style={vacio()}>Cargando…</div>
            : tabla.table?.length ? <>
                <div style={{ marginBottom: 8 }}><Fuente source={tabla.source} staleUntil={tabla.staleUntil} updatedAt={tabla.updatedAt} /></div>
                <Tabla tabla={tabla.table} teamId={team.id} />
              </>
            : <div style={vacio()}>
                {(comp || team.league) === "cl"
                  ? "La clasificación de Champions necesita la conexión en vivo (ver Ajustes)."
                  : "Sin datos de clasificación ahora mismo."}
              </div>}
        </div>
      )}

      {sec === "jugadores" && (
        <div style={card()}>
          <div style={secTitle()}>Goleadores · {comp === "cl" ? "Champions" : liga?.name}</div>
          {!scorers ? <div style={vacio()}>Cargando…</div>
            : scorers.scorers?.length ? (
              <>
                {scorers.scorers.slice(0, 15).map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid rgba(167,139,250,0.08)" }}>
                    <span style={{ width: 18, fontSize: 11, color: "var(--t-text-dim,#8f84ad)", textAlign: "right" }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--t-text,#f0e8ff)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                      <div style={{ fontSize: 10.5, color: "var(--t-text-dim,#8f84ad)" }}>{s.teamName}</div>
                    </div>
                    {s.assists != null && <span style={{ fontSize: 11, color: "var(--t-text-dim,#8f84ad)", flexShrink: 0 }}>{s.assists} asist.</span>}
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--t-accent,#c4b8ff)", flexShrink: 0, minWidth: 22, textAlign: "right" }}>{s.goals}</span>
                  </div>
                ))}
                <div style={{ fontSize: 10.5, color: "var(--t-text-dim,#8f84ad)", marginTop: 10, lineHeight: 1.45 }}>
                  Goles y asistencias de la competición. Las tarjetas y la valoración media no las publica ninguna fuente abierta — ver Ajustes.
                </div>
              </>
            ) : (
              <div style={vacio()}>
                Los goleadores necesitan la conexión en vivo. Mira los Ajustes para activarla.
              </div>
            )}
        </div>
      )}

      {sec === "ajustes" && (
        <>
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

          <div style={{ ...card(), marginTop: 10 }}>
            <div style={secTitle()}>Conexión de datos</div>
            <div style={{ fontSize: 12.5, color: "var(--t-text-muted,#b9b0d0)", lineHeight: 1.55 }}>
              {data?.source === "live" ? (
                <>✅ <b>En vivo</b>. Clasificación al minuto, Champions, Copa y goleadores.</>
              ) : (
                <>
                  ⚠ Ahora mismo se usa la <b>fuente de respaldo</b> (openfootball), que va con días de retraso
                  y solo trae la liga.<br /><br />
                  Para tener datos en vivo hay que desplegar la función <code style={code()}>football</code> en
                  Supabase con una clave de <b>football-data.org</b> (la misma de tu widget). Está escrita y
                  lista en <code style={code()}>supabase/functions/football</code>; los pasos están en{" "}
                  <code style={code()}>docs/mi-equipo-datos.md</code>.
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Tabla({ tabla, teamId }) {
  const idx = tabla.findIndex(r => r.teamId === teamId);
  const top = 5;
  const cabeza = tabla.slice(0, top);
  const entorno = idx >= top ? tabla.slice(Math.max(top, idx - 1), Math.min(tabla.length, idx + 2)) : [];
  const fila = r => (
    <div key={`${r.pos}-${r.name}`} style={{
      display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", borderRadius: 8,
      background: r.teamId === teamId ? "var(--t-accent-soft,rgba(167,139,250,0.14))" : "transparent",
    }}>
      <span style={{ width: 18, fontSize: 11, color: "var(--t-text-dim,#8f84ad)", textAlign: "right" }}>{r.pos}</span>
      {r.teamId ? <TeamCrest teamId={r.teamId} size={18} />
        : r.crestUrl ? <img src={r.crestUrl} alt="" width={18} height={18} style={{ objectFit: "contain" }} />
        : <span style={{ width: 18 }} />}
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
      {entorno.length > 0 && <div style={{ textAlign: "center", color: "var(--t-text-dim,#8f84ad)", fontSize: 12 }}>···</div>}
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
const vacio = () => ({ fontSize: 12.5, color: "var(--t-text-dim,#8f84ad)", fontStyle: "italic", padding: "6px 0", lineHeight: 1.5 });
const btnPrimary = () => ({ marginTop: 10, padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", border: "none", background: "linear-gradient(135deg,#34d399,#10b981)" });
const btnGhost = () => ({ display: "flex", alignItems: "center", padding: "6px 12px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, color: "var(--t-text-muted,#b9b0d0)", background: "transparent", border: "1px solid var(--t-card-border,rgba(167,139,250,0.2))" });
const pill = c => ({ display: "inline-block", fontSize: 10.5, fontWeight: 600, padding: "3px 9px", borderRadius: 99, background: `${c}1a`, color: c, border: `1px solid ${c}44` });
const code = () => ({ background: "rgba(167,139,250,0.14)", padding: "1px 5px", borderRadius: 5, fontSize: 11.5 });
