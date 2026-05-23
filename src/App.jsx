import { useState, useEffect, useCallback, useRef } from "react";
import { loadData, loadDataWithVersion, loadFromNormalized, saveData, saveWithRetry, isValidAppData, loadLocalBackup, exportData, importData, signOut, getSession, onAuthChange, getMyCoupleId, subscribeToUpdates } from "./supabase.js";
import supabase from "./supabase.js";
import Brand from "./components/Brand.jsx";
import Toast, { useToast } from "./components/Toast.jsx";
import HomeDashboard from "./components/HomeDashboard.jsx";
import WeekTimeline from "./components/WeekTimeline.jsx";
import FilterDrawer, { FilterButton } from "./components/FilterDrawer.jsx";
import OverflowMenu, { OverflowButton } from "./components/OverflowMenu.jsx";
import LinksView from "./components/LinksView.jsx";
import { useConfirm } from "./components/ConfirmModal.jsx";
import { SkeletonDashboard } from "./components/Skeleton.jsx";
import { uid, isoWeekKey, getWeekAndYear, isTodayMonday, isoWeeksInYear } from "./utils.js";
import { APP_VERSION, LAST_UPDATE, CHANGELOG, SEED_VERSION, THEMES, MAINTENANCE_WARNING, STATUS_ORDER, STATUS, CATEGORIES, CAT_MAP, getMCats, DEFAULT_COLORS } from "./constants.js";
import { S, badgeStyle } from "./styles.js";
import WorkHoursCard from "./components/WorkHoursCard.jsx";
import AddMissionForm from "./components/AddMissionForm.jsx";
import MissionCard from "./components/MissionCard.jsx";
import { track, setTrackContext } from "./lib/track.js";
import { isEnabled } from "./lib/flags.js";
import { saveWithCAS } from "./lib/repo.js";
import PillFilter from "./components/PillFilter.jsx";
import DevBackfillPanel from "./components/DevBackfillPanel.jsx";
import GoalsView from "./views/GoalsView.jsx";
import { subscribePush, unsubscribePush, getCurrentSubscription, isPushSupported, sendContextualPush } from "./lib/push.js";
import LoginScreen from "./components/LoginScreen.jsx";
import OnboardingScreen from "./components/OnboardingScreen.jsx";
import TutorialOverlay, { TUTORIAL_STEPS } from "./components/TutorialOverlay.jsx";
import StatsView from "./components/StatsView.jsx";
import GastosView from "./components/GastosView.jsx";
import ProfileModal from "./components/ProfileModal.jsx";
import { getUserPrefs, saveUserPrefs } from "./lib/userPrefs.js";
import ThemeInjector from "./components/ThemeInjector.jsx";
import MaintenanceBanner from "./components/MaintenanceBanner.jsx";
import ChatView from "./components/ChatView.jsx";
import CalendarView from "./components/CalendarView.jsx";
import { useSwipe, repairMisplacedMissions, applyCarryOver, syncCarryDone, showNotif, clearRTimers, scheduleReminders, dlBlob, weekStartDate, fmtShortDate, fmtWeekRange } from "./lib/appUtils.js";




// ─── Seed ─────────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = { person1: "Persona 1", person2: "Persona 2", colors: { person1:"#f472b6", person2:"#a78bfa", together:"#34d399" }, notifications: { chat:true, partnerChanges:true, eventReminders:true, goalDeadlines:true, dailyBriefing:false, briefingTime:"08:00" } };




const { week: _seedWeek, year: _seedYear } = getWeekAndYear();
const SEED = {
  seedVersion: SEED_VERSION,
  currentWeekNumber: _seedWeek, currentYear: _seedYear,
  settings: DEFAULT_SETTINGS,
  goals: [],
  weeks: {},
};



// ─── Auth wrapper ─────────────────────────────────────────────────────────────
const AUTH_CACHE_KEY = "shared-cal-auth-v1";

export default function AppWithAuth() {
  // Instant startup: read cached couple synchronously (set on previous login, no network needed)
  const authCache = (() => { try { return JSON.parse(localStorage.getItem(AUTH_CACHE_KEY)||"null"); } catch { return null; } })();

  const [session,    setSession]    = useState(undefined);
  const [coupleData, setCoupleData] = useState(authCache);
  const [authStep,   setAuthStep]   = useState(authCache ? "app" : "checking");

  useEffect(() => {
    // Single handler for initial session + every auth state change
    const resolve = async s => {
      setSession(s);
      if (!s) {
        localStorage.removeItem(AUTH_CACHE_KEY);
        setCoupleData(null); setAuthStep("login"); return;
      }
      const cd = await getMyCoupleId();
      if (cd?.couple_id) {
        localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ couple_id: cd.couple_id, person_name: cd.person_name }));
        setCoupleData(cd); setAuthStep("app");
      } else {
        localStorage.removeItem(AUTH_CACHE_KEY);
        setAuthStep("onboarding");
      }
    };
    getSession().then(resolve);
    const sub = onAuthChange(resolve);
    return () => sub.unsubscribe();
  }, []);

  const handleSignOut = () => { localStorage.removeItem(AUTH_CACHE_KEY); signOut(); };

  if (authStep === "checking") return (
    <div style={{ background:"#0a0714", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", color:"#f8f4ff", fontFamily:"system-ui" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:12 }}>💞</div>
        <div style={{ color:"var(--t-text-muted,#8b7fa8)", fontSize:14 }}>Comprobando sesión...</div>
      </div>
    </div>
  );

  if (authStep === "login") return <LoginScreen />;
  if (authStep === "onboarding") return <OnboardingScreen session={session} onDone={cd => { localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(cd)); setCoupleData(cd); setAuthStep("app"); }} />;
  // key={coupleData?.couple_id} forces full remount if couple changes (data isolation)
  return (
    <>
      <MaintenanceBanner warning={MAINTENANCE_WARNING} />
      <CoupleMissions key={coupleData?.couple_id} coupleId={coupleData?.couple_id} personName={coupleData?.person_name} onSignOut={handleSignOut} sessionUserId={session?.user?.id} />
    </>
  );
}

