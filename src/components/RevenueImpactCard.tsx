import { RevenueImpact } from "@/lib/types";

type Props = {
  impact: RevenueImpact;
};

const money = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });

export default function RevenueImpactCard({ impact }: Props) {
  return (
    <section className="card accent">
      <h2>Revenue Impact</h2>
      <p>Current code: {impact.currentCode}</p>
      <p>Recommended code: {impact.suggestedCode}</p>
      <p>Delta per visit: {money(impact.deltaPerVisit)}</p>
      <p>Undercoded visits detected: {impact.undercodedVisitsDetected}</p>
      <p className="recovery">Projected monthly recovery: {money(impact.projectedMonthlyRecovery)}</p>
    </section>
  );
}
