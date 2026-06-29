import { useState, useMemo } from "react";
import { S } from "../styles.js";
import { useConfirm } from "./ConfirmModal.jsx";

const uid = () => Math.random().toString(36).slice(2, 10);

const SUGGESTED_EMOJIS = ["🛒", "🛍️", "🛁", "💻", "👗", "💍", "📚", "🎁", "🔧", "🌿", "💄", "🏠", "🚗", "✈️", "📦"];

function CategoryForm({ initial = {}, onSave, onCancel }) {
  const [name, setName]   = useState(initial.name  || "");
  const [emoji, setEmoji] = useState(initial.emoji || "🛒");
  const [type, setType]   = useState(initial.type  || "recurring");
  const valid = name.trim().length > 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", gap:8 }}>
        <input value={emoji} onChange={e=>setEmoji(e.target.value)} maxLength={2}
          style={{ ...S.input, width:52, textAlign:"center", fontSize:22, padding:"6px 4px", flexShrink:0 }} />
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre (ej: Supermercado, Amazon…)"
          autoFocus style={{ ...S.input, flex:1 }} />
      </div>

      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {SUGGESTED_EMOJIS.map(em => (
          <button key={em} onClick={() => setEmoji(em)} type="button"
            style={{ background: emoji===em ? "var(--t-accent-soft,rgba(167,139,250,0.20))" : "rgba(128,128,128,0.06)",
              border: emoji===em ? "1px solid var(--t-accent,#a78bfa)" : "1px solid rgba(128,128,128,0.15)",
              borderRadius:8, fontSize:18, padding:"4px 8px", cursor:"pointer" }}>{em}</button>
        ))}
      </div>

      <div>
        <div style={{ fontSize:11, letterSpacing:1, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:700, marginBottom:8 }}>
          ¿Qué tipo de lista es?
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => setType("recurring")} type="button" style={{
            flex:1, padding:"12px 10px", borderRadius:10, cursor:"pointer", fontFamily:"inherit",
            background: type==="recurring" ? "var(--t-accent-soft,rgba(167,139,250,0.18))" : "rgba(128,128,128,0.06)",
            border: type==="recurring" ? "1px solid var(--t-accent,#a78bfa)" : "1px solid rgba(128,128,128,0.15)",
            color: type==="recurring" ? "var(--t-accent,#a78bfa)" : "var(--t-text-muted,#8b7fa8)",
            display:"flex", flexDirection:"column", alignItems:"flex-start", gap:4, textAlign:"left",
          }}>
            <div style={{ fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
              <span>🔁</span> Recurrente
            </div>
            <div style={{ fontSize:11, opacity:0.85, lineHeight:1.3 }}>Compra repetida (ej. la del super). Permite limpiar la lista.</div>
          </button>
          <button onClick={() => setType("oneoff")} type="button" style={{
            flex:1, padding:"12px 10px", borderRadius:10, cursor:"pointer", fontFamily:"inherit",
            background: type==="oneoff" ? "var(--t-accent-soft,rgba(167,139,250,0.18))" : "rgba(128,128,128,0.06)",
            border: type==="oneoff" ? "1px solid var(--t-accent,#a78bfa)" : "1px solid rgba(128,128,128,0.15)",
            color: type==="oneoff" ? "var(--t-accent,#a78bfa)" : "var(--t-text-muted,#8b7fa8)",
            display:"flex", flexDirection:"column", alignItems:"flex-start", gap:4, textAlign:"left",
          }}>
            <div style={{ fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
              <span>💫</span> Única
            </div>
            <div style={{ fontSize:11, opacity:0.85, lineHeight:1.3 }}>Wishlist ambiciosa (ej. cosas a ahorrar). Sin limpieza.</div>
          </button>
        </div>
      </div>

      <div style={{ display:"flex", gap:8, marginTop:4 }}>
        <button onClick={onCancel} style={{ ...S.btnSecondary, flex:1, padding:"10px" }}>Cancelar</button>
        <button
          onClick={() => valid && onSave({
            id: initial.id || uid(),
            name: name.trim(),
            emoji,
            type,
            items: initial.items || [],
            createdAt: initial.createdAt || Date.now(),
            lastCleanedAt: initial.lastCleanedAt || null,
          })}
          disabled={!valid}
          style={{ ...S.btnPrimary, flex:1, padding:"10px", opacity:valid?1:0.45, textAlign:"center" }}>
          Guardar
        </button>
      </div>
    </div>
  );
}

function CategoryCard({ cat, onOpen, onEdit, onDelete }) {
  const total = cat.items?.length || 0;
  const done  = cat.items?.filter(i => i.done).length || 0;
  const pending = total - done;
  const typeLabel = cat.type === "recurring" ? "🔁 Recurrente" : "💫 Única";
  return (
    <div style={{
      background:"var(--t-card,#1d1733)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.18))",
      borderRadius:14, padding:"12px 14px", display:"flex", alignItems:"center", gap:12,
    }}>
      <button onClick={onOpen} style={{
        background:"none", border:"none", padding:0, cursor:"pointer", display:"flex", alignItems:"center",
        gap:12, flex:1, minWidth:0, textAlign:"left", fontFamily:"inherit", color:"inherit",
      }}>
        <span style={{ fontSize:28, flexShrink:0 }}>{cat.emoji || "🛒"}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:15, fontWeight:600, color:"var(--t-text,#f0e8ff)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
            {cat.name}
          </div>
          <div style={{ fontSize:11, color:"var(--t-text-muted,#8b7fa8)", marginTop:3, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{
              background: cat.type==="recurring" ? "rgba(96,165,250,0.12)" : "rgba(232,121,249,0.12)",
              color: cat.type==="recurring" ? "#60a5fa" : "#e879f9",
              border: `1px solid ${cat.type==="recurring" ? "rgba(96,165,250,0.3)" : "rgba(232,121,249,0.3)"}`,
              borderRadius:99, padding:"1px 7px", fontSize:9.5, fontWeight:600, letterSpacing:0.3,
            }}>{typeLabel}</span>
            {total === 0 ? (
              <span style={{ color:"var(--t-text-dim,#6b5f88)" }}>Sin artículos</span>
            ) : (
              <span>{pending > 0 ? `${pending} pendiente${pending===1?"":"s"}` : `✓ Todo hecho`} · {total} total</span>
            )}
          </div>
        </div>
        <span aria-hidden="true" style={{ fontSize:18, color:"var(--t-text-dim,#6b5f88)", flexShrink:0 }}>›</span>
      </button>
      <div style={{ display:"flex", flexDirection:"column", gap:5, flexShrink:0 }}>
        <button onClick={onEdit}
          style={{ background:"rgba(128,128,128,0.08)", border:"1px solid rgba(128,128,128,0.15)", borderRadius:8, color:"var(--t-text-dim,#6b5f88)", fontSize:11, padding:"4px 8px", cursor:"pointer", fontFamily:"inherit" }}>
          ✏️
        </button>
        <button onClick={onDelete}
          style={{ background:"rgba(244,114,182,0.06)", border:"1px solid rgba(244,114,182,0.18)", borderRadius:8, color:"var(--t-error,#f87171)", fontSize:11, padding:"4px 8px", cursor:"pointer", fontFamily:"inherit" }}>
          🗑
        </button>
      </div>
    </div>
  );
}

function CategoryDetail({ cat, onBack, onUpdate, onDelete, pushToast }) {
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const { confirm, ConfirmDialog } = useConfirm();

  const addItem = () => {
    const t = newText.trim();
    if (!t) return;
    onUpdate({ ...cat, items: [...(cat.items||[]), { id: uid(), text: t, done: false, doneAt: null }] });
    setNewText("");
  };

  const toggleItem = (id) => {
    onUpdate({
      ...cat,
      items: (cat.items||[]).map(i => i.id===id ? { ...i, done: !i.done, doneAt: !i.done ? Date.now() : null } : i),
    });
  };

  const removeItem = (id) => {
    onUpdate({ ...cat, items: (cat.items||[]).filter(i => i.id !== id) });
  };

  const saveEdit = () => {
    const t = editingText.trim();
    if (!t || !editingId) { setEditingId(null); return; }
    onUpdate({
      ...cat,
      items: (cat.items||[]).map(i => i.id===editingId ? { ...i, text: t } : i),
    });
    setEditingId(null);
  };

  const cleanList = () => {
    const doneCount = (cat.items||[]).filter(i => i.done).length;
    if (doneCount === 0) {
      pushToast?.({ kind:"info", text:"No hay artículos marcados como hechos para limpiar." });
      return;
    }
    confirm(`Vas a desmarcar ${doneCount} artículo${doneCount===1?"":"s"} y dejar la lista lista para la próxima vez. ¿Continuar?`, () => {
      onUpdate({
        ...cat,
        items: (cat.items||[]).map(i => ({ ...i, done: false, doneAt: null })),
        lastCleanedAt: Date.now(),
      });
      pushToast?.({ kind:"success", text:`🔁 Lista limpia — recuerda hacer la próxima ${cat.name.toLowerCase()} cuando toque.` });
    }, { confirmLabel: "Sí, limpiar", cancelLabel: "Mejor no" });
  };

  const items = useMemo(() => {
    const arr = [...(cat.items||[])];
    arr.sort((a,b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return 0;
    });
    return arr;
  }, [cat.items]);

  const pendingCount = (cat.items||[]).filter(i => !i.done).length;
  const doneCount    = (cat.items||[]).filter(i =>  i.done).length;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14, paddingBottom:24 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={onBack} style={{ ...S.btnSecondary, padding:"6px 12px", fontSize:13, display:"flex", alignItems:"center", gap:4 }}>
          ‹ Volver
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"'Fraunces',Georgia,serif", fontSize:20, fontWeight:600, color:"var(--t-text,#f8f4ff)", display:"flex", alignItems:"center", gap:8, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
            <span>{cat.emoji || "🛒"}</span> {cat.name}
          </div>
          <div style={{ fontSize:11, color:"var(--t-text-muted,#8b7fa8)", marginTop:2 }}>
            {cat.type === "recurring" ? "🔁 Lista recurrente" : "💫 Lista única"}
            {pendingCount + doneCount > 0 && ` · ${pendingCount} pendiente${pendingCount===1?"":"s"} · ${doneCount} hecho${doneCount===1?"":"s"}`}
          </div>
        </div>
      </div>

      {/* Add item */}
      <div style={{ display:"flex", gap:8 }}>
        <input
          value={newText}
          onChange={e=>setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") addItem(); }}
          placeholder="Añadir artículo…"
          style={{ ...S.input, flex:1 }}
        />
        <button onClick={addItem} disabled={!newText.trim()}
          style={{ ...S.btnPrimary, padding:"8px 16px", fontSize:18, fontWeight:700, opacity:newText.trim()?1:0.45 }}>
          +
        </button>
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <div style={{ textAlign:"center", padding:"36px 20px" }}>
          <div style={{ fontSize:36, marginBottom:10 }}>{cat.emoji || "🛒"}</div>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:4, color:"var(--t-text-muted,#8b7fa8)" }}>Sin artículos todavía</div>
          <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)" }}>Añade el primero usando el campo de arriba.</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {items.map(it => (
            <div key={it.id} style={{
              background: it.done ? "rgba(52,211,153,0.06)" : "var(--t-card,#1d1733)",
              border: it.done ? "1px solid rgba(52,211,153,0.25)" : "1px solid var(--t-card-border,rgba(167,139,250,0.15))",
              borderRadius:10, padding:"8px 10px", display:"flex", alignItems:"center", gap:10,
            }}>
              <button
                onClick={() => toggleItem(it.id)}
                aria-label={it.done ? "Desmarcar" : "Marcar como hecho"}
                style={{
                  width:24, height:24, borderRadius:6, flexShrink:0, cursor:"pointer", padding:0,
                  background: it.done ? "#34d399" : "transparent",
                  border: it.done ? "1px solid #34d399" : "1.5px solid var(--t-text-dim,#6b5f88)",
                  color:"#fff", fontSize:14, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center",
                  fontFamily:"inherit",
                }}>
                {it.done ? "✓" : ""}
              </button>

              {editingId === it.id ? (
                <>
                  <input
                    value={editingText}
                    onChange={e => setEditingText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
                    onBlur={saveEdit}
                    autoFocus
                    style={{ ...S.inputSm, flex:1 }}
                  />
                </>
              ) : (
                <button
                  onClick={() => { setEditingId(it.id); setEditingText(it.text); }}
                  style={{
                    flex:1, minWidth:0, background:"none", border:"none", cursor:"text", padding:0,
                    fontFamily:"inherit", textAlign:"left",
                    fontSize:14,
                    color: it.done ? "var(--t-text-dim,#6b5f88)" : "var(--t-text,#f0e8ff)",
                    textDecoration: it.done ? "line-through" : "none",
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                  }}>
                  {it.text}
                </button>
              )}

              <button onClick={() => removeItem(it.id)} aria-label="Eliminar"
                style={{ background:"none", border:"none", color:"var(--t-text-dim,#6b5f88)", fontSize:16, padding:"2px 6px", cursor:"pointer", flexShrink:0 }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer actions */}
      <div style={{ display:"flex", gap:8, marginTop:6, flexWrap:"wrap" }}>
        {cat.type === "recurring" && (cat.items||[]).length > 0 && (
          <button onClick={cleanList}
            style={{ ...S.btnSecondary, padding:"8px 14px", fontSize:12, display:"flex", alignItems:"center", gap:6,
              background:"rgba(96,165,250,0.08)", border:"1px solid rgba(96,165,250,0.25)", color:"#60a5fa" }}>
            🔁 Limpiar lista
          </button>
        )}
        <button onClick={() => {
          confirm(`Vas a eliminar la lista "${cat.name}" con todos sus artículos. Esta acción no se puede deshacer.`, () => {
            onDelete(cat.id);
            onBack();
          }, { confirmLabel: "Sí, eliminar", cancelLabel: "Mejor no" });
        }}
          style={{ ...S.btnSecondary, padding:"8px 14px", fontSize:12, marginLeft:"auto",
            background:"rgba(244,114,182,0.06)", border:"1px solid rgba(244,114,182,0.18)", color:"var(--t-error,#f87171)" }}>
          🗑 Eliminar lista
        </button>
      </div>

      {cat.type === "recurring" && cat.lastCleanedAt && (
        <div style={{ fontSize:10.5, color:"var(--t-text-dim,#6b5f88)", textAlign:"center", marginTop:2 }}>
          Última limpieza: {new Date(cat.lastCleanedAt).toLocaleDateString("es-ES", { day:"numeric", month:"short", year:"numeric" })}
        </div>
      )}

      <ConfirmDialog />
    </div>
  );
}

export default function WishlistView({ wishlist = [], onSave, pushToast }) {
  const [form, setForm] = useState(null);
  const [openId, setOpenId] = useState(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const save = (cat) => {
    onSave(prev => prev.find(c => c.id === cat.id)
      ? prev.map(c => c.id === cat.id ? cat : c)
      : [...prev, cat]);
    setForm(null);
  };

  const updateCat = (cat) => {
    onSave(prev => prev.map(c => c.id === cat.id ? cat : c));
  };

  const deleteCat = (id) => {
    onSave(prev => prev.filter(c => c.id !== id));
  };

  const del = (id) => {
    const cat = wishlist.find(c => c.id === id);
    if (!cat) return;
    confirm(`Vas a eliminar la lista "${cat.name}" con todos sus artículos. Esta acción no se puede deshacer.`, () => {
      deleteCat(id);
    }, { confirmLabel: "Sí, eliminar", cancelLabel: "Mejor no" });
  };

  const openCat = openId ? wishlist.find(c => c.id === openId) : null;

  if (openCat) {
    return (
      <CategoryDetail
        cat={openCat}
        onBack={() => setOpenId(null)}
        onUpdate={updateCat}
        onDelete={deleteCat}
        pushToast={pushToast}
      />
    );
  }

  const recurring = wishlist.filter(c => c.type === "recurring");
  const oneoff    = wishlist.filter(c => c.type !== "recurring");

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, paddingBottom:24 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontFamily:"'Fraunces',Georgia,serif", fontSize:22, fontWeight:600, color:"var(--t-text,#f8f4ff)" }}>🛍️ Lista de compras</div>
          <div style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)", marginTop:2 }}>Categorías recurrentes y wishlists únicas</div>
        </div>
        <button onClick={() => setForm({})} style={{ ...S.btnPrimary, padding:"8px 14px", fontSize:12, display:"flex", alignItems:"center", gap:4 }}>
          <span style={{ fontSize:16, lineHeight:1 }}>+</span> Categoría
        </button>
      </div>

      {form !== null && (
        <div style={{ background:"var(--t-card,#1d1733)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.25))", borderRadius:14, padding:"16px 14px" }}>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--t-text,#f8f4ff)", marginBottom:12 }}>
            {form.id ? "Editar categoría" : "Nueva categoría"}
          </div>
          <CategoryForm initial={form} onSave={save} onCancel={() => setForm(null)} />
        </div>
      )}

      {wishlist.length === 0 && form === null && (
        <div style={{ textAlign:"center", padding:"48px 20px" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🛍️</div>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:4, color:"var(--t-text-muted,#8b7fa8)" }}>Sin listas todavía</div>
          <div style={{ fontSize:12, color:"var(--t-text-dim,#6b5f88)", maxWidth:280, margin:"0 auto", lineHeight:1.4 }}>
            Crea categorías como <i>Supermercado</i>, <i>Amazon</i>, <i>Shein</i>… o una wishlist de cosas para ahorrar.
          </div>
        </div>
      )}

      {recurring.length > 0 && (
        <div>
          <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:700, marginBottom:8 }}>
            🔁 Recurrentes
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {recurring.map(c => (
              <CategoryCard key={c.id} cat={c}
                onOpen={() => setOpenId(c.id)}
                onEdit={() => setForm(c)}
                onDelete={() => del(c.id)} />
            ))}
          </div>
        </div>
      )}

      {oneoff.length > 0 && (
        <div>
          <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:700, marginBottom:8 }}>
            💫 Únicas
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {oneoff.map(c => (
              <CategoryCard key={c.id} cat={c}
                onOpen={() => setOpenId(c.id)}
                onEdit={() => setForm(c)}
                onDelete={() => del(c.id)} />
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog />
    </div>
  );
}
