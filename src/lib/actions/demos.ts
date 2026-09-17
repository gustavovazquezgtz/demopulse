"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, canEvaluate } from "@/lib/permissions";
import { createDemoSchema, type CreateDemoInput } from "@/lib/validations/demo";
import { computeEvaluationScore } from "@/lib/scoring";
import { AIInsightService } from "@/lib/ai/services";
import { AITeamSummaryService } from "@/lib/ai/team-org-insights";

export async function createDemo(input: CreateDemoInput) {
  const session = await requireSession();
  const parsed = createDemoSchema.parse(input);

  const date = new Date(parsed.date);
  const [startH, startM] = parsed.startTime.split(":").map(Number);
  const [endH, endM] = parsed.endTime.split(":").map(Number);
  const startTime = new Date(date);
  startTime.setHours(startH, startM, 0, 0);
  const endTime = new Date(date);
  endTime.setHours(endH, endM, 0, 0);

  const demo = await prisma.demo.create({
    data: {
      title: parsed.title,
      description: parsed.description,
      date,
      startTime,
      endTime,
      status: "SCHEDULED",
      hostManagerId: parsed.hostManagerId,
      createdById: session.user.id,
      teams: { create: parsed.teamIds.map((teamId) => ({ teamId })) },
      projects: { create: parsed.projectIds.map((projectId) => ({ projectId })) },
      urls: { create: parsed.urls.map((u) => ({ label: u.label, url: u.url, type: u.type })) },
      invitees: {
        create: [
          { userId: parsed.hostManagerId, role: "EVALUATOR_MANAGER" },
          ...parsed.invitedManagerIds.filter((id) => id !== parsed.hostManagerId).map((id) => ({ userId: id, role: "EVALUATOR_MANAGER" as const })),
          ...parsed.invitedMemberIds.map((id) => ({ userId: id, role: "ATTENDEE_MEMBER" as const })),
        ],
      },
      deliverables: {
        create: parsed.deliverables.map((d) => ({
          title: d.title,
          description: d.description,
          expectedOutcome: d.expectedOutcome,
          projectId: d.projectId,
          owners: { create: d.ownerIds.map((userId) => ({ userId })) },
        })),
      },
    },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, entityType: "Demo", entityId: demo.id, action: "CREATE", after: { title: demo.title } },
  });

  revalidatePath("/demos");
  redirect(`/demos/${demo.id}`);
}

export async function updateDemoStatus(demoId: string, status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED") {
  const session = await requireSession();
  await prisma.demo.update({ where: { id: demoId }, data: { status } });
  await prisma.auditLog.create({
    data: { userId: session.user.id, entityType: "Demo", entityId: demoId, action: "UPDATE", after: { status } },
  });
  revalidatePath(`/demos/${demoId}`);
  revalidatePath("/demos");
}

export async function recordAttendance(demoId: string, records: { userId: string; status: "PRESENT" | "ABSENT" | "EXCUSED" }[]) {
  await requireSession();
  for (const r of records) {
    await prisma.demoAttendee.upsert({
      where: { demoId_userId: { demoId, userId: r.userId } },
      update: { status: r.status },
      create: { demoId, userId: r.userId, status: r.status },
    });
  }
  revalidatePath(`/demos/${demoId}`);
  revalidatePath(`/demos/${demoId}/evaluate`);
}

export interface EvaluationDraft {
  developerId: string;
  answers: { criterionId: string; answer: boolean; comment?: string }[];
  overallComment?: string;
  strengths?: string;
  areasForImprovement?: string;
  complete: boolean;
}

export async function saveEvaluation(demoId: string, draft: EvaluationDraft) {
  const session = await requireSession();
  const evaluatorId = session.user.id;

  const eligibility = await canEvaluate(demoId, evaluatorId, draft.developerId);
  if (!eligibility.ok) {
    throw new Error(eligibility.reason ?? "Not eligible to evaluate this developer for this demo.");
  }

  const demo = await prisma.demo.findUniqueOrThrow({ where: { id: demoId }, include: { teams: true, projects: true } });
  const projectId = await resolveEvaluationProjectId(demo.projects.map((p) => p.projectId), draft.developerId);

  const score = draft.complete
    ? computeEvaluationScore(draft.answers.map((a) => ({ criterionCode: a.criterionId, answer: a.answer, weight: 1 })))
    : null;

  const evaluation = await prisma.evaluation.upsert({
    where: { demoId_developerId_evaluatorId: { demoId, developerId: draft.developerId, evaluatorId } },
    update: {
      status: draft.complete ? "COMPLETED" : "IN_PROGRESS",
      overallComment: draft.overallComment,
      strengths: draft.strengths,
      areasForImprovement: draft.areasForImprovement,
      score,
    },
    create: {
      demoId,
      developerId: draft.developerId,
      evaluatorId,
      projectId,
      status: draft.complete ? "COMPLETED" : "IN_PROGRESS",
      overallComment: draft.overallComment,
      strengths: draft.strengths,
      areasForImprovement: draft.areasForImprovement,
      score,
    },
  });

  for (const a of draft.answers) {
    await prisma.evaluationAnswer.upsert({
      where: { evaluationId_criterionId: { evaluationId: evaluation.id, criterionId: a.criterionId } },
      update: { answer: a.answer, comment: a.comment },
      create: { evaluationId: evaluation.id, criterionId: a.criterionId, answer: a.answer, comment: a.comment },
    });
  }

  if (draft.complete) {
    await AIInsightService.generateForDeveloper(draft.developerId);
    for (const t of demo.teams) await AITeamSummaryService.generateForTeam(t.teamId);
    await AITeamSummaryService.generateForOrganization();
  }

  revalidatePath(`/demos/${demoId}`);
  revalidatePath(`/demos/${demoId}/evaluate`);
  revalidatePath(`/demos/${demoId}/results`);
  revalidatePath(`/people/${draft.developerId}`);

  return { evaluationId: evaluation.id, score };
}

/**
 * A demo can now span multiple projects (one per participating team). An
 * evaluation still belongs to exactly one project (rule #9), so we prefer the
 * developer's primary project assignment when it's among the demo's
 * projects, falling back to the first demo project, and finally to the
 * developer's primary assignment regardless (demo has no linked project).
 */
async function resolveEvaluationProjectId(demoProjectIds: string[], developerId: string): Promise<string> {
  const primaryAssignment = await prisma.projectAssignment.findFirst({
    where: { userId: developerId, isPrimary: true },
  });

  if (primaryAssignment && demoProjectIds.includes(primaryAssignment.projectId)) {
    return primaryAssignment.projectId;
  }
  if (demoProjectIds.length > 0) return demoProjectIds[0];
  if (primaryAssignment) return primaryAssignment.projectId;

  throw new Error("Could not determine a project for this evaluation — the developer has no project assignment and the demo has no linked project.");
}
