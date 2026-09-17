"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, Trash2, Users } from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initials } from "@/lib/utils";

type FormValues = z.input<typeof createDemoSchema>;

interface Option {
  id: string;
  name: string;
}

interface TeamOption extends Option {
  managers: Option[];
  members: Option[];
}

function todayDateInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowTimeInput() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function suggestedTitle(teamName: string, dateStr: string) {
  const d = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  const formatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${teamName} Demo — ${formatted}`;
}

export function DemoForm({ teams, allManagers }: { teams: TeamOption[]; allManagers: Option[] }) {
  const [pending, startTransition] = useTransition();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showOtherEvaluators, setShowOtherEvaluators] = useState(false);
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
      teamId: "",
      hostManagerId: "",
      additionalManagerIds: [],
      engineerIds: [],
      date: todayDateInput(),
      startTime: nowTimeInput(),
      deliverables: [],
      urls: [],
    },
  });

  const deliverableArray = useFieldArray({ control, name: "deliverables" });
  const urlArray = useFieldArray({ control, name: "urls" });

  const teamId = watch("teamId");
  const hostManagerId = watch("hostManagerId");
  const additionalManagerIds = watch("additionalManagerIds") ?? [];
  const engineerIds = watch("engineerIds") ?? [];
  const title = watch("title");
  const date = watch("date");

  const selectedTeam = teams.find((t) => t.id === teamId) ?? null;

  // Selecting a team is the single source of truth: it drives the manager,
  // the roster (all pre-checked), and the suggested session name in one go.
  function selectTeam(id: string) {
    const team = teams.find((t) => t.id === id);
    if (!team) return;
    setValue("teamId", id, { shouldValidate: true });
    setValue("hostManagerId", team.managers[0]?.id ?? "", { shouldValidate: true });
    setValue("additionalManagerIds", [], { shouldValidate: true });
    setValue(
      "engineerIds",
      team.members.map((m) => m.id),
      { shouldValidate: true }
    );
    if (titleWasAutoFilled.current) {
      setValue("title", suggestedTitle(team.name, watch("date")), { shouldValidate: true });
    }
    setShowOtherEvaluators(false);
  }

  // Keep the suggested title in sync with date changes, but only while the
  // user hasn't typed their own — once they edit it, it's theirs.
  useEffect(() => {
    if (selectedTeam && titleWasAutoFilled.current) {
      setValue("title", suggestedTitle(selectedTeam.name, date), { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  function toggleEngineer(id: string) {
    const next = engineerIds.includes(id) ? engineerIds.filter((x) => x !== id) : [...engineerIds, id];
    setValue("engineerIds", next, { shouldValidate: true });
  }

  function toggleAdditionalManager(id: string) {
    const next = additionalManagerIds.includes(id) ? additionalManagerIds.filter((x) => x !== id) : [...additionalManagerIds, id];
    setValue("additionalManagerIds", next, { shouldValidate: true });
  }

  const primaryManager = selectedTeam?.managers.find((m) => m.id === hostManagerId) ?? selectedTeam?.managers[0] ?? null;
  const selectedEngineers = selectedTeam?.members.filter((m) => engineerIds.includes(m.id)) ?? [];
  const otherManagerOptions = allManagers.filter((m) => m.id !== hostManagerId);

  const canStart = Boolean(teamId && hostManagerId && engineerIds.length > 0 && title.trim().length >= 3 && date);

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      try {
        await createDemo(data as CreateDemoInput);
      } catch (e) {
        if (e instanceof Error && e.message === "NEXT_REDIRECT") return;
        toast.error(e instanceof Error ? e.message : "Could not create demo session");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <Field label="Team" error={errors.teamId?.message}>
            <Select value={teamId || undefined} onValueChange={selectTeam}>
              <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
              <SelectContent>
                {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          {selectedTeam && (
            <div className="flex items-center justify-between rounded-md border border-border bg-surface-muted/50 px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {selectedTeam.managers.length ? selectedTeam.managers.map((m) => m.name).join(", ") : "No manager assigned"} ·{" "}
                  {selectedTeam.members.length} {selectedTeam.members.length === 1 ? "engineer" : "engineers"}
                </span>
              </div>
            </div>
          )}

          {selectedTeam && selectedTeam.managers.length > 1 && (
            <Field label="Manager" error={errors.hostManagerId?.message}>
              <Select value={hostManagerId || undefined} onValueChange={(v) => setValue("hostManagerId", v, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                <SelectContent>
                  {selectedTeam.managers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}

          {selectedTeam && selectedTeam.managers.length === 1 && (
            <Field label="Manager">
              <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
                <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{initials(primaryManager?.name ?? "")}</AvatarFallback></Avatar>
                <span className="text-sm font-medium text-foreground">{primaryManager?.name}</span>
              </div>
            </Field>
          )}

          {selectedTeam && (
            <div>
              <button
                type="button"
                onClick={() => setShowOtherEvaluators((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {showOtherEvaluators ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Add other evaluators (optional)
              </button>
              {showOtherEvaluators && (
                <div className="mt-2 grid grid-cols-2 gap-2 rounded-md border border-border p-2.5 sm:grid-cols-3">
                  {otherManagerOptions.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={additionalManagerIds.includes(m.id)} onCheckedChange={() => toggleAdditionalManager(m.id)} />
                      {m.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedTeam && (
            <Field label={`Engineers (${selectedEngineers.length} selected)`} error={errors.engineerIds?.message}>
              <div className="flex flex-col gap-1.5 rounded-md border border-border p-2.5">
                {selectedTeam.members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={engineerIds.includes(m.id)} onCheckedChange={() => toggleEngineer(m.id)} />
                    {m.name}
                  </label>
                ))}
              </div>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" error={errors.date?.message}>
              <Input type="date" {...register("date")} />
            </Field>
            <Field label="Start Time" error={errors.startTime?.message}>
              <Input type="time" {...register("startTime")} />
            </Field>
          </div>

          <Field label="Session Name" error={errors.title?.message}>
            <Input
              {...register("title")}
              onChange={(e) => {
                titleWasAutoFilled.current = false;
                setValue("title", e.target.value, { shouldValidate: true });
              }}
              placeholder="e.g. PMS Demo — Sep 17"
            />
          </Field>
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

      {selectedTeam && (
        <Card className="border-primary/20 bg-primary-muted/30">
          <CardHeader><CardTitle className="text-sm">Demo Session Preview</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <PreviewRow label="Team" value={selectedTeam.name} />
            <PreviewRow label="Manager" value={[primaryManager?.name, ...additionalManagerIds.map((id) => allManagers.find((m) => m.id === id)?.name)].filter(Boolean).join(", ") || "—"} />
            <div className="flex items-start justify-between gap-4">
              <span className="text-muted-foreground">Engineers</span>
              <div className="flex flex-wrap justify-end gap-1">
                {selectedEngineers.length === 0 && <span className="text-critical">None selected</span>}
                {selectedEngineers.map((e) => <Badge key={e.id} variant="secondary">{e.name}</Badge>)}
              </div>
            </div>
            <PreviewRow label="Date" value={date ? new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"} />
            <PreviewRow label="Session Name" value={title || "—"} />
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending || !canStart} size="lg">
          {pending ? "Starting..." : "Start Demo Session"}
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
