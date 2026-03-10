export type Encounter = {
  transcript: string;
  note: string;
  visitType: "established" | "new";
};

export type Diagnosis = {
  name: string;
  confidence: number;
};

export type ClinicalFinding = {
  label: string;
  value: string;
  supportsComplexity: "low" | "moderate" | "high";
};

export type BillingRecommendation = {
  suggestedCode: string;
  rationale: string[];
  confidence: number;
};

export type DocumentationGap = {
  missingElement: string;
  reason: string;
  suggestedAddition: string;
};

export type RevenueImpact = {
  currentCode: string;
  suggestedCode: string;
  deltaPerVisit: number;
  projectedMonthlyRecovery: number;
  undercodedVisitsDetected: number;
};

export type AnalysisResult = {
  encounter: Encounter;
  diagnoses: Diagnosis[];
  findings: ClinicalFinding[];
  recommendation: BillingRecommendation;
  gaps: DocumentationGap[];
  revenueImpact: RevenueImpact;
  finalizedNote: string;
};

export type AgenticAction = {
  id: string;
  title: string;
  owner: "provider" | "billing" | "ops-agent";
  priority: "high" | "medium" | "low";
  expectedRecovery: number;
  status: "queued" | "in_progress" | "ready_to_send";
  reason: string;
};
