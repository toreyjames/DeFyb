import { DS } from "../../design/tokens";

export const Button = ({ children, primary, small, onClick, style: s = {} }) => (
  <button onClick={onClick} style={{
    padding: small ? "8px 16px" : "12px 28px",
    background: primary ? `linear-gradient(140deg, ${DS.colors.shock}, ${DS.colors.shockLight})` : DS.colors.bgCard,
    color: primary ? "#fff" : DS.colors.text,
    border: `1px solid ${primary ? DS.colors.shock : DS.colors.borderLight}`,
    borderRadius: DS.radius.md, cursor: "pointer",
    fontFamily: DS.fonts.body, fontSize: small ? "13px" : "15px",
    fontWeight: 700, letterSpacing: "0.01em",
    boxShadow: primary ? DS.shadow.glow : "none",
    transition: "all 0.2s ease", ...s,
  }}>{children}</button>
);
