"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateGroupThresholds } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GroupThresholds } from "@/lib/employee-bank/scoring";

export function GroupThresholdsForm({ thresholds }: { thresholds: GroupThresholds }) {
  const [aMin, setAMin] = useState(thresholds.aMin);
  const [bMin, setBMin] = useState(thresholds.bMin);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        await updateGroupThresholds({ aMin, bMin });
        toast.success("Thresholds updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update thresholds");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Group A minimum rating</Label>
          <Input type="number" min={0} max={10} value={aMin} onChange={(e) => setAMin(Number(e.target.value))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Group B minimum rating</Label>
          <Input type="number" min={0} max={10} value={bMin} onChange={(e) => setBMin(Number(e.target.value))} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Rating ≥ {aMin} → suggested A · {bMin}–{aMin - 1} → suggested B · below {bMin} → suggested C. This only changes the
        <em> suggestion</em> — a manager&apos;s own Group selection is never overwritten automatically.
      </p>
      <div className="flex justify-end">
        <Button size="sm" disabled={pending || aMin <= bMin} onClick={save}>{pending ? "Saving..." : "Save Thresholds"}</Button>
      </div>
    </div>
  );
}
