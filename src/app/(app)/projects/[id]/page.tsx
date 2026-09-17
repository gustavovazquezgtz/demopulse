import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { getProjectDetail } from "@/lib/queries/projects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UrlCards } from "@/components/projects/url-cards";
import { DimensionBars } from "@/components/charts/dimension-bars";
import { ScoreBadge } from "@/components/dashboard/score-badge";

const STATUS_VARIANT: Record<string, "positive" | "warning" | "secondary" | "critical"> = {
  ACTIVE: "positive",
  ON_HOLD: "warning",
  COMPLETED: "secondary",
  CANCELLED: "critical",
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const data = await getProjectDetail(id);
  if (!data) notFound();

  const { project, demos, evaluations, deliverables, avgScore, dims } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{project.name}</h1>
            <Badge variant={STATUS_VARIANT[project.status] ?? "secondary"}>{project.status.replace("_", " ")}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{project.client}</p>
          <p className="mt-1 max-w-2xl text-sm text-foreground">{project.description}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {project.teams.map((t) => (
              <Badge key={t.teamId} variant="secondary">{t.team.name}</Badge>
            ))}
          </div>
        </div>
        <ScoreBadge score={avgScore} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Links</CardTitle>
        </CardHeader>
        <CardContent>
          <UrlCards urls={project.urls} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Dimension Breakdown</CardTitle>
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
            <CardTitle>Team Members</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {project.assignments.map((a) => (
              <Link key={a.userId} href={`/people/${a.userId}`} className="flex items-center justify-between py-2 text-sm">
                <span className="text-foreground">{a.user.name}</span>
                <Badge variant={a.isPrimary ? "default" : "outline"} className="text-[10px]">
                  {a.isPrimary ? "Primary" : "Secondary"}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Deliverables</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {deliverables.slice(0, 8).map((d) => (
            <div key={d.id} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{d.title}</p>
                <Badge variant={d.status === "COMPLETED" ? "positive" : d.status === "BLOCKED" ? "critical" : "secondary"} className="text-[10px]">
                  {d.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{d.owners.map((o) => o.user.name).join(", ")}</p>
            </div>
          ))}
        </CardContent>
      </Card>

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
                  <p className="text-xs text-muted-foreground">{d.teams.map((t) => t.team.name).join(", ")} · {d.date.toLocaleDateString()}</p>
                </div>
                <Badge variant={d.status === "COMPLETED" ? "positive" : d.status === "CANCELLED" ? "critical" : "info"}>{d.status}</Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Evaluations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {evaluations.map((e) => (
              <Link key={e.id} href={`/people/${e.developerId}`} className="flex items-center justify-between px-5 py-3 hover:bg-surface-muted/60">
                <div>
                  <p className="text-sm font-medium text-foreground">{e.developer.name}</p>
                  <p className="text-xs text-muted-foreground">{e.demo.title} · {e.demo.date.toLocaleDateString()}</p>
                </div>
                <ScoreBadge score={e.score} />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
