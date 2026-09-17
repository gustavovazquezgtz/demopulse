import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { getPendingEvaluations } from "@/lib/queries/dashboard";
import { listAllEvaluations, getEvaluationFilterOptions } from "@/lib/queries/evaluations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScoreBadge } from "@/components/dashboard/score-badge";
import { SortableHeader } from "@/components/ui/sortable-header";

interface SearchParams {
  q?: string;
  teamId?: string;
  evaluatorId?: string;
  developerId?: string;
  demoId?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  dir?: string;
}

const selectClass =
  "h-9 rounded-md border border-border bg-surface px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

export default async function EvaluationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();
  const filters = await searchParams;
  const [pending, evaluations, filterOptions] = await Promise.all([
    getPendingEvaluations(session.user.id),
    listAllEvaluations(filters),
    getEvaluationFilterOptions(),
  ]);

  const hasActiveFilters = Boolean(
    filters.q || filters.teamId || filters.evaluatorId || filters.developerId || filters.demoId || filters.dateFrom || filters.dateTo
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Evaluations</h1>
        <p className="text-sm text-muted-foreground">Your evaluation queue, and every evaluation in the organization.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No evaluations pending — you&apos;re all caught up.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {pending.map((p) => (
                <div key={p.demoId} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.demoTitle}</p>
                    <p className="text-xs text-muted-foreground">{p.projectName} · {p.date.toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="warning">{p.pendingCount}/{p.totalAttendees} pending</Badge>
                    <Button asChild size="sm">
                      <Link href={`/demos/${p.demoId}/evaluate`}>Evaluate</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Evaluations (Organization-wide)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form className="flex flex-wrap items-end gap-2" method="get">
            <input type="hidden" name="sort" value={filters.sort ?? ""} />
            <input type="hidden" name="dir" value={filters.dir ?? ""} />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Search</label>
              <Input name="q" defaultValue={filters.q} placeholder="Engineer, manager, session..." className="w-48" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Team</label>
              <select name="teamId" defaultValue={filters.teamId ?? ""} className={selectClass}>
                <option value="">All teams</option>
                {filterOptions.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Manager</label>
              <select name="evaluatorId" defaultValue={filters.evaluatorId ?? ""} className={selectClass}>
                <option value="">All managers</option>
                {filterOptions.managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Engineer</label>
              <select name="developerId" defaultValue={filters.developerId ?? ""} className={selectClass}>
                <option value="">All engineers</option>
                {filterOptions.developers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Session</label>
              <select name="demoId" defaultValue={filters.demoId ?? ""} className={selectClass}>
                <option value="">All sessions</option>
                {filterOptions.demos.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" name="dateFrom" defaultValue={filters.dateFrom} className="w-36" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" name="dateTo" defaultValue={filters.dateTo} className="w-36" />
            </div>
            <Button type="submit" size="sm">Apply</Button>
            {hasActiveFilters && (
              <Button asChild type="button" variant="ghost" size="sm">
                <Link href="/evaluations">Clear</Link>
              </Button>
            )}
          </form>

          {evaluations.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {hasActiveFilters ? "No evaluations match these filters." : "No evaluations completed yet."}
            </p>
          ) : (
            <div className="-mx-6 border-t border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><SortableHeader column="engineerName" label="Engineer" defaultDir="asc" /></TableHead>
                    <TableHead><SortableHeader column="evaluatorName" label="Evaluated By" defaultDir="asc" /></TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead><SortableHeader column="session" label="Session" defaultDir="asc" /></TableHead>
                    <TableHead><SortableHeader column="date" label="Date" /></TableHead>
                    <TableHead><SortableHeader column="score" label="Score" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluations.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Link href={`/people/${e.engineerId}`} className="text-sm font-medium text-foreground hover:underline">
                          {e.engineerName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.evaluatorName}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {e.teams.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/demos/${e.demoId}/results`} className="text-sm text-muted-foreground hover:underline">
                          {e.session}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.date.toLocaleDateString()}</TableCell>
                      <TableCell><ScoreBadge score={e.score} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
