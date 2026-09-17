import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { UNSCOPED, getTeamComparison } from "@/lib/queries/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TeamComparisonChart } from "@/components/charts/team-comparison-chart";
import { ScoreBadge } from "@/components/dashboard/score-badge";

export default async function TeamComparisonPage() {
  await requireSession();
  const scope = UNSCOPED; // every manager sees the full org (CEO parity), per explicit product decision
  const teams = await getTeamComparison(scope);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Team Comparison</h1>
        <p className="text-sm text-muted-foreground">Compare delivery, UX, AI adoption, and business understanding across teams.</p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <TeamComparisonChart data={teams.map((t) => ({ name: t.name, score: t.score }))} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>UX</TableHead>
                <TableHead>AI</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Evaluations</TableHead>
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
                  <TableCell><ScoreBadge score={t.score} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.delivery}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.ux}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.ai}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.business}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.evaluationCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
