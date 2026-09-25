import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { UNSCOPED } from "@/lib/queries/dashboard";
import { getRanking } from "@/lib/queries/ranking";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScoreBadge, TrendIndicator } from "@/components/dashboard/score-badge";
import { SortableHeader } from "@/components/ui/sortable-header";
import { formatScore, cn } from "@/lib/utils";

const LOW_ENGLISH_THRESHOLD = 60; // same critical-tier cutoff ScoreBadge uses everywhere

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; english?: string }>;
}) {
  await requireSession();
  const { sort, dir, english } = await searchParams;
  const lowEnglishOnly = english === "low";
  const rows = await getRanking(UNSCOPED, { sort, dir, englishBelow: lowEnglishOnly ? LOW_ENGLISH_THRESHOLD : undefined });

  const filterHref = (params: URLSearchParams) => `/ranking${params.toString() ? `?${params.toString()}` : ""}`;
  const baseParams = new URLSearchParams();
  if (sort) baseParams.set("sort", sort);
  if (dir) baseParams.set("dir", dir);
  const allParams = new URLSearchParams(baseParams);
  const lowEnglishParams = new URLSearchParams(baseParams);
  lowEnglishParams.set("english", "low");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Engineer Ranking</h1>
          <p className="text-sm text-muted-foreground">
            Every engineer in the organization, ranked by score — a pattern-finding tool, not a scoreboard.
          </p>
        </div>
        <div className="flex gap-1 rounded-md bg-surface-muted p-1">
          <Link
            href={filterHref(allParams)}
            className={cn(
              "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
              !lowEnglishOnly ? "bg-surface shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            All Engineers
          </Link>
          <Link
            href={filterHref(lowEnglishParams)}
            className={cn(
              "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
              lowEnglishOnly ? "bg-surface shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Low English only
          </Link>
        </div>
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
                <TableHead><SortableHeader column="english" label="English" /></TableHead>
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
                  <TableCell className="text-xs">
                    <p className="text-muted-foreground">{r.managers.join(", ") || "—"}</p>
                    {r.previousManagers.length > 0 && (
                      <p className="text-[10px] text-muted-foreground/70">prev: {r.previousManagers.join(", ")}</p>
                    )}
                  </TableCell>
                  <TableCell><ScoreBadge score={r.score} /></TableCell>
                  <TableCell><TrendIndicator trend={r.trend} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.attendance !== null ? `${Math.round(r.attendance)}%` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatScore(r.ai)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatScore(r.ux)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatScore(r.business)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatScore(r.english)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.evaluationCount}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="py-12 text-center text-sm text-muted-foreground">
                    {lowEnglishOnly ? "Nobody has been marked below fluent in English yet." : "No evaluation data available yet."}
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
