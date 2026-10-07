"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/permissions";
import { getGroupThresholds } from "@/lib/queries/app-settings";
import { getEmployeeBankProfile, getEmployeeScores } from "@/lib/queries/employee-bank";
import { suggestGroup } from "@/lib/employee-bank/scoring";
import { OPERATIONS_TEAM_NAME } from "@/lib/employee-bank/labels";

/** Finds the org's single "Operaciones" team, creating it (with whichever
 * manager is performing the first-ever "Dar de alta") if it doesn't exist
 * yet. Deliberately NOT created via the normal createTeam action — this is
 * an internal bucket for people placed on client accounts, not a delivery
 * team with its own matching Project. */
async function getOrCreateOperationsTeam(managerId: string) {
  const existing = await prisma.team.findFirst({ where: { name: OPERATIONS_TEAM_NAME } });
  if (existing) return existing;
  return prisma.team.create({
    data: {
      name: OPERATIONS_TEAM_NAME,
      description: "Engineers placed on client accounts via Employee Bank's \"Dar de alta\" — outside the internal delivery teams.",
      managers: { create: [{ userId: managerId }] },
      managerHistory: { create: [{ managerId }] },
    },
  });
}

/** RPC-style fetch used by the client-side drawer to load full detail
 * on demand (row data in the grid already has the summary). */
export async function fetchEmployeeBankProfile(userId: string) {
  await requireSession();
  return getEmployeeBankProfile(userId);
}

interface BankPatch {
  group?: "A" | "B" | "C" | null;
  groupOverrideNote?: string | null;
  availability?: "AVAILABLE" | "PARTIALLY_ALLOCATED" | "FULLY_ALLOCATED";
  currentSalary?: number | null;
  proposedSalary?: number | null;
  action?: string | null;
  justification?: string | null;
}

/**
 * Single-field (or few-field) inline edit from the grid or the drawer.
 * Enforces the one hard rule from the spec: if the manually-set Group
 * disagrees with the score-based suggested Group, a short explanatory
 * note is required before the save is accepted — never silently allowed,
 * never auto-corrected. The score itself is never part of the patch — it's
 * always read live from the developer's own Evaluation rows.
 */
export async function updateEmployeeBankField(userId: string, patch: BankPatch) {
  const session = await requireSession();
  const existing = await prisma.employeeBankProfile.findUnique({ where: { userId } });
  const thresholds = await getGroupThresholds();

  const nextGroup = "group" in patch ? patch.group : existing?.group ?? null;
  const nextNote = "groupOverrideNote" in patch ? patch.groupOverrideNote : existing?.groupOverrideNote ?? null;

  if (nextGroup) {
    const { score, hasEvaluations } = (await getEmployeeScores([userId])).get(userId)!;
    const suggested = suggestGroup(hasEvaluations ? score : null, thresholds);
    if (suggested && nextGroup !== suggested && !nextNote?.trim()) {
      throw new Error("Manual classification differs from suggested classification — add a short note explaining why.");
    }
  }

  const before = existing
    ? {
        group: existing.group,
        availability: existing.availability,
        action: existing.action,
        currentSalary: existing.currentSalary,
        proposedSalary: existing.proposedSalary,
        justification: existing.justification,
      }
    : undefined;

  const updated = await prisma.employeeBankProfile.upsert({
    where: { userId },
    update: patch,
    create: { userId, ...patch },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "User",
      entityId: userId,
      action: "UPDATE_BANK_PROFILE",
      ...(before ? { before } : {}),
      after: patch as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/employee-bank");
  revalidatePath(`/people/${userId}`);
  return updated;
}

export async function addEmployeeNote(userId: string, type: string, text: string) {
  const session = await requireSession();
  if (!text.trim()) throw new Error("Note text is required.");

  const note = await prisma.employeeNote.create({
    data: { userId, authorId: session.user.id, type, text: text.trim() },
  });

  revalidatePath("/employee-bank");
  revalidatePath(`/people/${userId}`);
  return note;
}

/**
 * "Dar de alta" — marks the person as placed on a real client account.
 * When a project is given, mirrors a real ProjectAssignment the same way
 * addTeamMember does (first active assignment becomes primary) so this
 * shows up consistently in People/Ranking/Team rosters, not just here.
 * Also bumps availability to FULLY_ALLOCATED, and moves them onto the
 * "Operaciones" team — ending their prior internal team memberships the
 * same way removeTeamMember does (closed with leftAt, never deleted) —
 * which is what makes them show up with the green "Operaciones" badge and
 * disappear from their old teams' active rosters.
 */
export async function assignToOperations(userId: string, projectId?: string) {
  const session = await requireSession();
  const now = new Date();

  await prisma.employeeBankProfile.upsert({
    where: { userId },
    update: { assignedToOperations: true, assignedToOperationsAt: now, operationsProjectId: projectId || null, availability: "FULLY_ALLOCATED" },
    create: { userId, assignedToOperations: true, assignedToOperationsAt: now, operationsProjectId: projectId || null, availability: "FULLY_ALLOCATED" },
  });

  if (projectId) {
    const hasOtherActiveAssignment = await prisma.projectAssignment.findFirst({ where: { userId, endDate: null } });
    await prisma.projectAssignment.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: { endDate: null, isPrimary: !hasOtherActiveAssignment },
      create: { projectId, userId, isPrimary: !hasOtherActiveAssignment },
    });
  }

  const opsTeam = await getOrCreateOperationsTeam(session.user.id);
  const currentMemberships = await prisma.teamMember.findMany({ where: { userId, leftAt: null } });
  for (const m of currentMemberships) {
    if (m.teamId !== opsTeam.id) await prisma.teamMember.update({ where: { id: m.id }, data: { leftAt: now } });
  }
  if (!currentMemberships.some((m) => m.teamId === opsTeam.id)) {
    await prisma.teamMember.create({ data: { teamId: opsTeam.id, userId, joinedAt: now } });
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, entityType: "User", entityId: userId, action: "ASSIGNED_TO_OPERATIONS", after: { projectId: projectId || null } },
  });

  revalidatePath("/employee-bank");
  revalidatePath("/people");
  revalidatePath(`/people/${userId}`);
  revalidatePath("/ranking");
}

