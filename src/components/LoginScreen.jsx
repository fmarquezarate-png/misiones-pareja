import { useState } from "react";
import { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPasswordForEmail } from "../supabase.js";
import { translateAuthError } from "../lib/authErrors.js";
import { S } from "../styles.js";

const inputDark = { ...S.input, background: "rgba(255,255,255,0.06)", padding: "12px 14px", fontSize: 15, borderRadius: 10 };

export default function LoginScreen() {
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null); // mensaje de éxito (confirma tu email / enlace enviado)

  const reset = () => { setError(null); setInfo(null); };
  const switchMode = m => { setMode(m); reset(); setPassword(""); };

  const submit = async () => {
    if (!email.trim()) { setError("Escribe tu email"); return; }
    reset();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error: err } = await resetPasswordForEmail(email.trim());
        if (err) { setError(translateAuthError(err)); return; }
        setInfo("Te enviamos un enlace para restablecer tu contraseña — revisa tu correo.");
        return;
      }
      if (!password) { setError("Escribe tu contraseña"); return; }
      if (mode === "signup") {
        const { data, error: err } = await signUpWithEmail(email.trim(), password);
        if (err) { setError(translateAuthError(err)); return; }
        if (!data.session) {
          // Confirmación de email activada en Supabase — no hay sesión todavía
          setInfo("Cuenta creada — revisa tu correo y confirma tu email antes de entrar.");
          setMode("login");
        }
        // Si hay sesión, el listener de auth en AppWithAuth toma el relevo solo.
      } else {
        const { error: err } = await signInWithEmail(email.trim(), password);
        if (err) setError(translateAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "signup" ? "Crear cuenta" : mode === "forgot" ? "Recuperar contraseña" : "Iniciar sesión";

  return (
    <div style={{ background:"#0a0714", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif", color:"#f8f4ff", padding:20 }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ textAlign:"center", maxWidth:340, width:"100%" }}>
        <div style={{ fontSize:64, marginBottom:16 }}>📅</div>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:32, fontWeight:700, marginBottom:8, letterSpacing:-1 }}>Shared Calendar</div>
        <div style={{ fontSize:14, color:"var(--t-text-muted,#8b7fa8)", marginBottom:32, lineHeight:1.6 }}>Tu espacio compartido para planificar<br/>la semana en equipo</div>

        <button onClick={signInWithGoogle}
          style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, width:"100%", padding:"14px 20px", background:"#fff", border:"none", borderRadius:12, cursor:"pointer", fontSize:15, fontWeight:600, color:"#1a1a2e", fontFamily:"inherit", boxShadow:"0 4px 20px rgba(0,0,0,0.3)", transition:"transform 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
          onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Entrar con Google
        </button>

        <div style={{ display:"flex", alignItems:"center", gap:10, margin:"22px 0" }}>
          <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.1)" }} />
          <span style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)" }}>o</span>
          <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.1)" }} />
        </div>

        <div style={{ fontSize:13, fontWeight:600, color:"#c4b8ff", marginBottom:14, textAlign:"left" }}>{title}</div>

        <div style={{ textAlign:"left", marginBottom:10 }}>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" autoComplete="email"
            onKeyDown={e=>e.key==="Enter"&&!loading&&submit()} style={inputDark} />
        </div>
        {mode !== "forgot" && (
          <div style={{ textAlign:"left", marginBottom:10 }}>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Contraseña" autoComplete={mode==="signup"?"new-password":"current-password"}
              onKeyDown={e=>e.key==="Enter"&&!loading&&submit()} style={inputDark} />
          </div>
        )}

        {error && <div style={{ fontSize:12.5, color:"#f87171", textAlign:"left", marginBottom:10, lineHeight:1.5 }}>{error}</div>}
        {info && <div style={{ fontSize:12.5, color:"#34d399", textAlign:"left", marginBottom:10, lineHeight:1.5 }}>{info}</div>}

        <button onClick={submit} disabled={loading}
          style={{ ...S.btnPrimary, width:"100%", padding:"12px 20px", fontSize:14, borderRadius:10, opacity:loading?0.6:1, cursor:loading?"default":"pointer", marginBottom:14 }}>
          {loading ? "Un momento…" : mode === "signup" ? "Crear cuenta" : mode === "forgot" ? "Enviar enlace" : "Entrar"}
        </button>

        <div style={{ display:"flex", justifyContent:"center", gap:14, fontSize:12 }}>
          {mode === "login" && (
            <>
              <button onClick={()=>switchMode("signup")} style={{ background:"none", border:"none", color:"var(--t-accent,#a78bfa)", cursor:"pointer", fontFamily:"inherit", padding:0 }}>Crear cuenta</button>
              <button onClick={()=>switchMode("forgot")} style={{ background:"none", border:"none", color:"var(--t-text-muted,#8b7fa8)", cursor:"pointer", fontFamily:"inherit", padding:0 }}>¿Olvidaste tu contraseña?</button>
            </>
          )}
          {(mode === "signup" || mode === "forgot") && (
            <button onClick={()=>switchMode("login")} style={{ background:"none", border:"none", color:"var(--t-accent,#a78bfa)", cursor:"pointer", fontFamily:"inherit", padding:0 }}>← Volver a iniciar sesión</button>
          )}
        </div>

        <div style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)", marginTop:24, lineHeight:1.6 }}>
          Tus datos son privados y solo accesibles<br/>con tu código de pareja
        </div>
      </div>
    </div>
  );
}
