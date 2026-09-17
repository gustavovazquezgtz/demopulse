// AI architecture (see section 47/48 of the product spec):
//
//   Signals (pure, deterministic, data-only)
//     -> AiAlert / Recognition rows (severity + evidence, no LLM involved)
//     -> AIProvider.summarize() turns the same evidence into prose for AiInsight rows
//
// Splitting it this way means every alert/recognition is 100% traceable to a
// rule over real data — the swappable AIProvider is only ever responsible for
// *language*, never for deciding whether a risk or recognition exists. This
// is what keeps insights evidence-based and prevents invented facts.

export type InsightType =
  | "STRENGTH"
  | "DEVELOPMENT"
  | "RISK"
  | "RECOGNITION"
  | "RECOMMENDATION"
  | "TREND"
  | "SUMMARY";

export interface Evidence {
  /** Human-readable bullet points shown under "Why am I seeing this?" */
  details: string[];
  evaluationCount?: number;
  demoIds?: string[];
  [key: string]: unknown;
}

export interface DeveloperAnalysisInput {
  developer: { id: string; name: string; title: string | null };
  evaluations: {
    demoId: string;
    demoTitle: string;
    demoDate: string;
    evaluatorName: string;
    projectName: string;
    score: number;
    answers: { criterionCode: string; dimension: string; answer: boolean; comment: string | null }[];
    overallComment: string | null;
  }[];
  managerOpinions: {
    managerName: string;
    strengths: string | null;
    concerns: string | null;
    growthAreas: string | null;
    confidence: number;
    trend: string;
    recommendation: string;
  }[];
  attendance: { total: number; present: number; absent: number; excused: number };
  participation: { participation: number; engagement: number; commitment: number; communication: number; preparedness: number }[];
  historicalScores: { date: string; score: number }[];
}

export interface AIAnalysisOutput {
  summary: string;
  strengths: { title: string; body: string; evidence: Evidence }[];
  growthAreas: { title: string; body: string; evidence: Evidence }[];
  riskSignals: { title: string; body: string; evidence: Evidence }[];
  recommendations: { title: string; body: string; evidence: Evidence }[];
  recognition: { title: string; body: string; evidence: Evidence }[];
}

export interface AIProvider {
  readonly name: string;
  analyzeDeveloper(input: DeveloperAnalysisInput): Promise<AIAnalysisOutput>;
  narrateSummary(prompt: string, facts: string[]): Promise<string>;
}
