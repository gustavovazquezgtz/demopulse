"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/permissions";
import { requiresOutcomeReason } from "@/lib/employee-bank/scoring";

interface CreateProspectInput {
  employeeId: string;
  client?: string;
  projectId?: string;
  teamId?: string;
  role: string;
  ownerManagerId: string;
  source: string;
  generalNotes?: string;
}

/**
 * Creates a prospect. Never blocked by an existing active prospect on the
 * same employee (section 20 — "visibility and coordination," not a hard
 * gate) — the collision banner and required acknowledgement live entirely
 * in the UI, using the employee's already-fetched active-prospect list, so
 * there's no extra round trip and no server-side block to work around.
 */
export async function createProspect(input: CreateProspectInput) {
  const session = await requireSession();
  const role = input.role.trim();
  if (!role) throw new Error("Role is required.");
  if (!input.ownerManagerId) throw new Error("Prospect Owner is required.");

  const prospect = await prisma.employeeProspect.create({
    data: {
      employeeId: input.employeeId,
      client: input.client?.trim() || undefined,
      projectId: input.projectId || undefined,
      teamId: input.teamId || undefined,
      role,
      ownerManagerId: input.ownerManagerId,
      source: input.source as never,
      generalNotes: input.generalNotes?.trim() || undefined,
    },
  });

  await prisma.prospectActivity.create({
    data: {
      prospectId: prospect.id,
      actorId: session.user.id,
      action: "CREATE",
      after: { role: prospect.role, client: prospect.client ?? null, projectId: prospect.projectId ?? null },
    },
  });

  revalidatePath("/employee-bank");
  revalidatePath(`/people/${input.employeeId}`);
  return prospect;
}

export async function updateProspectStatus(
  prospectId: string,
  status: string,
  opts?: { outcomeReason?: string; outcomeNotes?: string; interviewDate?: string; expectedStartDate?: string }
) {
  const session = await requireSession();
  const prospect = await prisma.employeeProspect.findUniqueOrThrow({ where: { id: prospectId } });

  if (requiresOutcomeReason(status) && !opts?.outcomeReason) {
    throw new Error("An outcome reason is required when a prospect is Rejected, Withdrawn, or Cancelled.");
  }

  const data: Record<string, unknown> = { status };
  if (opts?.outcomeReason) data.outcomeReason = opts.outcomeReason;
  if (opts?.outcomeNotes !== undefined) data.outcomeNotes = opts.outcomeNotes;
  if (opts?.interviewDate) data.interviewDate = new Date(opts.interviewDate);
  if (opts?.expectedStartDate) data.expectedStartDate = new Date(opts.expectedStartDate);

  await prisma.employeeProspect.update({ where: { id: prospectId }, data });

  await prisma.prospectActivity.create({
    data: {
      prospectId,
      actorId: session.user.id,
      action: "STATUS_CHANGE",
      before: { status: prospect.status },
      after: { status, ...(opts?.outcomeReason ? { outcomeReason: opts.outcomeReason } : {}) },
    },
  });
  if (opts?.outcomeNotes?.trim()) {
    await prisma.prospectActivity.create({
      data: { prospectId, actorId: session.user.id, action: "OUTCOME", after: { outcomeNotes: opts.outcomeNotes.trim() } },
    });
  }

  revalidatePath("/employee-bank");
  revalidatePath(`/employee-bank/prospects/${prospectId}`);
  revalidatePath(`/people/${prospect.employeeId}`);
}

/**
 * Records what actually happened at a specific scheduled interview —
 * separate from the prospect's overall status/outcome. Either the person
 * attended (and it went well or badly) or they didn't (and there's a
 * reason why not, e.g. a scheduling conflict vs. declining outright).
 */
export async function updateInterviewOutcome(
  prospectId: string,
  input: { attended: boolean; result?: string; nonAttendanceReason?: string; nonAttendanceNotes?: string }
) {
  const session = await requireSession();

  if (input.attended && !input.result) {
    throw new Error("Select whether the interview went well or badly.");
  }
  if (!input.attended && !input.nonAttendanceReason) {
    throw new Error("Select a reason the person didn't attend.");
  }

  const data = input.attended
    ? {
        interviewAttended: true,
        interviewResult: input.result as never,
        interviewNonAttendanceReason: null,
        interviewNonAttendanceNotes: null,
      }
    : {
        interviewAttended: false,
        interviewResult: null,
        interviewNonAttendanceReason: input.nonAttendanceReason as never,
        interviewNonAttendanceNotes: input.nonAttendanceNotes?.trim() || null,
      };

  await prisma.employeeProspect.update({ where: { id: prospectId }, data });

  await prisma.prospectActivity.create({
    data: {
      prospectId,
      actorId: session.user.id,
      action: "INTERVIEW_OUTCOME",
      after: input.attended
        ? { attended: true, result: input.result }
        : { attended: false, reason: input.nonAttendanceReason, notes: input.nonAttendanceNotes ?? null },
    },
  });

  revalidatePath("/employee-bank");
  revalidatePath(`/employee-bank/prospects/${prospectId}`);
}

export async function addProspectNote(prospectId: string, text: string) {
  const session = await requireSession();
  if (!text.trim()) throw new Error("Note text is required.");

  await prisma.prospectActivity.create({
    data: { prospectId, actorId: session.user.id, action: "NOTE", after: { text: text.trim() } },
  });

  revalidatePath(`/employee-bank/prospects/${prospectId}`);
}

export async function updateProspectFeedback(
  prospectId: string,
  feedback: { technicalFeedback?: string; englishFeedback?: string; clientFeedback?: string }
) {
  const session = await requireSession();
  await prisma.employeeProspect.update({ where: { id: prospectId }, data: feedback });

  await prisma.prospectActivity.create({
    data: { prospectId, actorId: session.user.id, action: "FEEDBACK", after: feedback },
  });

  revalidatePath(`/employee-bank/prospects/${prospectId}`);
}

export async function createSavedView(name: string, filters: unknown) {
  const session = await requireSession();
  if (!name.trim()) throw new Error("A name is required for the saved view.");

  await prisma.employeeBankSavedView.create({
    data: { name: name.trim(), filters: filters as object, createdById: session.user.id },
  });

  revalidatePath("/employee-bank");
}

export async function deleteSavedView(id: string) {
  await requireSession();
  await prisma.employeeBankSavedView.delete({ where: { id } });
  revalidatePath("/employee-bank");
}
