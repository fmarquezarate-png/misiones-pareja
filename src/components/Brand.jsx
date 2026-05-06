import { DEFAULT_COLORS } from "../constants.js";

export default function Brand({ size = 24, wordmark = false, colors }) {
  const c = colors || DEFAULT_COLORS;
  const dotSize = Math.round(size * 0.6);
  const dotTop  = (size - dotSize) / 2;
  const overlap = Math.round(dotSize * 0.32);

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: wordmark ? 8 : 0,
      fontFamily: "'Fraunces', Georgia, serif",
      fontSize: size * 0.65,
      fontWeight: 600,
      letterSpacing: "-0.01em",
      color: "var(--t-text,#f8f4ff)",
    }}>
      <span style={{
        position: "relative",
        width: dotSize * 2 - overlap,
        height: size,
        flexShrink: 0,
        display: "inline-block",
      }}>
        <span style={{
          position: "absolute",
          width: dotSize, height: dotSize, borderRadius: 99,
          left: 0, top: dotTop,
          background: c.person1,
          opacity: 0.92,
          boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
        }}/>
        <span style={{
          position: "absolute",
          width: dotSize, height: dotSize, borderRadius: 99,
          left: dotSize - overlap, top: dotTop,
          background: c.person2,
          opacity: 0.85,
          boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
        }}/>
      </span>
      {wordmark && <span>Shared Calendar</span>}
    </span>
  );
}
