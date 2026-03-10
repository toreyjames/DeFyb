import { AgenticAction, AnalysisResult } from "@/lib/types";

export const buildAgenticActions = (analysis: AnalysisResult): AgenticAction[] => {
  const actions: AgenticAction[] = [];
  const delta = analysis.revenueImpact.deltaPerVisit;

  if (delta > 0) {
    actions.push({
      id: "undercode-review",
      title: "Queue undercoded encounter correction",
      owner: "billing",
      priority: "high",
      expectedRecovery: delta,
      status: "ready_to_send",
      reason: `Current documentation supports ${analysis.recommendation.suggestedCode} instead of ${analysis.revenueImpact.currentCode}.`
    });
  }

  if (analysis.gaps.length > 0) {
    actions.push({
      id: "doc-gap-followup",
      title: "Generate provider addendum request",
      owner: "provider",
      priority: "high",
      expectedRecovery: Math.round(delta * 0.75),
      status: "queued",
      reason: `${analysis.gaps.length} documentation gap(s) are limiting defensible reimbursement.`
    });
  }

  actions.push({
    id: "payer-readiness",
    title: "Prepare billing rationale packet",
    owner: "ops-agent",
    priority: delta > 0 ? "medium" : "low",
    expectedRecovery: Math.round(delta * 0.35),
    status: "in_progress",
    reason: "Structured rationale is packaged for claim defense and appeal readiness."
  });

  return actions;
};

export const summarizeDashboardKPIs = (analysis: AnalysisResult) => {
  const projected = analysis.revenueImpact.projectedMonthlyRecovery;
  const monthlyAtRisk = Math.round(projected * 1.4);
  const captureRate = monthlyAtRisk === 0 ? 0 : Math.min(100, Math.round((projected / monthlyAtRisk) * 100));

  return {
    projected,
    monthlyAtRisk,
    captureRate,
    queueCount: buildAgenticActions(analysis).length
  };
};
