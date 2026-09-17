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
  if (chronologicalScores.length === 0) {
    return { trend: "INSUFFICIENT_DATA", delta: null, current: null, previous: null };
  }
  // A single demo session still has a perfectly knowable current score —
  // there's just nothing yet to compare it against, so trend stays
  // INSUFFICIENT_DATA without discarding the score itself.
  if (chronologicalScores.length === 1) {
    return { trend: "INSUFFICIENT_DATA", delta: null, current: chronologicalScores[0], previous: null };
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

/**
 * The single aggregation rule for every "Score" shown anywhere in the app —
 * dashboard cards, rankings, team comparison, charts, reports, engineer
 * detail. All of them are the simple arithmetic mean of the underlying
 * COMPLETED Evaluation.score values (each already computed once by
 * computeEvaluationScore at save time):
 *
 *   Question Score    → yes/no answer to one EvaluationCriterion
 *   Evaluation Score   → computeEvaluationScore(answers) = (yes / total) * 100
 *   Engineer Score      → averageScore(all their Evaluation.score)
 *   Team Score           → averageScore(Evaluation.score for demos that team participated in)
 *   Company Score         → averageScore(every Evaluation.score org-wide)
 *
 * Every query module (dashboard/teams/projects/people/ranking) calls this
 * instead of re-implementing the reduce/length math, so a change to the
 * aggregation rule only has to happen in one place.
 */
export function averageScore(scores: (number | null | undefined)[]): number {
  const valid = scores.filter((s): s is number => s !== null && s !== undefined);
  if (valid.length === 0) return 0;
  return valid.reduce((sum, s) => sum + s, 0) / valid.length;
}

/**
 * A person can be evaluated by more than one manager for the same demo —
 * for trend purposes those must collapse into a single chronological point
 * (one demo = one data point), not double-count. Shared by the People list,
 * Engineer Detail, and Ranking so "current score" and "trend" always agree.
 */
export function dedupeScoresByDemo(
  evaluations: { demoId: string; score: number | null; demo: { date: Date } }[]
): { date: Date; score: number }[] {
  const byDemo = new Map<string, { date: Date; scores: number[] }>();
  for (const e of evaluations) {
    const entry = byDemo.get(e.demoId) ?? { date: e.demo.date, scores: [] };
    entry.scores.push(e.score ?? 0);
    byDemo.set(e.demoId, entry);
  }
  return [...byDemo.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((v) => ({ date: v.date, score: averageScore(v.scores) }));
}
