"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/permissions";
import { setMethodologyCutoffDate } from "@/lib/evaluation-methodology";

/**
 * Updates a criterion's weight. Never recomputes any existing
 * Evaluation.score — every past evaluation's score was already computed
 * and cached with whatever weight was in effect when it was saved, so
 * this only ever changes how FUTURE evaluations get scored.
 */
export async function updateCriterionWeight(criterionId: string, weight: number) {
  const session = await requireSession();
  if (weight < 0 || weight > 10) throw new Error("Weight must be between 0 and 10.");

  const before = await prisma.evaluationCriterion.findUniqueOrThrow({ where: { id: criterionId } });
  await prisma.evaluationCriterion.update({ where: { id: criterionId }, data: { weight } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "EvaluationCriterion",
      entityId: criterionId,
      action: "UPDATE_WEIGHT",
      before: { weight: before.weight },
      after: { weight },
    },
  });

  revalidatePath("/settings");
}

export async function updateMethodologyCutoff(date: string) {
  await requireSession();
  if (!date) throw new Error("A cutoff date is required.");
  await setMethodologyCutoffDate(date);
  revalidatePath("/settings");
}
