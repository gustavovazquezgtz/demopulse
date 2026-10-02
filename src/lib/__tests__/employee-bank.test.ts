import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { UNSCOPED } from "@/lib/queries/dashboard";
import { suggestGroup, isActiveProspectStatus, requiresOutcomeReason, DEFAULT_GROUP_THRESHOLDS } from "@/lib/employee-bank/scoring";

describe("suggestGroup — pure evaluation-score-threshold logic, never touches the manual Group", () => {
  it("maps score 90-100 to A, 70-89 to B, 0-69 to C with default thresholds", () => {
    expect(suggestGroup(100)).toBe("A");
    expect(suggestGroup(90)).toBe("A");
    expect(suggestGroup(89)).toBe("B");
    expect(suggestGroup(70)).toBe("B");
    expect(suggestGroup(69)).toBe("C");
    expect(suggestGroup(0)).toBe("C");
  });

  it("returns null when there are no evaluations yet — never guesses", () => {
    expect(suggestGroup(null)).toBeNull();
  });

  it("respects custom, configurable thresholds instead of the hardcoded defaults", () => {
    const strict = { aMin: 95, bMin: 80 };
    expect(suggestGroup(90, strict)).toBe("B"); // would be A under defaults
    expect(suggestGroup(90, DEFAULT_GROUP_THRESHOLDS)).toBe("A");
  });
});

describe("prospect status helpers", () => {
  it("treats every non-terminal status as active", () => {
    expect(isActiveProspectStatus("IDENTIFIED")).toBe(true);
    expect(isActiveProspectStatus("INTERVIEW_SCHEDULED")).toBe(true);
    expect(isActiveProspectStatus("ON_HOLD")).toBe(true);
  });

  it("treats Accepted/Rejected/Withdrawn/Cancelled as terminal (not active)", () => {
    expect(isActiveProspectStatus("ACCEPTED")).toBe(false);
    expect(isActiveProspectStatus("REJECTED")).toBe(false);
    expect(isActiveProspectStatus("WITHDRAWN")).toBe(false);
    expect(isActiveProspectStatus("CANCELLED")).toBe(false);
  });

  it("requires an outcome reason only for the three failure-to-materialize statuses", () => {
    expect(requiresOutcomeReason("REJECTED")).toBe(true);
    expect(requiresOutcomeReason("WITHDRAWN")).toBe(true);
    expect(requiresOutcomeReason("CANCELLED")).toBe(true);
    expect(requiresOutcomeReason("ACCEPTED")).toBe(false);
    expect(requiresOutcomeReason("INTERVIEW_SCHEDULED")).toBe(false);
  });
});

