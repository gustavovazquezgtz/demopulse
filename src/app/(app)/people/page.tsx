import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { UNSCOPED } from "@/lib/queries/dashboard";
import { listPeople } from "@/lib/queries/people";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScoreBadge, TrendIndicator } from "@/components/dashboard/score-badge";
import { SortableHeader } from "@/components/ui/sortable-header";
import { initials } from "@/lib/utils";

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string }> }) {
  await requireSession();
  const { q, page, sort, dir } = await searchParams;
  const scope = UNSCOPED; // every manager sees the full org (CEO parity), per explicit product decision
  const { rows, total, pageSize } = await listPeople(scope, { q, page: page ? Number(page) : 1, sort, dir });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">People</h1>
          <p className="text-sm text-muted-foreground">{total} people across the organization</p>
        </div>
        <form className="w-64">
          <Input name="q" defaultValue={q} placeholder="Search people..." />
        </form>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-foreground">No people found</p>
              <p className="text-sm text-muted-foreground">Try a different search term.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortableHeader column="name" label="Person" defaultDir="asc" /></TableHead>
                  <TableHead>Team / Project</TableHead>
                  <TableHead><SortableHeader column="currentScore" label="Score" /></TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead><SortableHeader column="evaluationCount" label="Evidence" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/people/${p.id}`} className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{initials(p.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.title ?? "Developer"}</p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.teams.map((t) => (
                          <Badge key={t} variant="secondary">{t}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ScoreBadge score={p.currentScore} />
                    </TableCell>
                    <TableCell>
                      <TrendIndicator trend={p.trend} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.evaluationCount} eval{p.evaluationCount === 1 ? "" : "s"} · {p.confidence}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {total > pageSize && (
        <p className="text-center text-xs text-muted-foreground">
          Showing {rows.length} of {total}
        </p>
      )}
    </div>
  );
}
