import { useState } from "react";
import { DEFAULT_COLORS } from "../constants.js";
import { exportData, importData, saveData } from "../supabase.js";
import { S } from "../styles.js";

export default function SettingsModal({ data, update, onClose, onSignOut, coupleId }) {
  const [p1, setP1]         = useState(data.settings?.person1 || "Pololo");
  const [p2, setP2]         = useState(data.settings?.person2 || "Banana");
  const [colors, setColors] = useState({ ...DEFAULT_COLORS, ...(data.settings?.colors || {}) });
  const [importMsg, setImportMsg] = useState(null);

  const setColor = (key, val) => setColors(c => ({ ...c, [key]: val }));
  const save = () => {
    update(d => ({ ...d, settings: { ...d.settings, person1: p1.trim() || "Pololo", person2: p2.trim() || "Banana", colors } }));
    onClose();
  };
  const handleImport = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importData(file);
      // 1. Update local state (triggers debounced save)
      update(() => imported);
      // 2. Also push to Supabase immediately so both devices sync right away
      if (coupleId) {
        try {
          await saveData(imported, coupleId);
          setImportMsg("✅ Restaurado y subido a Supabase");
        } catch (saveErr) {
          setImportMsg("⚠️ Restaurado localmente, error Supabase: " + saveErr.message);
        }
      } else {
        setImportMsg("✅ Datos restaurados correctamente");
      }
      setTimeout(() => { setImportMsg(null); onClose(); }, 2500);
    } catch (err) {
      setImportMsg("❌ " + err.message);
      setTimeout(() => setImportMsg(null), 3000);
    }
    e.target.value = "";
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#1d1733", border:"1px solid rgba(167,139,250,0.3)", borderRadius:18, padding:24, width:"100%", maxWidth:400 }}>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:600, marginBottom:20 }}>⚙️ Configuración</div>

        <div style={{ marginBottom:14 }}>
          <label style={S.label}>Persona 1</label>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input value={p1} onChange={e=>setP1(e.target.value)} style={{ ...S.input, flex:1 }} placeholder="Pololo" />
            <input type="color" value={colors.person1} onChange={e=>setColor("person1", e.target.value)}
              style={{ width:36, height:36, border:"none", borderRadius:8, cursor:"pointer", background:"none", padding:2 }} title="Color persona 1" />
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={S.label}>Persona 2</label>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input value={p2} onChange={e=>setP2(e.target.value)} style={{ ...S.input, flex:1 }} placeholder="Banana" />
            <input type="color" value={colors.person2} onChange={e=>setColor("person2", e.target.value)}
              style={{ width:36, height:36, border:"none", borderRadius:8, cursor:"pointer", background:"none", padding:2 }} title="Color persona 2" />
          </div>
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={S.label}>Actividades juntos</label>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <div style={{ flex:1, fontSize:13, color:"#6b5f88", fontStyle:"italic" }}>Color para actividades en pareja</div>
            <input type="color" value={colors.together} onChange={e=>setColor("together", e.target.value)}
              style={{ width:36, height:36, border:"none", borderRadius:8, cursor:"pointer", background:"none", padding:2 }} title="Color juntos" />
          </div>
        </div>

        <div style={{ borderTop:"1px solid rgba(255,255,255,0.08)", marginTop:16, paddingTop:16, marginBottom:16 }}>
          <div style={{ fontSize:11, color:"#6b5f88", marginBottom:10, letterSpacing:1, textTransform:"uppercase" }}>Backup de datos</div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>exportData(data)} style={{ ...S.btnSecondary, fontSize:11, flex:1 }}>📥 Exportar JSON</button>
            <label style={{ ...S.btnSecondary, fontSize:11, flex:1, textAlign:"center", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
              📤 Importar JSON
              <input type="file" accept=".json" onChange={handleImport} style={{ display:"none" }} />
            </label>
          </div>
          {importMsg && <div style={{ fontSize:12, marginTop:8, color: importMsg.startsWith("✅") ? "#34d399" : "#fb923c" }}>{importMsg}</div>}
        </div>

        <div style={{ borderTop:"1px solid rgba(255,255,255,0.08)", marginTop:8, paddingTop:16, marginBottom:4 }}>
          <button onClick={onSignOut} style={{ width:"100%", background:"rgba(244,114,182,0.08)", border:"1px solid rgba(244,114,182,0.2)", borderRadius:8, color:"#f472b6", padding:"9px", cursor:"pointer", fontSize:13, fontFamily:"inherit" }}>
            🚪 Cerrar sesión
          </button>
        </div>

        <div style={{ display:"flex", gap:8, justifyContent:"space-between", alignItems:"center" }}>
          <button onClick={()=>setColors(DEFAULT_COLORS)} style={{ ...S.btnSecondary, fontSize:11 }}>↺ Colores por defecto</button>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={onClose} style={S.btnSecondary}>Cancelar</button>
            <button onClick={save} style={S.btnPrimary}>Guardar ✓</button>
          </div>
        </div>
      </div>
    </div>
  );
}
