"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
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

interface ActiveMember {
  id: string; // TeamMember row id
  userId: string;
  userName: string;
  joinedAt: Date;
}

export function TeamMembersPanel({
  teamId,
  activeMembers,
  availablePeople,
}: {
  teamId: string;
  activeMembers: ActiveMember[];
  availablePeople: { id: string; name: string }[];
}) {
  const [removing, setRemoving] = useState<string | null>(null);
  const [leaveDate, setLeaveDate] = useState(todayInput());
  const [addingPersonId, setAddingPersonId] = useState("");
  const [joinDate, setJoinDate] = useState(todayInput());
  const [pending, startTransition] = useTransition();

  function confirmRemove(memberId: string) {
    startTransition(async () => {
      try {
        await removeTeamMember(memberId, leaveDate);
        toast.success("Removed from team — their evaluation history stays exactly as it was.");
        setRemoving(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not remove this person");
      }
    });
  }

  function add() {
    if (!addingPersonId) return;
    startTransition(async () => {
      try {
        await addTeamMember(teamId, addingPersonId, joinDate);
        toast.success("Added to team");
        setAddingPersonId("");
        setJoinDate(todayInput());
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not add this person");
      }
    });
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {activeMembers.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-2 py-2">
          <div>
            <p className="text-sm font-medium text-foreground">{m.userName}</p>
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
      {activeMembers.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No members yet.</p>}

      <div className="flex items-center gap-1.5 pt-3">
        <Select value={addingPersonId || undefined} onValueChange={setAddingPersonId}>
          <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="Add a person..." /></SelectTrigger>
          <SelectContent>
            {availablePeople.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} className="h-8 w-36 text-xs" />
        <Button size="sm" disabled={!addingPersonId || pending} onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}
