"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateManagerTeams } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function ManagerTeamsForm({
  managerId,
  allTeams,
  initialSelectedIds,
}: {
  managerId: string;
  allTeams: { id: string; name: string }[];
  initialSelectedIds: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initialSelectedIds);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function save() {
    startTransition(async () => {
      try {
        await updateManagerTeams(managerId, selected);
        toast.success("Teams updated — past stints stay on record for each team.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update teams");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {allTeams.map((t) => (
        <label key={t.id} className="flex items-center gap-2.5 py-1 text-sm">
          <Checkbox checked={selected.includes(t.id)} onCheckedChange={() => toggle(t.id)} />
          <span className="text-foreground">{t.name}</span>
        </label>
      ))}
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save Teams"}
        </Button>
      </div>
    </div>
  );
}
