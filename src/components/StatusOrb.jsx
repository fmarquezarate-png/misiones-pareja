const FILL = { TBC: 0, ASAP: 28, IN_PROGRESS: 62, DONE: 100 };

export default function StatusOrb({ status, color, onClick, animated }) {
  const pct = FILL[status] ?? 0;
  const isDone = status === "DONE";
  const SIZE = 32;

  return (
    <button
      onClick={onClick}
      aria-label={status}
      style={{
        background: "none", border: "none", cursor: "pointer",
        padding: 0, flexShrink: 0,
        width: SIZE, height: SIZE,
        animation: animated ? "mc-pop 0.22s ease-out" : "none",
        borderRadius: 99,
      }}
    >
      <div style={{
        position: "relative",
        width: SIZE, height: SIZE,
        borderRadius: 99,
        background: isDone ? "rgba(52,211,153,0.12)" : `${color}14`,
        border: `1.5px solid ${isDone ? "rgba(52,211,153,0.5)" : color + "44"}`,
        overflow: "hidden",
        transition: "border-color 0.2s",
      }}>
        {pct > 0 && (
          <div style={{
            position: "absolute",
            bottom: 0, left: 0, right: 0,
            height: `${pct}%`,
            background: isDone
              ? "linear-gradient(to top, rgba(52,211,153,0.85), rgba(52,211,153,0.55))"
              : `linear-gradient(to top, ${color}cc, ${color}77)`,
            transition: "height 0.25s ease",
          }} />
        )}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, lineHeight: 1,
          color: pct >= 60 ? (isDone ? "#fff" : "#fff") : (isDone ? "#34d399" : color + "cc"),
          zIndex: 1,
        }}>
          {isDone                  && <span style={{ marginTop: -1 }}>✓</span>}
          {status === "ASAP"       && <span style={{ color: "#fb923c", fontSize: 11 }}>!</span>}
          {status === "IN_PROGRESS"&& <span style={{ fontSize: 10 }}>⚡</span>}
        </div>
      </div>
    </button>
  );
}
