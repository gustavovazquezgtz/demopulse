import { prisma } from "@/lib/prisma";
import type { Scope } from "./dashboard";

export async function listProjects(scope: Scope) {
  const projects = await prisma.project.findMany({
    where: scope.projectIds ? { id: { in: scope.projectIds } } : {},
    include: {
      managers: { include: { user: true } },
      teams: { include: { team: true } },
      assignments: true,
      demos: true,
    },
    orderBy: { name: "asc" },
  });

  const results = [];
  for (const p of projects) {
    const evaluations = await prisma.evaluation.findMany({ where: { status: "COMPLETED", projectId: p.id }, select: { score: true } });
    const avgScore = evaluations.length ? evaluations.reduce((s, e) => s + (e.score ?? 0), 0) / evaluations.length : 0;
    results.push({
      id: p.id,
      name: p.name,
      client: p.client,
      status: p.status,
      managers: p.managers.map((m) => m.user.name),
      teams: p.teams.map((t) => t.team.name),
      memberCount: p.assignments.length,
      demoCount: p.demos.length,
      avgScore,
    });
  }
  return results;
}

export async function getProjectDetail(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      managers: { include: { user: true } },
      teams: { include: { team: true } },
      assignments: { include: { user: true } },
      urls: true,
    },
  });
  if (!project) return null;

  const demos = await prisma.demo.findMany({
    where: { projects: { some: { projectId: id } } },
    include: { teams: { include: { team: true } } },
    orderBy: { date: "desc" },
  });
  const evaluations = await prisma.evaluation.findMany({
    where: { status: "COMPLETED", projectId: id },
    include: { answers: { include: { criterion: true } }, developer: true, demo: true },
    orderBy: { demo: { date: "desc" } },
  });
  const deliverables = await prisma.demoDeliverable.findMany({ where: { projectId: id }, include: { owners: { include: { user: true } } } });

  const avgScore = evaluations.length ? evaluations.reduce((s, e) => s + (e.score ?? 0), 0) / evaluations.length : 0;

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

  return { project, demos, evaluations: evaluations.slice(0, 10), deliverables, avgScore, dims };
}
