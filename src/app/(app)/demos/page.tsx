import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { UNSCOPED } from "@/lib/queries/dashboard";
import { listDemos } from "@/lib/queries/demos";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "positive" | "warning" | "secondary" | "critical" | "info"> = {
  SCHEDULED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "positive",
  CANCELLED: "critical",
};

export default async function DemosPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireSession();
  const { status } = await searchParams;
  const scope = UNSCOPED; // every manager sees the full org (CEO parity), per explicit product decision
  const demos = await listDemos(scope, { status });

  const tabs = [
    { label: "All", value: undefined },
    { label: "Scheduled", value: "SCHEDULED" },
    { label: "Completed", value: "COMPLETED" },
    { label: "Cancelled", value: "CANCELLED" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Demos</h1>
          <p className="text-sm text-muted-foreground">{demos.length} demos</p>
        </div>
        <Button asChild>
          <Link href="/demos/new">Create Demo</Link>
        </Button>
      </div>

      <div className="flex gap-1 rounded-md bg-surface-muted p-1 w-fit">
        {tabs.map((t) => (
          <Link
            key={t.label}
            href={t.value ? `/demos?status=${t.value}` : "/demos"}
            className={cn(
              "rounded-sm px-3 py-1 text-sm font-medium transition-colors",
              (status ?? undefined) === t.value ? "bg-surface shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {demos.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-foreground">No demos yet</p>
              <Button asChild variant="link" size="sm">
                <Link href="/demos/new">Create Demo</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Demo</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demos.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Link href={`/demos/${d.id}`} className="font-medium text-foreground hover:underline">
                        {d.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.projects.map((p) => p.project.name).join(", ") || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.teams.map((t) => t.team.name).join(", ")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.hostManager.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.date.toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[d.status]}>{d.status.replace("_", " ")}</Badge>
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
