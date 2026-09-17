import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { UNSCOPED } from "@/lib/queries/dashboard";
import { listAlerts } from "@/lib/queries/ai-feeds";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertActions } from "@/components/insights/alert-actions";
import { AlertTriangle } from "lucide-react";

const SEVERITY_VARIANT: Record<string, "critical" | "warning" | "secondary" | "info"> = {
  HIGH: "critical",
  MEDIUM: "warning",
  LOW: "secondary",
  INFORMATIONAL: "info",
};

export default async function AlertsPage() {
  await requireSession();
  const scope = UNSCOPED; // every manager sees the full org (CEO parity), per explicit product decision
  const alerts = await listAlerts(scope);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">AI Alerts</h1>
        <p className="text-sm text-muted-foreground">Performance, delivery, attendance, and trend signals surfaced automatically.</p>
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-positive-muted text-positive">✓</div>
          <p className="text-sm font-medium text-foreground">No active risk signals</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {alerts.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-start justify-between gap-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-critical-muted text-critical">
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={SEVERITY_VARIANT[a.severity]}>{a.severity}</Badge>
                      <Badge variant="outline">{a.type.replace(/_/g, " ")}</Badge>
                      {a.subjectType === "PERSON" ? (
                        <Link href={`/people/${a.subjectId}`} className="text-xs font-medium text-primary hover:underline">
                          {a.subjectName}
                        </Link>
                      ) : (
                        <Link href={`/teams/${a.subjectId}`} className="text-xs font-medium text-primary hover:underline">
                          {a.subjectName}
                        </Link>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-foreground">{a.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{a.description}</p>
                  </div>
                </div>
                <AlertActions id={a.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
