import { DocumentationGap } from "@/lib/types";

type Props = {
  gaps: DocumentationGap[];
};

export default function DocumentationGaps({ gaps }: Props) {
  return (
    <section className="card">
      <h2>Documentation Gaps</h2>
      {gaps.length === 0 ? (
        <p>No blockers detected. Documentation supports the suggested code.</p>
      ) : (
        <ul>
          {gaps.map((gap) => (
            <li key={gap.missingElement}>
              <strong>{gap.missingElement}</strong>
              <p>{gap.reason}</p>
              <p className="suggestion">Suggested addition: {gap.suggestedAddition}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
