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

export function TeamForm({ managers }: { managers: { id: string; name: string }[] }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setManagerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createTeam({ name, description, managerIds });
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
                  <Checkbox checked={managerIds.includes(m.id)} onCheckedChange={() => toggle(m.id)} />
                  {m.name}
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={pending || !name.trim() || managerIds.length === 0}>
            {pending ? "Creating..." : "Create Team"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
