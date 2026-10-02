import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/permissions";
import { getOneOnOneDetail } from "@/lib/queries/one-on-ones";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SessionEditForm } from "@/components/one-on-ones/session-edit-form";
import { AudioRecorder } from "@/components/one-on-ones/audio-recorder";
import { RecordingsList } from "@/components/one-on-ones/recordings-list";
import { SummaryPanel } from "@/components/one-on-ones/summary-panel";
import { OneOnOneNotes } from "@/components/one-on-ones/one-on-one-notes";
import { ActivityLog } from "@/components/shared/activity-log";
import { formatLabel } from "@/lib/one-on-ones/labels";

export default async function OneOnOneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const session = await getOneOnOneDetail(id);
  if (!session) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/one-on-ones" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to 1:1s
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              1:1 with <Link href={`/people/${session.developer.id}`} className="hover:underline">{session.developer.name}</Link>
            </h1>
            <p className="text-sm text-muted-foreground">Logged by {session.manager.name}</p>
          </div>
          <Badge variant="secondary">{formatLabel(session.format)}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
        </CardHeader>
        <CardContent>
          <SessionEditForm
            sessionId={session.id}
            date={session.date}
            format={session.format}
            location={session.location}
            recommendations={session.recommendations}
            feedbackReceived={session.feedbackReceived}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audio</CardTitle>
          <CardDescription>Record live or upload a clip — the AI summary below can use its transcript.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AudioRecorder sessionId={session.id} />
          <RecordingsList recordings={session.recordings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <SummaryPanel sessionId={session.id} summary={session.summary} summarySource={session.summarySource} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Follow-up Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <OneOnOneNotes sessionId={session.id} notes={session.notes} />
        </CardContent>
      </Card>

      <ActivityLog entries={session.activity} />
    </div>
  );
}
