import { prisma } from "@/lib/prisma";
import { averageScore } from "@/lib/scoring";
import { sortRows } from "@/lib/sort";

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
      where: scope.teamIds ? { user: { teamMemberships: { some: { teamId: { in: scope.teamIds } } } } } : {},
      select: { status: true },
    }),
  ]);

  const avgScore = averageScore(evaluations.map((e) => e.score));
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
    totalEvaluations: evaluations.length,
    avgScore,
    attendanceRate,
    evaluationCoverage,
    peopleRequiringAttention,
    topPerformers: recognitions.length,
  };
}

// System evaluation baseline: no real evaluation data exists before this
// month, so the trend must never plot fabricated zero-scores for it.
export const EVALUATION_BASELINE = new Date(2026, 8, 1); // September 2026

export async function getScoreTrendSeries(scope: Scope) {
  const evaluations = await prisma.evaluation.findMany({
    where: {
      status: "COMPLETED",
      demo: { date: { gte: EVALUATION_BASELINE } },
      ...(scope.projectIds ? { projectId: { in: scope.projectIds } } : {}),
    },
    select: { score: true, demo: { select: { date: true } } },
  });

  // Group by calendar month — only months with at least one real evaluation
  // are included, so no month is invented or zero-filled.
  const byMonth = new Map<string, { sum: number; count: number; monthStart: Date }>();
  for (const e of evaluations) {
    const d = e.demo.date;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const entry = byMonth.get(key) ?? { sum: 0, count: 0, monthStart: new Date(d.getFullYear(), d.getMonth(), 1) };
    entry.sum += e.score ?? 0;
    entry.count += 1;
    byMonth.set(key, entry);
  }

  return [...byMonth.values()]
    .sort((a, b) => a.monthStart.getTime() - b.monthStart.getTime())
    .map((m) => ({
      label: m.monthStart.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      score: Math.round(m.sum / m.count),
    }));
}

export async function getTeamComparison(scope: Scope, opts: { sort?: string; dir?: string } = {}) {
  const teams = await prisma.team.findMany({
    where: scope.teamIds ? { id: { in: scope.teamIds } } : {},
    include: { members: true, managers: { include: { user: true } } },
  });
  const results = [];
  for (const team of teams) {
    // Scoped by Evaluation.teamId — a permanent historical snapshot of
    // which team the developer belonged to when evaluated, immune to both
    // multi-team-demo leakage and later team moves.
    const evaluations = await prisma.evaluation.findMany({
      where: { status: "COMPLETED", teamId: team.id },
      include: { answers: { include: { criterion: true } } },
    });
    const base = {
      id: team.id,
      name: team.name, // "Team / Project" — one concept, see section 7/8
      managers: team.managers.map((m) => m.user.name),
      engineerCount: team.members.length,
    };
    if (evaluations.length === 0) {
      results.push({ ...base, score: 0, delivery: 0, ux: 0, ai: 0, business: 0, evaluationCount: 0 });
      continue;
    }
    const avgScore = averageScore(evaluations.map((e) => e.score));
    const dim = (name: string) => {
      const answers = evaluations.flatMap((e) => e.answers.filter((a) => a.criterion.dimension === name));
      return answers.length ? (answers.filter((a) => a.answer).length / answers.length) * 100 : 0;
    };
    results.push({
      ...base,
      score: Math.round(avgScore),
      delivery: Math.round(dim("Delivery")),
      ux: Math.round(dim("UX")),
      ai: Math.round(dim("AI")),
      business: Math.round(dim("Business")),
      evaluationCount: evaluations.length,
    });
  }
  return sortRows(results, opts.sort, opts.dir, "score", "desc");
}

export async function getPendingEvaluations(managerId: string) {
  const invites = await prisma.demoInvitee.findMany({
    where: { userId: managerId, role: "EVALUATOR_MANAGER", demo: { status: { in: ["IN_PROGRESS", "COMPLETED"] } } },
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
