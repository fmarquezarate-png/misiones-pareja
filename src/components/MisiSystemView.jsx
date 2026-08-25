import { useCallback, useEffect, useMemo, useState } from "react";
import { loadLatestBackup } from "../supabase.js";
import { loadEventStats } from "../lib/diagnostics.js";
import { probeMisi } from "../lib/misi.js";

const APP_TIME_ZONE = "Europe/Madrid";
const MAX_BACKUPS = 8;

const fmtDate = (value) => {
  if (!value) return "Sin registro";
  try {
    return new Date(value).toLocaleString("es-ES", {
      timeZone: APP_TIME_ZONE,
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
};

function countMissions(data) {
  return Object.values(data?.weeks || {}).reduce((sum, week) => sum + (week?.missions?.length || 0), 0);
}

function todayMadrid() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function findDailyEvents(stats) {
  const events = stats?.errorsRecent || [];
  return events.filter(e => String(e.name || "").includes("daily") || String(e.message || "").includes("daily"));
}

function StatusCard({ title, value, detail, tone = "neutral" }) {
  const color = tone === "ok" ? "#34d399" : tone === "warn" ? "#fbbf24" : tone === "bad" ? "#fb7185" : "var(--t-text,#f0e8ff)";
  return (
    <div style={card}>
      <div style={label}>{title}</div>
      <div style={{ ...big, color }}>{value}</div>
      {detail && <div style={sub}>{detail}</div>}
    </div>
  );
}

export default function MisiSystemView({ coupleId, data }) {
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState(null);

  const local = useMemo(() => {
    const weeks = Object.keys(data?.weeks || {}).length;
    const missions = countMissions(data);
    const today = todayMadrid();
    const notifications = data?.settings?.notifications || {};
    return {
      weeks,
      missions,
      today,
      dailyEnabled: notifications.dailyBriefing === true,
      dailyTime: notifications.briefingTime || "08:00",
    };
  }, [data]);

  const load = useCallback(async () => {
    if (!coupleId) return;
    setState("loading");
    setError("");
    try {
      const [backup, stats, misi] = await Promise.all([
        loadLatestBackup(coupleId).catch(e => ({ error: e.message })),
        loadEventStats(coupleId, 168).catch(e => ({ error: e.message })),
        probeMisi().catch(e => ({ error: e.message })),
      ]);
      setSnapshot({ backup, stats, misi, loadedAt: new Date().toISOString() });
      setState("ok");
    } catch (e) {
      setError(e.message || "No se pudo cargar el sistema");
      setState("error");
    }
  }, [coupleId]);

  useEffect(() => { load(); }, [load]);

  const backup = snapshot?.backup;
  const stats = snapshot?.stats;
  const misi = snapshot?.misi;
  const backupMissions = backup?.data ? countMissions(backup.data) : null;
  const backupWeeks = backup?.data?.weeks ? Object.keys(backup.data.weeks).length : null;
  const hasErrors = stats?.errorCount > 0;
  const dailySignals = findDailyEvents(stats);

  return (
    <div style={{ padding: "16px 16px 120px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--t-text,#f8f4ff)", fontFamily: "'Fraunces',serif" }}>Sistema Misi</div>
          <div style={{ fontSize: 12, color: "var(--t-text-dim,#6b5f88)", marginTop: 2 }}>Salud de datos, backups y puente de Misi.</div>
        </div>
        <button onClick={load} disabled={state === "loading"} style={btn}>
          {state === "loading" ? "Revisando..." : "Actualizar"}
        </button>
      </div>

      {state === "error" && (
        <div style={{ ...card, borderColor: "rgba(251,113,133,0.45)" }}>
          <div style={{ color: "#fb7185", fontSize: 13, fontWeight: 700 }}>No se pudo cargar el estado.</div>
          <div style={{ ...mono, marginTop: 6 }}>{error}</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
        <StatusCard title="Supabase" value={local.missions ? "OK" : "Sin datos"} detail={`${local.weeks} semanas · ${local.missions} misiones`} tone={local.missions ? "ok" : "warn"} />
        <StatusCard title="Misi chat" value={misi?.error ? "Revisar" : "OK"} detail={misi?.error || "Edge Function responde"} tone={misi?.error ? "warn" : "ok"} />
        <StatusCard title="Backup más reciente" value={backup?.error ? "Revisar" : fmtDate(backup?.created_at)} detail={backup?.error || (backupWeeks != null ? `${backupWeeks} semanas · ${backupMissions} misiones` : "Sin backup disponible")} tone={backup?.error ? "warn" : backup ? "ok" : "warn"} />
        <StatusCard title="Mensaje diario" value={local.dailyEnabled ? "Activo" : "Pausado en app"} detail={`${local.dailyTime} España · fecha ${local.today}`} tone={local.dailyEnabled ? "ok" : "warn"} />
      </div>

      <div style={card}>
        <div style={label}>Backups</div>
        <div style={{ fontSize: 13, color: "var(--t-text-muted,#8b7fa8)", lineHeight: 1.55, marginTop: 6 }}>
          Política operativa recomendada: máximo {MAX_BACKUPS} backups, limpieza automática antes de superar 10 y restauración sólo con confirmación humana.
        </div>
        <div style={{ ...sub, marginTop: 8 }}>Esta pantalla todavía no borra backups desde Vercel; la limpieza real sigue protegida en Vento.</div>
      </div>

      <div style={{ ...card, borderColor: hasErrors ? "rgba(251,191,36,0.45)" : "rgba(52,211,153,0.28)" }}>
        <div style={label}>Errores recientes · 7 días</div>
        <div style={{ ...big, color: hasErrors ? "#fbbf24" : "#34d399" }}>{stats?.errorCount ?? "..."}</div>
        {stats?.error ? (
          <div style={mono}>{stats.error}</div>
        ) : hasErrors ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {stats.errorsRecent.slice(0, 8).map((e, i) => (
              <div key={`${e.ts}-${i}`} style={{ borderTop: i ? "1px solid rgba(255,255,255,0.06)" : "none", paddingTop: i ? 8 : 0 }}>
                <div style={{ fontSize: 12, color: "#fdba74", fontWeight: 700 }}>{e.name}</div>
                {e.message && <div style={mono}>{String(e.message).slice(0, 180)}</div>}
                <div style={sub}>{fmtDate(e.ts)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={sub}>Sin fallos accionables registrados en la telemetría reciente.</div>
        )}
      </div>

      <div style={card}>
        <div style={label}>Señales del resumen diario</div>
        {dailySignals.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {dailySignals.slice(0, 5).map((e, i) => (
              <div key={`${e.ts}-${i}`}>
                <div style={{ fontSize: 12, color: "var(--t-text,#f0e8ff)", fontWeight: 650 }}>{e.name}</div>
                <div style={sub}>{fmtDate(e.ts)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={sub}>No hay eventos de fallo del resumen diario en la telemetría de la app. El lock final vive en Vento.</div>
        )}
      </div>

      <div style={{ ...sub, textAlign: "center", marginTop: 14 }}>
        Última revisión: {fmtDate(snapshot?.loadedAt)}
      </div>
    </div>
  );
}

const card = { background: "var(--t-card,#1d1733)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 12, padding: "12px 14px" };
const label = { fontSize: 11, color: "var(--t-text-dim,#6b5f88)", fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" };
const big = { fontSize: 20, fontWeight: 800, color: "var(--t-text,#f0e8ff)", marginTop: 5, lineHeight: 1.1 };
const sub = { fontSize: 12, color: "var(--t-text-muted,#8b7fa8)", lineHeight: 1.45, marginTop: 5 };
const mono = { fontFamily: "ui-monospace,Menlo,monospace", fontSize: 11, color: "var(--t-text-muted,#8b7fa8)", wordBreak: "break-word", lineHeight: 1.45 };
const btn = { background: "rgba(167,139,250,0.14)", border: "1px solid rgba(167,139,250,0.35)", borderRadius: 10, color: "#c4b8ff", fontSize: 12, fontWeight: 700, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 };
