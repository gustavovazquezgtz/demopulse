import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { getPersonProfile } from "@/lib/queries/people";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DimensionBars } from "@/components/charts/dimension-bars";
import { InsightCard } from "@/components/insights/insight-card";
import { ScoreBadge, TrendIndicator } from "@/components/dashboard/score-badge";
import { ChangeTeamForm } from "@/components/people/change-team-form";
import { ManagerTeamsForm } from "@/components/people/manager-teams-form";
import { ActivityLog } from "@/components/shared/activity-log";
import { initials, formatScore } from "@/lib/utils";

export default async function PersonProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const data = await getPersonProfile(id);
  if (!data) notFound();

  const { person, evaluations, scoresByTeam, trend, confidence, attendance, avgParticipation, managerOpinions, insights, alerts, recognitions, dims, allTeams, activity, managedTeamIds, managerHistory } = data;
  const isManager = person.role === "MANAGER" || person.role === "CEO";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-lg">{initials(person.name)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{person.name}</h1>
            <p className="text-sm text-muted-foreground">{person.title ?? "Developer"}</p>
            <div className="mt-1 flex items-center gap-2">
              <ScoreBadge score={trend.current} />
              <TrendIndicator trend={trend.trend} delta={trend.delta} />
              <Badge variant="outline">{confidence} confidence · {evaluations.length} evaluations</Badge>
            </div>
          </div>
        </div>
        {!person.active && <Badge variant="critical">Inactive</Badge>}
      </div>

      {alerts.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {alerts.slice(0, 4).map((a) => (
            <InsightCard key={a.id} type="RISK" title={a.title} body={a.description} evidence={a.evidence as { details?: string[] }} />
          ))}
        </div>
      )}

      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="history">Evaluation History</TabsTrigger>
          <TabsTrigger value="opinions">Manager Opinions</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="recognition">Recognition</TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Score Breakdown</CardTitle>
                <CardDescription>Positive-answer rate by evaluation dimension</CardDescription>
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
                <CardTitle>Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <Row label="Attendance Rate" value={`${Math.round(attendance.rate)}%`} />
                <Row label="Demos Attended" value={String(attendance.total)} />
                <Row label="Avg. Participation (unofficial)" value={avgParticipation ? formatScore(avgParticipation * 20) : "—"} />
                <Row label="Team / Project" value={person.teamMemberships?.length ? undefined : "—"} custom={
                  <div className="flex flex-wrap gap-1 justify-end">
                    {person.teamMemberships.map((tm) => <Badge key={tm.teamId} variant="secondary">{tm.team.name}</Badge>)}
                  </div>
                } />
                <Row label="Skills" custom={
                  <div className="flex flex-wrap gap-1 justify-end">
                    {person.skills.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
                  </div>
                } />
                <div className="flex items-center justify-between gap-4 pt-1">
                  <span className="text-xs text-muted-foreground">Move to another team</span>
                  <ChangeTeamForm
                    userId={person.id}
                    currentTeamIds={person.teamMemberships.map((tm) => tm.teamId)}
                    allTeams={allTeams}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {isManager && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Teams Managed</CardTitle>
                <CardDescription>
                  Reassigning teams keeps every past stint on record — a team&apos;s previous managers stay visible even after this changes.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <ManagerTeamsForm managerId={person.id} allTeams={allTeams} initialSelectedIds={managedTeamIds} />
                {managerHistory.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">History</p>
                    {managerHistory.map((h) => (
                      <div key={h.id} className="flex items-center justify-between text-xs">
                        <Link href={`/teams/${h.teamId}`} className="text-foreground hover:underline">{h.teamName}</Link>
                        <span className="text-muted-foreground">
                          {h.startedAt.toLocaleDateString()} – {h.endedAt ? h.endedAt.toLocaleDateString() : "Present"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {scoresByTeam.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Score by Team</CardTitle>
                <CardDescription>
                  Each evaluation stays attributed to the team it was given on, even after a team change — overall score above always counts everything.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {scoresByTeam.map((t) => (
                  <div key={t.teamId} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Link href={`/teams/${t.teamId}`} className="font-medium text-foreground hover:underline">{t.teamName}</Link>
                      <span className="text-xs text-muted-foreground">{t.evaluationCount} eval{t.evaluationCount === 1 ? "" : "s"}</span>
                    </div>
                    <ScoreBadge score={t.avgScore} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="mt-4">
            <ActivityLog entries={activity} />
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Evaluation Timeline</CardTitle>
              <CardDescription>One point per demo, averaged across evaluators</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {evaluations.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No evaluations recorded yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {evaluations.map((e) => (
                    <Link
                      key={e.id}
                      href={`/demos/${e.demoId}/results`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-surface-muted/60"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground">{e.demo.title}</p>
                          {e.team && <Badge variant="secondary" className="text-[10px]">{e.team.name}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {e.demo.date.toLocaleDateString()} · evaluated by {e.evaluator.name}
                        </p>
                        {e.overallComment && <p className="mt-1 text-xs text-muted-foreground italic">&ldquo;{e.overallComment}&rdquo;</p>}
                      </div>
                      <ScoreBadge score={e.score} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="opinions">
          <div className="flex flex-col gap-3">
            {managerOpinions.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No manager opinions recorded yet.</p>
            )}
            {managerOpinions.map((op) => (
              <Card key={op.id}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle>{op.manager.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Confidence {op.confidence}/5</Badge>
                    <Badge variant={op.recommendation.includes("CONCERN") || op.recommendation === "NEEDS_ATTENTION" ? "critical" : op.recommendation.includes("RECOMMEND") ? "positive" : "secondary"}>
                      {op.recommendation.replaceAll("_", " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Strengths</p>
                    <p className="text-foreground">{op.strengths ?? "—"}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Concerns</p>
                    <p className="text-foreground">{op.concerns ?? "—"}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Growth Areas</p>
                    <p className="text-foreground">{op.growthAreas ?? "—"}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="insights">
          <div className="grid gap-3 md:grid-cols-2">
            {insights.length === 0 && (
              <p className="col-span-2 py-8 text-center text-sm text-muted-foreground">No AI insights yet — insights generate after the first completed evaluation.</p>
            )}
            {insights.map((i) => (
              <InsightCard key={i.id} type={i.type} title={i.title} body={i.body} evidence={i.evidence as { details?: string[] }} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="recognition">
          <div className="flex flex-col gap-3">
            {recognitions.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No recognition yet.</p>}
            {recognitions.map((r) => (
              <InsightCard key={r.id} type="RECOGNITION" title={r.title} body={r.body} evidence={r.evidence as { details?: string[] }} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value, custom }: { label: string; value?: string; custom?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      {custom ?? <span className="font-medium text-foreground">{value}</span>}
    </div>
  );
}
