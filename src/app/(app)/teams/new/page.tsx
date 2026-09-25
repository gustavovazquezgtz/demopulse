import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { TeamForm } from "./team-form";

export default async function NewTeamPage() {
  await requireSession();
  const managers = await prisma.user.findMany({ where: { role: { in: ["MANAGER", "CEO"] } }, orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Create Team</h1>
        <p className="text-sm text-muted-foreground">Sets up the matching project automatically — Team and Project are one concept here.</p>
      </div>
      <TeamForm managers={managers.map((m) => ({ id: m.id, name: m.name }))} />
    </div>
  );
}
