"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createTeam } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TeamForm({
  managers,
  developers,
}: {
  managers: { id: string; name: string }[];
  developers: { id: string; name: string }[];
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(todayInput());
  const [pending, startTransition] = useTransition();

  function toggleManager(id: string) {
    setManagerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleMember(id: string) {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createTeam({ name, description, managerIds, memberIds, startDate });
      } catch (err) {
        if (err instanceof Error && err.message === "NEXT_REDIRECT") return;
        toast.error(err instanceof Error ? err.message : "Could not create team");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Team Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Payments Platform" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Manager(s)</Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border border-border p-2.5">
              {managers.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={managerIds.includes(m.id)} onCheckedChange={() => toggleManager(m.id)} />
                  {m.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Members (optional)</Label>
            <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded-md border border-border p-2.5">
              {developers.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={memberIds.includes(d.id)} onCheckedChange={() => toggleMember(d.id)} />
                  {d.name}
                </label>
              ))}
            </div>
          </div>
          {memberIds.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Members join as of</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-48" />
            </div>
          )}
          <Button type="submit" disabled={pending || !name.trim() || managerIds.length === 0}>
            {pending ? "Creating..." : "Create Team"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
