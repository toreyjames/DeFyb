"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadAnalysis } from "@/lib/session";
import { AnalysisResult } from "@/lib/types";

const copy = async (value: string) => {
  await navigator.clipboard.writeText(value);
};

export default function FinalOutputPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    const value = loadAnalysis();
    if (!value) {
      router.replace("/encounter");
      return;
    }
    setAnalysis(value);
  }, [router]);

  const billingSummary = useMemo(() => {
    if (!analysis) return "";
    return [
      `Approved Code: ${analysis.recommendation.suggestedCode}`,
      "Justification:",
      ...analysis.recommendation.rationale.map((line) => `- ${line}`),
      `Estimated Monthly Recovery: $${analysis.revenueImpact.projectedMonthlyRecovery.toLocaleString()}`
    ].join("\n");
  }, [analysis]);

  if (!analysis) return null;

  return (
    <>
      <h1>Final Output</h1>
      <p className="subtitle">Doctor-approved note and billing package ready for submission.</p>

      <section className="card">
        <h2>Final Clinical Note</h2>
        <div className="code-box">{analysis.finalizedNote}</div>
      </section>

      <section className="card">
        <h2>Billing Summary</h2>
        <div className="code-box">{billingSummary}</div>
      </section>

      <div className="toolbar">
        <button onClick={() => copy(analysis.finalizedNote)}>Copy Note</button>
        <button onClick={() => copy(billingSummary)}>Copy Billing Summary</button>
        <button onClick={() => copy(billingSummary)} className="secondary">Send to Billing</button>
      </div>
    </>
  );
}
