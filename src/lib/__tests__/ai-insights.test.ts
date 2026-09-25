import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { AIInsightService } from "@/lib/ai/services";
import { AITeamSummaryService } from "@/lib/ai/team-org-insights";
import { computeEvaluationScore } from "@/lib/scoring";

// Builds its own throwaway fixture (a declining developer and a consistently
// strong one) and runs the real AI pipeline against it, independent of
// whatever org data currently exists — see permissions.test.ts for why.

describe("AI insight pipeline output", () => {
  let manager: { id: string };
  let team: { id: string };
  let project: { id: string };
  let decliningDev: { id: string };
  let strongDev: { id: string };
  const demoIds: string[] = [];

  beforeAll(async () => {
    const criteria = await prisma.evaluationCriterion.findMany({ where: { active: true } });
    expect(criteria.length).toBeGreaterThan(0); // relies on evaluation criteria seed, not org/mock data

    manager = await prisma.user.create({ data: { name: "Fixture Manager", email: `fixture-mgr-${Date.now()}@test.local`, role: "MANAGER" } });
    team = await prisma.team.create({ data: { name: `Fixture Team ${Date.now()}` } });
    project = await prisma.project.create({ data: { name: `Fixture Project ${Date.now()}`, status: "ACTIVE" } });
    decliningDev = await prisma.user.create({ data: { name: "Fixture Declining Dev", email: `fixture-dev-d-${Date.now()}@test.local`, role: "DEVELOPER" } });
    strongDev = await prisma.user.create({ data: { name: "Fixture Strong Dev", email: `fixture-dev-s-${Date.now()}@test.local`, role: "DEVELOPER" } });
    // Team-level scoring is keyed off actual TeamMember rows, not just "the
    // demo happened to be tagged with this team" (a multi-team demo must
    // never leak one team's evaluations into another's score).
    await prisma.teamMember.createMany({ data: [{ teamId: team.id, userId: decliningDev.id }, { teamId: team.id, userId: strongDev.id }] });

    // 4 rounds: decliningDev's business-understanding answer flips to "no"
    // from round 2 onward and every dimension trends down; strongDev scores
    // 100% every round.
    for (let round = 0; round < 4; round++) {
      const date = new Date();
      date.setDate(date.getDate() - (4 - round) * 7);

      const demo = await prisma.demo.create({
        data: {
          title: `Fixture Demo Round ${round + 1}`,
          date,
          startTime: date,
          endTime: date,
          status: "COMPLETED",
          hostManagerId: manager.id,
          createdById: manager.id,
          teams: { create: [{ teamId: team.id }] },
          projects: { create: [{ projectId: project.id }] },
          invitees: {
            create: [
              { userId: manager.id, role: "EVALUATOR_MANAGER" },
              { userId: decliningDev.id, role: "ATTENDEE_MEMBER" },
              { userId: strongDev.id, role: "ATTENDEE_MEMBER" },
            ],
          },
          attendees: {
            create: [
              { userId: manager.id, status: "PRESENT" },
              { userId: decliningDev.id, status: "PRESENT" },
              { userId: strongDev.id, status: "PRESENT" },
            ],
          },
        },
      });
      demoIds.push(demo.id);

      const decliningAnswers = criteria.map((c) => ({ criterionCode: c.code, answer: round < 1, weight: 1 }));
      const strongAnswers = criteria.map((c) => ({ criterionCode: c.code, answer: true, weight: 1 }));

      const decliningEval = await prisma.evaluation.create({
        data: {
          demoId: demo.id,
          developerId: decliningDev.id,
          evaluatorId: manager.id,
          projectId: project.id,
          teamId: team.id,
          status: "COMPLETED",
          score: computeEvaluationScore(decliningAnswers),
        },
      });
      await prisma.evaluationAnswer.createMany({
        data: criteria.map((c, i) => ({ evaluationId: decliningEval.id, criterionId: c.id, answer: decliningAnswers[i].answer })),
      });

      const strongEval = await prisma.evaluation.create({
        data: {
          demoId: demo.id,
          developerId: strongDev.id,
          evaluatorId: manager.id,
          projectId: project.id,
          teamId: team.id,
          status: "COMPLETED",
          score: computeEvaluationScore(strongAnswers),
        },
      });
      await prisma.evaluationAnswer.createMany({
        data: criteria.map((c) => ({ evaluationId: strongEval.id, criterionId: c.id, answer: true })),
      });
    }

    await AIInsightService.generateForDeveloper(decliningDev.id);
    await AIInsightService.generateForDeveloper(strongDev.id);
    await AITeamSummaryService.generateForTeam(team.id);
    await AITeamSummaryService.generateForOrganization();
  });

  afterAll(async () => {
    await prisma.aiAlert.deleteMany({ where: { subjectId: { in: [decliningDev.id, strongDev.id, team.id] } } });
    await prisma.aiInsight.deleteMany({ where: { subjectId: { in: [decliningDev.id, strongDev.id, team.id] } } });
    await prisma.recognition.deleteMany({ where: { developerId: { in: [decliningDev.id, strongDev.id] } } });
    await prisma.evaluationAnswer.deleteMany({ where: { evaluation: { demoId: { in: demoIds } } } });
    await prisma.evaluation.deleteMany({ where: { demoId: { in: demoIds } } });
    await prisma.demoAttendee.deleteMany({ where: { demoId: { in: demoIds } } });
    await prisma.demoInvitee.deleteMany({ where: { demoId: { in: demoIds } } });
    await prisma.demoTeam.deleteMany({ where: { demoId: { in: demoIds } } });
    await prisma.demoProject.deleteMany({ where: { demoId: { in: demoIds } } });
    await prisma.demo.deleteMany({ where: { id: { in: demoIds } } });
    await prisma.team.delete({ where: { id: team.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.deleteMany({ where: { id: { in: [manager.id, decliningDev.id, strongDev.id] } } });
  });

  it("flags the declining developer with a RISK insight backed by evidence", async () => {
    const riskInsights = await prisma.aiInsight.findMany({ where: { subjectType: "PERSON", subjectId: decliningDev.id, type: "RISK" } });
    expect(riskInsights.length).toBeGreaterThan(0);
    for (const insight of riskInsights) {
      const evidence = insight.evidence as { details?: string[] };
      expect(evidence.details && evidence.details.length).toBeTruthy();
    }
  });

  it("raises an active alert for the declining developer", async () => {
    const alerts = await prisma.aiAlert.findMany({ where: { subjectType: "PERSON", subjectId: decliningDev.id, status: "ACTIVE" } });
    expect(alerts.length).toBeGreaterThan(0);
  });

  it("recognizes the consistently strong developer", async () => {
    const recognitions = await prisma.recognition.findMany({ where: { developerId: strongDev.id } });
    expect(recognitions.length).toBeGreaterThan(0);
    expect(recognitions[0].evidence).toBeTruthy();
  });

  it("produces a team-level summary insight", async () => {
    const summary = await prisma.aiInsight.findFirst({ where: { subjectType: "TEAM", subjectId: team.id, type: "SUMMARY" } });
    expect(summary).not.toBeNull();
    expect(summary!.body.length).toBeGreaterThan(0);
  });

  it("produces an organization-level executive summary insight", async () => {
    const summary = await prisma.aiInsight.findFirst({ where: { subjectType: "ORGANIZATION", type: "SUMMARY" }, orderBy: { createdAt: "desc" } });
    expect(summary).not.toBeNull();
    expect(summary!.body.length).toBeGreaterThan(0);
  });
});
