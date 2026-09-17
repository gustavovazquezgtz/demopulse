import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { UNSCOPED, getOrgStats, getScoreTrendSeries, getTeamComparison } from "@/lib/queries/dashboard";
import { getRanking } from "@/lib/queries/ranking";
import { getQuestionAnalysis } from "@/lib/queries/evaluations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { ScoreTrendChart } from "@/components/charts/score-trend-chart";
import { ScoreBadge, TrendIndicator } from "@/components/dashboard/score-badge";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gauge, ClipboardCheck, UsersRound, Users } from "lucide-react";
import { formatScore } from "@/lib/utils";

interface SearchParams {
  teamSort?: string;
  teamDir?: string;
  rankSort?: string;
  rankDir?: string;
  qSort?: string;
  qDir?: string;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireSession();
  const { teamSort, teamDir, rankSort, rankDir, qSort, qDir } = await searchParams;

  const [stats, trend, teams, ranking, questions] = await Promise.all([
    getOrgStats(UNSCOPED),
    getScoreTrendSeries(UNSCOPED),
    getTeamComparison(UNSCOPED, { sort: teamSort, dir: teamDir }),
    getRanking(UNSCOPED, { sort: rankSort, dir: rankDir }),
    getQuestionAnalysis(qSort, qDir),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Organization-wide performance — visible to every manager.</p>
        </div>
        <Button asChild>
          <Link href="/demos/new">Create Demo</Link>
        </Button>
      </div>

      {/* Company Overview */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Company Score" value={formatScore(stats.avgScore)} icon={Gauge} tone={stats.avgScore >= 75 ? "positive" : "warning"} />
        <StatCard label="Evaluations" value={stats.totalEvaluations} icon={ClipboardCheck} />
        <StatCard label="Engineers" value={stats.activePeople} icon={Users} />
        <StatCard label="Teams" value={stats.activeTeams} icon={UsersRound} />
      </div>

      {/* Team Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Team Comparison</CardTitle>
          <CardDescription>Every team, ranked by score — highest to lowest by default.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>
                  <SortableHeader column="name" label="Team / Project" defaultDir="asc" sortParam="teamSort" dirParam="teamDir" />
                </TableHead>
                <TableHead>
                  <SortableHeader column="score" label="Score" sortParam="teamSort" dirParam="teamDir" />
                </TableHead>
                <TableHead>
                  <SortableHeader column="engineerCount" label="Engineers" sortParam="teamSort" dirParam="teamDir" />
                </TableHead>
                <TableHead>
                  <SortableHeader column="evaluationCount" label="Evaluations" sortParam="teamSort" dirParam="teamDir" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((t, i) => (
                <TableRow key={t.id}>
                  <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                  <TableCell>
                    <Link href={`/teams/${t.id}`} className="text-sm font-medium text-foreground hover:underline">
                      {t.name}
                    </Link>
                  </TableCell>
                  <TableCell><ScoreBadge score={t.score} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.engineerCount}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.evaluationCount === 0 ? <span className="text-xs italic">No data yet</span> : t.evaluationCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Engineer Ranking */}
      <Card>
        <CardHeader>
          <CardTitle>Engineer Ranking</CardTitle>
          <CardDescription>Every engineer in the organization, ranked by score.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>
                  <SortableHeader column="name" label="Engineer" defaultDir="asc" sortParam="rankSort" dirParam="rankDir" />
                </TableHead>
                <TableHead>Team / Project</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>
                  <SortableHeader column="score" label="Score" sortParam="rankSort" dirParam="rankDir" />
                </TableHead>
                <TableHead>Trend</TableHead>
                <TableHead>
                  <SortableHeader column="evaluationCount" label="Evaluations" sortParam="rankSort" dirParam="rankDir" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                  <TableCell>
                    <Link href={`/people/${r.id}`} className="text-sm font-medium text-foreground hover:underline">
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.teams.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.managers.join(", ") || "—"}</TableCell>
                  <TableCell><ScoreBadge score={r.score} /></TableCell>
                  <TableCell><TrendIndicator trend={r.trend} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.evaluationCount}</TableCell>
                </TableRow>
              ))}
              {ranking.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No evaluation data available yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Evaluation Questions */}
      <Card>
        <CardHeader>
          <CardTitle>Evaluation Questions</CardTitle>
          <CardDescription>Every configured question, aggregated from real evaluation answers.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader column="question" label="Question" defaultDir="asc" sortParam="qSort" dirParam="qDir" />
                </TableHead>
                <TableHead>
                  <SortableHeader column="category" label="Category" defaultDir="asc" sortParam="qSort" dirParam="qDir" />
                </TableHead>
                <TableHead>
                  <SortableHeader column="yesRate" label="Yes Rate" sortParam="qSort" dirParam="qDir" />
                </TableHead>
                <TableHead>
                  <SortableHeader column="evaluationCount" label="Evaluations" sortParam="qSort" dirParam="qDir" />
                </TableHead>
                <TableHead>
                  <SortableHeader column="yesCount" label="Yes" sortParam="qSort" dirParam="qDir" />
                </TableHead>
                <TableHead>
                  <SortableHeader column="noCount" label="No" sortParam="qSort" dirParam="qDir" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="max-w-xs text-sm text-foreground">{q.question}</TableCell>
                  <TableCell><Badge variant="secondary">{q.category}</Badge></TableCell>
                  <TableCell>
                    {q.yesRate === null ? (
                      <span className="text-xs italic text-muted-foreground">No evaluation data</span>
                    ) : (
                      <ScoreBadge score={q.yesRate} />
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{q.evaluationCount}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{q.yesCount}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{q.noCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Company Score Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Company Score Trend</CardTitle>
          <CardDescription>Average evaluation score by month, since September 2026.</CardDescription>
        </CardHeader>
        <CardContent>
          {trend.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No evaluation data available yet.</p>
          ) : (
            <ScoreTrendChart data={trend} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
