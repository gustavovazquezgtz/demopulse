import { describe, it, expect } from "vitest";
import { computeEvaluationScore, computeTrend, computeConfidence, computeAgreement, averageScore, dedupeScoresByDemo } from "@/lib/scoring";

describe("computeEvaluationScore", () => {
  it("computes (yes / total) * 100 for equal weights", () => {
    const answers = [
      { criterionCode: "a", answer: true, weight: 1 },
      { criterionCode: "b", answer: true, weight: 1 },
      { criterionCode: "c", answer: false, weight: 1 },
      { criterionCode: "d", answer: true, weight: 1 },
      { criterionCode: "e", answer: false, weight: 1 },
      { criterionCode: "f", answer: true, weight: 1 },
    ];
    // 4 yes / 6 = 66.67
    expect(computeEvaluationScore(answers)).toBeCloseTo((4 / 6) * 100, 5);
  });

  it("returns 100 when all answers are yes", () => {
    const answers = Array.from({ length: 6 }, (_, i) => ({ criterionCode: `q${i}`, answer: true, weight: 1 }));
    expect(computeEvaluationScore(answers)).toBe(100);
  });

  it("returns 0 when all answers are no", () => {
    const answers = Array.from({ length: 6 }, (_, i) => ({ criterionCode: `q${i}`, answer: false, weight: 1 }));
    expect(computeEvaluationScore(answers)).toBe(0);
  });

  it("returns 0 for an empty answer set instead of dividing by zero", () => {
    expect(computeEvaluationScore([])).toBe(0);
  });

  it("respects per-criterion weights", () => {
    const answers = [
      { criterionCode: "heavy", answer: true, weight: 3 },
      { criterionCode: "light", answer: false, weight: 1 },
    ];
    // 3 / 4 = 75
    expect(computeEvaluationScore(answers)).toBe(75);
  });
});

describe("computeTrend", () => {
  it("reports INSUFFICIENT_DATA with fewer than two data points", () => {
    expect(computeTrend([]).trend).toBe("INSUFFICIENT_DATA");
    expect(computeTrend([80]).trend).toBe("INSUFFICIENT_DATA");
  });

  it("still exposes the known current score for a single demo session, even though trend can't be computed yet", () => {
    // A developer evaluated for only one demo has a perfectly real current
    // score — there's just no history to compare it against. Rankings and
    // score columns must not blank this out to null.
    const result = computeTrend([88]);
    expect(result.trend).toBe("INSUFFICIENT_DATA");
    expect(result.current).toBe(88);
    expect(result.previous).toBeNull();
  });

  it("returns current: null only when there are truly zero data points", () => {
    expect(computeTrend([]).current).toBeNull();
  });

  it("can still compare two single-point windows when exactly two data points exist", () => {
    // windowSize defaults to 3 but is clamped to floor(length/2); with 2 points
    // that's a window of 1, which is enough to compare "before" vs "after".
    const result = computeTrend([70, 75]);
    expect(result.trend).toBe("IMPROVING");
    expect(result.previous).toBe(70);
    expect(result.current).toBe(75);
  });

  it("detects an improving trend", () => {
    const result = computeTrend([60, 62, 61, 85, 88, 90]);
    expect(result.trend).toBe("IMPROVING");
    expect(result.delta).toBeGreaterThan(0);
  });

  it("detects a declining trend", () => {
    const result = computeTrend([90, 88, 85, 60, 58, 55]);
    expect(result.trend).toBe("DECLINING");
    expect(result.delta).toBeLessThan(0);
  });

  it("detects a stable trend for small deltas", () => {
    const result = computeTrend([80, 81, 79, 80, 82, 81]);
    expect(result.trend).toBe("STABLE");
  });
});

describe("computeConfidence", () => {
  it("is LOW with very few evaluations (section 59: one 100% score is weak evidence)", () => {
    expect(computeConfidence(1, 1)).toBe("LOW");
  });

  it("is MEDIUM with a moderate evaluation count", () => {
    expect(computeConfidence(3, 1)).toBe("MEDIUM");
    expect(computeConfidence(5, 1)).toBe("MEDIUM");
  });

  it("is HIGH only with both volume and evaluator diversity", () => {
    expect(computeConfidence(6, 2)).toBe("HIGH");
    expect(computeConfidence(10, 1)).toBe("MEDIUM"); // volume alone isn't enough
  });
});

describe("computeAgreement", () => {
  it("is HIGH with a single score or tightly clustered scores", () => {
    expect(computeAgreement([85]).agreement).toBe("HIGH");
    expect(computeAgreement([80, 83, 85]).agreement).toBe("HIGH");
  });

  it("flags LOW agreement for widely diverging manager scores (section 36)", () => {
    const result = computeAgreement([100, 50]);
    expect(result.agreement).toBe("LOW");
  });
});

describe("averageScore — single aggregation rule for every Score in the app", () => {
  it("is the simple arithmetic mean of valid scores", () => {
    expect(averageScore([80, 90, 100])).toBeCloseTo(90, 5);
  });

  it("ignores null/undefined entries rather than treating them as zero", () => {
    expect(averageScore([80, null, 100, undefined])).toBeCloseTo(90, 5);
  });

  it("returns 0 for an empty or all-null list instead of NaN (empty-state safe)", () => {
    expect(averageScore([])).toBe(0);
    expect(averageScore([null, null])).toBe(0);
  });

  it("matches manual sum/count for a representative multi-evaluator scenario (Test 2 from spec)", () => {
    // Gustavo -> Mariano = 88, Ivan -> Mariano = 91
    const scores = [88, 91];
    expect(averageScore(scores)).toBeCloseTo((88 + 91) / 2, 5);
  });
});

describe("dedupeScoresByDemo — one chronological data point per demo", () => {
  it("averages multiple evaluators' scores for the same demo into a single point", () => {
    const evaluations = [
      { demoId: "d1", score: 80, demo: { date: new Date("2026-09-01") } },
      { demoId: "d1", score: 100, demo: { date: new Date("2026-09-01") } }, // second evaluator, same demo
      { demoId: "d2", score: 60, demo: { date: new Date("2026-09-08") } },
    ];
    const result = dedupeScoresByDemo(evaluations);
    expect(result).toHaveLength(2);
    expect(result[0].score).toBeCloseTo(90, 5); // (80+100)/2
    expect(result[1].score).toBe(60);
  });

  it("sorts chronologically by demo date regardless of input order", () => {
    const evaluations = [
      { demoId: "later", score: 50, demo: { date: new Date("2026-09-20") } },
      { demoId: "earlier", score: 90, demo: { date: new Date("2026-09-01") } },
    ];
    const result = dedupeScoresByDemo(evaluations);
    expect(result[0].score).toBe(90);
    expect(result[1].score).toBe(50);
  });
});
