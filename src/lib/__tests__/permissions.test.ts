import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { canEvaluate } from "@/lib/evaluation-rules";
import { computeEvaluationScore } from "@/lib/scoring";

// Integration tests against a throwaway fixture this file creates and tears
// down itself — deliberately independent of whatever org data (real or
// seeded) currently exists in the dev database, so these stay green
// regardless of what's been configured via `npm run db:seed`.

describe("canEvaluate (sections 11, 58, 69)", () => {
  let managerA: { id: string };
  let managerB: { id: string }; // never invited to demo1
  let guestManager: { id: string }; // invited to demo2 despite being on a different team
  let developerPresent: { id: string };
  let developerAbsent: { id: string };
  let team1: { id: string };
  let team2: { id: string };
  let demo1: { id: string }; // team1's demo — managerA hosts, developerPresent attends, developerAbsent is invited but absent
  let demo2: { id: string }; // team2's demo — guestManager invited as evaluator despite being outside the team

  beforeAll(async () => {
    managerA = await prisma.user.create({ data: { name: "Test Manager A", email: `test-mgr-a-${Date.now()}@test.local`, role: "MANAGER" } });
    managerB = await prisma.user.create({ data: { name: "Test Manager B", email: `test-mgr-b-${Date.now()}@test.local`, role: "MANAGER" } });
    guestManager = await prisma.user.create({ data: { name: "Test Guest Manager", email: `test-mgr-c-${Date.now()}@test.local`, role: "MANAGER" } });
    developerPresent = await prisma.user.create({ data: { name: "Test Dev Present", email: `test-dev-1-${Date.now()}@test.local`, role: "DEVELOPER" } });
    developerAbsent = await prisma.user.create({ data: { name: "Test Dev Absent", email: `test-dev-2-${Date.now()}@test.local`, role: "DEVELOPER" } });

    team1 = await prisma.team.create({ data: { name: `Test Team 1 ${Date.now()}` } });
    team2 = await prisma.team.create({ data: { name: `Test Team 2 ${Date.now()}` } });

    demo1 = await prisma.demo.create({
      data: {
        title: "Fixture Demo 1",
        date: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        status: "COMPLETED",
        hostManagerId: managerA.id,
        createdById: managerA.id,
        teams: { create: [{ teamId: team1.id }] },
        invitees: {
          create: [
            { userId: managerA.id, role: "EVALUATOR_MANAGER" },
            { userId: developerPresent.id, role: "ATTENDEE_MEMBER" },
            { userId: developerAbsent.id, role: "ATTENDEE_MEMBER" },
          ],
        },
        attendees: {
          create: [
            { userId: managerA.id, status: "PRESENT" },
            { userId: developerPresent.id, status: "PRESENT" },
            { userId: developerAbsent.id, status: "ABSENT" },
          ],
        },
      },
    });

    demo2 = await prisma.demo.create({
      data: {
        title: "Fixture Demo 2",
        date: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        status: "COMPLETED",
        hostManagerId: managerB.id,
        createdById: managerB.id,
        teams: { create: [{ teamId: team2.id }] },
        invitees: {
          create: [
            { userId: managerB.id, role: "EVALUATOR_MANAGER" },
            { userId: guestManager.id, role: "EVALUATOR_MANAGER" }, // guest, different team
            { userId: developerPresent.id, role: "ATTENDEE_MEMBER" },
          ],
        },
        attendees: {
          create: [
            { userId: managerB.id, status: "PRESENT" },
            { userId: guestManager.id, status: "PRESENT" },
            { userId: developerPresent.id, status: "PRESENT" },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.demoAttendee.deleteMany({ where: { demoId: { in: [demo1.id, demo2.id] } } });
    await prisma.demoInvitee.deleteMany({ where: { demoId: { in: [demo1.id, demo2.id] } } });
    await prisma.demoTeam.deleteMany({ where: { demoId: { in: [demo1.id, demo2.id] } } });
    await prisma.demo.deleteMany({ where: { id: { in: [demo1.id, demo2.id] } } });
    await prisma.team.deleteMany({ where: { id: { in: [team1.id, team2.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [managerA.id, managerB.id, guestManager.id, developerPresent.id, developerAbsent.id] } } });
  });

  it("allows a manager to evaluate a developer who attended, when the manager also attended and was invited", async () => {
    const result = await canEvaluate(demo1.id, managerA.id, developerPresent.id);
    expect(result.ok).toBe(true);
  });

  it("denies evaluation when the manager was never invited to the demo", async () => {
    const result = await canEvaluate(demo1.id, managerB.id, developerPresent.id);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not invited/i);
  });

  it("still allows evaluating a developer recorded as Absent — attendance is informational, not a hard gate (a manager reopening a session must be able to evaluate them anyway)", async () => {
    const result = await canEvaluate(demo1.id, managerA.id, developerAbsent.id);
    expect(result.ok).toBe(true);
  });

  it("denies evaluating someone who was never invited to the demo at all", async () => {
    const uninvited = await prisma.user.create({ data: { name: "Never Invited Dev", email: `test-dev-uninvited-${Date.now()}@test.local`, role: "DEVELOPER" } });
    const result = await canEvaluate(demo1.id, managerA.id, uninvited.id);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not part of this demo/i);
    await prisma.user.delete({ where: { id: uninvited.id } });
  });

  it("allows a guest manager from a different team to evaluate, as long as both attended and the manager was invited as evaluator", async () => {
    const result = await canEvaluate(demo2.id, guestManager.id, developerPresent.id);
    expect(result.ok).toBe(true);
  });

  it("prevents self-evaluation", async () => {
    const result = await canEvaluate(demo1.id, managerA.id, managerA.id);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/cannot evaluate yourself/i);
  });
});

describe("evaluation scoring integrity", () => {
  it("(yes/total)*100 matches computeEvaluationScore for a representative answer set", () => {
    const answers = [
      { criterionCode: "a", answer: true, weight: 1 },
      { criterionCode: "b", answer: true, weight: 1 },
      { criterionCode: "c", answer: false, weight: 1 },
      { criterionCode: "d", answer: true, weight: 1 },
    ];
    const yes = answers.filter((a) => a.answer).length;
    expect(computeEvaluationScore(answers)).toBeCloseTo((yes / answers.length) * 100, 5);
  });

  it("every stored Evaluation.score in the database matches its own answers (data-integrity spot check)", async () => {
    const evaluations = await prisma.evaluation.findMany({
      where: { status: "COMPLETED" },
      include: { answers: true },
      take: 25,
    });
    for (const e of evaluations) {
      if (e.answers.length === 0) continue;
      const yes = e.answers.filter((a) => a.answer).length;
      const expected = (yes / e.answers.length) * 100;
      expect(e.score).not.toBeNull();
      expect(e.score as number).toBeCloseTo(expected, 5);
    }
  });

  it("every evaluation in the database has an evaluator who actually attended and was invited to evaluate, and a developer who was invited to the session (attendance status itself is not required)", async () => {
    const evaluations = await prisma.evaluation.findMany({ take: 25 });
    for (const e of evaluations) {
      const [evaluatorInvite, evaluatorAttendance, developerInvite] = await Promise.all([
        prisma.demoInvitee.findFirst({ where: { demoId: e.demoId, userId: e.evaluatorId, role: "EVALUATOR_MANAGER" } }),
        prisma.demoAttendee.findFirst({ where: { demoId: e.demoId, userId: e.evaluatorId } }),
        prisma.demoInvitee.findFirst({ where: { demoId: e.demoId, userId: e.developerId, role: "ATTENDEE_MEMBER" } }),
      ]);
      expect(evaluatorInvite).not.toBeNull();
      expect(evaluatorAttendance?.status).toBe("PRESENT");
      expect(developerInvite).not.toBeNull();
    }
  });
});
