import { useState } from "react";
import { S, eyebrow, T } from "../styles.js";

const uid = () => Math.random().toString(36).slice(2, 10);

function LinkForm({ initial = {}, onSave, onCancel }) {
  const [name,  setName]  = useState(initial.name  || "");
  const [emoji, setEmoji] = useState(initial.emoji || "🔗");
  const [url,   setUrl]   = useState(initial.url   || "");
  const [user,  setUser]  = useState(initial.user  || "");
  const [pass,  setPass]  = useState(initial.pass  || "");
  const [showPass, setShowPass] = useState(false);
  const [tab,   setTab]   = useState("link"); // "link" | "account"

  const valid = name.trim() && (tab === "link" ? url.trim() : (user.trim() || pass.trim()));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* Tabs */}
      <div style={{ display:"flex", gap:4, background:"rgba(255,255,255,0.04)", borderRadius:10, padding:3 }}>
        {[["link","🔗 Link"],["account","👤 Cuenta"]].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)} style={{
            flex:1, padding:"7px 0", borderRadius:8, border:"none", cursor:"pointer",
            background: tab===v ? "var(--t-accent-soft,rgba(167,139,250,0.18))" : "transparent",
            color: tab===v ? "var(--t-accent,#a78bfa)" : "var(--t-text-muted,#8b7fa8)",
            fontSize:12, fontWeight:tab===v?600:400, fontFamily:"inherit",
          }}>{l}</button>
        ))}
      </div>

      {/* Emoji + Name row */}
      <div style={{ display:"flex", gap:8 }}>
        <input value={emoji} onChange={e=>setEmoji(e.target.value)} maxLength={2}
          style={{ ...S.input, width:52, textAlign:"center", fontSize:22, padding:"6px 4px", flexShrink:0 }}/>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre (ej: Netflix, Trabajo…)"
          style={{ ...S.input, flex:1 }}/>
      </div>

      {tab === "link" && (
        <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…"
          type="url" style={S.input}/>
      )}

      {/* Optional credentials — always shown in account tab, optional in link */}
      {tab === "account" && (
        <>
          <input value={user} onChange={e=>setUser(e.target.value)} placeholder="Usuario / Email"
            autoComplete="off" style={S.input}/>
          <div style={{ display:"flex", gap:6 }}>
            <input value={pass} onChange={e=>setPass(e.target.value)}
              type={showPass ? "text" : "password"}
              placeholder="Contraseña (opcional)"
              autoComplete="new-password" style={{ ...S.input, flex:1 }}/>
            <button onClick={() => setShowPass(v=>!v)} style={{ ...S.btnSecondary, padding:"8px 12px", flexShrink:0, fontSize:13 }}>
              {showPass ? "🙈" : "👁"}
            </button>
          </div>
        </>
      )}

      {tab === "link" && (user || pass || initial.user || initial.pass) && (
        <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:8, padding:"10px 12px" }}>
          <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>Credenciales (opcional)</div>
          <input value={user} onChange={e=>setUser(e.target.value)} placeholder="Usuario / Email"
            autoComplete="off" style={{ ...S.inputSm, marginBottom:6 }}/>
          <div style={{ display:"flex", gap:6 }}>
            <input value={pass} onChange={e=>setPass(e.target.value)}
              type={showPass ? "text" : "password"}
              placeholder="Contraseña"
              autoComplete="new-password" style={{ ...S.inputSm, flex:1 }}/>
            <button onClick={() => setShowPass(v=>!v)} style={{ ...S.btnSecondary, padding:"5px 10px", flexShrink:0, fontSize:12 }}>
              {showPass ? "🙈" : "👁"}
            </button>
          </div>
        </div>
      )}
      {tab === "link" && !user && !pass && !initial.user && !initial.pass && (
        <button onClick={() => setUser(" ")} style={{ ...S.btnSecondary, fontSize:11, padding:"6px 12px", alignSelf:"flex-start", color:"var(--t-text-dim,#4a4166)" }}>
          + Añadir credenciales
        </button>
      )}

      <div style={{ display:"flex", gap:8, marginTop:4 }}>
        <button onClick={onCancel} style={{ ...S.btnSecondary, flex:1, padding:"10px" }}>Cancelar</button>
        <button
          onClick={() => valid && onSave({ id: initial.id || uid(), name:name.trim(), emoji, url:url.trim(), user:user.trim(), pass, type:tab })}
          disabled={!valid}
          style={{ ...S.btnPrimary, flex:1, padding:"10px", opacity:valid?1:0.45, textAlign:"center" }}
        >Guardar</button>
      </div>
    </div>
  );
}

