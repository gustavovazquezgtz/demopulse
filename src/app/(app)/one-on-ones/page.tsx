import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { UNSCOPED } from "@/lib/queries/dashboard";
import { listOneOnOnes } from "@/lib/queries/one-on-ones";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Mic, MessageSquare } from "lucide-react";
import { FORMAT_OPTIONS, formatLabel } from "@/lib/one-on-ones/labels";

export default async function OneOnOnesPage({
  searchParams,
}: {
  searchParams: Promise<{ developerId?: string; managerId?: string; format?: string }>;
}) {
  await requireSession();
  const { developerId, managerId, format } = await searchParams;

  const [rows, developers, managers] = await Promise.all([
    listOneOnOnes(UNSCOPED, { developerId, managerId, format }),
    prisma.user.findMany({ where: { role: "DEVELOPER" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: { in: ["MANAGER", "CEO"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const filterHref = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    return `/one-on-ones${sp.toString() ? `?${sp.toString()}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">1:1s</h1>
          <p className="text-sm text-muted-foreground">A log of every manager check-in with the development team.</p>
        </div>
        <Button asChild>
          <Link href="/one-on-ones/new"><Plus className="h-4 w-4" /> Log a 1:1</Link>
        </Button>
      </div>

      {/* Server-rendered filter bar via links — consistent with the rest of the app's URL-param filtering */}
      <div className="flex flex-wrap gap-2">
        <FilterLink href={filterHref({ developerId, managerId, format: undefined })} active={!format} label="All Formats" />
        {FORMAT_OPTIONS.map((f) => (
          <FilterLink key={f} href={filterHref({ developerId, managerId, format: f })} active={format === f} label={formatLabel(f)} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <FilterLink href={filterHref({ managerId, format })} active={!developerId} label="Anyone" />
        {developers.map((d) => (
          <FilterLink key={d.id} href={filterHref({ developerId: d.id, managerId, format })} active={developerId === d.id} label={d.name} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <FilterLink href={filterHref({ developerId, format })} active={!managerId} label="Any Manager" />
        {managers.map((m) => (
          <FilterLink key={m.id} href={filterHref({ developerId, managerId: m.id, format })} active={managerId === m.id} label={m.name} />
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-foreground">No 1:1s logged yet</p>
              <p className="text-sm text-muted-foreground">Start with the first one above.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Person</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm text-foreground">{r.date.toLocaleString()}</TableCell>
                    <TableCell>
                      <Link href={`/people/${r.developer.id}`} className="text-sm font-medium text-foreground hover:underline">{r.developer.name}</Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.manager.name}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{formatLabel(r.format)}</Badge></TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{r.summary || "—"}</TableCell>
                    <TableCell>
                      <Link href={`/one-on-ones/${r.id}`} className="flex items-center justify-end gap-2 text-xs text-muted-foreground hover:text-foreground">
                        {r.recordingCount > 0 && <Mic className="h-3.5 w-3.5" />}
                        {r.noteCount > 0 && <MessageSquare className="h-3.5 w-3.5" />}
                        View →
                      </Link>
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

function FilterLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active ? "border-primary bg-primary-muted text-primary" : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
