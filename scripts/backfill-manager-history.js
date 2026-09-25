// One-off: TeamManagerHistory is a new table. Every existing TeamManager row
// (today's live team/manager pairs) needs a matching open history stint
// (endedAt null), or the "current vs previous managers" views would show
// nobody as current until the next manager change. Best-guess startedAt is
// the team's own createdAt, since we don't know the real assignment date for
// pre-existing org data.
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const teamManagers = await prisma.teamManager.findMany({ include: { team: true } });
  let created = 0;
  for (const tm of teamManagers) {
    const existing = await prisma.teamManagerHistory.findFirst({
      where: { teamId: tm.teamId, managerId: tm.userId, endedAt: null },
    });
    if (existing) continue;
    await prisma.teamManagerHistory.create({
      data: { teamId: tm.teamId, managerId: tm.userId, startedAt: tm.team.createdAt },
    });
    created += 1;
  }
  console.log(`${teamManagers.length} live TeamManager rows checked, ${created} history stints created.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
