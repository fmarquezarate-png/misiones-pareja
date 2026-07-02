export const ALL_TABS = [
  { id: "home",      label: "Inicio",     icon: "🏠" },
  { id: "current",   label: "Semana",     icon: "📋" },
  { id: "calendar",  label: "Calendario", icon: "📅" },
  { id: "pending",   label: "Pendientes", icon: "⏳" },
  { id: "goals",     label: "Metas",      icon: "🎯" },
  { id: "stats",     label: "Stats",      icon: "📊" },
  { id: "history",   label: "Histórico",  icon: "📚" },
  { id: "wishlist",  label: "Lista",      icon: "🛍️" },
  { id: "mood",      label: "Ánimo",      icon: "😊" },
  { id: "gastos",    label: "Gastos",     icon: "💰" },
  { id: "chat",      label: "Chat",       icon: "💬" },
  { id: "links",     label: "Links",      icon: "🔗" },
  { id: "birthdays", label: "Cumpleaños", icon: "🎂" },
];

export default function BottomTabBar({ tabs, activeTab, onTabChange, badges = {} }) {
  const tabDefs = tabs.map(id => ALL_TABS.find(t => t.id === id)).filter(Boolean);
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: "var(--t-menu-bg, #0f0a1e)",
      borderTop: "1px solid var(--t-card-border, rgba(167,139,250,0.15))",
      display: "flex", alignItems: "stretch",
      paddingBottom: "env(safe-area-inset-bottom)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    }}>
      {tabDefs.map(tab => {
        const active = activeTab === tab.id;
        return (
          <button key={tab.id} onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1, border: "none", background: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: "8px 2px 10px", gap: 3, minWidth: 0,
              color: active ? "var(--t-accent, #a78bfa)" : "var(--t-text-muted, #8b7fa8)",
              transition: "color 0.15s",
              fontFamily: "inherit", position: "relative",
            }}>
            {active && (
              <div style={{
                position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                width: 32, height: 2.5, borderRadius: 99,
                background: "var(--t-accent, #a78bfa)",
              }} />
            )}
            <span style={{ fontSize: 22, lineHeight: 1, position: "relative" }}>
              {tab.icon}
              {badges[tab.id] > 0 && (
                <span style={{
                  position: "absolute", top: -4, right: -12,
                  background: "#f43f5e", color: "#fff",
                  fontSize: 9, fontWeight: 700, borderRadius: 99,
                  minWidth: 15, height: 15, padding: "0 4px", boxSizing: "border-box",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1.5px solid var(--t-menu-bg, #0f0a1e)",
                }}>{badges[tab.id] > 99 ? "99+" : badges[tab.id]}</span>
              )}
            </span>
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, letterSpacing: 0.2, lineHeight: 1 }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
