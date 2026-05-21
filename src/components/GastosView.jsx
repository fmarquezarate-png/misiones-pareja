import { useState } from "react";
import { S } from "../styles.js";
import { GASTO_CATS } from "../constants.js";
import { uid } from "../utils.js";
import { useConfirm } from "./ConfirmModal.jsx";

const PROJECT_EMOJIS = ["🏖️","🗺️","🎉","🏠","🍽️","🎊","✈️","🎸","🏕️","💒","🎭","🎄","🏔️","🚂","🎿","🏄","🎪","🎨","🛳️","🌴","🎠","🚀","💍","🥂"];
const _SM = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

export default function GastosView({ gastos, proyectos, p1, p2, colors, onUpdate, onUpdateProyectos, onUpdateAll }) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [view, setView] = useState("list");
  const [projectId, setProjectId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editProjectId, setEditProjectId] = useState(null);
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0,7));
  const blankExpense = { desc:"", amount:"", cat:"comida", paidBy:"person1", date:new Date().toISOString().slice(0,10), splitP1:50, projectId:null };
  const [form, setForm] = useState(blankExpense);
  const [projectForm, setProjectForm] = useState({ name:"", emoji:"🏖️" });

  const getSplitP1 = g => {
    if (typeof g.splitP1 === "number") return g.splitP1;
    if (g.split === "full") return g.who === "person1" ? 100 : 0;
    return 50;
  };

  const computeBalance = exps => {
    const total = exps.reduce((s,g)=>s+(parseFloat(g.amount)||0),0);
    const p1Paid = exps.filter(g=>g.paidBy==="person1").reduce((s,g)=>s+(parseFloat(g.amount)||0),0);
    const p2Paid = exps.filter(g=>g.paidBy==="person2").reduce((s,g)=>s+(parseFloat(g.amount)||0),0);
    const p1Net = exps.reduce((s,g)=>{
      const amt=parseFloat(g.amount)||0, sp1=getSplitP1(g)/100;
      return g.paidBy==="person2" ? s+amt*sp1 : s-amt*(1-sp1);
    },0);
    return { total, p1Paid, p2Paid, p1Net };
  };

  const fmtAmt = n => `$${Math.round(+n).toLocaleString("es-CL")}`;
  const monthLabel = m => { if(!m)return""; const [y,mo]=m.split("-"); return `${_SM[parseInt(mo,10)-1]} ${y}`; };

  const scopedGastos = projectId ? gastos.filter(g=>g.projectId===projectId) : gastos;
  const monthGastos  = scopedGastos.filter(g=>g.date?.startsWith(filterMonth));
  const monthBalance = computeBalance(monthGastos);
  const allMonthsSet = [...new Set(scopedGastos.map(g=>g.date?.slice(0,7)).filter(Boolean))].sort((a,b)=>b.localeCompare(a));
  const allMonths    = allMonthsSet.includes(filterMonth) ? allMonthsSet : [filterMonth,...allMonthsSet];
  const filteredList = [...monthGastos].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const catTotals    = GASTO_CATS.map(c=>({...c, total:monthGastos.filter(g=>g.cat===c.id).reduce((s,g)=>s+(parseFloat(g.amount)||0),0)})).filter(c=>c.total>0).sort((a,b)=>b.total-a.total);

  const last6 = Array.from({length:6},(_,i)=>{ const d=new Date(); d.setMonth(d.getMonth()-i); return d.toISOString().slice(0,7); }).reverse();
  const monthlyTotals   = last6.map(m=>({ m, total:scopedGastos.filter(g=>g.date?.startsWith(m)).reduce((s,g)=>s+(parseFloat(g.amount)||0),0) }));
  const maxMonthlyTotal = Math.max(...monthlyTotals.map(x=>x.total),1);

  const proyectosWithBal = (proyectos||[]).map(p=>{ const b=computeBalance(gastos.filter(g=>g.projectId===p.id)); return {...p,...b, count:gastos.filter(g=>g.projectId===p.id).length}; });

  const openAddExpense  = () => { setForm({...blankExpense, projectId:projectId||null}); setEditId(null); setShowForm(true); };
  const openEditExpense = g => { setForm({...g, amount:String(g.amount), splitP1:getSplitP1(g)}); setEditId(g.id); setShowForm(true); };
  const saveExpense = () => {
    const amt=parseFloat(form.amount);
    if (!form.desc.trim()||!amt||isNaN(amt)||amt<=0) return;
    const entry={...form, amount:amt, id:editId||uid(), splitP1:Number(form.splitP1)||50};
    if (editId) onUpdate(gastos.map(g=>g.id===editId?entry:g));
    else onUpdate([...gastos, entry]);
    setShowForm(false); setEditId(null);
  };
  const delExpense = id => onUpdate(gastos.filter(g=>g.id!==id));

  const openAddProject  = () => { setProjectForm({name:"",emoji:"🏖️"}); setEditProjectId(null); setShowProjectForm(true); };
  const openEditProject = p => { setProjectForm({name:p.name,emoji:p.emoji}); setEditProjectId(p.id); setShowProjectForm(true); };
  const saveProject = () => {
    if (!projectForm.name.trim()) return;
    const entry={...projectForm, id:editProjectId||uid(), createdAt:Date.now()};
    if (editProjectId) onUpdateProyectos((proyectos||[]).map(p=>p.id===editProjectId?{...p,...projectForm}:p));
    else onUpdateProyectos([...(proyectos||[]), entry]);
    setShowProjectForm(false); setEditProjectId(null);
  };
  const delProject = id => {
    onUpdateAll({ gastosProyectos:(proyectos||[]).filter(p=>p.id!==id), gastos:gastos.map(g=>g.projectId===id?{...g,projectId:null}:g) });
    setProjectId(null);
  };
  const settleProject = (id, settled) => onUpdateProyectos((proyectos||[]).map(p=>p.id===id?{...p,settled}:p));

  const INP = { background:"var(--t-input-bg,rgba(255,255,255,0.06))", border:"1px solid var(--t-card-border,rgba(167,139,250,0.2))", borderRadius:10, color:"var(--t-text,#f0e8ff)", fontSize:16, padding:"12px 12px", fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" };
  const SEL = { ...INP, fontSize:14, padding:"11px 10px", cursor:"pointer", WebkitAppearance:"none", appearance:"none" };
  const TAB_BTN = (active) => ({ flexShrink:0, padding:"6px 14px", borderRadius:20, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:active?600:400, background:active?"var(--t-accent-soft,rgba(167,139,250,0.2))":"rgba(128,128,128,0.07)", color:active?"var(--t-accent,#a78bfa)":"var(--t-text-dim,#6b5f88)" });
  const BAL_PILL = (owes) => ({ background:owes?"rgba(248,113,113,0.1)":"rgba(52,211,153,0.1)", border:`1px solid ${owes?"rgba(248,113,113,0.3)":"rgba(52,211,153,0.3)"}`, borderRadius:8, padding:"8px 12px", fontSize:12, color:owes?"#f87171":"#34d399", fontWeight:600, textAlign:"center" });

  return (
    <div style={{ padding:"16px 16px 80px", maxWidth:600, margin:"0 auto" }}>

      {/* Tab nav */}
      <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto", paddingBottom:2 }}>
        <button onClick={()=>{setProjectId(null);setView("list");}} style={TAB_BTN(!projectId&&view==="list")}>💸 General</button>
        {(proyectos||[]).map(p=>(
          <button key={p.id} onClick={()=>{setProjectId(p.id);setView("list");}} style={TAB_BTN(projectId===p.id&&view==="list")}>{p.emoji} {p.name}</button>
        ))}
        <button onClick={openAddProject} style={{ flexShrink:0, padding:"6px 12px", borderRadius:20, border:"1px dashed rgba(167,139,250,0.3)", cursor:"pointer", fontFamily:"inherit", fontSize:12, background:"transparent", color:"var(--t-text-dim,#6b5f88)" }}>+ Proyecto</button>
        <button onClick={()=>setView("stats")} style={TAB_BTN(view==="stats")}>📊 Stats</button>
      </div>

      {/* Project header */}
      {projectId && (()=>{
        const p=(proyectos||[]).find(x=>x.id===projectId); if(!p)return null;
        const pb=computeBalance(gastos.filter(g=>g.projectId===projectId));
        return (
          <div style={{ ...S.card, marginBottom:14, display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:30 }}>{p.emoji}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:700, color:"var(--t-text,#e2dff5)" }}>{p.name}</div>
              <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginTop:1 }}>{gastos.filter(g=>g.projectId===projectId).length} gastos · {fmtAmt(pb.total)}</div>
              {Math.abs(pb.p1Net)>0.5 && <div style={{ fontSize:11, fontWeight:600, color:pb.p1Net>0?"#f87171":"#34d399", marginTop:2 }}>{pb.p1Net>0?`${p1} debe ${fmtAmt(Math.abs(pb.p1Net))} a ${p2}`:`${p2} debe ${fmtAmt(Math.abs(pb.p1Net))} a ${p1}`}</div>}
              {Math.abs(pb.p1Net)<=0.5&&pb.total>0&&<div style={{ fontSize:11, fontWeight:600, color:"#34d399", marginTop:2 }}>✓ Al día</div>}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
              <button onClick={()=>settleProject(projectId,!p.settled)}
                style={{ fontSize:10, padding:"4px 8px", borderRadius:8, border:`1px solid ${p.settled?"rgba(52,211,153,0.4)":"rgba(167,139,250,0.3)"}`, background:p.settled?"rgba(52,211,153,0.1)":"rgba(128,128,128,0.06)", color:p.settled?"#34d399":"#6b5f88", cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>
                {p.settled?"🔒 Saldado":"Marcar saldado"}
              </button>
              <div style={{ display:"flex", gap:4 }}>
                <button onClick={()=>openEditProject(p)} style={{ background:"none", border:"none", color:"var(--t-text-dim,#6b5f88)", cursor:"pointer", fontSize:13, padding:"2px 5px" }} onMouseEnter={e=>e.currentTarget.style.color="#c4b8ff"} onMouseLeave={e=>e.currentTarget.style.color="#6b5f88"}>✎</button>
                <button onClick={()=>confirm(`¿Eliminar proyecto "${p.name}"?`, ()=>delProject(projectId))} style={{ background:"none", border:"none", color:"var(--t-text-dim,#3d3360)", cursor:"pointer", fontSize:17, padding:"2px 5px" }} onMouseEnter={e=>e.currentTarget.style.color="#f472b6"} onMouseLeave={e=>e.currentTarget.style.color="#3d3360"}>×</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Projects list (General home) */}
      {!projectId && view==="list" && (()=>{
        const open   = proyectosWithBal.filter(p=>!p.settled);
        const closed = proyectosWithBal.filter(p=>p.settled);
        const renderCard = p => (
          <button key={p.id} onClick={()=>{setProjectId(p.id);setView("list");}}
            style={{ ...S.card, display:"flex", alignItems:"center", gap:12, padding:"12px 14px", border:"none", cursor:"pointer", textAlign:"left", width:"100%", marginBottom:6, opacity:p.settled?0.6:1 }}>
            <span style={{ fontSize:22 }}>{p.settled?"🔒":p.emoji}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:"var(--t-text,#e2dff5)" }}>{p.name}</div>
              <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)" }}>{p.count} gastos · {fmtAmt(p.total)}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              {p.settled
                ? <div style={{ fontSize:11, color:"#34d399", fontWeight:600 }}>✓ Saldado</div>
                : Math.abs(p.p1Net)>0.5
                  ? <div style={{ fontSize:12, color:p.p1Net>0?"#f87171":"#34d399", fontWeight:700 }}>{p.p1Net>0?`${p1}: −${fmtAmt(Math.abs(p.p1Net))}`:`${p2}: −${fmtAmt(Math.abs(p.p1Net))}`}</div>
                  : p.total>0 ? <div style={{ fontSize:11, color:"#34d399" }}>✓ Al día</div> : null
              }
            </div>
            <span style={{ color:"var(--t-text-dim,#4a4166)" }}>›</span>
          </button>
        );
        if (!open.length && !closed.length) return null;
        return (
          <div style={{ marginBottom:14 }}>
            {open.length>0 && <>
              <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:8 }}>📁 Proyectos activos</div>
              {open.map(renderCard)}
            </>}
            {closed.length>0 && <>
              <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:8, marginTop:open.length?14:0 }}>🔒 Saldados</div>
              {closed.map(renderCard)}
            </>}
          </div>
        );
      })()}

      {/* Stats view */}
      {view==="stats" && (()=>{
        const allBal=computeBalance(scopedGastos);
        const allCats=GASTO_CATS.map(c=>({...c,total:scopedGastos.filter(g=>g.cat===c.id).reduce((s,g)=>s+(parseFloat(g.amount)||0),0)})).filter(c=>c.total>0).sort((a,b)=>b.total-a.total);
        const activeMonths=new Set(scopedGastos.map(g=>g.date?.slice(0,7)).filter(Boolean)).size||1;
        return (
          <>
            <div style={{ ...S.card, marginBottom:14 }}>
              <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:14 }}>📅 Últimos 6 meses</div>
              <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:90 }}>
                {monthlyTotals.map(({m,total})=>(
                  <div key={m} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                    <div style={{ fontSize:9, color:"var(--t-text-dim,#6b5f88)", height:14, textAlign:"center" }}>{total>0?fmtAmt(total):""}</div>
                    <div style={{ width:"100%", background:"rgba(128,128,128,0.10)", borderRadius:"5px 5px 0 0", height:60, display:"flex", alignItems:"flex-end" }}>
                      <div style={{ width:"100%", background:"var(--t-accent,#a78bfa)", borderRadius:"5px 5px 0 0", height:`${Math.round(total/maxMonthlyTotal*100)}%`, minHeight:total>0?2:0 }} />
                    </div>
                    <div style={{ fontSize:9, color:"var(--t-text-dim,#4a4166)" }}>{monthLabel(m).slice(0,3)}</div>
                  </div>
                ))}
              </div>
            </div>
            {allCats.length>0&&(
              <div style={{ ...S.card, marginBottom:14 }}>
                <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:12 }}>🏷️ Por categoría (total)</div>
                {allCats.map(c=>(
                  <div key={c.id} style={{ marginBottom:9 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{ fontSize:12, color:c.color, fontWeight:600 }}>{c.icon} {c.label}</span>
                      <span style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)" }}>{fmtAmt(c.total)} · {allBal.total>0?Math.round(c.total/allBal.total*100):0}%</span>
                    </div>
                    <div style={{ background:"rgba(128,128,128,0.10)", borderRadius:99, height:5, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${allBal.total>0?c.total/allBal.total*100:0}%`, background:c.color, borderRadius:99 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ ...S.card, marginBottom:14 }}>
              <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:12 }}>👥 Resumen</div>
              <div style={{ display:"flex", gap:10, marginBottom:10 }}>
                <div style={{ flex:1, background:"rgba(128,128,128,0.06)", borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)" }}>{p1} pagó</div>
                  <div style={{ fontSize:17, fontWeight:700, color:colors.person1||"#f472b6" }}>{fmtAmt(allBal.p1Paid)}</div>
                  <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)" }}>{allBal.total>0?Math.round(allBal.p1Paid/allBal.total*100):0}% del total</div>
                </div>
                <div style={{ flex:1, background:"rgba(128,128,128,0.06)", borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)" }}>{p2} pagó</div>
                  <div style={{ fontSize:17, fontWeight:700, color:colors.person2||"#60a5fa" }}>{fmtAmt(allBal.p2Paid)}</div>
                  <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)" }}>{allBal.total>0?Math.round(allBal.p2Paid/allBal.total*100):0}% del total</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:10, marginBottom:Math.abs(allBal.p1Net)>0.5?10:0 }}>
                <div style={{ flex:1, background:"rgba(128,128,128,0.06)", borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)" }}>Total acumulado</div>
                  <div style={{ fontSize:17, fontWeight:700, color:"var(--t-accent,#c4b8ff)" }}>{fmtAmt(allBal.total)}</div>
                </div>
                <div style={{ flex:1, background:"rgba(128,128,128,0.06)", borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)" }}>Promedio/mes</div>
                  <div style={{ fontSize:17, fontWeight:700, color:"var(--t-accent,#c4b8ff)" }}>{fmtAmt(allBal.total/activeMonths)}</div>
                </div>
              </div>
              {Math.abs(allBal.p1Net)>0.5&&<div style={BAL_PILL(allBal.p1Net>0)}>{allBal.p1Net>0?`${p1} le debe ${fmtAmt(Math.abs(allBal.p1Net))} a ${p2}`:`${p2} le debe ${fmtAmt(Math.abs(allBal.p1Net))} a ${p1}`}</div>}
            </div>
            {proyectosWithBal.filter(p=>p.total>0).length>0&&(
              <div style={{ ...S.card }}>
                <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:12 }}>📁 Por proyecto</div>
                {proyectosWithBal.filter(p=>p.total>0).map(p=>(
                  <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontSize:18 }}>{p.emoji}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--t-text,#e2dff5)" }}>{p.name}</div>
                      <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)" }}>{p.count} gastos</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:14, fontWeight:700, color:"var(--t-accent,#c4b8ff)" }}>{fmtAmt(p.total)}</div>
                      {Math.abs(p.p1Net)>0.5&&<div style={{ fontSize:10, color:p.p1Net>0?"#f87171":"#34d399" }}>{p.p1Net>0?`${p1}: −${fmtAmt(Math.abs(p.p1Net))}`:`${p2}: −${fmtAmt(Math.abs(p.p1Net))}`}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        );
      })()}

      {/* List view */}
      {view==="list" && (
        <>
          <div style={{ ...S.card, marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <span style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600 }}>💸 {monthLabel(filterMonth)}</span>
              <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}
                style={{ background:"rgba(128,128,128,0.08)", border:"1px solid rgba(167,139,250,0.2)", borderRadius:8, color:"#c4b8ff", fontSize:11, padding:"3px 8px", fontFamily:"inherit", cursor:"pointer" }}>
                {allMonths.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </div>
            <div style={{ fontSize:26, fontWeight:700, color:"var(--t-accent,#c4b8ff)", fontFamily:"'Fraunces',serif", letterSpacing:-1, marginBottom:8 }}>{fmtAmt(monthBalance.total)}</div>
            <div style={{ display:"flex", gap:10, marginBottom:10 }}>
              <div style={{ flex:1, background:"rgba(128,128,128,0.06)", borderRadius:8, padding:"8px 10px" }}>
                <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)" }}>{p1} pagó</div>
                <div style={{ fontSize:15, fontWeight:600, color:colors.person1||"#f472b6" }}>{fmtAmt(monthBalance.p1Paid)}</div>
              </div>
              <div style={{ flex:1, background:"rgba(128,128,128,0.06)", borderRadius:8, padding:"8px 10px" }}>
                <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)" }}>{p2} pagó</div>
                <div style={{ fontSize:15, fontWeight:600, color:colors.person2||"#60a5fa" }}>{fmtAmt(monthBalance.p2Paid)}</div>
              </div>
            </div>
            {Math.abs(monthBalance.p1Net)>0.5&&<div style={BAL_PILL(monthBalance.p1Net>0)}>{monthBalance.p1Net>0?`${p1} debe ${fmtAmt(Math.abs(monthBalance.p1Net))} a ${p2}`:`${p2} debe ${fmtAmt(Math.abs(monthBalance.p1Net))} a ${p1}`}</div>}
            {Math.abs(monthBalance.p1Net)<=0.5&&monthBalance.total>0&&<div style={BAL_PILL(false)}>✓ Están al día</div>}
          </div>

          {catTotals.length>0&&(
            <div style={{ ...S.card, marginBottom:12 }}>
              <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:600, marginBottom:10 }}>🏷️ Por categoría</div>
              {catTotals.map(c=>(
                <div key={c.id} style={{ marginBottom:7 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                    <span style={{ fontSize:12, color:c.color, fontWeight:600 }}>{c.icon} {c.label}</span>
                    <span style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)" }}>{fmtAmt(c.total)} · {monthBalance.total>0?Math.round(c.total/monthBalance.total*100):0}%</span>
                  </div>
                  <div style={{ background:"rgba(128,128,128,0.10)", borderRadius:99, height:4, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${monthBalance.total>0?c.total/monthBalance.total*100:0}%`, background:c.color, borderRadius:99 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <button onClick={openAddExpense} style={{ ...S.btnPrimary, width:"100%", padding:"11px", fontSize:13, textAlign:"center", display:"flex", alignItems:"center", justifyContent:"center", gap:6, marginBottom:12 }}>
            + Añadir gasto{projectId?` · ${(proyectos||[]).find(p=>p.id===projectId)?.name||""}` : ""}
          </button>

          {filteredList.length===0&&(
            <div style={{ textAlign:"center", padding:40, color:"var(--t-text-dim,#3d3360)" }}>
              <div style={{ fontSize:40, marginBottom:10 }}>💸</div>
              <div style={{ fontStyle:"italic", fontSize:13 }}>Sin gastos en {monthLabel(filterMonth)}.<br/>¡Añade el primero!</div>
            </div>
          )}
          {filteredList.map(g=>{
            const cat=GASTO_CATS.find(c=>c.id===g.cat)||GASTO_CATS[GASTO_CATS.length-1];
            const sp1=getSplitP1(g);
            const paidLabel=g.paidBy==="person1"?p1:p2;
            const splitLabel=sp1===50?"÷2":sp1===100?`100% ${p1}`:sp1===0?`100% ${p2}`:`${sp1}%/${100-sp1}%`;
            const projName=g.projectId?(proyectos||[]).find(p=>p.id===g.projectId)?.name:null;
            return (
              <div key={g.id} style={{ ...S.card, marginBottom:6, display:"flex", alignItems:"center", gap:10, padding:"10px 12px" }}>
                <span style={{ fontSize:20, flexShrink:0 }}>{cat.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:2, flexWrap:"wrap" }}>
                    <span style={{ fontSize:13, fontWeight:600, color:"var(--t-text,#e2dff5)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:140 }}>{g.desc}</span>
                    <span style={{ fontSize:9, color:cat.color, background:`${cat.color}22`, borderRadius:4, padding:"1px 4px", flexShrink:0 }}>{cat.label}</span>
                    {projName&&<span style={{ fontSize:9, color:"var(--t-text-muted,#8b7fa8)", background:"rgba(128,128,128,0.10)", borderRadius:4, padding:"1px 4px", flexShrink:0 }}>📁 {projName}</span>}
                  </div>
                  <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)" }}>{g.date} · {paidLabel} pagó · {splitLabel}</div>
                </div>
                <div style={{ fontSize:15, fontWeight:700, color:"var(--t-accent,#c4b8ff)", flexShrink:0 }}>{fmtAmt(g.amount)}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:2, flexShrink:0 }}>
                  <button onClick={()=>openEditExpense(g)} style={{ background:"none", border:"none", color:"var(--t-text-dim,#6b5f88)", cursor:"pointer", fontSize:12, padding:"2px 4px" }} onMouseEnter={e=>e.currentTarget.style.color="#c4b8ff"} onMouseLeave={e=>e.currentTarget.style.color="#6b5f88"}>✎</button>
                  <button onClick={()=>delExpense(g.id)} style={{ background:"none", border:"none", color:"var(--t-text-dim,#3d3360)", cursor:"pointer", fontSize:15, padding:"2px 4px" }} onMouseEnter={e=>e.currentTarget.style.color="#f472b6"} onMouseLeave={e=>e.currentTarget.style.color="#3d3360"}>×</button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Add/edit expense modal */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
          onClick={e=>{if(e.target===e.currentTarget){setShowForm(false);setEditId(null);}}}>
          <div style={{ background:"var(--t-card,#1d1733)", borderRadius:"18px 18px 0 0", width:"100%", maxWidth:560, padding:"20px 20px 40px", display:"flex", flexDirection:"column", gap:12, maxHeight:"92vh", overflowY:"auto" }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:15, fontWeight:600, color:"var(--t-text,#e2dff5)" }}>{editId?"Editar gasto":"Nuevo gasto"}</span>
              <button onClick={()=>{setShowForm(false);setEditId(null);}} style={{ background:"none", border:"none", color:"var(--t-text-dim,#6b5f88)", fontSize:22, cursor:"pointer" }}>×</button>
            </div>
            <input placeholder="Descripción (ej. Cena, Supermercado…)" value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} style={INP} />
            <div>
              <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:5 }}>Monto</div>
              <input placeholder="0" type="number" inputMode="decimal" min="0" step="any" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={INP} />
            </div>
            <div>
              <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:5 }}>Fecha</div>
              <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{ ...INP, colorScheme:"dark" }} />
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:5 }}>Categoría</div>
                <select value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))} style={SEL}>
                  {GASTO_CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:5 }}>¿Quién pagó?</div>
                <select value={form.paidBy} onChange={e=>setForm(f=>({...f,paidBy:e.target.value}))} style={SEL}>
                  <option value="person1">{p1}</option>
                  <option value="person2">{p2}</option>
                </select>
              </div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:6 }}>División del gasto</div>
              {form.amount && parseFloat(form.amount)>0 && (
                <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                  <div style={{ flex:1, background:"rgba(128,128,128,0.06)", borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                    <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)" }}>{p1} paga</div>
                    <div style={{ fontSize:15, fontWeight:700, color:"var(--t-accent,#c4b8ff)" }}>{fmtAmt(parseFloat(form.amount)*form.splitP1/100)}</div>
                    <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)" }}>{form.splitP1}%</div>
                  </div>
                  <div style={{ flex:1, background:"rgba(128,128,128,0.06)", borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                    <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)" }}>{p2} paga</div>
                    <div style={{ fontSize:15, fontWeight:700, color:"var(--t-accent,#c4b8ff)" }}>{fmtAmt(parseFloat(form.amount)*(100-form.splitP1)/100)}</div>
                    <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)" }}>{100-form.splitP1}%</div>
                  </div>
                </div>
              )}
              <div style={{ display:"flex", gap:5, marginBottom:10, flexWrap:"wrap" }}>
                {[{l:"50/50",v:50},{l:`Solo ${p1}`,v:100},{l:`Solo ${p2}`,v:0},{l:`${p1} 70%`,v:70},{l:`${p2} 70%`,v:30}].map(({l,v})=>(
                  <button key={l} onClick={()=>setForm(f=>({...f,splitP1:v}))}
                    style={{ padding:"5px 10px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:form.splitP1===v?700:400, background:form.splitP1===v?"var(--t-accent-soft,rgba(167,139,250,0.2))":"rgba(128,128,128,0.08)", color:form.splitP1===v?"var(--t-accent,#c4b8ff)":"#6b5f88" }}>{l}</button>
                ))}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", flexShrink:0 }}>0%</span>
                <input type="range" min="0" max="100" step="5" value={form.splitP1} onChange={e=>setForm(f=>({...f,splitP1:Number(e.target.value)}))} style={{ flex:1, accentColor:"var(--t-accent,#a78bfa)", cursor:"pointer" }} />
                <span style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", flexShrink:0 }}>100%</span>
              </div>
            </div>
            {(proyectos||[]).length>0&&(
              <div>
                <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:5 }}>Proyecto (opcional)</div>
                <select value={form.projectId||""} onChange={e=>setForm(f=>({...f,projectId:e.target.value||null}))} style={SEL}>
                  <option value="">Sin proyecto</option>
                  {(proyectos||[]).map(p=><option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:4 }}>
              <button onClick={()=>{setShowForm(false);setEditId(null);}} style={S.btnSecondary}>Cancelar</button>
              <button onClick={saveExpense} style={S.btnPrimary}>Guardar ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/edit project modal */}
      {showProjectForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
          onClick={e=>{if(e.target===e.currentTarget){setShowProjectForm(false);setEditProjectId(null);}}}>
          <div style={{ background:"var(--t-card,#1d1733)", borderRadius:"18px 18px 0 0", width:"100%", maxWidth:560, padding:"20px 20px 40px", display:"flex", flexDirection:"column", gap:14 }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:15, fontWeight:600, color:"var(--t-text,#e2dff5)" }}>{editProjectId?"Editar proyecto":"Nuevo proyecto"}</span>
              <button onClick={()=>{setShowProjectForm(false);setEditProjectId(null);}} style={{ background:"none", border:"none", color:"var(--t-text-dim,#6b5f88)", fontSize:22, cursor:"pointer" }}>×</button>
            </div>
            <div>
              <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:5 }}>Nombre</div>
              <input placeholder="ej. Viaje a Chile, Finde playa…" value={projectForm.name} onChange={e=>setProjectForm(f=>({...f,name:e.target.value}))} style={INP} />
            </div>
            <div>
              <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginBottom:8 }}>Emoji</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {PROJECT_EMOJIS.map(em=>(
                  <button key={em} onClick={()=>setProjectForm(f=>({...f,emoji:em}))}
                    style={{ width:38, height:38, borderRadius:8, border:`2px solid ${projectForm.emoji===em?"var(--t-accent,#a78bfa)":"transparent"}`, background:projectForm.emoji===em?"var(--t-accent-soft,rgba(167,139,250,0.15))":"rgba(128,128,128,0.06)", cursor:"pointer", fontSize:20, display:"flex", alignItems:"center", justifyContent:"center" }}>{em}</button>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={()=>{setShowProjectForm(false);setEditProjectId(null);}} style={S.btnSecondary}>Cancelar</button>
              <button onClick={saveProject} style={S.btnPrimary}>Guardar ✓</button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}
