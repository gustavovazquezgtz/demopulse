import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { DemoForm } from "./demo-form";

export default async function NewDemoPage() {
  await requireSession();

  const [teams, managers] = await Promise.all([
    prisma.team.findMany({
      orderBy: { name: "asc" },
      include: {
        managers: { include: { user: true } },
        members: { include: { user: true } },
      },
    }),
    prisma.user.findMany({ where: { role: { in: ["MANAGER", "CEO"] } }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Create Demo Session</h1>
        <p className="text-sm text-muted-foreground">Pick a team — everything else is filled in for you.</p>
      </div>
      <DemoForm
        teams={teams.map((t) => ({
          id: t.id,
          name: t.name,
          managers: t.managers.map((m) => ({ id: m.user.id, name: m.user.name })),
          members: t.members.map((m) => ({ id: m.user.id, name: m.user.name })),
        }))}
        allManagers={managers.map((m) => ({ id: m.id, name: m.name }))}
      />
    </div>
  );
}
