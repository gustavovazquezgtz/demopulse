"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/permissions";

/**
 * Adds a manager to a team: opens the live TeamManager row, a fresh
 * TeamManagerHistory stint (endedAt null = "still managing this team"), and
 * mirrors onto the linked Project's manager list. Does not itself write an
 * AuditLog row — callers batch that so a bulk change produces one readable
 * entry instead of one per manager.
 */
async function addManagerToTeam(teamId: string, managerId: string) {
  await prisma.teamManager.create({ data: { teamId, userId: managerId } });
  await prisma.teamManagerHistory.create({ data: { teamId, managerId } });

  const projectTeam = await prisma.projectTeam.findFirst({ where: { teamId } });
  if (projectTeam) {
    await prisma.projectManager.upsert({
      where: { projectId_userId: { projectId: projectTeam.projectId, userId: managerId } },
      update: {},
      create: { projectId: projectTeam.projectId, userId: managerId },
    });
  }
}

/**
 * Removes a manager from a team: deletes the live TeamManager row and closes
 * out their open TeamManagerHistory stint (endedAt = now) rather than
 * deleting it — that's the whole point of keeping manager history.
 */
async function removeManagerFromTeam(teamId: string, managerId: string) {
  await prisma.teamManager.deleteMany({ where: { teamId, userId: managerId } });
  await prisma.teamManagerHistory.updateMany({
    where: { teamId, managerId, endedAt: null },
    data: { endedAt: new Date() },
  });

  const projectTeam = await prisma.projectTeam.findFirst({ where: { teamId } });
  if (projectTeam) {
    await prisma.projectManager.deleteMany({ where: { projectId: projectTeam.projectId, userId: managerId } });
  }
}

/**
 * Creates a new Team. Team and Project are one concept for the user (see
 * ARCHITECTURE.md), so this also creates a matching Project of the same
 * name and links it — nobody has to separately set up "the project side."
 */
export async function createTeam(input: {
  name: string;
  description?: string;
  managerIds: string[];
  memberIds?: string[];
  startDate?: string;
}) {
  const session = await requireSession();
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Team name is required.");
  if (input.managerIds.length === 0) throw new Error("Select at least one manager.");
  const memberIds = input.memberIds ?? [];
  const startDate = input.startDate ? new Date(input.startDate) : new Date();

  const team = await prisma.team.create({
    data: {
      name,
      description: input.description?.trim() || undefined,
      managers: { create: input.managerIds.map((userId) => ({ userId })) },
      managerHistory: { create: input.managerIds.map((managerId) => ({ managerId })) },
      members: { create: memberIds.map((userId) => ({ userId, joinedAt: startDate })) },
    },
  });

  const project = await prisma.project.create({
    data: {
      name,
      status: "ACTIVE",
      startDate: new Date(),
      managers: { create: input.managerIds.map((userId) => ({ userId })) },
      teams: { create: [{ teamId: team.id }] },
    },
  });

  // Mirror the initial roster onto the new Project's assignments — this is
  // a brand new project, so there's nothing to diff against, just create.
  // The first active project a member has becomes their primary one.
  for (const userId of memberIds) {
    const hasOtherActiveAssignment = await prisma.projectAssignment.findFirst({ where: { userId, endDate: null } });
    await prisma.projectAssignment.create({
      data: { projectId: project.id, userId, startDate, isPrimary: !hasOtherActiveAssignment },
    });
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, entityType: "Team", entityId: team.id, action: "CREATE", after: { name, managerIds: input.managerIds, memberIds, projectId: project.id } },
  });

  revalidatePath("/teams");
  redirect(`/teams/${team.id}`);
}

/**
 * Adds a developer to a team as of a given date (defaults to today). A
 * person can be active on several teams at once, so this never touches
 * their other memberships — and if they already left this exact team
 * before, this opens a brand new stint rather than reviving the old one,
 * so the old joinedAt/leftAt pair stays on record untouched.
 */
