import { DS } from "../../design/tokens";

export const HealthScoreRing = ({ score = 72, size = 160 }) => {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? DS.colors.vital : score >= 60 ? DS.colors.warn : DS.colors.danger;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={DS.colors.border} strokeWidth="8" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontFamily: DS.fonts.display, fontSize: size * 0.3, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 11, color: DS.colors.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Health</span>
      </div>
    </div>
  );
};
