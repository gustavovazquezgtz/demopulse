import { prisma } from "@/lib/prisma";
import type { Scope } from "./dashboard";
import { computeTrend } from "@/lib/scoring";

export async function getRanking(scope: Scope, opts: { teamId?: string; projectId?: string } = {}) {
  const people = await prisma.user.findMany({
    where: {
      role: "DEVELOPER",
      ...(scope.personIds ? { id: { in: scope.personIds } } : {}),
      ...(opts.teamId ? { teamMemberships: { some: { teamId: opts.teamId } } } : {}),
      ...(opts.projectId ? { projectAssignments: { some: { projectId: opts.projectId } } } : {}),
    },
    include: {
      teamMemberships: { include: { team: true } },
      projectAssignments: { include: { project: true } },
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

  const rows = people.map((p) => {
    const byDemo = new Map<string, number[]>();
    for (const e of p.evaluationsReceived) {
      const list = byDemo.get(e.demoId) ?? [];
      list.push(e.score ?? 0);
      byDemo.set(e.demoId, list);
    }
    const demoDates = new Map(p.evaluationsReceived.map((e) => [e.demoId, e.demo.date]));
    const scoresChrono = [...byDemo.entries()]
      .sort((a, b) => demoDates.get(a[0])!.getTime() - demoDates.get(b[0])!.getTime())
      .map(([, scores]) => scores.reduce((s, n) => s + n, 0) / scores.length);
    const trend = computeTrend(scoresChrono);

    const dim = (name: string) => {
      const answers = p.evaluationsReceived.flatMap((e) => e.answers.filter((a) => a.criterion.dimension === name));
      return answers.length ? (answers.filter((a) => a.answer).length / answers.length) * 100 : null;
    };

    const att = attendanceByPerson.get(p.id);

    return {
      id: p.id,
      name: p.name,
      teams: p.teamMemberships.map((tm) => tm.team.name),
      projects: p.projectAssignments.map((pa) => pa.project.name),
      score: trend.current,
      trend: trend.trend,
      attendance: att ? (att.present / att.total) * 100 : null,
      ai: dim("AI"),
      ux: dim("UX"),
      business: dim("Business"),
      evaluationCount: p.evaluationsReceived.length,
    };
  });

  return rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}
