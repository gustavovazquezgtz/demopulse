"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acknowledgeAlert, resolveAlert } from "@/lib/actions/ai";

export function AlertActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-1.5">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(async () => { await acknowledgeAlert(id); toast.success("Alert acknowledged"); })}
      >
        Acknowledge
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(async () => { await resolveAlert(id); toast.success("Alert resolved"); })}
      >
        Resolve
      </Button>
    </div>
  );
}
