import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/permissions";
import { UNSCOPED } from "@/lib/queries/dashboard";
import { getProspectAnalytics } from "@/lib/queries/employee-bank";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { enumLabel } from "@/lib/employee-bank/labels";

export default async function EmployeeBankAnalyticsPage() {
  await requireSession();
  const stats = await getProspectAnalytics(UNSCOPED);

  const funnelSteps = [
    { label: "Prospected", value: stats.funnel.prospected },
    { label: "Submitted", value: stats.funnel.submitted },
    { label: "Interviewed", value: stats.funnel.interviewed },
    { label: "Accepted", value: stats.funnel.accepted },
  ];
  const maxFunnel = Math.max(1, ...funnelSteps.map((s) => s.value));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/employee-bank" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to Employee Bank
        </Link>
        <h1 className="text-xl font-semibold text-foreground">Prospect Analytics</h1>
        <p className="text-sm text-muted-foreground">Why are we failing (or succeeding) to place people?</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Employees in Bank", value: stats.employeesInBank },
          { label: "Currently Prospected", value: stats.employeesProspected },
          { label: "Without Prospects", value: stats.employeesWithoutProspects },
          { label: "Interviews Scheduled", value: stats.interviewsScheduled },
          { label: "Accepted This Month", value: stats.acceptedThisMonth },
          { label: "Rejected This Month", value: stats.rejectedThisMonth },
          { label: "Conversion Rate", value: `${Math.round(stats.conversionRate)}%` },
          { label: "Avg. Days to Placement", value: stats.avgDaysToPlacement ? Math.round(stats.avgDaysToPlacement) : "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prospect Funnel</CardTitle>
          <CardDescription>Every prospect ever created, by how far it got</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {funnelSteps.map((step) => (
            <div key={step.label} className="flex items-center gap-3">
              <span className="w-24 text-xs text-muted-foreground">{step.label}</span>
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-surface-muted">
                <div
                  className="h-full rounded-md bg-primary transition-all"
                  style={{ width: `${(step.value / maxFunnel) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right text-sm font-semibold text-foreground">{step.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prospect Failure Reasons</CardTitle>
          <CardDescription>Why Rejected/Withdrawn/Cancelled prospects didn&apos;t materialize</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {stats.failureReasons.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No failed prospects recorded yet.</p>
          ) : (
            stats.failureReasons.map((r) => (
              <div key={r.reason} className="flex items-center gap-3">
                <span className="w-40 text-xs text-muted-foreground">{enumLabel(r.reason)}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-md bg-surface-muted">
                  <div className="h-full rounded-md bg-critical" style={{ width: `${r.pct}%` }} />
                </div>
                <span className="w-16 text-right text-xs text-muted-foreground">{Math.round(r.pct)}% ({r.count})</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