// Regression test for the core Employee Bank query: an employee's active
// vs. historical prospects must be split correctly, "Group differs from
// suggested" must be flagged without ever changing the stored Group, and
// multiple simultaneous active prospects must all show up (never
// collapsed into a single field) — section 8 of the spec.
describe("getEmployeeBankRows / getEmployeeBankProfile", () => {
  let employee: { id: string };
  let manager: { id: string };
  let project: { id: string };
  let demoId: string;
  const prospectIds: string[] = [];

  beforeAll(async () => {
    employee = await prisma.user.create({ data: { name: "Bank Fixture Employee", email: `bank-emp-${Date.now()}@test.local`, role: "DEVELOPER" } });
    manager = await prisma.user.create({ data: { name: "Bank Fixture Manager", email: `bank-mgr-${Date.now()}@test.local`, role: "MANAGER" } });
    project = await prisma.project.create({ data: { name: `Bank Fixture Project ${Date.now()}`, status: "ACTIVE" } });

    // A 95-avg evaluation score → suggested Group A (default thresholds),
    // while the manager has manually kept them at B — this is what
    // groupDiffers is meant to catch.
    const demo = await prisma.demo.create({
      data: {
        title: "Bank Fixture Demo", date: new Date(), startTime: new Date(), endTime: new Date(), status: "COMPLETED",
        hostManagerId: manager.id, createdById: manager.id,
        invitees: { create: [{ userId: manager.id, role: "EVALUATOR_MANAGER" }, { userId: employee.id, role: "ATTENDEE_MEMBER" }] },
        attendees: { create: [{ userId: manager.id, status: "PRESENT" }, { userId: employee.id, status: "PRESENT" }] },
      },
    });
    demoId = demo.id;
    await prisma.evaluation.create({
      data: { demoId: demo.id, developerId: employee.id, evaluatorId: manager.id, projectId: project.id, status: "COMPLETED", score: 95 },
    });

    await prisma.employeeBankProfile.create({
      data: { userId: employee.id, group: "B", groupOverrideNote: "New hire, want another cycle of evidence before A." },
    });

    const active1 = await prisma.employeeProspect.create({
      data: { employeeId: employee.id, projectId: project.id, role: "Senior Full Stack", ownerManagerId: manager.id, source: "CLIENT_REQUEST", status: "INTERVIEW_SCHEDULED" },
    });
    const active2 = await prisma.employeeProspect.create({
      data: { employeeId: employee.id, client: "Wellfit", role: "Tech Lead", ownerManagerId: manager.id, source: "SALES_OPPORTUNITY", status: "PROFILE_SUBMITTED" },
    });
    const rejected = await prisma.employeeProspect.create({
      data: {
        employeeId: employee.id, client: "Gencise", role: "Full Stack", ownerManagerId: manager.id, source: "INTERNAL_STAFFING",
        status: "REJECTED", outcomeReason: "ENGLISH", outcomeNotes: "Strong technically, English wasn't there yet.",
      },
    });
    prospectIds.push(active1.id, active2.id, rejected.id);
  });

  afterAll(async () => {
    await prisma.employeeProspect.deleteMany({ where: { id: { in: prospectIds } } });
    await prisma.employeeBankProfile.deleteMany({ where: { userId: employee.id } });
    await prisma.evaluation.deleteMany({ where: { demoId } });
    await prisma.demoAttendee.deleteMany({ where: { demoId } });
    await prisma.demoInvitee.deleteMany({ where: { demoId } });
    await prisma.demo.delete({ where: { id: demoId } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.deleteMany({ where: { id: { in: [employee.id, manager.id] } } });
  });

  it("lists both active prospects for the employee, not collapsed into one field", async () => {
    const { getEmployeeBankRows } = await import("@/lib/queries/employee-bank");
    const rows = await getEmployeeBankRows(UNSCOPED);
    const row = rows.find((r) => r.id === employee.id)!;
    expect(row.activeProspects).toHaveLength(2);
    expect(row.activeProspects.map((p) => p.status).sort()).toEqual(["INTERVIEW_SCHEDULED", "PROFILE_SUBMITTED"]);
  });

  it("keeps the rejected prospect out of activeProspects but counted in history", async () => {
    const { getEmployeeBankRows } = await import("@/lib/queries/employee-bank");
    const rows = await getEmployeeBankRows(UNSCOPED);
    const row = rows.find((r) => r.id === employee.id)!;
    expect(row.activeProspects.some((p) => p.status === "REJECTED")).toBe(false);
    expect(row.historicalProspectCount).toBe(1);
    expect(row.rejectedProspectCount).toBe(1);
  });

  it("flags groupDiffers when the manual Group (B) disagrees with the score-based suggestion (A for a 95 evaluation score), without changing the stored Group", async () => {
    const { getEmployeeBankRows } = await import("@/lib/queries/employee-bank");
    const rows = await getEmployeeBankRows(UNSCOPED);
    const row = rows.find((r) => r.id === employee.id)!;
    expect(row.rating).toBe(95); // rating IS the evaluation score, never manually captured
    expect(row.suggestedGroup).toBe("A");
    expect(row.group).toBe("B"); // the manager's own call — untouched
    expect(row.groupDiffers).toBe(true);
  });

  it("getEmployeeBankProfile returns the full prospect + note detail for the drawer", async () => {
    const { getEmployeeBankProfile } = await import("@/lib/queries/employee-bank");
    const profile = await getEmployeeBankProfile(employee.id);
    expect(profile).not.toBeNull();
    expect(profile!.activeProspects).toHaveLength(2);
    expect(profile!.historicalProspectCount).toBe(1);
  });
});

// Regression test for failure-reason aggregation — section 28. Never
// deletes a prospect that didn't materialize; the analytics must be able
// to answer "why are we failing to place people?" from that history.
describe("getProspectAnalytics — failure reasons", () => {
  let employee: { id: string };
  let manager: { id: string };
  const prospectIds: string[] = [];

  beforeAll(async () => {
    employee = await prisma.user.create({ data: { name: "Analytics Fixture Employee", email: `analytics-emp-${Date.now()}@test.local`, role: "DEVELOPER" } });
    manager = await prisma.user.create({ data: { name: "Analytics Fixture Manager", email: `analytics-mgr-${Date.now()}@test.local`, role: "MANAGER" } });

    const p1 = await prisma.employeeProspect.create({
      data: { employeeId: employee.id, client: "A", role: "Dev", ownerManagerId: manager.id, source: "OTHER", status: "REJECTED", outcomeReason: "ENGLISH" },
    });
    const p2 = await prisma.employeeProspect.create({
      data: { employeeId: employee.id, client: "B", role: "Dev", ownerManagerId: manager.id, source: "OTHER", status: "REJECTED", outcomeReason: "ENGLISH" },
    });
    const p3 = await prisma.employeeProspect.create({
      data: { employeeId: employee.id, client: "C", role: "Dev", ownerManagerId: manager.id, source: "OTHER", status: "WITHDRAWN", outcomeReason: "SALARY" },
    });
    prospectIds.push(p1.id, p2.id, p3.id);
  });

  afterAll(async () => {
    await prisma.employeeProspect.deleteMany({ where: { id: { in: prospectIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [employee.id, manager.id] } } });
  });

  it("aggregates outcome reasons by percentage across every failed prospect org-wide", async () => {
    const { getProspectAnalytics } = await import("@/lib/queries/employee-bank");
    const stats = await getProspectAnalytics(UNSCOPED);
    const english = stats.failureReasons.find((r) => r.reason === "ENGLISH")!;
    const salary = stats.failureReasons.find((r) => r.reason === "SALARY")!;
    expect(english.count).toBeGreaterThanOrEqual(2);
    expect(salary.count).toBeGreaterThanOrEqual(1);
  });
});

// Regression test for two real production issues, fixed together:
// (1) Employee Bank's Rating/Score must use the exact same formula as
// Ranking/Person profile for the same person — no two pages may disagree
// on "the" score for the same underlying data.
// (2) That shared formula is a FLAT average over every COMPLETED
// evaluation, each counted equally — including a 0 from a demo the person
// no-showed or didn't participate in. It is explicitly NOT a
// recency-weighted "current window" value: a single recent strong demo
// must not outweigh a longer history of poor/absent ones.
describe("score is a flat, equally-weighted average of every evaluation (0s included) — consistent everywhere", () => {
  let employee: { id: string };
  let manager: { id: string };
  let project: { id: string };
  const demoIds: string[] = [];

  beforeAll(async () => {
    employee = await prisma.user.create({ data: { name: "Score Consistency Fixture Dev", email: `score-consistency-${Date.now()}@test.local`, role: "DEVELOPER" } });
    manager = await prisma.user.create({ data: { name: "Score Consistency Fixture Manager", email: `score-consistency-mgr-${Date.now()}@test.local`, role: "MANAGER" } });
    project = await prisma.project.create({ data: { name: `Score Consistency Fixture Project ${Date.now()}`, status: "ACTIVE" } });

    // Three demos, scores trending sharply upward: 0, 33.33, 83.33 — same
    // shape as the real case that exposed this bug.
    const scores = [0, 33.33, 83.33];
    for (let i = 0; i < scores.length; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (scores.length - i) * 7);
      const demo = await prisma.demo.create({
        data: {
          title: `Score Consistency Demo ${i}`, date, startTime: date, endTime: date, status: "COMPLETED",
          hostManagerId: manager.id, createdById: manager.id,
          invitees: { create: [{ userId: manager.id, role: "EVALUATOR_MANAGER" }, { userId: employee.id, role: "ATTENDEE_MEMBER" }] },
          attendees: { create: [{ userId: manager.id, status: "PRESENT" }, { userId: employee.id, status: "PRESENT" }] },
        },
      });
      demoIds.push(demo.id);
      await prisma.evaluation.create({
        data: { demoId: demo.id, developerId: employee.id, evaluatorId: manager.id, projectId: project.id, status: "COMPLETED", score: scores[i] },
      });
    }
  });

  afterAll(async () => {
    await prisma.evaluation.deleteMany({ where: { demoId: { in: demoIds } } });
    await prisma.demoAttendee.deleteMany({ where: { demoId: { in: demoIds } } });
    await prisma.demoInvitee.deleteMany({ where: { demoId: { in: demoIds } } });
    await prisma.demo.deleteMany({ where: { id: { in: demoIds } } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.deleteMany({ where: { id: { in: [employee.id, manager.id] } } });
  });

  it("Employee Bank's score equals Ranking's score for the same person", async () => {
    const { getEmployeeBankRows } = await import("@/lib/queries/employee-bank");
    const { getRanking } = await import("@/lib/queries/ranking");
    const bankRows = await getEmployeeBankRows(UNSCOPED);
    const rankingRows = await getRanking(UNSCOPED);
    const bankRow = bankRows.find((r) => r.id === employee.id)!;
    const rankingRow = rankingRows.find((r) => r.id === employee.id)!;
    expect(bankRow.score).toBeCloseTo(rankingRow.score!, 5);
  });

  it("is the flat average of the whole history (≈39), not just the most recent demo (≈83)", async () => {
    const { getEmployeeBankRows } = await import("@/lib/queries/employee-bank");
    const rows = await getEmployeeBankRows(UNSCOPED);
    const row = rows.find((r) => r.id === employee.id)!;
    // (0 + 33.33 + 83.33) / 3 ≈ 38.9
    expect(row.score).toBeGreaterThan(35);
    expect(row.score).toBeLessThan(45);
    expect(row.rating).toBe(39);
  });
});

describe("a 0-score demo (no-show / non-participation) counts toward the average like any other", () => {
  let employee: { id: string };
  let manager: { id: string };
  let project: { id: string };
  const demoIds: string[] = [];

  beforeAll(async () => {
    employee = await prisma.user.create({ data: { name: "Zero Counts Fixture Dev", email: `zero-counts-${Date.now()}@test.local`, role: "DEVELOPER" } });
    manager = await prisma.user.create({ data: { name: "Zero Counts Fixture Manager", email: `zero-counts-mgr-${Date.now()}@test.local`, role: "MANAGER" } });
    project = await prisma.project.create({ data: { name: `Zero Counts Fixture Project ${Date.now()}`, status: "ACTIVE" } });

    // One demo scored 100, one scored 0 (absence/non-participation). The
    // average must be 50, not 100 (which is what you'd get if the 0 were
    // silently excluded).
    for (const score of [100, 0]) {
      const date = new Date();
      const demo = await prisma.demo.create({
        data: {
          title: `Zero Counts Demo (score ${score})`, date, startTime: date, endTime: date, status: "COMPLETED",
          hostManagerId: manager.id, createdById: manager.id,
          invitees: { create: [{ userId: manager.id, role: "EVALUATOR_MANAGER" }, { userId: employee.id, role: "ATTENDEE_MEMBER" }] },
          // The evaluator (manager) was there either way — only the
          // developer being scored 0 is the one who didn't show/
          // participate. A manager can't evaluate a session they
          // themselves were absent from.
          attendees: { create: [{ userId: manager.id, status: "PRESENT" }, { userId: employee.id, status: score === 0 ? "ABSENT" : "PRESENT" }] },
        },
      });
      demoIds.push(demo.id);
      await prisma.evaluation.create({
        data: { demoId: demo.id, developerId: employee.id, evaluatorId: manager.id, projectId: project.id, status: "COMPLETED", score },
      });
    }
  });

  afterAll(async () => {
    await prisma.evaluation.deleteMany({ where: { demoId: { in: demoIds } } });
    await prisma.demoAttendee.deleteMany({ where: { demoId: { in: demoIds } } });
    await prisma.demoInvitee.deleteMany({ where: { demoId: { in: demoIds } } });
    await prisma.demo.deleteMany({ where: { id: { in: demoIds } } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.deleteMany({ where: { id: { in: [employee.id, manager.id] } } });
  });

  it("averages to 50, not 100 — the 0 is never dropped from the calculation", async () => {
    const { getEmployeeBankRows } = await import("@/lib/queries/employee-bank");
    const rows = await getEmployeeBankRows(UNSCOPED);
    const row = rows.find((r) => r.id === employee.id)!;
    expect(row.rating).toBe(50);
    expect(row.evaluationCount).toBe(2);
  });
});
