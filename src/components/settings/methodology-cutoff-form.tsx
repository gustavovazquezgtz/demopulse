"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateMethodologyCutoff } from "@/lib/actions/criteria";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toDateInput(d: Date) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function MethodologyCutoffForm({ cutoffDate }: { cutoffDate: Date }) {
  const [date, setDate] = useState(toDateInput(cutoffDate));
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        await updateMethodologyCutoff(date);
        toast.success("Cutoff date updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update cutoff date");
      }
    });
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Last day under the old (yes/no) criteria</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-48" />
      </div>
      <Button size="sm" disabled={pending} onClick={save}>{pending ? "Saving..." : "Save"}</Button>
    </div>
  );
}
