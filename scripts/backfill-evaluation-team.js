// One-time backfill: sets Evaluation.teamId (new historical field) for rows
// that predate it. Best-effort — uses the developer's CURRENT team
// membership since no better historical signal exists for old data,
// preferring whichever of the demo's own teams the developer belongs to.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const evaluations = await prisma.evaluation.findMany({
    where: { teamId: null },
    include: {
      developer: { include: { teamMemberships: true } },
      demo: { include: { teams: true } },
    },
  });

  console.log(`${evaluations.length} evaluations missing teamId`);
  let updated = 0;
  for (const e of evaluations) {
    const developerTeamIds = new Set(e.developer.teamMemberships.map((tm) => tm.teamId));
    const demoTeamIds = e.demo.teams.map((dt) => dt.teamId);
    const match = demoTeamIds.find((id) => developerTeamIds.has(id)) ?? [...developerTeamIds][0] ?? null;
    if (match) {
      await prisma.evaluation.update({ where: { id: e.id }, data: { teamId: match } });
      updated++;
    }
  }
  console.log(`Backfilled ${updated} evaluations (${evaluations.length - updated} left null — developer has no team membership at all)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
