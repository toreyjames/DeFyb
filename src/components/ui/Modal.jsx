import { DS } from "../../design/tokens";

export const Modal = ({ open, onClose, title, children, width = "500px" }) => {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px", animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: DS.colors.bgCard, borderRadius: DS.radius.lg,
          border: `1px solid ${DS.colors.border}`, width: "100%", maxWidth: width,
          maxHeight: "90vh", overflow: "auto", animation: "fadeUp 0.3s ease",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px", borderBottom: `1px solid ${DS.colors.border}`,
        }}>
          <h3 style={{ fontFamily: DS.fonts.display, fontSize: "20px", fontWeight: 400 }}>{title}</h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "20px", color: DS.colors.textMuted, padding: "4px",
          }}>×</button>
        </div>
        <div style={{ padding: "24px" }}>{children}</div>
      </div>
    </div>
  );
};
