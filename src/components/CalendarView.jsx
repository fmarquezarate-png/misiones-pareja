import { useState, useEffect, useRef } from "react";
import { useConfirm } from "./ConfirmModal.jsx";
import { S, badgeStyle, catBadgeStyle } from "../styles.js";
import { DEFAULT_COLORS, STATUS, STATUS_ORDER, CATEGORIES, CAT_MAP, getMCats } from "../constants.js";
import { getMissionDates } from "../lib/appUtils.js";
import { isoWeekKey } from "../utils.js";
import { fetchWCMatches, wcMatchesForDate, isWCMonth, isWCOver } from "../lib/worldCup.js";

export default function CalendarView({ allDatedMissions, p1, p2, colors, onAddForDay, onCycleStatus, onPatchMission, onDeleteMission, onPatchAllFutureSeries, personFilter = [], catFilter = [], goals = [] }) {
  const { confirm, ConfirmDialog } = useConfirm();
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [editingMission, setEditingMission] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [cellPx, setCellPx] = useState(44);
  const calRef = useRef(null);

  // ── Mundial 2026 ──────────────────────────────────────────────────────────
  const [wcMode, setWcMode] = useState(() => localStorage.getItem("mp-wc-mode") === "1");
  const [wcMatches, setWcMatches] = useState(null);  // null=not loaded, []=loaded
  const [wcLoading, setWcLoading] = useState(false);
  const [wcError, setWcError] = useState(false);

  const toggleWC = () => {
    const next = !wcMode;
    setWcMode(next);
    localStorage.setItem("mp-wc-mode", next ? "1" : "0");
  };

  // Auto-disable once the Final is over — no manual cleanup needed
  useEffect(() => {
    if (wcMode && isWCOver()) {
      setWcMode(false);
      localStorage.removeItem("mp-wc-mode");
    }
  }, [wcMode]);

  useEffect(() => {
    if (!wcMode || isWCOver()) return;
    if (wcMatches !== null) return;
    setWcLoading(true);
    setWcError(false);
    fetchWCMatches().then(m => {
      setWcMatches(m || []);
      setWcLoading(false);
      setWcError(!m);
    });
  }, [wcMode, wcMatches]);

  const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const DAYS = ["L","M","X","J","V","S","D"];

  const prevM = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); setSelectedDay(null); };
  const nextM = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); setSelectedDay(null); };

  const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  const daysInM = new Date(calYear, calMonth + 1, 0).getDate();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const clrC = colors || DEFAULT_COLORS;

  useEffect(() => {
    if (!calRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      setCellPx(Math.max(32, Math.floor((w - 18) / 7)));
    });
    ro.observe(calRef.current);
    return () => ro.disconnect();
  }, []);

  const numSz = cellPx < 40 ? 8 : 10;
  const emojiSz = cellPx < 40 ? 9 : 11;
  const maxPerCell = cellPx < 40 ? 2 : 3;
  const cellH = Math.max(48, cellPx);

  const applyFilters = ms => ms.filter(m => (!personFilter.length || personFilter.includes(m.who)) && (!catFilter.length || getMCats(m).some(c => catFilter.includes(c))));

  const byDate = {};
  const datesFor = new Map();
  applyFilters(allDatedMissions).forEach(m => {
    const d = getMissionDates(m);
    datesFor.set(m.id, d);
    d.forEach(ds => {
      if (!byDate[ds]) byDate[ds] = [];
      byDate[ds].push(m);
    });
  });
  const spanOf = m => datesFor.get(m.id) || [m.date];

  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInM }, (_, i) => i + 1)];
  const selStr = selectedDay ? `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}` : null;
  const selMs = selStr ? (byDate[selStr] || []) : [];
  const wcForSelDay = (wcMode && wcMatches && selStr) ? wcMatchesForDate(wcMatches, selStr) : [];
  const showWCMonth = wcMode && isWCMonth(calYear, calMonth);

  const onDragStart = (e, m) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", JSON.stringify({ id: m.id, wn: m.weekNumber, yr: m._yr })); };
  const onDropDay = (e, dateStr) => {
    e.preventDefault(); setDragOver(null);
    try { const { id, wn, yr } = JSON.parse(e.dataTransfer.getData("text/plain")); onPatchMission && onPatchMission(wn, yr, id, { date: dateStr }); } catch (err) { console.warn("drop err", err); }
  };

  const openEdit = m => setEditingMission({ mission: m, wn: m.weekNumber, yr: m._yr });
  const closeEdit = () => setEditingMission(null);
  const patchEditing = patch => {
    if (!editingMission) return;
    onPatchMission && onPatchMission(editingMission.wn, editingMission.yr, editingMission.mission.id, patch);
    setEditingMission(p => ({ ...p, mission: { ...p.mission, ...patch } }));
  };

  return (
    <div>
      <div ref={calRef}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 }}>
          <button onClick={prevM} style={S.btnNav}>‹</button>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 600, minWidth: 160, textAlign: "center" }}>{MONTHS[calMonth]} {calYear}</div>
          <button onClick={nextM} style={S.btnNav}>›</button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          {(calYear !== today.getFullYear() || calMonth !== today.getMonth()) && (
            <button onClick={() => { setCalYear(today.getFullYear()); setCalMonth(today.getMonth()); setSelectedDay(null); }} style={{ background: "rgba(167,139,250,0.10)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 99, color: "var(--t-accent,#a78bfa)", fontSize: 11, fontWeight: 600, padding: "4px 14px", cursor: "pointer", fontFamily: "inherit" }}>⟲ Volver a hoy</button>
          )}
          {!isWCOver() && (
            <button onClick={toggleWC} style={{ background: wcMode ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${wcMode ? "rgba(52,211,153,0.45)" : "rgba(255,255,255,0.1)"}`, borderRadius: 99, color: wcMode ? "#34d399" : "var(--t-text-dim,#6b5f88)", fontSize: 11, fontWeight: 600, padding: "4px 14px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
              🏆 Mundial 2026{wcMode ? (wcLoading ? " ·⌛" : wcError ? " · sin datos" : " · ON") : ""}
            </button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 3 }}>
          {DAYS.map(d => <div key={d} style={{ textAlign: "center", fontSize: numSz, color: "var(--t-text-dim,#4a4166)", fontWeight: 600, padding: "3px 0" }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} />;
            const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const ms = byDate[ds] || [], isTd = ds === todayStr, isSel = day === selectedDay, isDO = dragOver === ds;
            const multiMs = ms.filter(m => spanOf(m).length > 1);
            const singleMs = ms.filter(m => spanOf(m).length <= 1);
            const wcDay = (showWCMonth && wcMatches) ? wcMatchesForDate(wcMatches, ds) : [];
            const hasAny = ms.length > 0 || wcDay.length > 0;
            // slots: show user missions first, then WC emojis in remaining slots
            const shownSingle = singleMs.slice(0, maxPerCell);
            const wcSlots = Math.max(0, maxPerCell - shownSingle.length);
            const shownWC = wcDay.slice(0, wcSlots);
            const overflow = (singleMs.length - shownSingle.length) + (wcDay.length - shownWC.length);
            return (
              <div key={day} onClick={() => setSelectedDay(isSel ? null : day)}
                onDragEnter={e => { e.preventDefault(); setDragOver(ds); }} onDragOver={e => e.preventDefault()} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }} onDrop={e => onDropDay(e, ds)}
                style={{ borderRadius: 6, minHeight: cellH, overflow: "hidden", cursor: "pointer", background: isDO ? "rgba(167,139,250,0.3)" : isSel ? "rgba(167,139,250,0.22)" : ms.length > 0 ? "rgba(167,139,250,0.06)" : wcDay.length > 0 ? "rgba(52,211,153,0.04)" : "rgba(255,255,255,0.02)", border: isDO ? "1px solid rgba(167,139,250,0.7)" : isSel ? "1px solid rgba(167,139,250,0.55)" : wcDay.length > 0 && ms.length === 0 ? "1px solid rgba(52,211,153,0.18)" : "1px solid rgba(255,255,255,0.04)", transition: "all 0.12s" }}>
                {multiMs.map(m => {
                  const mDates = spanOf(m);
                  const isFirst = mDates[0] === ds, isLast = mDates[mDates.length - 1] === ds;
                  const bg = m.who === "person1" ? clrC.person1 : m.who === "person2" ? clrC.person2 : clrC.together;
                  return (
                    <div key={`bar-${m.id}`} title={m.title} draggable onDragStart={e => { e.stopPropagation(); onDragStart(e, m); }} onDragEnd={() => setDragOver(null)}
                      style={{ height: 15, display: "flex", alignItems: "center", overflow: "hidden", whiteSpace: "nowrap", marginLeft: isFirst ? 0 : -2, marginRight: isLast ? 0 : -2, marginBottom: 1, paddingLeft: isFirst ? 4 : 0, paddingRight: isLast ? 2 : 0, background: `${bg}35`, borderTop: `2px solid ${bg}99`, borderRadius: isFirst && isLast ? "3px" : isFirst ? "3px 0 0 3px" : isLast ? "0 3px 3px 0" : "0", opacity: m.status === "DONE" ? 0.45 : 1, cursor: "grab" }}>
                      {isFirst && <span style={{ fontSize: 7, color: bg, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{m.emoji} {m.title}</span>}
                    </div>
                  );
                })}
                <div style={{ padding: "2px 3px" }}>
                  <div style={{ fontSize: numSz, fontWeight: 600, marginBottom: 2, textAlign: "center", color: isTd ? "#f472b6" : isSel ? "#c4b8ff" : "#4a4166", width: 18, height: 18, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 2px", border: isTd ? "1.5px solid #f472b6" : "1.5px solid transparent", lineHeight: 1 }}>{day}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center" }}>
                    {shownSingle.map(m => { const bg = m.who === "person1" ? clrC.person1 : m.who === "person2" ? clrC.person2 : clrC.together; return <span key={`${m.id}-${ds}`} draggable onDragStart={e => { e.stopPropagation(); onDragStart(e, m); }} onDragEnd={() => setDragOver(null)} title={m.title} style={{ fontSize: emojiSz, lineHeight: 1, background: `${bg}30`, border: `1px solid ${bg}55`, borderRadius: 3, padding: "1px 2px", opacity: m.status === "DONE" ? 0.4 : 1, cursor: "grab" }}>{m.emoji}</span>; })}
                    {shownWC.map(wm => <span key={wm.id} title={`⚽ ${wm.home} vs ${wm.away}`} style={{ fontSize: emojiSz, lineHeight: 1, background: "rgba(52,211,153,0.14)", border: "1px solid rgba(52,211,153,0.35)", borderRadius: 3, padding: "1px 2px" }}>⚽</span>)}
                    {overflow > 0 && <span style={{ fontSize: 8, color: "var(--t-text-dim,#4a4166)" }}>+{overflow}</span>}
                  </div>
                </div>
                {hasAny && (() => {
                  const p1c = ms.filter(m => m.who === "person1").length, p2c = ms.filter(m => m.who === "person2").length, tg = ms.filter(m => m.who === "together").length;
                  return (
                    <div style={{ height: 2, display: "flex", gap: 0, overflow: "hidden" }}>
                      {p1c > 0 && <i style={{ background: clrC.person1, flex: p1c, height: "100%" }} />}
                      {p2c > 0 && <i style={{ background: clrC.person2, flex: p2c, height: "100%" }} />}
                      {tg > 0 && <i style={{ background: clrC.together, flex: tg, height: "100%" }} />}
                      {wcDay.length > 0 && <i style={{ background: "#34d399", flex: wcDay.length, height: "100%" }} />}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div style={{ ...S.card, marginTop: 12, borderColor: "rgba(167,139,250,0.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--t-accent,#a78bfa)", fontWeight: 600 }}>{selectedDay} de {MONTHS[calMonth]}</div>
            <div style={{ display: "flex", gap: 6 }}>
              {onAddForDay && <button onClick={() => onAddForDay(selStr)} style={{ ...S.btnPrimary, fontSize: 11, padding: "5px 10px" }}>+ Añadir</button>}
            </div>
          </div>

          {/* WC matches for this day */}
          {wcForSelDay.length > 0 && (
            <div style={{ marginBottom: selMs.length > 0 ? 10 : 0, paddingBottom: selMs.length > 0 ? 10 : 0, borderBottom: selMs.length > 0 ? "1px solid rgba(52,211,153,0.12)" : "none" }}>
              {wcForSelDay.map(wm => (
                <div key={wm.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(52,211,153,0.07)" }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>⚽</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#34d399", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {wm.homeFlag} {wm.home} vs {wm.away} {wm.awayFlag}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(52,211,153,0.65)", marginTop: 2 }}>
                      {wm.round}{wm.time ? ` · ${wm.time} h. España` : ""}
                      {wm.score1 !== null ? ` · ${wm.score1}–${wm.score2}` : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.28)", padding: "2px 8px", borderRadius: 99, flexShrink: 0 }}>WC26</span>
                </div>
              ))}
            </div>
          )}

          {selMs.length === 0 && wcForSelDay.length === 0
            ? <div style={{ color: "var(--t-text-dim,#3d3360)", fontStyle: "italic", fontSize: 13 }}>Sin misiones para este día</div>
            : selMs.length === 0 ? null
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selMs.map(m => {
                  const whoColor = m.who === "person1" ? clrC.person1 : m.who === "person2" ? clrC.person2 : clrC.together;
                  const isMultiDay = spanOf(m).length > 1;
                  return (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(167,139,250,0.08)" }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{m.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: m.status === "DONE" ? "#4d4566" : "var(--t-text,#e2d9ff)", textDecoration: m.status === "DONE" ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.title}{isMultiDay && <span style={{ fontSize: 10, marginLeft: 4, color: "var(--t-accent,#a78bfa)" }}>↔</span>}
                        </div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                          {m.time && <span style={{ fontSize: 10, color: "var(--t-accent,#a78bfa)" }}>🕐 {m.time}</span>}
                          {m.duration > 0 && <span style={{ fontSize: 10, color: "#7c6fa0" }}>{m.duration >= 60 ? `${Math.floor(m.duration / 60)}h${m.duration % 60 ? m.duration % 60 + "m" : ""}` : m.duration + "m"}</span>}
                          {getMCats(m).map(ci => { const c = CAT_MAP[ci]; return c ? <span key={ci} style={{ fontSize: 10, color: c.color }}>{c.icon}</span> : null; })}
                          <span style={{ fontSize: 10, background: `${whoColor}18`, color: whoColor, border: `1px solid ${whoColor}40`, padding: "0 5px", borderRadius: 99 }}>{m.who === "person1" ? p1 : m.who === "person2" ? p2 : "👫"}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button onClick={() => onCycleStatus && onCycleStatus(m.weekNumber, m._yr, m.id)} style={badgeStyle(m.status)}>{STATUS[m.status].icon}</button>
                        <button onClick={() => openEdit(m)} style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 7, color: "var(--t-accent,#a78bfa)", fontSize: 11, padding: "4px 8px", cursor: "pointer", fontFamily: "inherit" }}>✏️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
      )}

      {editingMission && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={closeEdit}>
          <div style={{ background: "var(--t-card,#1d1733)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.35))", borderRadius: 16, padding: 20, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t-text,#c4b8ff)" }}>✏️ Editar actividad</span>
              <button onClick={closeEdit} style={{ background: "none", border: "none", color: "var(--t-text-dim,#6b5f88)", fontSize: 20, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ marginBottom: 10 }}><label style={S.label}>Título</label><input value={editingMission.mission.title} onChange={e => patchEditing({ title: e.target.value })} style={S.input} /></div>
            <div style={{ marginBottom: 10 }}>
              <label style={S.label}>Participante</label>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {[{ id: "person1", label: p1 }, { id: "person2", label: p2 }, { id: "together", label: "👫 Juntos" }].map(w => (
                  <button key={w.id} onClick={() => patchEditing({ who: w.id })}
                    style={{ background: editingMission.mission.who === w.id ? "var(--t-accent-soft,rgba(167,139,250,0.2))" : "rgba(128,128,128,0.06)", border: `1px solid ${editingMission.mission.who === w.id ? "var(--t-accent,rgba(167,139,250,0.5))" : "var(--t-card-border,rgba(255,255,255,0.08))"}`, borderRadius: 8, color: editingMission.mission.who === w.id ? "var(--t-accent,#c4b8ff)" : "var(--t-text-dim,#6b5f88)", padding: "5px 10px", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{w.label}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={S.label}>Categoría (multi)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {CATEGORIES.map(c => { const sel = getMCats(editingMission.mission).includes(c.id); return <button key={c.id} onClick={() => { const cur = getMCats(editingMission.mission); patchEditing({ categories: sel ? cur.filter(x => x !== c.id) : [...cur, c.id], category: null }); }} style={{ ...catBadgeStyle(c.id), cursor: "pointer", border: `1px solid ${c.color}${sel ? "" : "20"}`, opacity: sel || !getMCats(editingMission.mission).length ? 1 : 0.4 }}>{c.icon} {c.label}</button>; })}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div><label style={S.label}>📆 Fecha inicio</label><input type="date" value={editingMission.mission.date || ""} onChange={e => patchEditing({ date: e.target.value || null })} style={{ ...S.inputSm, colorScheme: "dark" }} /></div>
              <div><label style={S.label}>🕐 Hora inicio</label><input type="time" value={editingMission.mission.time || ""} onChange={e => patchEditing({ time: e.target.value || null })} style={{ ...S.inputSm, colorScheme: "dark" }} /></div>
            </div>
            {editingMission.mission.type === "event" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <div><label style={S.label}>🏁 Fecha fin</label><input type="date" value={editingMission.mission.endDate || ""} onChange={e => { const ed = e.target.value || null; const s = editingMission.mission, d = s.date, t = s.time, et = s.endTime; const dur = d && t && ed && et ? Math.round((new Date(ed + "T" + et) - new Date(d + "T" + t)) / 60000) : s.duration; patchEditing({ endDate: ed, ...(dur > 0 ? { duration: dur } : {}) }); }} style={{ ...S.inputSm, colorScheme: "dark" }} /></div>
                <div><label style={S.label}>🕐 Hora fin</label><input type="time" value={editingMission.mission.endTime || ""} onChange={e => { const et = e.target.value || null; const s = editingMission.mission, d = s.date, t = s.time, ed = s.endDate; const dur = d && t && ed && et ? Math.round((new Date(ed + "T" + et) - new Date(d + "T" + t)) / 60000) : s.duration; patchEditing({ endTime: et, ...(dur > 0 ? { duration: dur } : {}) }); }} style={{ ...S.inputSm, colorScheme: "dark" }} /></div>
              </div>
            )}
            {editingMission.mission.type === "event" && editingMission.mission.time && (
              <div style={{ marginBottom: 8 }}>
                <label style={S.label}>🔔 Recordatorio</label>
                <select value={editingMission.mission.reminder || "none"} onChange={e => patchEditing({ reminder: e.target.value })} style={{ ...S.inputSm, colorScheme: "dark", fontSize: 12 }}>
                  <option value="none">Sin recordatorio</option>
                  <option value="ontime">En el momento</option>
                  <option value="15min">15 min antes</option>
                  <option value="30min">30 min antes</option>
                  <option value="1h">1 hora antes</option>
                  <option value="1day">1 día antes</option>
                </select>
              </div>
            )}
            <div style={{ marginBottom: 10 }}>
              <label style={S.label}>Estado</label>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {STATUS_ORDER.map(s => <button key={s} onClick={() => patchEditing({ status: s, completedAt: s === "DONE" ? Date.now() : null })} style={{ ...badgeStyle(s), opacity: editingMission.mission.status === s ? 1 : 0.35 }}>{STATUS[s].icon} {STATUS[s].label}</button>)}
              </div>
            </div>
            {(() => {
              const gmw = (g, w) => w === "together" || g.who === "together" || !g.who || g.who === w;
              const filtered = goals.filter(g => g.active !== false && gmw(g, editingMission.mission.who));
              return filtered.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <label style={S.label}>🏅 Meta</label>
                  <select value={editingMission.mission.goalId || ""} onChange={e => patchEditing({ goalId: e.target.value || null })} style={{ ...S.input, fontSize: 13, colorScheme: "dark", background: "var(--t-card,rgba(16,10,32,0.95))", color: "var(--t-text,#f8f4ff)" }}>
                    <option value="">— Sin meta —</option>
                    {filtered.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.title}</option>)}
                  </select>
                </div>
              );
            })()}
            {editingMission.mission.seriesId && onPatchAllFutureSeries && (
              <div style={{ background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "#34d399", fontWeight: 600, marginBottom: 6 }}>🔁 Tarea recurrente · {editingMission.mission.seriesPattern === "weekly" ? "Semanal" : editingMission.mission.seriesPattern === "biweekly" ? "Bisemanal" : "Mensual"}</div>
                <div style={{ fontSize: 11, color: "var(--t-text-dim,#6b5f88)", marginBottom: 8 }}>Los cambios anteriores aplican solo a esta instancia.</div>
                <button onClick={() => {
                  const fromWkey = isoWeekKey(editingMission.wn, editingMission.yr);
                  const { seriesId, title, emoji, who, categories, category, duration, type, reminder, seriesEndDate } = editingMission.mission;
                  confirm(`¿Aplicar estos cambios a TODAS las instancias futuras de "${title}"?`, () => {
                    onPatchAllFutureSeries(seriesId, fromWkey, { title, emoji, who, categories, category, duration, type, reminder, seriesEndDate });
                    closeEdit();
                  }, { danger: false });
                }} style={{ ...S.btnSecondary, fontSize: 11, padding: "5px 12px" }}>📋 Aplicar a todas las futuras</button>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 14 }}>
              <button onClick={() => confirm("Vas a eliminar esta actividad\n\nEsta acción no se puede deshacer.", () => { onDeleteMission && onDeleteMission(editingMission.wn, editingMission.yr, editingMission.mission.id); closeEdit(); }, { confirmLabel: "Sí, eliminar", cancelLabel: "Mejor no" })} style={{ ...S.btnSecondary, color: "#f472b6", borderColor: "rgba(244,114,182,0.3)" }}>🗑 Eliminar</button>
              <button onClick={closeEdit} style={S.btnPrimary}>Listo ✓</button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}
