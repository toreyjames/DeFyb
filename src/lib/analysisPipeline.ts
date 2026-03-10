import { extractClinicalFacts } from "@/lib/clinicalExtraction";
import { detectDocumentationGaps } from "@/lib/documentationGapDetector";
import { estimateRevenueImpact } from "@/lib/revenueCalculator";
import { recommendBillingCode } from "@/lib/billingRules";
import { AnalysisResult, Encounter } from "@/lib/types";

const applySuggestedAdditions = (note: string, additions: string[]) => {
  if (additions.length === 0) return note;
  return `${note.trim()}\n\nAddendum:\n${additions.map((line) => `- ${line}`).join("\n")}`;
};

export const analyzeEncounter = (encounter: Encounter): AnalysisResult => {
  const { diagnoses, findings } = extractClinicalFacts(encounter);
  const recommendation = recommendBillingCode(findings);
  const gaps = detectDocumentationGaps(encounter, recommendation);
  const revenueImpact = estimateRevenueImpact(
    `${encounter.note}\n${encounter.transcript}`,
    recommendation.suggestedCode
  );

  return {
    encounter,
    diagnoses,
    findings,
    recommendation,
    gaps,
    revenueImpact,
    finalizedNote: applySuggestedAdditions(
      encounter.note || encounter.transcript,
      gaps.map((gap) => gap.suggestedAddition)
    )
  };
};
