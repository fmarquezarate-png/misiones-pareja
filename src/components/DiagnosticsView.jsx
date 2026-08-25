import { useState, useEffect, useCallback } from "react";
import { loadEventStats } from "../lib/diagnostics.js";

const fmtBytes = (n) => {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} kB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};
const fmtTs = (ts) => { try { return new Date(ts).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return ts; } };

const RANGES = [{ h: 24, label: "24h" }, { h: 48, label: "48h" }, { h: 168, label: "7d" }];

// Panel de diagnóstico (F-P1-1): lee la telemetría `events` de la pareja y la
// resume — save_error/cas_rpc_error, tamaño del blob, etc. — sin abrir Supabase.
export default function DiagnosticsView({ coupleId }) {
  const [hours, setHours] = useState(48);
  const [stats, setStats] = useState(null);
  const [state, setState] = useState("loading"); // loading | ok | error
  const [errMsg, setErrMsg] = useState("");

  const load = useCallback(() => {
    if (!coupleId) return;
    setState("loading");
    loadEventStats(coupleId, hours)
      .then(s => { setStats(s); setState("ok"); })
      .catch(e => { setErrMsg(e.message); setState("error"); });
  }, [coupleId, hours]);

  useEffect(() => { load(); }, [load]);

  const blobWarn = stats?.maxBlob != null && stats.maxBlob > 500 * 1024; // >500 kB = vigilar

  return (
    <div style={{ padding: "16px 16px 120px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--t-text,#f8f4ff)", fontFamily: "'Fraunces',serif" }}>🔍 Diagnóstico</div>
        <button onClick={load} style={btnGhost}>↻ Actualizar</button>
      </div>
      <div style={{ fontSize: 12, color: "var(--t-text-dim,#6b5f88)", marginBottom: 14 }}>Telemetría de la pareja (tabla <code>events</code>). Sin salir de la app.</div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {RANGES.map(r => (
          <button key={r.h} onClick={() => setHours(r.h)} style={{ ...chip, ...(hours === r.h ? chipOn : {}) }}>{r.label}</button>
        ))}
      </div>

      {state === "loading" && <div style={muted}>Cargando telemetría…</div>}
      {state === "error" && (
        <div style={{ ...card, borderColor: "rgba(251,146,60,0.4)" }}>
          <div style={{ color: "#fb923c", fontSize: 13 }}>No se pudo leer la telemetría.</div>
          <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 11, color: "var(--t-text-dim,#6b5f88)", marginTop: 6, wordBreak: "break-word" }}>{errMsg}</div>
        </div>
      )}

      {state === "ok" && stats && (
        <>
          {/* Tamaño del blob — la métrica que resolvió la saga de guardado */}
          <div style={{ ...card, borderColor: blobWarn ? "rgba(251,146,60,0.5)" : "rgba(52,211,153,0.35)" }}>
            <div style={rowLabel}>Tamaño del blob (guardado)</div>
            <div style={{ display: "flex", gap: 18, marginTop: 6 }}>
              <div><div style={big}>{fmtBytes(stats.latestBlob)}</div><div style={sub}>último</div></div>
              <div><div style={{ ...big, color: blobWarn ? "#fb923c" : undefined }}>{fmtBytes(stats.maxBlob)}</div><div style={sub}>máximo</div></div>
            </div>
            <div style={{ fontSize: 11, color: blobWarn ? "#fb923c" : "var(--t-text-dim,#6b5f88)", marginTop: 8 }}>
              {stats.latestBlob == null ? "Aún sin muestras de guardado en el rango." : blobWarn ? "⚠️ >500 kB — vigilar (¿fotos/base64 o chat creciendo?)" : "✅ En rango sano (la cura de las fotos aguanta)."}
            </div>
          </div>

          {/* Fallos accionables */}
          <div style={{ ...card, borderColor: stats.errorCount ? "rgba(251,146,60,0.4)" : "rgba(167,139,250,0.2)" }}>
            <div style={rowLabel}>Fallos en el rango: <b style={{ color: stats.errorCount ? "#fb923c" : "#34d399" }}>{stats.errorCount}</b></div>
            {stats.errorsRecent.length === 0
              ? <div style={{ ...muted, marginTop: 6 }}>Sin fallos 🎉</div>
              : <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  {stats.errorsRecent.map((e, i) => (
                    <div key={i} style={{ borderTop: i ? "1px solid rgba(255,255,255,0.06)" : "none", paddingTop: i ? 8 : 0 }}>
                      <div style={{ fontSize: 12, color: "#fdba74", fontWeight: 600 }}>{e.name}{e.code ? ` · [${e.code}]` : ""}{e.blob_size != null ? ` · blob ${fmtBytes(e.blob_size)}` : ""}</div>
                      {e.message && <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 11, color: "var(--t-text-muted,#8b7fa8)", wordBreak: "break-word", marginTop: 2 }}>{String(e.message).slice(0, 160)}</div>}
                      <div style={{ fontSize: 10, color: "var(--t-text-dim,#4a4166)", marginTop: 2 }}>{fmtTs(e.ts)}</div>
                    </div>
                  ))}
                </div>}
          </div>

          {/* Recuento por tipo de evento */}
          <div style={card}>
            <div style={rowLabel}>Eventos por tipo · {stats.total} en {hours}h</div>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {stats.names.map(n => (
                <div key={n} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--t-text-muted,#8b7fa8)" }}>
                  <span style={{ fontFamily: "ui-monospace,monospace" }}>{n}</span><b style={{ color: "var(--t-text,#f0e8ff)" }}>{stats.byName[n]}</b>
                </div>
              ))}
              {!stats.names.length && <div style={muted}>Sin eventos en el rango.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const card = { background: "var(--t-card,#1d1733)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 14, padding: "12px 14px", marginBottom: 12 };
const rowLabel = { fontSize: 12, color: "var(--t-text-muted,#8b7fa8)", fontWeight: 600 };
const big = { fontSize: 22, fontWeight: 700, color: "var(--t-text,#f0e8ff)", fontFamily: "'Fraunces',serif" };
const sub = { fontSize: 10, color: "var(--t-text-dim,#6b5f88)" };
const muted = { fontSize: 12, color: "var(--t-text-dim,#6b5f88)" };
const btnGhost = { background: "rgba(128,128,128,0.1)", border: "none", borderRadius: 8, color: "var(--t-text-muted,#8b7fa8)", fontSize: 12, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" };
const chip = { flex: 1, background: "rgba(128,128,128,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#6b5f88", padding: "6px", cursor: "pointer", fontSize: 12, fontFamily: "inherit" };
const chipOn = { background: "rgba(167,139,250,0.2)", border: "1px solid rgba(167,139,250,0.5)", color: "#c4b8ff", fontWeight: 600 };
