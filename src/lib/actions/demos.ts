"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, canEvaluate, isCeo } from "@/lib/permissions";
import { createDemoSchema, type CreateDemoInput } from "@/lib/validations/demo";
import { computeEvaluationScore } from "@/lib/scoring";
import { AIInsightService } from "@/lib/ai/services";
import { AITeamSummaryService } from "@/lib/ai/team-org-insights";

/**
 * Schedules a demo session. This ONLY schedules it — status is always
 * SCHEDULED, nobody is marked as attending yet, and the evaluate flow is
 * not reachable until an invited manager explicitly calls startDemo().
 * Scheduling and starting are deliberately separate actions (section 31).
 */
export async function createDemo(input: CreateDemoInput) {
  const session = await requireSession();
  const parsed = createDemoSchema.parse(input);

  // Teams are the only thing the user picks — projects come along for free
  // via each team's existing ProjectTeam link(s), so nobody re-selects work
  // that's already implied by the team(s).
  const teamProjects = await prisma.projectTeam.findMany({ where: { teamId: { in: parsed.teamIds } }, select: { projectId: true } });
  const projectIds = [...new Set(teamProjects.map((p) => p.projectId))];
  const primaryProjectId = projectIds[0];
  if (parsed.deliverables.length > 0 && !primaryProjectId) {
    throw new Error("These teams have no linked project — link one before adding deliverables.");
  }

  const date = new Date(parsed.date);
  const [startH, startM] = parsed.startTime.split(":").map(Number);
  const startTime = new Date(date);
  startTime.setHours(startH, startM, 0, 0);
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1hr default; adjust later on the demo page

  const managerIds = Array.from(new Set([parsed.hostManagerId, ...parsed.invitedManagerIds]));

  const demo = await prisma.demo.create({
    data: {
      title: parsed.title,
      date,
      startTime,
      endTime,
      status: "SCHEDULED",
      hostManagerId: parsed.hostManagerId,
      createdById: session.user.id,
      teams: { create: parsed.teamIds.map((teamId) => ({ teamId })) },
      projects: { create: projectIds.map((projectId) => ({ projectId })) },
      urls: { create: parsed.urls.map((u) => ({ label: u.label, url: u.url, type: u.type })) },
      invitees: {
        create: [
          ...managerIds.map((id) => ({ userId: id, role: "EVALUATOR_MANAGER" as const })),
          ...parsed.engineerIds.map((id) => ({ userId: id, role: "ATTENDEE_MEMBER" as const })),
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
    data: { userId: session.user.id, entityType: "Demo", entityId: demo.id, action: "CREATE", after: { title: demo.title, status: "SCHEDULED" } },
  });

  revalidatePath("/demos");
  revalidatePath("/calendar");
  redirect(`/demos/${demo.id}`);
}

/**
 * The moment the actual call starts. Only an invited manager (or CEO) may
 * do this — anyone else with the link cannot flip a session live. Marks
 * every invited manager and engineer PRESENT (the default assumption for
 * "the call started with everyone invited"; attendance can still be
 * corrected afterward), and stamps who/when so it's auditable.
 */
export async function startDemo(demoId: string) {
  const session = await requireSession();
  const demo = await prisma.demo.findUniqueOrThrow({ where: { id: demoId }, include: { invitees: true } });

  if (demo.status !== "SCHEDULED") {
    throw new Error("Only a scheduled session can be started.");
  }

  const ceo = isCeo(session);
  const isInvitedManager = demo.invitees.some((i) => i.userId === session.user.id && i.role === "EVALUATOR_MANAGER");
  if (!ceo && !isInvitedManager) {
    throw new Error("Only an invited manager can start this session.");
  }

  await prisma.demo.update({
    where: { id: demoId },
    data: { status: "IN_PROGRESS", startedById: session.user.id, startedAt: new Date() },
  });

  await prisma.demoAttendee.createMany({
    data: demo.invitees.map((i) => ({ demoId, userId: i.userId, status: "PRESENT" as const })),
    skipDuplicates: true,
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, entityType: "Demo", entityId: demoId, action: "START", before: { status: "SCHEDULED" }, after: { status: "IN_PROGRESS" } },
  });

  revalidatePath(`/demos/${demoId}`);
  revalidatePath(`/demos/${demoId}/evaluate`);
  revalidatePath("/demos");
  revalidatePath("/calendar");
  redirect(`/demos/${demoId}/evaluate`);
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

/** Edits the name/date/time of a Scheduled demo (section 19). */
export async function rescheduleDemo(demoId: string, input: { title: string; date: string; startTime: string }) {
  const session = await requireSession();
  const demo = await prisma.demo.findUniqueOrThrow({ where: { id: demoId } });
  if (demo.status !== "SCHEDULED") {
    throw new Error("Only a Scheduled session's date, time, and name can be edited here.");
  }
  if (input.title.trim().length < 3) {
    throw new Error("Session name is required.");
  }

  const date = new Date(input.date);
  const [h, m] = input.startTime.split(":").map(Number);
  const startTime = new Date(date);
  startTime.setHours(h, m, 0, 0);
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

  await prisma.demo.update({ where: { id: demoId }, data: { title: input.title, date, startTime, endTime } });
  await prisma.auditLog.create({
    data: { userId: session.user.id, entityType: "Demo", entityId: demoId, action: "RESCHEDULE", after: input },
  });

  revalidatePath(`/demos/${demoId}`);
  revalidatePath("/demos");
  revalidatePath("/calendar");
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

  // Whoever reopens a session can evaluate immediately, even if they weren't
  // on the original invite list — that's usually exactly why they're
  // reopening it (a missed evaluation). Same principle already used when a
  // session is first created (createDemo).
  await prisma.demoInvitee.upsert({
    where: { demoId_userId_role: { demoId, userId: session.user.id, role: "EVALUATOR_MANAGER" } },
    update: {},
    create: { demoId, userId: session.user.id, role: "EVALUATOR_MANAGER" },
  });
  await prisma.demoAttendee.upsert({
    where: { demoId_userId: { demoId, userId: session.user.id } },
    update: { status: "PRESENT" },
    create: { demoId, userId: session.user.id, status: "PRESENT" },
  });

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
/**
 * Adds/removes teams on a Scheduled demo (section 19). Adding a team
 * auto-invites its manager(s) and members, same rule as creation. Removing
 * one drops the link and any invitee who isn't needed by a remaining
 * selected team — unless they already have an evaluation for this demo, in
 * which case they're left alone (never destroy history). Only meaningful
 * before the session starts; teams are locked once it's live.
 */
/**
 * Invites or removes managers as evaluators on any demo, at any stage —
 * evaluations aren't limited to a developer's own team manager (any manager
 * can evaluate any developer), so the invite list must stay editable after
 * creation too, not just during scheduling. Adding a manager to an
 * already-live session also marks them PRESENT so they can evaluate right
 * away, same principle as reopenDemo/startDemo.
 */
export async function updateDemoManagers(demoId: string, managerIds: string[]) {
  const session = await requireSession();
  const demo = await prisma.demo.findUniqueOrThrow({ where: { id: demoId } });

  const current = await prisma.demoInvitee.findMany({ where: { demoId, role: "EVALUATOR_MANAGER" } });
  const currentIds = new Set(current.map((i) => i.userId));
  const nextIds = new Set(managerIds.length ? managerIds : [demo.hostManagerId]);
  nextIds.add(demo.hostManagerId); // the host manager is always an invited evaluator

  const toAdd = [...nextIds].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));

  for (const userId of toAdd) {
    await prisma.demoInvitee.upsert({
      where: { demoId_userId_role: { demoId, userId, role: "EVALUATOR_MANAGER" } },
      update: {},
      create: { demoId, userId, role: "EVALUATOR_MANAGER" },
    });
    if (demo.status !== "SCHEDULED") {
      await prisma.demoAttendee.upsert({
        where: { demoId_userId: { demoId, userId } },
        update: { status: "PRESENT" },
        create: { demoId, userId, status: "PRESENT" },
      });
    }
  }
  for (const userId of toRemove) {
    if (userId === demo.hostManagerId) continue; // never remove the host manager this way
    await prisma.demoInvitee.deleteMany({ where: { demoId, userId, role: "EVALUATOR_MANAGER" } });
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, entityType: "Demo", entityId: demoId, action: "UPDATE_MANAGERS", after: { added: toAdd, removed: toRemove } },
  });

  revalidatePath(`/demos/${demoId}`);
  revalidatePath(`/demos/${demoId}/evaluate`);
  revalidatePath("/demos");

  return { added: toAdd.length, removed: toRemove.length };
}

