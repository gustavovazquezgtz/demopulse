import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { UNSCOPED } from "@/lib/queries/dashboard";
import { listTeams } from "@/lib/queries/teams";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/dashboard/score-badge";

export default async function TeamsPage() {
  await requireSession();
  const scope = UNSCOPED; // every manager sees the full org (CEO parity), per explicit product decision
  const teams = await listTeams(scope);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Teams</h1>
        <p className="text-sm text-muted-foreground">{teams.length} teams</p>
      </div>

      {teams.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No teams in your scope yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <Link key={t.id} href={`/teams/${t.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle>{t.name}</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.managers.join(", ") || "No manager assigned"}</p>
                  </div>
                  <ScoreBadge score={t.avgScore} />
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-1">
                    {t.projects.map((p) => (
                      <Badge key={p} variant="secondary">{p}</Badge>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.memberCount}</p>
                      <p className="text-muted-foreground">Members</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.demoCount}</p>
                      <p className="text-muted-foreground">Demos</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{Math.round(t.attendanceRate)}%</p>
                      <p className="text-muted-foreground">Attendance</p>
                    </div>
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
