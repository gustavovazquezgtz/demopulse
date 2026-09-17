import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function SettingsPage() {
  await requireSession();

  const [criteria, users, teams, projects] = await Promise.all([
    prisma.evaluationCriterion.findMany({ orderBy: { order: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.team.count(),
    prisma.project.count(),
  ]);

  const aiProvider = process.env.OPENAI_API_KEY ? "OpenAI (configured)" : "Rule-based (default, no API key configured)";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Evaluation criteria, users, and AI configuration.</p>
      </div>

      <Tabs defaultValue="criteria">
        <TabsList>
          <TabsTrigger value="criteria">Evaluation Criteria</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="ai">AI Configuration</TabsTrigger>
          <TabsTrigger value="org">Organization</TabsTrigger>
        </TabsList>

        <TabsContent value="criteria">
          <Card>
            <CardHeader>
              <CardTitle>Official Evaluation Questions</CardTitle>
              <CardDescription>
                Stored as configurable criteria (EvaluationCriterion table) — not hardcoded. New criteria can be added without a schema change.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Dimension</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criteria.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs text-muted-foreground">{c.order}</TableCell>
                      <TableCell className="max-w-md text-sm text-foreground">{c.text}</TableCell>
                      <TableCell><Badge variant="secondary">{c.dimension}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.weight}</TableCell>
                      <TableCell><Badge variant={c.active ? "positive" : "outline"}>{c.active ? "Active" : "Inactive"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Users &amp; Roles</CardTitle>
              <CardDescription>Managers and CEO can authenticate; developers are evaluated but do not log in.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="text-sm font-medium text-foreground">{u.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell><Badge variant={u.role === "CEO" ? "info" : u.role === "MANAGER" ? "default" : "secondary"}>{u.role}</Badge></TableCell>
                      <TableCell><Badge variant={u.active ? "positive" : "critical"}>{u.active ? "Active" : "Inactive"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>AI Provider</CardTitle>
                <CardDescription>Swappable via the AIProvider interface — no UI/business logic coupling.</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="info">{aiProvider}</Badge>
                <p className="mt-3 text-sm text-muted-foreground">
                  Set <code className="rounded bg-surface-muted px-1 py-0.5">OPENAI_API_KEY</code> to switch to the OpenAI-backed provider.
                  The rule-based provider requires no configuration and never calls an external service.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Safety Rules</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                <p>• Never makes employment or termination recommendations</p>
                <p>• Never infers protected characteristics or personality</p>
                <p>• Every insight traces to evaluation data, comments, or manager opinions</p>
                <p>• Risk items are framed as opportunities, not judgments</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="org">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Users" value={users.length} />
            <Stat label="Teams" value={teams} />
            <Stat label="Projects" value={projects} />
            <Stat label="Evaluation Criteria" value={criteria.length} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
