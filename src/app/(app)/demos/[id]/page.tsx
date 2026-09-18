import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession, isCeo } from "@/lib/permissions";
import { getDemoDetail } from "@/lib/queries/demos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UrlCards } from "@/components/projects/url-cards";
import { AttendanceForm } from "@/components/demos/attendance-form";
import { EditParticipantsForm } from "@/components/demos/edit-participants-form";
import { EditManagersForm } from "@/components/demos/edit-managers-form";
import { EditTeamsForm } from "@/components/demos/edit-teams-form";
import { RescheduleForm } from "@/components/demos/reschedule-form";
import { ReopenButton } from "@/components/demos/reopen-button";
import { StartDemoButton } from "@/components/demos/start-demo-button";
import { CancelDemoButton } from "@/components/demos/cancel-demo-button";
import { CalendarDays, Clock, User, Rocket } from "lucide-react";

const STATUS_VARIANT: Record<string, "positive" | "warning" | "secondary" | "critical" | "info"> = {
  SCHEDULED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "positive",
  CANCELLED: "critical",
};

const DELIVERABLE_VARIANT: Record<string, "positive" | "warning" | "secondary" | "critical"> = {
  COMPLETED: "positive",
  IN_PROGRESS: "secondary",
  PARTIALLY_COMPLETED: "warning",
  BLOCKED: "critical",
  NOT_STARTED: "secondary",
};

