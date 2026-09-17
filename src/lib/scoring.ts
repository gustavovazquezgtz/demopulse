// Pure, side-effect-free scoring helpers shared by server actions, the seed
// script, and the AI layer. Keeping these here (instead of inline in actions)
// is what lets AI services and UI both compute consistent numbers.

export type YesNoAnswer = { criterionCode: string; answer: boolean; weight: number };

/** Official score = (weighted YES / total weight) * 100. Section 15/37. */
export function computeEvaluationScore(answers: YesNoAnswer[]): number {
  if (answers.length === 0) return 0;
  const totalWeight = answers.reduce((sum, a) => sum + a.weight, 0);
  if (totalWeight === 0) return 0;
  const earned = answers.reduce((sum, a) => sum + (a.answer ? a.weight : 0), 0);
  return (earned / totalWeight) * 100;
}

export type Trend = "IMPROVING" | "STABLE" | "DECLINING" | "INSUFFICIENT_DATA";

/**
 * Compares the average of the most recent `windowSize` scores against the
 * average of the `windowSize` scores before that. Requires at least two full
 * windows of data, otherwise data is deemed insufficient (section 61).
 */
export function computeTrend(
  chronologicalScores: number[],
  windowSize = 3
): { trend: Trend; delta: number | null; current: number | null; previous: number | null } {
  if (chronologicalScores.length < 2) {
    return { trend: "INSUFFICIENT_DATA", delta: null, current: null, previous: null };
  }

  const size = Math.min(windowSize, Math.floor(chronologicalScores.length / 2)) || 1;
  const recent = chronologicalScores.slice(-size);
  const prior = chronologicalScores.slice(-2 * size, -size);

  if (prior.length === 0) {
    return { trend: "INSUFFICIENT_DATA", delta: null, current: avg(recent), previous: null };
  }

  const current = avg(recent);
  const previous = avg(prior);
  const delta = current - previous;

  let trend: Trend = "STABLE";
  if (delta >= 4) trend = "IMPROVING";
  else if (delta <= -4) trend = "DECLINING";

  return { trend, delta, current, previous };
}

function avg(nums: number[]) {
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

/**
 * Evaluation coverage confidence — section 59. A single 100% evaluation is
 * weaker evidence than ten evaluations averaging 88%, so the UI must always
 * pair a score with how much evidence backs it.
 */
export function computeConfidence(evaluationCount: number, distinctEvaluators: number): ConfidenceLevel {
  if (evaluationCount >= 6 && distinctEvaluators >= 2) return "HIGH";
  if (evaluationCount >= 3) return "MEDIUM";
  return "LOW";
}

/** Manager-consensus agreement label for section 36. */
export function computeAgreement(scores: number[]): { agreement: "HIGH" | "MODERATE" | "LOW"; stddev: number } {
  if (scores.length < 2) return { agreement: "HIGH", stddev: 0 };
  const mean = avg(scores);
  const variance = avg(scores.map((s) => (s - mean) ** 2));
  const stddev = Math.sqrt(variance);
  if (stddev <= 8) return { agreement: "HIGH", stddev };
  if (stddev <= 18) return { agreement: "MODERATE", stddev };
  return { agreement: "LOW", stddev };
}

export function round(n: number) {
  return Math.round(n);
}
