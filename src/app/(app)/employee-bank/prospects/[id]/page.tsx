import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/permissions";
import { getProspectDetail } from "@/lib/queries/employee-bank";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProspectStatusForm } from "@/components/employee-bank/prospect-status-form";
import { ProspectFeedbackForm, ProspectNoteForm } from "@/components/employee-bank/prospect-feedback-form";
import { ActivityLog } from "@/components/shared/activity-log";
import { enumLabel, statusTone } from "@/lib/employee-bank/labels";

export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const prospect = await getProspectDetail(id);
  if (!prospect) notFound();

  const timelineEntries = prospect.activity.map((a) => ({
    id: a.id,
    action: a.action,
    actorName: a.actorName,
    before: a.before,
    after: a.after,
    createdAt: a.createdAt,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/employee-bank" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to Employee Bank
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              <Link href={`/people/${prospect.employeeId}`} className="hover:underline">{prospect.employee.name}</Link>
            </h1>
            <p className="text-sm text-muted-foreground">
              Prospected for {prospect.project?.name ?? prospect.client ?? "—"} · {prospect.role}
            </p>
          </div>
          <Badge variant={statusTone(prospect.status)}>{enumLabel(prospect.status)}</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Prospect Details</CardTitle>
            <CardDescription>Created {prospect.createdAt.toLocaleDateString()} by prospect owner {prospect.owner.name}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Row label="Client" value={prospect.client ?? "—"} />
            <Row label="Project" value={prospect.project?.name ?? "—"} />
            <Row label="Team" value={prospect.team?.name ?? "—"} />
            <Row label="Role" value={prospect.role} />
            <Row label="Owner" value={prospect.owner.name} />
            <Row label="Source" value={enumLabel(prospect.source)} />
            {prospect.outcomeReason && <Row label="Outcome Reason" value={enumLabel(prospect.outcomeReason)} />}
            {prospect.outcomeNotes && <Row label="Outcome Notes" value={prospect.outcomeNotes} />}
            {prospect.generalNotes && <Row label="General Notes" value={prospect.generalNotes} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Update Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ProspectStatusForm prospectId={prospect.id} currentStatus={prospect.status} interviewDate={prospect.interviewDate} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feedback</CardTitle>
          <CardDescription>Technical, English, and client-side feedback captured for this opportunity</CardDescription>
        </CardHeader>
        <CardContent>
          <ProspectFeedbackForm
            prospectId={prospect.id}
            technicalFeedback={prospect.technicalFeedback}
            englishFeedback={prospect.englishFeedback}
            clientFeedback={prospect.clientFeedback}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add a Note</CardTitle>
        </CardHeader>
        <CardContent>
          <ProspectNoteForm prospectId={prospect.id} />
        </CardContent>
      </Card>

      <ActivityLog entries={timelineEntries} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
