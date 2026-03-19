import { DS } from "../../design/tokens";
import { Card } from "../ui/Card";
import { DonutChart } from "./DonutChart";
import { BarChart } from "./BarChart";

export const PortfolioCharts = ({ practices }) => {
  const healthSegments = [
    { label: "Healthy (80+)", value: practices.filter(p => (p.health_score || p.score || 0) >= 80).length, color: DS.colors.vital },
    { label: "Moderate (60-79)", value: practices.filter(p => { const s = p.health_score || p.score || 0; return s >= 60 && s < 80; }).length, color: DS.colors.warn },
    { label: "At Risk (<60)", value: practices.filter(p => (p.health_score || p.score || 0) < 60 && p.stage === "managed").length, color: DS.colors.danger },
  ];

  const roiByPractice = practices
    .filter(p => p.roi_projections?.totalAnnualValue > 0)
    .sort((a, b) => (b.roi_projections?.totalAnnualValue || 0) - (a.roi_projections?.totalAnnualValue || 0))
    .slice(0, 5)
    .map(p => ({
      label: p.name,
      value: p.roi_projections?.totalAnnualValue || 0,
      color: DS.colors.vital,
    }));

  const stageData = [
    { label: "Lead", value: practices.filter(p => p.stage === "lead").length, color: DS.colors.textMuted },
    { label: "Assessment", value: practices.filter(p => p.stage === "assessment").length, color: DS.colors.blue },
    { label: "Implementation", value: practices.filter(p => p.stage === "implementation").length, color: DS.colors.warn },
    { label: "Managed", value: practices.filter(p => p.stage === "managed").length, color: DS.colors.vital },
  ];

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <Card>
        <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "16px" }}>Portfolio Health</div>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <DonutChart segments={healthSegments} size={100} strokeWidth={14} />
          <div style={{ display: "grid", gap: "8px" }}>
            {healthSegments.map((seg, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: seg.color }} />
                <span style={{ fontSize: "12px", color: DS.colors.textMuted }}>{seg.label}</span>
                <span style={{ fontSize: "12px", fontFamily: DS.fonts.mono, color: DS.colors.text, marginLeft: "auto" }}>{seg.value}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {roiByPractice.length > 0 && (
        <Card>
          <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "16px" }}>Projected ROI by Practice</div>
          <BarChart data={roiByPractice} height={roiByPractice.length * 32 + 20} />
        </Card>
      )}

      <Card>
        <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "16px" }}>Pipeline Distribution</div>
        <div style={{ display: "flex", gap: "4px", height: "24px", borderRadius: DS.radius.sm, overflow: "hidden" }}>
          {stageData.map((stage, i) => {
            const total = stageData.reduce((s, d) => s + d.value, 0);
            const width = total > 0 ? (stage.value / total) * 100 : 0;
            if (width === 0) return null;
            return (
              <div
                key={i}
                style={{
                  width: `${width}%`,
                  background: stage.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "width 0.3s ease",
                }}
                title={`${stage.label}: ${stage.value}`}
              >
                {width > 15 && <span style={{ fontSize: "10px", color: "#fff", fontWeight: 600 }}>{stage.value}</span>}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
          {stageData.map((stage, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: stage.color }} />
              <span style={{ fontSize: "10px", color: DS.colors.textMuted }}>{stage.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
