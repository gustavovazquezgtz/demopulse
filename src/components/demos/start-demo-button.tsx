"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { startDemo } from "@/lib/actions/demos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Play } from "lucide-react";

export function StartDemoButton({ demoId }: { demoId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirmStart() {
    startTransition(async () => {
      try {
        await startDemo(demoId);
      } catch (e) {
        if (e instanceof Error && e.message === "NEXT_REDIRECT") return;
        toast.error(e instanceof Error ? e.message : "Could not start this session");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Play className="h-3.5 w-3.5" /> Start Demo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start this Demo Session?</DialogTitle>
          <DialogDescription>
            This will begin the evaluation session for the selected participants. Everyone invited will be marked
            present by default — you can adjust attendance afterward.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={confirmStart} disabled={pending}>
            {pending ? "Starting..." : "Start Demo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
