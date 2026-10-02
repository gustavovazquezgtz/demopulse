"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateOneOnOne } from "@/lib/actions/one-on-ones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FORMAT_OPTIONS, formatLabel } from "@/lib/one-on-ones/labels";

function toDateTimeInput(d: Date) {
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function SessionEditForm({
  sessionId,
  date,
  format,
  location,
  recommendations,
  feedbackReceived,
}: {
  sessionId: string;
  date: Date;
  format: string;
  location: string | null;
  recommendations: string | null;
  feedbackReceived: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({
    date: toDateTimeInput(date),
    format,
    location: location ?? "",
    recommendations: recommendations ?? "",
    feedbackReceived: feedbackReceived ?? "",
  });
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        await updateOneOnOne(sessionId, {
          date: values.date,
          format: values.format as never,
          location: values.location,
          recommendations: values.recommendations,
          feedbackReceived: values.feedbackReceived,
        });
        toast.success("1:1 updated");
        setEditing(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save changes");
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <Row label="Date" value={new Date(date).toLocaleString()} />
        <Row label="Format" value={formatLabel(format)} />
        <Row label="Location / Detail" value={location || "—"} />
        <Row label="Recommendations given" value={recommendations || "—"} />
        <Row label="Feedback received" value={feedbackReceived || "—"} />
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Date &amp; Time</Label>
          <Input type="datetime-local" value={values.date} onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Format</Label>
          <Select value={values.format} onValueChange={(v) => setValues((s) => ({ ...s, format: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map((f) => <SelectItem key={f} value={f}>{formatLabel(f)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Location / Detail</Label>
        <Input value={values.location} onChange={(e) => setValues((v) => ({ ...v, location: e.target.value }))} placeholder="e.g. Conference Room B, or a Teams link" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Recommendations given</Label>
        <Textarea value={values.recommendations} onChange={(e) => setValues((v) => ({ ...v, recommendations: e.target.value }))} rows={3} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Feedback received</Label>
        <Textarea value={values.feedbackReceived} onChange={(e) => setValues((v) => ({ ...v, feedbackReceived: e.target.value }))} rows={3} />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>Cancel</Button>
        <Button size="sm" disabled={pending} onClick={save}>{pending ? "Saving..." : "Save"}</Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="max-w-[70%] text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
