import { AnalysisResult } from "@/lib/types";

export const SESSION_KEY = "defyb-analysis-result";

export const saveAnalysis = (result: AnalysisResult) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(result));
};

export const loadAnalysis = (): AnalysisResult | null => {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AnalysisResult;
  } catch {
    return null;
  }
};
