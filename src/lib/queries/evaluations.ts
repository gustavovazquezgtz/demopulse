import { prisma } from "@/lib/prisma";
import { averageScore } from "@/lib/scoring";
import { sortRows } from "@/lib/sort";

export interface EvaluationFilters {
  teamId?: string;
  evaluatorId?: string;
  developerId?: string;
  demoId?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  sort?: string;
  dir?: string;
}

/**
 * Every completed evaluation, from every manager, for every engineer —
 * global visibility by design (section 4). Any manager can filter this down
 * to whatever slice they care about, but nothing is hidden by ownership.
 */
export async function listAllEvaluations(filters: EvaluationFilters = {}) {
  const evaluations = await prisma.evaluation.findMany({
    where: {
      status: "COMPLETED",
      ...(filters.evaluatorId ? { evaluatorId: filters.evaluatorId } : {}),
      ...(filters.developerId ? { developerId: filters.developerId } : {}),
      ...(filters.demoId ? { demoId: filters.demoId } : {}),
      ...(filters.teamId ? { developer: { teamMemberships: { some: { teamId: filters.teamId } } } } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            demo: {
              date: {
                ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
                ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59`) } : {}),
              },
            },
          }
        : {}),
    },
    include: {
      developer: true,
      evaluator: true,
      demo: { include: { teams: { include: { team: true } } } },
    },
  });

  let rows = evaluations.map((e) => ({
    id: e.id,
    engineerId: e.developerId,
    engineerName: e.developer.name,
    evaluatorId: e.evaluatorId,
    evaluatorName: e.evaluator.name,
    teams: e.demo.teams.map((t) => t.team.name),
    demoId: e.demoId,
    session: e.demo.title,
    date: e.demo.date,
    score: e.score ?? 0,
  }));

  if (filters.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.engineerName.toLowerCase().includes(q) ||
        r.evaluatorName.toLowerCase().includes(q) ||
        r.session.toLowerCase().includes(q) ||
        r.teams.some((t) => t.toLowerCase().includes(q))
    );
  }

  return sortRows(rows, filters.sort, filters.dir, "date", "desc");
}

export async function getEvaluationFilterOptions() {
  const [teams, managers, developers, demos] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: { in: ["MANAGER", "CEO"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: "DEVELOPER" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.demo.findMany({ orderBy: { date: "desc" }, select: { id: true, title: true } }),
  ]);
  return { teams, managers, developers, demos };
}

/**
 * Engineer × Manager score matrix (section 17) — who evaluated whom, and
 * what did each manager individually score them. Built strictly from
 * Evaluation.evaluatorId / developerId / score; nothing mocked.
 */
export async function getManagerComparison() {
  const managers = await prisma.user.findMany({ where: { role: "MANAGER" }, orderBy: { name: "asc" } });
  const developers = await prisma.user.findMany({
    where: { role: "DEVELOPER" },
    include: { evaluationsReceived: { where: { status: "COMPLETED" }, select: { score: true, evaluatorId: true } } },
    orderBy: { name: "asc" },
  });

  const rows = developers.map((d) => {
    const byManager: Record<string, number | null> = {};
    for (const m of managers) {
      const scores = d.evaluationsReceived.filter((e) => e.evaluatorId === m.id).map((e) => e.score);
      byManager[m.id] = scores.length ? averageScore(scores) : null;
    }
    return {
      id: d.id,
      name: d.name,
      byManager,
      overall: averageScore(d.evaluationsReceived.map((e) => e.score)),
      evaluationCount: d.evaluationsReceived.length,
    };
  });

  return { managers: managers.map((m) => ({ id: m.id, name: m.name })), rows };
}

export interface QuestionAnalysisRow {
  id: string;
  question: string;
  category: string;
  yesRate: number | null; // % of "yes" answers — the same 0-100 scale used for every other Score in the app
  evaluationCount: number;
  yesCount: number;
  noCount: number;
}

/**
 * Every configured evaluation question (EvaluationCriterion), aggregated
 * from real EvaluationAnswer rows. Our questions are yes/no (not a 1-5
 * scale), so "score" here is the % of "yes" answers — the same convention
 * already used for every dimension breakdown elsewhere in the app (Team
 * Comparison's Delivery/UX/AI/Business columns, for instance). A question
 * with zero answers shows yesRate: null so the UI can render "No evaluation
 * data" instead of a fabricated 0.
 */
export async function getQuestionAnalysis(sort?: string, dir?: string): Promise<QuestionAnalysisRow[]> {
  const criteria = await prisma.evaluationCriterion.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    include: { answers: { include: { evaluation: true } } },
  });

  const rows = criteria.map((c) => {
    const answers = c.answers.filter((a) => a.evaluation.status === "COMPLETED");
    const yesCount = answers.filter((a) => a.answer).length;
    const noCount = answers.length - yesCount;
    return {
      id: c.id,
      question: c.text,
      category: c.dimension,
      yesRate: answers.length ? (yesCount / answers.length) * 100 : null,
      evaluationCount: answers.length,
      yesCount,
      noCount,
    };
  });

  return sortRows(rows, sort, dir, "yesRate", "desc");
}
