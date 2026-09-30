"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProspectStatus } from "@/lib/actions/prospects";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROSPECT_STATUS_OPTIONS, PROSPECT_OUTCOME_REASON_OPTIONS, enumLabel, requiresOutcomeReasonLabel } from "@/lib/employee-bank/labels";
import { requiresOutcomeReason } from "@/lib/employee-bank/scoring";

function toDateInput(d: Date | null) {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function ProspectStatusForm({
  prospectId,
  currentStatus,
  interviewDate,
}: {
  prospectId: string;
  currentStatus: string;
  interviewDate: Date | null;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [outcomeReason, setOutcomeReason] = useState("");
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [interview, setInterview] = useState(toDateInput(interviewDate));
  const [pending, startTransition] = useTransition();

  const needsOutcome = requiresOutcomeReason(status) && status !== currentStatus;
  const canSave = status !== currentStatus && (!needsOutcome || outcomeReason);

  function save() {
    startTransition(async () => {
      try {
        await updateProspectStatus(prospectId, status, {
          outcomeReason: outcomeReason || undefined,
          outcomeNotes: outcomeNotes || undefined,
          interviewDate: interview || undefined,
        });
        toast.success("Prospect updated");
        setOutcomeReason("");
        setOutcomeNotes("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update prospect");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROSPECT_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{enumLabel(s)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Interview Date</Label>
          <Input type="date" value={interview} onChange={(e) => setInterview(e.target.value)} />
        </div>
      </div>

      {needsOutcome && (
        <div className="flex flex-col gap-3 rounded-md border border-warning/40 bg-warning-muted/40 p-3">
          <p className="text-xs font-medium text-foreground">{requiresOutcomeReasonLabel(status)}</p>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Outcome Reason</Label>
            <Select value={outcomeReason} onValueChange={setOutcomeReason}>
              <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
              <SelectContent>
                {PROSPECT_OUTCOME_REASON_OPTIONS.map((r) => <SelectItem key={r} value={r}>{enumLabel(r)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Outcome Notes</Label>
            <Textarea value={outcomeNotes} onChange={(e) => setOutcomeNotes(e.target.value)} rows={2} placeholder="What happened, in the manager's own words..." />
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" disabled={!canSave || pending} onClick={save}>{pending ? "Saving..." : "Update Status"}</Button>
      </div>
    </div>
  );
}
