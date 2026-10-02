"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createOneOnOne } from "@/lib/actions/one-on-ones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FORMAT_OPTIONS, formatLabel } from "@/lib/one-on-ones/labels";

function nowInput() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function OneOnOneForm({
  developers,
  initialDeveloperId,
}: {
  developers: { id: string; name: string; title: string | null }[];
  initialDeveloperId?: string;
}) {
  const [developerId, setDeveloperId] = useState(initialDeveloperId ?? "");
  const [date, setDate] = useState(nowInput());
  const [format, setFormat] = useState<string>("IN_PERSON");
  const [location, setLocation] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [feedbackReceived, setFeedbackReceived] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createOneOnOne({ developerId, date, format: format as never, location, recommendations, feedbackReceived });
      } catch (err) {
        if (err instanceof Error && err.message === "NEXT_REDIRECT") return;
        toast.error(err instanceof Error ? err.message : "Could not save this 1:1");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Who was this 1:1 with?</Label>
            <Select value={developerId || undefined} onValueChange={setDeveloperId}>
              <SelectTrigger><SelectValue placeholder="Select person..." /></SelectTrigger>
              <SelectContent>
                {developers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}{d.title ? ` — ${d.title}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Date &amp; Time</Label>
              <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((f) => <SelectItem key={f} value={f}>{formatLabel(f)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Location / Detail (optional)</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Conference Room B, or a Teams link" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Recommendations given (optional)</Label>
            <Textarea value={recommendations} onChange={(e) => setRecommendations(e.target.value)} rows={3} placeholder="What did you tell/recommend to them?" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Feedback received (optional)</Label>
            <Textarea value={feedbackReceived} onChange={(e) => setFeedbackReceived(e.target.value)} rows={3} placeholder="What did you hear back from them?" />
          </div>

          <Button type="submit" disabled={pending || !developerId || !date}>
            {pending ? "Saving..." : "Save 1:1"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
