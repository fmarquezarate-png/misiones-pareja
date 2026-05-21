import { useState } from "react";
import { createCouple, joinCouple, signOut } from "../supabase.js";

export default function OnboardingScreen({ session, onDone }) {
  const [step, setStep]       = useState("choice"); // choice | create | join
  const [name, setName]       = useState(session?.user?.user_metadata?.full_name?.split(" ")[0] || "");
  const [code, setCode]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleCreate = async () => {
    if (!name.trim() || !code.trim()) return;
    setLoading(true); setError(null);
    const res = await createCouple(code.trim().toUpperCase(), name.trim());
    if (res.error) { setError(res.error); setLoading(false); return; }
    onDone({ couple_id: res.couple_id, person_name: name.trim() });
  };

  const handleJoin = async () => {
    if (!name.trim() || !code.trim()) return;
    setLoading(true); setError(null);
    const res = await joinCouple(code.trim().toUpperCase(), name.trim());
    if (res.error) { setError(res.error); setLoading(false); return; }
    onDone({ couple_id: res.couple_id, person_name: name.trim() });
  };

  const inputStyle = { background:"rgba(128,128,128,0.10)", border:"1px solid rgba(167,139,250,0.25)", borderRadius:10, padding:"12px 14px", color:"#f8f4ff", fontSize:15, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box", letterSpacing:0.3 };
  const btnStyle = { background:"linear-gradient(135deg,#f472b6,#a78bfa)", border:"none", borderRadius:10, color:"#fff", padding:"13px", cursor:"pointer", fontSize:15, fontWeight:600, fontFamily:"inherit", width:"100%", opacity:loading?0.6:1 };
  const backBtn = { background:"none", border:"none", color:"var(--t-text-dim,#6b5f88)", cursor:"pointer", fontSize:13, fontFamily:"inherit", marginBottom:20, padding:0 };

  return (
    <div style={{ background:"#0a0714", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif", color:"#f8f4ff", padding:20 }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ maxWidth:360, width:"100%" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:48, marginBottom:10 }}>💞</div>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:700 }}>¡Bienvenido/a!</div>
          <div style={{ fontSize:13, color:"var(--t-text-muted,#8b7fa8)", marginTop:8 }}>
            {session?.user?.email && <span>Conectado como <strong style={{ color:"var(--t-accent,#a78bfa)" }}>{session.user.email}</strong></span>}
          </div>
        </div>

        {step === "choice" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ fontSize:13, color:"var(--t-text-muted,#8b7fa8)", textAlign:"center", marginBottom:8 }}>¿Qué quieres hacer?</div>
            <button onClick={() => setStep("create")}
              style={{ ...btnStyle, background:"linear-gradient(135deg,#f472b6,#a78bfa)" }}>
              ✨ Crear una pareja nueva
            </button>
            <button onClick={() => setStep("join")}
              style={{ ...btnStyle, background:"rgba(167,139,250,0.15)", border:"1px solid rgba(167,139,250,0.3)", color:"#c4b8ff" }}>
              🔗 Unirme a una pareja existente
            </button>
            <button onClick={() => signOut()} style={{ ...backBtn, marginTop:8, textAlign:"center", width:"100%", display:"block" }}>
              ← Cerrar sesión
            </button>
          </div>
        )}

        {step === "create" && (
          <div>
            <button onClick={() => { setStep("choice"); setError(null); }} style={backBtn}>← Volver</button>
            <div style={{ fontSize:14, color:"var(--t-text-muted,#8b7fa8)", marginBottom:20 }}>
              Crea un espacio privado para vuestra pareja con un código único que compartiréis.
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:6 }}>Tu nombre</div>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej: Ana, Carlos…" style={inputStyle} />
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:6 }}>Código de pareja</div>
              <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="Ej: FRAN-ANA" maxLength={20} style={{ ...inputStyle, letterSpacing:2, textTransform:"uppercase" }} />
              <div style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)", marginTop:5 }}>Este código lo usará tu pareja para unirse. Elige algo memorable.</div>
            </div>
            {error && <div style={{ fontSize:13, color:"#fb923c", marginBottom:12, background:"rgba(251,146,60,0.1)", border:"1px solid rgba(251,146,60,0.25)", borderRadius:8, padding:"8px 12px" }}>{error}</div>}
            <button onClick={handleCreate} disabled={loading || !name.trim() || !code.trim()} style={btnStyle}>
              {loading ? "Creando..." : "🚀 Crear pareja"}
            </button>
          </div>
        )}

        {step === "join" && (
          <div>
            <button onClick={() => { setStep("choice"); setError(null); }} style={backBtn}>← Volver</button>
            <div style={{ fontSize:14, color:"var(--t-text-muted,#8b7fa8)", marginBottom:20 }}>
              Tu pareja ya creó el espacio. Introduce el código que te compartió.
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:6 }}>Tu nombre</div>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej: Ana, Carlos…" style={inputStyle} />
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:6 }}>Código de pareja</div>
              <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="Ej: FRAN-ANA" maxLength={20} style={{ ...inputStyle, letterSpacing:2, textTransform:"uppercase" }} />
            </div>
            {error && <div style={{ fontSize:13, color:"#fb923c", marginBottom:12, background:"rgba(251,146,60,0.1)", border:"1px solid rgba(251,146,60,0.25)", borderRadius:8, padding:"8px 12px" }}>{error}</div>}
            <button onClick={handleJoin} disabled={loading || !name.trim() || !code.trim()} style={btnStyle}>
              {loading ? "Uniéndome..." : "🔗 Unirme a la pareja"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