function CoupleMissions({ coupleId, personName, onSignOut, sessionUserId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const saveTimerRef    = useRef(null);
  const dataRef         = useRef(null);
  const dataVersionRef  = useRef(0);
  const [activeTab,       setActiveTab]       = useState("home");
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [showProfile,     setShowProfile]     = useState(false);
  const [settingsMenuOpen,setSettingsMenuOpen]= useState(false);
  const [importMsg,       setImportMsg]       = useState(null);
  const importFileRef = useRef(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newM, setNewM] = useState({ emoji:"🎯", title:"", status:"TBC", date:"", time:"", endDate:"", endTime:"", categories:[], who:"together", duration:0, goalId:null, type:"task", seriesPattern:"", seriesEndDate:"", reminder:"none" });
  const [editObj, setEditObj] = useState(false);
  const [error, setError] = useState(null);
  const [histWeekRange, setHistWeekRange] = useState("all");
  const [globalPersonFilter, setGlobalPersonFilter] = useState([]); // [] = todos
  const [globalCatFilter, setGlobalCatFilter] = useState([]); // [] = todas
  const [localThemeId, setLocalThemeId] = useState(null);
  const [localFontId,  setLocalFontId]  = useState(null);
  const [weekSort, setWeekSort] = useState("default"); // default | chrono | type | who | status
  const [showChangelog, setShowChangelog] = useState(false);
  const [lightboxSrc,   setLightboxSrc]   = useState(null);
  const [syncing, setSyncing]       = useState(false);
  const [syncError, setSyncError]   = useState(null);   // string | null
  const [syncMsg,   setSyncMsg]     = useState(null);   // feedback message
  const [tutorialStep, setTutorialStep] = useState(null); // null = hidden
  const [notifGranted, _setNotifGranted] = useState(typeof Notification!=="undefined" && Notification.permission==="granted");
  const notifSettingsRef    = useRef(null);
  const pushSubscribedRef   = useRef(false);
  const pushNudgeDismissRef = useRef(false);
  const [pushSubscribed,   setPushSubscribed]   = useState(false);
  const [pushLoading,      setPushLoading]      = useState(false);
  const [pushError,        setPushError]        = useState(null);
  const [pushNudgeVisible, setPushNudgeVisible] = useState(false);
  const pushSupported = isPushSupported();
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingSave, setPendingSave] = useState(false);
  const [savingState, setSavingState] = useState("idle"); // "idle"|"saving"|"saved"|"error"
  const [pendingTab, setPendingTab] = useState("pending"); // "pending" | "logros"
  const [logrosPeopleFilter, setLogrosPeopleFilter] = useState([]);
  const [logrosCatFilter, setLogrosCatFilter] = useState([]);
  const [icsModal, setIcsModal] = useState(false);
  const [icsFrom,  setIcsFrom]  = useState("");
  const [icsTo,    setIcsTo]    = useState("");
  const [popOpen,       setPopOpen]       = useState(false);
  const [filtersOpen,   setFiltersOpen]   = useState(false);
  const [weekViewMode,  setWeekViewMode]  = useState("timeline"); // "list" | "timeline"
  const { toast: appToast, push: pushToast, dismiss: dismissToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const showSyncMsg = msg => { setSyncMsg(msg); setTimeout(() => setSyncMsg(null), 3000); };

  const checkUpdate = async () => {
    pushToast({ kind: "loading", text: "Verificando versión…" });
    try {
      // Step 1: fetch server version bypassing all caches
      let serverVersion = null;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) serverVersion = (await res.json()).v;
      } catch { /* offline or missing file — skip version check */ }

      // Step 2: compare with current bundle version
      if (serverVersion && serverVersion === APP_VERSION) {
        pushToast({ kind: "error", text: `Ya tienes la última versión (v${APP_VERSION}). Si acabas de desplegar, espera unos minutos y vuelve a intentar.` });
        return;
      }

      // Step 3: trigger service worker update
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          } else if (!reg.installing && serverVersion && serverVersion !== APP_VERSION) {
            // SW updated but not yet waiting — force reload anyway
          } else if (!reg.waiting && !reg.installing && !serverVersion) {
            pushToast({ kind: "error", text: "No se encontró actualización en el service worker. Intenta limpiar caché del navegador (Ctrl+Shift+R)." });
            return;
          }
        }
      }

      const msg = serverVersion && serverVersion !== APP_VERSION
        ? `Actualizando v${APP_VERSION} → v${serverVersion}…`
        : "Actualizando…";
      pushToast({ kind: "success", text: msg });
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      pushToast({ kind: "error", text: `Error al actualizar: ${err.message}` });
    }
  };

  // Pull remote data; if Supabase has nothing, push local data up.
  const forceSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const remote = await (isEnabled("read_from_normalized") ? loadFromNormalized(coupleId) : loadData(coupleId));
      if (remote) {
        setData(prev => {
          if (JSON.stringify(remote) === JSON.stringify(prev)) {
            showSyncMsg("✓ Ya estás al día");
          } else {
            showSyncMsg("⬇ Datos actualizados desde Supabase");
          }
          return remote;
        });
      } else {
        // No row in Supabase yet — push local data up
        setData(current => {
          if (current) {
            saveData(current, coupleId)
              .then(() => showSyncMsg("⬆ Datos subidos a Supabase"))
              .catch(e => { setSyncError(e.message); showSyncMsg("⚠ Error al subir"); });
          }
          return current;
        });
      }
    } catch (e) {
      setSyncError(e.message);
      showSyncMsg("⚠ Error de conexión");
    }
    setSyncing(false);
  };

  // Force-push local data up to Supabase, then verify with actual timestamp from DB
  const forcePush = async () => {
    if (!coupleId) return;
    setSyncing(true);
    setSyncError(null);
    showSyncMsg("⬆ Subiendo a Supabase…");
    try {
      await saveWithRetry(data, coupleId);
      // Read back updated_at — set by BEFORE UPDATE trigger, ground truth that the write landed
      const { data: row, error: readErr } = await supabase
        .from("app_data")
        .select("updated_at")
        .eq("id", coupleId)
        .single();
      if (readErr || !row) throw new Error("Guardado pero no se pudo leer confirmación: " + (readErr?.message || "sin datos"));
      const savedAt = new Date(row.updated_at);
      const diffSec = Math.round((Date.now() - savedAt.getTime()) / 1000);
      const timeStr = savedAt.toLocaleTimeString("es-ES");
      if (diffSec > 30) throw new Error(`updated_at tiene ${diffSec}s de antigüedad — el write no se aplicó. Revisa RLS o sesión.`);
      showSyncMsg(`✅ Guardado en Supabase · ${timeStr} (hace ${diffSec}s)`);
    } catch (e) {
      setSyncError(e.message);
      showSyncMsg("⚠ " + e.message);
    }
    setSyncing(false);
  };

  useEffect(() => {
    (async () => {
      // Fast path: render local backup instantly (zero network wait for returning users)
      const local = loadLocalBackup(coupleId);
      if (local?.data?.weeks) {
        let fast = { ...local.data };
        if (!fast.settings) fast.settings = DEFAULT_SETTINGS;
        if (!fast.goals) fast.goals = SEED.goals;
        setData(fast);
        setLoading(false); // show immediately — Supabase will update silently
      }

      // Leer version para CAS — no interrumpe el flujo existente
      loadDataWithVersion(coupleId).then(({ version }) => {
        dataVersionRef.current = version;
        console.debug("[CAS] version cargada:", version);
      });

      // Background: fetch authoritative data from Supabase
      // Sprint G-2: si read_from_normalized está activo, lee missions+goals de tablas
      try {
        let base = await (isEnabled("read_from_normalized") ? loadFromNormalized(coupleId) : loadData(coupleId));
        let isRealData = !!base;
        let didMigrate = false;

        if (base) {
          if (!base.seedVersion || base.seedVersion < SEED_VERSION) {
            base = { ...SEED, settings: base.settings || SEED.settings, goals: base.goals || SEED.goals, weeks: { ...SEED.weeks, ...base.weeks }, seedVersion: SEED_VERSION };
            didMigrate = true;
          }
        } else {
          if (local?.data?.weeks && Object.keys(local.data.weeks).length > 1) {
            base = local.data; isRealData = true;
          } else {
            base = { ...SEED }; isRealData = false;
          }
        }

        if (!base.settings) base.settings = DEFAULT_SETTINGS;
        if (!base.goals) base.goals = SEED.goals;
        if (isTodayMonday()) base = applyCarryOver(base);
        const { data: repaired, moved: repairedCount } = repairMisplacedMissions(base);
        if (repairedCount > 0) { base = repaired; didMigrate = true; }
        setData(base);

        if (isRealData && didMigrate) await saveData(base, coupleId);
      } catch {
        // Only surface error if we have nothing to show (no local backup)
        if (!local?.data) {
          setError("No se pudo conectar con la base de datos. Comprueba tu conexión.");
          setData({ ...SEED });
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-launch tutorial on first visit
  useEffect(() => {
    if (!loading && coupleId && !localStorage.getItem("shared-cal-tutorial-v1")) {
      const t = setTimeout(() => setTutorialStep(0), 700);
      return () => clearTimeout(t);
    }
  }, [loading, coupleId]);

  // Navigate to tab when tutorial step changes
  useEffect(() => {
    if (tutorialStep !== null && TUTORIAL_STEPS[tutorialStep]?.tab) {
      setActiveTab(TUTORIAL_STEPS[tutorialStep].tab);
    }
  }, [tutorialStep]);

  const tutorialNext   = () => setTutorialStep(s => Math.min(s+1, TUTORIAL_STEPS.length-1));
  const tutorialFinish = () => { localStorage.setItem("shared-cal-tutorial-v1","done"); setTutorialStep(null); setActiveTab("home"); };
  const tutorialSkip   = () => { localStorage.setItem("shared-cal-tutorial-v1","done"); setTutorialStep(null); };

  // Keep notifSettingsRef current for use inside async callbacks
  useEffect(() => { notifSettingsRef.current = data?.settings?.notifications; }, [data?.settings?.notifications]);

  // Telemetry: expose coupleId globally + fire app_open once
  useEffect(() => {
    if (!coupleId) return;
    window.__mpCoupleId = coupleId;
    setTrackContext({ coupleId, userId: sessionUserId });
    track("app_open", { version: APP_VERSION });
  }, [coupleId]); // eslint-disable-line

  // Telemetry: track view changes
  useEffect(() => {
    if (!coupleId) return;
    track("view_changed", { view: activeTab });
  }, [activeTab, coupleId]);

  // Schedule event reminders whenever data changes
  useEffect(() => {
    if (!data || !notifGranted) return;
    scheduleReminders(data, data.settings?.person1||"Persona 1", data.settings?.person2||"Persona 2");
    return clearRTimers;
  }, [data, notifGranted]);

  // On data load: goal deadline reminders + daily briefing (#10)
  useEffect(() => {
    if (!data || !notifGranted) return;
    const ns = data.settings?.notifications || {};

    // Goal deadlines: notify 7 days, 1 day, and day-of
    if (ns.goalDeadlines) {
      const today = new Date(); today.setHours(0,0,0,0);
      (data.goals||[]).filter(g=>g.active!==false&&g.deadline).forEach(g=>{
        const days = Math.round((new Date(g.deadline)-today)/86400e3);
        const key = `gdl-${g.id}-${days}`;
        if ((days===7||days===1||days===0) && !localStorage.getItem(key)) {
          localStorage.setItem(key,"1");
          showNotif(`🏅 ${g.title}`, days===0?"¡Vence hoy!":days===1?"Vence mañana":"Vence en 7 días", {tag:key});
        }
      });
    }

    // Daily briefing (feature #10)
    let briefingTimer = null;
    if (ns.dailyBriefing) {
      const today = new Date(); const todayStr = today.toISOString().slice(0,10);
      const bKey = `briefing-${todayStr}`;
      const fireBriefing = () => {
        localStorage.setItem(bKey,"1");
        const allM = Object.values(data.weeks||{}).flatMap(w=>w.missions||[]);
        const ev = allM.filter(m=>m.date===todayStr&&m.type==="event").length;
        const tk = allM.filter(m=>m.date===todayStr&&m.type!=="event"&&m.status!=="DONE").length;
        const body = ev||tk ? [ev&&`${ev} evento${ev>1?"s":""}`, tk&&`${tk} tarea${tk>1?"s":""}`].filter(Boolean).join(" · ") : "Hoy no hay nada planeado 🌿";
        showNotif("☀️ Buenos días", body, {tag:"daily-briefing"});
      };
      if (!localStorage.getItem(bKey)) {
        const [bh,bm] = (ns.briefingTime||"08:00").split(":").map(Number);
        const fireAt = new Date(today); fireAt.setHours(bh,bm,0,0);
        if (today >= fireAt) {
          fireBriefing();
        } else {
          // Schedule within this session
          briefingTimer = setTimeout(fireBriefing, fireAt - today);
        }
      }
    }
    return () => { if (briefingTimer) clearTimeout(briefingTimer); };
  }, [data?.weeks, data?.goals, notifGranted]); // eslint-disable-line

  // Realtime: reload when partner saves (skipped if we have unsaved local changes)
  useEffect(() => {
    if (!coupleId) return;
    const channel = subscribeToUpdates(coupleId, remoteData => {
      // hasPendingSave guard in subscribeToUpdates ensures we only reach here when safe
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      setSavingState("idle");
      if (notifSettingsRef.current?.partnerChanges && document.visibilityState!=="visible") {
        showNotif("📅 Shared Calendar", "Tu pareja actualizó el calendario", {tag:"partner-update"});
      }
      if (isPushSupported() && !pushSubscribedRef.current && !pushNudgeDismissRef.current) {
        setPushNudgeVisible(true);
        setTimeout(() => setPushNudgeVisible(false), 8000);
      }
      setData(() => remoteData);
    }, {
      hasPendingSave: () => pendingSave || !!saveTimerRef.current,
    });
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId]);

  // Keep dataRef in sync so visibilitychange handler always has fresh data
  useEffect(() => { dataRef.current = data; }, [data]);

  // Flush debounced save immediately when app goes to background (iOS) or tab closes (desktop)
  useEffect(() => {
    const flushPendingSave = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        if (dataRef.current && coupleId && isValidAppData(dataRef.current)) {
          saveWithRetry(dataRef.current, coupleId, {
            retries: 1, baseDelay: 300,
            getLatestData: () => dataRef.current,
          }).catch(() => {});
        }
      }
    };
    const handleVisibilityChange = () => { if (document.visibilityState === "hidden") flushPendingSave(); };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushPendingSave);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushPendingSave);
    };
  }, [coupleId]);

  // Online/offline detection
  useEffect(() => {
    const up = () => setIsOnline(true);
    const dn = () => setIsOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", dn);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", dn); };
  }, []);

  // Retry pending save when reconnecting
  useEffect(() => {
    if (isOnline && pendingSave && data && coupleId && isValidAppData(data)) {
      saveWithRetry(data, coupleId, { getLatestData: () => dataRef.current })
        .then(() => { setPendingSave(false); setSyncError(null); showSyncMsg("✓ Cambios sincronizados"); })
        .catch(e => { setSyncError(e.message); showSyncMsg("⚠ Sin conexión — reintentando…"); });
    }
  }, [isOnline]); // eslint-disable-line

  useEffect(() => {
    if (!pushSupported) return;
    getCurrentSubscription().then(sub => setPushSubscribed(!!sub));
  }, [pushSupported]);
  useEffect(() => { pushSubscribedRef.current = pushSubscribed; }, [pushSubscribed]);
  const handlePushToggle = async () => {
    setPushLoading(true);
    setPushError(null);
    try {
      if (pushSubscribed) {
        await unsubscribePush();
        setPushSubscribed(false);
      } else {
        await subscribePush(coupleId);
        setPushSubscribed(true);
      }
    } catch (e) {
      const msg = e.message || 'Error al cambiar estado de notificaciones';
      setPushError(msg);
      pushToast({ kind: "error", text: msg });
    } finally {
      setPushLoading(false);
    }
  };

  const update = useCallback(fn => {
    setData(prev => {
      const next = fn(prev);
      if (!isValidAppData(next)) {
        // guard: skip save if state looks corrupt — but notify instead of silently dropping
        console.error("[save] isValidAppData failed — datos no guardados. Tamaño:", JSON.stringify(next).length);
        track("save_validation_failed", {
          size: JSON.stringify(next).length,
          keys: Object.keys(next || {}).join(",").slice(0, 100),
        });
        pushToast({ kind: "error", text: "⚠️ Error de validación — los cambios no se guardaron. Recarga la app si el problema persiste." });
        return next;
      }
      // Debounced save: 700ms after last change, with exponential backoff on failure
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        // CAS pre-check: si el flag está activo, intentar save atómico primero
        if (isEnabled("cas_version_check")) {
          saveWithCAS(coupleId, next, dataVersionRef.current).then(result => {
            if (result.success) {
              dataVersionRef.current = result.newVersion;
              console.debug("[CAS] save exitoso, nueva version:", result.newVersion);
            } else if (result.conflict) {
              console.warn("[CAS] conflicto de version — otro cliente se adelantó");
              track("cas_conflict", { couple_id: coupleId });
            }
            // Si casDisabled o error, el saveWithRetry normal ya se encarga
          });
        }
        saveWithRetry(next, coupleId, { getLatestData: () => dataRef.current })
          .then(() => { setSyncError(null); setPendingSave(false); setSavingState("saved"); setTimeout(() => setSavingState("idle"), 2000); })
          .catch(e => { setSyncError(e.message); setPendingSave(true); setSavingState("error"); showSyncMsg("⚠ Error al guardar — reintentando…"); });
      }, 700);
      return next;
    });
    setSavingState("saving");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId]);

  // These must be declared before any early return so useSwipe (which calls
  // useRef internally) is always called in the same order — Rules of Hooks.
  const changeWeek = d => update(s => { let wn=s.currentWeekNumber+d,yr=s.currentYear; if(wn>isoWeeksInYear(yr)){wn=1;yr++;} if(wn<1){yr--;wn=isoWeeksInYear(yr);} return {...s,currentWeekNumber:wn,currentYear:yr}; });
  const swipeWeek = useSwipe(() => changeWeek(1), () => changeWeek(-1));

  if (loading) return (
    <div style={{ background:"var(--t-bg,#0a0714)", minHeight:"100vh", fontFamily:"system-ui", padding:"16px 16px calc(24px + env(safe-area-inset-bottom))", maxWidth:640, margin:"0 auto" }}>
      <style>{`@keyframes sk-pulse{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ height:52, marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:99, background:"linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 75%)", backgroundSize:"200% 100%", animation:"sk-pulse 1.6s ease-in-out infinite" }} />
        <div style={{ flex:1, height:14, borderRadius:8, background:"linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 75%)", backgroundSize:"200% 100%", animation:"sk-pulse 1.6s ease-in-out infinite" }} />
      </div>
      <SkeletonDashboard />
    </div>
  );

  if (error) return (
    <div style={{ background:"#0a0714", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", color:"#f8f4ff", fontFamily:"system-ui", padding:20 }}>
      <div style={{ textAlign:"center", maxWidth:340 }}>
        <div style={{ fontSize:48, marginBottom:12 }}>⚠️</div>
        <div style={{ color:"#fb923c", fontSize:14, marginBottom:16 }}>{error}</div>
        <button onClick={() => window.location.reload()} style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:8, color:"#f8f4ff", padding:"8px 20px", cursor:"pointer", fontFamily:"inherit" }}>Reintentar</button>
      </div>
    </div>
  );

  const p1 = data.settings?.person1 || "Persona 1";
  const p2 = data.settings?.person2 || "Persona 2";
  const colors = { ...DEFAULT_COLORS, ...(data.settings?.colors||{}) };
  const _uprefs = getUserPrefs(sessionUserId);
  const themeId = localThemeId || _uprefs.themeId || data.settings?.themeId || "violet";
  const fontId  = localFontId  || _uprefs.fontId  || data.settings?.fontId  || "auto";
  const _activeTheme = THEMES.find(t => t.id === themeId) || THEMES[0];
  const toggleDarkLight = () => {
    const pair = _activeTheme.pair || (_activeTheme.dark ? "lavender" : "violet");
    setLocalThemeId(pair);
    if (sessionUserId) saveUserPrefs(sessionUserId, { themeId: pair });
  };
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importData(file);
      update(() => imported);
      setImportMsg("✅ Datos restaurados correctamente");
      setTimeout(() => setImportMsg(null), 2500);
    } catch (err) { setImportMsg("❌ " + err.message); setTimeout(() => setImportMsg(null), 3500); }
    e.target.value = "";
  };
  const wkey = isoWeekKey(data.currentWeekNumber, data.currentYear);
  const week = data.weeks[wkey] || { weekNumber:data.currentWeekNumber, year:data.currentYear, epicObjective:"", missions:[], createdAt:Date.now(), workHours:{person1:0,person2:0} };
  const patchWeek = fn => update(d => ({ ...d, weeks: { ...d.weeks, [wkey]: fn(d.weeks[wkey] || week) } }));

  const addMission = () => {
    if (!newM.title.trim()) return;
    const sid = newM.seriesPattern ? (newM.seriesId||uid()) : null;
    // Safety defaults so multi-day events always render even if user left
    // a time piece blank: endDate without endTime → 23:59, date without time
    // when an endDate is set → 00:00.
    const hasEnd = !!newM.endDate;
    const startTime = newM.time || (hasEnd ? "00:00" : null);
    const endTime   = hasEnd ? (newM.endTime || "23:59") : null;
    const isEv = newM.type === "event";
    patchWeek(w => ({ ...w, missions:[...(w.missions||[]), { id:uid(), emoji:newM.emoji, title:newM.title.trim(), status:newM.status, date:newM.date||null, time:startTime, endDate:newM.endDate||null, endTime, createdAt:Date.now(), completedAt:null, carriedFrom:null, carriedFromWeek:null, categories:newM.categories||[], who:newM.who, duration:newM.duration||null, goalId:newM.goalId||null, type:newM.type||"task", seriesPattern:newM.seriesPattern||null, seriesId:sid, seriesEndDate:newM.seriesEndDate||null, seriesStartWeek:sid?data.currentWeekNumber:null, seriesStartYear:sid?data.currentYear:null }] }));
    sendContextualPush(coupleId, { body:`${isEv?"Nuevo evento":"Nueva tarea"}: ${newM.emoji} ${newM.title.trim()}`, tag:isEv?"mp-event-add":"mp-mission-add" }, sessionUserId);
    setNewM({ emoji:"🎯", title:"", status:"TBC", date:"", time:"", endDate:"", endTime:"", categories:[], who:"together", duration:0, goalId:null, type:"task", seriesPattern:"", seriesEndDate:"", reminder:"none" });
    setShowAddForm(false);
  };

  const cycleStatus = id => {
    const wCur = data.weeks[wkey];
    const mCur = wCur?.missions?.find(x => x.id === id);
    const nx = mCur ? STATUS_ORDER[(STATUS_ORDER.indexOf(mCur.status)+1)%STATUS_ORDER.length] : null;
    update(d => {
      const w = d.weeks[wkey]; if (!w) return d;
      const m = w.missions.find(x=>x.id===id); if (!m) return d;
      const nxx = STATUS_ORDER[(STATUS_ORDER.indexOf(m.status)+1)%STATUS_ORDER.length];
      if (nxx==="DONE") track("mission_completed", { who: m.who, hasGoal: !!m.goalId, week: w.weekNumber });
      let next = { ...d, weeks: { ...d.weeks, [wkey]: { ...w, missions: w.missions.map(x => x.id===id ? {...x, status:nxx, completedAt:nxx==="DONE"?Date.now():null} : x) } } };
      if (nxx==="DONE" && m.carriedFrom) next = syncCarryDone(next, wkey, id);
      return next;
    });
    if (nx === "DONE" && mCur) sendContextualPush(coupleId, { body:`Completada: ${mCur.emoji||"🎯"} ${mCur.title}`, tag:"mp-mission-done" }, sessionUserId);
    if (nx) pushToast({ kind: "success", text: `${STATUS[nx].icon} ${STATUS[nx].label}` });
  };

  const delMission = id => patchWeek(w => ({ ...w, missions:w.missions.filter(m=>m.id!==id) }));
  const patchM = (id, patch) => patchWeek(w => ({ ...w, missions:w.missions.map(m=>m.id===id?{...m,...patch}:m) }));
  const { week:todayWeek, year:todayYear } = getWeekAndYear();
  const isCurrentWeek = data.currentWeekNumber===todayWeek && data.currentYear===todayYear;
  const goToToday = () => { update(s=>({...s,currentWeekNumber:todayWeek,currentYear:todayYear})); setActiveTab("current"); };
  const runCarryOver = () => update(d => applyCarryOver(d));
  const patchAllFutureSeries = (seriesId, fromWkey, patch) => {
    update(d => {
      const newWeeks = { ...d.weeks };
      for (const [wkey, w] of Object.entries(newWeeks)) {
        if (wkey < fromWkey) continue;
        newWeeks[wkey] = { ...w, missions: (w.missions||[]).map(m => m.seriesId === seriesId ? { ...m, ...patch } : m) };
      }
      return { ...d, weeks: newWeeks };
    });
  };
  const cycleStatusGlobal = (wn, yr, id) => {
    const key = isoWeekKey(wn, yr);
    const wCur = data.weeks[key];
    const mCur = wCur?.missions?.find(x => x.id === id);
    const nx = mCur ? STATUS_ORDER[(STATUS_ORDER.indexOf(mCur.status)+1)%STATUS_ORDER.length] : null;
    update(d => {
      const w = d.weeks[key]; if (!w) return d;
      const m = w.missions.find(x=>x.id===id); if (!m) return d;
      const nxx = STATUS_ORDER[(STATUS_ORDER.indexOf(m.status)+1)%STATUS_ORDER.length];
      if (nxx==="DONE") track("mission_completed", { who: m.who, hasGoal: !!m.goalId, week: w.weekNumber });
      let next = { ...d, weeks: { ...d.weeks, [key]: { ...w, missions: w.missions.map(x=>x.id===id?{...x,status:nxx,completedAt:nxx==="DONE"?Date.now():null}:x) } } };
      if (nxx==="DONE" && m.carriedFrom) next = syncCarryDone(next, key, id);
      return next;
    });
    if (nx) pushToast({ kind: "success", text: `${STATUS[nx].icon} ${STATUS[nx].label}` });
  };
  const patchMissionGlobal = (wn, yr, id, patch) => {
    const key = isoWeekKey(wn, yr);
    update(d => {
      const w = d.weeks[key]; if (!w) return d;
      return { ...d, weeks: { ...d.weeks, [key]: { ...w, missions: w.missions.map(x=>x.id===id?{...x,...patch}:x) } } };
    });
  };
  const deleteMissionGlobal = (wn, yr, id) => {
    const key = isoWeekKey(wn, yr);
    update(d => {
      const w = d.weeks[key]; if (!w) return d;
      return { ...d, weeks: { ...d.weeks, [key]: { ...w, missions: w.missions.filter(x=>x.id!==id) } } };
    });
  };
  const runRepair = () => {
    update(d => {
      const { data: fixed, moved } = repairMisplacedMissions(d);
      if (moved === 0) alert("✅ Todo en orden — ningún evento fuera de su semana.");
      else alert(`✅ ${moved} evento${moved>1?"s":""} reubicado${moved>1?"s":""} a su semana correcta.`);
      return fixed;
    });
  };

  const patchGoals = fn => update(d => ({ ...d, goals: fn(d.goals||[]) }));
  const addGoal = g => patchGoals(gs => [...gs, { ...g, id:uid(), active:true, createdAt:Date.now() }]);
  const updateGoal = (id, patch) => patchGoals(gs => gs.map(g => g.id===id ? {...g,...patch} : g));
  const deleteGoal = id => patchGoals(gs => gs.filter(g => g.id!==id));

  const compressImage = (file) => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const maxPx = 800;
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  const downloadWeekICS = (weekData, weekKey, name1, name2) => {
    const missions = weekData.missions || [];
    const dated = missions.filter(m => m.date);
    if (dated.length === 0) {
      alert("No hay misiones con fecha en esta semana. Abre cada misión, pulsa en ella y asigna una fecha para poder exportarla al calendario.");
      return;
    }
    const stamp = new Date().toISOString().replace(/[-:.]/g,"").slice(0,15)+"Z";
    const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Shared Calendar//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
    for (const m of dated) {
      const who = m.who==="person1"?name1:m.who==="person2"?name2:`${name1} & ${name2}`;
      const ds = m.date.replace(/-/g,"");
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${m.id}-${Date.now()}@misiones-pareja`);
      lines.push(`DTSTAMP:${stamp}`);
      if (m.time) {
        const ts = m.time.replace(":","")+"00";
        lines.push(`DTSTART:${ds}T${ts}`);
        const [hh,mm] = m.time.split(":").map(Number);
        const tot = hh*60+mm+(m.duration||60);
        const eh = String(Math.floor(tot/60)%24).padStart(2,"0"), em = String(tot%60).padStart(2,"0");
        lines.push(`DTEND:${ds}T${eh}${em}00`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${ds}`);
        const nd = new Date(m.date); nd.setDate(nd.getDate()+1);
        lines.push(`DTEND;VALUE=DATE:${nd.toISOString().slice(0,10).replace(/-/g,"")}`);
      }
      lines.push(`SUMMARY:${m.emoji} ${m.title}`);
      const parts = [`Semana ${weekData.weekNumber}`,`Estado: ${STATUS[m.status]?.label||m.status}`,`Quién: ${who}`];
      if (m.duration) parts.push(`Duración: ${Math.round(m.duration/60*10)/10}h`);
      lines.push(`DESCRIPTION:${parts.join("\\n")}`);
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type:"text/calendar;charset=utf-8" });
    dlBlob(blob,`misiones-${weekKey}.ics`);
  };

  const downloadRangeICS = () => {
    if (!icsFrom || !icsTo || icsFrom > icsTo) return;
    const missions = Object.values(data.weeks)
      .flatMap(w => (w.missions||[]).filter(m => m.date && m.date >= icsFrom && m.date <= icsTo))
      .sort((a,b) => a.date.localeCompare(b.date));
    if (missions.length === 0) { alert("No hay actividades con fecha en ese rango."); return; }
    const stamp = new Date().toISOString().replace(/[-:.]/g,"").slice(0,15)+"Z";
    const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Shared Calendar//ES","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
    for (const m of missions) {
      const who = m.who==="person1"?p1:m.who==="person2"?p2:`${p1} & ${p2}`;
      const ds = m.date.replace(/-/g,"");
      lines.push("BEGIN:VEVENT",`UID:${m.id}-${stamp}@sc`,`DTSTAMP:${stamp}`);
      if (m.time) {
        const ts = m.time.replace(":","")+"00";
        lines.push(`DTSTART:${ds}T${ts}`);
        const [hh,mm2] = m.time.split(":").map(Number);
        const tot = hh*60+mm2+(m.duration||60);
        lines.push(`DTEND:${ds}T${String(Math.floor(tot/60)%24).padStart(2,"0")}${String(tot%60).padStart(2,"0")}00`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${ds}`);
        const nd = new Date(m.date+"T00:00:00"); nd.setDate(nd.getDate()+1);
        lines.push(`DTEND;VALUE=DATE:${nd.toISOString().slice(0,10).replace(/-/g,"")}`);
      }
      lines.push(`SUMMARY:${m.emoji} ${m.title}`);
      lines.push(`DESCRIPTION:Estado: ${STATUS[m.status]?.label||m.status}\\nQuién: ${who}${m.duration?`\\nDuración: ${Math.round(m.duration/60*10)/10}h`:""}`);
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    dlBlob(new Blob([lines.join("\r\n")], {type:"text/calendar;charset=utf-8"}), `calendar-${icsFrom}-${icsTo}.ics`);
    setIcsModal(false);
  };

  const downloadWeekPDF = (weekData, weekKey, name1, name2) => {
    const missions = weekData.missions || [];
    const done = missions.filter(m=>m.status==="DONE").length;
    const sorted = [...missions].sort((a,b)=>{ if(a.date&&b.date) return (a.date+(a.time||""))>(b.date+(b.time||""))?1:-1; if(a.date)return -1; if(b.date)return 1; return 0; });
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Shared Calendar Semana ${weekData.weekNumber}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#fff;color:#1a1a2e;max-width:720px;margin:0 auto;padding:40px 32px}
h1{font-size:30px;font-weight:700;color:#6d28d9;margin-bottom:4px}
.meta{color:#888;font-size:13px;margin-bottom:20px}
.obj{background:#f5f0ff;border-left:4px solid #a78bfa;padding:10px 16px;border-radius:8px;margin-bottom:20px;font-style:italic;color:#4c1d95;font-size:15px}
.kpis{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap}
.kpi{background:#f8f4ff;padding:14px 20px;border-radius:12px;text-align:center;flex:1;min-width:80px}
.kpi-n{font-size:26px;font-weight:700;color:#7c3aed}
.kpi-l{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:2px}
.progress{background:#e9d5ff;border-radius:99px;height:8px;margin-bottom:24px;overflow:hidden}
.progress-bar{height:100%;background:linear-gradient(90deg,#7c3aed,#ec4899);border-radius:99px}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;padding:8px 10px;border-bottom:2px solid #f0e8ff}
td{padding:12px 10px;border-bottom:1px solid #f8f4ff;vertical-align:top}
.emoji{font-size:20px}
.title{font-size:14px;font-weight:600;color:#1a1a2e}
.title.done{text-decoration:line-through;color:#aaa}
.detail{font-size:12px;color:#888;margin-top:3px}
.badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600}
.DONE{background:#d1fae5;color:#065f46}
.ASAP{background:#ffedd5;color:#9a3412}
.IN_PROGRESS{background:#dbeafe;color:#1e40af}
.TBC{background:#f1f5f9;color:#475569}
.footer{margin-top:32px;text-align:center;font-size:11px;color:#ccc;border-top:1px solid #f0e8ff;padding-top:16px}
@media print{body{padding:20px}button{display:none!important}}
</style></head><body>
<h1>📅 Semana ${weekData.weekNumber} · ${weekData.year||new Date().getFullYear()}</h1>
<div class="meta">${name1} & ${name2} · Generado el ${new Date().toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
${weekData.epicObjective?`<div class="obj">🎯 ${weekData.epicObjective}</div>`:""}
<div class="kpis">
  <div class="kpi"><div class="kpi-n">${missions.length}</div><div class="kpi-l">Misiones</div></div>
  <div class="kpi"><div class="kpi-n">${done}</div><div class="kpi-l">Hechas</div></div>
  <div class="kpi"><div class="kpi-n">${missions.length>0?Math.round((done/missions.length)*100):0}%</div><div class="kpi-l">Progreso</div></div>
  ${missions.filter(m=>m.date).length>0?`<div class="kpi"><div class="kpi-n">${missions.filter(m=>m.date).length}</div><div class="kpi-l">Con fecha</div></div>`:""}
</div>
<div class="progress"><div class="progress-bar" style="width:${missions.length>0?Math.round((done/missions.length)*100):0}%"></div></div>
<table>
<thead><tr><th style="width:36px"></th><th>Misión</th><th>Cuándo</th><th>Quién</th><th>Estado</th></tr></thead>
<tbody>
${sorted.map(m=>{
  const who=m.who==="person1"?name1:m.who==="person2"?name2:"Juntos";
  const when=m.date?(m.time?`${m.date} ${m.time}`:m.date):"Sin fecha";
  const dur = m.duration;
  return `<tr><td class="emoji">${m.emoji}</td><td><div class="title${m.status==="DONE"?" done":""}">${m.title}</div>${dur?`<div class="detail">⏱ ${dur}h</div>`:""}</td><td style="font-size:13px;color:#555">${when}</td><td style="font-size:13px;color:#555">${who}</td><td><span class="badge ${m.status}">${STATUS[m.status]?.icon||""} ${STATUS[m.status]?.label||m.status}</span></td></tr>`;
}).join("")}
</tbody></table>
<div class="footer">📅 Shared Calendar</div>
</body></html>`;
    const win = window.open("","_blank");
    win.document.write(html);
    win.document.close();
    setTimeout(()=>{ win.print(); win.onafterprint = () => win.close(); }, 600);
  };

  const done = week.missions?.filter(m=>m.status==="DONE").length||0;
  const total = week.missions?.length||0;
  const carriedCount = week.missions?.filter(m=>m.carriedFrom).length||0;

  const pct = total>0?(done/total)*100:0;
  const allDated = Object.entries(data.weeks).flatMap(([key,w])=>(w.missions||[]).filter(m=>m.date).map(m=>({...m,weekNumber:w.weekNumber,_yr:parseInt(key.split("-W")[0])||w.year||new Date().getFullYear()})));

  return (
    <div style={{ minHeight:"100vh", overflowX:"hidden", background:"var(--t-bg,#0a0714)", backgroundImage:"var(--t-bg-grad)", fontFamily:"var(--t-font-body,'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif)", color:"var(--t-text,#f8f4ff)" }}>
      <ThemeInjector themeId={themeId} fontId={fontId} />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        *:focus { outline: none; }
        *:focus-visible { outline: 2px solid var(--t-accent,#a78bfa); outline-offset: 2px; border-radius: 4px; }
        .sc-nav-btn:focus-visible { outline: 2px solid var(--t-accent,#a78bfa); outline-offset: -2px; border-radius: 10px; }
        button:focus-visible, a:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--t-accent,#a78bfa); outline-offset: 2px; }
        @keyframes mc-pop { 0%{transform:scale(1)} 50%{transform:scale(1.28)} 100%{transform:scale(1)} }
        @keyframes sc-dot-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.75)} }
        @keyframes sc-saved-fade { 0%{opacity:1} 100%{opacity:0} }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* Hidden file input for import */}
      <input ref={importFileRef} type="file" accept=".json" onChange={handleImport} style={{ display:"none" }} />
      {/* Offline banner */}
      {!isOnline && <div style={{ position:"fixed", top:0, left:0, right:0, background:"rgba(30,20,10,0.97)", borderBottom:"1px solid rgba(251,146,60,0.4)", paddingTop:"calc(8px + env(safe-area-inset-top))", paddingBottom:8, paddingLeft:16, paddingRight:16, zIndex:500, display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#fdba74" }}>
        <span style={{ fontSize:16 }}>📡</span>
        <span style={{ flex:1 }}>Sin conexión · Los cambios se guardan localmente y se sincronizarán al reconectar</span>
        {pendingSave && <span style={{ fontSize:10, color:"#fb923c" }}>⏳ pendiente</span>}
      </div>}
      {isOnline && pendingSave && <div style={{ position:"fixed", top:0, left:0, right:0, background:"rgba(10,20,30,0.97)", borderBottom:"1px solid rgba(96,165,250,0.4)", paddingTop:"calc(6px + env(safe-area-inset-top))", paddingBottom:6, paddingLeft:16, paddingRight:16, zIndex:500, display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#60a5fa" }}>
        <span>🔄</span><span>Sincronizando cambios pendientes…</span>
      </div>}

      {importMsg && <div style={{ position:"fixed", bottom:90, left:"50%", transform:"translateX(-50%)", background:importMsg.startsWith("✅")?"rgba(52,211,153,0.15)":"rgba(251,146,60,0.15)", border:`1px solid ${importMsg.startsWith("✅")?"rgba(52,211,153,0.4)":"rgba(251,146,60,0.4)"}`, borderRadius:12, padding:"10px 20px", zIndex:400, fontSize:13, color:importMsg.startsWith("✅")?"#34d399":"#fb923c", whiteSpace:"nowrap", backdropFilter:"blur(8px)" }}>{importMsg}</div>}
      {pushNudgeVisible && pushSupported && !pushSubscribed && (
        <div style={{ position:"fixed", bottom:90, left:"50%", transform:"translateX(-50%)", background:"rgba(10,4,24,0.97)", border:"1px solid rgba(167,139,250,0.35)", borderRadius:14, padding:"12px 16px", zIndex:401, fontSize:13, maxWidth:320, width:"calc(100% - 40px)", backdropFilter:"blur(12px)", boxShadow:"0 4px 24px rgba(0,0,0,0.5)", display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:20, flexShrink:0 }}>🔔</span>
          <div style={{ flex:1, lineHeight:1.4 }}>
            <div style={{ color:"var(--t-text,#f8f4ff)", fontWeight:600, marginBottom:2 }}>Tu pareja acaba de actualizar algo</div>
            <div style={{ color:"var(--t-text-muted,#8b7fa8)", fontSize:12 }}>Activa notificaciones para enterarte aunque no estés en la app</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
            <button onClick={async () => { setPushNudgeVisible(false); await handlePushToggle(); }} style={{ background:"var(--t-btn-grad,linear-gradient(135deg,#f472b6,#a78bfa))", border:"none", borderRadius:8, color:"#fff", padding:"5px 12px", cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"inherit", whiteSpace:"nowrap" }}>Activar</button>
            <button onClick={() => { setPushNudgeVisible(false); pushNudgeDismissRef.current = true; }} style={{ background:"none", border:"none", color:"var(--t-text-muted,#8b7fa8)", cursor:"pointer", fontSize:11, fontFamily:"inherit", padding:"2px 0" }}>Ahora no</button>
          </div>
        </div>
      )}
      {syncMsg  && <div style={{ position:"fixed", bottom:syncMsg&&importMsg?130:90, left:"50%", transform:"translateX(-50%)", background:syncMsg.startsWith("⚠")?"rgba(251,146,60,0.15)":syncMsg.startsWith("✓")||syncMsg.startsWith("⬆")||syncMsg.startsWith("⬇")?"rgba(52,211,153,0.15)":"rgba(96,165,250,0.15)", border:`1px solid ${syncMsg.startsWith("⚠")?"rgba(251,146,60,0.4)":syncMsg.startsWith("✓")||syncMsg.startsWith("⬆")||syncMsg.startsWith("⬇")?"rgba(52,211,153,0.4)":"rgba(96,165,250,0.4)"}`, borderRadius:12, padding:"10px 20px", zIndex:400, fontSize:13, color:syncMsg.startsWith("⚠")?"#fb923c":syncMsg.startsWith("✓")||syncMsg.startsWith("⬆")||syncMsg.startsWith("⬇")?"#34d399":"#60a5fa", whiteSpace:"nowrap", backdropFilter:"blur(8px)" }}>{syncMsg}</div>}
      {syncError && !syncMsg && (
        <div style={{ position:"fixed", bottom:90, left:"50%", transform:"translateX(-50%)", background:"rgba(20,8,6,0.97)", border:"1px solid rgba(251,146,60,0.5)", borderRadius:12, padding:"10px 16px 10px 14px", zIndex:400, fontSize:12, color:"#fb923c", maxWidth:340, textAlign:"left", backdropFilter:"blur(8px)", display:"flex", alignItems:"flex-start", gap:8, boxShadow:"0 4px 24px rgba(0,0,0,0.5)" }}>
          <span style={{ flexShrink:0, fontSize:14 }}>⚠</span>
          <span style={{ flex:1, lineHeight:1.5, wordBreak:"break-word" }}>{syncError}</span>
          <button onClick={() => setSyncError(null)} style={{ flexShrink:0, background:"none", border:"none", color:"rgba(251,146,60,0.5)", cursor:"pointer", fontSize:16, padding:"0 0 0 4px", lineHeight:1 }}>×</button>
        </div>
      )}

      {showProfile && <ProfileModal data={data} update={update} onClose={()=>setShowProfile(false)} onStartTutorial={()=>{ setShowProfile(false); setTutorialStep(0); }} sessionUserId={sessionUserId} onCheckUpdate={checkUpdate} onThemeChange={(tid,fid)=>{ setLocalThemeId(tid); setLocalFontId(fid); }} pushSupported={pushSupported} pushSubscribed={pushSubscribed} pushLoading={pushLoading} pushError={pushError} onPushToggle={handlePushToggle} />}

      {/* ICS export date-range modal */}
      {icsModal && <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setIcsModal(false)}>
        <div style={{background:"var(--t-card,#1d1733)",border:"1px solid var(--t-card-border,rgba(167,139,250,0.35))",borderRadius:16,padding:22,width:"100%",maxWidth:380}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <span style={{fontFamily:"'Fraunces',serif",fontSize:18,color:"var(--t-text,#f8f4ff)"}}>📅 Exportar a Google Calendar</span>
            <button onClick={()=>setIcsModal(false)} style={{background:"none",border:"none",color:"var(--t-text-dim,#6b5f88)",fontSize:20,cursor:"pointer"}}>×</button>
          </div>
          {/* Quick select */}
          <div style={S.label}>Selección rápida</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
            {[
              ["Esta semana", ()=>{ const {week:tw,year:ty}=getWeekAndYear(); const mon=weekStartDate(tw,ty); const sun=new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+6); setIcsFrom(mon.toISOString().slice(0,10)); setIcsTo(sun.toISOString().slice(0,10)); }],
              ["Este mes",    ()=>{ const n=new Date(); setIcsFrom(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`); setIcsTo(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${new Date(n.getFullYear(),n.getMonth()+1,0).getDate()}`); }],
              ["Próx. 4 sem.",()=>{ const n=new Date(),t=new Date(n); t.setDate(n.getDate()+28); setIcsFrom(n.toISOString().slice(0,10)); setIcsTo(t.toISOString().slice(0,10)); }],
              ["Próx. 3 meses",()=>{ const n=new Date(),t=new Date(n); t.setMonth(n.getMonth()+3); setIcsFrom(n.toISOString().slice(0,10)); setIcsTo(t.toISOString().slice(0,10)); }],
            ].map(([l,fn])=>(
              <button key={l} onClick={fn} style={{background:"var(--t-accent-soft,rgba(167,139,250,0.1))",border:"1px solid var(--t-card-border)",borderRadius:7,color:"var(--t-text-muted,#8b7fa8)",padding:"5px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>{l}</button>
            ))}
          </div>
          {/* Date pickers */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            <div><label style={S.label}>Desde</label><input type="date" value={icsFrom} onChange={e=>setIcsFrom(e.target.value)} style={{...S.inputSm,colorScheme:"dark"}} /></div>
            <div><label style={S.label}>Hasta</label><input type="date" value={icsTo}   onChange={e=>setIcsTo(e.target.value)}   style={{...S.inputSm,colorScheme:"dark"}} /></div>
          </div>
          {/* Preview count */}
          {icsFrom&&icsTo&&icsFrom<=icsTo&&<div style={{fontSize:12,color:"var(--t-text-dim,#6b5f88)",textAlign:"center",marginBottom:12}}>
            {Object.values(data.weeks).flatMap(w=>(w.missions||[]).filter(m=>m.date&&m.date>=icsFrom&&m.date<=icsTo)).length} actividades en ese rango
          </div>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setIcsModal(false)} style={S.btnSecondary}>Cancelar</button>
            <button onClick={downloadRangeICS} disabled={!icsFrom||!icsTo||icsFrom>icsTo} style={{...S.btnPrimary,flex:1,opacity:(!icsFrom||!icsTo||icsFrom>icsTo)?0.4:1}}>⬇ Descargar .ics</button>
          </div>
        </div>
      </div>}

      {/* Changelog modal */}
      {showChangelog && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={()=>setShowChangelog(false)}>
          <div style={{ background:"var(--t-card,#1d1733)", border:"1px solid rgba(251,191,36,0.3)", borderRadius:18, padding:24, width:"100%", maxWidth:420, maxHeight:"80vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <span style={{ fontFamily:"'Fraunces',serif", fontSize:20, color:"var(--t-accent,#fbbf24)" }}>📋 Changelog</span>
              <button onClick={()=>setShowChangelog(false)} style={{ background:"none", border:"none", color:"var(--t-text-muted,#6b5f88)", fontSize:20, cursor:"pointer" }}>×</button>
            </div>
            {CHANGELOG.map(c=>(
              <div key={c.v} style={{ marginBottom:16 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"var(--t-accent,#fbbf24)" }}>v{c.v}</span>
                  <span style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)" }}>{c.date}</span>
                </div>
                <ul style={{ margin:0, padding:"0 0 0 16px" }}>
                  {c.notes.map((n,i)=><li key={i} style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)", marginBottom:3 }}>{n}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Slide-out menu backdrop */}
      {menuOpen && <div onClick={()=>setMenuOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:90, backdropFilter:"blur(3px)", WebkitBackdropFilter:"blur(3px)" }} />}

      {/* Slide-out menu */}
      <div style={{ position:"fixed", top:0, left:0, bottom:0, width:248, background:"var(--t-menu-bg,rgba(12,8,26,0.97))", borderRight:"1px solid var(--t-card-border,rgba(167,139,250,0.1))", zIndex:100, transform:menuOpen?"translateX(0)":"translateX(-100%)", transition:"transform 0.26s cubic-bezier(0.4,0,0.2,1)", display:"flex", flexDirection:"column", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)" }}>
        {/* Menu header */}
        <div style={{ paddingTop:"calc(18px + env(safe-area-inset-top))", paddingLeft:20, paddingRight:20, paddingBottom:14, borderBottom:"1px solid var(--t-card-border,rgba(167,139,250,0.07))", display:"flex", alignItems:"center", gap:12 }}>
          {data.settings?.photos?.couple
            ? <img src={data.settings.photos.couple} style={{ width:44, height:44, borderRadius:99, objectFit:"cover", border:"2px solid var(--t-accent,#a78bfa)", flexShrink:0 }} alt="pareja" />
            : <div style={{ width:44, height:44, borderRadius:99, background:"var(--t-accent-soft,rgba(167,139,250,0.1))", border:"1px solid var(--t-card-border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{data.settings?.coupleEmoji||"💞"}</div>
          }
          <div>
            <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", letterSpacing:1.5, textTransform:"uppercase" }}>Shared Calendar</div>
            <div style={{ fontSize:14, color:"var(--t-accent,#c4b8ff)", fontWeight:600, marginTop:1 }}>{p1} & {p2}</div>
          </div>
        </div>
        {/* Nav items */}
        <nav aria-label="Navegación principal" style={{ flex:1, padding:"10px 8px", display:"flex", flexDirection:"column", gap:2, overflowY:"auto" }}>
          {[
            { id:"home",     label:"Inicio",         icon:"🏠" },
            { id:"current",  label:"Semana",          icon:"🎯" },
            { id:"pending",  label:"Pendientes",      icon:"📋" },
            { id:"calendar", label:"Calendario",      icon:"📅" },
            { id:"history",  label:"Histórico",       icon:"🗂️" },
            { id:"goals",    label:"Metas",           icon:"🏅" },
            { id:"stats",    label:"Stats",           icon:"📊" },
            { id:"gastos",   label:"Gastos",          icon:"💸" },
            { id:"chat",     label:"Chat",            icon:"💬" },
            { id:"links",    label:"Links de Interés", icon:"🔗" },
          ].map(n => (
            <button key={n.id} onClick={()=>{ setActiveTab(n.id); setMenuOpen(false); }}
              aria-label={n.label} aria-current={activeTab===n.id ? "page" : undefined}
              className="sc-nav-btn"
              style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:10, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:activeTab===n.id?600:400, background:activeTab===n.id?"var(--t-accent-soft,rgba(167,139,250,0.14))":"transparent", color:activeTab===n.id?"var(--t-accent,#c4b8ff)":"var(--t-text-muted,#6b5f88)", textAlign:"left", width:"100%", transition:"all 0.15s", position:"relative" }}>
              <span aria-hidden="true" style={{ fontSize:17, lineHeight:1 }}>{n.icon}</span>
              <span style={{ flex:1 }}>{n.label}</span>
              {activeTab===n.id && <span aria-hidden="true" style={{ width:5, height:5, borderRadius:99, background:"var(--t-accent,#a78bfa)", flexShrink:0 }} />}
            </button>
          ))}
        </nav>
        {/* Menu footer: version only — always visible, no scroll needed */}
        <div style={{ padding:"12px 16px", borderTop:"1px solid var(--t-card-border,rgba(167,139,250,0.07))", flexShrink:0 }}>
          {syncMsg && <div style={{ fontSize:10, color:syncMsg.startsWith("⚠")?"#fb923c":syncMsg.startsWith("✓")?"#34d399":"#60a5fa", marginBottom:6, lineHeight:1.4 }}>{syncMsg}</div>}
          <button onClick={()=>{ setShowChangelog(true); setMenuOpen(false); }}
            style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 0", display:"flex", gap:8, alignItems:"center", width:"100%" }}>
            <span style={{ fontSize:11, fontWeight:700, color:"#fbbf24", letterSpacing:0.5, textShadow:"0 0 8px rgba(251,191,36,0.35)" }}>v{APP_VERSION}</span>
            <span style={{ fontSize:10, color:"var(--t-text-dim,#3d3360)" }}>{LAST_UPDATE}</span>
            <span style={{ fontSize:10, color:"var(--t-text-dim,#3d3360)", marginLeft:"auto" }}>Ver cambios →</span>
          </button>
        </div>
      </div>

      {/* ── Sticky top bar ── */}
      <div style={{ position:"sticky", top:0, zIndex:80, background:"var(--t-topbar-bg,rgba(10,7,20,0.9))", backdropFilter:"blur(14px)", WebkitBackdropFilter:"blur(14px)", borderBottom:"1px solid var(--t-card-border,rgba(167,139,250,0.08))", paddingTop:"env(safe-area-inset-top)" }}>
      <div style={{ height:52, display:"flex", alignItems:"center", gap:8, paddingLeft:12, paddingRight:12 }}>
        {/* Hamburger */}
        <button onClick={()=>setMenuOpen(v=>!v)} aria-label="Menú"
          style={{ background:"none", border:"none", cursor:"pointer", color:"var(--t-text-muted,#8b7fa8)", padding:"8px 6px", display:"flex", flexDirection:"column", gap:4, alignItems:"center", justifyContent:"center", flexShrink:0, borderRadius:8 }}>
          <span style={{ display:"block", width:18, height:1.5, background:"currentColor", borderRadius:99 }} />
          <span style={{ display:"block", width:13, height:1.5, background:"currentColor", borderRadius:99 }} />
          <span style={{ display:"block", width:18, height:1.5, background:"currentColor", borderRadius:99 }} />
        </button>
        {/* Home button */}
        <button onClick={()=>setActiveTab("home")} aria-label="Inicio"
          style={{ background:"none", border:"none", cursor:"pointer", color:activeTab==="home"?"#c4b8ff":"#4a4166", fontSize:18, padding:"6px 5px", lineHeight:1, borderRadius:8, flexShrink:0, transition:"color 0.15s" }}>🏠</button>
        {/* Page title */}
        <div style={{ flex:1, textAlign:"center" }}>
          {activeTab==="home"
            ? <Brand size={22} wordmark colors={colors} />
            : <span style={{ fontSize:13, fontWeight:500, color:"var(--t-text-muted,#8b7fa8)" }}>
                {activeTab==="current"  ? `🎯 Semana ${data.currentWeekNumber}`
                :activeTab==="pending"  ? "📋 Pendientes"
                :activeTab==="calendar" ? "Calendario"
                :activeTab==="history"  ? "🗂️ Histórico"
                :activeTab==="goals"    ? "🏅 Metas"
                :activeTab==="stats"    ? "📊 Stats"
                :activeTab==="gastos"   ? "💸 Gastos Compartidos"
                :activeTab==="chat"     ? "💬 Chat"
                :activeTab==="links"    ? "🔗 Links de Interés"
                : ""}
              </span>
          }
        </div>
        {/* Saving indicator dot — tappable when error to show detail */}
        {savingState !== "idle" && (
          <div
            role={savingState === "error" ? "button" : undefined}
            onClick={savingState === "error" ? () => forcePush() : undefined}
            title={savingState === "saving" ? "Guardando…" : savingState === "saved" ? "Guardado ✓" : "Error al guardar — toca para reintentar"}
            aria-label={savingState === "saving" ? "Guardando…" : savingState === "saved" ? "Guardado" : "Error al guardar — toca para reintentar"}
            style={{ width:savingState==="error"?20:7, height:savingState==="error"?20:7, borderRadius:99, flexShrink:0, cursor:savingState==="error"?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center",
              background: savingState === "saving" ? "#a78bfa" : savingState === "saved" ? "#34d399" : "rgba(248,113,113,0.15)",
              border: savingState === "error" ? "1.5px solid #f87171" : "none",
              animation: savingState === "saving" ? "sc-dot-pulse 1s ease-in-out infinite" : savingState === "saved" ? "sc-saved-fade 2s ease-out 0.5s forwards" : "none",
              boxShadow: savingState === "saving" ? "0 0 6px rgba(167,139,250,0.6)" : savingState === "saved" ? "0 0 6px rgba(52,211,153,0.6)" : "0 0 4px rgba(248,113,113,0.4)",
            }}>
            {savingState === "error" && <span style={{ fontSize:11, color:"#f87171", lineHeight:1 }}>!</span>}
          </div>
        )}
        {/* Dark/light toggle */}
        <button onClick={toggleDarkLight} aria-label={_activeTheme.dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
          title={_activeTheme.dark ? "Modo claro" : "Modo oscuro"}
          style={{ background:"none", border:"none", cursor:"pointer", color:"var(--t-text-muted,#8b7fa8)", fontSize:16, padding:"6px 5px", lineHeight:1, borderRadius:8, flexShrink:0 }}>
          <span aria-hidden="true">{_activeTheme.dark ? "☀️" : "🌙"}</span>
        </button>
        {/* Overflow menu ⋯ */}
        <div style={{ position:"relative", flexShrink:0 }}>
          <OverflowButton onClick={() => setPopOpen(o => !o)} />
          <OverflowMenu open={popOpen} onClose={() => setPopOpen(false)} items={[
            { icon:"↻", label:"Actualizar versión", onClick: checkUpdate },
            { icon:"⬆", label: syncing ? "Subiendo…" : "Subir datos a Supabase", onClick: () => { forcePush(); setPopOpen(false); } },
            { icon:"🔄", label: syncing ? "Sincronizando…" : "Bajar datos de Supabase", onClick: () => { forceSync(); setPopOpen(false); } },
            { divider: true },
            { icon:"📅", label:"Exportar a Google Calendar (.ics)", onClick: () => downloadWeekICS(week, wkey, p1, p2) },
            { icon:"🖨", label:"Imprimir / PDF", onClick: () => downloadWeekPDF(week, wkey, p1, p2) },
          ]} />
        </div>
        {/* Settings dropdown trigger */}
        <div style={{ position:"relative", flexShrink:0 }}>
          <button onClick={()=>setSettingsMenuOpen(v=>!v)} aria-label="Ajustes"
            style={{ background:"rgba(128,128,128,0.06)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.15))", borderRadius:8, color:"var(--t-text-dim,#6b5f88)", width:34, height:34, cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>⚙️</button>
          {settingsMenuOpen && <>
            <div onClick={()=>setSettingsMenuOpen(false)} style={{ position:"fixed", inset:0, zIndex:110 }} />
            <div style={{ position:"absolute", top:40, right:0, background:"var(--t-menu-bg,rgba(12,8,26,0.98))", border:"1px solid var(--t-card-border,rgba(167,139,250,0.15))", borderRadius:12, padding:"6px 0", zIndex:120, minWidth:180, backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", boxShadow:"0 8px 32px rgba(0,0,0,0.5)" }}>
              {[
                { icon:"👤", label:"Mi perfil",  action:()=>{ setShowProfile(true); setSettingsMenuOpen(false); } },
                { icon:"📥", label:"Exportar",   action:()=>{ exportData(data); setSettingsMenuOpen(false); } },
                { icon:"📤", label:"Importar",   action:()=>{ importFileRef.current?.click(); setSettingsMenuOpen(false); } },
                { icon:"🔄", label:syncing?"Sincronizando…":"Actualizar datos", action:()=>{ forceSync(); setSettingsMenuOpen(false); } },
              ].map((item,i)=>(
                <button key={i} onClick={item.action}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 16px", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, color:"#c4b8ff", width:"100%", textAlign:"left", transition:"background 0.12s" }}
                  onMouseEnter={e=>e.currentTarget.style.background="var(--t-accent-soft,rgba(167,139,250,0.1))"}
                  onMouseLeave={e=>e.currentTarget.style.background="none"}>
                  <span style={{ fontSize:15 }}>{item.icon}</span>{item.label}
                </button>
              ))}
              <div style={{ height:1, background:"var(--t-card-border,rgba(167,139,250,0.1))", margin:"4px 0" }} />
              <button onClick={()=>{ onSignOut(); setSettingsMenuOpen(false); }}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 16px", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, color:"#f472b6", width:"100%", textAlign:"left" }}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(244,114,182,0.08)"}
                onMouseLeave={e=>e.currentTarget.style.background="none"}>
                <span style={{ fontSize:15 }}>🚪</span>Cerrar sesión
              </button>
            </div>
          </>}
        </div>
      </div></div>{/* end inner 52px row + safe-area wrapper */}

      <div style={{ maxWidth:640, margin:"0 auto", padding:"18px 16px", paddingBottom:"calc(120px + env(safe-area-inset-bottom))" }}>

        {/* Global filters — show only for tabs that need them */}
        {(activeTab==="current"||activeTab==="calendar"||activeTab==="history"||activeTab==="pending") && (() => {
          const filterCount = globalPersonFilter.length + globalCatFilter.length;
          return (
            <div style={{ marginBottom:12 }}>
              <FilterButton count={filterCount} onClick={() => setFiltersOpen(true)} />
            </div>
          );
        })()}
        <FilterDrawer
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          filters={{ who: globalPersonFilter, cat: globalCatFilter }}
          setFilters={f => {
            setGlobalPersonFilter(f.who);
            setGlobalCatFilter(f.cat);
          }}
          persons={[
            { id:"person1",  name:p1,      emoji:"🙋", color:colors.person1 },
            { id:"person2",  name:p2,      emoji:"🙋", color:colors.person2 },
            { id:"together", name:"Juntos", emoji:"👫", color:colors.together },
          ]}
          categories={CATEGORIES.map(c => ({ id:c.id, label:c.label, emoji:c.icon, color:c.color }))}
        />

        {/* ── HOME ── */}
        {activeTab==="home" && (() => {
          const { week:todayWn, year:todayYr } = getWeekAndYear(new Date());
          const todayWkey = isoWeekKey(todayWn, todayYr);
          const todayWeekData = data.weeks[todayWkey] || { missions:[], epicObjective:"" };
          return (
            <HomeDashboard
              week={{ week: todayWn, year: todayYr, epicGoal: todayWeekData.epicObjective, label: fmtWeekRange(todayWn, todayYr) }}
              missions={todayWeekData.missions || []}
              goals={data.goals || []}
              colors={colors}
              p1={p1} p2={p2}
              photo={data.settings?.photos?.couple}
              p1Photo={data.settings?.photos?.person1}
              p2Photo={data.settings?.photos?.person2}
              onCycleStatus={id => cycleStatusGlobal(todayWn, todayYr, id)}
              onMissionPatch={(id, patch) => patchMissionGlobal(todayWn, todayYr, id, patch)}
              onDeleteMission={id => deleteMissionGlobal(todayWn, todayYr, id)}
              weeksData={data.weeks}
              pushSupported={pushSupported}
              pushSubscribed={pushSubscribed}
              onActivatePush={handlePushToggle}
            />
          );
        })()}

        {/* Current Week */}
        {activeTab==="current" && <div {...swipeWeek}>
          {/* Week navigation */}
          <div style={{ textAlign:"center", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:14, marginBottom:week.epicObjective?4:8 }}>
              <button onClick={()=>changeWeek(-1)} style={S.btnNav}>‹</button>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:36, fontWeight:700, lineHeight:1, letterSpacing:-1 }}>Semana {data.currentWeekNumber}</div>
                <div style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)", marginTop:4 }}>{fmtWeekRange(data.currentWeekNumber, data.currentYear)}</div>
                <div style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)", marginTop:2 }}>Hoy: {fmtShortDate(new Date())}</div>
              </div>
              <button onClick={()=>changeWeek(1)} style={S.btnNav}>›</button>
            </div>
            <div style={{ marginBottom:6, minHeight:22 }}>
              {editObj
                ? <input autoFocus value={week.epicObjective} onChange={e=>patchWeek(w=>({...w,epicObjective:e.target.value}))} onBlur={()=>setEditObj(false)} onKeyDown={e=>e.key==="Enter"&&setEditObj(false)} placeholder="¿Cuál es la misión épica de la semana?" style={{ background:"transparent", border:"none", borderBottom:"1px solid rgba(244,114,182,0.4)", color:"#f472b6", fontSize:14, fontFamily:"'Fraunces',serif", fontWeight:300, fontStyle:"italic", textAlign:"center", width:"80%", outline:"none", padding:"2px 0" }} />
                : <div onClick={()=>setEditObj(true)} style={{ cursor:"text", fontSize:14, fontFamily:"'Fraunces',serif", fontWeight:300, fontStyle:"italic", color:week.epicObjective?"#f472b6":"#3d3360", textAlign:"center" }}>
                    {week.epicObjective ? `"${week.epicObjective}"` : <span style={{ fontSize:11, color:"#2d2450" }}>+ objetivo épico de la semana</span>}
                  </div>
              }
            </div>
            {!isCurrentWeek && (
              <button onClick={goToToday} style={{ background:"rgba(244,114,182,0.1)", border:"1px solid rgba(244,114,182,0.25)", borderRadius:99, color:"#f472b6", fontSize:11, fontWeight:600, padding:"4px 14px", cursor:"pointer", fontFamily:"inherit", marginBottom:6 }}>📍 Volver a hoy</button>
            )}
            {total>0 && <>
              <div style={{ background:"rgba(128,128,128,0.10)", borderRadius:99, height:5, overflow:"hidden", margin:"8px 24px 0" }}>
                <div style={{ height:"100%", width:`${pct}%`, background:"linear-gradient(90deg,#f472b6,#a78bfa)", borderRadius:99, transition:"width 0.6s" }} />
              </div>
              <div style={{ fontSize:11, color:"var(--t-text-muted,#8b7fa8)", marginTop:5 }}>{done} de {total} completadas {pct===100?"🎉":`(${Math.round(pct)}%)`}</div>
            </>}
          </div>
          {carriedCount>0 && <div style={{ background:"rgba(251,146,60,0.1)", border:"1px solid rgba(251,146,60,0.25)", borderRadius:12, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:10, fontSize:13 }}>
            <span style={{ fontSize:20 }}>🔁</span>
            <span style={{ color:"#fdba74" }}><strong>{carriedCount} misión{carriedCount>1?"es":""}</strong> arrastrada{carriedCount>1?"s":""} de la semana anterior</span>
          </div>}
          <WorkHoursCard week={week} patchWeek={patchWeek} p1={p1} p2={p2} />
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginBottom:4 }}>
            <button onClick={runCarryOver} style={{ background:"none", border:"none", color:"var(--t-text-dim,#4a4166)", fontSize:11, cursor:"pointer", fontFamily:"inherit", padding:"2px 4px" }}
              onMouseEnter={e=>e.currentTarget.style.color="#a78bfa"} onMouseLeave={e=>e.currentTarget.style.color="#4a4166"}>🔁 Recuperar tareas pendientes</button>
            <button onClick={runRepair} style={{ background:"none", border:"none", color:"var(--t-text-dim,#4a4166)", fontSize:11, cursor:"pointer", fontFamily:"inherit", padding:"2px 4px" }}
              onMouseEnter={e=>e.currentTarget.style.color="#60a5fa"} onMouseLeave={e=>e.currentTarget.style.color="#4a4166"}>📅 Distribuir eventos</button>
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:6, marginBottom:6 }}>
            {!showAddForm && <>
              <button onClick={()=>{ setNewM(p=>({...p,type:"task",emoji:"🎯"})); setShowAddForm(true); }}
                style={{ background:"rgba(167,139,250,0.1)", border:"1px solid rgba(167,139,250,0.25)", borderRadius:99, color:"var(--t-accent,#a78bfa)", cursor:"pointer", fontSize:12, fontFamily:"inherit", padding:"5px 13px", display:"flex", alignItems:"center", gap:5 }}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(167,139,250,0.2)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(167,139,250,0.1)"}>
                ✅ + Tarea
              </button>
              <button onClick={()=>{ setNewM(p=>({...p,type:"event",emoji:"📅"})); setShowAddForm(true); }}
                style={{ background:"rgba(96,165,250,0.08)", border:"1px solid rgba(96,165,250,0.22)", borderRadius:99, color:"#60a5fa", cursor:"pointer", fontSize:12, fontFamily:"inherit", padding:"5px 13px", display:"flex", alignItems:"center", gap:5 }}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(96,165,250,0.18)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(96,165,250,0.08)"}>
                📅 + Evento
              </button>
            </>}
          </div>
          {showAddForm&&<AddMissionForm newM={newM} setNewM={setNewM} onAdd={addMission} onCancel={()=>setShowAddForm(false)} p1={p1} p2={p2} goals={data.goals||[]} />}
          {/* View mode + Sort bar */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:8, flexWrap:"wrap" }}>
            <div style={{ display:"flex", gap:4 }}>
              {[["timeline","⏱ Timeline"],["list","☰ Lista detallada"]].map(([v,l])=>(
                <button key={v} onClick={()=>setWeekViewMode(v)} style={{ background:weekViewMode===v?"rgba(167,139,250,0.18)":"rgba(128,128,128,0.05)", border:`1px solid ${weekViewMode===v?"rgba(167,139,250,0.4)":"rgba(255,255,255,0.07)"}`, borderRadius:99, color:weekViewMode===v?"#c4b8ff":"#4a4166", padding:"3px 11px", cursor:"pointer", fontSize:10, fontFamily:"inherit", fontWeight:weekViewMode===v?600:400 }}>{l}</button>
              ))}
            </div>
            {weekViewMode==="list" && <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
              <span style={{ fontSize:9, color:"var(--t-text-dim,#3d3360)", letterSpacing:1.5, textTransform:"uppercase", fontWeight:600 }}>↕️</span>
              {[["default","Por defecto"],["chrono","Cronológico"],["type","Tipo"],["who","Persona"],["status","Estado"]].map(([v,l])=>(
                <button key={v} onClick={()=>setWeekSort(v)} style={{ background:weekSort===v?"rgba(167,139,250,0.18)":"rgba(128,128,128,0.05)", border:`1px solid ${weekSort===v?"rgba(167,139,250,0.4)":"rgba(255,255,255,0.07)"}`, borderRadius:99, color:weekSort===v?"#c4b8ff":"#4a4166", padding:"2px 9px", cursor:"pointer", fontSize:10, fontFamily:"inherit", fontWeight:weekSort===v?600:400 }}>{l}</button>
              ))}
            </div>}
          </div>
          {weekViewMode==="timeline" ? (() => {
            const mon = weekStartDate(data.currentWeekNumber, data.currentYear);
            const weekDays = Array.from({ length:7 }, (_, i) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate()+i));
            const filtered=(week.missions||[]).filter(m=>(!globalPersonFilter.length||globalPersonFilter.includes(m.who))&&(!globalCatFilter.length||getMCats(m).some(c=>globalCatFilter.includes(c))));
            return <WeekTimeline missions={filtered} weekDays={weekDays} renderCard={m=><MissionCard key={m.id} mission={m} p1={p1} p2={p2} colors={colors} goals={data.goals||[]} weeksData={data.weeks} onCycleStatus={()=>cycleStatus(m.id)} onDelete={()=>delMission(m.id)} onPatch={p=>patchM(m.id,p)} />} />;
          })() : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {(()=>{
              const filtered=(week.missions||[]).filter(m=>(!globalPersonFilter.length||globalPersonFilter.includes(m.who))&&(!globalCatFilter.length||getMCats(m).some(c=>globalCatFilter.includes(c))));
              const sorted=[...filtered].sort((a,b)=>{
                if(weekSort==="chrono"){const da=a.date?a.date+"T"+(a.time||"00:00"):"9999";const db=b.date?b.date+"T"+(b.time||"00:00"):"9999";return da.localeCompare(db);}
                if(weekSort==="type"){const ta=a.type==="event"?0:1;const tb=b.type==="event"?0:1;return ta-tb;}
                if(weekSort==="who"){const wo=["person1","person2","together"];return wo.indexOf(a.who||"together")-wo.indexOf(b.who||"together");}
                if(weekSort==="status"){return STATUS_ORDER.indexOf(a.status)-STATUS_ORDER.indexOf(b.status);}
                return 0;
              });
              return sorted.map(m=>(
                <MissionCard key={m.id} mission={m} p1={p1} p2={p2} colors={colors} goals={data.goals||[]} weeksData={data.weeks} onCycleStatus={()=>cycleStatus(m.id)} onDelete={()=>delMission(m.id)} onPatch={p=>patchM(m.id,p)} />
              ));
            })()}
          </div>}
        </div>}

        {activeTab==="calendar" && <CalendarView
          allDatedMissions={allDated} p1={p1} p2={p2} colors={colors} personFilter={globalPersonFilter} catFilter={globalCatFilter} goals={data.goals||[]}
          onPatchMission={patchMissionGlobal} onDeleteMission={deleteMissionGlobal} onPatchAllFutureSeries={patchAllFutureSeries}
          onAddForDay={(date) => {
            const { week:wn, year:yr } = getWeekAndYear(new Date(date));
            update(s => ({...s, currentWeekNumber:wn, currentYear:yr}));
            setNewM(p=>({...p, date, type:"event", emoji:"📅"}));
            setShowAddForm(true); setActiveTab("current");
          }}
          onCycleStatus={cycleStatusGlobal}
        />}

        {activeTab==="history" && (() => {
          const { week:_htw, year:_hty } = getWeekAndYear();
          const _htodayKey = isoWeekKey(_htw, _hty);
          const allHistSorted = Object.entries(data.weeks).filter(([key])=>key<=_htodayKey).sort((a,b)=>b[0].localeCompare(a[0]));
          const histFiltered = histWeekRange==="all" ? allHistSorted : allHistSorted.slice(0, parseInt(histWeekRange));
          const filterHM = ms => ms.filter(m=>(!globalPersonFilter.length||globalPersonFilter.includes(m.who))&&(!globalCatFilter.length||getMCats(m).some(c=>globalCatFilter.includes(c))));
          return (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {/* Filter bar */}
            <div style={{ ...S.card, padding:"10px 14px" }}>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                <div>
                  <div style={S.label}>Semanas</div>
                  <div style={{ display:"flex", gap:3 }}>
                    {[["all","Todas"],["1","Esta sem."],["4","4 últ."],["8","8 últ."]].map(([v,l])=>(
                      <button key={v} onClick={()=>setHistWeekRange(v)} style={{ background:histWeekRange===v?"var(--t-accent-soft,rgba(167,139,250,0.2))":"rgba(128,128,128,0.06)", border:`1px solid ${histWeekRange===v?"var(--t-accent,rgba(167,139,250,0.4))":"var(--t-card-border,rgba(255,255,255,0.08))"}`, borderRadius:7, color:histWeekRange===v?"var(--t-accent,#a78bfa)":"var(--t-text-dim,#6b5f88)", padding:"4px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Week cards */}
            {histFiltered.map(([key,w]) => {
              const filtMs = filterHM(w.missions||[]);
              const d=filtMs.filter(m=>m.status==="DONE").length, t=filtMs.length, p=t>0?Math.round((d/t)*100):0, cur=key===wkey;
              return (
                <div key={key} style={{ ...S.card, borderColor:cur?"var(--t-accent,rgba(167,139,250,0.45))":"var(--t-card-border,rgba(167,139,250,0.1))", background:cur?"var(--t-accent-soft,rgba(167,139,250,0.12))":"var(--t-card,#1d1733)", padding:"12px 14px" }}>
                  <div onClick={()=>{const yr=parseInt(key.split("-W")[0])||w.year;update(s=>({...s,currentWeekNumber:w.weekNumber,currentYear:yr}));setActiveTab("current");}} style={{ cursor:"pointer", marginBottom:w.epicObjective?5:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ fontFamily:"'Fraunces',serif", fontWeight:600, fontSize:18, display:"flex", alignItems:"center", gap:7 }}>
                        Semana {w.weekNumber}
                        {cur&&<span style={{ fontSize:10, color:"var(--t-accent,#a78bfa)", background:"var(--t-accent-soft,rgba(167,139,250,0.15))", padding:"2px 7px", borderRadius:99, fontFamily:"inherit", fontWeight:600 }}>ACTUAL</span>}
                      </div>
                      <div style={{ fontSize:13, color:p===100?"#34d399":"var(--t-text-muted,#8b7fa8)", fontWeight:600 }}>{p===100?"🏆":""} {d}/{t}</div>
                    </div>
                    {w.epicObjective&&<div style={{ fontSize:12, color:"var(--t-text-dim,#6b5f88)", marginTop:3, fontStyle:"italic", fontFamily:"'Fraunces',serif", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>"{w.epicObjective}"</div>}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }} onClick={e=>e.stopPropagation()}>
                    <div style={{ flex:1 }}>
                      <div style={{ background:"rgba(128,128,128,0.10)", borderRadius:99, height:5, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${p}%`, borderRadius:99, background:p===100?"linear-gradient(90deg,#34d399,#60a5fa)":"linear-gradient(90deg,#f472b6,#a78bfa)", transition:"width 0.5s" }} />
                      </div>
                      <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", marginTop:3 }}>{p}%{globalPersonFilter.length?` (${globalPersonFilter.map(f=>f==="person1"?p1:f==="person2"?p2:"Juntos").join("+")})`:""}</div>
                    </div>
                    {w.photo
                      ? <div style={{ position:"relative", flexShrink:0 }}>
                          <img src={w.photo} onClick={()=>setLightboxSrc(w.photo)} style={{ width:44, height:44, borderRadius:8, objectFit:"cover", display:"block", border:"1px solid rgba(167,139,250,0.25)", cursor:"zoom-in" }} alt="foto" title="Ver foto completa" />
                          <button onClick={()=>update(d=>({...d,weeks:{...d.weeks,[key]:{...d.weeks[key],photo:null}}}))}
                            style={{ position:"absolute", top:-5, right:-5, background:"var(--t-card,#1d1733)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.3))", borderRadius:99, color:"var(--t-text-muted,#8b7fa8)", fontSize:9, width:16, height:16, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>✕</button>
                        </div>
                      : <div style={{ flexShrink:0, display:"flex", gap:4 }}>
                          <label style={{ width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(128,128,128,0.05)", border:"1px dashed rgba(167,139,250,0.18)", borderRadius:8, cursor:"pointer", fontSize:14 }} title="Tomar foto">
                            📷
                            <input type="file" accept="image/*" capture="environment" style={{ display:"none" }}
                              onChange={async e=>{const f=e.target.files[0];if(!f)return;const b64=await compressImage(f);update(d=>({...d,weeks:{...d.weeks,[key]:{...d.weeks[key],photo:b64}}}));e.target.value="";}} />
                          </label>
                          <label style={{ width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(128,128,128,0.05)", border:"1px dashed rgba(167,139,250,0.18)", borderRadius:8, cursor:"pointer", fontSize:14 }} title="Elegir de galería">
                            🖼️
                            <input type="file" accept="image/*" style={{ display:"none" }}
                              onChange={async e=>{const f=e.target.files[0];if(!f)return;const b64=await compressImage(f);update(d=>({...d,weeks:{...d.weeks,[key]:{...d.weeks[key],photo:b64}}}));e.target.value="";}} />
                          </label>
                        </div>
                    }
                  </div>
                  {/* ICS por semana */}
                  {(w.missions||[]).some(m=>m.date)&&<div style={{ marginTop:8 }}>
                    <button onClick={()=>downloadWeekICS(w, key, p1, p2)} style={{ ...S.btnSecondary, fontSize:11, padding:"4px 10px", borderColor:"rgba(52,211,153,0.25)", color:"#34d399", width:"100%" }}>📅 Importar semana {w.weekNumber} a Google Calendar (.ics)</button>
                  </div>}
                  {w.photo&&<div style={{ marginTop:8, position:"relative", cursor:"zoom-in" }} onClick={()=>setLightboxSrc(w.photo)}>
                    <img src={w.photo} style={{ width:"100%", borderRadius:10, maxHeight:130, objectFit:"cover", display:"block" }} alt="foto semana" />
                    <div style={{ position:"absolute", inset:0, borderRadius:10, background:"rgba(0,0,0,0)", display:"flex", alignItems:"flex-end", justifyContent:"flex-end", padding:6 }}>
                      <span style={{ background:"rgba(0,0,0,0.45)", borderRadius:6, fontSize:10, color:"#f8f4ff", padding:"2px 7px", backdropFilter:"blur(4px)" }}>🔍 Ver completa</span>
                    </div>
                  </div>}
                </div>
              );
            })}
          </div>
          );
        })()}

        {activeTab==="goals" && <GoalsView goals={data.goals||[]} weeks={data.weeks} cwn={data.currentWeekNumber} cyr={data.currentYear} p1={p1} p2={p2} colors={colors} onAdd={addGoal} onUpdate={updateGoal} onDelete={deleteGoal} />}

        {activeTab==="stats" && <StatsView weeks={data.weeks} p1={p1} p2={p2} colors={colors} onGoToWeek={(wn,yr)=>{update(s=>({...s,currentWeekNumber:wn,currentYear:yr}));setActiveTab("current");}} />}

        {activeTab==="chat" && <ChatView coupleId={coupleId} personName={personName} sessionUserId={sessionUserId} chatNotifEnabled={notifGranted && (data.settings?.notifications?.chat!==false)} />}

        {activeTab==="gastos" && <GastosView gastos={data.gastos||[]} proyectos={data.gastosProyectos||[]} p1={p1} p2={p2} colors={colors} onUpdate={gastos=>update(d=>({...d,gastos}))} onUpdateProyectos={proyectos=>update(d=>({...d,gastosProyectos:proyectos}))} onUpdateAll={patch=>update(d=>({...d,...patch}))} />}

        {activeTab==="links" && <LinksView links={data.links||[]} onSave={links=>update(d=>({...d,links}))} />}

        {activeTab==="pending" && (()=>{
          // ── Pendientes ──────────────────────────────────────────────────────
          // Only suppress originals when an UNDONE carry copy exists (if carry copy is DONE, show original)
          const carriedFromIds=new Set(Object.values(data.weeks).flatMap(w=>(w.missions||[]).filter(m=>m.carriedFrom&&m.status!=="DONE").map(m=>m.carriedFrom)));
          const pendingRaw=Object.entries(data.weeks)
            .sort((a,b)=>a[0].localeCompare(b[0]))
            .flatMap(([key,w])=>(w.missions||[])
              .filter(m=>m.status!=="DONE" && m.type!=="event" && !carriedFromIds.has(m.id))
              .map(m=>({...m,weekNumber:w.weekNumber,_yr:parseInt(key.split("-W")[0])||new Date().getFullYear(),_wkey:key})));
          const latestBySeries={};
          for(const m of pendingRaw){if(m.seriesId&&(!latestBySeries[m.seriesId]||m._wkey>latestBySeries[m.seriesId]._wkey))latestBySeries[m.seriesId]=m;}
          const pendingAll=pendingRaw.filter(m=>!m.seriesId||latestBySeries[m.seriesId]===m);
          const pendingFiltered=pendingAll.filter(m=>
            (!globalPersonFilter.length||globalPersonFilter.includes(m.who))&&
            (!globalCatFilter.length||getMCats(m).some(c=>globalCatFilter.includes(c)))
          );
          // ── Logros ──────────────────────────────────────────────────────────
          // Sorted newest-week-first so dedup keeps the most recent completion
          const logrosAll=Object.entries(data.weeks)
            .sort((a,b)=>b[0].localeCompare(a[0]))
            .flatMap(([key,w])=>(w.missions||[])
              .filter(m=>m.status==="DONE" && m.type!=="event")
              .map(m=>({...m,weekNumber:w.weekNumber,_yr:parseInt(key.split("-W")[0])||new Date().getFullYear(),_wkey:key})));
          // Dedup: by seriesId only (recurring tasks)
          const _seenSeries = new Set();
          const logrosDeduped = logrosAll.filter(m => {
            if (m.seriesId) {
              if (_seenSeries.has(m.seriesId)) return false;
              _seenSeries.add(m.seriesId);
            }
            return true;
          });
          // Hero stats para Logros
          const cwKey = `${data.currentYear}-W${String(data.currentWeekNumber).padStart(2,"0")}`;
          const logrosThisWeek = logrosAll.filter(m => m._wkey === cwKey).length;
          // Racha: días consecutivos hacia atrás con al menos 1 logro (usa completedAt)
          const logrosWithDate = logrosAll.filter(m => m.completedAt);
          const doneByDay = new Set(logrosWithDate.map(m => {
            if (typeof m.completedAt === 'string') return m.completedAt.slice(0,10);
            if (typeof m.completedAt === 'number') return new Date(m.completedAt).toISOString().slice(0,10);
            return null;
          }).filter(Boolean));
          let racha = 0;
          const today = new Date();
          for (let i = 0; i < 365; i++) {
            const d = new Date(today); d.setDate(today.getDate() - i);
            const key = d.toISOString().slice(0,10);
            if (doneByDay.has(key)) racha++;
            else if (i > 0) break;
          }
          const subTabStyle=(active)=>({
            flex:1, padding:"7px 0", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit",
            fontSize:12, fontWeight:600,
            background: active ? "var(--t-accent-soft,rgba(167,139,250,0.14))" : "rgba(128,128,128,0.06)",
            color: active ? "var(--t-accent,#a78bfa)" : "var(--t-text-muted,#8b7fa8)",
            transition:"all .15s",
          });
          return <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {/* Toolbar: sub-tabs + refresh */}
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <div style={{display:"flex",flex:1,gap:4,background:"rgba(128,128,128,0.06)",borderRadius:10,padding:3}}>
                <button onClick={()=>setPendingTab("pending")} style={subTabStyle(pendingTab==="pending")}>📋 Pendientes <span style={{fontSize:10,opacity:0.7}}>({pendingFiltered.length})</span></button>
                <button onClick={()=>{ setPendingTab("logros"); track("logros_tab_viewed", { count: logrosDeduped.length }); }}  style={subTabStyle(pendingTab==="logros")}>🏆 Logros <span style={{fontSize:10,opacity:0.7}}>({logrosDeduped.length})</span></button>
              </div>
              <button onClick={()=>forceSync()} title="Bajar datos de Supabase"
                style={{...S.btnSecondary, padding:"7px 10px", fontSize:12, display:"flex", alignItems:"center", gap:4, flexShrink:0}}>
                🔄 Bajar
              </button>
              <button onClick={()=>forcePush()} title="Subir datos locales a Supabase"
                style={{...S.btnSecondary, padding:"7px 10px", fontSize:12, display:"flex", alignItems:"center", gap:4, flexShrink:0, color:"var(--t-accent,#a78bfa)"}}>
                ⬆ Subir
              </button>
            </div>
            {/* Pendientes list */}
            {pendingTab==="pending" && (
              pendingFiltered.length===0
                ?<div style={{...S.card,textAlign:"center",color:"var(--t-text-dim,#3d3360)",fontStyle:"italic",padding:40}}>
                  <div style={{fontSize:36,marginBottom:12}}>🎉</div>
                  <div>¡Sin pendientes! Todo al día.</div>
                </div>
                :<div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {pendingFiltered.map(m=>{
                    const whoColor=m.who==="person1"?colors?.person1||DEFAULT_COLORS.person1:m.who==="person2"?colors?.person2||DEFAULT_COLORS.person2:colors?.together||DEFAULT_COLORS.together;
                    const isCarriedM=!!m.carriedFrom;
                    const delayWeeks=(()=>{if(!isCarriedM)return 0;let n=0,oid=m.carriedFrom,owk=m.carriedFromWeek;while(oid&&owk&&n<20){n++;const ow=data.weeks[owk];if(!ow)break;const om=(ow.missions||[]).find(x=>x.id===oid);if(!om?.carriedFrom)break;oid=om.carriedFrom;owk=om.carriedFromWeek;}return n;})();
                    return <div key={m.id+m._wkey} style={{...S.card,padding:"10px 14px"}}>
                      {isCarriedM&&<div style={{fontSize:10,color:delayWeeks>=3?"#f87171":"#fb923c",letterSpacing:0.5,marginBottom:5,display:"flex",alignItems:"center",gap:4}}>
                        {delayWeeks>=3?"⚠️":"🔁"} {delayWeeks>=3?`Arrastrada ${delayWeeks} semanas`:"Arrastrada"}
                      </div>}
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:22,flexShrink:0}}>{m.emoji}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,color:"var(--t-text,#e2d9ff)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.title}</div>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:3}}>
                            <span style={{fontSize:10,color:"var(--t-text-dim,#4a4166)"}}>S{m.weekNumber} {m._yr}</span>
                            {m.date&&<span style={{fontSize:10,color:"var(--t-accent,#a78bfa)"}}>📆 {m.date}</span>}
                            {getMCats(m).map(ci=>{const c=CAT_MAP[ci];return c?<span key={ci} style={{fontSize:10,color:c.color}}>{c.icon} {c.label}</span>:null;})}
                            <span style={{fontSize:10,background:`${whoColor}18`,color:whoColor,border:`1px solid ${whoColor}40`,padding:"0 5px",borderRadius:99}}>{m.who==="person1"?p1:m.who==="person2"?p2:"👫"}</span>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:4,flexShrink:0,alignItems:"center"}}>
                          <button onClick={()=>cycleStatusGlobal(m.weekNumber,m._yr,m.id)} style={badgeStyle(m.status)}>{STATUS[m.status].icon}</button>
                          <button onClick={()=>{update(s=>({...s,currentWeekNumber:m.weekNumber,currentYear:m._yr}));setActiveTab("current");}} style={{...S.btnSecondary,fontSize:10,padding:"4px 8px"}}>→ S{m.weekNumber}</button>
                          <button onClick={()=>confirm("Vas a eliminar esta tarea\n\nEsta acción no se puede deshacer. Desaparecerá para los dos.",()=>deleteMissionGlobal(m.weekNumber,m._yr,m.id),{confirmLabel:"Sí, eliminar",cancelLabel:"Mejor no"})} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t-text-dim,#4a4166)",fontSize:18,padding:"0 2px",lineHeight:1,flexShrink:0}} title="Eliminar">×</button>
                        </div>
                      </div>
                    </div>;
                  })}
                </div>
            )}
            {/* Logros list */}
            {pendingTab==="logros" && (()=>{
              // PillFilter data
              const peoplePills = [
                { id:"person1", label:p1, count:logrosDeduped.filter(m=>m.who==="person1").length, color:colors?.person1||DEFAULT_COLORS.person1 },
                { id:"person2", label:p2, count:logrosDeduped.filter(m=>m.who==="person2").length, color:colors?.person2||DEFAULT_COLORS.person2 },
                { id:"together", label:"Juntos", count:logrosDeduped.filter(m=>m.who==="together").length, color:colors?.together||DEFAULT_COLORS.together },
              ].filter(p=>p.count>0);
              const catCounts = {};
              logrosDeduped.forEach(m=>getMCats(m).forEach(c=>{ catCounts[c]=(catCounts[c]||0)+1; }));
              const catPills = Object.entries(catCounts)
                .filter(([,n])=>n>0)
                .map(([id,count])=>({ id, count, ...CAT_MAP[id] }))
                .filter(c=>c.label);
              // Local filtered
              const logrosLocalFiltered = logrosDeduped.filter(m =>
                (!logrosPeopleFilter.length || logrosPeopleFilter.includes(m.who)) &&
                (!logrosCatFilter.length || getMCats(m).some(c => logrosCatFilter.includes(c)))
              );
              // Group by day
              const byDay = {};
              logrosLocalFiltered.forEach(m => {
                const day = (typeof m.completedAt === 'string' ? m.completedAt.slice(0,10) : null) || m._wkey;
                if(!byDay[day]) byDay[day]=[];
                byDay[day].push(m);
              });
              const days = Object.entries(byDay).sort(([a],[b])=>b.localeCompare(a));
              return (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {/* Hero stats */}
                  <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:2}}>
                    {[
                      { icon:"🏆", value:logrosDeduped.length, label:"Totales" },
                      { icon:"📅", value:logrosThisWeek, label:"Esta semana" },
                      { icon:"🔥", value:racha, label:`Día${racha!==1?"s":""} de racha` },
                    ].map(s=>(
                      <div key={s.label} style={{flex:"0 0 auto",background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.18)",borderRadius:12,padding:"10px 16px",textAlign:"center",minWidth:90}}>
                        <div style={{fontSize:20}}>{s.icon}</div>
                        <div style={{fontFamily:"'Fraunces',serif",fontSize:22,color:"#f8f4ff",fontWeight:700,lineHeight:1}}>{s.value}</div>
                        <div style={{fontSize:10,color:"#8b7fa8",marginTop:2}}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* PillFilter local */}
                  <PillFilter
                    people={peoplePills}
                    categories={catPills}
                    selectedPeople={logrosPeopleFilter}
                    selectedCats={logrosCatFilter}
                    onTogglePerson={id=>setLogrosPeopleFilter(f=>f.includes(id)?f.filter(x=>x!==id):[...f,id])}
                    onToggleCat={id=>setLogrosCatFilter(f=>f.includes(id)?f.filter(x=>x!==id):[...f,id])}
                  />
                  {/* Timeline agrupada por día */}
                  {logrosLocalFiltered.length===0
                    ? <div style={{...S.card,textAlign:"center",color:"var(--t-text-dim,#3d3360)",fontStyle:"italic",padding:40}}>
                        <div style={{fontSize:36,marginBottom:12}}>🏆</div>
                        <div>Todavía no hay logros registrados.</div>
                      </div>
                    : <div style={{display:"flex",flexDirection:"column",gap:14}}>
                        {days.map(([day,missions],di)=>{
                          let dayLabel;
                          if(day.includes("-W")) {
                            const [yr,wn]=day.split("-W");
                            dayLabel=`Semana ${wn} · ${yr}`;
                          } else {
                            const d=new Date(day+"T12:00:00");
                            const todayStr=new Date().toISOString().slice(0,10);
                            const yesterStr=new Date(Date.now()-86400000).toISOString().slice(0,10);
                            dayLabel=day===todayStr?"Hoy":day===yesterStr?"Ayer":d.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"short"});
                          }
                          return (
                            <div key={day} style={{opacity:0,animation:`fadeInUp 0.3s ease ${di*0.05}s forwards`}}>
                              <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"var(--t-accent,#a78bfa)",fontWeight:600,marginBottom:6}}>
                                {dayLabel} · {missions.length} logro{missions.length!==1?"s":""}
                              </div>
                              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                                {missions.map(m=>{
                                  const whoColor=m.who==="person1"?colors?.person1||DEFAULT_COLORS.person1:m.who==="person2"?colors?.person2||DEFAULT_COLORS.person2:colors?.together||DEFAULT_COLORS.together;
                                  return (
                                    <div key={m.id+m._wkey} style={{...S.card,padding:"9px 13px",borderLeft:`3px solid ${whoColor}`,opacity:0,animation:`fadeInUp 0.25s ease ${di*0.05+0.05}s forwards`}}>
                                      <div style={{display:"flex",alignItems:"center",gap:9}}>
                                        <span style={{fontSize:20,flexShrink:0}}>{m.emoji}</span>
                                        <div style={{flex:1,minWidth:0}}>
                                          <div style={{fontSize:13,color:"var(--t-text,#e2d9ff)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.title}</div>
                                          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:2}}>
                                            <span style={{fontSize:10,background:`${whoColor}18`,color:whoColor,border:`1px solid ${whoColor}40`,padding:"0 5px",borderRadius:99}}>{m.who==="person1"?p1:m.who==="person2"?p2:"👫"}</span>
                                            {getMCats(m).map(ci=>{const c=CAT_MAP[ci];return c?<span key={ci} style={{fontSize:10,color:c.color}}>{c.icon}</span>:null;})}
                                          </div>
                                        </div>
                                        <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                                          <span style={{fontSize:18}}>✅</span>
                                          <button onClick={()=>confirm("Vas a eliminar este logro\n\nEsta acción no se puede deshacer. Desaparecerá del historial de los dos.",()=>deleteMissionGlobal(m.weekNumber,m._yr,m.id),{confirmLabel:"Sí, eliminar",cancelLabel:"Mejor no"})} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t-text-dim,#4a4166)",fontSize:16,padding:"0 2px",lineHeight:1}} title="Eliminar">×</button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                  }
                </div>
              );
            })()}
          </div>;
        })()}
      </div>

      {/* Tutorial overlay */}
      {tutorialStep !== null && <TutorialOverlay step={tutorialStep} onNext={tutorialNext} onSkip={tutorialSkip} onFinish={tutorialFinish} />}

      {/* Lightbox */}
      {lightboxSrc && (
        <div onClick={()=>setLightboxSrc(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16, cursor:"zoom-out" }}>
          <img src={lightboxSrc} style={{ maxWidth:"100%", maxHeight:"100%", borderRadius:12, objectFit:"contain", boxShadow:"0 20px 60px rgba(0,0,0,0.8)" }} alt="foto completa" />
          <div style={{ position:"absolute", top:16, right:16, display:"flex", gap:8 }}>
            <a href={lightboxSrc} download="foto.jpg" onClick={e=>e.stopPropagation()} style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:99, color:"#f8f4ff", fontSize:18, width:38, height:38, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none" }}>⬇</a>
            <button onClick={()=>setLightboxSrc(null)} style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:99, color:"#f8f4ff", fontSize:20, width:38, height:38, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
          </div>
        </div>
      )}
      <Toast toast={appToast} onDismiss={dismissToast} />
      {import.meta.env.DEV && coupleId && data && (
        <DevBackfillPanel coupleId={coupleId} blobData={data} />
      )}
      <ConfirmDialog />
    </div>
  );
}
