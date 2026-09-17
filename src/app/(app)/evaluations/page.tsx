import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { getPendingEvaluations } from "@/lib/queries/dashboard";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/dashboard/score-badge";

export default async function EvaluationsPage() {
  const session = await requireSession();
  const pending = await getPendingEvaluations(session.user.id);
  const completed = await prisma.evaluation.findMany({
    where: { evaluatorId: session.user.id, status: "COMPLETED" },
    include: { developer: true, demo: true },
    orderBy: { updatedAt: "desc" },
    take: 15,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Evaluations</h1>
        <p className="text-sm text-muted-foreground">Your evaluation queue and recent history.</p>
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
          <CardTitle>Recently Completed</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {completed.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No evaluations completed yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {completed.map((e) => (
                <Link key={e.id} href={`/demos/${e.demoId}/results`} className="flex items-center justify-between px-5 py-3 hover:bg-surface-muted/60">
                  <div>
                    <p className="text-sm font-medium text-foreground">{e.developer.name}</p>
                    <p className="text-xs text-muted-foreground">{e.demo.title}</p>
                  </div>
                  <ScoreBadge score={e.score} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
