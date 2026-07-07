import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { loadData, loadDataWithVersion, loadFromNormalized, saveData, saveWithRetry, saveLocalBackup, loadLocalBackup, exportData, importData, signOut, getSession, onAuthChange, getMyCoupleId, subscribeToUpdates, repairGoalIdLinks, loadMessages, subscribeToMessages } from "./supabase.js";
import { isValidAppData } from "./lib/validation.js";
import supabase from "./supabase.js";
import Toast, { useToast } from "./components/Toast.jsx";
import HomeDashboard from "./components/HomeDashboard.jsx";
import WeekTimeline from "./components/WeekTimeline.jsx";
import FilterDrawer, { FilterButton } from "./components/FilterDrawer.jsx";
const LinksView = lazy(() => import("./components/LinksView.jsx"));
import { useConfirm } from "./components/ConfirmModal.jsx";
import { SkeletonDashboard } from "./components/Skeleton.jsx";
import { uid, isoWeekKey, getWeekAndYear, isTodayMonday, isoWeeksInYear, localDateStr, withTimeout } from "./utils.js";
import { APP_VERSION, SEED_VERSION, THEMES, MAINTENANCE_WARNING, STATUS_ORDER, STATUS, CATEGORIES, getMCats, DEFAULT_COLORS } from "./constants.js";
import { S } from "./styles.js";
import WorkHoursCard from "./components/WorkHoursCard.jsx";
import AddMissionForm from "./components/AddMissionForm.jsx";
import MissionCard from "./components/MissionCard.jsx";
import { track, setTrackContext, clearTrackContext } from "./lib/track.js";
import { isEnabled } from "./lib/flags.js";
import { saveWithCAS, insertNormalizedMission, deleteNormalizedMission, updateNormalizedMissionStatus, updateNormalizedMission } from "./lib/repo.js";
import JuntosMoment from "./components/JuntosMoment.jsx";
import TaskCongrat from "./components/TaskCongrat.jsx";
const WrappedModal = lazy(() => import("./components/WrappedModal.jsx"));
import SpecialDayOverlay from "./components/SpecialDayOverlay.jsx";
import SpecialDayTheme from "./components/SpecialDayTheme.jsx";
import SpecialDayButton from "./components/SpecialDayButton.jsx";
import ClickSparkles from "./components/ClickSparkles.jsx";
import MatchDayTheme from "./components/MatchDayTheme.jsx";
import MatchDayOverlay from "./components/MatchDayOverlay.jsx";
const BirthdaysView = lazy(() => import("./components/BirthdaysView.jsx"));
const MoodSurvey = lazy(() => import("./components/MoodSurvey.jsx"));
const MoodView = lazy(() => import("./components/MoodView.jsx"));
const WishlistView = lazy(() => import("./components/WishlistView.jsx"));
import { rebaseMutators } from "./lib/save.js";

import DevBackfillPanel from "./components/DevBackfillPanel.jsx";
const GoalsView = lazy(() => import("./views/GoalsView.jsx"));
import { subscribePush, unsubscribePush, getCurrentSubscription, isPushSupported, sendContextualPush } from "./lib/push.js";
import { fetchWCMatches, wcMatchesForDate, isWCOver } from "./lib/worldCup.js";
import LoginScreen from "./components/LoginScreen.jsx";
import GuestView from "./components/GuestView.jsx";
import ResetPasswordScreen from "./components/ResetPasswordScreen.jsx";
import OnboardingScreen from "./components/OnboardingScreen.jsx";
import TutorialOverlay, { TUTORIAL_STEPS } from "./components/TutorialOverlay.jsx";
const StatsView = lazy(() => import("./components/StatsView.jsx"));
const GastosView = lazy(() => import("./components/GastosView.jsx"));
const ProfileModal = lazy(() => import("./components/ProfileModal.jsx"));
import { getUserPrefs, saveUserPrefs } from "./lib/userPrefs.js";
import ThemeInjector from "./components/ThemeInjector.jsx";
import MaintenanceBanner from "./components/MaintenanceBanner.jsx";
const ChatView = lazy(() => import("./components/ChatView.jsx"));
const CalendarView = lazy(() => import("./components/CalendarView.jsx"));
const HistoryView = lazy(() => import("./components/HistoryView.jsx"));
const PendingView = lazy(() => import("./components/PendingView.jsx"));
import SideMenu from "./components/SideMenu.jsx";
import Topbar from "./components/Topbar.jsx";
import BottomTabBar from "./components/BottomTabBar.jsx";
import PullToRefresh from "./components/PullToRefresh.jsx";
const SearchOverlay = lazy(() => import("./components/SearchOverlay.jsx"));
const AvailabilityExport = lazy(() => import("./components/AvailabilityExport.jsx"));
const ActivityLog = lazy(() => import("./components/ActivityLog.jsx"));
const TimeCapsuleView = lazy(() => import("./components/TimeCapsuleView.jsx"));
const TimeCapsuleReveal = lazy(() => import("./components/TimeCapsuleReveal.jsx"));
import { useSwipe, repairMisplacedMissions, applyCarryOver, syncCarryDone, showNotif, clearRTimers, scheduleReminders, dlBlob, weekStartDate, fmtShortDate, fmtWeekRange } from "./lib/appUtils.js";




// Fallback visible para modales lazy (ProfileModal, WrappedModal, MoodSurvey) — sin esto,
// la primera vez que se abren (chunk aún no cacheado) la pantalla no muestra nada hasta que
// termina de descargar, y se percibe como que la app se quedó pegada.
function ModalLoadingFallback() {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:150, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"var(--t-text-muted,#8b7fa8)", fontSize:13 }}>Cargando…</div>
    </div>
  );
}

// ─── Seed ─────────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = { person1: "Persona 1", person2: "Persona 2", colors: { person1:"#f472b6", person2:"#a78bfa", together:"#34d399" }, notifications: { chat:true, partnerChanges:true, eventReminders:true, goalDeadlines:true, dailyBriefing:false, briefingTime:"08:00" } };




const { week: _seedWeek, year: _seedYear } = getWeekAndYear();
const SEED = {
  seedVersion: SEED_VERSION,
  currentWeekNumber: _seedWeek, currentYear: _seedYear,
  settings: DEFAULT_SETTINGS,
  goals: [],
  moods: [],
  weeks: {},
};



function dismissSplash() {
  const splash = document.getElementById("mp-splash");
  if (!splash) return;
  splash.classList.add("mp-hidden");
  setTimeout(() => splash.remove(), 380);
}

// ─── Auth wrapper ─────────────────────────────────────────────────────────────
const AUTH_CACHE_KEY = "shared-cal-auth-v1";

// Modo invitado: enlace de solo lectura (?guest=coupleId&token=...) — bypass
// total de sesión/auth, resuelto ANTES de montar AppWithAuth (no dentro de él:
// un early-return ahí rompería las reglas de hooks — CLAUDE.md, regla de
// scope — ya que AppWithAuth llama useState/useEffect/useRef después).
export default function App() {
  const guestParams = (() => {
    const p = new URLSearchParams(window.location.search);
    const g = p.get("guest"), t = p.get("token");
    return g && t ? { coupleId: g, token: t } : null;
  })();
  if (guestParams) return <GuestView coupleId={guestParams.coupleId} token={guestParams.token} />;
  return <AppWithAuth />;
}

