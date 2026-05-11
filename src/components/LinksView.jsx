import { useState } from "react";
import { S } from "../styles.js";
import { useConfirm } from "./ConfirmModal.jsx";

const uid = () => Math.random().toString(36).slice(2, 10);

const EYEBROW = { fontSize:9, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:700, marginBottom:8, display:"block" };
const CARD = { background:"var(--t-card,#1d1733)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.18))", borderRadius:12, overflow:"hidden" };
const ROW_BG = { background:"rgba(128,128,128,0.07)", border:"1px solid rgba(128,128,128,0.14)" };

function LinkForm({ initial = {}, allFolders = [], onSave, onCancel }) {
  const [name,   setName]   = useState(initial.name   || "");
  const [emoji,  setEmoji]  = useState(initial.emoji  || "🔗");
  const [url,    setUrl]    = useState(initial.url    || "");
  const [user,   setUser]   = useState(initial.user   || "");
  const [pass,   setPass]   = useState(initial.pass   || "");
  const [folder, setFolder] = useState(initial.folder || "");
  const [showPass, setShowPass] = useState(false);
  const [showCreds, setShowCreds] = useState(!!(initial.user || initial.pass));
  const [tab,    setTab]    = useState(initial.type === "account" ? "account" : "link");

  const valid = name.trim() && (tab === "link" ? url.trim() : (user.trim() || pass.trim()));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* Tabs */}
      <div style={{ display:"flex", gap:4, background:"rgba(128,128,128,0.08)", borderRadius:10, padding:3 }}>
        {[["link","🔗 Link"],["account","👤 Cuenta"]].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)} style={{
            flex:1, padding:"7px 0", borderRadius:8, border:"none", cursor:"pointer",
            background: tab===v ? "var(--t-accent-soft,rgba(167,139,250,0.18))" : "transparent",
            color: tab===v ? "var(--t-accent,#a78bfa)" : "var(--t-text-muted,#8b7fa8)",
            fontSize:12, fontWeight:tab===v?600:400, fontFamily:"inherit",
          }}>{l}</button>
        ))}
      </div>

      {/* Emoji + Name */}
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

      {/* Folder */}
      <div style={{ position:"relative" }}>
        <input value={folder} onChange={e=>setFolder(e.target.value)} placeholder="📁 Carpeta (opcional)"
          list="lv-folders" autoComplete="off" style={{ ...S.input, paddingLeft:10 }}/>
        {allFolders.length > 0 && (
          <datalist id="lv-folders">
            {allFolders.map(f => <option key={f} value={f} />)}
          </datalist>
        )}
      </div>

      {/* Credentials */}
      {tab === "account" ? (
        <>
          <input value={user} onChange={e=>setUser(e.target.value)} placeholder="Usuario / Email"
            autoComplete="off" style={S.input}/>
          <div style={{ display:"flex", gap:6 }}>
            <input value={pass} onChange={e=>setPass(e.target.value)}
              type={showPass ? "text" : "password"} placeholder="Contraseña (opcional)"
              autoComplete="new-password" style={{ ...S.input, flex:1 }}/>
            <button onClick={() => setShowPass(v=>!v)} style={{ ...S.btnSecondary, padding:"8px 12px", flexShrink:0, fontSize:14 }}>
              {showPass ? "🙈" : "👁"}
            </button>
          </div>
        </>
      ) : showCreds ? (
        <div style={{ background:"rgba(128,128,128,0.06)", borderRadius:8, padding:"10px 12px" }}>
          <span style={EYEBROW}>Credenciales (opcional)</span>
          <input value={user} onChange={e=>setUser(e.target.value)} placeholder="Usuario / Email"
            autoComplete="off" style={{ ...S.inputSm, marginBottom:6 }}/>
          <div style={{ display:"flex", gap:6 }}>
            <input value={pass} onChange={e=>setPass(e.target.value)}
              type={showPass ? "text" : "password"} placeholder="Contraseña"
              autoComplete="new-password" style={{ ...S.inputSm, flex:1 }}/>
            <button onClick={() => setShowPass(v=>!v)} style={{ ...S.btnSecondary, padding:"5px 10px", flexShrink:0, fontSize:13 }}>
              {showPass ? "🙈" : "👁"}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowCreds(true)} style={{ ...S.btnSecondary, fontSize:11, padding:"6px 12px", alignSelf:"flex-start" }}>
          + Añadir usuario/contraseña
        </button>
      )}

      <div style={{ display:"flex", gap:8, marginTop:4 }}>
        <button onClick={onCancel} style={{ ...S.btnSecondary, flex:1, padding:"10px" }}>Cancelar</button>
        <button onClick={() => valid && onSave({ id:initial.id||uid(), name:name.trim(), emoji, url:url.trim(), user:user.trim(), pass, type:tab, folder:folder.trim() })}
          disabled={!valid}
          style={{ ...S.btnPrimary, flex:1, padding:"10px", opacity:valid?1:0.45, textAlign:"center" }}>Guardar</button>
      </div>
    </div>
  );
}

