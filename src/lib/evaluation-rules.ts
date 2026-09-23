import { prisma } from "@/lib/prisma";

/**
 * Business rule (sections 11, 58, 69, revised): a manager may evaluate a
 * developer for a given demo if the manager both attended (status PRESENT)
 * and was invited to the demo as an evaluator, AND the developer was part
 * of the session (invited as an attendee).
 *
 * The developer's own attendance status (Present/Absent/Excused) is
 * deliberately NOT a hard gate — a manager who reopens a completed session
 * must be able to evaluate someone recorded as Absent/Excused if they
 * choose to (e.g. attendance was recorded before realizing they should
 * still be evaluated). Only the evaluator's own attendance is enforced,
 * since that's what makes their evaluation credible.
 *
 * Deliberately isolated from lib/permissions.ts (which imports next-auth) so
 * this pure Prisma-only rule can be unit-tested outside the Next.js runtime.
 */
export async function canEvaluate(demoId: string, evaluatorId: string, developerId: string): Promise<{ ok: boolean; reason?: string }> {
  const [evaluatorInvite, evaluatorAttendance, developerInvite] = await Promise.all([
    prisma.demoInvitee.findFirst({ where: { demoId, userId: evaluatorId, role: "EVALUATOR_MANAGER" } }),
    prisma.demoAttendee.findFirst({ where: { demoId, userId: evaluatorId } }),
    prisma.demoInvitee.findFirst({ where: { demoId, userId: developerId, role: "ATTENDEE_MEMBER" } }),
  ]);

  if (evaluatorId === developerId) return { ok: false, reason: "You cannot evaluate yourself." };
  if (!evaluatorInvite) return { ok: false, reason: "You were not invited to evaluate at this demo." };
  if (!evaluatorAttendance || evaluatorAttendance.status !== "PRESENT")
    return { ok: false, reason: "You must have attended the demo to evaluate." };
  if (!developerInvite) return { ok: false, reason: "This developer was not part of this demo session." };

  return { ok: true };
}