export default async function DemoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const data = await getDemoDetail(id);
  if (!data) notFound();

  const { demo, invitedManagers, invitedMembers, attendanceByUser, evaluationProgress, teamRoster, evaluatedDeveloperIds, allTeams, allManagers } = data;

  // Any manager or CEO can manage any demo — global visibility/edit rights,
  // not scoped to who originally hosted or was invited (explicit product
  // decision, matches the rest of the app's org-wide access model).
  const canManage = true;
  const isInvitedEvaluator = invitedManagers.some((m) => m.userId === session.user.id);
  const canStart = isCeo(session) || isInvitedEvaluator;

  const totalExpected = evaluationProgress.reduce((s, p) => s + p.expectedEvaluations, 0);
  const totalCompleted = evaluationProgress.reduce((s, p) => s + p.completedEvaluations, 0);
  const activeParticipantIds =
    demo.status === "SCHEDULED"
      ? invitedMembers.map((m) => m.userId)
      : invitedMembers.filter((m) => attendanceByUser.get(m.userId) === "PRESENT").map((m) => m.userId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{demo.title}</h1>
            <Badge variant={STATUS_VARIANT[demo.status]}>{demo.status.replace("_", " ")}</Badge>
            {demo.reopenedAt && <Badge variant="outline">Reopened {demo.reopenedAt.toLocaleDateString()}</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{demo.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{demo.date.toLocaleDateString()}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{demo.startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–{demo.endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />Hosted by {demo.hostManager.name}</span>
            {demo.teams.map((t) => (
              <Link key={t.teamId} href={`/teams/${t.teamId}`} className="hover:underline">{t.team.name}</Link>
            ))}
          </div>
          {demo.startedBy && demo.startedAt && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Rocket className="h-3 w-3" /> Started by {demo.startedBy.name} on{" "}
              {demo.startedAt.toLocaleDateString()} at {demo.startedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {demo.status === "SCHEDULED" && canStart && <StartDemoButton demoId={demo.id} />}
          {demo.status === "SCHEDULED" && <CancelDemoButton demoId={demo.id} />}
          {isInvitedEvaluator && demo.status === "IN_PROGRESS" && (
            <Button asChild variant="outline">
              <Link href={`/demos/${demo.id}/evaluate`}>{totalCompleted > 0 ? "Continue Evaluation" : "Start Evaluation"}</Link>
            </Button>
          )}
          {demo.status === "COMPLETED" && canManage && <ReopenButton demoId={demo.id} />}
          {demo.status === "COMPLETED" && (
            <Button asChild>
              <Link href={`/demos/${demo.id}/results`}>View Results</Link>
            </Button>
          )}
        </div>
      </div>

      {demo.status === "SCHEDULED" && (
        <Card className="border-info/30 bg-info-muted/30">
          <CardContent className="flex items-center justify-between pt-6 text-sm">
            <p className="text-foreground">
              This session is scheduled but hasn&apos;t started. {invitedMembers.length} engineer{invitedMembers.length === 1 ? "" : "s"}{" "}
              across {demo.teams.length} team{demo.teams.length === 1 ? "" : "s"} will be invited when it begins.
            </p>
            {canStart && <StartDemoButton demoId={demo.id} />}
          </CardContent>
        </Card>
      )}

      {(demo.status === "IN_PROGRESS" || demo.status === "COMPLETED") && (
        <Card>
          <CardHeader>
            <CardTitle>Evaluation Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Progress value={totalExpected ? (totalCompleted / totalExpected) * 100 : 0} className="flex-1" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {totalCompleted}/{totalExpected} evaluations
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Expected Deliverables</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {demo.deliverables.length === 0 && <p className="text-sm text-muted-foreground">No deliverables defined.</p>}
          {demo.deliverables.map((d) => (
            <div key={d.id} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{d.title}</p>
                <Badge variant={DELIVERABLE_VARIANT[d.status]} className="text-[10px]">{d.status.replace(/_/g, " ")}</Badge>
              </div>
              {d.expectedOutcome && <p className="mt-1 text-xs text-muted-foreground">{d.expectedOutcome}</p>}
              {d.owners.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Owners: {d.owners.map((o) => o.user.name).join(", ")}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {demo.urls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Links</CardTitle>
          </CardHeader>
          <CardContent>
            <UrlCards urls={demo.urls} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Invited Managers</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {invitedManagers.map((m) => (
              <div key={m.userId} className="flex items-center justify-between py-1 text-sm">
                <span className="text-foreground">{m.user.name}</span>
                {demo.status === "SCHEDULED" ? (
                  <Badge variant="outline" className="text-[10px]">Invited</Badge>
                ) : (
                  <Badge variant={attendanceByUser.get(m.userId) === "PRESENT" ? "positive" : "outline"} className="text-[10px]">
                    {attendanceByUser.get(m.userId) ?? "Not recorded"}
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{demo.status === "SCHEDULED" ? "Participants" : "Attendance & Participants"}</CardTitle>
          </CardHeader>
          <CardContent>
            {demo.status === "SCHEDULED" ? (
              <div className="flex flex-col gap-1">
                {invitedMembers.map((m) => (
                  <div key={m.userId} className="flex items-center py-1 text-sm text-foreground">{m.user.name}</div>
                ))}
                {invitedMembers.length === 0 && <p className="text-sm text-muted-foreground">No participants invited yet.</p>}
              </div>
            ) : canManage ? (
              <AttendanceForm
                demoId={demo.id}
                invitees={[...invitedManagers, ...invitedMembers].map((i) => ({ userId: i.userId, name: i.user.name, role: i.role }))}
                initialStatus={Object.fromEntries(
                  [...invitedManagers, ...invitedMembers].map((i) => [i.userId, attendanceByUser.get(i.userId) ?? "PRESENT"])
                )}
                canMarkComplete={demo.status === "IN_PROGRESS"}
              />
            ) : (
              <div className="flex flex-col gap-1">
                {invitedMembers.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between py-1 text-sm">
                    <span className="text-foreground">{m.user.name}</span>
                    <Badge variant="outline" className="text-[10px]">{attendanceByUser.get(m.userId) ?? "Not recorded"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {demo.status === "SCHEDULED" && canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <EditTeamsForm
              demoId={demo.id}
              allTeams={allTeams.map((t) => ({
                id: t.id,
                name: t.name,
                managers: t.managers.map((m) => ({ userId: m.userId, name: m.user.name })),
                members: t.members.map((m) => ({ userId: m.userId, name: m.user.name })),
              }))}
              initialSelectedIds={demo.teams.map((t) => t.teamId)}
            />
          </CardContent>
        </Card>
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Invited Managers</CardTitle>
            <p className="text-xs text-muted-foreground">Any manager can evaluate any developer — not just their own team&apos;s.</p>
          </CardHeader>
          <CardContent>
            <EditManagersForm
              demoId={demo.id}
              allManagers={allManagers.map((m) => ({ id: m.id, name: m.name }))}
              initialSelectedIds={invitedManagers.map((m) => m.userId)}
              hostManagerId={demo.hostManagerId}
            />
          </CardContent>
        </Card>
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Participants</CardTitle>
          </CardHeader>
          <CardContent>
            {teamRoster.length === 0 ? (
              <p className="text-sm text-muted-foreground">This session has no linked team roster.</p>
            ) : (
              <EditParticipantsForm
                demoId={demo.id}
                roster={teamRoster.map((u) => ({ id: u.id, name: u.name }))}
                initialSelectedIds={activeParticipantIds}
                evaluatedIds={[...evaluatedDeveloperIds]}
              />
            )}
          </CardContent>
        </Card>
      )}

      {demo.status === "SCHEDULED" && canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Session Details</CardTitle>
          </CardHeader>
          <CardContent>
            <RescheduleForm demoId={demo.id} title={demo.title} date={demo.date} startTime={demo.startTime} />
          </CardContent>
        </Card>
      )}

      {demo.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{demo.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
