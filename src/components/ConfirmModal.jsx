import { useState, useCallback } from "react";

export function useConfirm() {
  const [state, setState] = useState(null); // { msg, onYes, danger }

  const confirm = useCallback((msg, onYes, { danger = true, confirmLabel = "Confirmar", cancelLabel = "Cancelar" } = {}) => {
    setState({ msg, onYes, danger, confirmLabel, cancelLabel });
  }, []);

  const resolve = (yes) => {
    if (yes) state?.onYes?.();
    setState(null);
  };

  const ConfirmDialog = () => state ? (
    <>
      <div onClick={() => resolve(false)}
        style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:900, backdropFilter:"blur(4px)" }} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-msg"
        style={{ position:"fixed", left:"50%", top:"50%", transform:"translate(-50%,-50%)", zIndex:901,
          background:"var(--t-card,#1d1733)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.25))",
          borderRadius:18, padding:"24px 22px", width:"min(320px, calc(100vw - 32px))",
          boxShadow:"0 24px 64px rgba(0,0,0,0.6)", animation:"confirm-in .18s cubic-bezier(.34,1.56,.64,1)" }}>
        <style>{`@keyframes confirm-in{from{opacity:0;transform:translate(-50%,-52%) scale(.95)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}`}</style>
        <p id="confirm-msg" style={{ margin:"0 0 20px", fontSize:14, lineHeight:1.55, color:"var(--t-text,#f8f4ff)", textAlign:"center", whiteSpace:"pre-line" }}>
          {state.msg}
        </p>
        <div style={{ display:"flex", gap:10 }}>
          <button autoFocus onClick={() => resolve(false)}
            style={{ flex:1, padding:"10px", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.06)", color:"var(--t-text-muted,#8b7fa8)", cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>
            {state.cancelLabel}
          </button>
          <button onClick={() => resolve(true)}
            style={{ flex:1, padding:"10px", borderRadius:10, border:"none",
              background: state.danger ? "linear-gradient(135deg,#f43f5e,#e11d48)" : "linear-gradient(135deg,#f472b6,#a78bfa)",
              color:"#fff", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600 }}>
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </>
  ) : null;

  return { confirm, ConfirmDialog };
}
