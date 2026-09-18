"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateDemoStatus } from "@/lib/actions/demos";
import { Button } from "@/components/ui/button";

export function CancelDemoButton({ demoId }: { demoId: string }) {
  const [pending, startTransition] = useTransition();

  function cancel() {
    if (!confirm("Cancel this demo session? It stays visible but marked Cancelled.")) return;
    startTransition(async () => {
      try {
        await updateDemoStatus(demoId, "CANCELLED");
        toast.success("Demo session cancelled");
      } catch {
        toast.error("Could not cancel this session");
      }
    });
  }

  return (
    <Button variant="ghost" onClick={cancel} disabled={pending} className="text-critical hover:text-critical">
      {pending ? "Cancelling..." : "Cancel"}
    </Button>
  );
}
