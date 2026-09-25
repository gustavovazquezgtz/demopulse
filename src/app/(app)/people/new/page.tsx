import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PersonForm } from "./person-form";

export default async function NewPersonPage() {
  await requireSession();
  const teams = await prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Add Person</h1>
        <p className="text-sm text-muted-foreground">Adds a new engineer to the organization, optionally straight onto a team.</p>
      </div>
      <PersonForm teams={teams} />
    </div>
  );
}
