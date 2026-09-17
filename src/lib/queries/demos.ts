import { prisma } from "@/lib/prisma";
import type { Scope } from "./dashboard";
import { computeAgreement, computeConfidence } from "@/lib/scoring";

export async function listDemos(scope: Scope, opts: { status?: string } = {}) {
  return prisma.demo.findMany({
    where: {
      ...(scope.teamIds ? { teams: { some: { teamId: { in: scope.teamIds } } } } : {}),
      ...(opts.status ? { status: opts.status as "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" } : {}),
    },
    include: { projects: { include: { project: true } }, teams: { include: { team: true } }, hostManager: true },
    orderBy: { date: "desc" },
  });
}

export async function getDemoDetail(id: string) {
  const demo = await prisma.demo.findUnique({
    where: { id },
    include: {
      projects: { include: { project: true } },
      teams: { include: { team: true } },
      hostManager: true,
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

  return { demo, invitedManagers, invitedMembers, attendanceByUser, evaluationProgress };
}

export async function getDemoForEvaluation(demoId: string, evaluatorId: string) {
  const demo = await prisma.demo.findUnique({
    where: { id: demoId },
    include: {
      projects: { include: { project: true } },
      teams: { include: { team: true } },
      attendees: { include: { user: true } },
      invitees: true,
    },
  });
  if (!demo) return null;

  const evaluatorInvited = demo.invitees.some((i) => i.userId === evaluatorId && i.role === "EVALUATOR_MANAGER");
  const evaluatorAttended = demo.attendees.some((a) => a.userId === evaluatorId && a.status === "PRESENT");

  const developers = demo.attendees.filter((a) => a.status === "PRESENT" && a.user.role === "DEVELOPER").map((a) => a.user);

  const criteria = await prisma.evaluationCriterion.findMany({ where: { active: true }, orderBy: { order: "asc" } });

  const existing = await prisma.evaluation.findMany({
    where: { demoId, evaluatorId, developerId: { in: developers.map((d) => d.id) } },
    include: { answers: true },
  });
  const existingByDeveloper = new Map(existing.map((e) => [e.developerId, e]));

  return { demo, developers, criteria, existingByDeveloper, canEvaluate: evaluatorInvited && evaluatorAttended };
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
    const avg = scores.reduce((s, n) => s + n, 0) / scores.length;
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

  const teamScore = perDeveloper.length ? perDeveloper.reduce((s, p) => s + p.avgScore, 0) / perDeveloper.length : 0;

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
