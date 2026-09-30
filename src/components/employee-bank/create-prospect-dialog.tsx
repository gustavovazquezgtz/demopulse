"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { createProspect } from "@/lib/actions/prospects";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PROSPECT_SOURCE_OPTIONS, enumLabel, statusTone } from "@/lib/employee-bank/labels";
import type { ActiveProspectSummary } from "./types";

export function CreateProspectDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  existingActiveProspects,
  allManagers,
  allTeams,
  allProjects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  existingActiveProspects: ActiveProspectSummary[];
  allManagers: { id: string; name: string }[];
  allTeams: { id: string; name: string }[];
  allProjects: { id: string; name: string }[];
}) {
  const [client, setClient] = useState("");
  const [projectId, setProjectId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [role, setRole] = useState("");
  const [ownerManagerId, setOwnerManagerId] = useState("");
  const [source, setSource] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, startTransition] = useTransition();

  const hasCollision = existingActiveProspects.length > 0;
  const canSubmit = role.trim() && ownerManagerId && source && (!hasCollision || acknowledged);

  function reset() {
    setClient(""); setProjectId(""); setTeamId(""); setRole(""); setOwnerManagerId(""); setSource(""); setNotes(""); setAcknowledged(false);
  }

  function submit() {
    startTransition(async () => {
      try {
        await createProspect({
          employeeId,
          client: client.trim() || undefined,
          projectId: projectId || undefined,
          teamId: teamId || undefined,
          role: role.trim(),
          ownerManagerId,
          source,
          generalNotes: notes.trim() || undefined,
        });
        toast.success("Prospect created");
        reset();
        onOpenChange(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not create prospect");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Prospect</DialogTitle>
          <DialogDescription>{employeeName}</DialogDescription>
        </DialogHeader>

        {hasCollision && (
          <div className="rounded-md border border-warning/40 bg-warning-muted/50 p-3 text-sm">
            <div className="mb-1 flex items-center gap-1.5 font-medium text-warning">
              <AlertTriangle className="h-4 w-4" /> Employee already has an active prospect.
            </div>
            <div className="flex flex-col gap-1.5">
              {existingActiveProspects.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs text-foreground">
                  <span>{p.projectName ?? p.client ?? "Unnamed"} · Owner: {p.ownerName}</span>
                  <Badge variant={statusTone(p.status)} className="text-[10px]">{enumLabel(p.status)}</Badge>
                </div>
              ))}
            </div>
            <label className="mt-2 flex items-start gap-2 text-xs">
              <Checkbox checked={acknowledged} onCheckedChange={(v) => setAcknowledged(!!v)} className="mt-0.5" />
              <span>I&apos;ve reviewed the existing opportunity/opportunities and want to create another prospect anyway.</span>
            </label>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label>Client (optional)</Label>
            <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="e.g. Gencise" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Project</Label>
            <Select value={projectId || undefined} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Select project..." /></SelectTrigger>
              <SelectContent>
                {allProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Team (optional)</Label>
            <Select value={teamId || undefined} onValueChange={setTeamId}>
              <SelectTrigger><SelectValue placeholder="Select team..." /></SelectTrigger>
              <SelectContent>
                {allTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Role</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Senior Full Stack" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Prospect Owner</Label>
            <Select value={ownerManagerId || undefined} onValueChange={setOwnerManagerId}>
              <SelectTrigger><SelectValue placeholder="Select manager..." /></SelectTrigger>
              <SelectContent>
                {allManagers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label>Source</Label>
            <Select value={source || undefined} onValueChange={setSource}>
              <SelectTrigger><SelectValue placeholder="Select source..." /></SelectTrigger>
              <SelectContent>
                {PROSPECT_SOURCE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{enumLabel(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSubmit || pending} onClick={submit}>{pending ? "Creating..." : "Create Prospect"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
