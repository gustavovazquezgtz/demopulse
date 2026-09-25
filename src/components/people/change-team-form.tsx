"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { moveTeamMember } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ChangeTeamForm({
  userId,
  currentTeamIds,
  allTeams,
}: {
  userId: string;
  currentTeamIds: string[];
  allTeams: { id: string; name: string }[];
}) {
  const [teamId, setTeamId] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function move() {
    if (!teamId) return;
    startTransition(async () => {
      try {
        await moveTeamMember(userId, teamId);
        toast.success("Team updated — past evaluations stay attributed to the team they were given on.");
        setTeamId("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not move this person");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={teamId || undefined} onValueChange={setTeamId}>
        <SelectTrigger className="w-56"><SelectValue placeholder="Move to team..." /></SelectTrigger>
        <SelectContent>
          {allTeams.filter((t) => !currentTeamIds.includes(t.id)).map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" onClick={move} disabled={!teamId || pending}>
        {pending ? "Moving..." : "Move"}
      </Button>
    </div>
  );
}
