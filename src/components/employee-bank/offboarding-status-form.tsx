"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setOffboardingStatus, clearOffboardingStatus } from "@/lib/actions/employee-bank";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OFFBOARDING_STATUS_OPTIONS, offboardingStatusLabel } from "@/lib/employee-bank/labels";

export function OffboardingStatusForm({
  userId,
  offboardingStatus,
  offboardingSetAt,
}: {
  userId: string;
  offboardingStatus: string | null;
  offboardingSetAt: Date | null;
}) {
  const [status, setStatus] = useState(offboardingStatus ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    if (!status) return;
    startTransition(async () => {
      try {
        await setOffboardingStatus(userId, status as never);
        toast.success("Offboarding status updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update status");
      }
    });
  }

  function clear() {
    startTransition(async () => {
      try {
        await clearOffboardingStatus(userId);
        setStatus("");
        toast.success("Offboarding status cleared");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not clear status");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {offboardingStatus && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-critical/30 bg-critical-muted/30 p-3">
          <div>
            <Badge variant="critical" className="mb-1">{offboardingStatusLabel(offboardingStatus)}</Badge>
            {offboardingSetAt && <p className="text-xs text-muted-foreground">since {new Date(offboardingSetAt).toLocaleDateString()}</p>}
          </div>
          <Button size="sm" variant="ghost" disabled={pending} onClick={clear}>Clear</Button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Select value={status || undefined} onValueChange={setStatus}>
          <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="Dar de baja..." /></SelectTrigger>
          <SelectContent>
            {OFFBOARDING_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{offboardingStatusLabel(s)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="destructive" disabled={!status || pending} onClick={save}>Dar de Baja</Button>
      </div>
    </div>
  );
}
