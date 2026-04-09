import { useState } from "react";
import { EMOJI_GROUPS } from "../constants.js";

export default function EmojiSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [ag, setAg] = useState(0);
  return (
    <div style={{ position:"relative", flexShrink:0 }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ fontSize:22, background:"none", border:"none", cursor:"pointer", padding:"0 2px", lineHeight:1 }}>{value}</button>
      {open && <>
        <div onClick={()=>setOpen(false)} style={{ position:"fixed", inset:0, zIndex:9 }} />
        <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:10, background:"#1a1330", border:"1px solid rgba(167,139,250,0.25)", borderRadius:14, width:260, boxShadow:"0 12px 40px rgba(0,0,0,0.7)", overflow:"hidden" }}>
          <div style={{ display:"flex", overflowX:"auto", padding:"8px 8px 0", gap:4, scrollbarWidth:"none" }}>
            {EMOJI_GROUPS.map((g, i) => (
              <button key={i} onClick={()=>setAg(i)} style={{ background:ag===i?"rgba(167,139,250,0.25)":"none", border:"none", borderRadius:8, padding:"4px 6px", cursor:"pointer", fontSize:14, flexShrink:0 }}>
                {g.label.split(" ")[0]}
              </button>
            ))}
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:3, padding:"8px 10px 10px", maxHeight:180, overflowY:"auto", overscrollBehavior:"contain" }}>
            {EMOJI_GROUPS[ag].emojis.map(e => (
              <button key={e} onClick={()=>{ onChange(e); setOpen(false); }}
                style={{ fontSize:20, background:"none", border:"none", cursor:"pointer", padding:4, borderRadius:8 }}
                onMouseEnter={ev=>ev.currentTarget.style.background="rgba(167,139,250,0.2)"}
                onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                {e}
              </button>
            ))}
          </div>
        </div>
      </>}
    </div>
  );
}