export async function updateDemoTeams(demoId: string, teamIds: string[]) {
  const session = await requireSession();
  const demo = await prisma.demo.findUniqueOrThrow({ where: { id: demoId }, include: { teams: true } });
  if (demo.status !== "SCHEDULED") {
    throw new Error("Teams can only be changed while the session is still Scheduled.");
  }
  if (teamIds.length === 0) {
    throw new Error("A demo session needs at least one team.");
  }

  const currentTeamIds = new Set(demo.teams.map((t) => t.teamId));
  const nextTeamIds = new Set(teamIds);
  const toAdd = teamIds.filter((id) => !currentTeamIds.has(id));
  const toRemove = [...currentTeamIds].filter((id) => !nextTeamIds.has(id));
  if (toAdd.length === 0 && toRemove.length === 0) return { added: 0, removed: 0 };

  const allRelevantTeamIds = [...new Set([...currentTeamIds, ...teamIds])];
  const teams = await prisma.team.findMany({
    where: { id: { in: allRelevantTeamIds } },
    include: { managers: true, members: true },
  });
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const evaluatedIds = new Set((await prisma.evaluation.findMany({ where: { demoId }, select: { developerId: true } })).map((e) => e.developerId));

  for (const teamId of toAdd) {
    await prisma.demoTeam.create({ data: { demoId, teamId } });
    const team = teamById.get(teamId);
    if (!team) continue;

    for (const m of team.managers) {
      await prisma.demoInvitee.upsert({
        where: { demoId_userId_role: { demoId, userId: m.userId, role: "EVALUATOR_MANAGER" } },
        update: {},
        create: { demoId, userId: m.userId, role: "EVALUATOR_MANAGER" },
      });
    }
    for (const mem of team.members) {
      await prisma.demoInvitee.upsert({
        where: { demoId_userId_role: { demoId, userId: mem.userId, role: "ATTENDEE_MEMBER" } },
        update: {},
        create: { demoId, userId: mem.userId, role: "ATTENDEE_MEMBER" },
      });
    }
    const projectLinks = await prisma.projectTeam.findMany({ where: { teamId } });
    for (const pl of projectLinks) {
      await prisma.demoProject.upsert({
        where: { demoId_projectId: { demoId, projectId: pl.projectId } },
        update: {},
        create: { demoId, projectId: pl.projectId },
      });
    }
  }

  for (const teamId of toRemove) {
    await prisma.demoTeam.deleteMany({ where: { demoId, teamId } });
    const team = teamById.get(teamId);
    if (!team) continue;

    const remainingTeams = teams.filter((t) => nextTeamIds.has(t.id));
    const stillNeededManagers = new Set(remainingTeams.flatMap((t) => t.managers.map((m) => m.userId)));
    const stillNeededMembers = new Set(remainingTeams.flatMap((t) => t.members.map((m) => m.userId)));

    for (const m of team.managers) {
      if (!stillNeededManagers.has(m.userId)) {
        await prisma.demoInvitee.deleteMany({ where: { demoId, userId: m.userId, role: "EVALUATOR_MANAGER" } });
      }
    }
    for (const mem of team.members) {
      if (!stillNeededMembers.has(mem.userId) && !evaluatedIds.has(mem.userId)) {
        await prisma.demoInvitee.deleteMany({ where: { demoId, userId: mem.userId, role: "ATTENDEE_MEMBER" } });
        await prisma.demoAttendee.deleteMany({ where: { demoId, userId: mem.userId } });
      }
    }
    const teamProjectLinks = await prisma.projectTeam.findMany({ where: { teamId } });
    for (const pl of teamProjectLinks) {
      const stillUsed = await prisma.projectTeam.findFirst({ where: { projectId: pl.projectId, teamId: { in: [...nextTeamIds] } } });
      if (!stillUsed) {
        await prisma.demoProject.deleteMany({ where: { demoId, projectId: pl.projectId } });
      }
    }
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, entityType: "Demo", entityId: demoId, action: "UPDATE_TEAMS", after: { added: toAdd, removed: toRemove } },
  });

  revalidatePath(`/demos/${demoId}`);
  revalidatePath("/demos");
  revalidatePath("/calendar");

  return { added: toAdd.length, removed: toRemove.length };
}

