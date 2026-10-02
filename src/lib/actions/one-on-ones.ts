"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/permissions";
import { getAIProvider } from "@/lib/ai";
import { transcribeAudio } from "@/lib/ai/transcription";

const MAX_RECORDING_BYTES = 4 * 1024 * 1024; // keep headroom under next.config's 4.5mb action body limit

interface SessionPatch {
  date?: string;
  format?: "IN_PERSON" | "VIDEO_CALL" | "PHONE_CALL" | "CHAT" | "OTHER";
  location?: string | null;
  recommendations?: string | null;
  feedbackReceived?: string | null;
  summary?: string | null;
}

export async function createOneOnOne(input: {
  developerId: string;
  date: string;
  format: "IN_PERSON" | "VIDEO_CALL" | "PHONE_CALL" | "CHAT" | "OTHER";
  location?: string;
  recommendations?: string;
  feedbackReceived?: string;
}) {
  const session = await requireSession();
  if (!input.developerId) throw new Error("Select who this 1:1 was with.");
  if (!input.date) throw new Error("Date is required.");

  const created = await prisma.oneOnOneSession.create({
    data: {
      managerId: session.user.id,
      developerId: input.developerId,
      date: new Date(input.date),
      format: input.format,
      location: input.location?.trim() || undefined,
      recommendations: input.recommendations?.trim() || undefined,
      feedbackReceived: input.feedbackReceived?.trim() || undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "OneOnOneSession",
      entityId: created.id,
      action: "CREATE",
      after: { developerId: input.developerId, date: input.date, format: input.format },
    },
  });

  revalidatePath("/one-on-ones");
  revalidatePath(`/people/${input.developerId}`);
  redirect(`/one-on-ones/${created.id}`);
}

/** Flexible edit — any subset of fields, any time after creation. */
export async function updateOneOnOne(id: string, patch: SessionPatch) {
  const session = await requireSession();
  const existing = await prisma.oneOnOneSession.findUniqueOrThrow({ where: { id } });

  const data: Record<string, unknown> = {};
  const before: Record<string, unknown> = {};
  if (patch.date !== undefined) {
    data.date = new Date(patch.date);
    before.date = existing.date.toISOString();
  }
  if (patch.format !== undefined) {
    data.format = patch.format;
    before.format = existing.format;
  }
  if (patch.location !== undefined) {
    data.location = patch.location || null;
    before.location = existing.location;
  }
  if (patch.recommendations !== undefined) {
    data.recommendations = patch.recommendations || null;
    before.recommendations = existing.recommendations;
  }
  if (patch.feedbackReceived !== undefined) {
    data.feedbackReceived = patch.feedbackReceived || null;
    before.feedbackReceived = existing.feedbackReceived;
  }
  if (patch.summary !== undefined) {
    data.summary = patch.summary || null;
    data.summarySource = "MANUAL";
    before.summary = existing.summary;
  }
  if (Object.keys(data).length === 0) return;

  await prisma.oneOnOneSession.update({ where: { id }, data });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "OneOnOneSession",
      entityId: id,
      action: "UPDATE",
      before: before as Prisma.InputJsonValue,
      after: data as Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/one-on-ones/${id}`);
  revalidatePath("/one-on-ones");
  revalidatePath(`/people/${existing.developerId}`);
}

export async function addOneOnOneNote(sessionId: string, text: string) {
  const session = await requireSession();
  if (!text.trim()) throw new Error("Note text is required.");

  await prisma.oneOnOneNote.create({ data: { sessionId, authorId: session.user.id, text: text.trim() } });
  await prisma.auditLog.create({
    data: { userId: session.user.id, entityType: "OneOnOneSession", entityId: sessionId, action: "NOTE", after: { text: text.trim() } },
  });

  revalidatePath(`/one-on-ones/${sessionId}`);
}

/** Accepts a recorded/uploaded audio clip as FormData (not a plain object —
 * server actions can take a File directly, letting the browser's
 * MediaRecorder blob go straight to the DB without a separate route). */
export async function uploadOneOnOneRecording(sessionId: string, formData: FormData) {
  const session = await requireSession();
  const file = formData.get("audio");
  if (!(file instanceof File)) throw new Error("No audio file received.");
  if (file.size === 0) throw new Error("The recording is empty.");
  if (file.size > MAX_RECORDING_BYTES) {
    throw new Error("This recording is too long for one clip (~8 min max) — split it into a second recording on the same session.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "audio/webm";

  const recording = await prisma.oneOnOneRecording.create({
    data: { sessionId, audio: buffer, mimeType, sizeBytes: buffer.length },
  });

  // Best-effort, inline transcription — if OPENAI_API_KEY isn't set this
  // is a no-op and the recording is still saved for playback.
  const transcript = await transcribeAudio(buffer, mimeType);
  if (transcript) {
    await prisma.oneOnOneRecording.update({ where: { id: recording.id }, data: { transcript } });
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, entityType: "OneOnOneSession", entityId: sessionId, action: "RECORDING_ADDED", after: { sizeBytes: buffer.length, transcribed: !!transcript } },
  });

  revalidatePath(`/one-on-ones/${sessionId}`);
}

export async function deleteOneOnOneRecording(id: string) {
  const session = await requireSession();
  const recording = await prisma.oneOnOneRecording.findUniqueOrThrow({ where: { id } });
  await prisma.oneOnOneRecording.delete({ where: { id } });

  await prisma.auditLog.create({
    data: { userId: session.user.id, entityType: "OneOnOneSession", entityId: recording.sessionId, action: "RECORDING_REMOVED" },
  });

  revalidatePath(`/one-on-ones/${recording.sessionId}`);
}

/**
 * Builds the summary from whatever is available: every recording's
 * transcript (if transcribed) plus the manually-typed recommendations/
 * feedback/notes — never only the audio, so this still produces something
 * useful even with no recording at all or no OPENAI_API_KEY configured
 * (falls back to the rule-based provider's plain-text digest).
 */
export async function generateOneOnOneSummary(sessionId: string) {
  const session = await requireSession();
  const data = await prisma.oneOnOneSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { recordings: true, notes: true, developer: true },
  });

  const facts: string[] = [];
  if (data.recommendations) facts.push(`Manager's recommendations: ${data.recommendations}`);
  if (data.feedbackReceived) facts.push(`Feedback received from ${data.developer.name}: ${data.feedbackReceived}`);
  for (const r of data.recordings) if (r.transcript) facts.push(`Recording transcript: ${r.transcript}`);
  for (const n of data.notes) facts.push(`Follow-up note: ${n.text}`);

  if (facts.length === 0) {
    throw new Error("Nothing to summarize yet — add recommendations, feedback, a note, or a transcribed recording first.");
  }

  const provider = getAIProvider();
  const summary = await provider.narrateSummary(
    `Write a short, factual summary of this 1:1 session between a manager and ${data.developer.name}. Cover what was discussed, what was recommended, and what feedback came back. Do not invent anything not present in the facts.`,
    facts
  );

  await prisma.oneOnOneSession.update({ where: { id: sessionId }, data: { summary, summarySource: provider.name } });
  await prisma.auditLog.create({
    data: { userId: session.user.id, entityType: "OneOnOneSession", entityId: sessionId, action: "SUMMARY_GENERATED", after: { source: provider.name } },
  });

  revalidatePath(`/one-on-ones/${sessionId}`);
  return summary;
}
