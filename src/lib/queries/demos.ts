import { prisma } from "@/lib/prisma";
import type { Scope } from "./dashboard";
import { averageScore, computeAgreement, computeConfidence } from "@/lib/scoring";
import { sortRows } from "@/lib/sort";

export async function listDemos(scope: Scope, opts: { status?: string; sort?: string; dir?: string } = {}) {
  const demos = await prisma.demo.findMany({
    where: {
      ...(scope.teamIds ? { teams: { some: { teamId: { in: scope.teamIds } } } } : {}),
      ...(opts.status ? { status: opts.status as "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" } : {}),
    },
    include: { teams: { include: { team: true } }, hostManager: true, invitees: true },
  });

  const rows = demos.map((d) => ({
    ...d,
    teamNames: d.teams.map((t) => t.team.name).join(", "), // "Team / Project" — one concept, see section 7
    teamCount: d.teams.length,
    participantCount: d.invitees.filter((i) => i.role === "ATTENDEE_MEMBER").length,
    hostManagerName: d.hostManager.name,
  }));

  return sortRows(rows, opts.sort, opts.dir, "date", "desc");
}

export async function getDemoDetail(id: string) {
  const demo = await prisma.demo.findUnique({
    where: { id },
    include: {
      projects: { include: { project: true } },
      teams: { include: { team: { include: { members: { include: { user: true } } } } } },
      hostManager: true,
      startedBy: true,
      urls: true,
      invitees: { include: { user: true } },
      attendees: { include: { user: true } },
      deliverables: { include: { owners: { include: { user: true } } } },
      evaluations: { include: { developer: true, evaluator: true } },
    },
  });
  if (!demo) return null;

  const invitedManagers = demo.invitees.filter((i) => i.role === "EVALUATOR_MANAGER");
  const invitedMembers = demo.invitees.filter((i) => i.role === "ATTENDEE_MEMBER");
  const attendanceByUser = new Map(demo.attendees.map((a) => [a.userId, a.status]));

  const evaluationProgress = invitedMembers.map((m) => {
    const attended = attendanceByUser.get(m.userId) === "PRESENT";
    const evaluatorsPresent = invitedManagers.filter((im) => attendanceByUser.get(im.userId) === "PRESENT");
    const completedBy = demo.evaluations.filter((e) => e.developerId === m.userId && e.status === "COMPLETED");
    return {
      userId: m.userId,
      name: m.user.name,
      attended,
      expectedEvaluations: attended ? evaluatorsPresent.length : 0,
      completedEvaluations: completedBy.length,
    };
  });

  // Everyone on the demo's team(s) — participant editing offers this whole
  // roster, not just whoever was invited when the session was created.
  const teamRoster = [...new Map(demo.teams.flatMap((t) => t.team.members.map((m) => [m.userId, m.user]))).values()];
  const evaluatedDeveloperIds = new Set(demo.evaluations.map((e) => e.developerId));

  // Every team in the org — lets a Scheduled session's team list be edited
  // (add/remove) without a separate page.
  const allTeams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { managers: { include: { user: true } }, members: { include: { user: true } } },
  });

  // Every manager in the org — evaluations aren't limited to a developer's
  // own team, so any manager can be invited as an evaluator, not just
  // whoever's on the demo's team(s).
  const allManagers = await prisma.user.findMany({ where: { role: { in: ["MANAGER", "CEO"] } }, orderBy: { name: "asc" } });

  return { demo, invitedManagers, invitedMembers, attendanceByUser, evaluationProgress, teamRoster, evaluatedDeveloperIds, allTeams, allManagers };
}

export async function getDemoForEvaluation(demoId: string, evaluatorId: string) {
  const demo = await prisma.demo.findUnique({
    where: { id: demoId },
    include: {
      projects: { include: { project: true } },
      teams: { include: { team: { include: { members: true } } } },
      attendees: { include: { user: true } },
      invitees: true,
    },
  });
  if (!demo) return null;

  const evaluatorInvited = demo.invitees.some((i) => i.userId === evaluatorId && i.role === "EVALUATOR_MANAGER");
  const evaluatorAttended = demo.attendees.some((a) => a.userId === evaluatorId && a.status === "PRESENT");

  const developers = demo.attendees.filter((a) => a.status === "PRESENT" && a.user.role === "DEVELOPER").map((a) => a.user);

  // Which of this demo's teams each developer belongs to — drives the
  // Evaluation Matrix's team filter and the "Team / Project" column.
  const teamByDeveloper = new Map<string, { id: string; name: string }[]>();
  for (const dt of demo.teams) {
    for (const m of dt.team.members) {
      const list = teamByDeveloper.get(m.userId) ?? [];
      list.push({ id: dt.team.id, name: dt.team.name });
      teamByDeveloper.set(m.userId, list);
    }
  }

  const criteria = await prisma.evaluationCriterion.findMany({ where: { active: true }, orderBy: { order: "asc" } });

  const existing = await prisma.evaluation.findMany({
    where: { demoId, evaluatorId, developerId: { in: developers.map((d) => d.id) } },
    include: { answers: true },
  });
  const existingByDeveloper = new Map(existing.map((e) => [e.developerId, e]));

  return {
    demo,
    developers,
    teams: demo.teams.map((t) => ({ id: t.team.id, name: t.team.name })),
    teamByDeveloper,
    criteria,
    existingByDeveloper,
    canEvaluate: evaluatorInvited && evaluatorAttended,
  };
}

export async function getDemoResults(demoId: string) {
  const demo = await prisma.demo.findUnique({
    where: { id: demoId },
    include: { projects: { include: { project: true } }, teams: { include: { team: true } } },
  });
  if (!demo) return null;

  const evaluations = await prisma.evaluation.findMany({
    where: { demoId, status: "COMPLETED" },
    include: { developer: true, evaluator: true, answers: { include: { criterion: true } } },
  });

  const byDeveloper = new Map<string, typeof evaluations>();
  for (const e of evaluations) {
    const list = byDeveloper.get(e.developerId) ?? [];
    list.push(e);
    byDeveloper.set(e.developerId, list);
  }

  const perDeveloper = [...byDeveloper.entries()].map(([developerId, evals]) => {
    const scores = evals.map((e) => e.score ?? 0);
    const avg = averageScore(scores);
    const agreement = computeAgreement(scores);
    return {
      developerId,
      name: evals[0].developer.name,
      avgScore: avg,
      evaluatorCount: evals.length,
      evaluators: evals.map((e) => ({ name: e.evaluator.name, score: e.score ?? 0, comment: e.overallComment })),
      agreement: agreement.agreement,
      confidence: computeConfidence(evals.length, evals.length),
    };
  });

  perDeveloper.sort((a, b) => b.avgScore - a.avgScore);

  const teamScore = averageScore(perDeveloper.map((p) => p.avgScore));

  const attendance = await prisma.demoAttendee.findMany({ where: { demoId } });
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

  const insights = await prisma.aiInsight.findMany({
    where: { subjectType: "PERSON", subjectId: { in: perDeveloper.map((p) => p.developerId) }, type: { in: ["RISK", "RECOGNITION"] } },
  });

  return { demo, perDeveloper, teamScore, attendanceRate, dims, insights };
}
