// Pure, side-effect-free Employee Bank logic — mirrors lib/scoring.ts's
// pattern of keeping the math out of actions/queries so it can be tested
// and reused identically everywhere it's needed.

export interface GroupThresholds {
  aMin: number; // score >= aMin → suggested A
  bMin: number; // score >= bMin (and < aMin) → suggested B; below bMin → C
}

// 0-100 scale, matching Evaluation.score / averageScore everywhere else in
// the app — there is no separate manual rating scale anymore.
export const DEFAULT_GROUP_THRESHOLDS: GroupThresholds = { aMin: 90, bMin: 70 };

export type Group = "A" | "B" | "C";

/**
 * Suggested group is a pure function of the employee's live demo
 * evaluation score (averageScore over their COMPLETED Evaluation rows) —
 * never a manually captured number. Demo score/trend/eval count are shown
 * alongside as supporting context (section 22) but never change this
 * number — only a manager's own Group selection is ever the "real"
 * classification. `null` means "no evaluations yet," not a score of 0.
 */
export function suggestGroup(score: number | null, thresholds: GroupThresholds = DEFAULT_GROUP_THRESHOLDS): Group | null {
  if (score === null || score === undefined) return null;
  if (score >= thresholds.aMin) return "A";
  if (score >= thresholds.bMin) return "B";
  return "C";
}

/** Non-terminal prospect statuses count as "active" everywhere in this module. */
export const TERMINAL_PROSPECT_STATUSES = new Set(["ACCEPTED", "REJECTED", "WITHDRAWN", "CANCELLED"]);

export function isActiveProspectStatus(status: string): boolean {
  return !TERMINAL_PROSPECT_STATUSES.has(status);
}

export const PROSPECT_OUTCOME_REQUIRED_STATUSES = new Set(["REJECTED", "WITHDRAWN", "CANCELLED"]);

export function requiresOutcomeReason(status: string): boolean {
  return PROSPECT_OUTCOME_REQUIRED_STATUSES.has(status);
}
