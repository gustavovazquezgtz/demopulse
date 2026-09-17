import { prisma } from "@/lib/prisma";
import { computeConfidence, computeTrend } from "@/lib/scoring";

export interface Scope {
  teamIds: string[] | null; // null = unscoped (CEO)
  projectIds: string[] | null;
  personIds: string[] | null;
}

export const UNSCOPED: Scope = { teamIds: null, projectIds: null, personIds: null };

export async function buildManagerScope(userId: string): Promise<Scope> {
  const teamRows = await prisma.teamManager.findMany({ where: { userId }, select: { teamId: true } });
  const teamIds = teamRows.map((t) => t.teamId);

  const [directProjects, teamProjects] = await Promise.all([
    prisma.projectManager.findMany({ where: { userId }, select: { projectId: true } }),
    teamIds.length ? prisma.projectTeam.findMany({ where: { teamId: { in: teamIds } }, select: { projectId: true } }) : [],
  ]);
  const projectIds = [...new Set([...directProjects.map((p) => p.projectId), ...teamProjects.map((p) => p.projectId)])];

  const [viaTeams, viaProjects] = await Promise.all([
    teamIds.length ? prisma.teamMember.findMany({ where: { teamId: { in: teamIds } }, select: { userId: true } }) : [],
    projectIds.length
      ? prisma.projectAssignment.findMany({ where: { projectId: { in: projectIds } }, select: { userId: true } })
      : [],
  ]);
  const personIds = [...new Set([...viaTeams.map((p) => p.userId), ...viaProjects.map((p) => p.userId)])];

  return { teamIds, projectIds, personIds };
}

export async function getOrgStats(scope: Scope) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [activePeople, activeProjects, activeTeams, demosThisMonth, evaluations, attendance] = await Promise.all([
    prisma.user.count({
      where: { role: "DEVELOPER", active: true, ...(scope.personIds ? { id: { in: scope.personIds } } : {}) },
    }),
    prisma.project.count({
      where: { status: "ACTIVE", ...(scope.projectIds ? { id: { in: scope.projectIds } } : {}) },
    }),
    prisma.team.count({ where: scope.teamIds ? { id: { in: scope.teamIds } } : {} }),
    prisma.demo.count({
      where: {
        date: { gte: monthStart },
        ...(scope.teamIds ? { teams: { some: { teamId: { in: scope.teamIds } } } } : {}),
      },
    }),
    prisma.evaluation.findMany({
      where: { status: "COMPLETED", ...(scope.projectIds ? { projectId: { in: scope.projectIds } } : {}) },
      select: { score: true, developerId: true },
    }),
    prisma.demoAttendee.findMany({
      where: scope.teamIds ? { demo: { teams: { some: { teamId: { in: scope.teamIds } } } } } : {},
      select: { status: true },
    }),
  ]);

  const avgScore = evaluations.length ? evaluations.reduce((s, e) => s + (e.score ?? 0), 0) / evaluations.length : 0;
  const evaluatedPeople = new Set(evaluations.map((e) => e.developerId)).size;
  const evaluationCoverage = activePeople > 0 ? (evaluatedPeople / activePeople) * 100 : 0;
  const attendanceRate = attendance.length
    ? (attendance.filter((a) => a.status === "PRESENT").length / attendance.length) * 100
    : 0;

  const alerts = await prisma.aiAlert.findMany({
    where: {
      status: "ACTIVE",
      subjectType: "PERSON",
      severity: { in: ["MEDIUM", "HIGH"] },
      ...(scope.personIds ? { subjectId: { in: scope.personIds } } : {}),
    },
    select: { subjectId: true },
  });
  const peopleRequiringAttention = new Set(alerts.map((a) => a.subjectId)).size;

  const recognitions = await prisma.recognition.findMany({
    where: scope.personIds ? { developerId: { in: scope.personIds } } : {},
    select: { developerId: true },
    distinct: ["developerId"],
  });

  return {
    activePeople,
    activeProjects,
    activeTeams,
    demosThisMonth,
    avgScore,
    attendanceRate,
    evaluationCoverage,
    peopleRequiringAttention,
    topPerformers: recognitions.length,
  };
}

export async function getScoreTrendSeries(scope: Scope, months = 6) {
  const now = new Date();
  const series: { label: string; score: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const evaluations = await prisma.evaluation.findMany({
      where: {
        status: "COMPLETED",
        demo: { date: { gte: start, lt: end } },
        ...(scope.projectIds ? { projectId: { in: scope.projectIds } } : {}),
      },
      select: { score: true },
    });
    const avg = evaluations.length ? evaluations.reduce((s, e) => s + (e.score ?? 0), 0) / evaluations.length : 0;
    series.push({ label: start.toLocaleDateString("en-US", { month: "short" }), score: Math.round(avg) });
  }
  return series;
}

