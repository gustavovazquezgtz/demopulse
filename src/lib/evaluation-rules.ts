import { prisma } from "@/lib/prisma";

/**
 * Business rule (sections 11, 58, 69): a manager may evaluate a developer for
 * a given demo only if BOTH attended (status PRESENT) and the manager was
 * invited to the demo as an evaluator.
 *
 * Deliberately isolated from lib/permissions.ts (which imports next-auth) so
 * this pure Prisma-only rule can be unit-tested outside the Next.js runtime.
 */
export async function canEvaluate(demoId: string, evaluatorId: string, developerId: string): Promise<{ ok: boolean; reason?: string }> {
  const [evaluatorInvite, evaluatorAttendance, developerAttendance] = await Promise.all([
    prisma.demoInvitee.findFirst({ where: { demoId, userId: evaluatorId, role: "EVALUATOR_MANAGER" } }),
    prisma.demoAttendee.findFirst({ where: { demoId, userId: evaluatorId } }),
    prisma.demoAttendee.findFirst({ where: { demoId, userId: developerId } }),
  ]);

  if (evaluatorId === developerId) return { ok: false, reason: "You cannot evaluate yourself." };
  if (!evaluatorInvite) return { ok: false, reason: "You were not invited to evaluate at this demo." };
  if (!evaluatorAttendance || evaluatorAttendance.status !== "PRESENT")
    return { ok: false, reason: "You must have attended the demo to evaluate." };
  if (!developerAttendance || developerAttendance.status !== "PRESENT")
    return { ok: false, reason: "This developer did not attend the demo." };

  return { ok: true };
}
