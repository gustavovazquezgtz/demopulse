"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { rescheduleDemo } from "@/lib/actions/demos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toTimeInput(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function RescheduleForm({ demoId, title, date, startTime }: { demoId: string; title: string; date: Date; startTime: Date }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ title, date: toDateInput(date), startTime: toTimeInput(startTime) });
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        await rescheduleDemo(demoId, values);
        toast.success("Session updated");
        setEditing(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update session");
      }
    });
  }

  if (!editing) {
    return (
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        Edit Name / Date / Time
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Session Name</Label>
        <Input value={values.title} onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Date</Label>
          <Input type="date" value={values.date} onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Time</Label>
          <Input type="time" value={values.startTime} onChange={(e) => setValues((v) => ({ ...v, startTime: e.target.value }))} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={pending}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
