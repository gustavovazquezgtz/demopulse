// One-off: freezes each developer's score exactly as it stands under the
// legacy (scoringVersion 1, yes/no) evaluation methodology, as a permanent
// record. Never recalculated afterward — this is "the corte" the user
// asked for, independent of whatever the live Score becomes as new
// (scoringVersion 2, 1-5 scale) evaluations accumulate from here on.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function averageScore(scores) {
  const valid = scores.filter((s) => s !== null && s !== undefined);
  if (valid.length === 0) return 0;
  return valid.reduce((s, n) => s + n, 0) / valid.length;
}
function dedupeScoresByDemo(evaluations) {
  const byDemo = new Map();
  for (const e of evaluations) {
    const entry = byDemo.get(e.demoId) ?? [];
    entry.push(e.score ?? 0);
    byDemo.set(e.demoId, entry);
  }
  return [...byDemo.values()].map((scores) => averageScore(scores));
}

async function main() {
  const cutoffSetting = await prisma.appSetting.findUnique({ where: { key: "evaluationMethodologyCutoff" } });
  const cutoffDate = cutoffSetting ? new Date(cutoffSetting.value.date) : new Date();

  const developers = await prisma.user.findMany({ where: { role: "DEVELOPER" }, select: { id: true } });
  let created = 0;
  let skipped = 0;

  for (const dev of developers) {
    const legacyEvaluations = await prisma.evaluation.findMany({
      where: { developerId: dev.id, status: "COMPLETED", scoringVersion: 1 },
      select: { demoId: true, score: true },
    });

    const existing = await prisma.engineerScoreCutoff.findUnique({ where: { userId: dev.id } });
    if (existing) {
      skipped += 1;
      continue;
    }

    const perDemoScores = dedupeScoresByDemo(legacyEvaluations);
    await prisma.engineerScoreCutoff.create({
      data: {
        userId: dev.id,
        cutoffDate,
        legacyScore: averageScore(perDemoScores),
        evaluationCount: legacyEvaluations.length,
      },
    });
    created += 1;
  }

  console.log(`Cutoff date: ${cutoffDate.toISOString().slice(0, 10)}`);
  console.log(`Created ${created} snapshots, skipped ${skipped} (already existed).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
