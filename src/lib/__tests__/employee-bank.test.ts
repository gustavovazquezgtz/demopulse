import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { UNSCOPED } from "@/lib/queries/dashboard";
import { suggestGroup, isActiveProspectStatus, requiresOutcomeReason, DEFAULT_GROUP_THRESHOLDS } from "@/lib/employee-bank/scoring";

describe("suggestGroup — pure rating-threshold logic, never touches the manual Group", () => {
  it("maps rating 9-10 to A, 7-8 to B, 0-6 to C with default thresholds", () => {
    expect(suggestGroup(10)).toBe("A");
    expect(suggestGroup(9)).toBe("A");
    expect(suggestGroup(8)).toBe("B");
    expect(suggestGroup(7)).toBe("B");
    expect(suggestGroup(6)).toBe("C");
    expect(suggestGroup(0)).toBe("C");
  });

  it("returns null when there is no rating yet — never guesses", () => {
    expect(suggestGroup(null)).toBeNull();
  });

  it("respects custom, configurable thresholds instead of the hardcoded defaults", () => {
    const strict = { aMin: 9.5, bMin: 8 };
    expect(suggestGroup(9, strict)).toBe("B"); // would be A under defaults
    expect(suggestGroup(9, DEFAULT_GROUP_THRESHOLDS)).toBe("A");
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
  const prospectIds: string[] = [];

  beforeAll(async () => {
    employee = await prisma.user.create({ data: { name: "Bank Fixture Employee", email: `bank-emp-${Date.now()}@test.local`, role: "DEVELOPER" } });
    manager = await prisma.user.create({ data: { name: "Bank Fixture Manager", email: `bank-mgr-${Date.now()}@test.local`, role: "MANAGER" } });
    project = await prisma.project.create({ data: { name: `Bank Fixture Project ${Date.now()}`, status: "ACTIVE" } });

    await prisma.employeeBankProfile.create({
      data: { userId: employee.id, rating: 9, group: "B", groupOverrideNote: "New hire, want another cycle of evidence before A." },
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

  it("flags groupDiffers when the manual Group (B) disagrees with the rating-based suggestion (A for rating 9), without changing the stored Group", async () => {
    const { getEmployeeBankRows } = await import("@/lib/queries/employee-bank");
    const rows = await getEmployeeBankRows(UNSCOPED);
    const row = rows.find((r) => r.id === employee.id)!;
    expect(row.rating).toBe(9);
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
