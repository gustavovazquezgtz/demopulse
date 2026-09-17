import { prisma } from "@/lib/prisma";
import type { Scope } from "./dashboard";

export async function listTeams(scope: Scope) {
  const teams = await prisma.team.findMany({
    where: scope.teamIds ? { id: { in: scope.teamIds } } : {},
    include: {
      managers: { include: { user: true } },
      members: true,
      projects: { include: { project: true } },
      demos: true,
    },
    orderBy: { name: "asc" },
  });

  const results = [];
  for (const t of teams) {
    const evaluations = await prisma.evaluation.findMany({
      where: { status: "COMPLETED", demo: { teams: { some: { teamId: t.id } } } },
      select: { score: true, developerId: true },
    });
    const attendance = await prisma.demoAttendee.findMany({
      where: { demo: { teams: { some: { teamId: t.id } } } },
      select: { status: true },
    });
    const avgScore = evaluations.length ? evaluations.reduce((s, e) => s + (e.score ?? 0), 0) / evaluations.length : 0;
    const attendanceRate = attendance.length ? (attendance.filter((a) => a.status === "PRESENT").length / attendance.length) * 100 : 0;

    results.push({
      id: t.id,
      name: t.name,
      description: t.description,
      managers: t.managers.map((m) => m.user.name),
      memberCount: t.members.length,
      projects: t.projects.map((p) => p.project.name),
      demoCount: t.demos.length,
      avgScore,
      attendanceRate,
      evaluatedCount: new Set(evaluations.map((e) => e.developerId)).size,
    });
  }
  return results;
}

export async function getTeamDetail(id: string) {
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      managers: { include: { user: true } },
      members: { include: { user: true } },
      projects: { include: { project: true } },
    },
  });
  if (!team) return null;

  const demos = await prisma.demo.findMany({
    where: { teams: { some: { teamId: id } } },
    include: { projects: { include: { project: true } } },
    orderBy: { date: "desc" },
  });
  const evaluations = await prisma.evaluation.findMany({
    where: { status: "COMPLETED", demo: { teams: { some: { teamId: id } } } },
    include: { answers: { include: { criterion: true } } },
  });
  const attendance = await prisma.demoAttendee.findMany({ where: { demo: { teams: { some: { teamId: id } } } } });

  const avgScore = evaluations.length ? evaluations.reduce((s, e) => s + (e.score ?? 0), 0) / evaluations.length : 0;
  const attendanceRate = attendance.length ? (attendance.filter((a) => a.status === "PRESENT").length / attendance.length) * 100 : 0;

  const byDim = new Map<string, { yes: number; total: number }>();
  for (const e of evaluations) {
    for (const a of e.answers) {
      const entry = byDim.get(a.criterion.dimension) ?? { yes: 0, total: 0 };
      entry.total += 1;
      if (a.answer) entry.yes += 1;
      byDim.set(a.criterion.dimension, entry);
    }
  }
  const dims = [...byDim.entries()].map(([label, v]) => ({ label, value: v.total ? (v.yes / v.total) * 100 : 0 }));

  const insight = await prisma.aiInsight.findFirst({ where: { subjectType: "TEAM", subjectId: id }, orderBy: { createdAt: "desc" } });

  return { team, demos, avgScore, attendanceRate, dims, insight, evaluationCount: evaluations.length };
}
