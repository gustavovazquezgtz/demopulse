"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateDemoParticipants } from "@/lib/actions/demos";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export function EditParticipantsForm({
  demoId,
  roster,
  initialSelectedIds,
  evaluatedIds,
}: {
  demoId: string;
  roster: { id: string; name: string }[];
  initialSelectedIds: string[];
  evaluatedIds: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initialSelectedIds);
  const [pending, startTransition] = useTransition();
  const evaluatedSet = new Set(evaluatedIds);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function save() {
    startTransition(async () => {
      try {
        const result = await updateDemoParticipants(demoId, selected);
        if (result.softRemoved.length > 0) {
          toast.success(`Saved. ${result.softRemoved.length} participant(s) marked absent — their evaluations were kept.`);
        } else {
          toast.success("Participants updated");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update participants");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      {roster.map((r) => {
        const willSoftRemove = evaluatedSet.has(r.id) && !selected.includes(r.id);
        return (
          <label key={r.id} className="flex items-center gap-2.5 py-1.5 text-sm">
            <Checkbox checked={selected.includes(r.id)} onCheckedChange={() => toggle(r.id)} />
            <span className="flex-1 text-foreground">{r.name}</span>
            {evaluatedSet.has(r.id) && <Badge variant="outline" className="text-[10px]">Has evaluation</Badge>}
            {willSoftRemove && <span className="text-xs text-warning">Will be marked absent, evaluation kept</span>}
          </label>
        );
      })}
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save Participants"}
        </Button>
      </div>
    </div>
  );
}
