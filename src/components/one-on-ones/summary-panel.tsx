"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { generateOneOnOneSummary, updateOneOnOne } from "@/lib/actions/one-on-ones";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export function SummaryPanel({
  sessionId,
  summary,
  summarySource,
}: {
  sessionId: string;
  summary: string | null;
  summarySource: string | null;
}) {
  const [draft, setDraft] = useState(summary ?? "");
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      try {
        const result = await generateOneOnOneSummary(sessionId);
        setDraft(result);
        setEditing(false);
        toast.success("Summary generated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not generate summary");
      }
    });
  }

  function saveManual() {
    startTransition(async () => {
      try {
        await updateOneOnOne(sessionId, { summary: draft });
        setEditing(false);
        toast.success("Summary saved");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save summary");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {summarySource && (
            <Badge variant="secondary" className="text-[10px]">
              {summarySource === "openai" ? "AI-generated" : summarySource === "MANUAL" ? "Manually written" : summarySource}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {!editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
          )}
          <Button size="sm" variant="outline" disabled={pending} onClick={generate}>
            <Sparkles className="h-3.5 w-3.5" /> {summary ? "Regenerate" : "Generate"} Summary
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setDraft(summary ?? ""); setEditing(false); }}>Cancel</Button>
            <Button size="sm" disabled={pending} onClick={saveManual}>Save</Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm text-foreground">
          {draft || <span className="text-muted-foreground">No summary yet — add recommendations/feedback or a recording, then generate one.</span>}
        </p>
      )}
    </div>
  );
}
