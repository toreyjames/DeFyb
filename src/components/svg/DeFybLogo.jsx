import { DS } from "../../design/tokens";

export const DeFybLogo = ({ size = 32 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="2" y="2" width="36" height="36" rx="8" stroke={DS.colors.shock} strokeWidth="2" fill="none" />
      <path d="M12 20 L16 20 L18 12 L22 28 L24 16 L26 24 L28 20 L32 20"
        stroke={DS.colors.shock} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span style={{
      fontFamily: DS.fonts.display, fontSize: size * 0.7, color: DS.colors.text,
      letterSpacing: "-0.02em", fontWeight: 400,
    }}>
      De<span style={{ color: DS.colors.shock }}>F</span>yb
    </span>
  </div>
);
