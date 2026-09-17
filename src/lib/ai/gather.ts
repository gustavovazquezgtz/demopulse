import { prisma } from "@/lib/prisma";
import type { DeveloperAnalysisInput } from "./types";

/** Pulls every source the AI layer is allowed to use for one developer (section 22). */
export async function buildDeveloperAnalysisInput(developerId: string): Promise<DeveloperAnalysisInput | null> {
  const developer = await prisma.user.findUnique({ where: { id: developerId } });
  if (!developer) return null;

  const evaluations = await prisma.evaluation.findMany({
    where: { developerId, status: "COMPLETED" },
    include: {
      demo: true,
      project: true,
      evaluator: true,
      answers: { include: { criterion: true } },
    },
    orderBy: { demo: { date: "asc" } },
  });

  const managerOpinions = await prisma.managerOpinion.findMany({
    where: { developerId },
    include: { manager: true },
  });

  const attendanceRows = await prisma.demoAttendee.findMany({ where: { userId: developerId } });
  const attendance = {
    total: attendanceRows.length,
    present: attendanceRows.filter((a) => a.status === "PRESENT").length,
    absent: attendanceRows.filter((a) => a.status === "ABSENT").length,
    excused: attendanceRows.filter((a) => a.status === "EXCUSED").length,
  };

  const participation = await prisma.participationScore.findMany({ where: { developerId } });

  return {
    developer: { id: developer.id, name: developer.name, title: developer.title },
    evaluations: evaluations.map((e) => ({
      demoId: e.demoId,
      demoTitle: e.demo.title,
      demoDate: e.demo.date.toISOString().slice(0, 10),
      evaluatorName: e.evaluator.name,
      projectName: e.project.name,
      score: e.score ?? 0,
      answers: e.answers.map((a) => ({
        criterionCode: a.criterion.code,
        dimension: a.criterion.dimension,
        answer: a.answer,
        comment: a.comment,
      })),
      overallComment: e.overallComment,
    })),
    managerOpinions: managerOpinions.map((o) => ({
      managerName: o.manager.name,
      strengths: o.strengths,
      concerns: o.concerns,
      growthAreas: o.growthAreas,
      confidence: o.confidence,
      trend: o.trend,
      recommendation: o.recommendation,
    })),
    attendance,
    participation: participation.map((p) => ({
      participation: p.participation,
      engagement: p.engagement,
      commitment: p.commitment,
      communication: p.communication,
      preparedness: p.preparedness,
    })),
    // One point per demo (averaged across evaluators) so a demo evaluated by
    // multiple managers doesn't distort trend/streak calculations.
    historicalScores: averageByDemo(evaluations),
  };
}

function averageByDemo(
  evaluations: { demoId: string; demo: { date: Date }; score: number | null }[]
): { date: string; score: number }[] {
  const byDemo = new Map<string, { date: Date; scores: number[] }>();
  for (const e of evaluations) {
    const entry = byDemo.get(e.demoId) ?? { date: e.demo.date, scores: [] };
    entry.scores.push(e.score ?? 0);
    byDemo.set(e.demoId, entry);
  }
  return [...byDemo.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((v) => ({ date: v.date.toISOString().slice(0, 10), score: v.scores.reduce((s, n) => s + n, 0) / v.scores.length }));
}
