import { useState } from "react";
import { updatePassword } from "../supabase.js";
import { translateAuthError } from "../lib/authErrors.js";
import { S } from "../styles.js";

const inputDark = { ...S.input, background: "rgba(255,255,255,0.06)", padding: "12px 14px", fontSize: 15, borderRadius: 10 };

// Se muestra cuando el usuario llega desde el link de "olvidé mi contraseña"
// (Supabase detecta el token de recovery en la URL y dispara PASSWORD_RECOVERY).
export default function ResetPasswordScreen({ onDone }) {
  const [password,  setPassword]  = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const submit = async () => {
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); return; }
    if (password !== password2) { setError("Las contraseñas no coinciden"); return; }
    setError(null);
    setLoading(true);
    const { error: err } = await updatePassword(password);
    setLoading(false);
    if (err) { setError(translateAuthError(err)); return; }
    onDone();
  };

  return (
    <div style={{ background:"#0a0714", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif", color:"#f8f4ff", padding:20 }}>
      <div style={{ textAlign:"center", maxWidth:340, width:"100%" }}>
        <div style={{ fontSize:52, marginBottom:14 }}>🔑</div>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:700, marginBottom:8 }}>Elige tu nueva contraseña</div>
        <div style={{ fontSize:13, color:"var(--t-text-muted,#8b7fa8)", marginBottom:26, lineHeight:1.6 }}>Ya verificamos tu identidad — solo falta esto.</div>

        <div style={{ textAlign:"left", marginBottom:10 }}>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Nueva contraseña" autoComplete="new-password"
            onKeyDown={e=>e.key==="Enter"&&!loading&&submit()} style={inputDark} />
        </div>
        <div style={{ textAlign:"left", marginBottom:10 }}>
          <input type="password" value={password2} onChange={e=>setPassword2(e.target.value)} placeholder="Repite la contraseña" autoComplete="new-password"
            onKeyDown={e=>e.key==="Enter"&&!loading&&submit()} style={inputDark} />
        </div>

        {error && <div style={{ fontSize:12.5, color:"#f87171", textAlign:"left", marginBottom:10, lineHeight:1.5 }}>{error}</div>}

        <button onClick={submit} disabled={loading}
          style={{ ...S.btnPrimary, width:"100%", padding:"12px 20px", fontSize:14, borderRadius:10, opacity:loading?0.6:1, cursor:loading?"default":"pointer" }}>
          {loading ? "Guardando…" : "Guardar contraseña"}
        </button>
      </div>
    </div>
  );
}
