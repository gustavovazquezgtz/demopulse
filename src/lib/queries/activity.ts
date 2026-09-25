import { prisma } from "@/lib/prisma";

/**
 * Recent AuditLog entries for one entity (a Team or a User/person) — surfaces
 * "what changed and who changed it" for team/manager/project reassignments,
 * not just the current state.
 */
export async function getActivityLog(entityType: string, entityId: string, limit = 10) {
  const entries = await prisma.auditLog.findMany({
    where: { entityType, entityId },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return entries.map((e) => ({
    id: e.id,
    action: e.action,
    actorName: e.user?.name ?? "System",
    before: e.before as Record<string, unknown> | null,
    after: e.after as Record<string, unknown> | null,
    createdAt: e.createdAt,
  }));
}
