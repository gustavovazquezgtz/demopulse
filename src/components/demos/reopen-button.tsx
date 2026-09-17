"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { reopenDemo } from "@/lib/actions/demos";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

export function ReopenButton({ demoId }: { demoId: string }) {
  const [pending, startTransition] = useTransition();

  function reopen() {
    startTransition(async () => {
      try {
        await reopenDemo(demoId);
        toast.success("Session reopened — you can edit participants and evaluations again.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not reopen session");
      }
    });
  }

  return (
    <Button variant="outline" onClick={reopen} disabled={pending}>
      <RotateCcw className="h-3.5 w-3.5" /> {pending ? "Reopening..." : "Reopen Demo"}
    </Button>
  );
}
