import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Scope } from "./dashboard";
import { getActivityLog } from "./activity";
import { getGroupThresholds } from "./app-settings";
import { suggestGroup, isActiveProspectStatus } from "@/lib/employee-bank/scoring";
import { averageScore, computeTrend, dedupeScoresByDemo, computeConfidence } from "@/lib/scoring";

const employeeInclude = {
  employeeBankProfile: true,
  teamMemberships: { where: { leftAt: null }, include: { team: true } },
  projectAssignments: { where: { endDate: null }, include: { project: true } },
  evaluationsReceived: {
    where: { status: "COMPLETED" as const },
    include: { demo: true },
    orderBy: { demo: { date: "asc" as const } },
  },
  prospects: {
    include: { project: true, team: true, owner: true },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.UserInclude;

type EmployeeWithBankData = Prisma.UserGetPayload<{ include: typeof employeeInclude }>;

function summarize(user: EmployeeWithBankData, thresholds: { aMin: number; bMin: number }) {
  const profile = user.employeeBankProfile;
  const group = (profile?.group as "A" | "B" | "C" | null) ?? null;

  const scores = dedupeScoresByDemo(user.evaluationsReceived.map((e) => ({ demoId: e.demoId, demo: e.demo, score: e.score })));
  const trend = computeTrend(scores.map((s) => s.score));
  const confidence = computeConfidence(user.evaluationsReceived.length, new Set(user.evaluationsReceived.map((e) => e.evaluatorId)).size);

  // Rating is not captured — it IS the live demo evaluation score. No
  // evaluations yet means no rating yet (null), not a score of 0.
  //
  // Flat average over every COMPLETED evaluation, each counted equally —
  // including a 0 from a no-show/non-participation demo. Must match
  // Ranking/Person profile's own "Score" exactly (both use the same
  // averageScore(dedupeScoresByDemo(...)) formula) so Employee Bank never
  // disagrees with those pages for the same person on the same data.
  // trend.trend (direction) is still recency-based and shown separately.
  const hasEvaluations = user.evaluationsReceived.length > 0;
  const score = averageScore(scores.map((s) => s.score));
  const rating = hasEvaluations ? Math.round(score) : null;
  const suggested = suggestGroup(hasEvaluations ? score : null, thresholds);

  const activeProspects = user.prospects.filter((p) => isActiveProspectStatus(p.status));
  const historicalProspects = user.prospects.filter((p) => !isActiveProspectStatus(p.status));

  return {
    id: user.id,
    name: user.name,
    title: user.title,
    active: user.active,
    teams: user.teamMemberships.map((tm) => ({ id: tm.teamId, name: tm.team.name })),
    projects: user.projectAssignments.map((pa) => ({ id: pa.projectId, name: pa.project.name })),
    rating,
    group,
    suggestedGroup: suggested,
    groupDiffers: group !== null && suggested !== null && group !== suggested,
    groupOverrideNote: profile?.groupOverrideNote ?? null,
    availability: profile?.availability ?? "AVAILABLE",
    currentSalary: profile?.currentSalary ?? null,
    proposedSalary: profile?.proposedSalary ?? null,
    action: profile?.action ?? null,
    justification: profile?.justification ?? null,
    score,
    trend: trend.trend,
    trendDelta: trend.delta,
    evaluationCount: user.evaluationsReceived.length,
    confidence,
    activeProspects: activeProspects.map((p) => ({
      id: p.id,
      client: p.client,
      projectName: p.project?.name ?? null,
      teamName: p.team?.name ?? null,
      role: p.role,
      status: p.status,
      ownerName: p.owner.name,
      interviewDate: p.interviewDate,
      createdAt: p.createdAt,
      generalNotes: p.generalNotes,
    })),
    historicalProspectCount: historicalProspects.length,
    acceptedProspectCount: user.prospects.filter((p) => p.status === "ACCEPTED").length,
    rejectedProspectCount: user.prospects.filter((p) => ["REJECTED", "WITHDRAWN", "CANCELLED"].includes(p.status)).length,
  };
}

export async function getEmployeeBankRows(scope: Scope) {
  const [users, thresholds] = await Promise.all([
    prisma.user.findMany({
      where: { role: "DEVELOPER", ...(scope.personIds ? { id: { in: scope.personIds } } : {}) },
      include: employeeInclude,
      orderBy: { name: "asc" },
    }),
    getGroupThresholds(),
  ]);

  // Batched (not N+1) fetch of each employee's single most recent note, for
  // the grid's quick-glance Notes column.
  const notes = await prisma.employeeNote.findMany({
    where: { userId: { in: users.map((u) => u.id) } },
    orderBy: { createdAt: "desc" },
    select: { userId: true, text: true },
  });
  const latestNoteByUser = new Map<string, string>();
  for (const n of notes) if (!latestNoteByUser.has(n.userId)) latestNoteByUser.set(n.userId, n.text);

  return users.map((u) => ({ ...summarize(u, thresholds), latestNote: latestNoteByUser.get(u.id) ?? null }));
}

export async function getEmployeeBankProfile(userId: string) {
  const [user, thresholds, activity, notes, allTeams, allProjects, allManagers] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: employeeInclude }),
    getGroupThresholds(),
    getActivityLog("User", userId),
    prisma.employeeNote.findMany({ where: { userId }, include: { author: true }, orderBy: { createdAt: "desc" } }),
    prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: { in: ["MANAGER", "CEO"] } }, orderBy: { name: "asc" } }),
  ]);
  if (!user) return null;

  return {
    ...summarize(user, thresholds),
    thresholds,
    activity,
    notes: notes.map((n) => ({ id: n.id, type: n.type, text: n.text, authorName: n.author.name, createdAt: n.createdAt })),
    allTeams,
    allProjects,
    allManagers: allManagers.map((m) => ({ id: m.id, name: m.name })),
  };
}

