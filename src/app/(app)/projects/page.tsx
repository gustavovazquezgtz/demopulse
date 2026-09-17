import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { UNSCOPED } from "@/lib/queries/dashboard";
import { listProjects } from "@/lib/queries/projects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/dashboard/score-badge";

const STATUS_VARIANT: Record<string, "positive" | "warning" | "secondary" | "critical"> = {
  ACTIVE: "positive",
  ON_HOLD: "warning",
  COMPLETED: "secondary",
  CANCELLED: "critical",
};

export default async function ProjectsPage() {
  await requireSession();
  const scope = UNSCOPED; // every manager sees the full org (CEO parity), per explicit product decision
  const projects = await listProjects(scope);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Projects</h1>
        <p className="text-sm text-muted-foreground">{projects.length} projects</p>
      </div>

      {projects.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No projects in your scope yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle>{p.name}</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.client}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>{p.status.replace("_", " ")}</Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-1">
                    {p.teams.map((t) => (
                      <Badge key={t} variant="secondary">{t}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{p.memberCount} people · {p.demoCount} demos</span>
                    <ScoreBadge score={p.avgScore} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
