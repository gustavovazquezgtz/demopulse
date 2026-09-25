"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateTeamManagers } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function EditTeamManagersForm({
  teamId,
  allManagers,
  initialSelectedIds,
}: {
  teamId: string;
  allManagers: { id: string; name: string }[];
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
        await updateTeamManagers(teamId, selected);
        toast.success("Team managers updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update managers");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {allManagers.map((m) => (
        <label key={m.id} className="flex items-center gap-2.5 py-1 text-sm">
          <Checkbox checked={selected.includes(m.id)} onCheckedChange={() => toggle(m.id)} />
          <span className="text-foreground">{m.name}</span>
        </label>
      ))}
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={save} disabled={pending || selected.length === 0}>
          {pending ? "Saving..." : "Save Managers"}
        </Button>
      </div>
    </div>
  );
}
