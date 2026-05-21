import { signInWithGoogle } from "../supabase.js";

export default function LoginScreen() {
  return (
    <div style={{ background:"#0a0714", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif", color:"#f8f4ff", padding:20 }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ textAlign:"center", maxWidth:340, width:"100%" }}>
        <div style={{ fontSize:64, marginBottom:16 }}>📅</div>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:32, fontWeight:700, marginBottom:8, letterSpacing:-1 }}>Shared Calendar</div>
        <div style={{ fontSize:14, color:"var(--t-text-muted,#8b7fa8)", marginBottom:40, lineHeight:1.6 }}>Tu espacio compartido para planificar<br/>la semana en equipo</div>
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
        <div style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)", marginTop:20, lineHeight:1.6 }}>
          Tus datos son privados y solo accesibles<br/>con tu código de pareja
        </div>
      </div>
    </div>
  );
}
