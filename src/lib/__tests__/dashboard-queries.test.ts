import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getScoreTrendSeries, UNSCOPED, EVALUATION_BASELINE } from "@/lib/queries/dashboard";

// Verifies Test 4/5 from the data-consistency audit: Company Score Trend
// must start at the September 2026 baseline and never fabricate a
// zero-filled month for a period with no real evaluations.
describe("getScoreTrendSeries — September 2026 baseline, no invented months", () => {
  let manager: { id: string };
  let team: { id: string };
  let project: { id: string };
  let developer: { id: string };
  const demoIds: string[] = [];

  beforeAll(async () => {
    manager = await prisma.user.create({ data: { name: "Trend Fixture Manager", email: `trend-mgr-${Date.now()}@test.local`, role: "MANAGER" } });
    team = await prisma.team.create({ data: { name: `Trend Fixture Team ${Date.now()}` } });
    project = await prisma.project.create({ data: { name: `Trend Fixture Project ${Date.now()}`, status: "ACTIVE" } });
    developer = await prisma.user.create({ data: { name: "Trend Fixture Dev", email: `trend-dev-${Date.now()}@test.local`, role: "DEVELOPER" } });

    // One evaluation BEFORE the baseline (should never appear in the trend)
    // and one AFTER it (should be the only point in the series).
    const beforeBaseline = new Date(EVALUATION_BASELINE);
    beforeBaseline.setMonth(beforeBaseline.getMonth() - 2); // July 2026
    const afterBaseline = new Date(EVALUATION_BASELINE);
    afterBaseline.setDate(15); // mid-September 2026

    for (const date of [beforeBaseline, afterBaseline]) {
      const demo = await prisma.demo.create({
        data: {
          title: `Trend Fixture Demo ${date.toISOString()}`,
          date,
          startTime: date,
          endTime: date,
          status: "COMPLETED",
          hostManagerId: manager.id,
          createdById: manager.id,
          teams: { create: [{ teamId: team.id }] },
          invitees: {
            create: [
              { userId: manager.id, role: "EVALUATOR_MANAGER" },
              { userId: developer.id, role: "ATTENDEE_MEMBER" },
            ],
          },
          attendees: {
            create: [
              { userId: manager.id, status: "PRESENT" },
              { userId: developer.id, status: "PRESENT" },
            ],
          },
        },
      });
      demoIds.push(demo.id);
      await prisma.evaluation.create({
        data: { demoId: demo.id, developerId: developer.id, evaluatorId: manager.id, projectId: project.id, status: "COMPLETED", score: 75 },
      });
    }
  });

  afterAll(async () => {
    await prisma.evaluation.deleteMany({ where: { demoId: { in: demoIds } } });
    await prisma.demoAttendee.deleteMany({ where: { demoId: { in: demoIds } } });
    await prisma.demoInvitee.deleteMany({ where: { demoId: { in: demoIds } } });
    await prisma.demoTeam.deleteMany({ where: { demoId: { in: demoIds } } });
    await prisma.demo.deleteMany({ where: { id: { in: demoIds } } });
    await prisma.team.delete({ where: { id: team.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.deleteMany({ where: { id: { in: [manager.id, developer.id] } } });
  });

  it("excludes evaluations from before the September 2026 baseline", async () => {
    const series = await getScoreTrendSeries(UNSCOPED);
    const julyPoint = series.find((s) => s.label.startsWith("Jul"));
    expect(julyPoint).toBeUndefined();
  });

  it("includes the September 2026 point built from real evaluation data", async () => {
    const series = await getScoreTrendSeries(UNSCOPED);
    const septPoint = series.find((s) => s.label.includes("Sep") && s.label.includes("2026"));
    expect(septPoint).toBeDefined();
  });

  it("never returns a month with a fabricated zero score — every point in the series has real backing data", async () => {
    const series = await getScoreTrendSeries(UNSCOPED);
    // If a month had no evaluations, it simply would not appear at all —
    // this fixture only created July (excluded) and September (included),
    // so the series must contain no months in between with score 0.
    for (const point of series) {
      expect(point.score).toBeGreaterThan(0);
    }
  });
});
