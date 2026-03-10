import { BillingRecommendation, ClinicalFinding } from "@/lib/types";

const complexityScore = (findings: ClinicalFinding[]) => {
  return findings.reduce((score, finding) => {
    if (finding.supportsComplexity === "high") return score + 3;
    if (finding.supportsComplexity === "moderate") return score + 2;
    return score + 1;
  }, 0);
};

export const recommendBillingCode = (findings: ClinicalFinding[]): BillingRecommendation => {
  const score = complexityScore(findings);
  const hasHighRisk = findings.some((item) => item.supportsComplexity === "high");

  if (hasHighRisk || score >= 7) {
    return {
      suggestedCode: "99215",
      rationale: [
        "High-complexity medical decision indicators were identified.",
        "Encounter includes substantial risk and management complexity.",
        "Documentation supports comprehensive E/M justification."
      ],
      confidence: 0.84
    };
  }

  if (score >= 4) {
    return {
      suggestedCode: "99214",
      rationale: [
        "Moderate-complexity medical decision making is supported.",
        "Diagnostic data review and treatment planning are documented.",
        "Current encounter detail supports a higher-value established visit."
      ],
      confidence: 0.8
    };
  }

  return {
    suggestedCode: "99213",
    rationale: [
      "Limited data and lower-complexity management documented.",
      "Encounter supports low-complexity established E/M coding."
    ],
    confidence: 0.75
  };
};
