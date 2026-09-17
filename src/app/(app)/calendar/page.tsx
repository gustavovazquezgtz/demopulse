import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { UNSCOPED } from "@/lib/queries/dashboard";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<string, string> = {
  SCHEDULED: "bg-info",
  IN_PROGRESS: "bg-warning",
  COMPLETED: "bg-positive",
  CANCELLED: "bg-critical",
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  await requireSession();
  const { y, m } = await searchParams;
  const now = new Date();
  const year = y ? Number(y) : now.getFullYear();
  const month = m ? Number(m) : now.getMonth(); // 0-indexed

  const scope = UNSCOPED; // every manager sees the full org (CEO parity), per explicit product decision

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);
  const demos = await prisma.demo.findMany({
    where: {
      date: { gte: monthStart, lt: monthEnd },
      ...(scope.teamIds ? { teams: { some: { teamId: { in: scope.teamIds } } } } : {}),
    },
    include: { projects: { include: { project: true } } },
    orderBy: { date: "asc" },
  });

  const demosByDay = new Map<number, typeof demos>();
  for (const d of demos) {
    const day = d.date.getDate();
    const list = demosByDay.get(day) ?? [];
    list.push(d);
    demosByDay.set(day, list);
  }

  const firstWeekday = monthStart.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const next = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground">{monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon">
            <Link href={`/calendar?y=${prev.y}&m=${prev.m}`}><ChevronLeft className="h-4 w-4" /></Link>
          </Button>
          <Button asChild variant="outline" size="icon">
            <Link href={`/calendar?y=${next.y}&m=${next.m}`}><ChevronRight className="h-4 w-4" /></Link>
          </Button>
          <Button asChild>
            <Link href="/demos/new">Create Demo</Link>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-surface-muted text-center text-xs font-medium text-muted-foreground">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => (
            <div
              key={i}
              className={cn(
                "min-h-[96px] border-b border-r border-border p-1.5 last:border-r-0",
                i % 7 === 6 && "border-r-0",
                day === now.getDate() && month === now.getMonth() && year === now.getFullYear() && "bg-primary-muted/40"
              )}
            >
              {day && (
                <>
                  <p className="mb-1 text-xs text-muted-foreground">{day}</p>
                  <div className="flex flex-col gap-1">
                    {(demosByDay.get(day) ?? []).slice(0, 3).map((d) => (
                      <Link
                        key={d.id}
                        href={`/demos/${d.id}`}
                        className="flex items-center gap-1 truncate rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-neutral-muted"
                      >
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[d.status])} />
                        <span className="truncate">{d.title}</span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {Object.entries(STATUS_DOT).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", color)} /> {status.replace("_", " ")}
          </span>
        ))}
        <Badge variant="outline" className="ml-auto">
          <Link href="/demos">Agenda view →</Link>
        </Badge>
      </div>
    </div>
  );
}
