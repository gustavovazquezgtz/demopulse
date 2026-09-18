"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { z } from "zod";
import { createDemoSchema, type CreateDemoInput } from "@/lib/validations/demo";
import { createDemo } from "@/lib/actions/demos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FormValues = z.input<typeof createDemoSchema>;

interface Option {
  id: string;
  name: string;
}

interface TeamOption extends Option {
  managers: Option[];
  members: Option[];
}

const SUGGESTED_TIMES = ["16:00", "16:30", "16:45"];

function formatTime12h(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function todayDateInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function suggestedTitle(teamNames: string[], dateStr: string) {
  const d = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  const formatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const label = teamNames.length === 0 ? "Demo" : teamNames.length === 1 ? teamNames[0] : "Multi-Team Demo";
  return `${label} — ${formatted}`;
}

export function DemoForm({ teams, allManagers }: { teams: TeamOption[]; allManagers: Option[] }) {
  const [pending, startTransition] = useTransition();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const titleWasAutoFilled = useRef(true);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createDemoSchema),
    defaultValues: {
      title: "",
      teamIds: [],
      hostManagerId: "",
      invitedManagerIds: [],
      engineerIds: [],
      date: todayDateInput(),
      startTime: "",
      deliverables: [],
      urls: [],
    },
  });

  const deliverableArray = useFieldArray({ control, name: "deliverables" });
  const urlArray = useFieldArray({ control, name: "urls" });

  const teamIds = watch("teamIds") ?? [];
  const hostManagerId = watch("hostManagerId");
  const invitedManagerIds = watch("invitedManagerIds") ?? [];
  const engineerIds = watch("engineerIds") ?? [];
  const title = watch("title");
  const date = watch("date");
  const startTime = watch("startTime");

  const selectedTeams = teams.filter((t) => teamIds.includes(t.id));

  function refreshTitle(nextTeams: TeamOption[]) {
    if (titleWasAutoFilled.current) {
      setValue("title", suggestedTitle(nextTeams.map((t) => t.name), date), { shouldValidate: true });
    }
  }

  // Selecting a team is the single source of truth: adding one merges in
  // its manager(s)/members (deduped — a shared person is never listed
  // twice); removing one drops only the people who aren't needed by any
  // OTHER still-selected team, so manual overrides on shared teams survive.
  function toggleTeam(teamId: string) {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;
    const isSelected = teamIds.includes(teamId);
    const nextTeamIds = isSelected ? teamIds.filter((id) => id !== teamId) : [...teamIds, teamId];
    setValue("teamIds", nextTeamIds, { shouldValidate: true });

    if (!isSelected) {
      const newManagerIds = team.managers.map((m) => m.id).filter((id) => !invitedManagerIds.includes(id));
      const newEngineerIds = team.members.map((m) => m.id).filter((id) => !engineerIds.includes(id));
      const nextManagerIds = [...invitedManagerIds, ...newManagerIds];
      setValue("invitedManagerIds", nextManagerIds, { shouldValidate: true });
      setValue("engineerIds", [...engineerIds, ...newEngineerIds], { shouldValidate: true });
      if (!hostManagerId && team.managers[0]) setValue("hostManagerId", team.managers[0].id, { shouldValidate: true });
    } else {
      const remaining = teams.filter((t) => nextTeamIds.includes(t.id));
      const stillNeededManagers = new Set(remaining.flatMap((t) => t.managers.map((m) => m.id)));
      const stillNeededEngineers = new Set(remaining.flatMap((t) => t.members.map((m) => m.id)));
      const droppedManagers = new Set(team.managers.map((m) => m.id).filter((id) => !stillNeededManagers.has(id)));
      const droppedEngineers = new Set(team.members.map((m) => m.id).filter((id) => !stillNeededEngineers.has(id)));
      const nextManagerIds = invitedManagerIds.filter((id) => !droppedManagers.has(id));
      setValue("invitedManagerIds", nextManagerIds, { shouldValidate: true });
      setValue("engineerIds", engineerIds.filter((id) => !droppedEngineers.has(id)), { shouldValidate: true });
      if (droppedManagers.has(hostManagerId)) {
        setValue("hostManagerId", nextManagerIds[0] ?? "", { shouldValidate: true });
      }
    }

    refreshTitle(teams.filter((t) => nextTeamIds.includes(t.id)));
  }

  // Keep the suggested title in sync with date changes, but only while the
  // user hasn't typed their own — once they edit it, it's theirs.
  useEffect(() => {
    if (titleWasAutoFilled.current) {
      setValue("title", suggestedTitle(selectedTeams.map((t) => t.name), date), { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  function toggleEngineer(id: string) {
    const next = engineerIds.includes(id) ? engineerIds.filter((x) => x !== id) : [...engineerIds, id];
    setValue("engineerIds", next, { shouldValidate: true });
  }

  function toggleManager(id: string) {
    const next = invitedManagerIds.includes(id) ? invitedManagerIds.filter((x) => x !== id) : [...invitedManagerIds, id];
    setValue("invitedManagerIds", next, { shouldValidate: true });
    if (!next.includes(hostManagerId)) setValue("hostManagerId", next[0] ?? "", { shouldValidate: true });
  }

  // Each engineer is shown once, under the first selected team that claims
  // them — dedupes shared members while still surfacing team association.
  const renderedEngineerIds = new Set<string>();
  const engineersByTeam = selectedTeams.map((team) => {
    const members = team.members.filter((m) => !renderedEngineerIds.has(m.id));
    members.forEach((m) => renderedEngineerIds.add(m.id));
    return { team, members };
  });

  const selectedEngineerCount = engineerIds.length;
  const canStart = Boolean(
    teamIds.length > 0 && hostManagerId && invitedManagerIds.length > 0 && engineerIds.length > 0 && title.trim().length >= 3 && date && startTime
  );

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      try {
        await createDemo(data as CreateDemoInput);
      } catch (e) {
        if (e instanceof Error && e.message === "NEXT_REDIRECT") return;
        toast.error(e instanceof Error ? e.message : "Could not schedule demo session");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Card>
        <CardHeader><CardTitle className="text-sm">1. Teams / Projects</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 rounded-md border border-border p-2.5">
            {teams.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={teamIds.includes(t.id)} onCheckedChange={() => toggleTeam(t.id)} />
                {t.name}
              </label>
            ))}
          </div>
          {errors.teamIds && <p className="text-xs text-critical">{errors.teamIds.message}</p>}
        </CardContent>
      </Card>

      {selectedTeams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">2. Invited Managers</CardTitle>
            <p className="text-xs text-muted-foreground">
              Team managers are pre-selected. Add any other manager too — evaluations aren&apos;t limited to a developer&apos;s own team.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {allManagers.map((m) => {
                const isTeamManager = selectedTeams.some((t) => t.managers.some((tm) => tm.id === m.id));
                return (
                  <label key={m.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={invitedManagerIds.includes(m.id)} onCheckedChange={() => toggleManager(m.id)} />
                    {m.name}
                    {isTeamManager && <Badge variant="secondary" className="text-[9px]">Team</Badge>}
                  </label>
                );
              })}
            </div>
            {errors.invitedManagerIds && <p className="text-xs text-critical">{errors.invitedManagerIds.message}</p>}

            {invitedManagerIds.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Host Manager</Label>
                <Select value={hostManagerId || undefined} onValueChange={(v) => setValue("hostManagerId", v, { shouldValidate: true })}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Select host" /></SelectTrigger>
                  <SelectContent>
                    {allManagers.filter((m) => invitedManagerIds.includes(m.id)).map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedTeams.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">3. Participants ({selectedEngineerCount} selected)</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {engineersByTeam.map(({ team, members }) => (
              <div key={team.id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span>{team.name}</span>
                  {team.managers.length > 0 && <Badge variant="secondary" className="text-[10px]">{team.managers.map((m) => m.name).join(", ")}</Badge>}
                </div>
                {members.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No other members (shared with another selected team, or none)</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 rounded-md border border-border p-2.5 sm:grid-cols-3">
                    {members.map((m) => (
                      <label key={m.id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={engineerIds.includes(m.id)} onCheckedChange={() => toggleEngineer(m.id)} />
                        {m.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {errors.engineerIds && <p className="text-xs text-critical">{errors.engineerIds.message}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">4. Date &amp; Time</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Date" error={errors.date?.message}>
            <Input type="date" {...register("date")} />
          </Field>

          <div className="flex flex-col gap-1.5">
            <Label>Suggested Times</Label>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_TIMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setValue("startTime", t, { shouldValidate: true })}
                  className={cn(
                    "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                    startTime === t ? "border-primary bg-primary-muted text-primary" : "border-border text-foreground hover:bg-surface-muted"
                  )}
                >
                  {formatTime12h(t)}
                </button>
              ))}
            </div>
          </div>

          <Field label="Custom Time" error={errors.startTime?.message}>
            <Input type="time" {...register("startTime")} className="w-40" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">5. Session Name</CardTitle></CardHeader>
        <CardContent>
          <Input
            {...register("title")}
            onChange={(e) => {
              titleWasAutoFilled.current = false;
              setValue("title", e.target.value, { shouldValidate: true });
            }}
            placeholder="e.g. Multi-Team Demo — Sep 25"
          />
          {errors.title && <p className="mt-1 text-xs text-critical">{errors.title.message}</p>}
        </CardContent>
      </Card>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {showAdvanced ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Deliverables &amp; links (optional)
        </button>

        {showAdvanced && (
          <div className="mt-3 flex flex-col gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Expected Deliverables</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-3">
                {deliverableArray.fields.map((f, i) => (
                  <div key={f.id} className="flex items-start gap-2 rounded-md border border-border p-3">
                    <div className="flex-1 flex flex-col gap-2">
                      <Input {...register(`deliverables.${i}.title`)} placeholder="Deliverable title" />
                      <Textarea {...register(`deliverables.${i}.expectedOutcome`)} placeholder="Expected outcome" rows={1} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => deliverableArray.remove(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => deliverableArray.append({ title: "", description: "", expectedOutcome: "", ownerIds: [] })}
                >
                  <Plus className="h-4 w-4" /> Add deliverable
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Links</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-3">
                {urlArray.fields.map((f, i) => (
                  <div key={f.id} className="flex items-center gap-2">
                    <Input {...register(`urls.${i}.label`)} placeholder="Label" className="w-40" />
                    <Input {...register(`urls.${i}.url`)} placeholder="https://..." className="flex-1" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => urlArray.remove(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => urlArray.append({ label: "", url: "", type: "OTHER" })}
                >
                  <Plus className="h-4 w-4" /> Add link
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {selectedTeams.length > 0 && (
        <Card className="border-primary/20 bg-primary-muted/30">
          <CardHeader><CardTitle className="text-sm">Review</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <PreviewRow label="Teams" value={`${selectedTeams.length} team${selectedTeams.length === 1 ? "" : "s"}`} />
            <div className="flex items-start justify-between gap-4">
              <span className="text-muted-foreground">Team / Project</span>
              <div className="flex flex-wrap justify-end gap-1">
                {selectedTeams.map((t) => <Badge key={t.id} variant="secondary">{t.name}</Badge>)}
              </div>
            </div>
            <PreviewRow label="Managers" value={`${invitedManagerIds.length} manager${invitedManagerIds.length === 1 ? "" : "s"}`} />
            <PreviewRow label="Engineers" value={`${selectedEngineerCount} engineer${selectedEngineerCount === 1 ? "" : "s"}`} />
            <PreviewRow
              label="Date &amp; Time"
              value={
                date && startTime
                  ? `${new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} — ${formatTime12h(startTime)}`
                  : "—"
              }
            />
            <PreviewRow label="Session Name" value={title || "—"} />
            <p className="mt-1 text-xs text-muted-foreground">
              This will be <span className="font-medium text-foreground">Scheduled</span> — an invited manager starts it later.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending || !canStart} size="lg">
          {pending ? "Scheduling..." : "Schedule Demo"}
        </Button>
      </div>
    </form>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-critical">{error}</p>}
    </div>
  );
}
