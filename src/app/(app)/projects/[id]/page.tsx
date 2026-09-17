import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Team and Project are one concept for the user — this route exists only so
// that older /projects/[id] links keep working, by forwarding to the team
// that project is linked to.
export default async function ProjectDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const link = await prisma.projectTeam.findFirst({ where: { projectId: id }, select: { teamId: true } });
  if (!link) notFound();
  redirect(`/teams/${link.teamId}`);
}
