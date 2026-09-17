import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { getManagerComparison } from "@/lib/queries/evaluations";
import { sortRows } from "@/lib/sort";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScoreBadge } from "@/components/dashboard/score-badge";
import { SortableHeader } from "@/components/ui/sortable-header";
import { formatScore } from "@/lib/utils";

export default async function ManagerComparisonPage({ searchParams }: { searchParams: Promise<{ sort?: string; dir?: string }> }) {
  await requireSession();
  const { sort, dir } = await searchParams;
  const { managers, rows: unsorted } = await getManagerComparison();

  // Sorting by a specific manager's column needs a flat key — expose
  // byManager.<id> as a top-level field just for sorting purposes.
  const flat = unsorted.map((r) => {
    const flatManagerScores: Record<string, number | null> = {};
    for (const m of managers) flatManagerScores[`mgr_${m.id}`] = r.byManager[m.id];
    return { ...r, ...flatManagerScores };
  });
  const rows = sortRows(flat, sort, dir, "overall", "desc");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Manager Comparison</h1>
        <p className="text-sm text-muted-foreground">
          Who evaluated whom, and what score each manager gave — built directly from every completed evaluation.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 || managers.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No evaluation data available yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortableHeader column="name" label="Engineer" defaultDir="asc" /></TableHead>
                  {managers.map((m) => (
                    <TableHead key={m.id} className="text-right">
                      <SortableHeader column={`mgr_${m.id}`} label={m.name} align="right" />
                    </TableHead>
                  ))}
                  <TableHead className="text-right"><SortableHeader column="overall" label="Average" align="right" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/people/${r.id}`} className="text-sm font-medium text-foreground hover:underline">
                        {r.name}
                      </Link>
                    </TableCell>
                    {managers.map((m) => (
                      <TableCell key={m.id} className="text-right text-sm text-muted-foreground">
                        {r.byManager[m.id] !== null ? formatScore(r.byManager[m.id]) : "—"}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      {r.evaluationCount > 0 ? <ScoreBadge score={r.overall} /> : <span className="text-xs text-muted-foreground italic">No data</span>}
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
