"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addOneOnOneNote } from "@/lib/actions/one-on-ones";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Note {
  id: string;
  text: string;
  authorName: string;
  createdAt: Date;
}

/** Append-only follow-ups — "quiero poder... agregar más información"
 * after the original capture, without overwriting anything. */
export function OneOnOneNotes({ sessionId, notes }: { sessionId: string; notes: Note[] }) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!text.trim()) return;
    startTransition(async () => {
      try {
        await addOneOnOneNote(sessionId, text.trim());
        setText("");
        toast.success("Note added");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not add note");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Add a follow-up note..." />
        <div className="flex justify-end">
          <Button size="sm" disabled={!text.trim() || pending} onClick={submit}>{pending ? "Adding..." : "Add Note"}</Button>
        </div>
      </div>
      {notes.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          {notes.map((n) => (
            <div key={n.id} className="rounded-md border border-border p-2.5 text-sm">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{n.authorName}</span>
                <span>{n.createdAt.toLocaleString()}</span>
              </div>
              <p className="text-foreground">{n.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