export async function updateDemoParticipants(demoId: string, engineerIds: string[]) {
  const session = await requireSession();

  const [demo, currentInvitees, currentAttendance, existingEvaluations] = await Promise.all([
    prisma.demo.findUniqueOrThrow({ where: { id: demoId }, select: { status: true } }),
    prisma.demoInvitee.findMany({ where: { demoId, role: "ATTENDEE_MEMBER" } }),
    prisma.demoAttendee.findMany({ where: { demoId } }),
    prisma.evaluation.findMany({ where: { demoId }, select: { developerId: true } }),
  ]);

  const nextIds = new Set(engineerIds);
  const evaluatedIds = new Set(existingEvaluations.map((e) => e.developerId));
  const invitedIds = new Set(currentInvitees.map((i) => i.userId));

  // A Scheduled session has no attendance yet — "participant" there just
  // means invited. Once the call has actually happened (In Progress /
  // Completed), "currently a participant" means actively PRESENT, so a
  // previously soft-removed person (invitee row kept, attendance ABSENT)
  // can be re-added by checking them again.
  const presentIds = new Set(currentAttendance.filter((a) => a.status === "PRESENT").map((a) => a.userId));
  const currentIds = demo.status === "SCHEDULED" ? invitedIds : new Set([...invitedIds].filter((id) => presentIds.has(id)));

  const toAdd = [...nextIds].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));

  for (const userId of toAdd) {
    await prisma.demoInvitee.upsert({
      where: { demoId_userId_role: { demoId, userId, role: "ATTENDEE_MEMBER" } },
      update: {},
      create: { demoId, userId, role: "ATTENDEE_MEMBER" },
    });
    // Only mark attendance once the session is actually happening — a
    // Scheduled demo just gets an invite, not a premature PRESENT record.
    if (demo.status !== "SCHEDULED") {
      await prisma.demoAttendee.upsert({
        where: { demoId_userId: { demoId, userId } },
        update: { status: "PRESENT" },
        create: { demoId, userId, status: "PRESENT" },
      });
    }
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

  const existing = await prisma.evaluation.findUnique({
    where: { demoId_developerId_evaluatorId: { demoId, developerId: draft.developerId, evaluatorId } },
    select: { status: true },
  });

  // Once an evaluation has been completed, editing one answer must not
  // silently blank its score and drop it out of every dashboard/ranking
  // until the manager re-clicks "Complete" — that's exactly the flow a
  // reopened demo needs to support. Autosave on a genuinely new/unfinished
  // evaluation still waits for the explicit "complete" action, unchanged.
  const wasCompleted = existing?.status === "COMPLETED";
  const finalize = draft.complete || wasCompleted;

  const score = finalize
    ? computeEvaluationScore(draft.answers.map((a) => ({ criterionCode: a.criterionId, answer: a.answer, weight: 1 })))
    : null;

  const evaluation = await prisma.evaluation.upsert({
    where: { demoId_developerId_evaluatorId: { demoId, developerId: draft.developerId, evaluatorId } },
    update: {
      status: finalize ? "COMPLETED" : "IN_PROGRESS",
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
      status: finalize ? "COMPLETED" : "IN_PROGRESS",
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
