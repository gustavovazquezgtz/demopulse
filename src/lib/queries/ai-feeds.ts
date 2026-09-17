import { prisma } from "@/lib/prisma";
import type { Scope } from "./dashboard";

async function subjectNames(subjectIds: string[], teamIds: string[]) {
  const [people, teams] = await Promise.all([
    subjectIds.length ? prisma.user.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true } }) : [],
    teamIds.length ? prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } }) : [],
  ]);
  const map = new Map<string, string>();
  for (const p of people) map.set(p.id, p.name);
  for (const t of teams) map.set(t.id, t.name);
  return map;
}

export async function listInsights(scope: Scope, opts: { type?: string } = {}) {
  const insights = await prisma.aiInsight.findMany({
    where: {
      ...(opts.type ? { type: opts.type as never } : {}),
      OR: [
        { subjectType: "PERSON", ...(scope.personIds ? { subjectId: { in: scope.personIds } } : {}) },
        { subjectType: "TEAM", ...(scope.teamIds ? { subjectId: { in: scope.teamIds } } : {}) },
        { subjectType: "ORGANIZATION" },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const names = await subjectNames(
    insights.filter((i) => i.subjectType === "PERSON").map((i) => i.subjectId!),
    insights.filter((i) => i.subjectType === "TEAM").map((i) => i.subjectId!)
  );

  return insights.map((i) => ({ ...i, subjectName: i.subjectId ? names.get(i.subjectId) ?? "Unknown" : "Organization" }));
}

export async function listAlerts(scope: Scope, opts: { severity?: string; status?: string } = {}) {
  const alerts = await prisma.aiAlert.findMany({
    where: {
      status: (opts.status as never) ?? "ACTIVE",
      ...(opts.severity ? { severity: opts.severity as never } : {}),
      OR: [
        { subjectType: "PERSON", ...(scope.personIds ? { subjectId: { in: scope.personIds } } : {}) },
        { subjectType: "TEAM", ...(scope.teamIds ? { subjectId: { in: scope.teamIds } } : {}) },
      ],
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
  });

  const names = await subjectNames(
    alerts.filter((a) => a.subjectType === "PERSON").map((a) => a.subjectId),
    alerts.filter((a) => a.subjectType === "TEAM").map((a) => a.subjectId)
  );

  return alerts.map((a) => ({ ...a, subjectName: names.get(a.subjectId) ?? "Unknown" }));
}

export async function listRecognitions(scope: Scope) {
  const recognitions = await prisma.recognition.findMany({
    where: scope.personIds ? { developerId: { in: scope.personIds } } : {},
    include: { developer: true },
    orderBy: { createdAt: "desc" },
  });
  return recognitions;
}
