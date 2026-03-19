import { DS } from "../../design/tokens";

export const HeartbeatLine = ({ width = 200, color = DS.colors.shock, style = {} }) => (
  <svg width={width} height="32" viewBox="0 0 200 32" fill="none" style={{ display: "block", ...style }}>
    <path
      d="M0 16 L50 16 L60 4 L70 28 L80 8 L90 24 L100 16 L200 16"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ strokeDasharray: 800, animation: "shockLine 2s ease forwards" }}
    />
  </svg>
);
