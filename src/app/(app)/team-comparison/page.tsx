import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { UNSCOPED, getTeamComparison } from "@/lib/queries/dashboard";
import { sortRows } from "@/lib/sort";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TeamComparisonChart } from "@/components/charts/team-comparison-chart";
import { ScoreBadge } from "@/components/dashboard/score-badge";
import { SortableHeader } from "@/components/ui/sortable-header";

export default async function TeamComparisonPage({ searchParams }: { searchParams: Promise<{ sort?: string; dir?: string }> }) {
  await requireSession();
  const { sort, dir } = await searchParams;
  const scope = UNSCOPED; // every manager sees the full org (CEO parity), per explicit product decision
  const unsorted = await getTeamComparison(scope);
  const teams = sortRows(unsorted, sort, dir, "score", "desc");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Team Comparison</h1>
        <p className="text-sm text-muted-foreground">Compare delivery, UX, AI adoption, and business understanding across teams.</p>
      </div>

      <Card>
        <CardContent className="pt-4">
          {teams.every((t) => t.evaluationCount === 0) ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No evaluation data available yet.</p>
          ) : (
            <TeamComparisonChart data={teams.map((t) => ({ name: t.name, score: t.score }))} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead><SortableHeader column="name" label="Team / Project" defaultDir="asc" /></TableHead>
                <TableHead>Manager</TableHead>
                <TableHead><SortableHeader column="score" label="Score" /></TableHead>
                <TableHead><SortableHeader column="engineerCount" label="Engineers" /></TableHead>
                <TableHead><SortableHeader column="delivery" label="Delivery" /></TableHead>
                <TableHead><SortableHeader column="ux" label="UX" /></TableHead>
                <TableHead><SortableHeader column="ai" label="AI" /></TableHead>
                <TableHead><SortableHeader column="business" label="Business" /></TableHead>
                <TableHead><SortableHeader column="evaluationCount" label="Evaluations" /></TableHead>
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
                  <TableCell className="text-xs text-muted-foreground">{t.managers.join(", ") || "—"}</TableCell>
                  <TableCell><ScoreBadge score={t.score} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.engineerCount}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.delivery}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.ux}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.ai}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.business}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.evaluationCount === 0 ? <span className="text-xs italic">No data yet</span> : t.evaluationCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
