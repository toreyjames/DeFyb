import { BillingRecommendation } from "@/lib/types";

type Props = {
  recommendation: BillingRecommendation;
};

export default function BillingSuggestion({ recommendation }: Props) {
  return (
    <section className="card">
      <h2>Suggested Code: {recommendation.suggestedCode}</h2>
      <p className="subtitle">Confidence: {(recommendation.confidence * 100).toFixed(0)}%</p>
      <ul>
        {recommendation.rationale.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
