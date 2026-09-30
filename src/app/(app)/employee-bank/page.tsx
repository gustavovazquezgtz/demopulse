import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { UNSCOPED } from "@/lib/queries/dashboard";
import { getEmployeeBankRows, getSavedViews, getProspectAnalytics } from "@/lib/queries/employee-bank";
import { prisma } from "@/lib/prisma";
import { EmployeeBankTable } from "@/components/employee-bank/employee-bank-table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";

export default async function EmployeeBankPage() {
  await requireSession();
  const scope = UNSCOPED; // every manager sees the full org, per the standing product decision

  const [rows, savedViews, stats, teams, projects, managers] = await Promise.all([
    getEmployeeBankRows(scope),
    getSavedViews(),
    getProspectAnalytics(scope),
    prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: { in: ["MANAGER", "CEO"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const stat = (label: string, value: number | string) => (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Employee Bank</h1>
          <p className="text-sm text-muted-foreground">
            Who&apos;s available, who&apos;s being placed, who owns it, and what happened last time.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/employee-bank/analytics"><BarChart3 className="h-4 w-4" /> Analytics</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stat("Employees", stats.employeesInBank)}
        {stat("Currently Prospected", stats.employeesProspected)}
        {stat("Without Prospects", stats.employeesWithoutProspects)}
        {stat("Interviews Scheduled", stats.interviewsScheduled)}
      </div>

      <Card>
        <CardContent className="p-4">
          <EmployeeBankTable
            rows={rows}
            allTeams={teams}
            allProjects={projects}
            allManagers={managers}
            savedViews={savedViews}
          />
        </CardContent>
      </Card>
    </div>
  );
}
