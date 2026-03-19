import { DS } from "../design/tokens";
import { STAGES } from "../data/constants";

export const StageProgressBar = ({ currentStage }) => {
  const stageIndex = STAGES.findIndex(s => s.key === currentStage);

  return (
    <div style={{ marginBottom: "32px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {STAGES.map((stage, i) => {
          const isComplete = i < stageIndex;
          const isCurrent = i === stageIndex;
          return (
            <div key={stage.key} style={{ flex: 1, display: "flex", alignItems: "center", gap: "4px" }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "28px", height: "28px", borderRadius: "50%",
                background: isComplete ? DS.colors.vital : isCurrent ? DS.colors.shock : DS.colors.border,
                color: isComplete || isCurrent ? "#fff" : DS.colors.textDim,
                fontSize: "12px", fontWeight: 600,
              }}>
                {isComplete ? "✓" : i + 1}
              </div>
              <div style={{
                flex: 1, height: "3px", borderRadius: "2px",
                background: i < STAGES.length - 1 ? (isComplete ? DS.colors.vital : DS.colors.border) : "transparent",
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", marginTop: "8px" }}>
        {STAGES.map((stage, i) => (
          <div key={stage.key} style={{ flex: 1, textAlign: "left" }}>
            <span style={{
              fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em",
              color: i <= stageIndex ? (i === stageIndex ? DS.colors.shock : DS.colors.vital) : DS.colors.textDim,
              fontWeight: i === stageIndex ? 600 : 400,
            }}>
              {stage.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const getStageMessage = (stage) => {
  switch (stage) {
    case "lead":
      return {
        title: "We're reviewing your intake",
        subtitle: "Your DeFyb journey is starting. We'll reach out within 48 hours to schedule your assessment.",
        icon: "📋",
      };
    case "assessment":
      return {
        title: "Assessment in progress",
        subtitle: "We're capturing your baseline metrics and designing your transformation plan.",
        icon: "🔍",
      };
    case "implementation":
      return {
        title: "Implementation underway",
        subtitle: "Your tools are being deployed. You'll be notified as each tool goes live.",
        icon: "🚀",
      };
    case "managed":
      return {
        title: "You're live!",
        subtitle: "Your practice is running on the full tool stack. Track your progress below.",
        icon: "⚡",
      };
    default:
      return { title: "Welcome", subtitle: "", icon: "👋" };
  }
};