function LinkCard({ link, onEdit, onDelete, showCreds, onToggleCreds }) {
  const [copied, setCopied] = useState(null);
  const copy = (text, label) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(label); setTimeout(()=>setCopied(null),1800); });
  };
  const aStyle = {
    background:"var(--t-accent-soft,rgba(167,139,250,0.15))",
    border:"1px solid var(--t-accent,rgba(167,139,250,0.35))",
    borderRadius:8, color:"var(--t-accent,#a78bfa)",
    fontSize:11, fontWeight:600, padding:"5px 10px",
    cursor:"pointer", fontFamily:"inherit",
    textDecoration:"none", display:"inline-flex", alignItems:"center",
  };

  return (
    <div style={CARD}>
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
          {!link.url && link.type==="account" && (
            <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", marginTop:1 }}>Cuenta guardada</div>
          )}
          {link.folder && (
            <div style={{ fontSize:9, color:"var(--t-accent,#a78bfa)", marginTop:2, display:"inline-flex", alignItems:"center", gap:3 }}>
              <span>📁</span>{link.folder}
            </div>
          )}
        </div>
        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
          {/* Use <a> tag — reliable on iOS PWA, avoids window.open blocking */}
          {link.url && (
            <a href={link.url} target="_blank" rel="noopener noreferrer" style={aStyle}>Abrir</a>
          )}
          {(link.user || link.pass) && (
            <button onClick={onToggleCreds}
              style={{ background:"rgba(128,128,128,0.1)", border:"1px solid rgba(128,128,128,0.2)", borderRadius:8, color:"var(--t-text-muted,#8b7fa8)", fontSize:11, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit" }}>
              {showCreds ? "🙈" : "👁"}
            </button>
          )}
          <button onClick={onEdit}
            style={{ background:"rgba(128,128,128,0.08)", border:"1px solid rgba(128,128,128,0.15)", borderRadius:8, color:"var(--t-text-dim,#6b5f88)", fontSize:11, padding:"5px 8px", cursor:"pointer", fontFamily:"inherit" }}>
            ✏️
          </button>
          <button onClick={onDelete}
            style={{ background:"rgba(244,114,182,0.06)", border:"1px solid rgba(244,114,182,0.18)", borderRadius:8, color:"var(--t-error,#f87171)", fontSize:11, padding:"5px 8px", cursor:"pointer", fontFamily:"inherit" }}>
            🗑
          </button>
        </div>
      </div>

      {showCreds && (link.user || link.pass) && (
        <div style={{ borderTop:"1px solid var(--t-card-border,rgba(128,128,128,0.12))", padding:"10px 12px", background:"rgba(128,128,128,0.04)", display:"flex", flexDirection:"column", gap:6 }}>
          {link.user && (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", width:72, flexShrink:0 }}>Usuario</span>
              <span style={{ flex:1, fontSize:12, color:"var(--t-text,#f0e8ff)", overflow:"hidden", textOverflow:"ellipsis" }}>{link.user}</span>
              <button onClick={() => copy(link.user,"user")} style={{ background:"none", border:"none", fontSize:12, color:"var(--t-accent,#a78bfa)", cursor:"pointer", padding:"2px 6px" }}>
                {copied==="user" ? "✓" : "📋"}
              </button>
            </div>
          )}
          {link.pass && (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", width:72, flexShrink:0 }}>Contraseña</span>
              <span style={{ flex:1, fontSize:12, color:"var(--t-text,#f0e8ff)", fontFamily:"monospace", letterSpacing:2 }}>{"•".repeat(Math.min(link.pass.length,10))}</span>
              <button onClick={() => copy(link.pass,"pass")} style={{ background:"none", border:"none", fontSize:12, color:"var(--t-accent,#a78bfa)", cursor:"pointer", padding:"2px 6px" }}>
                {copied==="pass" ? "✓" : "📋"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LinksView({ links = [], onSave }) {
  const [form,     setForm]     = useState(null);
  const [credsFor, setCredsFor] = useState(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const save = (link) => {
    const next = links.find(l=>l.id===link.id)
      ? links.map(l => l.id===link.id ? link : l)
      : [...links, link];
    onSave(next);
    setForm(null);
  };
  const del = (id) => {
    confirm("¿Eliminar este enlace?", () => { onSave(links.filter(l=>l.id!==id)); setCredsFor(null); });
  };

  const grouped = {
    link: links.filter(l => l.type !== "account"),
    account: links.filter(l => l.type === "account"),
  };

  // Collect all distinct folder names for datalist suggestions
  const allFolders = [...new Set(links.map(l => l.folder).filter(Boolean))];

  // Group an array of links by folder; unfoldered items go under key ""
  const byFolder = (arr) => {
    const map = {};
    arr.forEach(l => {
      const k = l.folder || "";
      if (!map[k]) map[k] = [];
      map[k].push(l);
    });
    // Sort: folders first (alphabetical), then unfoldered
    return Object.entries(map).sort(([a],[b]) => {
      if (!a) return 1; if (!b) return -1;
      return a.localeCompare(b);
    });
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, paddingBottom:24 }}>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontFamily:"'Fraunces',Georgia,serif", fontSize:22, fontWeight:600, color:"var(--t-text,#f8f4ff)" }}>🔗 Base de control</div>
          <div style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)", marginTop:2 }}>Links y cuentas de uso frecuente</div>
        </div>
        <button onClick={() => setForm({})} style={{ ...S.btnPrimary, padding:"8px 14px", fontSize:12 }}>+ Añadir</button>
      </div>

      {form !== null && (
        <div style={{ background:"var(--t-card,#1d1733)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.25))", borderRadius:14, padding:"16px 14px" }}>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--t-text,#f8f4ff)", marginBottom:12 }}>
            {form.id ? "Editar enlace" : "Nuevo enlace"}
          </div>
          <LinkForm initial={form} allFolders={allFolders} onSave={save} onCancel={() => setForm(null)} />
        </div>
      )}

      {links.length === 0 && form === null && (
        <div style={{ textAlign:"center", padding:"48px 20px" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🔗</div>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:4, color:"var(--t-text-muted,#8b7fa8)" }}>Sin enlaces todavía</div>
          <div style={{ fontSize:12, color:"var(--t-text-dim,#6b5f88)" }}>Añade links de uso diario o cuentas importantes</div>
        </div>
      )}

      {grouped.link.length > 0 && (
        <div>
          <span style={EYEBROW}>🔗 Links</span>
          {byFolder(grouped.link).map(([folder, items]) => (
            <div key={folder||"__none"} style={{ marginBottom: folder ? 10 : 0 }}>
              {folder && (
                <div style={{ fontSize:10, fontWeight:600, color:"var(--t-accent,#a78bfa)", letterSpacing:1, textTransform:"uppercase", marginBottom:5, display:"flex", alignItems:"center", gap:4 }}>
                  <span>📁</span>{folder}
                </div>
              )}
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {items.map(l => (
                  <LinkCard key={l.id} link={l} onEdit={()=>setForm(l)} onDelete={()=>del(l.id)}
                    showCreds={credsFor===l.id} onToggleCreds={()=>setCredsFor(v=>v===l.id?null:l.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {grouped.account.length > 0 && (
        <div>
          <span style={EYEBROW}>👤 Cuentas</span>
          {byFolder(grouped.account).map(([folder, items]) => (
            <div key={folder||"__none"} style={{ marginBottom: folder ? 10 : 0 }}>
              {folder && (
                <div style={{ fontSize:10, fontWeight:600, color:"var(--t-accent,#a78bfa)", letterSpacing:1, textTransform:"uppercase", marginBottom:5, display:"flex", alignItems:"center", gap:4 }}>
                  <span>📁</span>{folder}
                </div>
              )}
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {items.map(l => (
                  <LinkCard key={l.id} link={l} onEdit={()=>setForm(l)} onDelete={()=>del(l.id)}
                    showCreds={credsFor===l.id} onToggleCreds={()=>setCredsFor(v=>v===l.id?null:l.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}
