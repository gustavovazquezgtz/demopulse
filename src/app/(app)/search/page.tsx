import Link from "next/link";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/dashboard/score-badge";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireSession();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  if (!query) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Enter a search term to get started.</p>;
  }

  const [people, teams, projects, demos] = await Promise.all([
    prisma.user.findMany({
      where: { name: { contains: query, mode: "insensitive" }, role: "DEVELOPER" },
      include: { evaluationsReceived: { where: { status: "COMPLETED" }, select: { score: true } } },
      take: 10,
    }),
    prisma.team.findMany({ where: { name: { contains: query, mode: "insensitive" } }, take: 10 }),
    prisma.project.findMany({ where: { name: { contains: query, mode: "insensitive" } }, take: 10 }),
    prisma.demo.findMany({
      where: { title: { contains: query, mode: "insensitive" } },
      include: { projects: { include: { project: true } } },
      take: 10,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Search results for &ldquo;{query}&rdquo;</h1>
      </div>

      {people.length === 0 && teams.length === 0 && projects.length === 0 && demos.length === 0 && (
        <p className="py-16 text-center text-sm text-muted-foreground">No results found.</p>
      )}

      {people.length > 0 && (
        <Card>
          <CardHeader><CardTitle>People</CardTitle></CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {people.map((p) => {
              const avg = p.evaluationsReceived.length
                ? p.evaluationsReceived.reduce((s, e) => s + (e.score ?? 0), 0) / p.evaluationsReceived.length
                : null;
              return (
                <Link key={p.id} href={`/people/${p.id}`} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.title}</p>
                  </div>
                  <ScoreBadge score={avg} />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}

      {teams.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Teams</CardTitle></CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {teams.map((t) => (
              <Link key={t.id} href={`/teams/${t.id}`} className="py-2.5 text-sm font-medium text-foreground">{t.name}</Link>
            ))}
          </CardContent>
        </Card>
      )}

      {projects.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Projects</CardTitle></CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-medium text-foreground">{p.name}</span>
                <Badge variant="secondary">{p.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {demos.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Demos</CardTitle></CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {demos.map((d) => (
              <Link key={d.id} href={`/demos/${d.id}`} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{d.projects.map((p) => p.project.name).join(", ") || "—"}</p>
                </div>
                <Badge variant="outline">{d.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
