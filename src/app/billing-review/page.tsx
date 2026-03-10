"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BillingSuggestion from "@/components/BillingSuggestion";
import DocumentationGaps from "@/components/DocumentationGaps";
import RevenueImpactCard from "@/components/RevenueImpactCard";
import { loadAnalysis } from "@/lib/session";
import { AnalysisResult } from "@/lib/types";

export default function BillingReviewPage() {
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

  if (!analysis) return null;

  return (
    <>
      <h1>Billing Review</h1>
      <p className="subtitle">Evidence-based coding review with documentation completion checks.</p>

      <BillingSuggestion recommendation={analysis.recommendation} />
      <DocumentationGaps gaps={analysis.gaps} />
      <RevenueImpactCard impact={analysis.revenueImpact} />

      <div className="toolbar">
        <button onClick={() => router.push("/final-output")}>Approve and Finalize</button>
        <button className="secondary" onClick={() => router.push("/encounter")}>Back to Encounter</button>
      </div>
    </>
  );
}
