import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { OneOnOneForm } from "./one-on-one-form";

export default async function NewOneOnOnePage({ searchParams }: { searchParams: Promise<{ developerId?: string }> }) {
  await requireSession();
  const { developerId } = await searchParams;
  const developers = await prisma.user.findMany({ where: { role: "DEVELOPER" }, orderBy: { name: "asc" }, select: { id: true, name: true, title: true } });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Log a 1:1</h1>
        <p className="text-sm text-muted-foreground">You can add recordings, a summary, and follow-up notes after saving.</p>
      </div>
      <OneOnOneForm developers={developers} initialDeveloperId={developerId} />
    </div>
  );
}
