import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { UNSCOPED, getOrgStats } from "@/lib/queries/dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileBarChart, Users, UsersRound, Video, Building2 } from "lucide-react";

export default async function ReportsPage() {
  await requireSession();
  const stats = await getOrgStats(UNSCOPED);

  const reports = [
    { title: "Individual Performance Report", description: "Score history, dimension breakdown, manager opinions for one person.", icon: Users, href: "/people" },
    { title: "Team / Project Report", description: "Team score, coverage, attendance, deliverables, and dimension trends.", icon: UsersRound, href: "/teams" },
    { title: "Demo Report", description: "Per-demo results, consensus, and AI highlights.", icon: Video, href: "/demos" },
    { title: "Organization Report", description: "Organization-wide performance, ranking, and question analysis.", icon: Building2, href: "/dashboard" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Drill into any report below. PDF/export is on the roadmap — the data layer already supports it.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MiniStat label="Avg Score" value={Math.round(stats.avgScore)} />
        <MiniStat label="Attendance" value={`${Math.round(stats.attendanceRate)}%`} />
        <MiniStat label="Coverage" value={`${Math.round(stats.evaluationCoverage)}%`} />
        <MiniStat label="Needing Attention" value={stats.peopleRequiringAttention} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((r) => (
          <Card key={r.title}>
            <CardHeader className="flex-row items-start gap-3 space-y-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-muted text-primary">
                <r.icon className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>{r.title}</CardTitle>
                <CardDescription>{r.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href={r.href}>
                  <FileBarChart className="h-3.5 w-3.5" /> Open
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