function AppWithAuth() {
  // Instant startup: read cached couple synchronously (set on previous login, no network needed)
  const authCache = (() => { try { return JSON.parse(localStorage.getItem(AUTH_CACHE_KEY)||"null"); } catch { return null; } })();

  const [session,    setSession]    = useState(undefined);
  const [coupleData, setCoupleData] = useState(authCache);
  const [authStep,   setAuthStep]   = useState(authCache ? "app" : "checking");
  const resolveRef = useRef(null); // última closure de `resolve` — para re-invocarla tras el reset de contraseña

  useEffect(() => {
    // Single handler for initial session + every auth state change.
    // event === "PASSWORD_RECOVERY": el usuario llegó desde el link de "olvidé
    // mi contraseña" — Supabase ya generó una sesión válida, pero hay que
    // forzar el paso de elegir nueva contraseña antes de entrar a la app.
    const resolve = async (s, event) => {
      if (event === "PASSWORD_RECOVERY") { setSession(s); setAuthStep("reset-password"); return; }
      setSession(s);
      if (!s) {
        localStorage.removeItem(AUTH_CACHE_KEY);
        setCoupleData(null); setAuthStep("login"); return;
      }
      // Timeout duro (iOS WKWebView cuelga fetches tras cold start / background).
      // Ante red colgada o caída NO decidir nada destructivo: con cache la app
      // ya está montada con datos locales — dejarla; sin cache, a login (donde
      // reintentar es inocuo). Antes, este fallo borraba el cache y mandaba a
      // onboarding, como si el usuario no tuviera pareja.
      let cd;
      try {
        cd = await withTimeout(getMyCoupleId(), 8000, "getMyCoupleId");
      } catch (e) {
        console.warn("[auth] getMyCoupleId falló/colgó:", e.message);
        if (!authCache) setAuthStep("login");
        return;
      }
      if (cd?.couple_id) {
        localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ couple_id: cd.couple_id, person_name: cd.person_name }));
        setCoupleData(cd); setAuthStep("app");
      } else {
        localStorage.removeItem(AUTH_CACHE_KEY);
        setAuthStep("onboarding");
      }
    };
    resolveRef.current = resolve;
    // getSession lee el token local pero puede disparar un refresh POR RED —
    // en iOS ese refresh puede colgarse. Mismo criterio: timeout + no destruir.
    withTimeout(getSession(), 8000, "getSession")
      .then(s => resolve(s))
      .catch(e => {
        console.warn("[auth] getSession falló/colgó:", e.message);
        if (!authCache) setAuthStep("login");
      });
    const sub = onAuthChange(resolve);
    return () => sub.unsubscribe();
    // authCache deliberadamente fuera de deps: queremos el valor AL MONTAR
    // ("¿había cache cuando arrancó la app?"), no re-suscribir el auth listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authStep === "login" || authStep === "onboarding" || authStep === "reset-password") dismissSplash();
  }, [authStep]);

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
  if (authStep === "reset-password") return <ResetPasswordScreen onDone={() => resolveRef.current?.(session)} />;
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
  const unconfirmedRef  = useRef([]);    // mutators applied locally but not yet confirmed persisted (para rebase-on-conflict)
  const afterSaveRef    = useRef([]);    // callbacks que corren tras el PRÓXIMO save confirmado (push, etc.) — reemplaza setTimeout frágil
  const runSaveRef      = useRef(null);  // latest runSave closure, para que el timer de debounce siempre use coupleId actual
  const moodOuterTimerRef    = useRef(null); // outer 18:00 timer — stored in ref so recursive reschedule can clear it
  const moodInnerTimerRef    = useRef(null); // inner 1400ms delay timer before showing popup
  const matchDayTimerRef     = useRef(null); // 1200ms delay before showing match-day overlay
  const [activeTab,       setActiveTab]       = useState("home");
  const activeTabRef = useRef("home"); // ref espejo — regla de closures (CLAUDE.md): callbacks de larga vida no leen estado directamente
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [chatUnread,      setChatUnread]      = useState(0);
  const [searchOpen,      setSearchOpen]      = useState(false);
  const [availOpen,       setAvailOpen]       = useState(false);
  const [pendingMissionLink, setPendingMissionLink] = useState(null); // { wn, yr, missionId } — deep link de push, pendiente hasta que data cargue
  const [highlightMissionId, setHighlightMissionId] = useState(null); // resalta la tarjeta al llegar desde una notificación
  const [activityOpen,    setActivityOpen]    = useState(false);
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
  const [bottomBar, setBottomBar] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mp-bottom-bar") || "null") || { enabled: false, tabs: ["home","current","calendar","mood"] }; }
    catch { return { enabled: false, tabs: ["home","current","calendar","mood"] }; }
  });
  const updateBottomBar = cfg => { setBottomBar(cfg); localStorage.setItem("mp-bottom-bar", JSON.stringify(cfg)); };
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
  const [juntosMoment, setJuntosMoment] = useState(null);  // { mission, p1Name, p2Name, p1Color, p2Color }
  const [taskCongrat,  setTaskCongrat]  = useState(null);  // { mission, beforePct, afterPct, delta, color }
  const [wrappedConfig, setWrappedConfig] = useState(null); // { showWeekly, showMonthlyOption, prevKey, monthKey }
  const [specialDay,      setSpecialDay]      = useState(null);   // overlay open state — null when dismissed
  const [specialDayEvent, setSpecialDayEvent] = useState(null);   // persists all day once detected
  const [matchDayMatches, setMatchDayMatches] = useState(null);   // WC matches today (filtered) — null = none
  const [matchDayOverlay, setMatchDayOverlay] = useState(false);  // overlay open
  const [capsuleNudge,    setCapsuleNudge]    = useState(false);  // aviso "tienes una cápsula lista" — 1x/día, nunca se auto-abre
  const [viewingCapsule,  setViewingCapsule]  = useState(null);   // capsule object en vista, o null
  const [moodSurveyOpen,    setMoodSurveyOpen]    = useState(false);
  const [moodSurveyPrefill, setMoodSurveyPrefill] = useState(null); // null | "person1" | "person2"
  const [moodEditEntry,     setMoodEditEntry]     = useState(null);  // mood entry being edited, or null

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
      // Timeout: sin él, un fetch colgado (iOS) dejaba el spinner girando para siempre
      const { data: remote, version } = await withTimeout(loadDataWithVersion(coupleId), 10000, "smartSync");
      if (remote) {
        // Sync version BEFORE setState so the next save uses the correct version
        dataVersionRef.current = version ?? null;
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
      await withTimeout(saveWithRetry(data, coupleId), 20000, "forcePush");
      // Resync de versión: saveWithRetry bypassa CAS, el trigger incrementó la versión.
      await withTimeout(loadDataWithVersion(coupleId), 10000, "forcePush:version").then(({ version }) => { dataVersionRef.current = version ?? null; }).catch(() => { dataVersionRef.current = null; });
      // Read back updated_at — set by BEFORE UPDATE trigger, ground truth that the write landed
      const { data: row, error: readErr } = await withTimeout(supabase
        .from("app_data")
        .select("updated_at")
        .eq("id", coupleId)
        .single(), 10000, "forcePush:verify");
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
      // Timeout duro en TODOS los awaits de este bloque: en iOS un fetch colgado
      // aquí dejaba loading=true para siempre → splash/skeletons infinitos.
      // Al expirar, base=null activa el fallback existente (backup local o SEED).
      try {
        let base = await withTimeout(
          isEnabled("read_from_normalized") ? loadFromNormalized(coupleId) : loadData(coupleId),
          10000, "loadData"
        ).catch(e => { console.warn("[load]", e.message); return null; });
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
        if (isTodayMonday()) {
          const beforeCarry = base;
          base = applyCarryOver(base);
          // Insert any new carried/series missions into normalized table
          const currKey = isoWeekKey(base.currentWeekNumber, base.currentYear);
          const beforeIds = new Set((beforeCarry.weeks[currKey]?.missions || []).map(m => m.id));
          for (const m of (base.weeks[currKey]?.missions || [])) {
            if (!beforeIds.has(m.id)) {
              insertNormalizedMission(coupleId, currKey, base.currentWeekNumber, base.currentYear, m)
                .catch(e => console.error("[dual_write] carry insert:", e));
            }
          }
          didMigrate = true;
        }
        const { data: repaired, moved: repairedCount } = repairMisplacedMissions(base);
        if (repairedCount > 0) { base = repaired; didMigrate = true; }

        const goalRepaired = await withTimeout(repairGoalIdLinks(coupleId, base), 8000, "repairGoalIdLinks")
          .catch(e => { console.warn("[load]", e.message); return null; });
        if (goalRepaired) { base = goalRepaired; didMigrate = true; }

        if (!base.birthdays) { base = { ...base, birthdays: [] }; didMigrate = true; }

        setData(base);

        // Best-effort: si el save de migración cuelga, no bloquear el arranque —
        // el sistema de saves debounced lo reintentará con la próxima edición.
        if (isRealData && didMigrate) await withTimeout(saveData(base, coupleId), 15000, "migrateSave")
          .catch(e => console.warn("[load] migrate save:", e.message));
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

  // Dismiss the HTML splash screen once data is ready (covers the Supabase load wait)
  useEffect(() => {
    if (!loading) dismissSplash();
  }, [loading]);

  // ─── Contador de mensajes de chat no leídos ────────────────────────────────
  // Vive aquí (no en ChatView) para que el badge se vea desde cualquier pestaña.
  useEffect(() => {
    if (!coupleId) return;
    const key = `mp-chat-lastread-${coupleId}`;
    let lastRead = Number(localStorage.getItem(key));
    if (!lastRead) {
      // Primera vez con esta feature: no marcar todo el historial como no leído
      lastRead = Date.now();
      try { localStorage.setItem(key, String(lastRead)); } catch { /* modo privado */ }
    }
    loadMessages(coupleId).then(msgs => {
      setChatUnread(msgs.filter(m => m.sender_name !== personName && new Date(m.created_at).getTime() > lastRead).length);
    });
    const ch = subscribeToMessages(coupleId, msg => {
      if (msg.sender_name === personName) return;
      if (activeTabRef.current === "chat" && document.visibilityState === "visible") {
        try { localStorage.setItem(key, String(Date.now())); } catch { /* modo privado */ }
        return; // lo está viendo en vivo — no cuenta como no leído
      }
      setChatUnread(u => u + 1);
    }, `chat-unread-${coupleId}`);
    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId]);

  // Al abrir la pestaña de chat, marcar todo como leído
  useEffect(() => {
    activeTabRef.current = activeTab;
    if (activeTab === "chat") {
      setChatUnread(0);
      try { localStorage.setItem(`mp-chat-lastread-${coupleId}`, String(Date.now())); } catch { /* modo privado */ }
    }
  }, [activeTab, coupleId]);

  // Badge en el icono de la app instalada (Badging API): nº de mensajes sin leer.
  // iOS 16.4+ (con permiso de notificaciones), Android/desktop Chrome.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) return;
    if (chatUnread > 0) navigator.setAppBadge(chatUnread).catch(() => {});
    else navigator.clearAppBadge().catch(() => {});
  }, [chatUnread]);

  // Deep links: shortcuts del manifest (?tab=chat, ?action=add) y notificaciones
  // push que apuntan a una misión concreta (?tab=current&wn=&yr=&mission=). El
  // destino "mission" se guarda en estado y se aplica más abajo, una vez que
  // `data` está cargado — update() lo descartaría (isValidAppData) si se llama
  // antes de que exista data.weeks.
  const applyDeepLinkParams = useCallback(params => {
    const tab = params.get("tab");
    const action = params.get("action");
    const wn = parseInt(params.get("wn"));
    const yr = parseInt(params.get("yr"));
    const missionId = params.get("mission");
    const VALID = ["home","current","calendar","pending","goals","stats","history","wishlist","mood","gastos","chat","links","birthdays","timecapsule"];
    if (tab && VALID.includes(tab)) setActiveTab(tab);
    if (action === "add") { setActiveTab("current"); setShowAddForm(true); }
    if (missionId && wn && yr) setPendingMissionLink({ wn, yr, missionId });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    applyDeepLinkParams(params);
    // Limpiar la query para que un refresh no re-dispare la acción
    if (params.toString()) window.history.replaceState(null, "", window.location.pathname);
  }, [applyDeepLinkParams]);

  // La app puede ya estar abierta (en background) cuando se toca la notificación
  // — el SW no recarga la página en ese caso, solo la enfoca y nos avisa por
  // postMessage con el destino. Sin esto, el click en el push no llevaba a
  // ningún lado si la PWA ya estaba corriendo.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = e => {
      if (e.data?.type !== "PUSH_NAVIGATE" || !e.data.url) return;
      applyDeepLinkParams(new URL(e.data.url, window.location.origin).searchParams);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [applyDeepLinkParams]);

  // Auto-launch tutorial on first visit
  useEffect(() => {
    if (!loading && coupleId && !localStorage.getItem("shared-cal-tutorial-v1")) {
      const t = setTimeout(() => setTutorialStep(0), 700);
      return () => clearTimeout(t);
    }
  }, [loading, coupleId]);

  // Weekly / Monthly Wrapped gate
  useEffect(() => {
    if (loading || !coupleId || !data) return;
    const today = new Date();
    const isMonday      = today.getDay() === 1;
    const isFirstOfMonth = today.getDate() === 1;
    if (!isMonday && !isFirstOfMonth) return;
    // Previous week key
    const prevDate = new Date(today); prevDate.setDate(today.getDate() - 7);
    const { week: pw, year: py } = getWeekAndYear(prevDate);
    const prevKey  = isoWeekKey(pw, py);
    const monthKey = `${today.getFullYear()}-${today.getMonth()}`;
    const weeklyDue   = isMonday && !localStorage.getItem(`mp-wrapped-wk-${prevKey}`);
    const monthlyDue  = isFirstOfMonth && !localStorage.getItem(`mp-wrapped-mo-${monthKey}`);
    if (!weeklyDue && !monthlyDue) return;
    // Only show weekly if there's actual data for that week
    const hasPrevWeek = (data.weeks[prevKey]?.missions?.length || 0) > 0;
    if (!hasPrevWeek && !monthlyDue) return;
    const t = setTimeout(() => setWrappedConfig({
      showWeekly: weeklyDue && hasPrevWeek,
      showMonthlyOption: monthlyDue,
      prevKey, monthKey,
    }), 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, coupleId]);

  // Special day detection — all-day theme + floating button (no localStorage gate)
  useEffect(() => {
    if (loading || !coupleId || !data?.settings) return;
    const today = new Date();
    const mmdd  = `${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    const s = data.settings;
    let event = null;
    if (s.person1Birthday === mmdd) event = { type:"birthday", name: p1, who:"person1" };
    else if (s.person2Birthday === mmdd) event = { type:"birthday", name: p2, who:"person2" };
    else if (s.anniversaryDate) {
      const aMMDD = s.anniversaryDate.slice(5);
      if (aMMDD === mmdd) {
        const years = today.getFullYear() - parseInt(s.anniversaryDate.slice(0,4));
        event = { type:"anniversary", years: years > 0 ? years : null };
      }
    }
    setSpecialDayEvent(event);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, coupleId, data?.settings?.person1Birthday, data?.settings?.person2Birthday, data?.settings?.anniversaryDate]);

  // Special day overlay — shown once per calendar day
  useEffect(() => {
    if (loading || !coupleId || !data?.settings) return;
    const today = new Date();
    const mmdd  = `${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    const key   = `mp-special-${today.toDateString()}`;
    if (localStorage.getItem(key)) return;
    const s = data.settings;
    let event = null;
    if (s.person1Birthday === mmdd) event = { type:"birthday", name: p1, who:"person1" };
    else if (s.person2Birthday === mmdd) event = { type:"birthday", name: p2, who:"person2" };
    else if (s.anniversaryDate) {
      const aMMDD = s.anniversaryDate.slice(5);
      if (aMMDD === mmdd) {
        const years = today.getFullYear() - parseInt(s.anniversaryDate.slice(0,4));
        event = { type:"anniversary", years: years > 0 ? years : null };
      }
    }
    if (!event) return;
    localStorage.setItem(key, "1");
    const t = setTimeout(() => setSpecialDay(event), 900);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, coupleId, data?.settings?.person1Birthday, data?.settings?.person2Birthday, data?.settings?.anniversaryDate]);

  // Cápsula del tiempo lista para abrir — aviso suave 1x/día, NUNCA se auto-abre
  // (a diferencia de cumpleaños/aniversario, un mensaje del pasado puede llegar
  // en mal momento — que la pareja decida cuándo leerlo).
  useEffect(() => {
    if (loading || !coupleId) return;
    const today = localDateStr();
    const hasOpenable = (data?.timeCapsules || []).some(c => c.unlockDate <= today && !c.viewedAt);
    if (!hasOpenable) return;
    const key = `mp-capsule-nudge-${today}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    const t = setTimeout(() => setCapsuleNudge(true), 1300);
    return () => clearTimeout(t);
  }, [loading, coupleId, data?.timeCapsules]);

  // Match day detection — check WC matches for today with the active filter
  const checkMatchDay = useCallback(async () => {
    if (isWCOver()) { setMatchDayMatches(null); return; }
    const wcMode = localStorage.getItem("mp-wc-mode") === "1";
    if (!wcMode) { setMatchDayMatches(null); return; }
    const matches = await fetchWCMatches().catch(() => null);
    if (!matches) { setMatchDayMatches(null); return; }
    const todayStr = localDateStr();
    let todayMatches = wcMatchesForDate(matches, todayStr);
    try {
      const filter = JSON.parse(localStorage.getItem("mp-wc-filter") || "[]");
      if (filter.length > 0) {
        todayMatches = todayMatches.filter(m => filter.includes(m.home) || filter.includes(m.away));
      }
    } catch {}
    if (todayMatches.length === 0) { setMatchDayMatches(null); return; }
    setMatchDayMatches(todayMatches);
    // Show overlay once per day
    const key = `mp-matchday-${todayStr}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, "1");
      matchDayTimerRef.current = setTimeout(() => setMatchDayOverlay(true), 1200);
    }
  }, []);

  useEffect(() => {
    checkMatchDay();
  }, [checkMatchDay]);

  // Re-check when the user changes the filter or WC mode from CalendarView
  useEffect(() => {
    const handler = () => checkMatchDay();
    window.addEventListener("wcFilterChange", handler);
    return () => window.removeEventListener("wcFilterChange", handler);
  }, [checkMatchDay]);

  // Birthday reminders (toast: today + day before)
  useEffect(() => {
    if (loading || !data?.birthdays?.length) return;
    const today = new Date();
    const todayStr    = `${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    const tomorrowD   = new Date(today); tomorrowD.setDate(today.getDate()+1);
    const tomorrowStr = `${String(tomorrowD.getMonth()+1).padStart(2,"0")}-${String(tomorrowD.getDate()).padStart(2,"0")}`;
    const toastKey    = `mp-bday-toast-${today.toDateString()}`;
    if (localStorage.getItem(toastKey)) return;
    const todays    = data.birthdays.filter(b => b.date === todayStr);
    const tomorrows = data.birthdays.filter(b => b.date === tomorrowStr);
    if (!todays.length && !tomorrows.length) return;
    localStorage.setItem(toastKey, "1");
    todays.forEach(b => pushToast({ kind:"success", text:`🎂 ¡Hoy es el cumpleaños de ${b.name}!` }));
    tomorrows.forEach(b => pushToast({ kind:"info", text:`🎂 Mañana es el cumpleaños de ${b.name}` }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data?.birthdays]);

  // Mood survey auto-trigger: shows once per day after 18:00
  useEffect(() => {
    if (loading || !data) return;
    const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

    const openSurvey = () => {
      if (sessionUserId && getUserPrefs(sessionUserId).moodNotifEnabled === false) return;
      const today = localDateStr();
      const p1Done = lsGet(`mp-mood-done-person1-${today}`);
      const p2Done = lsGet(`mp-mood-done-person2-${today}`);
      if (p1Done && p2Done) return;
      const autoKey = `mp-mood-autoshow-${today}`;
      if (lsGet(autoKey)) return;
      const prefill = (!p1Done && p2Done) ? "person1" : (p1Done && !p2Done) ? "person2" : null;
      setMoodSurveyPrefill(prefill);
      moodInnerTimerRef.current = setTimeout(() => { lsSet(autoKey, "1"); setMoodSurveyOpen(true); }, 1400);
    };

    // Recursive: after firing, reschedules for next day at 18:00 — keeps working across midnight
    const scheduleFor18 = () => {
      const now = new Date();
      if (now.getHours() >= 18) {
        openSurvey();
        const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(18, 0, 0, 0);
        moodOuterTimerRef.current = setTimeout(scheduleFor18, tomorrow - now);
      } else {
        const fireAt = new Date(now); fireAt.setHours(18, 0, 0, 0);
        moodOuterTimerRef.current = setTimeout(scheduleFor18, fireAt - now);
      }
    };
    scheduleFor18();
    return () => {
      clearTimeout(moodOuterTimerRef.current);
      clearTimeout(moodInnerTimerRef.current);
      clearTimeout(matchDayTimerRef.current);
    };
  }, [loading]); // eslint-disable-line

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
    const channel = subscribeToUpdates(coupleId, (remoteData, remoteVersion) => {
      // hasPendingSave guard in subscribeToUpdates ensures we only reach here when safe
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      // CRÍTICO: sincronizar la versión con la DB. Sin esto, el siguiente save
      // dispara un conflicto CAS falso y se pierde la edición del usuario.
      if (typeof remoteVersion === "number") dataVersionRef.current = remoteVersion;
      setSavingState("idle");
      if (notifSettingsRef.current?.partnerChanges && document.visibilityState!=="visible") {
        showNotif("📅 Misiones de Pareja", "Tu pareja actualizó el calendario", {tag:"partner-update"});
      }
      if (isPushSupported() && !pushSubscribedRef.current && !pushNudgeDismissRef.current) {
        setPushNudgeVisible(true);
        setTimeout(() => setPushNudgeVisible(false), 8000);
      }
      setData(() => remoteData);
    }, () => pendingSaveRef.current || !!saveTimerRef.current || isSavingRef.current || unconfirmedRef.current.length > 0);
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
      } else if (document.visibilityState === "visible" && !saveTimerRef.current && !isSavingRef.current && unconfirmedRef.current.length === 0 && coupleId) {
        // Realtime no recupera eventos perdidos tras reconexión del WebSocket.
        // Re-fetch silencioso (data + version juntas) para sincronizar cambios que
        // llegaron mientras la pestaña estaba en segundo plano. Solo si NO hay
        // ediciones locales sin guardar — si las hay, el rebase-on-conflict las protege.
        loadDataWithVersion(coupleId).then(({ data: fresh, version }) => {
          if (fresh && isValidAppData(fresh)) {
            setData(fresh);
            dataVersionRef.current = version ?? null;
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

  // Retry pending save when reconnecting — vía el path unificado (CAS + rebase)
  useEffect(() => {
    if (isOnline && coupleId && (pendingSave || unconfirmedRef.current.length > 0)) {
      scheduleSave();
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
      // Sin esto, un error de push solo queda visible mientras el usuario tenga
      // Perfil abierto y se acuerde de copiarlo — quedó documentado 2+ sesiones
      // como "sale un error visible" sin el texto exacto. Con esto, la próxima
      // vez que pase, el texto real queda en analytics aunque el usuario no
      // lo reporte a mano.
      track("push_toggle_error", { name: e.name || "Error", message: msg.slice(0, 200), wasSubscribed: wasPushSubscribed });
    } finally {
      setPushLoading(false);
    }
  };

  // ─── Núcleo de guardado (rediseño v4.2.0) ────────────────────────────────
  //
  // Modelo: UN solo path serializado con CAS + rebase-on-conflict.
  //
  //  • Cada update(fn) aplica el cambio de forma optimista y guarda el mutador
  //    en unconfirmedRef hasta que el save se confirma.
  //  • runSave es el ÚNICO escritor; nunca corre en paralelo consigo mismo
  //    (isSavingRef serializa; si está ocupado, reprograma).
  //  • CAS detecta si la pareja guardó primero (versión desfasada). En vez de
  //    DESCARTAR el cambio del usuario (bug histórico de pérdida de datos),
  //    recarga los datos frescos de la pareja y RE-APLICA encima los mutadores
  //    no confirmados (rebase). Así nunca se pierde ni el cambio propio ni el
  //    de la pareja, y se reintenta con la versión correcta.
  //  • Si CAS no está disponible (flag off o versión no cargada) cae a un
  //    last-write-wins seguro con saveWithRetry y resincroniza la versión.
  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      if (runSaveRef.current) runSaveRef.current();
    }, 700);
  }, []);

  const runSave = useCallback(async () => {
    if (!coupleId) return;
    // Serializar: nunca dos saves en vuelo a la vez.
    if (isSavingRef.current) { scheduleSave(); return; }
    const cur = dataRef.current;
    if (!cur || !isValidAppData(cur)) return;

    // Sin conexión: no tiene sentido gastar un intento de red que sabemos que
    // va a fallar (ni mostrar "⚠ Error al guardar" — estar offline no es un
    // error). Backup local ahora mismo; el efecto de reconexión más abajo
    // dispara scheduleSave() en cuanto vuelva la señal (evento 'online').
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      saveLocalBackup(cur, coupleId);
      setPendingSave(true);
      return;
    }

    isSavingRef.current = true;
    let toSave = cur;
    // Backup local INMEDIATO, antes de intentar la red. El banner offline le
    // promete al usuario "tus cambios se guardan localmente" — pero hasta
    // ahora saveLocalBackup solo corría en las ramas de ÉXITO del save remoto.
    // Sin conexión, el save remoto SIEMPRE falla, así que el backup local
    // nunca se actualizaba: cerrar la app offline con cambios sin sincronizar
    // los perdía al volver a abrirla (loadLocalBackup traía la foto vieja).
    saveLocalBackup(cur, coupleId);
    // Snapshot de los mutadores que intentamos confirmar en esta ronda.
    let confirming = unconfirmedRef.current.slice();
    try {
      // Timeout duro en cada await de red: en iOS un fetch colgado aquí dejaba
      // isSavingRef=true PARA SIEMPRE → todos los saves posteriores quedaban
      // encolados sin ejecutarse y el indicador "guardando" no salía más. Al
      // expirar, el catch de abajo marca error y el finally libera el lock;
      // scheduleSave() reintenta con los mutadores aún sin confirmar.
      const casOn = isEnabled("cas_version_check");
      if (casOn && dataVersionRef.current === null) {
        const { version } = await withTimeout(loadDataWithVersion(coupleId), 10000, "save:loadVersion");
        dataVersionRef.current = version ?? null;
      }

      if (!casOn || dataVersionRef.current === null) {
        // Fallback seguro: last-write-wins + resync de versión.
        await withTimeout(saveWithRetry(toSave, coupleId, { getLatestData: () => dataRef.current }), 20000, "saveWithRetry");
        const { version } = await withTimeout(loadDataWithVersion(coupleId), 10000, "save:resyncVersion").catch(() => ({ version: null }));
        dataVersionRef.current = version ?? null;
        saveLocalBackup(toSave, coupleId);
      } else {
        let saved = false;
        for (let attempt = 0; attempt < 6 && !saved; attempt++) {
          const result = await withTimeout(saveWithCAS(coupleId, toSave, dataVersionRef.current), 15000, "saveWithCAS");
          if (result.success) {
            dataVersionRef.current = result.newVersion;
            saveLocalBackup(toSave, coupleId);
            saved = true;
          } else if (result.conflict) {
            // La pareja guardó primero. Recargar fresco y RE-APLICAR nuestros
            // mutadores encima — no descartamos nada.
            track("cas_conflict", { couple_id: coupleId });
            const { data: fresh, version } = await withTimeout(loadDataWithVersion(coupleId), 10000, "save:reloadConflict");
            if (!fresh || !isValidAppData(fresh) || version == null) {
              throw new Error("No se pudo recargar para fusionar tus cambios");
            }
            dataVersionRef.current = version;
            confirming = unconfirmedRef.current.slice(); // incluye edits llegados durante el save
            const rebased = rebaseMutators(fresh, confirming, isValidAppData);
            toSave = rebased;
            setData(rebased); // reflejar el merge en la UI
          } else {
            // casDisabled / error transitorio del RPC → last-write-wins.
            await withTimeout(saveWithRetry(toSave, coupleId, { getLatestData: () => dataRef.current }), 20000, "save:fallbackRetry");
            const { version } = await withTimeout(loadDataWithVersion(coupleId), 10000, "save:fallbackVersion").catch(() => ({ version: null }));
            dataVersionRef.current = version ?? null;
            saveLocalBackup(toSave, coupleId);
            saved = true;
          }
        }
        if (!saved) throw new Error("Conflictos repetidos al guardar — reintentando");
      }

      // Confirmado: quitar de unconfirmedRef exactamente los mutadores persistidos.
      const done = new Set(confirming);
      unconfirmedRef.current = unconfirmedRef.current.filter(m => !done.has(m));
      setSyncError(null);
      if (unconfirmedRef.current.length === 0) setPendingSave(false);
      setSavingState("saved");
      pushToast({ kind: "success", text: "✅ Guardado" });
      setTimeout(() => setSavingState("idle"), 2000);
      // El blob ya está en la DB: ahora sí es seguro disparar push/efectos que
      // dependen de que la pareja pueda leer los datos frescos. Reemplaza el
      // antiguo setTimeout(1500) frágil — esto espera la confirmación real.
      if (afterSaveRef.current.length) {
        const cbs = afterSaveRef.current;
        afterSaveRef.current = [];
        for (const cb of cbs) { try { cb(); } catch (err) { console.error("[afterSave]", err); } }
      }
    } catch (e) {
      setSyncError(e.message);
      setPendingSave(true);
      setSavingState("error");
      showSyncMsg("⚠ Error al guardar — reintentando…");
    } finally {
      isSavingRef.current = false;
    }
    // Si llegaron más cambios mientras guardábamos (o falló), reprogramar.
    if (unconfirmedRef.current.length) scheduleSave();
  }, [coupleId, scheduleSave, pushToast]);

  useEffect(() => { runSaveRef.current = runSave; }, [runSave]);

  // IMPORTANTE: el `fn` pasado a update DEBE ser puro (sin efectos secundarios).
  // runSave lo re-aplica sobre datos frescos en un conflicto CAS (rebase), así que
  // cualquier efecto dentro de `fn` se dispararía de nuevo. Los efectos (track, push,
  // dual-write, alert) van en el handler que llama a update, nunca dentro del reducer.
  const update = useCallback(fn => {
    setData(prev => {
      const next = fn(prev);
      if (!isValidAppData(next)) {
        console.error("[save] isValidAppData failed — cambio descartado. Tamaño:", JSON.stringify(next).length);
        track("save_validation_failed", {
          size: JSON.stringify(next).length,
          keys: Object.keys(next || {}).join(",").slice(0, 100),
        });
        pushToast({ kind: "error", text: "⚠️ Error de validación — el cambio no se aplicó. Recarga la app si el problema persiste." });
        return prev; // conservar el último estado bueno; no registrar ni guardar
      }
      // Registrar el mutador para rebase-on-conflict + programar el save, solo en
      // el camino válido. Dedupe defensivo contra el doble-invoke de StrictMode.
      const list = unconfirmedRef.current;
      if (list[list.length - 1] !== fn) list.push(fn);
      scheduleSave();
      return next;
    });
    setSavingState("saving");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleSave]);

  // Aplica el destino "mission" del deep link (push/búsqueda) en cuanto los
  // datos están listos, y resalta la tarjeta unos segundos para que se note
  // cuál es. Debe ir después de update() — su deps array se evalúa al declarar
  // el efecto, así que referenciar `update` antes de su const lanza un
  // ReferenceError ("Cannot access before initialization"), a diferencia del
  // callback del efecto (que sí puede referenciar código declarado más abajo,
  // porque no se ejecuta hasta después de terminar el render).
  useEffect(() => {
    if (!pendingMissionLink || loading) return;
    const { wn, yr, missionId } = pendingMissionLink;
    setPendingMissionLink(null);
    update(d => ({ ...d, currentWeekNumber: wn, currentYear: yr }));
    setHighlightMissionId(missionId);
    const t = setTimeout(() => setHighlightMissionId(cur => cur === missionId ? null : cur), 3000);
    return () => clearTimeout(t);
  }, [pendingMissionLink, loading, update]);

  // Encola un efecto que solo debe correr DESPUÉS de que el blob esté persistido
  // en la DB (ej. push a la pareja — necesita que pueda leer los datos frescos).
  // Si no hay nada pendiente de guardar, corre en el siguiente tick.
  const runAfterSave = useCallback(fn => {
    afterSaveRef.current.push(fn);
    if (!isSavingRef.current && !saveTimerRef.current && unconfirmedRef.current.length === 0) {
      // Nada que guardar — no habrá ciclo de save que vacíe la cola; correr ya.
      const cbs = afterSaveRef.current;
      afterSaveRef.current = [];
      for (const cb of cbs) { try { cb(); } catch (err) { console.error("[afterSave]", err); } }
    }
  }, []);

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
  const sessionPersonId = personName === p1 ? "person1" : personName === p2 ? "person2" : null;
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
      // Sincronizar la versión DESPUÉS de que el save confirmado llegue a la DB,
      // no con un delay fijo. Evita el CAS conflict falso si el save tarda más de 1.2s.
      if (coupleId) runAfterSave(() => {
        loadDataWithVersion(coupleId)
          .then(({ version }) => { dataVersionRef.current = version; })
          .catch(() => { dataVersionRef.current = null; });
      });
      setImportMsg("✅ Datos restaurados correctamente");
      setTimeout(() => setImportMsg(null), 2500);
    } catch (err) { setImportMsg("❌ " + err.message); setTimeout(() => setImportMsg(null), 3500); }
    e.target.value = "";
  };
  const wkey = isoWeekKey(data.currentWeekNumber, data.currentYear);
  const week = data.weeks[wkey] || { weekNumber:data.currentWeekNumber, year:data.currentYear, epicObjective:"", missions:[], createdAt:Date.now(), workHours:{person1:0,person2:0} };
  const patchWeek = fn => update(d => ({ ...d, weeks: { ...d.weeks, [wkey]: fn(d.weeks[wkey] || week) } }));

  // URL de destino al tocar la notificación push de una misión — ver sw.js
  // (notificationclick) y el deep-link handler más arriba en este componente.
  const missionPushUrl = (wn, yr, missionId) => `/?tab=current&wn=${wn}&yr=${yr}&mission=${missionId}`;

  // Historial de actividad (data.activity, cap 60): la entrada se crea en el
  // handler (id/ts fijos) y se añade con un update() propio — reducer puro e
  // idempotente (guard por id: el rebase puede re-aplicar el mutador).
  const logActivity = text => {
    const entry = { id: uid(), ts: Date.now(), w: sessionPersonId, text };
    update(d => {
      if ((d.activity || []).some(a => a.id === entry.id)) return d;
      return { ...d, activity: [entry, ...(d.activity || [])].slice(0, 60) };
    });
  };

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
    // Push tras el save confirmado: la pareja recibe la notificación solo cuando
    // los datos frescos ya están en la DB y puede leerlos (no antes).
    const pushBody = `${personName} ${isEv?"añadió un evento":"añadió una tarea"}: ${newM.emoji} ${newM.title.trim()}`;
    const pushTag = isEv?"mp-event-add":"mp-mission-add";
    runAfterSave(() => sendContextualPush(coupleId, { body:pushBody, tag:pushTag, url:missionPushUrl(data.currentWeekNumber, data.currentYear, mission.id) }, sessionUserId));
    logActivity(`añadió ${isEv?"el evento":"la tarea"} ${mission.emoji} «${mission.title}»${mission.date?` (${mission.date}${mission.time?` ${mission.time}`:""})`:""}`);
    setNewM({ emoji:"🎯", title:"", status:"TBC", date:"", time:"", endDate:"", endTime:"", categories:[], who:"together", duration:0, goalId:null, type:"task", seriesPattern:"", seriesEndDate:"", reminder:"none" });
    setShowAddForm(false);
  };

  const cycleStatus = id => {
    const wCur = data.weeks[wkey];
    const mCur = wCur?.missions?.find(x => x.id === id);
    const nx = mCur ? STATUS_ORDER[(STATUS_ORDER.indexOf(mCur.status)+1)%STATUS_ORDER.length] : null;
    // Reducer puro (se re-aplica en rebase): los efectos van fuera.
    update(d => {
      const w = d.weeks[wkey]; if (!w) return d;
      const m = w.missions.find(x=>x.id===id); if (!m) return d;
      const nxx = STATUS_ORDER[(STATUS_ORDER.indexOf(m.status)+1)%STATUS_ORDER.length];
      let next = { ...d, weeks: { ...d.weeks, [wkey]: { ...w, missions: w.missions.map(x => x.id===id ? {...x, status:nxx, completedAt:nxx==="DONE"?Date.now():null} : x) } } };
      if (nxx==="DONE" && m.carriedFrom) next = syncCarryDone(next, wkey, id);
      return next;
    });
    if (nx === "DONE" && mCur) track("mission_completed", { who: mCur.who, hasGoal: !!mCur.goalId, week: wCur?.weekNumber });
    if (nx === "DONE" && mCur) logActivity(`completó ${mCur.emoji||"🎯"} «${mCur.title}»`);
    if (nx === "DONE" && mCur) { const b = `${personName} completó: ${mCur.emoji||"🎯"} ${mCur.title}`; runAfterSave(() => sendContextualPush(coupleId, { body:b, tag:"mp-mission-done", url:missionPushUrl(data.currentWeekNumber, data.currentYear, id) }, sessionUserId)); }
    if (nx) pushToast({ kind: "success", text: `${STATUS[nx].icon} ${STATUS[nx].label}` });
    if (nx) updateNormalizedMissionStatus(coupleId, id, nx).catch(e => console.error("[dual_write] status:", e));
    if (nx === "DONE" && mCur) {
      const clr = { ...DEFAULT_COLORS, ...(data.settings?.colors||{}) };
      if (mCur.who === "together") {
        setJuntosMoment({ mission: mCur, p1Name: p1, p2Name: p2, p1Color: clr.person1, p2Color: clr.person2 });
      } else {
        // Fórmula idéntica al anillo personal de HomeDashboard:
        // últimos 15 días, excluyendo eventos / futuras / completedLate,
        // incluyendo misiones del dueño + "together"
        const todayStr = localDateStr();
        const { week: tWn, year: tYr } = getWeekAndYear(new Date());
        const todayWkey = isoWeekKey(tWn, tYr);
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14);
        const { week: cWn, year: cYr } = getWeekAndYear(cutoff);
        const cutoffWkey = isoWeekKey(cWn, cYr);
        const last15 = Object.entries(data.weeks)
          .filter(([k]) => k >= cutoffWkey && k <= todayWkey)
          .flatMap(([,w]) => (w.missions||[]).filter(m => m.type !== "event" && (!m.date || m.date <= todayStr)));
        const personMs = last15.filter(m => mCur.who === "person1"
          ? (m.who === "person1" || m.who === "together")
          : (m.who === "person2" || m.who === "together"));
        const active = personMs.filter(m => !m.completedLate);
        const total = active.length;
        if (total > 0 && active.some(m => m.id === mCur.id)) {
          const doneBefore = active.filter(m => m.status === "DONE").length;
          const beforePct  = Math.round((doneBefore / total) * 100);
          const afterPct   = Math.round(((doneBefore + 1) / total) * 100);
          const color = mCur.who === "person1" ? clr.person1 : clr.person2;
          setTaskCongrat({ mission: mCur, beforePct, afterPct, delta: afterPct - beforePct, color });
        }
      }
    }
  };

  const delMission = id => {
    const mDel = data.weeks[wkey]?.missions?.find(m => m.id === id);
    deleteNormalizedMission(coupleId, id).catch(e => console.error("[dual_write] delete:", e));
    patchWeek(w => ({ ...w, missions:w.missions.filter(m=>m.id!==id) }));
    if (mDel) logActivity(`eliminó ${mDel.emoji||"🎯"} «${mDel.title}»`);
  };
  const { week:todayWeek, year:todayYear } = getWeekAndYear();
  const isCurrentWeek = data.currentWeekNumber===todayWeek && data.currentYear===todayYear;
  const goToToday = () => { update(s=>({...s,currentWeekNumber:todayWeek,currentYear:todayYear})); setActiveTab("current"); };
  const runCarryOver = () => {
    const base = dataRef.current || data;
    const currKey = isoWeekKey(base.currentWeekNumber, base.currentYear);
    const beforeIds = new Set((base.weeks[currKey]?.missions || []).map(m => m.id));
    const after = applyCarryOver(base);
    update(() => after); // reducer puro
    // Dual-write fuera del reducer (efecto secundario).
    for (const m of (after.weeks[currKey]?.missions || [])) {
      if (!beforeIds.has(m.id)) {
        insertNormalizedMission(coupleId, currKey, after.currentWeekNumber, after.currentYear, m)
          .catch(e => console.error("[dual_write] carry insert:", e));
      }
    }
  };
  const patchAllFutureSeries = (seriesId, fromWkey, patch) => {
    update(d => {
      const newWeeks = { ...d.weeks };
      for (const [wkey, w] of Object.entries(newWeeks)) {
        if (wkey < fromWkey) continue;
        newWeeks[wkey] = { ...w, missions: (w.missions||[]).map(m => m.seriesId === seriesId ? { ...m, ...patch } : m) };
      }
      return { ...d, weeks: newWeeks };
    });
    // Normalized: update each affected mission — use dataRef.current (not stale closure)
    for (const [wkey, w] of Object.entries(dataRef.current.weeks)) {
      if (wkey < fromWkey) continue;
      for (const m of (w.missions || [])) {
        if (m.seriesId === seriesId) {
          updateNormalizedMission(coupleId, m.id, patch).catch(e => console.error("[dual_write] series patch:", e));
        }
      }
    }
  };
  // If the hint key misses (e.g. old week without weekNumber field), scan all weeks.
  const resolveWeekKey = (d, hintKey, id) => {
    if (d.weeks[hintKey]?.missions?.some(m => m.id === id)) return hintKey;
    return Object.keys(d.weeks).find(k => d.weeks[k]?.missions?.some(m => m.id === id)) ?? null;
  };

  const cycleStatusGlobal = (wn, yr, id) => {
    const hint = isoWeekKey(wn, yr);
    const wCur = data.weeks[hint];
    const mCur = wCur?.missions?.find(x => x.id === id)
      ?? Object.values(data.weeks).flatMap(w => w.missions||[]).find(m => m.id === id);
    const nx = mCur ? STATUS_ORDER[(STATUS_ORDER.indexOf(mCur.status)+1)%STATUS_ORDER.length] : null;
    update(d => {
      const key = resolveWeekKey(d, hint, id); if (!key) return d;
      const w = d.weeks[key];
      const m = w.missions.find(x=>x.id===id); if (!m) return d;
      const nxx = STATUS_ORDER[(STATUS_ORDER.indexOf(m.status)+1)%STATUS_ORDER.length];
      let next = { ...d, weeks: { ...d.weeks, [key]: { ...w, missions: w.missions.map(x=>x.id===id?{...x,status:nxx,completedAt:nxx==="DONE"?Date.now():null}:x) } } };
      if (nxx==="DONE" && m.carriedFrom) next = syncCarryDone(next, key, id);
      return next;
    });
    if (nx === "DONE" && mCur) track("mission_completed", { who: mCur.who, hasGoal: !!mCur.goalId, week: wCur?.weekNumber });
    if (nx === "DONE" && mCur) logActivity(`completó ${mCur.emoji||"🎯"} «${mCur.title}»`);
    if (nx) pushToast({ kind: "success", text: `${STATUS[nx].icon} ${STATUS[nx].label}` });
    if (nx) updateNormalizedMissionStatus(coupleId, id, nx).catch(e => console.error("[dual_write] status:", e));
    if (nx === "DONE" && mCur) { const b = `${personName} completó: ${mCur.emoji||"🎯"} ${mCur.title}`; runAfterSave(() => sendContextualPush(coupleId, { body:b, tag:"mp-mission-done", url:missionPushUrl(wn, yr, id) }, sessionUserId)); }
    if (nx === "DONE" && mCur) {
      const clr = { ...DEFAULT_COLORS, ...(data.settings?.colors||{}) };
      if (mCur.who === "together") {
        setJuntosMoment({ mission: mCur, p1Name: p1, p2Name: p2, p1Color: clr.person1, p2Color: clr.person2 });
      } else {
        // Fórmula idéntica al anillo personal de HomeDashboard
        const todayStr = localDateStr();
        const { week: tWn, year: tYr } = getWeekAndYear(new Date());
        const todayWkey = isoWeekKey(tWn, tYr);
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14);
        const { week: cWn, year: cYr } = getWeekAndYear(cutoff);
        const cutoffWkey = isoWeekKey(cWn, cYr);
        const last15 = Object.entries(data.weeks)
          .filter(([k]) => k >= cutoffWkey && k <= todayWkey)
          .flatMap(([,w]) => (w.missions||[]).filter(m => m.type !== "event" && (!m.date || m.date <= todayStr)));
        const personMs = last15.filter(m => mCur.who === "person1"
          ? (m.who === "person1" || m.who === "together")
          : (m.who === "person2" || m.who === "together"));
        const active = personMs.filter(m => !m.completedLate);
        const total = active.length;
        if (total > 0 && active.some(m => m.id === mCur.id)) {
          const doneBefore = active.filter(m => m.status === "DONE").length;
          const beforePct  = Math.round((doneBefore / total) * 100);
          const afterPct   = Math.round(((doneBefore + 1) / total) * 100);
          const color = mCur.who === "person1" ? clr.person1 : clr.person2;
          setTaskCongrat({ mission: mCur, beforePct, afterPct, delta: afterPct - beforePct, color });
        }
      }
    }
  };
  const patchMissionGlobal = (wn, yr, id, patch) => {
    const hint = isoWeekKey(wn, yr);
    // Estado previo ANTES del update, para componer el texto de actividad
    const mPrev = ("date" in patch || "time" in patch || "who" in patch)
      ? Object.values((dataRef.current || data).weeks).flatMap(w => w.missions||[]).find(m => m.id === id)
      : null;
    update(d => {
      const key = resolveWeekKey(d, hint, id); if (!key) return d;
      const w = d.weeks[key];
      return { ...d, weeks: { ...d.weeks, [key]: { ...w, missions: (w.missions||[]).map(x=>x.id===id?{...x,...patch}:x) } } };
    });
    updateNormalizedMission(coupleId, id, patch).catch(e => console.error("[dual_write] patch:", e));
    // Actividad: solo cambios de coordinación (fecha/hora/quién) — no cada tecleo de título
    if (mPrev) {
      const t = `${mPrev.emoji||"🎯"} «${mPrev.title}»`;
      if ("who" in patch && patch.who !== mPrev.who) {
        const wName = patch.who === "person1" ? p1 : patch.who === "person2" ? p2 : "Juntos";
        logActivity(`reasignó ${t} a ${wName}`);
      }
      if (("date" in patch && patch.date !== mPrev.date) || ("time" in patch && patch.time !== mPrev.time)) {
        const nd = "date" in patch ? patch.date : mPrev.date;
        const nt = "time" in patch ? patch.time : mPrev.time;
        logActivity(nd ? `movió ${t} a ${nd}${nt?` ${nt}`:""}` : `quitó la fecha de ${t}`);
      }
    }
  };
  const deleteMissionGlobal = (wn, yr, id) => {
    const hint = isoWeekKey(wn, yr);
    const mDel = Object.values(data.weeks).flatMap(w => w.missions||[]).find(m => m.id === id);
    deleteNormalizedMission(coupleId, id).catch(e => console.error("[dual_write] delete:", e));
    update(d => {
      const key = resolveWeekKey(d, hint, id); if (!key) return d;
      const w = d.weeks[key];
      return { ...d, weeks: { ...d.weeks, [key]: { ...w, missions: w.missions.filter(x=>x.id!==id) } } };
    });
    if (mDel) logActivity(`eliminó ${mDel.emoji||"🎯"} «${mDel.title}»`);
  };
  const runRepair = () => {
    const { data: fixed, moved } = repairMisplacedMissions(dataRef.current || data);
    if (moved === 0) { alert("✅ Todo en orden — ningún evento fuera de su semana."); return; }
    alert(`✅ ${moved} evento${moved>1?"s":""} reubicado${moved>1?"s":""} a su semana correcta.`);
    update(() => fixed); // reducer puro
  };

  const patchGoals = fn => update(d => ({ ...d, goals: fn(d.goals||[]) }));
  const addGoal = g => patchGoals(gs => [...gs, { ...g, id:uid(), active:true, createdAt:Date.now() }]);
  const updateGoal = (id, patch) => patchGoals(gs => gs.map(g => g.id===id ? {...g,...patch} : g));
  const deleteGoal = id => patchGoals(gs => gs.filter(g => g.id!==id));

  const saveMoodEntry = (entry) => {
    if (entry.id) {
      // Edit existing entry
      update(d => ({ ...d, moods: (d.moods||[]).map(m => m.id === entry.id ? entry : m) }));
      pushToast({ kind:"success", text:"🧠 Registro actualizado" });
    } else {
      // New entry
      const id = uid();
      update(d => ({ ...d, moods: [...(d.moods||[]), { ...entry, id }] }));
      runAfterSave(() => localStorage.setItem(`mp-mood-done-${entry.who}-${entry.date}`, "1"));
      pushToast({ kind:"success", text:"🧠 Estado de ánimo guardado" });
    }
    setMoodSurveyOpen(false);
    setMoodSurveyPrefill(null);
    setMoodEditEntry(null);
  };

  const deleteMoodEntry = (idOrTs) => {
    update(d => ({ ...d, moods: (d.moods||[]).filter(m => m.id !== idOrTs && m.ts !== idOrTs) }));
  };

  const createTimeCapsule = ({ title, message, photo, unlockDate, from }) => {
    const capsule = { id: uid(), title, message, photo: photo || null, unlockDate, from, createdAt: Date.now(), viewedAt: null };
    update(d => ({ ...d, timeCapsules: [...(d.timeCapsules||[]), capsule] }));
    pushToast({ kind: "success", text: "🔒 Cápsula sellada — se abrirá el " + unlockDate });
  };
  const deleteTimeCapsule = id => update(d => ({ ...d, timeCapsules: (d.timeCapsules||[]).filter(c => c.id !== id) }));
  const viewTimeCapsule = id => {
    const c = (data.timeCapsules||[]).find(x => x.id === id);
    if (!c) return;
    if (!c.viewedAt) update(d => ({ ...d, timeCapsules: (d.timeCapsules||[]).map(x => x.id === id ? { ...x, viewedAt: Date.now() } : x) }));
    setViewingCapsule(c);
  };

  const compressImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo de imagen"));
    reader.onload = e => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo no es una imagen válida"));
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
  const allDated = Object.entries(data.weeks).flatMap(([key,w])=>(w.missions||[]).filter(m=>m.date).map(m=>({...m,weekNumber:w.weekNumber??parseInt(key.split("-W")[1]),_yr:parseInt(key.split("-W")[0])||w.year||new Date().getFullYear()})));

  return (
    <div style={{ minHeight:"100vh", overflowX:"hidden", background:"var(--t-bg,#0a0714)", backgroundImage:"var(--t-bg-grad)", fontFamily:"var(--t-font-body,'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif)", color:"var(--t-text,#f8f4ff)" }}>
      <ThemeInjector themeId={themeId} fontId={fontId} colors={colors} />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        *:focus { outline: none; }
        *:focus-visible { outline: 2px solid var(--t-accent,#a78bfa); outline-offset: 2px; border-radius: 4px; }
        .sc-nav-btn:focus-visible { outline: 2px solid var(--t-accent,#a78bfa); outline-offset: -2px; border-radius: 10px; }
        .sc-menu-header:hover { background: linear-gradient(135deg, var(--t-accent-soft,rgba(167,139,250,0.18)), transparent 80%) !important; }
        .sc-menu-header:active { transform: scale(0.99); }
        button:focus-visible, a:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--t-accent,#a78bfa); outline-offset: 2px; }
        @keyframes mc-pop { 0%{transform:scale(1)} 50%{transform:scale(1.28)} 100%{transform:scale(1)} }
        @keyframes sc-dot-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.75)} }
        @keyframes sc-saved-fade { 0%{opacity:1} 100%{opacity:0} }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes hd-merge1 { 0%,100%{transform:translateX(-22px)} 45%,55%{transform:translateX(-7px)} }
        @keyframes hd-merge2 { 0%,100%{transform:translateX(22px)} 45%,55%{transform:translateX(7px)} }
        @keyframes hd-spark { 0%,40%,60%,100%{opacity:0;transform:scale(0.5)} 50%{opacity:1;transform:scale(1.15)} }
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

      {showProfile && <Suspense fallback={<ModalLoadingFallback />}><ProfileModal data={data} update={update} coupleId={coupleId} onClose={()=>setShowProfile(false)} onStartTutorial={()=>{ setShowProfile(false); setTutorialStep(0); }} sessionUserId={sessionUserId} onCheckUpdate={checkUpdate} onThemeChange={(tid,fid)=>{ setLocalThemeId(tid); setLocalFontId(fid); }} pushSupported={pushSupported} pushSubscribed={pushSubscribed} pushLoading={pushLoading} pushError={pushError} onPushToggle={handlePushToggle} onShowWrapped={() => { const prevDate=new Date(); prevDate.setDate(prevDate.getDate()-7); const {week:pw,year:py}=getWeekAndYear(prevDate); const prevKey=isoWeekKey(pw,py); const today=new Date(); const monthKey=`${today.getFullYear()}-${today.getMonth()}`; const hasPrev=(data?.weeks[prevKey]?.missions?.length||0)>0; if(hasPrev) setWrappedConfig({showWeekly:true,showMonthlyOption:false,prevKey,monthKey}); }} bottomBar={bottomBar} onBottomBarChange={updateBottomBar} /></Suspense>}






      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        activeTab={activeTab}
        onNavigate={tab => { setActiveTab(tab); setMenuOpen(false); }}
        couplePhoto={data.settings?.photos?.couple}
        coupleEmoji={data.settings?.coupleEmoji}
        p1={p1} p2={p2}
        syncMsg={syncMsg}
        onShowProfile={() => { setShowProfile(true); setMenuOpen(false); }}
        chatUnread={chatUnread}
      />

      <Topbar
        activeTab={activeTab} setActiveTab={setActiveTab} setMenuOpen={setMenuOpen}
        currentWeekNumber={data.currentWeekNumber}
        savingState={savingState} onForcePush={forcePush}
        isDark={_activeTheme.dark} onToggleDark={toggleDarkLight}
        onCheckUpdate={checkUpdate} onSmartSync={smartSync} syncing={syncing}
        onDownloadICS={() => downloadWeekICS(week, wkey, p1, p2)}
        onDownloadPDF={() => downloadWeekPDF(week, wkey, p1, p2)}
        onExport={() => exportData(data)}
        importFileRef={importFileRef} onSignOut={onSignOut}
        colors={colors}
        chatUnread={chatUnread}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenAvailability={() => setAvailOpen(true)}
        onOpenActivity={() => setActivityOpen(true)}
      />

      {bottomBar.enabled && bottomBar.tabs.length > 0 && (
        <BottomTabBar tabs={bottomBar.tabs} activeTab={activeTab} onTabChange={tab => { setActiveTab(tab); setMenuOpen(false); }} badges={{ chat: chatUnread }} />
      )}

      <PullToRefresh onRefresh={smartSync} refreshing={syncing}>
      <div style={{ maxWidth:640, margin:"0 auto", padding:"18px 16px", paddingBottom: bottomBar.enabled && bottomBar.tabs.length > 0 ? "calc(176px + env(safe-area-inset-bottom))" : "calc(120px + env(safe-area-inset-bottom))" }}>

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
          {showAddForm&&<AddMissionForm newM={newM} setNewM={setNewM} onAdd={addMission} onCancel={()=>setShowAddForm(false)} p1={p1} p2={p2} goals={data.goals||[]} weeks={data.weeks}
            templates={data.templates||[]}
            onSaveTemplate={tpl => {
              const exists = (data.templates||[]).some(t => t.title.toLowerCase() === tpl.title.toLowerCase() && t.who === tpl.who);
              if (exists) { pushToast({ kind:"error", text:"Ya existe una plantilla con ese nombre" }); return; }
              update(d => ({ ...d, templates: [...(d.templates||[]), tpl] }));
              pushToast({ kind:"success", text:`⚡ Plantilla «${tpl.title}» guardada` });
            }}
            onDeleteTemplate={id => update(d => ({ ...d, templates: (d.templates||[]).filter(t => t.id !== id) }))}
          />}
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
            return <WeekTimeline missions={filtered} weekDays={weekDays} renderCard={m=><MissionCard key={m.id} mission={m} p1={p1} p2={p2} colors={colors} goals={data.goals||[]} weeksData={data.weeks} onCycleStatus={()=>cycleStatus(m.id)} onDelete={()=>delMission(m.id)} onPatch={p=>patchMissionGlobal(data.currentWeekNumber, data.currentYear, m.id, p)} sessionPersonId={sessionPersonId} highlighted={m.id === highlightMissionId} />} />;
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
                <MissionCard key={m.id} mission={m} p1={p1} p2={p2} colors={colors} goals={data.goals||[]} weeksData={data.weeks} onCycleStatus={()=>cycleStatus(m.id)} onDelete={()=>delMission(m.id)} onPatch={p=>patchMissionGlobal(data.currentWeekNumber, data.currentYear, m.id, p)} sessionPersonId={sessionPersonId} highlighted={m.id === highlightMissionId} />
              ));
            })()}
          </div>}
        </div>}

        <Suspense fallback={<div style={{ textAlign:"center", padding:"60px 0", color:"var(--t-text-dim,#4a4166)", fontSize:13 }}>Cargando…</div>}>
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

        {activeTab==="birthdays" && <BirthdaysView
          birthdays={data.birthdays||[]}
          onAdd={b => update(d => ({ ...d, birthdays: [...(d.birthdays||[]), b] }))}
          onDelete={id => update(d => ({ ...d, birthdays: (d.birthdays||[]).filter(b => b.id !== id) }))}
        />}

        {activeTab==="timecapsule" && <TimeCapsuleView
          capsules={data.timeCapsules||[]}
          p1={p1} p2={p2} colors={colors}
          sessionPersonId={sessionPersonId}
          anniversaryDate={data.settings?.anniversaryDate}
          onCreate={createTimeCapsule}
          onDelete={deleteTimeCapsule}
          onView={viewTimeCapsule}
        />}

        {activeTab==="mood" && <MoodView
          moods={data.moods||[]}
          p1={p1} p2={p2} colors={colors}
          sessionUserId={sessionUserId}
          sessionPersonId={sessionPersonId}
          lightTheme={_activeTheme.dark === false}
          onAddMood={() => { setMoodSurveyPrefill(null); setMoodEditEntry(null); setMoodSurveyOpen(true); }}
          onEditMood={m => { setMoodEditEntry(m); setMoodSurveyPrefill(null); setMoodSurveyOpen(true); }}
          onDeleteMood={deleteMoodEntry}
        />}

        {activeTab==="wishlist" && <WishlistView
          wishlist={data.wishlist||[]}
          onSave={fn => update(d => ({ ...d, wishlist: fn(d.wishlist||[]) }))}
          pushToast={pushToast}
        />}

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
        </Suspense>
      </div>
      </PullToRefresh>

      {/* Historial de actividad — quién añadió/movió/completó/eliminó qué */}
      {activityOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <ActivityLog activity={data.activity||[]} p1={p1} p2={p2} colors={colors} onClose={() => setActivityOpen(false)} />
        </Suspense>
      )}

      {/* Exportar disponibilidad (liga de pádel, etc.) */}
      {availOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <AvailabilityExport weeks={data.weeks} p1={p1} p2={p2} colors={colors} onClose={() => setAvailOpen(false)} />
        </Suspense>
      )}

      {/* Búsqueda global de tareas y eventos */}
      {searchOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <SearchOverlay
            weeks={data.weeks} p1={p1} p2={p2} colors={colors}
            onClose={() => setSearchOpen(false)}
            onGoToWeek={(wn, yr, missionId) => {
              update(s => ({ ...s, currentWeekNumber: wn, currentYear: yr }));
              setActiveTab("current"); setSearchOpen(false);
              if (missionId) {
                setHighlightMissionId(missionId);
                setTimeout(() => setHighlightMissionId(cur => cur === missionId ? null : cur), 3000);
              }
            }}
          />
        </Suspense>
      )}

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

      {/* Wrapped gate — appears Monday mornings and 1st of month */}
      {wrappedConfig && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <WrappedModal
            showWeekly={wrappedConfig.showWeekly}
            showMonthlyOption={wrappedConfig.showMonthlyOption}
            weeks={data?.weeks || {}}
            p1={p1} p2={p2} colors={data?.settings?.colors}
            onClose={() => {
              if (wrappedConfig.prevKey) localStorage.setItem(`mp-wrapped-wk-${wrappedConfig.prevKey}`, "1");
              if (wrappedConfig.monthKey) localStorage.setItem(`mp-wrapped-mo-${wrappedConfig.monthKey}`, "1");
              setWrappedConfig(null);
            }}
          />
        </Suspense>
      )}

      {/* Destellos de los colores de la pareja en cada click — siempre activos */}
      <ClickSparkles colors={colors} />

      {/* ─ Mundial: tema verde todo el día cuando juegan los equipos favoritos ─ */}
      {matchDayMatches && !specialDayEvent && <MatchDayTheme />}

      {/* Botón flotante para re-abrir el overlay de partido */}
      {matchDayMatches && !matchDayOverlay && !specialDay && (
        <button
          onClick={() => setMatchDayOverlay(true)}
          style={{ position:"fixed", bottom:80, right:16, zIndex:1200, background:"linear-gradient(135deg,#14532d,#16a34a)", border:"none", borderRadius:99, color:"#fff", fontSize:22, width:52, height:52, cursor:"pointer", boxShadow:"0 4px 20px rgba(34,197,94,0.5)", display:"flex", alignItems:"center", justifyContent:"center" }}
          title="Ver partidos de hoy"
        >⚽</button>
      )}

      {/* Overlay de partido — aparece una vez al día, re-abrible */}
      {matchDayMatches && matchDayOverlay && (
        <MatchDayOverlay matches={matchDayMatches} onDone={() => setMatchDayOverlay(false)} />
      )}

      {/* Tema dorado todo el día en fechas especiales */}
      {specialDayEvent && <SpecialDayTheme />}

      {/* Botón flotante que permite re-ver la celebración durante el día */}
      {specialDayEvent && !specialDay && (
        <SpecialDayButton onReplay={() => setSpecialDay(specialDayEvent)} />
      )}

      {/* Evento especial — cumpleaños y aniversario (se puede re-abrir) */}
      {specialDay && (
        <SpecialDayOverlay
          event={specialDay}
          p1={p1} p2={p2}
          onDone={() => setSpecialDay(null)}
        />
      )}

      {/* Micro-festejo individual — sutil, con % de semana y mensaje por banda */}
      {taskCongrat && (
        <TaskCongrat key={taskCongrat.mission.id + taskCongrat.afterPct} info={taskCongrat} onDone={() => setTaskCongrat(null)} />
      )}

      {/* Aviso suave de cápsula del tiempo lista — nunca se auto-abre */}
      {capsuleNudge && (
        <div style={{ position:"fixed", bottom:90, left:"50%", transform:"translateX(-50%)", background:"rgba(10,4,24,0.97)", border:"1px solid rgba(251,191,36,0.4)", borderRadius:14, padding:"12px 16px", zIndex:401, fontSize:13, maxWidth:320, width:"calc(100% - 40px)", backdropFilter:"blur(12px)", boxShadow:"0 4px 24px rgba(0,0,0,0.5)", display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:22, flexShrink:0 }}>🎁</span>
          <div style={{ flex:1 }}>
            <div style={{ color:"#fbbf24", fontWeight:600, marginBottom:6 }}>Tienes una cápsula del tiempo lista para abrir</div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => { setActiveTab("timecapsule"); setCapsuleNudge(false); }} style={{ background:"none", border:"none", color:"#fbbf24", cursor:"pointer", fontWeight:700, fontFamily:"inherit", padding:0, fontSize:12 }}>Ver →</button>
              <button onClick={() => setCapsuleNudge(false)} style={{ background:"none", border:"none", color:"var(--t-text-muted,#8b7fa8)", cursor:"pointer", fontFamily:"inherit", padding:0, fontSize:12 }}>Ahora no</button>
            </div>
          </div>
        </div>
      )}

      {/* Apertura de cápsula del tiempo */}
      {viewingCapsule && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <TimeCapsuleReveal capsule={viewingCapsule} p1={p1} p2={p2} colors={colors} onClose={() => setViewingCapsule(null)} />
        </Suspense>
      )}

      {/* Momento Juntos — aparece al completar una tarea/evento compartido */}
      {juntosMoment && (
        <JuntosMoment
          mission={juntosMoment.mission}
          p1Name={juntosMoment.p1Name}
          p2Name={juntosMoment.p2Name}
          p1Color={juntosMoment.p1Color}
          p2Color={juntosMoment.p2Color}
          onDone={() => setJuntosMoment(null)}
        />
      )}

      {/* Encuesta de ánimo — popup automático a las 18:00 o manual desde la pestaña */}
      {moodSurveyOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <MoodSurvey
            p1={p1} p2={p2} colors={colors}
            prefillWho={moodSurveyPrefill}
            editEntry={moodEditEntry}
            onSave={saveMoodEntry}
            onClose={() => { setMoodSurveyOpen(false); setMoodEditEntry(null); }}
          />
        </Suspense>
      )}
    </div>
  );
}