export async function addTeamMember(teamId: string, userId: string, joinedAt?: string) {
  const session = await requireSession();
  const start = joinedAt ? new Date(joinedAt) : new Date();

  const existingActive = await prisma.teamMember.findFirst({ where: { teamId, userId, leftAt: null } });
  if (existingActive) return; // already an active member — no-op

  const [team, user] = await Promise.all([
    prisma.team.findUniqueOrThrow({ where: { id: teamId }, include: { projects: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
  ]);

  await prisma.teamMember.create({ data: { teamId, userId, joinedAt: start } });

  // Mirror onto the linked Project — Team/Project stay one concept. The
  // first active assignment a person has becomes primary; later ones don't
  // (resolveEvaluationProjectId only uses "primary" as a tiebreak anyway).
  const projectId = team.projects[0]?.projectId;
  if (projectId) {
    const hasOtherActiveAssignment = await prisma.projectAssignment.findFirst({ where: { userId, endDate: null } });
    await prisma.projectAssignment.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: { endDate: null, startDate: start, isPrimary: !hasOtherActiveAssignment },
      create: { projectId, userId, startDate: start, isPrimary: !hasOtherActiveAssignment },
    });
  }

  await prisma.auditLog.createMany({
    data: [
      { userId: session.user.id, entityType: "User", entityId: userId, action: "JOINED_TEAM", after: { team: team.name, joinedAt: start.toISOString() } },
      { userId: session.user.id, entityType: "Team", entityId: teamId, action: "MEMBER_JOINED", after: { member: user.name } },
    ],
  });

  revalidatePath("/people");
  revalidatePath(`/people/${userId}`);
  revalidatePath("/teams");
  revalidatePath(`/teams/${teamId}`);
}

/**
 * Ends a developer's membership on a team as of a given date (defaults to
 * today) — closes the TeamMember stint (leftAt) rather than deleting the
 * row, and ends the matching ProjectAssignment the same way. Every past
 * Evaluation keeps the Evaluation.teamId it was given at the time, so this
 * never touches or reinterprets historical scores.
 */
export async function removeTeamMember(teamMemberId: string, leftAt?: string) {
  const session = await requireSession();
  const end = leftAt ? new Date(leftAt) : new Date();

  const member = await prisma.teamMember.findUniqueOrThrow({
    where: { id: teamMemberId },
    include: { team: { include: { projects: true } }, user: true },
  });
  if (member.leftAt) return; // already ended
  if (end < member.joinedAt) throw new Error("The leave date can't be before the join date.");

  await prisma.teamMember.update({ where: { id: teamMemberId }, data: { leftAt: end } });

  const projectId = member.team.projects[0]?.projectId;
  if (projectId) {
    await prisma.projectAssignment.updateMany({
      where: { projectId, userId: member.userId, endDate: null },
      data: { endDate: end },
    });
  }

  await prisma.auditLog.createMany({
    data: [
      { userId: session.user.id, entityType: "User", entityId: member.userId, action: "LEFT_TEAM", before: { team: member.team.name, leftAt: end.toISOString() } },
      { userId: session.user.id, entityType: "Team", entityId: member.teamId, action: "MEMBER_LEFT", before: { member: member.user.name } },
    ],
  });

  revalidatePath("/people");
  revalidatePath(`/people/${member.userId}`);
  revalidatePath("/teams");
  revalidatePath(`/teams/${member.teamId}`);
}

/**
 * Changes who manages a team — also updates the matching Project's manager
 * list (Team/Project stay one concept) and logs a clear before/after so a
 * manager reassignment is always auditable, not silent.
 */
export async function updateTeamManagers(teamId: string, managerIds: string[]) {
  const session = await requireSession();
  if (managerIds.length === 0) throw new Error("A team needs at least one manager.");

  const [, currentManagers] = await Promise.all([
    prisma.team.findUniqueOrThrow({ where: { id: teamId } }),
    prisma.teamManager.findMany({ where: { teamId }, include: { user: true } }),
  ]);

  const currentIds = new Set(currentManagers.map((m) => m.userId));
  const nextIds = new Set(managerIds);
  if (currentIds.size === nextIds.size && [...currentIds].every((id) => nextIds.has(id))) return;

  const newManagers = await prisma.user.findMany({ where: { id: { in: managerIds } } });

  const toAdd = managerIds.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));
  for (const id of toRemove) await removeManagerFromTeam(teamId, id);
  for (const id of toAdd) await addManagerToTeam(teamId, id);

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "Team",
      entityId: teamId,
      action: "MANAGER_CHANGED",
      before: { managers: currentManagers.map((m) => m.user.name) },
      after: { managers: newManagers.map((m) => m.name) },
    },
  });

  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/teams");
}

