import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/permissions";
import { getAllScoreCutoffs } from "@/lib/queries/score-cutoff";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScoreBadge } from "@/components/dashboard/score-badge";

export default async function ScoreCutoffReportPage() {
  await requireSession();
  const rows = await getAllScoreCutoffs();
  const cutoffDate = rows[0]?.cutoffDate;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/reports" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to Reports
        </Link>
        <h1 className="text-xl font-semibold text-foreground">Score Cutoff Report</h1>
        <p className="text-sm text-muted-foreground">
          {cutoffDate
            ? `Every engineer's score as of ${cutoffDate.toLocaleDateString()}, under the old (yes/no) evaluation criteria — frozen permanently.`
            : "No cutoff snapshot has been generated yet."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Legacy Scores (Frozen)</CardTitle>
          <CardDescription>
            From this point forward, new evaluations use a 1-5 scale with configurable weights (Settings → Evaluation Criteria).
            These numbers never change, regardless of future weight or methodology edits.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No snapshot recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Engineer</TableHead>
                  <TableHead>Score (through cutoff)</TableHead>
                  <TableHead>Evaluations counted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.userId}>
                    <TableCell>
                      <Link href={`/people/${r.userId}`} className="text-sm font-medium text-foreground hover:underline">{r.name}</Link>
                    </TableCell>
                    <TableCell><ScoreBadge score={r.legacyScore} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.evaluationCount}</TableCell>
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
