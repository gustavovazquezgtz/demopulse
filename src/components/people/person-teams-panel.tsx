"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { X } from "lucide-react";
import { addTeamMember, removeTeamMember } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatDate(d: Date) {
  return new Date(d).toLocaleDateString();
}

interface ActiveMembership {
  id: string; // TeamMember row id
  teamId: string;
  teamName: string;
  joinedAt: Date;
}

export function PersonTeamsPanel({
  personId,
  activeMemberships,
  allTeams,
}: {
  personId: string;
  activeMemberships: ActiveMembership[];
  allTeams: { id: string; name: string }[];
}) {
  const [removing, setRemoving] = useState<string | null>(null);
  const [leaveDate, setLeaveDate] = useState(todayInput());
  const [addingTeamId, setAddingTeamId] = useState("");
  const [joinDate, setJoinDate] = useState(todayInput());
  const [pending, startTransition] = useTransition();

  const activeTeamIds = new Set(activeMemberships.map((m) => m.teamId));
  const availableTeams = allTeams.filter((t) => !activeTeamIds.has(t.id));

  function confirmRemove(membershipId: string) {
    startTransition(async () => {
      try {
        await removeTeamMember(membershipId, leaveDate);
        toast.success("Removed from team — their evaluation history stays exactly as it was.");
        setRemoving(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not remove from team");
      }
    });
  }

  function add() {
    if (!addingTeamId) return;
    startTransition(async () => {
      try {
        await addTeamMember(addingTeamId, personId, joinDate);
        toast.success("Added to team");
        setAddingTeamId("");
        setJoinDate(todayInput());
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not add to team");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {activeMemberships.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
          <div>
            <Link href={`/teams/${m.teamId}`} className="font-medium text-foreground hover:underline">{m.teamName}</Link>
            <p className="text-xs text-muted-foreground">Joined {formatDate(m.joinedAt)}</p>
          </div>
          {removing === m.id ? (
            <div className="flex items-center gap-1.5">
              <Input type="date" value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} className="h-8 w-36 text-xs" />
              <Button size="sm" variant="destructive" disabled={pending} onClick={() => confirmRemove(m.id)}>
                Confirm
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setRemoving(null)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-critical"
              onClick={() => {
                setLeaveDate(todayInput());
                setRemoving(m.id);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}
      {activeMemberships.length === 0 && <p className="py-2 text-center text-sm text-muted-foreground">Not on any team right now.</p>}

      <div className="flex items-center gap-1.5 pt-1">
        <Select value={addingTeamId || undefined} onValueChange={setAddingTeamId}>
          <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="Add to team..." /></SelectTrigger>
          <SelectContent>
            {availableTeams.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} className="h-8 w-36 text-xs" />
        <Button size="sm" disabled={!addingTeamId || pending} onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}
