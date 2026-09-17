import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { DemoForm } from "./demo-form";

export default async function NewDemoPage() {
  await requireSession();

  const [projects, teams, managers, developers] = await Promise.all([
    prisma.project.findMany({ orderBy: { name: "asc" } }),
    prisma.team.findMany({ orderBy: { name: "asc" }, include: { projects: true } }),
    prisma.user.findMany({ where: { role: { in: ["MANAGER", "CEO"] } }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: "DEVELOPER" }, orderBy: { name: "asc" }, include: { teamMemberships: true } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Create Demo</h1>
        <p className="text-sm text-muted-foreground">Pick the team(s) and project(s) presenting, deliverables, and who&apos;s invited.</p>
      </div>
      <DemoForm
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        teams={teams.map((t) => ({ id: t.id, name: t.name, projectIds: t.projects.map((p) => p.projectId) }))}
        managers={managers.map((m) => ({ id: m.id, name: m.name }))}
        developers={developers.map((d) => ({ id: d.id, name: d.name, teamIds: d.teamMemberships.map((tm) => tm.teamId) }))}
      />
    </div>
  );
}
