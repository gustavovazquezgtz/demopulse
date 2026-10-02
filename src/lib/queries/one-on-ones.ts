import { prisma } from "@/lib/prisma";
import type { Scope } from "./dashboard";
import { getActivityLog } from "./activity";
import { sortRows } from "@/lib/sort";

export async function listOneOnOnes(
  scope: Scope,
  opts: { developerId?: string; managerId?: string; format?: string; q?: string; sort?: string; dir?: string } = {}
) {
  const sessions = await prisma.oneOnOneSession.findMany({
    where: {
      ...(scope.personIds ? { developerId: { in: scope.personIds } } : {}),
      ...(opts.developerId ? { developerId: opts.developerId } : {}),
      ...(opts.managerId ? { managerId: opts.managerId } : {}),
      ...(opts.format ? { format: opts.format as never } : {}),
      ...(opts.q
        ? {
            OR: [
              { developer: { name: { contains: opts.q, mode: "insensitive" } } },
              { manager: { name: { contains: opts.q, mode: "insensitive" } } },
              { recommendations: { contains: opts.q, mode: "insensitive" } },
              { feedbackReceived: { contains: opts.q, mode: "insensitive" } },
              { summary: { contains: opts.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      developer: true,
      manager: true,
      recordings: { select: { id: true } },
      notes: { select: { id: true } },
    },
    orderBy: { date: "desc" },
  });

  const rows = sessions.map((s) => ({
    id: s.id,
    date: s.date,
    format: s.format,
    location: s.location,
    developer: { id: s.developer.id, name: s.developer.name },
    manager: { id: s.manager.id, name: s.manager.name },
    recommendations: s.recommendations,
    feedbackReceived: s.feedbackReceived,
    summary: s.summary,
    hasSummary: !!s.summary,
    recordingCount: s.recordings.length,
    noteCount: s.notes.length,
  }));

  return sortRows(rows, opts.sort, opts.dir, "date", "desc");
}

export async function getOneOnOneDetail(id: string) {
  const session = await prisma.oneOnOneSession.findUnique({
    where: { id },
    include: {
      developer: true,
      manager: true,
      recordings: {
        orderBy: { createdAt: "asc" },
        select: { id: true, sessionId: true, mimeType: true, sizeBytes: true, durationSec: true, transcript: true, createdAt: true },
      },
      notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!session) return null;

  const activity = await getActivityLog("OneOnOneSession", id);

  return {
    ...session,
    notes: session.notes.map((n) => ({ id: n.id, text: n.text, authorName: n.author.name, createdAt: n.createdAt })),
    activity,
  };
}

/** Compact list for the Person profile's "1:1 History" card. */
export async function getOneOnOnesForPerson(developerId: string) {
  const sessions = await prisma.oneOnOneSession.findMany({
    where: { developerId },
    include: { manager: true, recordings: { select: { id: true } } },
    orderBy: { date: "desc" },
    take: 10,
  });
  return sessions.map((s) => ({
    id: s.id,
    date: s.date,
    format: s.format,
    managerName: s.manager.name,
    summary: s.summary,
    recordingCount: s.recordings.length,
  }));
}
