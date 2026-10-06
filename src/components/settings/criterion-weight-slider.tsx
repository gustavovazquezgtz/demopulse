"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateCriterionWeight } from "@/lib/actions/criteria";
import { Slider } from "@/components/ui/slider";

/** Dynamically ponder (weigh) one criterion — drag to change how much it
 * counts toward the overall score, relative to every other criterion's
 * own weight. Only affects evaluations saved from now on. */
export function CriterionWeightSlider({ criterionId, weight }: { criterionId: string; weight: number }) {
  const [value, setValue] = useState(weight);
  const [pending, startTransition] = useTransition();

  function commit(next: number) {
    setValue(next);
    startTransition(async () => {
      try {
        await updateCriterionWeight(criterionId, next);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update weight");
        setValue(weight);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Slider
        value={[value]}
        min={0}
        max={5}
        step={0.5}
        disabled={pending}
        onValueChange={([v]) => setValue(v)}
        onValueCommit={([v]) => commit(v)}
        className="w-32"
      />
      <span className="w-8 text-right text-sm font-medium text-foreground">{value}×</span>
    </div>
  );
}
