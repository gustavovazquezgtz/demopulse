import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CRITERIA = [
  { code: "delivery", dimension: "Delivery", order: 1, text: "Terminó su asignación durante el tiempo estipulado del Feature centrado en la experiencia del usuario" },
  { code: "complexity", dimension: "Complexity", order: 2, text: "Trabajó un feature complejo" },
  { code: "business", dimension: "Business", order: 3, text: "Entiende el negocio que está trabajando" },
  { code: "ux", dimension: "UX", order: 4, text: "La experiencia de usuario cuenta con el 'Wow Factor'" },
  { code: "ai_usage", dimension: "AI", order: 5, text: "El Feature Utiliza AI para funcionar" },
  { code: "english", dimension: "English", order: 6, text: "Habla inglés fluido" },
] as const;

const MANAGERS = [
  { name: "Daniel Alcantara", email: "daniel.alcantara@demopulse.dev" },
  { name: "Diego de la Fuente", email: "diego.delafuente@demopulse.dev" },
  { name: "Ivan Gonzalez", email: "ivan.gonzalez@demopulse.dev" },
  { name: "Gustavo Vazquez", email: "gustavovazquezg@gmail.com" },
] as const;

const CEO = { name: "Angel Sanchez", email: "angel.sanchez@demopulse.dev" };

// Organization structure as provided — teams, their manager(s), and members.
const TEAMS: { name: string; managerEmails: string[]; members: string[] }[] = [
  {
    name: "Inventario Mezero AI",
    managerEmails: ["gustavovazquezg@gmail.com"],
    members: ["Hernandez Pimentel Mariano", "Emanuell Paredes", "Kirk Santiago"],
  },
  {
    name: "Expenses Control - Mezero AI",
    managerEmails: ["gustavovazquezg@gmail.com"],
    members: ["Cerezo Gomez Maria Fernanda"],
  },
  {
    name: "PMS",
    managerEmails: ["ivan.gonzalez@demopulse.dev"],
    members: ["Ana Rubi Ramirez Garcia", "Hernán Camacho"],
  },
  {
    name: "Sistema de Recompensas",
    managerEmails: ["diego.delafuente@demopulse.dev"],
    members: ["Gonzalez Rubio Rocio Elizabeth", "Delgado Diaz Jorge Alejandro", "Rodo Morán"],
  },
  {
    name: "Agentic Predictions",
    managerEmails: ["daniel.alcantara@demopulse.dev"],
    members: ["Torres Valadez Ricardo Daland", "Puente Alvarado Gabriel De Jesus", "Caballero Sanchez Daniel Jose", "Campos Corona Eduardo"],
  },
];

function slugifyEmail(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, ".");
  return `${normalized}@demopulse.dev`;
}

async function clearOrgData() {
  // Wipe everything derived from demo/team/project structure, but keep the
  // MANAGER/CEO login accounts and the (non-mock) evaluation criteria intact.
  await prisma.aiAlert.deleteMany();
  await prisma.aiInsight.deleteMany();
  await prisma.recognition.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.evaluationAnswer.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.managerOpinion.deleteMany();
  await prisma.participationScore.deleteMany();
  await prisma.deliverableOwner.deleteMany();
  await prisma.demoDeliverable.deleteMany();
  await prisma.demoAttendee.deleteMany();
  await prisma.demoInvitee.deleteMany();
  await prisma.demoUrl.deleteMany();
  await prisma.demo.deleteMany();
  await prisma.projectAssignment.deleteMany();
  await prisma.projectTeam.deleteMany();
  await prisma.projectManager.deleteMany();
  await prisma.projectUrl.deleteMany();
  await prisma.project.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.teamManager.deleteMany();
  await prisma.team.deleteMany();
  await prisma.user.deleteMany({ where: { role: "DEVELOPER" } });
}

async function main() {
  console.log("Clearing mock org data (teams, projects, demos, developers, evaluations, AI records)...");
  await clearOrgData();

  console.log("Ensuring evaluation criteria exist...");
  const existingCriteria = await prisma.evaluationCriterion.count();
  if (existingCriteria === 0) {
    await Promise.all(CRITERIA.map((c) => prisma.evaluationCriterion.create({ data: { ...c, active: true, weight: 1 } })));
  }

  console.log("Ensuring manager & CEO accounts exist...");
  const passwordHash = await bcrypt.hash("Password123!", 10);
  const managerByEmail = new Map<string, { id: string }>();
  for (const m of MANAGERS) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: {},
      create: { name: m.name, email: m.email, role: "MANAGER", passwordHash, title: "Engineering Manager" },
    });
    managerByEmail.set(m.email, user);
  }
  await prisma.user.upsert({
    where: { email: CEO.email },
    update: {},
    create: { name: CEO.name, email: CEO.email, role: "CEO", passwordHash, title: "Chief Executive Officer" },
  });

  console.log("Creating teams, manager associations, projects, and developers...");
  for (const teamDef of TEAMS) {
    const team = await prisma.team.create({ data: { name: teamDef.name } });

    for (const managerEmail of teamDef.managerEmails) {
      const manager = managerByEmail.get(managerEmail);
      if (!manager) throw new Error(`Unknown manager email: ${managerEmail}`);
      await prisma.teamManager.create({ data: { teamId: team.id, userId: manager.id } });
    }

    // One project per team as a placeholder container for demos/assignments —
    // rename or reassign in the Projects section once real project names are known.
    const project = await prisma.project.create({
      data: { name: teamDef.name, status: "ACTIVE", startDate: new Date() },
    });
    await prisma.projectTeam.create({ data: { projectId: project.id, teamId: team.id } });
    for (const managerEmail of teamDef.managerEmails) {
      const manager = managerByEmail.get(managerEmail)!;
      await prisma.projectManager.create({ data: { projectId: project.id, userId: manager.id } });
    }

    for (const memberName of teamDef.members) {
      const developer = await prisma.user.create({
        data: {
          name: memberName,
          email: slugifyEmail(memberName),
          role: "DEVELOPER",
          title: "Developer",
        },
      });
      await prisma.teamMember.create({ data: { teamId: team.id, userId: developer.id } });
      await prisma.projectAssignment.create({ data: { projectId: project.id, userId: developer.id, isPrimary: true } });
    }
  }

  console.log("\nDone.\n");
  const teams = await prisma.team.findMany({ include: { managers: { include: { user: true } }, members: { include: { user: true } } } });
  for (const t of teams) {
    console.log(`Team: ${t.name}  (managers: ${t.managers.map((m) => m.user.name).join(", ")})`);
    for (const m of t.members) console.log(`   - ${m.user.name} <${m.user.email}>`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
