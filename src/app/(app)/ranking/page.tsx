import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { UNSCOPED } from "@/lib/queries/dashboard";
import { getRanking } from "@/lib/queries/ranking";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScoreBadge, TrendIndicator } from "@/components/dashboard/score-badge";
import { SortableHeader } from "@/components/ui/sortable-header";
import { formatScore } from "@/lib/utils";

export default async function RankingPage({ searchParams }: { searchParams: Promise<{ sort?: string; dir?: string }> }) {
  await requireSession();
  const { sort, dir } = await searchParams;
  const rows = await getRanking(UNSCOPED, { sort, dir });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Engineer Ranking</h1>
        <p className="text-sm text-muted-foreground">
          Every engineer in the organization, ranked by score — a pattern-finding tool, not a scoreboard.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead><SortableHeader column="name" label="Engineer" defaultDir="asc" /></TableHead>
                <TableHead>Team / Project</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead><SortableHeader column="score" label="Score" /></TableHead>
                <TableHead>Trend</TableHead>
                <TableHead><SortableHeader column="attendance" label="Attendance" /></TableHead>
                <TableHead><SortableHeader column="ai" label="AI" /></TableHead>
                <TableHead><SortableHeader column="ux" label="UX" /></TableHead>
                <TableHead><SortableHeader column="business" label="Business" /></TableHead>
                <TableHead><SortableHeader column="evaluationCount" label="Evaluations" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
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
                  <TableCell className="text-xs text-muted-foreground">{r.attendance !== null ? `${Math.round(r.attendance)}%` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatScore(r.ai)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatScore(r.ux)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatScore(r.business)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.evaluationCount}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="py-12 text-center text-sm text-muted-foreground">
                    No evaluation data available yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
