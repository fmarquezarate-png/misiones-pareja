import { useState } from "react";
import { runFullBackfill, verifyBackfill } from "../lib/backfill.js";

export default function DevBackfillPanel({ coupleId, blobData }) {
  if (!import.meta.env.DEV) return null;

  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [step, setStep] = useState("");

  // Contar misiones en blob
  const blobMissions = Object.values(blobData?.weeks || {})
    .reduce((s, w) => s + (w.missions?.length || 0), 0);
  const blobGoals = (blobData?.goals || []).length;

  const runBackfill = async () => {
    setStatus("running");
    setStep("Migrando misiones...");
    const r = await runFullBackfill(coupleId, blobData);
    if (!r.ok) {
      setStatus("error");
      setResult(r);
    } else {
      setStatus("done");
      setResult(r);
    }
  };

  const runVerify = async () => {
    setStatus("verifying");
    const r = await verifyBackfill(coupleId, blobData);
    setStatus("verified");
    setResult(r);
  };

  const panelStyle = {
    position: "fixed",
    bottom: 16,
    right: 16,
    zIndex: 9999,
    background: "rgba(10,7,20,0.97)",
    border: "1px solid rgba(251,146,60,0.5)",
    borderRadius: 12,
    padding: "12px 16px",
    fontFamily: "monospace",
    fontSize: 11,
    color: "#f8f4ff",
    minWidth: 280,
    maxWidth: 340,
    boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
  };

  const btnStyle = (color = "#fb923c") => ({
    background: "none",
    border: `1px solid ${color}`,
    borderRadius: 8,
    color,
    fontFamily: "monospace",
    fontSize: 11,
    padding: "5px 12px",
    cursor: "pointer",
    marginTop: 8,
    marginRight: 6,
  });

  return (
    <div style={panelStyle}>
      <div style={{ color: "#fb923c", fontWeight: 700, marginBottom: 8 }}>
        🛠️ DEV · Sprint D Backfill
      </div>
      <div style={{ color: "#8b7fa8", marginBottom: 8, lineHeight: 1.6 }}>
        Pareja: <span style={{ color: "#c4b8ff" }}>{coupleId?.slice(0, 8)}…</span><br />
        Misiones en blob: <span style={{ color: "#f8f4ff" }}>{blobMissions}</span><br />
        Metas en blob: <span style={{ color: "#f8f4ff" }}>{blobGoals}</span>
      </div>

      {status === "idle" && (
        <div>
          <button style={btnStyle()} onClick={runBackfill}>▶ Ejecutar backfill</button>
          <button style={btnStyle("#60a5fa")} onClick={runVerify}>🔍 Verificar</button>
        </div>
      )}

      {status === "running" && (
        <div style={{ color: "#fb923c" }}>⏳ {step}</div>
      )}

      {status === "done" && result && (
        <div>
          <div style={{ color: "#34d399", marginBottom: 6 }}>✅ Completado</div>
          <div style={{ color: "#8b7fa8", lineHeight: 1.6 }}>
            missions: <span style={{ color: "#f8f4ff" }}>{result.missions?.inserted} filas</span><br />
            goals: <span style={{ color: "#f8f4ff" }}>{result.goals?.inserted} filas</span><br />
            settings: <span style={{ color: "#f8f4ff" }}>ok</span>
          </div>
          <button style={btnStyle("#60a5fa")} onClick={runVerify}>🔍 Verificar consistencia</button>
        </div>
      )}

      {status === "verifying" && (
        <div style={{ color: "#60a5fa" }}>⏳ Verificando consistencia…</div>
      )}

      {status === "verified" && result && (
        <div>
          <div style={{ color: "#60a5fa", marginBottom: 6 }}>Verificación:</div>
          <div style={{ lineHeight: 1.8 }}>
            {["missions", "goals"].map(k => result[k] && (
              <div key={k}>
                {result[k].match ? "✅" : "❌"} {k}:{" "}
                <span style={{ color: "#8b7fa8" }}>blob={result[k].blob} db={result[k].db}</span>
              </div>
            ))}
            <div style={{ marginTop: 4, fontWeight: 700 }}>
              {result.consistent
                ? <span style={{ color: "#34d399" }}>✅ Consistente</span>
                : <span style={{ color: "#f472b6" }}>❌ Inconsistente</span>}
            </div>
          </div>
          <button style={btnStyle()} onClick={() => { setStatus("idle"); setResult(null); }}>↺ Reset</button>
        </div>
      )}

      {status === "error" && result && (
        <div>
          <div style={{ color: "#f472b6", marginBottom: 4 }}>❌ Error en: {result.step}</div>
          <div style={{ color: "#8b7fa8", fontSize: 10, marginBottom: 6, wordBreak: "break-word" }}>
            {result.missions?.error || result.goals?.error || result.settings?.error}
          </div>
          <div style={{ color: "#6b5f88", fontSize: 10, marginBottom: 6 }}>
            Las tablas pueden no existir aún.<br />Espera a que el SQL agent complete D-1→D-5.
          </div>
          <button style={btnStyle()} onClick={() => { setStatus("idle"); setResult(null); }}>↺ Reintentar</button>
        </div>
      )}
    </div>
  );
}
