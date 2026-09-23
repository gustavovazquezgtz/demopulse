import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

interface DimensionAverages {
  Delivery: number;
  Complexity: number;
  Business: number;
  UX: number;
  AI: number;
  English: number;
}

async function dimensionAverages(evaluationIds: string[]): Promise<DimensionAverages> {
  const answers = await prisma.evaluationAnswer.findMany({
    where: { evaluationId: { in: evaluationIds } },
    include: { criterion: true },
  });
  const byDim = new Map<string, { yes: number; total: number }>();
  for (const a of answers) {
    const e = byDim.get(a.criterion.dimension) ?? { yes: 0, total: 0 };
    e.total += 1;
    if (a.answer) e.yes += 1;
    byDim.set(a.criterion.dimension, e);
  }
  const pct = (dim: string) => {
    const e = byDim.get(dim);
    return e && e.total > 0 ? (e.yes / e.total) * 100 : 0;
  };
  return {
    Delivery: pct("Delivery"),
    Complexity: pct("Complexity"),
    Business: pct("Business"),
    UX: pct("UX"),
    AI: pct("AI"),
    English: pct("English"),
  };
}

/** AITeamSummaryService — section 47. Aggregated, evidence-backed team & org narratives. */
export const AITeamSummaryService = {
  async generateForTeam(teamId: string) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return null;

    // Scoped by the developer's own team membership — a multi-team demo
    // must never let one team's evaluations count toward another team's
    // summary just because they shared a session.
    const evaluations = await prisma.evaluation.findMany({
      where: { status: "COMPLETED", developer: { teamMemberships: { some: { teamId } } } },
      select: { id: true, score: true },
    });
    if (evaluations.length === 0) return null;

    const avgScore = evaluations.reduce((s, e) => s + (e.score ?? 0), 0) / evaluations.length;
    const dims = await dimensionAverages(evaluations.map((e) => e.id));

    const strongest = Object.entries(dims).sort((a, b) => b[1] - a[1])[0];
    const weakest = Object.entries(dims).sort((a, b) => a[1] - b[1])[0];

    const summary = `Team ${team.name} averages ${Math.round(avgScore)} across ${evaluations.length} evaluations. Strongest dimension: ${strongest[0]} (${Math.round(strongest[1])}%). Weakest dimension: ${weakest[0]} (${Math.round(weakest[1])}%).`;

    await prisma.aiInsight.deleteMany({ where: { subjectType: "TEAM", subjectId: teamId } });
    await prisma.aiInsight.create({
      data: {
        subjectType: "TEAM",
        subjectId: teamId,
        type: "SUMMARY",
        title: `${team.name} performance summary`,
        body: summary,
        evidence: {
          details: [
            `${evaluations.length} completed evaluations`,
            ...Object.entries(dims).map(([d, v]) => `${d}: ${Math.round(v)}%`),
          ],
        } as Prisma.InputJsonValue,
      },
    });

    return { avgScore, dims };
  },

  async generateForOrganization() {
    const evaluations = await prisma.evaluation.findMany({
      where: { status: "COMPLETED" },
      select: { id: true, score: true },
    });
    if (evaluations.length === 0) return null;

    const avgScore = evaluations.reduce((s, e) => s + (e.score ?? 0), 0) / evaluations.length;
    const dims = await dimensionAverages(evaluations.map((e) => e.id));

    const teams = await prisma.team.findMany();
    const teamScores: { name: string; avg: number }[] = [];
    for (const t of teams) {
      const teamEvals = await prisma.evaluation.findMany({
        where: { status: "COMPLETED", developer: { teamMemberships: { some: { teamId: t.id } } } },
        select: { score: true },
      });
      if (teamEvals.length === 0) continue;
      teamScores.push({ name: t.name, avg: teamEvals.reduce((s, e) => s + (e.score ?? 0), 0) / teamEvals.length });
    }
    teamScores.sort((a, b) => b.avg - a.avg);
    const best = teamScores[0];
    const lowestDim = Object.entries(dims).sort((a, b) => a[1] - b[1])[0];

    const summary = `Organization average score is ${Math.round(avgScore)} across ${evaluations.length} evaluations.${
      best ? ` ${best.name} currently leads the organization with an average of ${Math.round(best.avg)}.` : ""
    } ${lowestDim[0]} remains the largest organization-wide opportunity at ${Math.round(lowestDim[1])}%.`;

    await prisma.aiInsight.deleteMany({ where: { subjectType: "ORGANIZATION", subjectId: null } });
    await prisma.aiInsight.create({
      data: {
        subjectType: "ORGANIZATION",
        subjectId: null,
        type: "SUMMARY",
        title: "Executive AI Summary",
        body: summary,
        evidence: {
          details: [
            `${evaluations.length} completed evaluations across ${teams.length} teams`,
            ...teamScores.map((t) => `${t.name}: ${Math.round(t.avg)}`),
          ],
        } as Prisma.InputJsonValue,
      },
    });

    return { avgScore, dims, teamScores };
  },
};
