import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { getDemoResults } from "@/lib/queries/demos";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DimensionBars } from "@/components/charts/dimension-bars";
import { ScoreBadge } from "@/components/dashboard/score-badge";
import { InsightCard } from "@/components/insights/insight-card";
import { initials, formatScore } from "@/lib/utils";

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function DemoResultsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const data = await getDemoResults(id);
  if (!data) notFound();

  const { demo, perDeveloper, teamScore, attendanceRate, dims, insights } = data;

  const topPerformers = perDeveloper.slice(0, 3);
  const needsAttention = perDeveloper.filter((p) => p.avgScore < 70);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/demos/${id}`} className="text-xs text-muted-foreground hover:underline">
          ← Back to demo
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-foreground">Demo Results — {demo.title}</h1>
        <p className="text-sm text-muted-foreground">
          {demo.teams.map((t) => t.team.name).join(", ")} · {demo.date.toLocaleDateString()}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Team Score" value={formatScore(teamScore)} />
        <Stat label="Developers Evaluated" value={String(perDeveloper.length)} />
        <Stat label="Attendance" value={`${Math.round(attendanceRate)}%`} />
        <Stat label="Needs Attention" value={String(needsAttention.length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Who Stood Out?</CardTitle>
            <CardDescription>Top scores, backed by evidence</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {topPerformers.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No evaluations yet.</p>}
            {topPerformers.map((p, i) => (
              <Link key={p.developerId} href={`/people/${p.developerId}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-muted/60 -mx-2 px-2 rounded-md">
                <span className="w-5 text-center">{MEDALS[i]}</span>
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{initials(p.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.evaluatorCount} evaluator{p.evaluatorCount === 1 ? "" : "s"} · {p.agreement.toLowerCase()} agreement
                  </p>
                </div>
                <ScoreBadge score={p.avgScore} />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs Attention</CardTitle>
            <CardDescription>Growth opportunities from this demo</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {needsAttention.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nobody scored below 70 this round.</p>}
            {needsAttention.map((p) => (
              <Link key={p.developerId} href={`/people/${p.developerId}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-muted/60 -mx-2 px-2 rounded-md">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{initials(p.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">Growth opportunity</p>
                </div>
                <ScoreBadge score={p.avgScore} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dimension Scores</CardTitle>
        </CardHeader>
        <CardContent>
          <DimensionBars dimensions={dims} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manager Consensus</CardTitle>
          <CardDescription>Individual scores per evaluator, with agreement level</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border">
          {perDeveloper.map((p) => (
            <div key={p.developerId} className="py-3">
              <div className="flex items-center justify-between">
                <Link href={`/people/${p.developerId}`} className="text-sm font-medium text-foreground hover:underline">{p.name}</Link>
                <div className="flex items-center gap-2">
                  <Badge variant={p.agreement === "LOW" ? "critical" : p.agreement === "MODERATE" ? "warning" : "secondary"}>
                    {p.agreement === "LOW" ? "Manager variance detected" : `${p.agreement.toLowerCase()} agreement`}
                  </Badge>
                  <ScoreBadge score={p.avgScore} />
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {p.evaluators.map((e, i) => (
                  <span key={i} className="rounded bg-surface-muted px-2 py-0.5">
                    {e.name}: {formatScore(e.score)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>AI Highlights</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {insights.map((i) => (
              <InsightCard key={i.id} type={i.type} title={i.title} body={i.body} evidence={i.evidence as { details?: string[] }} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
