import { prisma } from "@/lib/prisma";
import type { Scope } from "./dashboard";
import { computeTrend, dedupeScoresByDemo } from "@/lib/scoring";
import { sortRows } from "@/lib/sort";

export async function getRanking(
  scope: Scope,
  opts: { teamId?: string; sort?: string; dir?: string; englishBelow?: number } = {}
) {
  const people = await prisma.user.findMany({
    where: {
      role: "DEVELOPER",
      ...(scope.personIds ? { id: { in: scope.personIds } } : {}),
      ...(opts.teamId ? { teamMemberships: { some: { teamId: opts.teamId } } } : {}),
    },
    include: {
      teamMemberships: { include: { team: { include: { managers: { include: { user: true } } } } } },
      evaluationsReceived: {
        where: { status: "COMPLETED" },
        include: { demo: true, answers: { include: { criterion: true } } },
      },
    },
  });

  const attendance = await prisma.demoAttendee.findMany({
    where: { userId: { in: people.map((p) => p.id) } },
    select: { userId: true, status: true },
  });
  const attendanceByPerson = new Map<string, { present: number; total: number }>();
  for (const a of attendance) {
    const e = attendanceByPerson.get(a.userId) ?? { present: 0, total: 0 };
    e.total += 1;
    if (a.status === "PRESENT") e.present += 1;
    attendanceByPerson.set(a.userId, e);
  }

  // Who used to manage each of these people's teams — TeamManagerHistory
  // keeps a closed-out (endedAt set) row per past stint, so this survives
  // any number of manager reassignments without needing to touch Evaluation
  // or any other historical record.
  const teamIds = [...new Set(people.flatMap((p) => p.teamMemberships.map((tm) => tm.teamId)))];
  const pastManagerRows = teamIds.length
    ? await prisma.teamManagerHistory.findMany({
        where: { teamId: { in: teamIds }, endedAt: { not: null } },
        include: { manager: true },
      })
    : [];
  const pastManagersByTeam = new Map<string, Set<string>>();
  for (const h of pastManagerRows) {
    const set = pastManagersByTeam.get(h.teamId) ?? new Set<string>();
    set.add(h.manager.name);
    pastManagersByTeam.set(h.teamId, set);
  }

  const rows = people.map((p) => {
    const scoresChrono = dedupeScoresByDemo(p.evaluationsReceived).map((s) => s.score);
    const trend = computeTrend(scoresChrono);

    const dim = (name: string) => {
      const answers = p.evaluationsReceived.flatMap((e) => e.answers.filter((a) => a.criterion.dimension === name));
      return answers.length ? (answers.filter((a) => a.answer).length / answers.length) * 100 : null;
    };

    const att = attendanceByPerson.get(p.id);

    const managers = [...new Set(p.teamMemberships.flatMap((tm) => tm.team.managers.map((m) => m.user.name)))];
    const previousManagers = [...new Set(p.teamMemberships.flatMap((tm) => [...(pastManagersByTeam.get(tm.teamId) ?? [])]))].filter(
      (name) => !managers.includes(name)
    );

    return {
      id: p.id,
      name: p.name,
      teams: p.teamMemberships.map((tm) => tm.team.name), // "Team / Project" — one concept, see section 7
      managers,
      previousManagers,
      score: trend.current,
      trend: trend.trend,
      attendance: att ? (att.present / att.total) * 100 : null,
      ai: dim("AI"),
      ux: dim("UX"),
      business: dim("Business"),
      english: dim("English"),
      evaluationCount: p.evaluationsReceived.length,
    };
  });

  // "Low English" — evaluated and scoring in the same critical tier ScoreBadge
  // already uses everywhere else (<60%), i.e. managers have marked them not
  // fluent more often than not. People with no English data are excluded
  // rather than lumped in as "low" — no data isn't the same as a bad score.
  const filtered =
    opts.englishBelow !== undefined ? rows.filter((r) => r.english !== null && r.english < opts.englishBelow!) : rows;

  return sortRows(filtered, opts.sort, opts.dir, "score", "desc");
}
