// One-off: seeds the 6 saved views named explicitly in the Employee Bank
// spec, plus an explicit AppSetting row for the default group thresholds
// (the app already falls back to the same defaults in code, but writing the
// row makes the current active configuration visible/editable from
// Settings immediately instead of only on first edit).
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const emptyFilters = { search: "", filters: { group: "", role: "", teamId: "", projectId: "", prospectStatus: "", availability: "", action: "" }, sorting: [{ id: "name", desc: false }], columnVisibility: {} };
function withFilters(overrides) {
  return { ...emptyFilters, filters: { ...emptyFilters.filters, ...overrides } };
}

const VIEWS = [
  { name: "Available Talent", filters: withFilters({ prospectStatus: "NOT_PROSPECTED", availability: "AVAILABLE" }) },
  { name: "Currently Prospected", filters: withFilters({ prospectStatus: "PROSPECTED" }) },
  { name: "Group A Available", filters: withFilters({ group: "A", availability: "AVAILABLE" }) },
  { name: "Interviews", filters: withFilters({ prospectStatus: "INTERVIEWING" }) },
  { name: "Rejected Prospects", filters: withFilters({ prospectStatus: "REJECTED" }) },
  { name: "Needs Placement", filters: withFilters({ prospectStatus: "NOT_PROSPECTED", availability: "AVAILABLE" }) },
];

async function main() {
  await prisma.appSetting.upsert({
    where: { key: "employeeBankGroupThresholds" },
    update: {},
    create: { key: "employeeBankGroupThresholds", value: { aMin: 9, bMin: 7 } },
  });

  const admin = await prisma.user.findFirstOrThrow({ where: { role: { in: ["MANAGER", "CEO"] } }, orderBy: { createdAt: "asc" } });

  let created = 0;
  for (const view of VIEWS) {
    const existing = await prisma.employeeBankSavedView.findFirst({ where: { name: view.name } });
    if (existing) continue;
    await prisma.employeeBankSavedView.create({ data: { name: view.name, filters: view.filters, createdById: admin.id } });
    created += 1;
  }
  console.log(`Seeded group thresholds setting. Created ${created} of ${VIEWS.length} saved views (rest already existed).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
