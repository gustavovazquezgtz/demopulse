import type { AIAnalysisOutput, AIProvider, DeveloperAnalysisInput, Evidence } from "./types";
import { computeTrend } from "@/lib/scoring";

/**
 * Zero-configuration default provider. Produces fully data-grounded,
 * templated prose — every sentence traces back to a number or comment
 * present in the input, so there is no hallucination risk. This is what
 * DemoPulse runs on until a real LLM provider (see openai-provider.ts) is
 * configured via AI_PROVIDER / OPENAI_API_KEY.
 */
export class RuleBasedProvider implements AIProvider {
  readonly name = "rule-based";

  async narrateSummary(prompt: string, facts: string[]): Promise<string> {
    if (facts.length === 0) return "Not enough data yet to generate a summary.";
    return `${prompt} ${facts.join(" ")}`;
  }

  async analyzeDeveloper(input: DeveloperAnalysisInput): Promise<AIAnalysisOutput> {
    const { developer, evaluations, managerOpinions, attendance, historicalScores } = input;

    const strengths: AIAnalysisOutput["strengths"] = [];
    const growthAreas: AIAnalysisOutput["growthAreas"] = [];
    const riskSignals: AIAnalysisOutput["riskSignals"] = [];
    const recommendations: AIAnalysisOutput["recommendations"] = [];
    const recognition: AIAnalysisOutput["recognition"] = [];

    if (evaluations.length === 0) {
      return {
        summary: `${developer.name} has not yet been evaluated in a completed demo. Insights will appear after their first evaluation.`,
        strengths,
        growthAreas,
        riskSignals,
        recommendations,
        recognition,
      };
    }

    // ── Per-dimension yes-rate across all evaluations ──────────────────
    const byDimension = new Map<string, { yes: number; total: number; comments: string[] }>();
    for (const ev of evaluations) {
      for (const a of ev.answers) {
        const entry = byDimension.get(a.dimension) ?? { yes: 0, total: 0, comments: [] };
        entry.total += 1;
        if (a.answer) entry.yes += 1;
        if (a.comment) entry.comments.push(a.comment);
        byDimension.set(a.dimension, entry);
      }
    }

    for (const [dimension, stat] of byDimension) {
      const rate = stat.yes / stat.total;
      if (rate >= 0.85 && stat.total >= 2) {
        strengths.push({
          title: `Consistent strength in ${dimension}`,
          body: `${developer.name} scored positively on ${dimension} in ${stat.yes} of ${stat.total} evaluations.${
            stat.comments[0] ? ` One manager noted: "${stat.comments[0]}"` : ""
          }`,
          evidence: {
            details: [
              `${stat.yes}/${stat.total} positive answers on "${dimension}"`,
              ...stat.comments.slice(0, 2).map((c) => `Comment: "${c}"`),
            ],
            evaluationCount: stat.total,
          },
        });
      } else if (rate <= 0.5 && stat.total >= 2) {
        growthAreas.push({
          title: `${dimension} remains a development area`,
          body: `Across ${stat.total} evaluations, ${developer.name} received a positive "${dimension}" rating only ${stat.yes} time${
            stat.yes === 1 ? "" : "s"
          }.`,
          evidence: {
            details: [
              `${stat.yes}/${stat.total} positive answers on "${dimension}"`,
              ...stat.comments.slice(0, 2).map((c) => `Comment: "${c}"`),
            ],
            evaluationCount: stat.total,
          },
        });
      }
    }

    // ── Score trend ──────────────────────────────────────────────────
    const scores = historicalScores.map((h) => h.score);
    const { trend, current, previous, delta } = computeTrend(scores);
    if (trend === "DECLINING") {
      riskSignals.push({
        title: "Performance trend declining",
        body: `${developer.name}'s average score moved from ${Math.round(previous ?? 0)} to ${Math.round(
          current ?? 0
        )} (${(delta ?? 0).toFixed(0)} pts) over their most recent demos.`,
        evidence: { details: historicalScores.slice(-6).map((h) => `${h.date}: ${Math.round(h.score)}`) },
      });
    } else if (trend === "IMPROVING") {
      strengths.push({
        title: "Improving trend",
        body: `${developer.name}'s average score improved from ${Math.round(previous ?? 0)} to ${Math.round(
          current ?? 0
        )} over their most recent demos.`,
        evidence: { details: historicalScores.slice(-6).map((h) => `${h.date}: ${Math.round(h.score)}`) },
      });
    }

    // ── Consecutive low scores ───────────────────────────────────────
    const lowStreak = trailingStreak(scores, (s) => s < 70);
    if (lowStreak >= 3) {
      riskSignals.push({
        title: "Repeated scores below 70",
        body: `${developer.name} has scored below 70% in ${lowStreak} consecutive demos.`,
        evidence: { details: historicalScores.slice(-lowStreak).map((h) => `${h.date}: ${Math.round(h.score)}`) },
      });
      const weakestDim = [...byDimension.entries()].sort((a, b) => a[1].yes / a[1].total - b[1].yes / b[1].total)[0];
      recommendations.push({
        title: "Targeted follow-up recommended",
        body: `Consider pairing ${developer.name} with a focused follow-up on ${
          weakestDim ? weakestDim[0] : "the weakest evaluation dimension"
        } before the next demo — this is the area with the lowest positive-answer rate in recent evaluations.`,
        evidence: {
          details: [
            `${lowStreak} consecutive demos below 70%`,
            weakestDim ? `Weakest dimension: ${weakestDim[0]} (${weakestDim[1].yes}/${weakestDim[1].total})` : "",
          ].filter(Boolean),
        },
      });
    }

    // ── High streak → recognition ────────────────────────────────────
    const highStreak = trailingStreak(scores, (s) => s >= 85);
    if (highStreak >= 3) {
      const mentioningManagers = new Set(
        evaluations.filter((e) => e.overallComment).slice(-highStreak).map((e) => e.evaluatorName)
      );
      recognition.push({
        title: `${developer.name} is a consistent top performer`,
        body: `${developer.name} has scored above 85% in ${highStreak} consecutive demos${
          mentioningManagers.size > 1 ? `, with positive comments from ${mentioningManagers.size} different managers` : ""
        }.`,
        evidence: {
          details: [
            `${highStreak} consecutive demos ≥ 85%`,
            ...[...mentioningManagers].slice(0, 3).map((m) => `Positive comment from ${m}`),
          ],
        },
      });
    }

    // ── Attendance ───────────────────────────────────────────────────
    if (attendance.total >= 3) {
      const rate = attendance.present / attendance.total;
      if (rate < 0.7) {
        riskSignals.push({
          title: "Attendance below team norms",
          body: `${developer.name} was present for ${attendance.present} of ${attendance.total} invited demos (${Math.round(
            rate * 100
          )}%).`,
          evidence: { details: [`Present: ${attendance.present}`, `Absent: ${attendance.absent}`, `Excused: ${attendance.excused}`] },
        });
      }
    }

    // ── Manager opinions ─────────────────────────────────────────────
    for (const op of managerOpinions) {
      if (op.recommendation === "NEEDS_ATTENTION" || op.recommendation === "SIGNIFICANT_CONCERN") {
        riskSignals.push({
          title: `Manager concern from ${op.managerName}`,
          body: op.concerns
            ? `${op.managerName} flagged: "${op.concerns}"`
            : `${op.managerName}'s overall recommendation is "${op.recommendation.replace("_", " ").toLowerCase()}".`,
          evidence: { details: [`Recommendation: ${op.recommendation}`, `Confidence: ${op.confidence}/5`] },
        });
      }
      if (op.strengths) {
        strengths.push({
          title: `Manager insight from ${op.managerName}`,
          body: op.strengths,
          evidence: { details: [`Direct manager opinion from ${op.managerName}`, `Confidence: ${op.confidence}/5`] },
        });
      }
    }

    const summary = buildSummary(developer.name, evaluations.length, trend, strengths.length, riskSignals.length);

    return { summary, strengths, growthAreas, riskSignals, recommendations, recognition };
  }
}

function trailingStreak(scores: number[], predicate: (n: number) => boolean): number {
  let streak = 0;
  for (let i = scores.length - 1; i >= 0; i--) {
    if (predicate(scores[i])) streak++;
    else break;
  }
  return streak;
}

function buildSummary(name: string, evalCount: number, trend: string, strengthCount: number, riskCount: number) {
  const trendPhrase =
    trend === "IMPROVING" ? "an improving trend" : trend === "DECLINING" ? "a declining trend" : "a stable trend";
  const parts = [`Based on ${evalCount} evaluation${evalCount === 1 ? "" : "s"}, ${name} shows ${trendPhrase}.`];
  if (strengthCount > 0) parts.push(`${strengthCount} strength area${strengthCount === 1 ? "" : "s"} identified.`);
  if (riskCount > 0) parts.push(`${riskCount} risk signal${riskCount === 1 ? "" : "s"} to review.`);
  return parts.join(" ");
}

export function toEvidence(details: string[], extra: Partial<Evidence> = {}): Evidence {
  return { details, ...extra };
}
