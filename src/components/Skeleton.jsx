const pulse = {
  background: "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%)",
  backgroundSize: "200% 100%",
  animation: "sk-pulse 1.6s ease-in-out infinite",
  borderRadius: 8,
};

export function SkeletonLine({ w = "100%", h = 13, mb = 0, r = 8 }) {
  return (
    <div style={{ ...pulse, width: w, height: h, marginBottom: mb, borderRadius: r, flexShrink: 0 }} />
  );
}

export function SkeletonCard({ rows = 2 }) {
  return (
    <div style={{ background: "var(--t-card,#1d1733)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.12))", borderRadius: 12, padding: "12px 14px" }}>
      <style>{`@keyframes sk-pulse{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: rows > 0 ? 10 : 0 }}>
        <div style={{ ...pulse, width: 32, height: 32, borderRadius: 99, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <SkeletonLine w="60%" h={13} mb={6} />
          <SkeletonLine w="40%" h={10} />
        </div>
      </div>
      {Array.from({ length: rows - 1 }).map((_, i) => (
        <SkeletonLine key={i} w={i % 2 === 0 ? "80%" : "55%"} h={11} mb={6} />
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 24 }}>
      <style>{`@keyframes sk-pulse{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      {/* Hero */}
      <div style={{ background: "var(--t-card,#1d1733)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.18))", borderRadius: 16, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <SkeletonLine w="30%" h={9} mb={8} />
          <SkeletonLine w="75%" h={16} mb={10} />
          <SkeletonLine w="100%" h={5} r={99} />
        </div>
        <div style={{ ...pulse, width: 52, height: 52, borderRadius: 99, flexShrink: 0 }} />
      </div>
      {/* Week strip */}
      <div style={{ display: "flex", gap: 6 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ ...pulse, flex: 1, height: 54, borderRadius: 10 }} />
        ))}
      </div>
      {/* Two columns */}
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ ...pulse, flex: 1, height: 80, borderRadius: 12 }} />
        <div style={{ ...pulse, flex: 1, height: 80, borderRadius: 12 }} />
      </div>
      {/* Mission list */}
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonCard key={i} rows={2} />
      ))}
    </div>
  );
}
