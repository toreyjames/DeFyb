export const EXTRACTION_PROMPT_TEMPLATE = `
Extract clinically relevant facts for billing justification without fabricating details.
Return structured output with diagnosis context, data reviewed, risk indicators, and management actions.
`;

export const CODING_PROMPT_TEMPLATE = `
Map extracted encounter facts to E/M coding logic and provide explicit rationale bullets.
Highlight uncertainty and any missing support needed to justify the recommended level.
`;

export const GAP_PROMPT_TEMPLATE = `
Identify documentation gaps that block compliant coding.
Suggest concise, compliant additions that reflect documented clinical activity.
`;
