import { prisma } from "@/lib/prisma";
import type { Scope } from "./dashboard";
import { averageScore } from "@/lib/scoring";
import { sortRows } from "@/lib/sort";

export async function listTeams(scope: Scope, opts: { sort?: string; dir?: string } = {}) {
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
    // Scoped by the developer's own team membership — a multi-team demo
    // must never let one team's evaluations count toward another team just
    // because they shared a session.
    const evaluations = await prisma.evaluation.findMany({
      where: { status: "COMPLETED", developer: { teamMemberships: { some: { teamId: t.id } } } },
      select: { score: true, developerId: true },
    });
    const attendance = await prisma.demoAttendee.findMany({
      where: { user: { teamMemberships: { some: { teamId: t.id } } } },
      select: { status: true },
    });
    const avgScore = averageScore(evaluations.map((e) => e.score));
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
      evaluationCount: evaluations.length,
    });
  }
  return sortRows(results, opts.sort, opts.dir, "name", "asc");
}

export async function getTeamDetail(id: string) {
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      managers: { include: { user: true } },
      members: { include: { user: true } },
      projects: { include: { project: { include: { urls: true } } } },
    },
  });
  if (!team) return null;

  // Team and Project are one concept for the user — deliverables/links live
  // on Project in the schema, so pull them in here rather than sending
  // people to a separate Projects screen.
  const linkedProjectIds = team.projects.map((p) => p.projectId);
  const urls = team.projects.flatMap((p) => p.project.urls);
  const deliverables = linkedProjectIds.length
    ? await prisma.demoDeliverable.findMany({
        where: { projectId: { in: linkedProjectIds } },
        include: { owners: { include: { user: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      })
    : [];

  const demos = await prisma.demo.findMany({
    where: { teams: { some: { teamId: id } } },
    include: { projects: { include: { project: true } } },
    orderBy: { date: "desc" },
  });
  // Scoped by the developer's own team membership — see listTeams() above.
  const evaluations = await prisma.evaluation.findMany({
    where: { status: "COMPLETED", developer: { teamMemberships: { some: { teamId: id } } } },
    include: { answers: { include: { criterion: true } } },
  });
  const attendance = await prisma.demoAttendee.findMany({ where: { user: { teamMemberships: { some: { teamId: id } } } } });

  const avgScore = averageScore(evaluations.map((e) => e.score));
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

  return { team, demos, avgScore, attendanceRate, dims, insight, evaluationCount: evaluations.length, urls, deliverables };
}
