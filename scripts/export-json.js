const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

async function main() {
  const data = {
    exportedAt: new Date().toISOString(),
    users: await prisma.user.findMany(),
    teams: await prisma.team.findMany(),
    teamManagers: await prisma.teamManager.findMany(),
    teamMembers: await prisma.teamMember.findMany(),
    projects: await prisma.project.findMany(),
    projectManagers: await prisma.projectManager.findMany(),
    projectTeams: await prisma.projectTeam.findMany(),
    projectAssignments: await prisma.projectAssignment.findMany(),
    projectUrls: await prisma.projectUrl.findMany(),
    demos: await prisma.demo.findMany(),
    demoTeams: await prisma.demoTeam.findMany(),
    demoProjects: await prisma.demoProject.findMany(),
    demoUrls: await prisma.demoUrl.findMany(),
    demoInvitees: await prisma.demoInvitee.findMany(),
    demoAttendees: await prisma.demoAttendee.findMany(),
    demoDeliverables: await prisma.demoDeliverable.findMany(),
    deliverableOwners: await prisma.deliverableOwner.findMany(),
    evaluationCriteria: await prisma.evaluationCriterion.findMany(),
    evaluations: await prisma.evaluation.findMany(),
    evaluationAnswers: await prisma.evaluationAnswer.findMany(),
    managerOpinions: await prisma.managerOpinion.findMany(),
    participationScores: await prisma.participationScore.findMany(),
    aiInsights: await prisma.aiInsight.findMany(),
    aiAlerts: await prisma.aiAlert.findMany(),
    recognitions: await prisma.recognition.findMany(),
    notifications: await prisma.notification.findMany(),
    auditLogs: await prisma.auditLog.findMany(),
  };

  const counts = Object.fromEntries(Object.entries(data).filter(([k]) => k !== "exportedAt").map(([k, v]) => [k, v.length]));
  console.log("Row counts:", counts);

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(__dirname, "..", "exports", `demopulse_data_export_${ts}.json`);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log("Written to", outPath);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
