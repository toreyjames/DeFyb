import { buildAgenticActions, summarizeDashboardKPIs } from "@/lib/agenticActions";
import { AnalysisResult } from "@/lib/types";

type Props = {
  analysis: AnalysisResult;
};

const money = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });

export default function AgenticRevenueDashboard({ analysis }: Props) {
  const kpis = summarizeDashboardKPIs(analysis);
  const actions = buildAgenticActions(analysis);

  return (
    <section className="card">
      <h2>Agentic Revenue Dashboard</h2>
      <p className="subtitle">
        DeFyb agents prioritize capture actions, package evidence, and route work to provider and billing teams.
      </p>

      <div className="kpi-grid">
        <div className="kpi">
          <span>Projected Recovery</span>
          <strong>{money(kpis.projected)}</strong>
        </div>
        <div className="kpi">
          <span>Monthly At-Risk Revenue</span>
          <strong>{money(kpis.monthlyAtRisk)}</strong>
        </div>
        <div className="kpi">
          <span>Capture Rate</span>
          <strong>{kpis.captureRate}%</strong>
        </div>
        <div className="kpi">
          <span>Open Agent Queue</span>
          <strong>{kpis.queueCount}</strong>
        </div>
      </div>

      <h3>Next-Best Actions</h3>
      <ul>
        {actions.map((action) => (
          <li key={action.id}>
            <strong>{action.title}</strong>
            <p>
              Owner: {action.owner} | Priority: {action.priority} | Status: {action.status}
            </p>
            <p>Expected recovery: {money(action.expectedRecovery)}</p>
            <p>{action.reason}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
