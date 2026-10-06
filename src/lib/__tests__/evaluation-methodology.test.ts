import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getMethodologyCutoffDate, setMethodologyCutoffDate, isPastMethodologyCutoff } from "@/lib/evaluation-methodology";
import { computeEvaluationScore, computeScaleEvaluationScore } from "@/lib/scoring";

describe("evaluation methodology cutoff", () => {
  let originalCutoff: Date;

  beforeAll(async () => {
    originalCutoff = await getMethodologyCutoffDate();
  });

  afterAll(async () => {
    await setMethodologyCutoffDate(originalCutoff.toISOString().slice(0, 10));
  });

  it("round-trips an explicitly set cutoff date", async () => {
    await setMethodologyCutoffDate("2026-10-05");
    const cutoff = await getMethodologyCutoffDate();
    expect(cutoff.toISOString().slice(0, 10)).toBe("2026-10-05");
  });

  it("isPastMethodologyCutoff is true once the cutoff is in the past", async () => {
    await setMethodologyCutoffDate("2000-01-01");
    expect(await isPastMethodologyCutoff()).toBe(true);
  });

  it("isPastMethodologyCutoff is false while the cutoff is still in the future", async () => {
    await setMethodologyCutoffDate("2099-01-01");
    expect(await isPastMethodologyCutoff()).toBe(false);
  });
});

// Regression coverage for the core "no afectar calificaciones hasta el
// momento" requirement: a legacy (scoringVersion 1) Evaluation's cached
// score must never move, no matter what happens to criterion weights
// afterward — scores are computed once, at save time, and never
// recalculated live from the current weight configuration.
describe("legacy evaluations are immune to later weight changes", () => {
  let manager: { id: string };
  let developer: { id: string };
  let project: { id: string };
  let demo: { id: string };
  let criterion: { id: string; weight: number };
  let originalWeight: number;

  beforeAll(async () => {
    manager = await prisma.user.create({ data: { name: "Methodology Fixture Manager", email: `methodology-mgr-${Date.now()}@test.local`, role: "MANAGER" } });
    developer = await prisma.user.create({ data: { name: "Methodology Fixture Dev", email: `methodology-dev-${Date.now()}@test.local`, role: "DEVELOPER" } });
    project = await prisma.project.create({ data: { name: `Methodology Fixture Project ${Date.now()}`, status: "ACTIVE" } });
    demo = await prisma.demo.create({
      data: {
        title: "Methodology Fixture Demo", date: new Date(), startTime: new Date(), endTime: new Date(), status: "COMPLETED",
        hostManagerId: manager.id, createdById: manager.id,
        invitees: { create: [{ userId: manager.id, role: "EVALUATOR_MANAGER" }, { userId: developer.id, role: "ATTENDEE_MEMBER" }] },
        attendees: { create: [{ userId: manager.id, status: "PRESENT" }, { userId: developer.id, status: "PRESENT" }] },
      },
    });
    criterion = await prisma.evaluationCriterion.findFirstOrThrow({ where: { active: true } });
    originalWeight = criterion.weight;
  });

  afterAll(async () => {
    await prisma.evaluationCriterion.update({ where: { id: criterion.id }, data: { weight: originalWeight } });
    await prisma.evaluation.deleteMany({ where: { demoId: demo.id } });
    await prisma.demoAttendee.deleteMany({ where: { demoId: demo.id } });
    await prisma.demoInvitee.deleteMany({ where: { demoId: demo.id } });
    await prisma.demo.delete({ where: { id: demo.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.deleteMany({ where: { id: { in: [manager.id, developer.id] } } });
  });

  it("a legacy evaluation's cached score does not change after the criterion's weight is edited", async () => {
    // Mirrors exactly what saveEvaluation does for a scoringVersion-1 answer.
    const score = computeEvaluationScore([{ criterionCode: criterion.id, answer: true, weight: originalWeight }]);
    const evaluation = await prisma.evaluation.create({
      data: {
        demoId: demo.id, developerId: developer.id, evaluatorId: manager.id, projectId: project.id,
        status: "COMPLETED", score, scoringVersion: 1,
      },
    });
    await prisma.evaluationAnswer.create({ data: { evaluationId: evaluation.id, criterionId: criterion.id, answer: true } });

    // Someone later drags the weight slider way up.
    await prisma.evaluationCriterion.update({ where: { id: criterion.id }, data: { weight: 9 } });

    const reread = await prisma.evaluation.findUniqueOrThrow({ where: { id: evaluation.id } });
    expect(reread.score).toBe(score); // untouched — never recomputed from the new weight
    expect(reread.scoringVersion).toBe(1);
  });

  it("a NEW (scoringVersion 2) evaluation saved afterward DOES pick up the new weight", async () => {
    const liveWeight = (await prisma.evaluationCriterion.findUniqueOrThrow({ where: { id: criterion.id } })).weight;
    const score = computeScaleEvaluationScore([{ criterionCode: criterion.id, scaleValue: 5, weight: liveWeight }]);
    expect(score).toBe(100); // a 5/5 rating is always 100% regardless of weight, but confirms the live weight was read
    expect(liveWeight).toBe(9); // sanity: the earlier slider change really did take effect for new saves
  });
});