export async function unassignFromOperations(userId: string) {
  const session = await requireSession();

  await prisma.employeeBankProfile.update({
    where: { userId },
    data: { assignedToOperations: false, assignedToOperationsAt: null, operationsProjectId: null },
  });

  const opsTeam = await prisma.team.findFirst({ where: { name: OPERATIONS_TEAM_NAME } });
  if (opsTeam) {
    await prisma.teamMember.updateMany({ where: { teamId: opsTeam.id, userId, leftAt: null }, data: { leftAt: new Date() } });
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, entityType: "User", entityId: userId, action: "UNASSIGNED_FROM_OPERATIONS" },
  });

  revalidatePath("/employee-bank");
  revalidatePath("/people");
  revalidatePath(`/people/${userId}`);
  revalidatePath("/ranking");
}

/** "Dar de baja" — sets or clears the offboarding/exit status. */
export async function setOffboardingStatus(userId: string, status: "NEGOTIATION_IN_PROGRESS" | "ESCALATED_TO_LEGAL" | "NEGOTIATION_FINISHED") {
  const session = await requireSession();

  await prisma.employeeBankProfile.upsert({
    where: { userId },
    update: { offboardingStatus: status, offboardingSetAt: new Date() },
    create: { userId, offboardingStatus: status, offboardingSetAt: new Date() },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, entityType: "User", entityId: userId, action: "OFFBOARDING_STATUS_CHANGED", after: { status } },
  });

  revalidatePath("/employee-bank");
  revalidatePath(`/people/${userId}`);
}

export async function clearOffboardingStatus(userId: string) {
  const session = await requireSession();

  await prisma.employeeBankProfile.update({ where: { userId }, data: { offboardingStatus: null, offboardingSetAt: null } });

  await prisma.auditLog.create({
    data: { userId: session.user.id, entityType: "User", entityId: userId, action: "OFFBOARDING_STATUS_CLEARED" },
  });

  revalidatePath("/employee-bank");
  revalidatePath(`/people/${userId}`);
}

interface BulkPatch {
  group?: "A" | "B" | "C";
  groupOverrideNote?: string;
  availability?: "AVAILABLE" | "PARTIALLY_ALLOCATED" | "FULLY_ALLOCATED";
  action?: string;
  noteText?: string;
}

/**
 * Bulk edit for Group/Availability/Action/a shared Note across a selection
 * of rows. Deliberately does NOT support bulk prospect creation — the spec
 * requires each opportunity be reviewed independently, so that stays a
 * per-employee action only.
 */
export async function bulkUpdateEmployeeBank(userIds: string[], patch: BulkPatch) {
  const session = await requireSession();
  if (userIds.length === 0) throw new Error("Select at least one employee.");

  if (patch.group) {
    const thresholds = await getGroupThresholds();
    const scores = await getEmployeeScores(userIds);
    const anyDiffers = userIds.some((id) => {
      const { score, hasEvaluations } = scores.get(id)!;
      const suggested = suggestGroup(hasEvaluations ? score : null, thresholds);
      return suggested !== null && suggested !== patch.group;
    });
    if (anyDiffers && !patch.groupOverrideNote?.trim()) {
      throw new Error("One or more selected employees' suggested classification differs from this Group — add a note explaining the override.");
    }
  }

  for (const userId of userIds) {
    const data: Record<string, unknown> = {};
    if (patch.group) {
      data.group = patch.group;
      data.groupOverrideNote = patch.groupOverrideNote ?? null;
    }
    if (patch.availability) data.availability = patch.availability;
    if (patch.action !== undefined) data.action = patch.action;

    if (Object.keys(data).length > 0) {
      await prisma.employeeBankProfile.upsert({ where: { userId }, update: data, create: { userId, ...data } });
      await prisma.auditLog.create({
        data: { userId: session.user.id, entityType: "User", entityId: userId, action: "UPDATE_BANK_PROFILE", after: data as Prisma.InputJsonValue },
      });
    }
    if (patch.noteText?.trim()) {
      await prisma.employeeNote.create({ data: { userId, authorId: session.user.id, type: "STAFFING", text: patch.noteText.trim() } });
    }
  }

  revalidatePath("/employee-bank");
}
