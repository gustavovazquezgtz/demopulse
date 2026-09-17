import { prisma } from "@/lib/prisma";
import { computeConfidence, computeTrend, dedupeScoresByDemo } from "@/lib/scoring";
import { sortRows } from "@/lib/sort";
import type { Scope } from "./dashboard";

export async function listPeople(
  scope: Scope,
  opts: { q?: string; teamId?: string; projectId?: string; page?: number; pageSize?: number; sort?: string; dir?: string } = {}
) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;

  const where = {
    role: "DEVELOPER" as const,
    ...(scope.personIds ? { id: { in: scope.personIds } } : {}),
    ...(opts.q ? { name: { contains: opts.q, mode: "insensitive" as const } } : {}),
    ...(opts.teamId ? { teamMemberships: { some: { teamId: opts.teamId } } } : {}),
    ...(opts.projectId ? { projectAssignments: { some: { projectId: opts.projectId } } } : {}),
  };

  // Score/trend are computed after fetch, so sorting by them (and then
  // paginating) has to happen in memory rather than via a DB ORDER BY —
  // fine at this org's scale (dozens of people, not thousands).
  const people = await prisma.user.findMany({
    where,
    include: {
      teamMemberships: { include: { team: true } },
      projectAssignments: { include: { project: true } },
      evaluationsReceived: { where: { status: "COMPLETED" }, include: { demo: true }, orderBy: { demo: { date: "asc" } } },
    },
    orderBy: { name: "asc" },
  });

  const allRows = people.map((p) => {
    const scores = dedupeScoresByDemo(p.evaluationsReceived);
    const trend = computeTrend(scores.map((s) => s.score));
    const confidence = computeConfidence(p.evaluationsReceived.length, 1);
    return {
      id: p.id,
      name: p.name,
      title: p.title,
      active: p.active,
      teams: p.teamMemberships.map((tm) => tm.team.name),
      projects: p.projectAssignments.map((pa) => ({ name: pa.project.name, isPrimary: pa.isPrimary })),
      currentScore: trend.current,
      trend: trend.trend,
      evaluationCount: p.evaluationsReceived.length,
      confidence,
    };
  });

  const total = allRows.length;
  const sorted = sortRows(allRows, opts.sort, opts.dir, "name", "asc");
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize);

  return { rows, total, page, pageSize };
}


export async function getPersonProfile(id: string) {
  const person = await prisma.user.findUnique({
    where: { id },
    include: {
      teamMemberships: { include: { team: true } },
      projectAssignments: { include: { project: true } },
    },
  });
  if (!person) return null;

  const evaluations = await prisma.evaluation.findMany({
    where: { developerId: id, status: "COMPLETED" },
    include: { demo: true, project: true, evaluator: true, answers: { include: { criterion: true } } },
    orderBy: { demo: { date: "desc" } },
  });

  const scoresByDemo = dedupeScoresByDemo(evaluations.map((e) => ({ demoId: e.demoId, demo: e.demo, score: e.score })));
  const trend = computeTrend(scoresByDemo.map((s) => s.score));
  const confidence = computeConfidence(evaluations.length, new Set(evaluations.map((e) => e.evaluatorId)).size);

  const attendance = await prisma.demoAttendee.findMany({ where: { userId: id }, include: { demo: true } });
  const attendanceRate = attendance.length ? (attendance.filter((a) => a.status === "PRESENT").length / attendance.length) * 100 : 0;

  const participation = await prisma.participationScore.findMany({ where: { developerId: id } });
  const avgParticipation = participation.length
    ? participation.reduce((s, p) => s + (p.participation + p.engagement + p.commitment + p.communication + p.preparedness) / 5, 0) /
      participation.length
    : null;

  const managerOpinions = await prisma.managerOpinion.findMany({ where: { developerId: id }, include: { manager: true } });
  const insights = await prisma.aiInsight.findMany({ where: { subjectType: "PERSON", subjectId: id }, orderBy: { createdAt: "desc" } });
  const alerts = await prisma.aiAlert.findMany({ where: { subjectType: "PERSON", subjectId: id, status: "ACTIVE" }, orderBy: { severity: "desc" } });
  const recognitions = await prisma.recognition.findMany({ where: { developerId: id }, orderBy: { createdAt: "desc" } });

  const dims = dimensionBreakdown(evaluations);

  return {
    person,
    evaluations,
    scoresByDemo,
    trend,
    confidence,
    attendance: { total: attendance.length, rate: attendanceRate, rows: attendance },
    avgParticipation,
    managerOpinions,
    insights,
    alerts,
    recognitions,
    dims,
  };
}

function dimensionBreakdown(evaluations: { answers: { answer: boolean; criterion: { dimension: string } }[] }[]) {
  const byDim = new Map<string, { yes: number; total: number }>();
  for (const e of evaluations) {
    for (const a of e.answers) {
      const entry = byDim.get(a.criterion.dimension) ?? { yes: 0, total: 0 };
      entry.total += 1;
      if (a.answer) entry.yes += 1;
      byDim.set(a.criterion.dimension, entry);
    }
  }
  return [...byDim.entries()].map(([label, v]) => ({ label, value: v.total ? (v.yes / v.total) * 100 : 0 }));
}
