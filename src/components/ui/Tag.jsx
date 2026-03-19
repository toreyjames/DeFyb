import { TAGS } from "../../design/tokens";

export const Tag = ({ type }) => {
  const t = TAGS[type];
  if (!t) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      padding: "2px 8px", borderRadius: "4px", fontSize: "11px",
      fontWeight: 500, color: t.color, background: t.bg, letterSpacing: "0.04em",
    }}>
      {t.icon} {t.label}
    </span>
  );
};
