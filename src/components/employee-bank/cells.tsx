"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateEmployeeBankField, addEmployeeNote } from "@/lib/actions/employee-bank";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GroupBadge } from "./group-badge";

function saveError(e: unknown) {
  toast.error(e instanceof Error ? e.message : "Could not save this change");
}

export function InlineEditText({
  userId,
  field,
  value,
  placeholder,
  className,
}: {
  userId: string;
  field: "action" | "justification";
  value: string | null;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [pending, startTransition] = useTransition();

  function commit() {
    if (draft === (value ?? "")) return;
    startTransition(async () => {
      try {
        await updateEmployeeBankField(userId, { [field]: draft || null });
      } catch (e) {
        saveError(e);
        setDraft(value ?? "");
      }
    });
  }

  return (
    <input
      className={`w-full min-w-[7rem] rounded-sm border border-transparent bg-transparent px-1.5 py-1 text-xs hover:border-border focus:border-primary focus:outline-none ${className ?? ""}`}
      value={draft}
      placeholder={placeholder}
      disabled={pending}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function InlineEditNumber({
  userId,
  field,
  value,
  min,
  max,
  placeholder,
}: {
  userId: string;
  field: "rating" | "currentSalary" | "proposedSalary";
  value: number | null;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const [pending, startTransition] = useTransition();

  function commit() {
    const num = draft === "" ? null : Number(draft);
    if (num !== null && Number.isNaN(num)) {
      setDraft(value === null ? "" : String(value));
      return;
    }
    if (num === (value ?? null)) return;
    startTransition(async () => {
      try {
        await updateEmployeeBankField(userId, { [field]: num });
      } catch (e) {
        saveError(e);
        setDraft(value === null ? "" : String(value));
      }
    });
  }

  return (
    <input
      type="number"
      min={min}
      max={max}
      className="w-16 rounded-sm border border-transparent bg-transparent px-1.5 py-1 text-xs hover:border-border focus:border-primary focus:outline-none"
      value={draft}
      placeholder={placeholder}
      disabled={pending}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

/** Appends a brand-new EmployeeNote rather than editing one in place — the
 * cell always shows an empty "add a note..." box, and history lives in the
 * drawer's Notes tab, not in this cell. */
export function QuickNoteCell({ userId, latestNote }: { userId: string; latestNote: string | null }) {
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  function commit() {
    if (!draft.trim()) return;
    startTransition(async () => {
      try {
        await addEmployeeNote(userId, "STAFFING", draft.trim());
        setDraft("");
      } catch (e) {
        saveError(e);
      }
    });
  }

  return (
    <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
      {latestNote && <p className="truncate text-[10px] text-muted-foreground" title={latestNote}>{latestNote}</p>}
      <input
        className="w-full min-w-[8rem] rounded-sm border border-transparent bg-transparent px-1.5 py-1 text-xs hover:border-border focus:border-primary focus:outline-none"
        value={draft}
        placeholder="Add a note..."
        disabled={pending}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

export function GroupCell({
  userId,
  group,
  suggestedGroup,
  groupOverrideNote,
}: {
  userId: string;
  group: "A" | "B" | "C" | null;
  suggestedGroup: "A" | "B" | "C" | null;
  groupOverrideNote: string | null;
}) {
  const [pendingValue, setPendingValue] = useState<"A" | "B" | "C" | null>(null);
  const [note, setNote] = useState(groupOverrideNote ?? "");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function apply(value: "A" | "B" | "C", overrideNote?: string) {
    startTransition(async () => {
      try {
        await updateEmployeeBankField(userId, { group: value, groupOverrideNote: overrideNote ?? null });
        setPopoverOpen(false);
      } catch (e) {
        saveError(e);
      }
    });
  }

  function onChange(value: string) {
    const v = value as "A" | "B" | "C";
    if (suggestedGroup && v !== suggestedGroup) {
      setPendingValue(v);
      setPopoverOpen(true);
      return;
    }
    apply(v);
  }

  const differs = group !== null && suggestedGroup !== null && group !== suggestedGroup;

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <div>
            <Select value={group ?? undefined} onValueChange={onChange} disabled={pending}>
              <SelectTrigger className="h-7 w-[4.5rem] text-xs">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">A</SelectItem>
                <SelectItem value="B">B</SelectItem>
                <SelectItem value="C">C</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-72" onClick={(e) => e.stopPropagation()}>
          <p className="mb-2 text-xs font-medium text-foreground">
            Manual classification differs from suggested classification.
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            Suggested: <GroupBadge group={suggestedGroup} /> — explain why {pendingValue} is the right call.
          </p>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Why this employee is being classified differently..." />
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPopoverOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={!note.trim() || pending} onClick={() => pendingValue && apply(pendingValue, note.trim())}>
              Save
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {differs && <span title="Manual classification differs from suggested classification." className="text-warning">⚠</span>}
    </div>
  );
}
