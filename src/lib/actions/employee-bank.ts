"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/permissions";
import { getGroupThresholds } from "@/lib/queries/app-settings";
import { getEmployeeBankProfile, getEmployeeScores } from "@/lib/queries/employee-bank";
import { suggestGroup } from "@/lib/employee-bank/scoring";

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
