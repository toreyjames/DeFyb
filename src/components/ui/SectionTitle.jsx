import { DS } from "../../design/tokens";

export const SectionTitle = ({ children, sub }) => (
  <div style={{ marginBottom: "32px" }}>
    <h2 style={{
      fontFamily: DS.fonts.display, fontSize: "clamp(28px, 4vw, 40px)",
      color: DS.colors.text, fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: sub ? "8px" : 0,
    }}>{children}</h2>
    {sub && <p style={{ color: DS.colors.textMuted, fontSize: "16px", maxWidth: "600px" }}>{sub}</p>}
  </div>
);
