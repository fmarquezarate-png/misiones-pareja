import { DEFAULT_COLORS } from "../constants.js";

export default function Brand({ size = 24, wordmark = false, colors }) {
  const c = colors || DEFAULT_COLORS;
  const dotSize = size * 0.58;
  const dotTop  = (size - dotSize) / 2;

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: wordmark ? 8 : 0,
      fontFamily: "'Fraunces', Georgia, serif",
      fontSize: size * 0.65,
      fontWeight: 600,
      letterSpacing: "-0.01em",
      color: "#f8f4ff",
    }}>
      <span style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        display: "inline-block",
      }}>
        <span style={{
          position: "absolute",
          width: dotSize, height: dotSize, borderRadius: 99,
          left: 0, top: dotTop,
          background: c.person1,
          mixBlendMode: "screen",
        }}/>
        <span style={{
          position: "absolute",
          width: dotSize, height: dotSize, borderRadius: 99,
          right: 0, top: dotTop,
          background: c.person2,
          mixBlendMode: "screen",
        }}/>
      </span>
      {wordmark && <span>Misiones</span>}
    </span>
  );
}
