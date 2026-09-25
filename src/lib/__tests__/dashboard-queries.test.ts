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

// Regression test for the team-score cross-contamination bug: a demo that
// spans multiple teams (e.g. two squads presenting together) must never let
// one team's evaluations count toward another team's score just because
// they shared a session — only the developer's own TeamMember row decides.
describe("getTeamComparison — evaluations never leak across teams sharing a demo", () => {
  let manager: { id: string };
  let teamA: { id: string };
  let teamB: { id: string };
  let project: { id: string };
  let devInTeamA: { id: string };
  let demoId: string;

  beforeAll(async () => {
    manager = await prisma.user.create({ data: { name: "Contamination Fixture Manager", email: `contam-mgr-${Date.now()}@test.local`, role: "MANAGER" } });
    teamA = await prisma.team.create({ data: { name: `Contamination Team A ${Date.now()}` } });
    teamB = await prisma.team.create({ data: { name: `Contamination Team B ${Date.now()}` } });
    project = await prisma.project.create({ data: { name: `Contamination Fixture Project ${Date.now()}`, status: "ACTIVE" } });
    devInTeamA = await prisma.user.create({ data: { name: "Contamination Dev (Team A only)", email: `contam-dev-${Date.now()}@test.local`, role: "DEVELOPER" } });
    await prisma.teamMember.create({ data: { teamId: teamA.id, userId: devInTeamA.id } });

    // One demo tagged with BOTH teams (a shared session), but the evaluated
    // developer only actually belongs to Team A.
    const demo = await prisma.demo.create({
      data: {
        title: "Contamination Fixture Shared Demo",
        date: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        status: "COMPLETED",
        hostManagerId: manager.id,
        createdById: manager.id,
        teams: { create: [{ teamId: teamA.id }, { teamId: teamB.id }] },
        invitees: { create: [{ userId: manager.id, role: "EVALUATOR_MANAGER" }, { userId: devInTeamA.id, role: "ATTENDEE_MEMBER" }] },
        attendees: { create: [{ userId: manager.id, status: "PRESENT" }, { userId: devInTeamA.id, status: "PRESENT" }] },
      },
    });
    demoId = demo.id;
    await prisma.evaluation.create({
      data: { demoId: demo.id, developerId: devInTeamA.id, evaluatorId: manager.id, projectId: project.id, teamId: teamA.id, status: "COMPLETED", score: 90 },
    });
  });

  afterAll(async () => {
    await prisma.evaluation.deleteMany({ where: { demoId } });
    await prisma.demoAttendee.deleteMany({ where: { demoId } });
    await prisma.demoInvitee.deleteMany({ where: { demoId } });
    await prisma.demoTeam.deleteMany({ where: { demoId } });
    await prisma.demo.delete({ where: { id: demoId } });
    await prisma.team.deleteMany({ where: { id: { in: [teamA.id, teamB.id] } } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.deleteMany({ where: { id: { in: [manager.id, devInTeamA.id] } } });
  });

  it("counts the evaluation toward the developer's real team", async () => {
    const { getTeamComparison } = await import("@/lib/queries/dashboard");
    const rows = await getTeamComparison(UNSCOPED);
    const rowA = rows.find((r) => r.id === teamA.id)!;
    expect(rowA.evaluationCount).toBe(1);
    expect(rowA.score).toBe(90);
  });

  it("does NOT leak the evaluation into the other team sharing the same demo", async () => {
    const { getTeamComparison } = await import("@/lib/queries/dashboard");
    const rows = await getTeamComparison(UNSCOPED);
    const rowB = rows.find((r) => r.id === teamB.id)!;
    expect(rowB.evaluationCount).toBe(0);
    expect(rowB.score).toBe(0);
  });
});

// Regression test for the "move a person between teams" feature: past
// evaluations must stay attributed to whichever team they were given on,
// even after the person's current TeamMember row changes — Evaluation.teamId
// is a permanent snapshot, not a live lookup.
describe("Evaluation.teamId — team moves never rewrite evaluation history", () => {
  let manager: { id: string };
  let oldTeam: { id: string };
  let newTeam: { id: string };
  let project: { id: string };
  let developer: { id: string };
  let demoId: string;

  beforeAll(async () => {
    manager = await prisma.user.create({ data: { name: "Move Fixture Manager", email: `move-mgr-${Date.now()}@test.local`, role: "MANAGER" } });
    oldTeam = await prisma.team.create({ data: { name: `Move Fixture Old Team ${Date.now()}` } });
    newTeam = await prisma.team.create({ data: { name: `Move Fixture New Team ${Date.now()}` } });
    project = await prisma.project.create({ data: { name: `Move Fixture Project ${Date.now()}`, status: "ACTIVE" } });
    developer = await prisma.user.create({ data: { name: "Move Fixture Dev", email: `move-dev-${Date.now()}@test.local`, role: "DEVELOPER" } });
    await prisma.teamMember.create({ data: { teamId: oldTeam.id, userId: developer.id } });

    const demo = await prisma.demo.create({
      data: {
        title: "Move Fixture Demo",
        date: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        status: "COMPLETED",
        hostManagerId: manager.id,
        createdById: manager.id,
        teams: { create: [{ teamId: oldTeam.id }] },
        invitees: { create: [{ userId: manager.id, role: "EVALUATOR_MANAGER" }, { userId: developer.id, role: "ATTENDEE_MEMBER" }] },
        attendees: { create: [{ userId: manager.id, status: "PRESENT" }, { userId: developer.id, status: "PRESENT" }] },
      },
    });
    demoId = demo.id;
    // Evaluation.teamId set to oldTeam — exactly what resolveEvaluationTeamId
    // would compute at save time, since the developer was on oldTeam then.
    await prisma.evaluation.create({
      data: { demoId: demo.id, developerId: developer.id, evaluatorId: manager.id, projectId: project.id, teamId: oldTeam.id, status: "COMPLETED", score: 80 },
    });

    // Now simulate moveTeamMember(): the developer's CURRENT team changes...
    await prisma.teamMember.deleteMany({ where: { userId: developer.id } });
    await prisma.teamMember.create({ data: { teamId: newTeam.id, userId: developer.id } });
  });

  afterAll(async () => {
    await prisma.evaluation.deleteMany({ where: { demoId } });
    await prisma.demoAttendee.deleteMany({ where: { demoId } });
    await prisma.demoInvitee.deleteMany({ where: { demoId } });
    await prisma.demoTeam.deleteMany({ where: { demoId } });
    await prisma.demo.delete({ where: { id: demoId } });
    await prisma.teamMember.deleteMany({ where: { userId: developer.id } });
    await prisma.team.deleteMany({ where: { id: { in: [oldTeam.id, newTeam.id] } } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.deleteMany({ where: { id: { in: [manager.id, developer.id] } } });
  });

  it("...but the old team's score still counts the evaluation given while the person was there", async () => {
    const { getTeamComparison } = await import("@/lib/queries/dashboard");
    const rows = await getTeamComparison(UNSCOPED);
    const oldRow = rows.find((r) => r.id === oldTeam.id)!;
    expect(oldRow.evaluationCount).toBe(1);
    expect(oldRow.score).toBe(80);
  });

  it("the new team's score does NOT retroactively claim an evaluation from before the move", async () => {
    const { getTeamComparison } = await import("@/lib/queries/dashboard");
    const rows = await getTeamComparison(UNSCOPED);
    const newRow = rows.find((r) => r.id === newTeam.id)!;
    expect(newRow.evaluationCount).toBe(0);
  });

  it("the person's overall score still counts the evaluation regardless of which team they're on now", async () => {
    const evaluations = await prisma.evaluation.findMany({ where: { developerId: developer.id, status: "COMPLETED" } });
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0].score).toBe(80);
    expect(evaluations[0].teamId).toBe(oldTeam.id); // still tagged with the team it was given on
  });
});

// Regression test for manager reassignment: TeamManagerHistory must keep a
// closed-out record of a manager's past stint even after they're replaced,
// and the Ranking table's "previous managers" must reflect exactly that —
// distinct from whoever currently manages the team.
describe("TeamManagerHistory — reassigning a team's manager preserves who managed it before", () => {
  let oldManager: { id: string; name: string };
  let newManager: { id: string; name: string };
  let team: { id: string };
  let developer: { id: string };

  beforeAll(async () => {
    oldManager = await prisma.user.create({ data: { name: "Old Stint Manager", email: `old-mgr-${Date.now()}@test.local`, role: "MANAGER" } });
    newManager = await prisma.user.create({ data: { name: "New Stint Manager", email: `new-mgr-${Date.now()}@test.local`, role: "MANAGER" } });
    team = await prisma.team.create({ data: { name: `Manager History Fixture Team ${Date.now()}` } });
    developer = await prisma.user.create({ data: { name: "Manager History Fixture Dev", email: `mh-dev-${Date.now()}@test.local`, role: "DEVELOPER" } });
    await prisma.teamMember.create({ data: { teamId: team.id, userId: developer.id } });

    // Simulate what updateTeamManagers/removeManagerFromTeam +
    // addManagerToTeam do: close the old stint, open a new one, and only
    // the new manager remains in the live TeamManager table.
    await prisma.teamManagerHistory.create({ data: { teamId: team.id, managerId: oldManager.id, endedAt: new Date() } });
    await prisma.teamManager.create({ data: { teamId: team.id, userId: newManager.id } });
    await prisma.teamManagerHistory.create({ data: { teamId: team.id, managerId: newManager.id } });
  });

  afterAll(async () => {
    await prisma.teamManagerHistory.deleteMany({ where: { teamId: team.id } });
    await prisma.teamManager.deleteMany({ where: { teamId: team.id } });
    await prisma.teamMember.deleteMany({ where: { teamId: team.id } });
    await prisma.team.delete({ where: { id: team.id } });
    await prisma.user.deleteMany({ where: { id: { in: [oldManager.id, newManager.id, developer.id] } } });
  });

  it("getTeamDetail lists both stints, with only the new one marked current (endedAt null)", async () => {
    const { getTeamDetail } = await import("@/lib/queries/teams");
    const detail = await getTeamDetail(team.id);
    expect(detail!.managerHistory).toHaveLength(2);
    const oldStint = detail!.managerHistory.find((h) => h.managerId === oldManager.id)!;
    const newStint = detail!.managerHistory.find((h) => h.managerId === newManager.id)!;
    expect(oldStint.endedAt).not.toBeNull();
    expect(newStint.endedAt).toBeNull();
  });

  it("Ranking shows the new manager as current and the old one as previous, not both as current", async () => {
    const { getRanking } = await import("@/lib/queries/ranking");
    const rows = await getRanking(UNSCOPED);
    const row = rows.find((r) => r.id === developer.id)!;
    expect(row.managers).toEqual([newManager.name]);
    expect(row.previousManagers).toEqual([oldManager.name]);
  });
});

// Regression test for multi-team membership with dated join/leave: a
// developer can be active on more than one team at once, removing them from
// one team must not touch the other, and a closed-out stint (leftAt set)
// must stop counting as "current" while staying on record for history.
describe("TeamMember — multi-team membership with joinedAt/leftAt", () => {
  let developer: { id: string };
  let teamA: { id: string; name: string };
  let teamB: { id: string; name: string };
  let teamC: { id: string; name: string };
  let membershipA: { id: string };

  beforeAll(async () => {
    developer = await prisma.user.create({ data: { name: "Multi-Team Fixture Dev", email: `multi-dev-${Date.now()}@test.local`, role: "DEVELOPER" } });
    teamA = await prisma.team.create({ data: { name: `Multi-Team Fixture A ${Date.now()}` } });
    teamB = await prisma.team.create({ data: { name: `Multi-Team Fixture B ${Date.now()}` } });
    teamC = await prisma.team.create({ data: { name: `Multi-Team Fixture C ${Date.now()}` } });

    // Active on A and B at once...
    membershipA = await prisma.teamMember.create({ data: { teamId: teamA.id, userId: developer.id, joinedAt: new Date("2026-01-01") } });
    await prisma.teamMember.create({ data: { teamId: teamB.id, userId: developer.id, joinedAt: new Date("2026-02-01") } });
    // ...and a closed-out stint on C from before either of those.
    await prisma.teamMember.create({
      data: { teamId: teamC.id, userId: developer.id, joinedAt: new Date("2025-06-01"), leftAt: new Date("2025-12-01") },
    });
  });

  afterAll(async () => {
    await prisma.teamMember.deleteMany({ where: { userId: developer.id } });
    await prisma.team.deleteMany({ where: { id: { in: [teamA.id, teamB.id, teamC.id] } } });
    await prisma.user.delete({ where: { id: developer.id } });
  });

  it("counts the developer as an active member of both A and B", async () => {
    const { getTeamDetail } = await import("@/lib/queries/teams");
    const detailA = await getTeamDetail(teamA.id);
    const detailB = await getTeamDetail(teamB.id);
    expect(detailA!.team.members.some((m) => m.userId === developer.id)).toBe(true);
    expect(detailB!.team.members.some((m) => m.userId === developer.id)).toBe(true);
  });

  it("does not count the developer as an active member of C (their stint there ended)", async () => {
    const { getTeamDetail } = await import("@/lib/queries/teams");
    const detailC = await getTeamDetail(teamC.id);
    expect(detailC!.team.members.some((m) => m.userId === developer.id)).toBe(false);
    // ...but the stint is still visible in the team's member history.
    expect(detailC!.memberHistory.some((h) => h.userId === developer.id && h.leftAt !== null)).toBe(true);
  });

  it("ending the membership on A leaves B untouched", async () => {
    await prisma.teamMember.update({ where: { id: membershipA.id }, data: { leftAt: new Date("2026-06-01") } });
    const { getTeamDetail } = await import("@/lib/queries/teams");
    const detailA = await getTeamDetail(teamA.id);
    const detailB = await getTeamDetail(teamB.id);
    expect(detailA!.team.members.some((m) => m.userId === developer.id)).toBe(false);
    expect(detailB!.team.members.some((m) => m.userId === developer.id)).toBe(true);
    // Restore for the next assertion's isolation, even though afterAll cleans everything up.
    await prisma.teamMember.update({ where: { id: membershipA.id }, data: { leftAt: null } });
  });

  it("Ranking lists both currently-active teams for the developer", async () => {
    const { getRanking } = await import("@/lib/queries/ranking");
    const rows = await getRanking(UNSCOPED);
    const row = rows.find((r) => r.id === developer.id)!;
    expect(new Set(row.teams)).toEqual(new Set([teamA.name, teamB.name]));
  });

  it("rejoining a team after leaving opens a new stint rather than reviving the old one", async () => {
    const before = await prisma.teamMember.count({ where: { teamId: teamC.id, userId: developer.id } });
    await prisma.teamMember.create({ data: { teamId: teamC.id, userId: developer.id, joinedAt: new Date("2026-03-01") } });
    const after = await prisma.teamMember.count({ where: { teamId: teamC.id, userId: developer.id } });
    expect(after).toBe(before + 1);
    const rows = await prisma.teamMember.findMany({ where: { teamId: teamC.id, userId: developer.id }, orderBy: { joinedAt: "asc" } });
    expect(rows[0].leftAt).not.toBeNull(); // the old, closed-out stint is untouched
    expect(rows[1].leftAt).toBeNull(); // the new stint is active
  });
});
