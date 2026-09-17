import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { UNSCOPED } from "@/lib/queries/dashboard";
import { getRanking } from "@/lib/queries/ranking";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScoreBadge, TrendIndicator } from "@/components/dashboard/score-badge";
import { formatScore } from "@/lib/utils";

export default async function RankingPage() {
  await requireSession();
  const scope = UNSCOPED; // every manager sees the full org (CEO parity), per explicit product decision
  const rows = await getRanking(scope);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Ranking</h1>
        <p className="text-sm text-muted-foreground">
          A pattern-finding tool, not a scoreboard — use it to spot trends, not to drive competition.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Trend</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>AI</TableHead>
                <TableHead>UX</TableHead>
                <TableHead>Business</TableHead>
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
                  <TableCell className="text-xs text-muted-foreground">{r.projects.join(", ")}</TableCell>
                  <TableCell><ScoreBadge score={r.score} /></TableCell>
                  <TableCell><TrendIndicator trend={r.trend} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.attendance !== null ? `${Math.round(r.attendance)}%` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatScore(r.ai)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatScore(r.ux)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatScore(r.business)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
