// Importar el historial completo de Health Auto Export desde la app.
//
// El archivo se elige en el dispositivo y va directo a Supabase con la sesión
// de quien lo sube — sin pasar por GitHub ni por ningún otro sitio. Antes de
// enviar, en el propio teléfono: se quita lo íntimo, se quita lo pesado que no
// se usa y se trocea por años (ver `src/lib/healthImport.js`).

import { useState } from "react";
import { validar, trocear } from "../lib/healthImport.js";
import { enviarTrozo } from "../lib/healthApi.js";

const card = { background: "var(--t-card,#1d1733)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.16))", borderRadius: 14, padding: "12px 14px", marginBottom: 10 };
const dim = { fontSize: 11.5, color: "var(--t-text-dim,#8f84ad)", lineHeight: 1.5 };
const boton = (activo = true) => ({
  padding: "8px 14px", borderRadius: 10, cursor: activo ? "pointer" : "default", fontFamily: "inherit",
  fontSize: 13, fontWeight: 600, color: "#fff", border: "none", opacity: activo ? 1 : 0.5,
  background: "linear-gradient(135deg,#a78bfa,#7c3aed)",
});

export default function SaludImportar({ personName, onTerminado }) {
  const [abierto, setAbierto] = useState(false);
  const [fase, setFase] = useState("elegir");     // elegir | leyendo | listo | enviando | hecho
  const [error, setError] = useState(null);
  const [trozos, setTrozos] = useState([]);
  const [resultados, setResultados] = useState({});
  const [nombreArchivo, setNombreArchivo] = useState("");

  const elegir = async e => {
    const f = e.target.files?.[0];
    e.target.value = "";                            // poder elegir el mismo archivo otra vez
    if (!f) return;
    setError(null); setResultados({}); setNombreArchivo(f.name); setFase("leyendo");
    try {
      const json = JSON.parse(await f.text());
      const problema = validar(json);
      if (problema) { setError(problema); setFase("elegir"); return; }
      const t = trocear(json);
      if (!t.length) { setError("El archivo no trae ningún dato con fecha."); setFase("elegir"); return; }
      setTrozos(t); setFase("listo");
    } catch {
      setError("No se pudo leer el archivo. ¿Es el .json que exporta Health Auto Export?");
      setFase("elegir");
    }
  };

  // De uno en uno, no en paralelo: el servidor es gratuito y tiene límites,
  // y así si uno falla los demás siguen y se ve cuál.
  const enviar = async () => {
    setFase("enviando");
    for (const t of trozos) {
      setResultados(r => ({ ...r, [t.etiqueta]: { enviando: true } }));
      const r = await enviarTrozo(t.cuerpo);
      setResultados(prev => ({ ...prev, [t.etiqueta]: r }));
    }
    setFase("hecho");
    onTerminado?.();
  };

  const fallidos = trozos.filter(t => resultados[t.etiqueta] && resultados[t.etiqueta].ok === false);
  const totalKb = trozos.reduce((a, t) => a + t.kb, 0);

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} style={{
        ...card, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", display: "block",
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t-text,#f0e8ff)" }}>📥 Importar historial completo</div>
        <div style={dim}>Sube el archivo que exporta Health Auto Export con todos tus datos antiguos.</div>
      </button>
    );
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t-text,#f0e8ff)", marginBottom: 6 }}>📥 Importar historial completo</div>
      <div style={{ ...dim, marginBottom: 10 }}>
        En Health Auto Export: <b>Export</b> → rango <b>desde el principio</b> → formato <b>JSON</b> → guárdalo en Archivos.
        Luego elígelo aquí. Se guardará a nombre de <b>{personName || "ti"}</b>, y la actividad sexual y los datos de
        ciclo <b>no se envían</b>: se quitan en tu teléfono antes de subir nada.
      </div>

      {(fase === "elegir" || fase === "leyendo") && (
        <label style={{ ...boton(fase === "elegir"), display: "inline-block" }}>
          {fase === "leyendo" ? "Leyendo…" : "Elegir archivo .json"}
          <input type="file" accept=".json,application/json" onChange={elegir} disabled={fase === "leyendo"} style={{ display: "none" }} />
        </label>
      )}
      {error && <div style={{ ...dim, color: "#f87171", marginTop: 8 }}>{error}</div>}

      {fase !== "elegir" && fase !== "leyendo" && (
        <>
          <div style={{ ...dim, marginBottom: 8 }}>
            <b>{nombreArchivo}</b> · {trozos.length} {trozos.length === 1 ? "envío" : "envíos"} · {(totalKb / 1024).toFixed(1)} MB
          </div>
          {trozos.map(t => {
            const r = resultados[t.etiqueta];
            return (
              <div key={t.etiqueta} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", borderTop: "1px solid rgba(167,139,250,0.08)", fontSize: 12.5 }}>
                <span style={{ color: "var(--t-text,#f0e8ff)" }}>{t.etiqueta}</span>
                <span style={{ color: !r ? "var(--t-text-dim,#8f84ad)" : r.enviando ? "#fbbf24" : r.ok ? "#34d399" : "#f87171", textAlign: "right" }}>
                  {!r ? `${t.datos.toLocaleString("es-ES")} datos`
                    : r.enviando ? "enviando…"
                    : r.ok ? `✓ ${r.metricas.toLocaleString("es-ES")} datos${r.entrenos ? ` · ${r.entrenos} entrenos` : ""}${r.descartados ? ` · ${r.descartados} descartados` : ""}`
                    : `✕ ${r.motivo}`}
                </span>
              </div>
            );
          })}
          {fase === "listo" && <button onClick={enviar} style={{ ...boton(), marginTop: 10 }}>Enviar a Supabase</button>}
          {fase === "hecho" && (
            <div style={{ ...dim, marginTop: 10, color: fallidos.length ? "#fbbf24" : "#34d399" }}>
              {fallidos.length
                ? `${fallidos.length} ${fallidos.length === 1 ? "trozo no se pudo" : "trozos no se pudieron"} guardar. Puedes volver a elegir el archivo: lo ya guardado no se duplica.`
                : "Todo guardado. Reenviar el mismo archivo es seguro: no duplica nada."}
            </div>
          )}
        </>
      )}
    </div>
  );
}
