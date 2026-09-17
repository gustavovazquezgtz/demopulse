"use client";

import { useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { z } from "zod";
import { createDemoSchema, type CreateDemoInput } from "@/lib/validations/demo";
import { createDemo } from "@/lib/actions/demos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FormValues = z.input<typeof createDemoSchema>;

interface Option {
  id: string;
  name: string;
}

export function DemoForm({
  projects,
  teams,
  managers,
  developers,
}: {
  projects: Option[];
  teams: (Option & { projectIds: string[] })[];
  managers: Option[];
  developers: (Option & { teamIds: string[] })[];
}) {
  const [pending, startTransition] = useTransition();
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
      teamIds: [],
      projectIds: [],
      invitedManagerIds: [],
      invitedMemberIds: [],
      deliverables: [],
      urls: [],
    },
  });

  const deliverableArray = useFieldArray({ control, name: "deliverables" });
  const urlArray = useFieldArray({ control, name: "urls" });

  const teamIds = watch("teamIds") ?? [];
  const projectIds = watch("projectIds") ?? [];
  const invitedMemberIds = watch("invitedMemberIds") ?? [];
  const invitedManagerIds = watch("invitedManagerIds") ?? [];

  const teamDevelopers = developers.filter((d) => teamIds.length === 0 || d.teamIds.some((t) => teamIds.includes(t)));

  function toggle(list: string[], id: string, field: "invitedManagerIds" | "invitedMemberIds" | "teamIds" | "projectIds") {
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    setValue(field, next, { shouldValidate: true });
  }

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      try {
        await createDemo(data as CreateDemoInput);
      } catch (e) {
        if (e instanceof Error && e.message === "NEXT_REDIRECT") return;
        toast.error("Could not create demo");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>1. Basics</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Title" error={errors.title?.message}>
            <Input {...register("title")} placeholder="e.g. Wellfit Onboarding Flow Demo" />
          </Field>
          <Field label="Description">
            <Textarea {...register("description")} rows={2} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Teams presenting" error={errors.teamIds?.message}>
              <div className="flex flex-col gap-1.5 rounded-md border border-border p-2.5">
                {teams.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={teamIds.includes(t.id)} onCheckedChange={() => toggle(teamIds, t.id, "teamIds")} />
                    {t.name}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Projects" error={errors.projectIds?.message}>
              <div className="flex flex-col gap-1.5 rounded-md border border-border p-2.5">
                {projects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={projectIds.includes(p.id)} onCheckedChange={() => toggle(projectIds, p.id, "projectIds")} />
                    {p.name}
                  </label>
                ))}
              </div>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Host Manager" error={errors.hostManagerId?.message}>
              <Select onValueChange={(v) => setValue("hostManagerId", v, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Select host" /></SelectTrigger>
                <SelectContent>
                  {managers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date" error={errors.date?.message}>
              <Input type="date" {...register("date")} />
            </Field>
            <Field label="Time" error={errors.startTime?.message}>
              <div className="flex items-center gap-1">
                <Input type="time" {...register("startTime")} />
                <span className="text-muted-foreground">–</span>
                <Input type="time" {...register("endTime")} />
              </div>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Expected Deliverables</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {deliverableArray.fields.map((f, i) => (
            <div key={f.id} className="rounded-md border border-border p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 flex flex-col gap-2">
                  <Input {...register(`deliverables.${i}.title`)} placeholder="Deliverable title" />
                  <Textarea {...register(`deliverables.${i}.expectedOutcome`)} placeholder="Expected outcome" rows={1} />
                  <Select onValueChange={(v) => setValue(`deliverables.${i}.projectId`, v, { shouldValidate: true })}>
                    <SelectTrigger className="w-56"><SelectValue placeholder="Which project?" /></SelectTrigger>
                    <SelectContent>
                      {projects
                        .filter((p) => projectIds.length === 0 || projectIds.includes(p.id))
                        .map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.deliverables?.[i]?.projectId && (
                    <p className="text-xs text-critical">{errors.deliverables[i]?.projectId?.message}</p>
                  )}
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => deliverableArray.remove(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => deliverableArray.append({ title: "", description: "", expectedOutcome: "", projectId: projectIds[0] ?? "", ownerIds: [] })}
          >
            <Plus className="h-4 w-4" /> Add deliverable
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Invite Managers</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {managers.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={invitedManagerIds.includes(m.id)}
                onCheckedChange={() => toggle(invitedManagerIds, m.id, "invitedManagerIds")}
              />
              {m.name}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Invite Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {errors.invitedMemberIds && <p className="mb-2 text-xs text-critical">{errors.invitedMemberIds.message}</p>}
          {teamIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Select at least one team above to see its members.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {teamDevelopers.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={invitedMemberIds.includes(d.id)}
                    onCheckedChange={() => toggle(invitedMemberIds, d.id, "invitedMemberIds")}
                  />
                  {d.name}
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. Links</CardTitle>
        </CardHeader>
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

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create Demo"}
        </Button>
      </div>
    </form>
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
