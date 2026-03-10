import { ClinicalFinding, Diagnosis, Encounter } from "@/lib/types";

const containsAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));

const detectDiagnoses = (text: string): Diagnosis[] => {
  const diagnosisMap: Array<{ terms: string[]; name: string }> = [
    { terms: ["knee", "meniscus", "acl"], name: "Knee pain" },
    { terms: ["back", "lumbar", "radiculopathy"], name: "Low back pain" },
    { terms: ["shoulder", "rotator cuff"], name: "Shoulder pain" },
    { terms: ["headache", "migraine"], name: "Headache" }
  ];

  const hits = diagnosisMap
    .filter((entry) => containsAny(text, entry.terms))
    .map((entry) => ({ name: entry.name, confidence: 0.78 }));

  return hits.length > 0 ? hits : [{ name: "General follow-up condition", confidence: 0.5 }];
};

export const extractClinicalFacts = (
  encounter: Encounter
): { diagnoses: Diagnosis[]; findings: ClinicalFinding[] } => {
  const source = `${encounter.transcript}\n${encounter.note}`.toLowerCase();

  const findings: ClinicalFinding[] = [];

  if (containsAny(source, ["mri", "ct", "x-ray", "xray", "imaging"])) {
    findings.push({
      label: "Data reviewed",
      value: "External imaging or diagnostic data reviewed",
      supportsComplexity: "moderate"
    });
  }

  if (containsAny(source, ["risk", "benefit", "complication", "side effect"])) {
    findings.push({
      label: "Risk discussion",
      value: "Risk-benefit discussion documented",
      supportsComplexity: "moderate"
    });
  }

  if (containsAny(source, ["surgery", "physical therapy", "pt", "injection", "medication adjustment"])) {
    findings.push({
      label: "Management options",
      value: "Treatment alternatives discussed",
      supportsComplexity: "moderate"
    });
  }

  if (containsAny(source, ["hospitalization", "emergency", "severe", "worsening", "high risk"])) {
    findings.push({
      label: "Severity",
      value: "High-acuity indicators present",
      supportsComplexity: "high"
    });
  }

  if (findings.length === 0) {
    findings.push({
      label: "Clinical assessment",
      value: "Focused follow-up assessment documented",
      supportsComplexity: "low"
    });
  }

  return {
    diagnoses: detectDiagnoses(source),
    findings
  };
};
