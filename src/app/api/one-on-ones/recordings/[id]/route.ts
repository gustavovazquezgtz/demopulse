import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Streams a stored 1:1 recording's raw bytes for the <audio> player.
 * A plain GET route (not a server action) because actions can't return
 * binary bodies with the right Content-Type for playback. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const recording = await prisma.oneOnOneRecording.findUnique({ where: { id } });
  if (!recording) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(recording.audio), {
    headers: {
      "Content-Type": recording.mimeType,
      "Content-Length": String(recording.sizeBytes),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
