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

  // The Team is the only thing the user picks — project comes along for free
  // via the team's existing ProjectTeam link(s), so nobody re-selects work
  // that's already implied by the team.
  const teamProjects = await prisma.projectTeam.findMany({ where: { teamId: parsed.teamId }, select: { projectId: true } });
  const projectIds = teamProjects.map((p) => p.projectId);
  const primaryProjectId = projectIds[0];
  if (parsed.deliverables.length > 0 && !primaryProjectId) {
    throw new Error("This team has no linked project — link one before adding deliverables.");
  }

  const date = new Date(parsed.date);
  const [startH, startM] = parsed.startTime.split(":").map(Number);
  const startTime = new Date(date);
  startTime.setHours(startH, startM, 0, 0);
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1hr default; adjust later on the demo page

  // Whoever starts the session can evaluate immediately, alongside the
  // team's manager and any extra evaluators explicitly added.
  const evaluatorIds = Array.from(new Set([parsed.hostManagerId, session.user.id, ...parsed.additionalManagerIds]));

  const demo = await prisma.demo.create({
    data: {
      title: parsed.title,
      date,
      startTime,
      endTime,
      status: "IN_PROGRESS",
      hostManagerId: parsed.hostManagerId,
      createdById: session.user.id,
      teams: { create: [{ teamId: parsed.teamId }] },
      projects: { create: projectIds.map((projectId) => ({ projectId })) },
      urls: { create: parsed.urls.map((u) => ({ label: u.label, url: u.url, type: u.type })) },
      invitees: {
        create: [
          ...evaluatorIds.map((id) => ({ userId: id, role: "EVALUATOR_MANAGER" as const })),
          ...parsed.engineerIds.map((id) => ({ userId: id, role: "ATTENDEE_MEMBER" as const })),
        ],
      },
      // Selecting an engineer for the session *is* the attendance record —
      // no separate "take attendance" step before evaluating starts.
      attendees: {
        create: [
          ...evaluatorIds.map((id) => ({ userId: id, status: "PRESENT" as const })),
          ...parsed.engineerIds.map((id) => ({ userId: id, status: "PRESENT" as const })),
        ],
      },
      deliverables: {
        create: parsed.deliverables.map((d) => ({
          title: d.title,
          description: d.description,
          expectedOutcome: d.expectedOutcome,
          projectId: primaryProjectId!,
          owners: { create: d.ownerIds.map((userId) => ({ userId })) },
        })),
      },
    },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, entityType: "Demo", entityId: demo.id, action: "CREATE", after: { title: demo.title } },
  });

  revalidatePath("/demos");
  revalidatePath("/calendar");
  redirect(`/demos/${demo.id}/evaluate`);
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

/**
 * Completed never means locked — it means "the manager marked this done at
 * the time." Reopening just flips the status back to IN_PROGRESS (evaluation
 * editing already works regardless of status; canEvaluate never checks it)
 * and stamps reopenedAt so the UI can say clearly that this session was
 * revisited after being completed.
 */
export async function reopenDemo(demoId: string) {
  const session = await requireSession();
  const demo = await prisma.demo.findUniqueOrThrow({ where: { id: demoId } });
  if (demo.status !== "COMPLETED") {
    throw new Error("Only a completed session can be reopened.");
  }

  await prisma.demo.update({ where: { id: demoId }, data: { status: "IN_PROGRESS", reopenedAt: new Date() } });
  await prisma.auditLog.create({
    data: { userId: session.user.id, entityType: "Demo", entityId: demoId, action: "REOPEN", before: { status: "COMPLETED" }, after: { status: "IN_PROGRESS" } },
  });

  revalidatePath(`/demos/${demoId}`);
  revalidatePath(`/demos/${demoId}/evaluate`);
  revalidatePath("/demos");
}

/**
 * Adds or removes engineers from a session after the fact (forgot someone,
 * or added someone by mistake). Adding creates the invite + PRESENT
 * attendance record needed for them to show up in the Evaluation Matrix
 * immediately. Removing is safe by default: if the engineer already has an
 * evaluation recorded for this demo, that evaluation is never deleted —
 * the engineer is marked ABSENT instead (soft removal) so they drop off the
 * active roster without losing evaluation history. Only a participant with
 * zero evaluations for this demo is fully removed.
 */
export async function updateDemoParticipants(demoId: string, engineerIds: string[]) {
  const session = await requireSession();

  const [currentInvitees, currentAttendance, existingEvaluations] = await Promise.all([
    prisma.demoInvitee.findMany({ where: { demoId, role: "ATTENDEE_MEMBER" } }),
    prisma.demoAttendee.findMany({ where: { demoId } }),
    prisma.evaluation.findMany({ where: { demoId }, select: { developerId: true } }),
  ]);

  // "Currently a participant" means actively PRESENT, not merely having an
  // invitee row — a previously soft-removed person (invitee row kept,
  // attendance ABSENT) must be re-addable by checking them again.
  const presentIds = new Set(currentAttendance.filter((a) => a.status === "PRESENT").map((a) => a.userId));
  const invitedIds = new Set(currentInvitees.map((i) => i.userId));
  const currentIds = new Set([...invitedIds].filter((id) => presentIds.has(id)));
  const nextIds = new Set(engineerIds);
  const evaluatedIds = new Set(existingEvaluations.map((e) => e.developerId));

  const toAdd = [...nextIds].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));

  for (const userId of toAdd) {
    await prisma.demoInvitee.upsert({
      where: { demoId_userId_role: { demoId, userId, role: "ATTENDEE_MEMBER" } },
      update: {},
      create: { demoId, userId, role: "ATTENDEE_MEMBER" },
    });
    await prisma.demoAttendee.upsert({
      where: { demoId_userId: { demoId, userId } },
      update: { status: "PRESENT" },
      create: { demoId, userId, status: "PRESENT" },
    });
  }

  const softRemoved: string[] = [];
  const hardRemoved: string[] = [];
  for (const userId of toRemove) {
    if (evaluatedIds.has(userId)) {
      // Preserve the historical evaluation — just take them off the active roster.
      await prisma.demoAttendee.upsert({
        where: { demoId_userId: { demoId, userId } },
        update: { status: "ABSENT" },
        create: { demoId, userId, status: "ABSENT" },
      });
      softRemoved.push(userId);
    } else {
      await prisma.demoAttendee.deleteMany({ where: { demoId, userId } });
      await prisma.demoInvitee.deleteMany({ where: { demoId, userId, role: "ATTENDEE_MEMBER" } });
      hardRemoved.push(userId);
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "Demo",
      entityId: demoId,
      action: "UPDATE_PARTICIPANTS",
      after: { added: toAdd, softRemoved, hardRemoved },
    },
  });

  revalidatePath(`/demos/${demoId}`);
  revalidatePath(`/demos/${demoId}/evaluate`);
  revalidatePath(`/demos/${demoId}/results`);

  return { added: toAdd.length, softRemoved, hardRemoved };
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
