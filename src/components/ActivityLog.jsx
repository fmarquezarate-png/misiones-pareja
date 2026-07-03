import { relTime } from "../utils.js";
import { DEFAULT_COLORS } from "../constants.js";

// Historial de actividad: quién añadió, movió, completó o eliminó cada
// actividad. Da contexto a los cambios que llegan por realtime — sin esto
// las cosas "aparecen y desaparecen mágicamente" en la agenda del otro.
export default function ActivityLog({ activity = [], p1, p2, colors, onClose }) {
  const clr = colors || DEFAULT_COLORS;
  const name  = w => w === "person1" ? p1 : w === "person2" ? p2 : "Alguien";
  const color = w => w === "person1" ? clr.person1 : w === "person2" ? clr.person2 : "var(--t-text-muted,#8b7fa8)";

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:180, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background:"var(--t-menu-bg,#0f0a1e)", borderTop:"1px solid var(--t-card-border,rgba(167,139,250,0.15))", borderRadius:"20px 20px 0 0", width:"100%", maxWidth:640, maxHeight:"80vh", display:"flex", flexDirection:"column", padding:"20px 18px calc(16px + env(safe-area-inset-bottom))" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexShrink:0 }}>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, color:"var(--t-text,#f8f4ff)" }}>🕓 Actividad reciente</div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background:"rgba(255,255,255,0.06)", border:"none", borderRadius:8, color:"var(--t-text-muted,#8b7fa8)", fontSize:18, cursor:"pointer", padding:"4px 9px", lineHeight:1 }}>×</button>
        </div>

        <div style={{ overflowY:"auto", flex:1, minHeight:0 }}>
          {activity.length === 0 ? (
            <div style={{ textAlign:"center", padding:"36px 20px", color:"var(--t-text-muted,#8b7fa8)", fontSize:13, lineHeight:1.7 }}>
              <div style={{ fontSize:36, marginBottom:10 }}>🕓</div>
              Aquí aparecerá quién añadió, movió,<br />completó o eliminó cada actividad.
            </div>
          ) : (
            activity.map(a => (
              <div key={a.id} style={{ display:"flex", gap:10, padding:"9px 2px", borderBottom:"1px solid rgba(255,255,255,0.04)", alignItems:"flex-start" }}>
                <span style={{ width:8, height:8, borderRadius:99, background:color(a.w), flexShrink:0, marginTop:5 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, color:"var(--t-text,#f0e8ff)", lineHeight:1.5 }}>
                    <strong style={{ color:color(a.w) }}>{name(a.w)}</strong> {a.text}
                  </div>
                  <div style={{ fontSize:10.5, color:"var(--t-text-dim,#4a4166)", marginTop:2 }}>{relTime(a.ts)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