/**
 * Batched score lookup for one or more employees — shared by the actions
 * layer so validating a Group choice against the suggested Group never has
 * to duplicate the averageScore/dedupeScoresByDemo math. Uses the exact
 * same flat-average formula shown as "the" score everywhere else (Ranking,
 * Person profile, this row's own Rating column) so the server-side
 * validation never disagrees with what's on screen.
 */
export async function getEmployeeScores(userIds: string[]): Promise<Map<string, { score: number; hasEvaluations: boolean }>> {
  const evaluations = await prisma.evaluation.findMany({
    where: { developerId: { in: userIds }, status: "COMPLETED" },
    include: { demo: true },
  });
  const byUser = new Map<string, typeof evaluations>();
  for (const e of evaluations) {
    const list = byUser.get(e.developerId) ?? [];
    list.push(e);
    byUser.set(e.developerId, list);
  }
  const result = new Map<string, { score: number; hasEvaluations: boolean }>();
  for (const userId of userIds) {
    const evals = byUser.get(userId) ?? [];
    const scores = dedupeScoresByDemo(evals.map((e) => ({ demoId: e.demoId, demo: e.demo, score: e.score })));
    result.set(userId, { score: averageScore(scores.map((s) => s.score)), hasEvaluations: evals.length > 0 });
  }
  return result;
}

export async function getSavedViews() {
  const views = await prisma.employeeBankSavedView.findMany({ orderBy: { createdAt: "asc" } });
  return views.map((v) => ({ id: v.id, name: v.name, filters: v.filters }));
}

export async function getProspectDetail(id: string) {
  const prospect = await prisma.employeeProspect.findUnique({
    where: { id },
    include: {
      employee: true,
      project: true,
      team: true,
      owner: true,
      activity: { include: { actor: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!prospect) return null;

  return {
    ...prospect,
    activity: prospect.activity.map((a) => ({
      id: a.id,
      action: a.action,
      actorName: a.actor.name,
      before: a.before as Record<string, unknown> | null,
      after: a.after as Record<string, unknown> | null,
      createdAt: a.createdAt,
    })),
  };
}

export async function getProspectAnalytics(scope: Scope) {
  const prospects = await prisma.employeeProspect.findMany({
    where: scope.personIds ? { employeeId: { in: scope.personIds } } : {},
    select: { id: true, employeeId: true, status: true, outcomeReason: true, createdAt: true, updatedAt: true },
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const employeesInBank = new Set(prospects.map((p) => p.employeeId));
  const activeProspects = prospects.filter((p) => isActiveProspectStatus(p.status));
  const employeesProspected = new Set(activeProspects.map((p) => p.employeeId));

  const totalDevelopers = await prisma.user.count({ where: { role: "DEVELOPER" } });

  const funnel = {
    prospected: prospects.length,
    submitted: prospects.filter((p) => !["IDENTIFIED"].includes(p.status)).length,
    interviewed: prospects.filter((p) => ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED", "PENDING_DECISION", "ACCEPTED", "REJECTED"].includes(p.status)).length,
    accepted: prospects.filter((p) => p.status === "ACCEPTED").length,
  };

  const acceptedThisMonth = prospects.filter((p) => p.status === "ACCEPTED" && p.updatedAt >= monthStart).length;
  const rejectedThisMonth = prospects.filter((p) => ["REJECTED", "WITHDRAWN", "CANCELLED"].includes(p.status) && p.updatedAt >= monthStart).length;

  const terminalCount = prospects.filter((p) => ["ACCEPTED", "REJECTED", "WITHDRAWN", "CANCELLED"].includes(p.status)).length;
  const conversionRate = terminalCount > 0 ? (prospects.filter((p) => p.status === "ACCEPTED").length / terminalCount) * 100 : 0;

  const accepted = prospects.filter((p) => p.status === "ACCEPTED");
  const avgDaysToPlacement = accepted.length
    ? accepted.reduce((sum, p) => sum + (p.updatedAt.getTime() - p.createdAt.getTime()) / 86400000, 0) / accepted.length
    : null;

  const failureReasonCounts = new Map<string, number>();
  for (const p of prospects) {
    if (!p.outcomeReason) continue;
    if (!["REJECTED", "WITHDRAWN", "CANCELLED"].includes(p.status)) continue;
    failureReasonCounts.set(p.outcomeReason, (failureReasonCounts.get(p.outcomeReason) ?? 0) + 1);
  }
  const totalFailures = [...failureReasonCounts.values()].reduce((s, n) => s + n, 0);
  const failureReasons = [...failureReasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count, pct: totalFailures ? (count / totalFailures) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);

  return {
    employeesInBank: totalDevelopers,
    employeesProspected: employeesProspected.size,
    employeesWithoutProspects: totalDevelopers - employeesProspected.size,
    interviewsScheduled: prospects.filter((p) => p.status === "INTERVIEW_SCHEDULED").length,
    acceptedThisMonth,
    rejectedThisMonth,
    conversionRate,
    avgDaysToPlacement,
    funnel,
    failureReasons,
    employeesEverProspected: employeesInBank.size,
  };
}