/**
 * Reassigns a manager to a different set of teams from their own profile —
 * the manager-side equivalent of moveTeamMember, except managers can manage
 * more than one team at once, so this is a set update, not a single move.
 * Every add/remove is tracked in TeamManagerHistory, so a team's past
 * managers (and a manager's own past teams) stay visible even after this
 * runs — never overwritten, only closed out with an endedAt timestamp.
 */
export async function updateManagerTeams(managerId: string, teamIds: string[]) {
  const session = await requireSession();

  const [manager, currentAssignments] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: managerId } }),
    prisma.teamManager.findMany({ where: { userId: managerId }, include: { team: true } }),
  ]);

  const currentTeamIds = new Set(currentAssignments.map((a) => a.teamId));
  const nextTeamIds = new Set(teamIds);
  if (currentTeamIds.size === nextTeamIds.size && [...currentTeamIds].every((id) => nextTeamIds.has(id))) return;

  const toAdd = teamIds.filter((id) => !currentTeamIds.has(id));
  const toRemove = [...currentTeamIds].filter((id) => !nextTeamIds.has(id));

  if (toRemove.length > 0) {
    const managerCounts = await prisma.teamManager.groupBy({ by: ["teamId"], where: { teamId: { in: toRemove } }, _count: true });
    const orphaned = managerCounts.find((c) => c._count === 1);
    if (orphaned) {
      const team = currentAssignments.find((a) => a.teamId === orphaned.teamId)!.team;
      throw new Error(`Cannot remove ${manager.name} from "${team.name}" — they're its only manager.`);
    }
  }

  const addedTeams = await prisma.team.findMany({ where: { id: { in: toAdd } } });
  const removedTeams = currentAssignments.filter((a) => toRemove.includes(a.teamId)).map((a) => a.team);

  for (const id of toRemove) await removeManagerFromTeam(id, managerId);
  for (const id of toAdd) await addManagerToTeam(id, managerId);

  const oldTeamNames = currentAssignments.map((a) => a.team.name);
  const newTeamNames = [...new Set([...currentAssignments.filter((a) => !toRemove.includes(a.teamId)).map((a) => a.team.name), ...addedTeams.map((t) => t.name)])];

  await prisma.auditLog.createMany({
    data: [
      {
        userId: session.user.id,
        entityType: "User",
        entityId: managerId,
        action: "MOVE_MANAGER_TEAMS",
        before: { teams: oldTeamNames },
        after: { teams: newTeamNames },
      },
      ...removedTeams.map((t) => ({
        userId: session.user.id,
        entityType: "Team",
        entityId: t.id,
        action: "MANAGER_LEFT",
        before: { manager: manager.name },
      })),
      ...addedTeams.map((t) => ({
        userId: session.user.id,
        entityType: "Team",
        entityId: t.id,
        action: "MANAGER_JOINED",
        after: { manager: manager.name },
      })),
    ],
  });

  revalidatePath("/people");
  revalidatePath(`/people/${managerId}`);
  revalidatePath("/teams");
  for (const id of [...toAdd, ...toRemove]) revalidatePath(`/teams/${id}`);
}
