"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateDemoManagers } from "@/lib/actions/demos";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export function EditManagersForm({
  demoId,
  allManagers,
  initialSelectedIds,
  hostManagerId,
}: {
  demoId: string;
  allManagers: { id: string; name: string }[];
  initialSelectedIds: string[];
  hostManagerId: string;
}) {
  const [selected, setSelected] = useState<string[]>(initialSelectedIds);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    if (id === hostManagerId) return; // host manager always stays invited
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function save() {
    startTransition(async () => {
      try {
        await updateDemoManagers(demoId, selected);
        toast.success("Invited managers updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update invited managers");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      {allManagers.map((m) => (
        <label key={m.id} className="flex items-center gap-2.5 py-1 text-sm">
          <Checkbox checked={selected.includes(m.id) || m.id === hostManagerId} onCheckedChange={() => toggle(m.id)} disabled={m.id === hostManagerId} />
          <span className="flex-1 text-foreground">{m.name}</span>
          {m.id === hostManagerId && <Badge variant="secondary" className="text-[10px]">Host</Badge>}
        </label>
      ))}
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save Managers"}
        </Button>
      </div>
    </div>
  );
}
