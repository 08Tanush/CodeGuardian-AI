export const SEVERITIES = ["high", "medium", "low"];

export function severityRank(severity) {
  const rank = SEVERITIES.indexOf(severity);
  return rank === -1 ? SEVERITIES.length : rank;
}

export function scoreVerdict(score) {
  if (score >= 80) return { label: "Healthy", tone: "good" };
  if (score >= 55) return { label: "Needs attention", tone: "warn" };
  return { label: "At risk", tone: "bad" };
}

export const CATEGORY_LABELS = {
  security: "Security",
  quality: "Code quality",
  documentation: "Documentation",
};
