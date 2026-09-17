import Link from "next/link";
import { requireSession, isCeo } from "@/lib/permissions";
import {
  UNSCOPED,
  getOrgStats,
  getScoreTrendSeries,
  getTeamComparison,
  getTopPerformers,
  getNeedsAttention,
  getExecutiveSummary,
  getUpcomingDemos,
  getPendingEvaluations,
} from "@/lib/queries/dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { ScoreTrendChart } from "@/components/charts/score-trend-chart";
import { TeamComparisonChart } from "@/components/charts/team-comparison-chart";
import { TopPerformersList } from "@/components/dashboard/top-performers-list";
import { NeedsAttentionList } from "@/components/dashboard/needs-attention-list";
import { Users, FolderKanban, UsersRound, Video, Gauge, ClipboardCheck, Sparkles, CalendarClock } from "lucide-react";
import { formatScore } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await requireSession();
  const ceo = isCeo(session);
  const scope = UNSCOPED; // every manager sees the full org (CEO parity), per explicit product decision

  const [stats, trend, teamComparison, topPerformers, needsAttention, execSummary, upcoming, pending] = await Promise.all([
    getOrgStats(scope),
    getScoreTrendSeries(scope),
    getTeamComparison(scope),
    getTopPerformers(scope, 5),
    getNeedsAttention(scope, 5),
    getExecutiveSummary(),
    getUpcomingDemos(scope, 5),
    ceo ? Promise.resolve([]) : getPendingEvaluations(session.user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {ceo ? "Executive Dashboard" : `Welcome back, ${session.user.name.split(" ")[0]}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ceo ? "Organization-wide performance and delivery intelligence." : "Here's what's happening across your teams."}
          </p>
        </div>
        <Button asChild>
          <Link href="/demos/new">Create Demo</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Active People" value={stats.activePeople} icon={Users} />
        <StatCard label="Active Projects" value={stats.activeProjects} icon={FolderKanban} />
        <StatCard label="Active Teams" value={stats.activeTeams} icon={UsersRound} />
        <StatCard label="Demos This Month" value={stats.demosThisMonth} icon={Video} />
        <StatCard label="Average Score" value={formatScore(stats.avgScore)} icon={Gauge} tone={stats.avgScore >= 75 ? "positive" : "warning"} />
        <StatCard label="Attendance" value={Math.round(stats.attendanceRate)} suffix="%" icon={CalendarClock} />
        <StatCard label="Evaluation Coverage" value={Math.round(stats.evaluationCoverage)} suffix="%" icon={ClipboardCheck} />
        <StatCard
          label="Needing Attention"
          value={stats.peopleRequiringAttention}
          icon={Sparkles}
          tone={stats.peopleRequiringAttention > 0 ? "warning" : "positive"}
        />
      </div>

      {execSummary && (
        <Card className="border-primary/20 bg-primary-muted/40">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-primary">Executive AI Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{execSummary.body}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Company Score Trend</CardTitle>
            <CardDescription>Average evaluation score by month</CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreTrendChart data={trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Demos</CardTitle>
            <CardDescription>Scheduled and ready to go</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">No upcoming demos</p>
                <Button asChild variant="link" size="sm">
                  <Link href="/demos/new">Create Demo</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {upcoming.map((d) => (
                  <Link key={d.id} href={`/demos/${d.id}`} className="flex flex-col gap-0.5 py-2.5 hover:bg-surface-muted/60 -mx-2 px-2 rounded-md">
                    <span className="text-sm font-medium text-foreground">{d.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {d.projects.map((p) => p.project.name).join(", ") || "No project"} · {d.date.toLocaleDateString()}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Team Comparison</CardTitle>
            <CardDescription>Average score by team</CardDescription>
          </CardHeader>
          <CardContent>
            {teamComparison.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No team data yet</p>
            ) : (
              <TeamComparisonChart data={teamComparison.map((t) => ({ name: t.name, score: t.score }))} />
            )}
          </CardContent>
        </Card>

        {!ceo && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Evaluations</CardTitle>
              <CardDescription>Complete these to keep insights current</CardDescription>
            </CardHeader>
            <CardContent>
              {pending.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No evaluations pending</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {pending.map((p) => (
                    <Link
                      key={p.demoId}
                      href={`/demos/${p.demoId}/evaluate`}
                      className="flex items-center justify-between py-2.5 hover:bg-surface-muted/60 -mx-2 px-2 rounded-md"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.demoTitle}</p>
                        <p className="text-xs text-muted-foreground">{p.projectName}</p>
                      </div>
                      <Badge variant="warning">
                        {p.pendingCount}/{p.totalAttendees} pending
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {ceo && (
          <Card>
            <CardHeader>
              <CardTitle>Best Performing Teams</CardTitle>
              <CardDescription>Ranked by average evaluation score</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col divide-y divide-border">
                {teamComparison.slice(0, 5).map((t, i) => (
                  <Link key={t.id} href={`/teams/${t.id}`} className="flex items-center justify-between py-2.5 hover:bg-surface-muted/60 -mx-2 px-2 rounded-md">
                    <span className="text-sm font-medium text-foreground">
                      {i + 1}. {t.name}
                    </span>
                    <Badge variant={t.score >= 75 ? "positive" : "secondary"}>{t.score}</Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Performers</CardTitle>
            <CardDescription>Who&apos;s standing out right now</CardDescription>
          </CardHeader>
          <CardContent>
            <TopPerformersList people={topPerformers} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Needs Attention</CardTitle>
            <CardDescription>Growth opportunities and risk signals</CardDescription>
          </CardHeader>
          <CardContent>
            <NeedsAttentionList people={needsAttention} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
