import { RevenueImpact } from "@/lib/types";

const EM_VALUE: Record<string, number> = {
  "99213": 110,
  "99214": 168,
  "99215": 235
};

const detectCurrentCode = (text: string): string => {
  const match = text.match(/9921[3-5]/);
  return match?.[0] ?? "99213";
};

export const estimateRevenueImpact = (
  sourceText: string,
  suggestedCode: string
): RevenueImpact => {
  const currentCode = detectCurrentCode(sourceText);
  const currentValue = EM_VALUE[currentCode] ?? EM_VALUE["99213"];
  const suggestedValue = EM_VALUE[suggestedCode] ?? currentValue;
  const deltaPerVisit = Math.max(0, suggestedValue - currentValue);

  const undercodedVisitsDetected = deltaPerVisit > 0 ? 134 : 0;
  const projectedMonthlyRecovery = deltaPerVisit * undercodedVisitsDetected;

  return {
    currentCode,
    suggestedCode,
    deltaPerVisit,
    projectedMonthlyRecovery,
    undercodedVisitsDetected
  };
};
