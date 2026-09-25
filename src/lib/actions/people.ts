"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/permissions";

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

/** Adds a new developer to the org and, optionally, straight onto a team. */
export async function createPerson(input: { name: string; title?: string; teamId?: string }) {
  const session = await requireSession();
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Name is required.");

  const baseEmail = slugifyEmail(name);
  let email = baseEmail;
  let suffix = 1;
  while (await prisma.user.findUnique({ where: { email } })) {
    suffix += 1;
    email = baseEmail.replace("@", `${suffix}@`);
  }

  const person = await prisma.user.create({
    data: { name, email, role: "DEVELOPER", title: input.title?.trim() || "Developer" },
  });

  if (input.teamId) {
    const team = await prisma.team.findUnique({ where: { id: input.teamId }, include: { projects: true } });
    if (team) {
      await prisma.teamMember.create({ data: { teamId: team.id, userId: person.id } });
      const projectId = team.projects[0]?.projectId;
      if (projectId) {
        await prisma.projectAssignment.create({ data: { projectId, userId: person.id, isPrimary: true } });
      }
    }
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, entityType: "User", entityId: person.id, action: "CREATE", after: { name, email, teamId: input.teamId ?? null } },
  });

  revalidatePath("/people");
  if (input.teamId) revalidatePath(`/teams/${input.teamId}`);
  redirect(`/people/${person.id}`);
}
