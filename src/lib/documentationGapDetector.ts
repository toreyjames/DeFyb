import { BillingRecommendation, DocumentationGap, Encounter } from "@/lib/types";

const hasTerm = (text: string, terms: string[]) => terms.some((term) => text.includes(term));

export const detectDocumentationGaps = (
  encounter: Encounter,
  recommendation: BillingRecommendation
): DocumentationGap[] => {
  const source = `${encounter.transcript}\n${encounter.note}`.toLowerCase();
  const gaps: DocumentationGap[] = [];

  if (!hasTerm(source, ["risk", "benefit", "complication"])) {
    gaps.push({
      missingElement: "Risk-benefit discussion",
      reason: "Higher-complexity coding requires explicit risk narrative.",
      suggestedAddition:
        "Discussed risks and benefits of surgical versus conservative treatment options, including expected outcomes and potential complications."
    });
  }

  if (!hasTerm(source, ["independent interpretation", "reviewed imaging", "mri", "ct", "x-ray", "xray"])) {
    gaps.push({
      missingElement: "Diagnostic data review",
      reason: "Code justification improves when data review is clearly documented.",
      suggestedAddition:
        "Reviewed available imaging and prior diagnostic findings to guide treatment decision-making at this visit."
    });
  }

  if (recommendation.suggestedCode !== "99213" && !hasTerm(source, ["follow-up plan", "next step", "plan:"])) {
    gaps.push({
      missingElement: "Plan specificity",
      reason: "Moderate/high E/M coding should include clear next steps and follow-up.",
      suggestedAddition:
        "Plan includes medication adjustment, referral to physical therapy, and follow-up in 4 weeks with escalation criteria reviewed."
    });
  }

  return gaps;
};
