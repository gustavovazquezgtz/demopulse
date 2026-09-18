"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateDemoTeams } from "@/lib/actions/demos";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface TeamOption {
  id: string;
  name: string;
  managers: { userId: string; name: string }[];
  members: { userId: string; name: string }[];
}

export function EditTeamsForm({ demoId, allTeams, initialSelectedIds }: { demoId: string; allTeams: TeamOption[]; initialSelectedIds: string[] }) {
  const [selected, setSelected] = useState<string[]>(initialSelectedIds);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function save() {
    if (selected.length === 0) {
      toast.error("Select at least one team");
      return;
    }
    startTransition(async () => {
      try {
        const result = await updateDemoTeams(demoId, selected);
        toast.success(
          result.added || result.removed
            ? `Teams updated — managers and members synced automatically.`
            : "No changes to teams"
        );
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
          <span className="flex-1 text-foreground">{t.name}</span>
          <Badge variant="secondary" className="text-[10px]">{t.managers.map((m) => m.name).join(", ") || "No manager"}</Badge>
          <span className="text-xs text-muted-foreground">{t.members.length} engineers</span>
        </label>
      ))}
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save Teams"}
        </Button>
      </div>
    </div>
  );
}
