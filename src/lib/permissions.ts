import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEvaluate } from "@/lib/evaluation-rules";

export { canEvaluate };

export async function requireSession() {
  const session = await auth();
  if (!session) redirect("/login");
  return session;
}

export function isCeo(session: { user: { role: string } }) {
  return session.user.role === "CEO";
}

/** Team ids a manager manages. CEO callers should skip this and see everything. */
export async function managedTeamIds(userId: string): Promise<string[]> {
  const rows = await prisma.teamManager.findMany({ where: { userId }, select: { teamId: true } });
  return rows.map((r) => r.teamId);
}

/** Project ids a manager can see: directly managed, or owned by a team they manage. */
export async function visibleProjectIds(userId: string): Promise<string[]> {
  const [direct, teamIds] = await Promise.all([
    prisma.projectManager.findMany({ where: { userId }, select: { projectId: true } }),
    managedTeamIds(userId),
  ]);
  const viaTeams = teamIds.length
    ? await prisma.projectTeam.findMany({ where: { teamId: { in: teamIds } }, select: { projectId: true } })
    : [];
  return [...new Set([...direct.map((d) => d.projectId), ...viaTeams.map((v) => v.projectId)])];
}

/** People (developers) visible to a manager: members of teams they manage, or assignees of projects they manage. */
export async function visiblePersonIds(userId: string): Promise<string[]> {
  const [teamIds, projectIds] = await Promise.all([managedTeamIds(userId), visibleProjectIds(userId)]);
  const [viaTeams, viaProjects] = await Promise.all([
    teamIds.length ? prisma.teamMember.findMany({ where: { teamId: { in: teamIds } }, select: { userId: true } }) : [],
    projectIds.length
      ? prisma.projectAssignment.findMany({ where: { projectId: { in: projectIds } }, select: { userId: true } })
      : [],
  ]);
  return [...new Set([...viaTeams.map((v) => v.userId), ...viaProjects.map((v) => v.userId)])];
}

