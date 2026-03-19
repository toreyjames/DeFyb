import { DS } from "../../design/tokens";

export const MetricCard = ({ label, value, sub, color = DS.colors.text, small }) => (
  <div style={{
    background: DS.colors.bgCard, border: `1px solid ${DS.colors.border}`,
    borderRadius: DS.radius.md, padding: small ? "14px" : "20px",
  }}>
    <div style={{ fontSize: "11px", color: DS.colors.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>{label}</div>
    <div style={{ fontFamily: DS.fonts.display, fontSize: small ? "22px" : "28px", color, lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginTop: "4px" }}>{sub}</div>}
  </div>
);
