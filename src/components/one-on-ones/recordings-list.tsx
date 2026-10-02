"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteOneOnOneRecording } from "@/lib/actions/one-on-ones";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Recording {
  id: string;
  mimeType: string;
  sizeBytes: number;
  transcript: string | null;
  createdAt: Date;
}

export function RecordingsList({ recordings }: { recordings: Recording[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteOneOnOneRecording(id);
        toast.success("Recording removed");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not remove recording");
      }
    });
  }

  if (recordings.length === 0) {
    return <p className="py-2 text-center text-sm text-muted-foreground">No recordings yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {recordings.map((r, i) => (
        <div key={r.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Recording {i + 1}</span>
              <span className="text-xs text-muted-foreground">{Math.round(r.sizeBytes / 1024)} KB</span>
              {r.transcript ? (
                <Badge variant="positive" className="text-[10px]">Transcribed</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">No transcript</Badge>
              )}
            </div>
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-critical" disabled={pending} onClick={() => remove(r.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <audio controls src={`/api/one-on-ones/recordings/${r.id}`} className="h-8 w-full" />
          {r.transcript && (
            <div>
              <button
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              >
                {expanded === r.id ? "Hide transcript" : "Show transcript"}
              </button>
              {expanded === r.id && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{r.transcript}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
