import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { getTeamDetail } from "@/lib/queries/teams";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DimensionBars } from "@/components/charts/dimension-bars";
import { ScoreBadge } from "@/components/dashboard/score-badge";
import { UrlCards } from "@/components/projects/url-cards";
import { EditTeamManagersForm } from "@/components/teams/edit-team-managers-form";
import { ActivityLog } from "@/components/shared/activity-log";
import { Sparkles } from "lucide-react";
import { initials } from "@/lib/utils";

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const data = await getTeamDetail(id);
  if (!data) notFound();

  const { team, demos, avgScore, attendanceRate, dims, insight, evaluationCount, urls, deliverables, activity, allManagers } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{team.name}</h1>
          <p className="text-sm text-muted-foreground">{team.description}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {team.managers.map((m) => (
              <Badge key={m.userId} variant="secondary">{m.user.name}</Badge>
            ))}
          </div>
        </div>
        <ScoreBadge score={avgScore} />
      </div>

      {insight && (
        <Card className="border-primary/20 bg-primary-muted/40">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-primary">AI Team Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{insight.body}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Members", value: team.members.length },
          { label: "Demos", value: demos.length },
          { label: "Evaluations", value: evaluationCount },
          { label: "Attendance", value: `${Math.round(attendanceRate)}%` },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Dimension Breakdown</CardTitle>
            <CardDescription>Delivery, Complexity, Business, UX, AI, English</CardDescription>
          </CardHeader>
          <CardContent>
            {dims.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No evaluations yet.</p>
            ) : (
              <DimensionBars dimensions={dims} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {team.members.map((m) => (
              <Link key={m.userId} href={`/people/${m.userId}`} className="flex items-center gap-2.5 py-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback>{initials(m.user.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground">{m.user.name}</p>
                  <p className="text-xs text-muted-foreground">{m.user.title}</p>
                </div>
              </Link>
            ))}
            {team.members.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No members yet.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Managers</CardTitle>
          <CardDescription>Changing this also updates the matching project&apos;s managers.</CardDescription>
        </CardHeader>
        <CardContent>
          <EditTeamManagersForm
            teamId={team.id}
            allManagers={allManagers.map((m) => ({ id: m.id, name: m.name }))}
            initialSelectedIds={team.managers.map((m) => m.userId)}
          />
        </CardContent>
      </Card>

      {urls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Links</CardTitle>
          </CardHeader>
          <CardContent>
            <UrlCards urls={urls} />
          </CardContent>
        </Card>
      )}

      {deliverables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Deliverables</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {deliverables.map((d) => (
              <div key={d.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{d.title}</p>
                  <Badge variant={d.status === "COMPLETED" ? "positive" : d.status === "BLOCKED" ? "critical" : "secondary"} className="text-[10px]">
                    {d.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                {d.owners.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{d.owners.map((o) => o.user.name).join(", ")}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ActivityLog entries={activity} />

      <Card>
        <CardHeader>
          <CardTitle>Demos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {demos.map((d) => (
              <Link key={d.id} href={`/demos/${d.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-surface-muted/60">
                <div>
                  <p className="text-sm font-medium text-foreground">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{d.date.toLocaleDateString()}</p>
                </div>
                <Badge variant={d.status === "COMPLETED" ? "positive" : d.status === "CANCELLED" ? "critical" : "info"}>
                  {d.status}
                </Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
