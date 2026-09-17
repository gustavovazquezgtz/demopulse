"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { recordAttendance, updateDemoStatus } from "@/lib/actions/demos";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, cn } from "@/lib/utils";

type Status = "PRESENT" | "ABSENT" | "EXCUSED";
const OPTIONS: Status[] = ["PRESENT", "ABSENT", "EXCUSED"];

export function AttendanceForm({
  demoId,
  invitees,
  initialStatus,
  canMarkComplete,
}: {
  demoId: string;
  invitees: { userId: string; name: string; role: string }[];
  initialStatus: Record<string, Status>;
  canMarkComplete: boolean;
}) {
  const [statuses, setStatuses] = useState<Record<string, Status>>(initialStatus);
  const [pending, startTransition] = useTransition();

  function save(andComplete = false) {
    startTransition(async () => {
      try {
        await recordAttendance(
          demoId,
          Object.entries(statuses).map(([userId, status]) => ({ userId, status }))
        );
        if (andComplete) {
          await updateDemoStatus(demoId, "COMPLETED");
          toast.success("Attendance saved and demo marked completed");
        } else {
          toast.success("Attendance saved");
        }
      } catch {
        toast.error("Could not save attendance");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      {invitees.map((inv) => (
        <div key={inv.userId} className="flex items-center gap-3 py-1.5">
          <Avatar className="h-7 w-7">
            <AvatarFallback>{initials(inv.name)}</AvatarFallback>
          </Avatar>
          <span className="flex-1 text-sm text-foreground">{inv.name}</span>
          <div className="flex gap-1">
            {OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setStatuses((s) => ({ ...s, [inv.userId]: opt }))}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                  statuses[inv.userId] === opt
                    ? opt === "PRESENT"
                      ? "border-positive bg-positive-muted text-positive"
                      : opt === "ABSENT"
                      ? "border-critical bg-critical-muted text-critical"
                      : "border-warning bg-warning-muted text-warning"
                    : "border-border text-muted-foreground hover:bg-surface-muted"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => save(false)} disabled={pending}>
          Save Attendance
        </Button>
        {canMarkComplete && (
          <Button size="sm" onClick={() => save(true)} disabled={pending}>
            Save &amp; Mark Completed
          </Button>
        )}
      </div>
    </div>
  );
}
