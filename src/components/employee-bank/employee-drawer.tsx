"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScoreBadge, TrendIndicator } from "@/components/dashboard/score-badge";
import { GroupBadge } from "./group-badge";
import { CreateProspectDialog } from "./create-prospect-dialog";
import { AssignOperationsForm } from "./assign-operations-form";
import { OffboardingStatusForm } from "./offboarding-status-form";
import { TeamBadge } from "@/components/shared/team-badge";
import { fetchEmployeeBankProfile } from "@/lib/actions/employee-bank";
import { enumLabel, statusTone, interviewResultTone } from "@/lib/employee-bank/labels";

type Profile = Awaited<ReturnType<typeof fetchEmployeeBankProfile>>;

export function EmployeeDrawer({
  userId,
  allManagers,
  onClose,
}: {
  userId: string;
  allManagers: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const loading = !profile || profile.id !== userId;

  useEffect(() => {
    let active = true;
    fetchEmployeeBankProfile(userId).then((p) => {
      if (active) setProfile(p);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {loading || !profile ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <SheetTitle>{profile.name}</SheetTitle>
                  <SheetDescription>{profile.title ?? "Developer"}</SheetDescription>
                </div>
                <Link href={`/people/${profile.id}`} className="text-xs font-medium text-primary hover:underline">
                  Full profile →
                </Link>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <ScoreBadge score={profile.score} />
                <TrendIndicator trend={profile.trend} delta={profile.trendDelta} />
                <GroupBadge group={profile.group} />
                {profile.groupDiffers && <Badge variant="warning" className="text-[10px]">Differs from suggested</Badge>}
              </div>
            </SheetHeader>

            <SheetBody>
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="prospects">Prospects ({profile.activeProspects.length})</TabsTrigger>
                  <TabsTrigger value="performance">Performance</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="flex flex-col gap-3 pt-3 text-sm">
                  <Row label="Rating" value={profile.rating !== null ? String(profile.rating) : "—"} custom={
                    profile.rating !== null ? (
                      <span className="text-right font-medium text-foreground" title="Taken from this employee's demo evaluation score — not manually captured.">
                        {profile.rating}
                      </span>
                    ) : undefined
                  } />
                  <Row label="Suggested Group" value={profile.suggestedGroup ?? "—"} />
                  {profile.groupOverrideNote && <Row label="Override Reason" value={profile.groupOverrideNote} />}
                  <Row label="Availability" value={enumLabel(profile.availability)} />
                  <Row label="Current Team" custom={
                    <div className="flex flex-wrap justify-end gap-1">
                      {profile.teams.length === 0 ? <span className="text-muted-foreground">—</span> : profile.teams.map((t) => (
                        <Link key={t.id} href={`/teams/${t.id}`}><TeamBadge name={t.name} /></Link>
                      ))}
                    </div>
                  } />
                  <Row label="Current Project" custom={
                    <div className="flex flex-wrap justify-end gap-1">
                      {profile.projects.length === 0 ? <span className="text-muted-foreground">—</span> : profile.projects.map((p) => (
                        <Badge key={p.id} variant="secondary">{p.name}</Badge>
                      ))}
                    </div>
                  } />
                  <Row label="Current Salary" value={profile.currentSalary ? `$${profile.currentSalary.toLocaleString()}` : "—"} />
                  <Row label="Proposed Salary" value={profile.proposedSalary ? `$${profile.proposedSalary.toLocaleString()}` : "—"} />
                  <Row label="Action" value={profile.action ?? "—"} />
                  {profile.justification && <Row label="Justification" value={profile.justification} />}

                  <div className="mt-2 border-t border-border pt-3">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">Operations</p>
                    <AssignOperationsForm
                      userId={profile.id}
                      assignedToOperations={profile.assignedToOperations}
                      assignedToOperationsAt={profile.assignedToOperationsAt}
                      operationsProjectName={profile.operationsProjectName}
                      allProjects={profile.allProjects}
                    />
                  </div>

                  <div className="mt-2 border-t border-border pt-3">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">Offboarding</p>
                    <OffboardingStatusForm
                      userId={profile.id}
                      offboardingStatus={profile.offboardingStatus}
                      offboardingSetAt={profile.offboardingSetAt}
                    />
                  </div>

                  <div className="mt-2 border-t border-border pt-3">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">Recent Activity</p>
                    {profile.activity.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No changes recorded yet.</p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {profile.activity.slice(0, 6).map((a) => (
                          <div key={a.id} className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{a.actorName}</span> updated the bank profile ·{" "}
                            {a.createdAt.toLocaleDateString()}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="prospects" className="flex flex-col gap-3 pt-3">
                  <Button size="sm" onClick={() => setCreateOpen(true)}>Create Prospect</Button>
                  {profile.activeProspects.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">No active prospects.</p>
                  )}
                  {profile.activeProspects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/employee-bank/prospects/${p.id}`}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-muted/60"
                    >
                      <div>
                        <p className="font-medium text-foreground">{p.projectName ?? p.client ?? "Unnamed opportunity"}</p>
                        <p className="text-xs text-muted-foreground">{p.role} · Owner: {p.ownerName}</p>
                      </div>
                      <Badge variant={statusTone(p.status)} className="text-[10px]">{enumLabel(p.status)}</Badge>
                    </Link>
                  ))}

                  {profile.historicalProspectCount > 0 && (
                    <div className="mt-2 border-t border-border pt-3">
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">
                        Prospect History ({profile.historicalProspectCount}) — {profile.acceptedProspectCount} accepted, {profile.rejectedProspectCount} not selected
                      </p>
                      <div className="flex flex-col gap-2">
                        {profile.historicalProspects.map((p) => (
                          <Link
                            key={p.id}
                            href={`/employee-bank/prospects/${p.id}`}
                            className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-muted/60"
                          >
                            <div>
                              <p className="font-medium text-foreground">{p.projectName ?? p.client ?? "Unnamed opportunity"}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                {p.interviewAttended === true && p.interviewResult && (
                                  <Badge variant={interviewResultTone(p.interviewResult)} className="text-[9px]">{enumLabel(p.interviewResult)}</Badge>
                                )}
                                {p.interviewAttended === false && p.interviewNonAttendanceReason && (
                                  <Badge variant="critical" className="text-[9px]">Missed — {enumLabel(p.interviewNonAttendanceReason)}</Badge>
                                )}
                                {p.outcomeReason && <span className="text-[10px] text-muted-foreground">{enumLabel(p.outcomeReason)}</span>}
                              </div>
                            </div>
                            <Badge variant={statusTone(p.status)} className="text-[10px]">{enumLabel(p.status)}</Badge>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="performance" className="flex flex-col gap-3 pt-3 text-sm">
                  <Row label="Overall Score" custom={<ScoreBadge score={profile.score} />} />
                  <Row label="Evaluations" value={String(profile.evaluationCount)} />
                  <Row label="Confidence" value={profile.confidence} />
                  <Row label="Trend" custom={<TrendIndicator trend={profile.trend} delta={profile.trendDelta} />} />
                </TabsContent>

                <TabsContent value="notes" className="flex flex-col gap-2 pt-3">
                  {profile.notes.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No notes yet.</p>}
                  {profile.notes.map((n) => (
                    <div key={n.id} className="rounded-md border border-border p-2.5 text-sm">
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{n.authorName}</span>
                        <span>{enumLabel(n.type)} · {n.createdAt.toLocaleDateString()}</span>
                      </div>
                      <p className="text-foreground">{n.text}</p>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </SheetBody>

            <CreateProspectDialog
              open={createOpen}
              onOpenChange={setCreateOpen}
              employeeId={profile.id}
              employeeName={profile.name}
              existingActiveProspects={profile.activeProspects}
              allManagers={allManagers}
              allTeams={profile.allTeams}
              allProjects={profile.allProjects}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value, custom }: { label: string; value?: string; custom?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      {custom ?? <span className="text-right font-medium text-foreground">{value}</span>}
    </div>
  );
}
