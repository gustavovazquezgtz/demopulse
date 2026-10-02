import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { UNSCOPED } from "@/lib/queries/dashboard";
import { transcribeAudio } from "@/lib/ai/transcription";

describe("transcribeAudio — no OPENAI_API_KEY means no transcription, never a crash", () => {
  const original = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });
  afterAll(() => {
    if (original) process.env.OPENAI_API_KEY = original;
  });

  it("returns null without ever calling out to OpenAI", async () => {
    const result = await transcribeAudio(Buffer.from("fake audio bytes"), "audio/webm");
    expect(result).toBeNull();
  });
});

// Regression coverage for the 1:1 module's query layer: flexible editing,
// append-only notes, recordings exposed without their raw audio bytes
// (those are only ever served by the dedicated route handler), and the
// per-person compact history used on the Person profile page.
describe("one-on-one queries", () => {
  let manager: { id: string; name: string };
  let developer: { id: string };
  let otherDeveloper: { id: string };
  let session1: { id: string };
  let session2: { id: string };

  beforeAll(async () => {
    manager = await prisma.user.create({ data: { name: "1:1 Fixture Manager", email: `oneonone-mgr-${Date.now()}@test.local`, role: "MANAGER" } });
    developer = await prisma.user.create({ data: { name: "1:1 Fixture Developer", email: `oneonone-dev-${Date.now()}@test.local`, role: "DEVELOPER" } });
    otherDeveloper = await prisma.user.create({ data: { name: "1:1 Fixture Other Developer", email: `oneonone-dev2-${Date.now()}@test.local`, role: "DEVELOPER" } });

    session1 = await prisma.oneOnOneSession.create({
      data: {
        managerId: manager.id, developerId: developer.id, date: new Date("2026-01-10T10:00:00"),
        format: "IN_PERSON", location: "Room B", recommendations: "Focus on code review turnaround.", feedbackReceived: "Wants more context on roadmap.",
      },
    });
    session2 = await prisma.oneOnOneSession.create({
      data: { managerId: manager.id, developerId: otherDeveloper.id, date: new Date("2026-02-01T10:00:00"), format: "VIDEO_CALL" },
    });

    await prisma.oneOnOneNote.create({ data: { sessionId: session1.id, authorId: manager.id, text: "Followed up a week later, going well." } });
    await prisma.oneOnOneRecording.create({
      data: { sessionId: session1.id, audio: Buffer.from("fake"), mimeType: "audio/webm", sizeBytes: 4, transcript: "Hello this is a test transcript." },
    });
    await prisma.auditLog.create({
      data: { userId: manager.id, entityType: "OneOnOneSession", entityId: session1.id, action: "CREATE", after: { developerId: developer.id } },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityType: "OneOnOneSession", entityId: { in: [session1.id, session2.id] } } });
    await prisma.oneOnOneNote.deleteMany({ where: { sessionId: { in: [session1.id, session2.id] } } });
    await prisma.oneOnOneRecording.deleteMany({ where: { sessionId: { in: [session1.id, session2.id] } } });
    await prisma.oneOnOneSession.deleteMany({ where: { id: { in: [session1.id, session2.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [manager.id, developer.id, otherDeveloper.id] } } });
  });

  it("listOneOnOnes filters by developer and by format", async () => {
    const { listOneOnOnes } = await import("@/lib/queries/one-on-ones");
    const forDeveloper = await listOneOnOnes(UNSCOPED, { developerId: developer.id });
    expect(forDeveloper.map((r) => r.id)).toEqual([session1.id]);

    const videoCalls = await listOneOnOnes(UNSCOPED, { format: "VIDEO_CALL" });
    expect(videoCalls.some((r) => r.id === session2.id)).toBe(true);
    expect(videoCalls.some((r) => r.id === session1.id)).toBe(false);
  });

  it("getOneOnOneDetail exposes recording metadata and transcript, but never the raw audio bytes", async () => {
    const { getOneOnOneDetail } = await import("@/lib/queries/one-on-ones");
    const detail = await getOneOnOneDetail(session1.id);
    expect(detail).not.toBeNull();
    expect(detail!.recordings).toHaveLength(1);
    expect(detail!.recordings[0].transcript).toBe("Hello this is a test transcript.");
    expect((detail!.recordings[0] as Record<string, unknown>).audio).toBeUndefined();
  });

  it("getOneOnOneDetail includes append-only notes with author name and the audit activity trail", async () => {
    const { getOneOnOneDetail } = await import("@/lib/queries/one-on-ones");
    const detail = await getOneOnOneDetail(session1.id);
    expect(detail!.notes).toHaveLength(1);
    expect(detail!.notes[0].authorName).toBe(manager.name);
    expect(detail!.activity.length).toBeGreaterThan(0);
  });

  it("getOneOnOnesForPerson returns only that person's sessions, most recent first", async () => {
    const { getOneOnOnesForPerson } = await import("@/lib/queries/one-on-ones");
    const history = await getOneOnOnesForPerson(developer.id);
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe(session1.id);
  });
});
