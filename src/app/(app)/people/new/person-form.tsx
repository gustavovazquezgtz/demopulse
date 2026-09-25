"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createPerson } from "@/lib/actions/people";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PersonForm({ teams }: { teams: { id: string; name: string }[] }) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [teamId, setTeamId] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createPerson({ name, title, teamId: teamId || undefined });
      } catch (err) {
        if (err instanceof Error && err.message === "NEXT_REDIRECT") return;
        toast.error(err instanceof Error ? err.message : "Could not add person");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Full Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maria Fernanda Lopez" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Title (optional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Software Engineer" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Team (optional — can assign later)</Label>
            <Select value={teamId || undefined} onValueChange={setTeamId}>
              <SelectTrigger><SelectValue placeholder="No team yet" /></SelectTrigger>
              <SelectContent>
                {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? "Adding..." : "Add Person"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