export async function getTeamComparison(scope: Scope) {
  const teams = await prisma.team.findMany({ where: scope.teamIds ? { id: { in: scope.teamIds } } : {} });
  const results = [];
  for (const team of teams) {
    const evaluations = await prisma.evaluation.findMany({
      where: { status: "COMPLETED", demo: { teams: { some: { teamId: team.id } } } },
      include: { answers: { include: { criterion: true } } },
    });
    if (evaluations.length === 0) {
      results.push({ id: team.id, name: team.name, score: 0, delivery: 0, ux: 0, ai: 0, business: 0, evaluationCount: 0 });
      continue;
    }
    const avgScore = evaluations.reduce((s, e) => s + (e.score ?? 0), 0) / evaluations.length;
    const dim = (name: string) => {
      const answers = evaluations.flatMap((e) => e.answers.filter((a) => a.criterion.dimension === name));
      return answers.length ? (answers.filter((a) => a.answer).length / answers.length) * 100 : 0;
    };
    results.push({
      id: team.id,
      name: team.name,
      score: Math.round(avgScore),
      delivery: Math.round(dim("Delivery")),
      ux: Math.round(dim("UX")),
      ai: Math.round(dim("AI")),
      business: Math.round(dim("Business")),
      evaluationCount: evaluations.length,
    });
  }
  return results.sort((a, b) => b.score - a.score);
}

export async function getTopPerformers(scope: Scope, limit = 5) {
  const people = await prisma.user.findMany({
    where: { role: "DEVELOPER", ...(scope.personIds ? { id: { in: scope.personIds } } : {}) },
    include: { evaluationsReceived: { where: { status: "COMPLETED" }, select: { score: true } } },
  });

  const withScores = people
    .filter((p) => p.evaluationsReceived.length > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      title: p.title,
      avgScore: p.evaluationsReceived.reduce((s, e) => s + (e.score ?? 0), 0) / p.evaluationsReceived.length,
      evaluationCount: p.evaluationsReceived.length,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, limit);

  return withScores.map((p) => ({ ...p, confidence: computeConfidence(p.evaluationCount, 1) }));
}

export async function getNeedsAttention(scope: Scope, limit = 5) {
  const alerts = await prisma.aiAlert.findMany({
    where: {
      status: "ACTIVE",
      subjectType: "PERSON",
      severity: { in: ["MEDIUM", "HIGH"] },
      ...(scope.personIds ? { subjectId: { in: scope.personIds } } : {}),
    },
    orderBy: { severity: "desc" },
  });

  const bySubject = new Map<string, typeof alerts>();
  for (const a of alerts) {
    const list = bySubject.get(a.subjectId) ?? [];
    list.push(a);
    bySubject.set(a.subjectId, list);
  }

  const people = await prisma.user.findMany({ where: { id: { in: [...bySubject.keys()] } } });
  const results = people.map((p) => {
    const personAlerts = bySubject.get(p.id) ?? [];
    const highest = personAlerts.some((a) => a.severity === "HIGH") ? "HIGH" : "MEDIUM";
    return { id: p.id, name: p.name, title: p.title, severity: highest, alertCount: personAlerts.length, topAlert: personAlerts[0] };
  });

  return results
    .sort((a, b) => (a.severity === b.severity ? b.alertCount - a.alertCount : a.severity === "HIGH" ? -1 : 1))
    .slice(0, limit);
}

export async function getExecutiveSummary(teamId?: string) {
  const insight = await prisma.aiInsight.findFirst({
    where: teamId ? { subjectType: "TEAM", subjectId: teamId } : { subjectType: "ORGANIZATION" },
    orderBy: { createdAt: "desc" },
  });
  return insight;
}

export async function getUpcomingDemos(scope: Scope, limit = 5) {
  return prisma.demo.findMany({
    where: {
      status: "SCHEDULED",
      date: { gte: new Date() },
      ...(scope.teamIds ? { teams: { some: { teamId: { in: scope.teamIds } } } } : {}),
    },
    include: { projects: { include: { project: true } }, teams: { include: { team: true } }, hostManager: true },
    orderBy: { date: "asc" },
    take: limit,
  });
}

export async function getPendingEvaluations(managerId: string) {
  const invites = await prisma.demoInvitee.findMany({
    where: { userId: managerId, role: "EVALUATOR_MANAGER", demo: { status: "COMPLETED" } },
    include: {
      demo: { include: { projects: { include: { project: true } }, teams: { include: { team: true } } } },
    },
  });

  const results: { demoId: string; demoTitle: string; projectName: string; date: Date; pendingCount: number; totalAttendees: number }[] = [];
  for (const inv of invites) {
    const attendees = await prisma.demoAttendee.findMany({ where: { demoId: inv.demoId, status: "PRESENT" }, include: { user: true } });
    const developerAttendees = attendees.filter((a) => a.user.role === "DEVELOPER");
    const doneEvaluations = await prisma.evaluation.findMany({
      where: { demoId: inv.demoId, evaluatorId: managerId, status: "COMPLETED" },
      select: { developerId: true },
    });
    const doneSet = new Set(doneEvaluations.map((e) => e.developerId));
    const pending = developerAttendees.filter((a) => !doneSet.has(a.userId));
    if (pending.length > 0) {
      results.push({
        demoId: inv.demoId,
        demoTitle: inv.demo.title,
        projectName: inv.demo.projects.map((p) => p.project.name).join(", ") || "—",
        date: inv.demo.date,
        pendingCount: pending.length,
        totalAttendees: developerAttendees.length,
      });
    }
  }
  return results.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export { computeTrend };
