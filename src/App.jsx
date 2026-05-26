import { useState, useEffect, useCallback, useRef } from "react";
import { loadData, loadDataWithVersion, loadFromNormalized, saveData, saveWithRetry, isValidAppData, loadLocalBackup, exportData, importData, signOut, getSession, onAuthChange, getMyCoupleId, subscribeToUpdates } from "./supabase.js";
import supabase from "./supabase.js";
import Toast, { useToast } from "./components/Toast.jsx";
import HomeDashboard from "./components/HomeDashboard.jsx";
import WeekTimeline from "./components/WeekTimeline.jsx";
import FilterDrawer, { FilterButton } from "./components/FilterDrawer.jsx";
import LinksView from "./components/LinksView.jsx";
import { useConfirm } from "./components/ConfirmModal.jsx";
import { SkeletonDashboard } from "./components/Skeleton.jsx";
import { uid, isoWeekKey, getWeekAndYear, isTodayMonday, isoWeeksInYear } from "./utils.js";
import { APP_VERSION, SEED_VERSION, THEMES, MAINTENANCE_WARNING, STATUS_ORDER, STATUS, CATEGORIES, getMCats, DEFAULT_COLORS } from "./constants.js";
import { S } from "./styles.js";
import WorkHoursCard from "./components/WorkHoursCard.jsx";
import AddMissionForm from "./components/AddMissionForm.jsx";
import MissionCard from "./components/MissionCard.jsx";
import { track, setTrackContext, clearTrackContext } from "./lib/track.js";
import { isEnabled } from "./lib/flags.js";
import { saveWithCAS, insertNormalizedMission, deleteNormalizedMission, updateNormalizedMissionStatus } from "./lib/repo.js";

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
import HistoryView from "./components/HistoryView.jsx";
import PendingView from "./components/PendingView.jsx";
import SideMenu from "./components/SideMenu.jsx";
import Topbar from "./components/Topbar.jsx";
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
    getSession().then(resolve).catch(() => resolve(null));
    const sub = onAuthChange(resolve);
    return () => sub.unsubscribe();
  }, []);

  const handleSignOut = () => { localStorage.removeItem(AUTH_CACHE_KEY); clearTrackContext(); signOut(); };

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
  const isSavingRef     = useRef(false); // true while async save is in-flight
  const pendingSaveRef  = useRef(false); // ref mirror of pendingSave state for stale-closure safety
  const dataRef         = useRef(null);
  const dataVersionRef  = useRef(null); // null = version not yet loaded from DB
  const [activeTab,       setActiveTab]       = useState("home");
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [showProfile,     setShowProfile]     = useState(false);
  const [importMsg,       setImportMsg]       = useState(null);
  const importFileRef = useRef(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newM, setNewM] = useState({ emoji:"🎯", title:"", status:"TBC", date:"", time:"", endDate:"", endTime:"", categories:[], who:"together", duration:0, goalId:null, type:"task", seriesPattern:"", seriesEndDate:"", reminder:"none" });
  const [editObj, setEditObj] = useState(false);
  const [error, setError] = useState(null);
  const [globalPersonFilter, setGlobalPersonFilter] = useState([]); // [] = todos
  const [globalCatFilter, setGlobalCatFilter] = useState([]); // [] = todas
  const [localThemeId, setLocalThemeId] = useState(null);
  const [localFontId,  setLocalFontId]  = useState(null);
  const [weekSort, setWeekSort] = useState("default"); // default | chrono | type | who | status
  const [lightboxSrc,   setLightboxSrc]   = useState(null);
  const [syncing, setSyncing]       = useState(false);
  const [syncError, setSyncError]   = useState(null);   // string | null
  const [syncMsg,   setSyncMsg]     = useState(null);   // feedback message
  const [tutorialStep, setTutorialStep] = useState(null); // null = hidden
  const [notifGranted, _setNotifGranted] = useState(typeof Notification!=="undefined" && Notification.permission==="granted");
  const notifSettingsRef    = useRef(null);
  const pushSubscribedRef   = useRef(false);
  const pushNudgeDismissRef = useRef(localStorage.getItem("mp-push-nudge-dismissed") === "true");
  const [pushSubscribed,   setPushSubscribed]   = useState(false);
  const [pushLoading,      setPushLoading]      = useState(false);
  const [pushError,        setPushError]        = useState(null);
  const [pushNudgeVisible, setPushNudgeVisible] = useState(false);
  const pushSupported = isPushSupported();
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingSave, setPendingSave] = useState(false);
  const [savingState, setSavingState] = useState("idle"); // "idle"|"saving"|"saved"|"error"
  const [filtersOpen,   setFiltersOpen]   = useState(false);
  const [weekViewMode,  setWeekViewMode]  = useState("timeline"); // "list" | "timeline"
  const { toast: appToast, push: pushToast, dismiss: dismissToast } = useToast();
  const { ConfirmDialog } = useConfirm();

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
            // Register controllerchange BEFORE postMessage so reload fires reliably
            navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            return; // reload triggered by controllerchange
          } else if (!reg.installing && !serverVersion) {
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

  // Pull from Supabase and update local. Never pushes — push happens via auto-save.
  const smartSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const remote = await loadData(coupleId);
      if (remote) {
        setData(prev => {
          if (JSON.stringify(remote) === JSON.stringify(prev)) {
            showSyncMsg("✓ Ya estás al día");
            return prev;
          }
          const localCount = Object.values(prev?.weeks ?? {}).reduce((s,w) => s + (w.missions?.length ?? 0), 0);
          const remoteCount = Object.values(remote?.weeks ?? {}).reduce((s,w) => s + (w.missions?.length ?? 0), 0);
          const diff = remoteCount - localCount;
          const msg = diff > 0 ? `⬇ Sincronizado — ${diff} tarea${diff!==1?"s":""} nuevas`
                    : diff < 0 ? `⬇ Sincronizado — ${Math.abs(diff)} tarea${Math.abs(diff)!==1?"s":""} menos`
                    : "⬇ Datos sincronizados";
          showSyncMsg(msg);
          return remote;
        });
      } else {
        // null = network error, RLS failure, or session expired — never push
        setSyncError("No se pudo conectar con Supabase");
        showSyncMsg("⚠ Sin conexión — datos sin modificar");
      }
    } catch (e) {
      setSyncError(e.message);
      showSyncMsg("⚠ Error: " + e.message.slice(0, 60));
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
  const tutorialBack   = () => setTutorialStep(s => Math.max(s-1, 0));
  const tutorialFinish = () => { localStorage.setItem("shared-cal-tutorial-v1","done"); setTutorialStep(null); setActiveTab("home"); };
  const tutorialSkip   = () => { localStorage.setItem("shared-cal-tutorial-v1","done"); setTutorialStep(null); };

  // Sync notifGranted if user grants/denies permission mid-session
  useEffect(() => {
    if (typeof Notification === "undefined" || !Notification.addEventListener) return;
    const handler = () => _setNotifGranted(Notification.permission === "granted");
    Notification.addEventListener("permissionchange", handler);
    return () => Notification.removeEventListener("permissionchange", handler);
  }, []);

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
    }, () => pendingSaveRef.current || !!saveTimerRef.current || isSavingRef.current);
    return () => { supabase.removeChannel(channel); };
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
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPendingSave();
      } else if (document.visibilityState === "visible" && !saveTimerRef.current && coupleId) {
        // Realtime no recupera eventos perdidos tras reconexión del WebSocket.
        // Re-fetch silencioso para sincronizar datos que llegaron mientras la pestaña
        // estaba en segundo plano (pareja guardó cambios, realtime no los recibió).
        loadData(coupleId).then(fresh => {
          if (fresh && isValidAppData(fresh)) {
            setData(fresh);
            loadDataWithVersion(coupleId).then(({ version }) => { dataVersionRef.current = version; }).catch(() => { dataVersionRef.current = null; });
          }
        }).catch(() => {});
      }
    };
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
  useEffect(() => { pendingSaveRef.current = pendingSave; }, [pendingSave]);
  const handlePushToggle = async () => {
    const wasPushSubscribed = pushSubscribed;
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
      setPushSubscribed(wasPushSubscribed);
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
        saveTimerRef.current = null;
        isSavingRef.current = true;
        const doSaveWithRetry = () => {
          saveWithRetry(next, coupleId, { getLatestData: () => dataRef.current })
            .then(() => {
              isSavingRef.current = false;
              setSyncError(null); setPendingSave(false); setSavingState("saved"); setTimeout(() => setSavingState("idle"), 2000);
              // Resync version: doSaveWithRetry bypasses CAS so the DB trigger incremented the version
              // without our knowledge. Without a resync the next CAS save sends a stale version,
              // gets a false conflict, downloads old data and silently discards the user's change.
              loadDataWithVersion(coupleId)
                .then(({ version }) => { dataVersionRef.current = version ?? null; })
                .catch(() => { dataVersionRef.current = null; });
            })
            .catch(e => { isSavingRef.current = false; setSyncError(e.message); setPendingSave(true); setSavingState("error"); showSyncMsg("⚠ Error al guardar — reintentando…"); });
        };

        // CAS: solo activo si el flag está ON y la versión ya fue cargada de DB.
        // Si la versión es null (aún no cargada), se usa saveWithRetry como fallback seguro.
        if (isEnabled("cas_version_check") && dataVersionRef.current !== null) {
          saveWithCAS(coupleId, next, dataVersionRef.current).then(result => {
            if (result.success) {
              isSavingRef.current = false;
              dataVersionRef.current = result.newVersion;
              setSyncError(null); setPendingSave(false); setSavingState("saved"); setTimeout(() => setSavingState("idle"), 2000);
            } else if (result.conflict) {
              isSavingRef.current = false;
              // Conflicto real: otro cliente guardó primero. NO sobreescribir.
              track("cas_conflict", { couple_id: coupleId });
              pushToast({ kind: "error", text: "⚠ Conflicto: tu pareja guardó al mismo tiempo. Cargando su versión — revisa si falta algún cambio tuyo." });
              loadData(coupleId).then(fresh => {
                if (fresh && isValidAppData(fresh)) {
                  setData(fresh);
                  loadDataWithVersion(coupleId).then(({ version }) => { dataVersionRef.current = version; }).catch(() => { dataVersionRef.current = null; });
                }
              }).catch(() => {});
              setSavingState("idle");
              setPendingSave(false);
            } else {
              // casDisabled o error de red → fallback a saveWithRetry
              doSaveWithRetry();
            }
          }).catch(() => {
            // Error inesperado en el propio RPC → fallback seguro
            doSaveWithRetry();
          });
        } else {
          doSaveWithRetry();
        }
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
      // Delay version reload until after debounce+save (700ms) so we read the post-import version
      if (coupleId) {
        setTimeout(() => {
          loadDataWithVersion(coupleId)
            .then(({ version }) => { dataVersionRef.current = version; })
            .catch(() => { dataVersionRef.current = null; });
        }, 1200);
      }
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
    const mission = { id:uid(), emoji:newM.emoji, title:newM.title.trim(), status:newM.status, date:newM.date||null, time:startTime, endDate:newM.endDate||null, endTime, createdAt:Date.now(), completedAt:null, carriedFrom:null, carriedFromWeek:null, categories:newM.categories||[], who:newM.who, duration:newM.duration||null, goalId:newM.goalId||null, type:newM.type||"task", seriesPattern:newM.seriesPattern||null, seriesId:sid, seriesEndDate:newM.seriesEndDate||null, seriesStartWeek:sid?data.currentWeekNumber:null, seriesStartYear:sid?data.currentYear:null };
    patchWeek(w => ({ ...w, missions:[...(w.missions||[]), mission] }));
    insertNormalizedMission(coupleId, wkey, data.currentWeekNumber, data.currentYear, mission).catch(e => console.error("[dual_write] insert:", e));
    // Delay push until after the 700ms debounce + save completes so partner data is ready
    setTimeout(() => sendContextualPush(coupleId, { body:`${personName} ${isEv?"añadió un evento":"añadió una tarea"}: ${newM.emoji} ${newM.title.trim()}`, tag:isEv?"mp-event-add":"mp-mission-add" }, sessionUserId), 1500);
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
    if (nx === "DONE" && mCur) setTimeout(() => sendContextualPush(coupleId, { body:`${personName} completó: ${mCur.emoji||"🎯"} ${mCur.title}`, tag:"mp-mission-done" }, sessionUserId), 1500);
    if (nx) pushToast({ kind: "success", text: `${STATUS[nx].icon} ${STATUS[nx].label}` });
    if (nx) updateNormalizedMissionStatus(coupleId, id, nx).catch(e => console.error("[dual_write] status:", e));
  };

  const delMission = id => {
    deleteNormalizedMission(coupleId, id).catch(e => console.error("[dual_write] delete:", e));
    patchWeek(w => ({ ...w, missions:w.missions.filter(m=>m.id!==id) }));
  };
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
    if (nx) updateNormalizedMissionStatus(coupleId, id, nx).catch(e => console.error("[dual_write] status:", e));
    if (nx === "DONE" && mCur) setTimeout(() => sendContextualPush(coupleId, { body:`${personName} completó: ${mCur.emoji||"🎯"} ${mCur.title}`, tag:"mp-mission-done" }, sessionUserId), 1500);
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
    deleteNormalizedMission(coupleId, id).catch(e => console.error("[dual_write] delete:", e));
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
            <button onClick={() => { setPushNudgeVisible(false); pushNudgeDismissRef.current = true; localStorage.setItem("mp-push-nudge-dismissed", "true"); }} style={{ background:"none", border:"none", color:"var(--t-text-muted,#8b7fa8)", cursor:"pointer", fontSize:11, fontFamily:"inherit", padding:"2px 0" }}>Ahora no</button>
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






      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        activeTab={activeTab}
        onNavigate={tab => { setActiveTab(tab); setMenuOpen(false); }}
        couplePhoto={data.settings?.photos?.couple}
        coupleEmoji={data.settings?.coupleEmoji}
        p1={p1} p2={p2}
        syncMsg={syncMsg}
      />

      <Topbar
        activeTab={activeTab} setActiveTab={setActiveTab} setMenuOpen={setMenuOpen}
        currentWeekNumber={data.currentWeekNumber}
        savingState={savingState} onForcePush={forcePush}
        isDark={_activeTheme.dark} onToggleDark={toggleDarkLight}
        onCheckUpdate={checkUpdate} onSmartSync={smartSync} syncing={syncing}
        onDownloadICS={() => downloadWeekICS(week, wkey, p1, p2)}
        onDownloadPDF={() => downloadWeekPDF(week, wkey, p1, p2)}
        onShowProfile={() => setShowProfile(true)}
        onExport={() => exportData(data)}
        importFileRef={importFileRef} onSignOut={onSignOut}
        colors={colors}
      />

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

        {activeTab==="history" && <HistoryView weeks={data.weeks} wkey={wkey} globalPersonFilter={globalPersonFilter} globalCatFilter={globalCatFilter} update={update} setActiveTab={setActiveTab} setLightboxSrc={setLightboxSrc} compressImage={compressImage} downloadWeekICS={downloadWeekICS} p1={p1} p2={p2} />}

        {activeTab==="goals" && <GoalsView goals={data.goals||[]} weeks={data.weeks} cwn={data.currentWeekNumber} cyr={data.currentYear} p1={p1} p2={p2} colors={colors} onAdd={addGoal} onUpdate={updateGoal} onDelete={deleteGoal} />}

        {activeTab==="stats" && <StatsView weeks={data.weeks} p1={p1} p2={p2} colors={colors} onGoToWeek={(wn,yr)=>{update(s=>({...s,currentWeekNumber:wn,currentYear:yr}));setActiveTab("current");}} />}

        {activeTab==="chat" && <ChatView coupleId={coupleId} personName={personName} sessionUserId={sessionUserId} chatNotifEnabled={notifGranted && (data.settings?.notifications?.chat!==false)} />}

        {activeTab==="gastos" && <GastosView gastos={data.gastos||[]} proyectos={data.gastosProyectos||[]} p1={p1} p2={p2} colors={colors} onUpdate={gastos=>update(d=>({...d,gastos}))} onUpdateProyectos={proyectos=>update(d=>({...d,gastosProyectos:proyectos}))} onUpdateAll={patch=>update(d=>({...d,...patch}))} />}

        {activeTab==="links" && <LinksView links={data.links||[]} onSave={links=>update(d=>({...d,links}))} />}

        {activeTab==="pending" && <PendingView
          weeks={data.weeks}
          currentWeekNumber={data.currentWeekNumber}
          currentYear={data.currentYear}
          globalPersonFilter={globalPersonFilter}
          globalCatFilter={globalCatFilter}
          colors={colors}
          p1={p1} p2={p2}
          cycleStatusGlobal={cycleStatusGlobal}
          onDelete={deleteMissionGlobal}
          setActiveTab={setActiveTab}
          update={update}
          onSync={smartSync}
          syncing={syncing}
        />}
      </div>

      {/* Tutorial overlay */}
      {tutorialStep !== null && <TutorialOverlay step={tutorialStep} onNext={tutorialNext} onBack={tutorialBack} onSkip={tutorialSkip} onFinish={tutorialFinish} />}

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
