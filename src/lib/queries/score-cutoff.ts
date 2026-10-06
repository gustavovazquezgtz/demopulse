import { prisma } from "@/lib/prisma";

/** The frozen, never-recalculated score from right before the evaluation
 * methodology changed. Returns null for anyone who didn't exist (or had
 * no evaluations) at the time the snapshot was generated. */
export async function getScoreCutoff(userId: string) {
  return prisma.engineerScoreCutoff.findUnique({ where: { userId } });
}

export async function getAllScoreCutoffs() {
  const rows = await prisma.engineerScoreCutoff.findMany({ include: { user: true }, orderBy: { legacyScore: "desc" } });
  return rows.map((r) => ({
    userId: r.userId,
    name: r.user.name,
    legacyScore: r.legacyScore,
    evaluationCount: r.evaluationCount,
    cutoffDate: r.cutoffDate,
  }));
}