function LinkCard({ link, onOpen, onEdit, onDelete, showCreds, onToggleCreds }) {
  const [copied, setCopied] = useState(null);
  const copy = (text, label) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1800);
    });
  };

  return (
    <div style={{
      background:"var(--t-card,#1d1733)",
      border:"1px solid var(--t-card-border,rgba(167,139,250,0.18))",
      borderRadius:12, overflow:"hidden",
    }}>
      {/* Main row */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 12px" }}>
        <span style={{ fontSize:22, flexShrink:0 }}>{link.emoji || "🔗"}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--t-text,#f0e8ff)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {link.name}
          </div>
          {link.url && (
            <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:1 }}>
              {link.url}
            </div>
          )}
          {!link.url && link.type === "account" && (
            <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", marginTop:1 }}>Cuenta guardada</div>
          )}
        </div>
        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
          {link.url && (
            <button onClick={onOpen}
              style={{ background:"var(--t-accent-soft,rgba(167,139,250,0.15))", border:"1px solid var(--t-accent,rgba(167,139,250,0.35))", borderRadius:8, color:"var(--t-accent,#a78bfa)", fontSize:11, fontWeight:600, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit" }}>
              Abrir
            </button>
          )}
          {(link.user || link.pass) && (
            <button onClick={onToggleCreds}
              style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"var(--t-text-muted,#8b7fa8)", fontSize:11, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit" }}>
              {showCreds ? "🙈" : "👁"}
            </button>
          )}
          <button onClick={onEdit}
            style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:"var(--t-text-dim,#6b5f88)", fontSize:11, padding:"5px 8px", cursor:"pointer", fontFamily:"inherit" }}>
            ✏️
          </button>
        </div>
      </div>

      {/* Credentials reveal */}
      {showCreds && (link.user || link.pass) && (
        <div style={{ borderTop:"1px solid var(--t-card-border,rgba(255,255,255,0.06))", padding:"10px 12px", background:"rgba(255,255,255,0.02)", display:"flex", flexDirection:"column", gap:6 }}>
          {link.user && (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", width:60, flexShrink:0 }}>Usuario</span>
              <span style={{ flex:1, fontSize:12, color:"var(--t-text,#f0e8ff)", overflow:"hidden", textOverflow:"ellipsis" }}>{link.user}</span>
              <button onClick={() => copy(link.user, "user")} style={{ background:"none", border:"none", fontSize:12, color:"var(--t-accent,#a78bfa)", cursor:"pointer", padding:"2px 6px" }}>
                {copied==="user" ? "✓" : "📋"}
              </button>
            </div>
          )}
          {link.pass && (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", width:60, flexShrink:0 }}>Contraseña</span>
              <span style={{ flex:1, fontSize:12, color:"var(--t-text,#f0e8ff)", fontFamily:"monospace", letterSpacing:1 }}>{"•".repeat(Math.min(link.pass.length, 10))}</span>
              <button onClick={() => copy(link.pass, "pass")} style={{ background:"none", border:"none", fontSize:12, color:"var(--t-accent,#a78bfa)", cursor:"pointer", padding:"2px 6px" }}>
                {copied==="pass" ? "✓" : "📋"}
              </button>
            </div>
          )}
          <button onClick={onDelete} style={{ alignSelf:"flex-start", background:"none", border:"none", fontSize:11, color:"#f87171", cursor:"pointer", padding:"2px 0", fontFamily:"inherit", marginTop:2 }}>
            🗑 Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

export default function LinksView({ links = [], onSave }) {
  const [form,    setForm]    = useState(null); // null | {} | {editing link}
  const [credsFor, setCredsFor] = useState(null);

  const save = (link) => {
    const exists = links.find(l => l.id === link.id);
    const next = exists ? links.map(l => l.id===link.id ? link : l) : [...links, link];
    onSave(next);
    setForm(null);
  };
  const del = (id) => {
    if (window.confirm("¿Eliminar este enlace?")) {
      onSave(links.filter(l => l.id !== id));
      setCredsFor(null);
    }
  };
  const open = (url) => { window.open(url, "_blank", "noopener,noreferrer"); };

  const grouped = {
    link: links.filter(l => l.type !== "account"),
    account: links.filter(l => l.type === "account"),
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, paddingBottom:24 }}>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:600, color:"var(--t-text,#f8f4ff)" }}>🔗 Base de control</div>
          <div style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)", marginTop:2 }}>Links y cuentas de uso frecuente</div>
        </div>
        <button onClick={() => setForm({})} style={{ ...S.btnPrimary, padding:"8px 14px", fontSize:12 }}>+ Añadir</button>
      </div>

      {/* Add / Edit form */}
      {form !== null && (
        <div style={{ background:"var(--t-card,#1d1733)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.25))", borderRadius:14, padding:"16px 14px" }}>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--t-text,#f8f4ff)", marginBottom:12 }}>
            {form.id ? "Editar enlace" : "Nuevo enlace"}
          </div>
          <LinkForm initial={form} onSave={save} onCancel={() => setForm(null)} />
        </div>
      )}

      {links.length === 0 && form === null && (
        <div style={{ textAlign:"center", padding:"48px 20px", color:"var(--t-text-dim,#6b5f88)" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🔗</div>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:4, color:"var(--t-text-muted,#8b7fa8)" }}>Sin enlaces todavía</div>
          <div style={{ fontSize:12 }}>Añade links de uso diario o cuentas importantes</div>
        </div>
      )}

      {/* Links section */}
      {grouped.link.length > 0 && (
        <div>
          <div style={{ ...eyebrow, fontSize:9, marginBottom:8 }}>🔗 Links</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {grouped.link.map(l => (
              <LinkCard key={l.id} link={l}
                onOpen={() => open(l.url)}
                onEdit={() => setForm(l)}
                onDelete={() => del(l.id)}
                showCreds={credsFor === l.id}
                onToggleCreds={() => setCredsFor(v => v === l.id ? null : l.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Accounts section */}
      {grouped.account.length > 0 && (
        <div>
          <div style={{ ...eyebrow, fontSize:9, marginBottom:8 }}>👤 Cuentas</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {grouped.account.map(l => (
              <LinkCard key={l.id} link={l}
                onOpen={l.url ? () => open(l.url) : null}
                onEdit={() => setForm(l)}
                onDelete={() => del(l.id)}
                showCreds={credsFor === l.id}
                onToggleCreds={() => setCredsFor(v => v === l.id ? null : l.id)}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
