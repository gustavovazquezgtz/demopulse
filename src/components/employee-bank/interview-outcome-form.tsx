"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateInterviewOutcome } from "@/lib/actions/prospects";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  INTERVIEW_RESULT_OPTIONS,
  INTERVIEW_NON_ATTENDANCE_REASON_OPTIONS,
  enumLabel,
  interviewResultTone,
} from "@/lib/employee-bank/labels";

export function InterviewOutcomeForm({
  prospectId,
  interviewAttended,
  interviewResult,
  interviewNonAttendanceReason,
  interviewNonAttendanceNotes,
}: {
  prospectId: string;
  interviewAttended: boolean | null;
  interviewResult: string | null;
  interviewNonAttendanceReason: string | null;
  interviewNonAttendanceNotes: string | null;
}) {
  const [attended, setAttended] = useState<boolean | null>(interviewAttended);
  const [result, setResult] = useState(interviewResult ?? "");
  const [reason, setReason] = useState(interviewNonAttendanceReason ?? "");
  const [notes, setNotes] = useState(interviewNonAttendanceNotes ?? "");
  const [pending, startTransition] = useTransition();

  const canSave = attended !== null && (attended ? !!result : !!reason);

  function save() {
    if (attended === null) return;
    startTransition(async () => {
      try {
        await updateInterviewOutcome(prospectId, {
          attended,
          result: attended ? result : undefined,
          nonAttendanceReason: !attended ? reason : undefined,
          nonAttendanceNotes: !attended ? notes : undefined,
        });
        toast.success("Interview outcome saved");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {interviewAttended !== null && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Currently recorded:</span>
          {interviewAttended ? (
            <Badge variant={interviewResultTone(interviewResult ?? "")}>{enumLabel(interviewResult ?? "")}</Badge>
          ) : (
            <Badge variant="critical">Did not attend — {enumLabel(interviewNonAttendanceReason ?? "")}</Badge>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Did they attend the interview?</Label>
        <div className="flex gap-2">
          <Button size="sm" variant={attended === true ? "default" : "outline"} onClick={() => setAttended(true)}>Yes, attended</Button>
          <Button size="sm" variant={attended === false ? "default" : "outline"} onClick={() => setAttended(false)}>No, did not attend</Button>
        </div>
      </div>

      {attended === true && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">How did it go?</Label>
          <Select value={result} onValueChange={setResult}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {INTERVIEW_RESULT_OPTIONS.map((r) => <SelectItem key={r} value={r}>{enumLabel(r)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {attended === false && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Why didn&apos;t they go?</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Select a reason..." /></SelectTrigger>
              <SelectContent>
                {INTERVIEW_NON_ATTENDANCE_REASON_OPTIONS.map((r) => <SelectItem key={r} value={r}>{enumLabel(r)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </>
      )}

      <div className="flex justify-end">
        <Button size="sm" disabled={!canSave || pending} onClick={save}>{pending ? "Saving..." : "Save Interview Outcome"}</Button>
      </div>
    </div>
  );
}
