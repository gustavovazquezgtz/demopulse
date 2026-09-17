import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { UNSCOPED } from "@/lib/queries/dashboard";
import { listTeams } from "@/lib/queries/teams";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScoreBadge } from "@/components/dashboard/score-badge";
import { SortableHeader } from "@/components/ui/sortable-header";

export default async function TeamsPage({ searchParams }: { searchParams: Promise<{ sort?: string; dir?: string }> }) {
  await requireSession();
  const { sort, dir } = await searchParams;
  const teams = await listTeams(UNSCOPED, { sort, dir });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Teams / Projects</h1>
        <p className="text-sm text-muted-foreground">{teams.length} teams across the organization.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {teams.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No teams yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortableHeader column="name" label="Team / Project" defaultDir="asc" /></TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead><SortableHeader column="memberCount" label="Engineers" /></TableHead>
                  <TableHead><SortableHeader column="avgScore" label="Score" /></TableHead>
                  <TableHead><SortableHeader column="evaluationCount" label="Evaluations" /></TableHead>
                  <TableHead><SortableHeader column="attendanceRate" label="Attendance" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link href={`/teams/${t.id}`} className="text-sm font-medium text-foreground hover:underline">
                        {t.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.managers.join(", ") || "No manager assigned"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.memberCount}</TableCell>
                    <TableCell><ScoreBadge score={t.avgScore} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.evaluationCount === 0 ? <span className="text-xs italic">No data yet</span> : t.evaluationCount}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.evaluationCount === 0 ? "—" : `${Math.round(t.attendanceRate)}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
