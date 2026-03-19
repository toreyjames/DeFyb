import { DS } from "../../design/tokens";

export const Card = ({ children, style: s = {} }) => (
  <div style={{
    background: DS.colors.bgCard, border: `1px solid ${DS.colors.border}`,
    borderTop: `2px solid ${DS.colors.shockGlow}`,
    borderRadius: DS.radius.lg, padding: "24px", boxShadow: DS.shadow.card, ...s,
  }}>{children}</div>
);
