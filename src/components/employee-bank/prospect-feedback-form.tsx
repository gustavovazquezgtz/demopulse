"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProspectFeedback, addProspectNote } from "@/lib/actions/prospects";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function ProspectFeedbackForm({
  prospectId,
  technicalFeedback,
  englishFeedback,
  clientFeedback,
}: {
  prospectId: string;
  technicalFeedback: string | null;
  englishFeedback: string | null;
  clientFeedback: string | null;
}) {
  const [technical, setTechnical] = useState(technicalFeedback ?? "");
  const [english, setEnglish] = useState(englishFeedback ?? "");
  const [client, setClient] = useState(clientFeedback ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        await updateProspectFeedback(prospectId, { technicalFeedback: technical, englishFeedback: english, clientFeedback: client });
        toast.success("Feedback saved");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save feedback");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Technical</Label>
        <Textarea value={technical} onChange={(e) => setTechnical(e.target.value)} rows={2} placeholder="e.g. Strong" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">English</Label>
        <Textarea value={english} onChange={(e) => setEnglish(e.target.value)} rows={2} placeholder="e.g. Intermediate" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Client Feedback</Label>
        <Textarea value={client} onChange={(e) => setClient(e.target.value)} rows={2} />
      </div>
      <div className="flex justify-end">
        <Button size="sm" disabled={pending} onClick={save}>{pending ? "Saving..." : "Save Feedback"}</Button>
      </div>
    </div>
  );
}

export function ProspectNoteForm({ prospectId }: { prospectId: string }) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!text.trim()) return;
    startTransition(async () => {
      try {
        await addProspectNote(prospectId, text.trim());
        setText("");
        toast.success("Note added");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not add note");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Add a note to this prospect's timeline..." />
      <div className="flex justify-end">
        <Button size="sm" disabled={!text.trim() || pending} onClick={submit}>{pending ? "Adding..." : "Add Note"}</Button>
      </div>
    </div>
  );
}
