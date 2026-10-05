"use client";

import { useState } from "react";
import Link from "next/link";
import { Target } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { enumLabel, statusTone, interviewResultTone } from "@/lib/employee-bank/labels";

interface ActiveProspect {
  id: string;
  client: string | null;
  projectName: string | null;
  teamName: string | null;
  role: string;
  status: string;
  ownerName: string;
  interviewDate: Date | null;
  createdAt: Date;
  generalNotes: string | null;
  interviewAttended?: boolean | null;
  interviewResult?: string | null;
  interviewNonAttendanceReason?: string | null;
}

// A real button with controlled open state — hovering opens it on desktop,
// tapping opens it on mobile/tablet, both through the same state (section
// 35: never rely on hover alone).
export function ProspectHoverCard({ prospects }: { prospects: ActiveProspect[] }) {
  const [open, setOpen] = useState(false);
  if (prospects.length === 0) return null;

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="inline-flex items-center gap-0.5 text-primary hover:opacity-80"
          aria-label={`${prospects.length} active prospect${prospects.length === 1 ? "" : "s"}`}
        >
          <Target className="h-3.5 w-3.5" />
          {prospects.length > 1 && <span className="text-[10px] font-semibold">{prospects.length}</span>}
        </button>
      </HoverCardTrigger>
      <HoverCardContent onClick={(e) => e.stopPropagation()}>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">
          {prospects.length === 1 ? "Active Prospect" : `${prospects.length} Active Prospects`}
        </p>
        <div className="flex flex-col gap-3">
          {prospects.map((p) => (
            <div key={p.id} className="flex flex-col gap-1 border-b border-border pb-2 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{p.projectName ?? p.client ?? "Unnamed opportunity"}</span>
                <Badge variant={statusTone(p.status)} className="text-[10px]">{enumLabel(p.status)}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{p.role}{p.teamName ? ` · ${p.teamName}` : ""}</p>
              <p className="text-xs text-muted-foreground">Owner: {p.ownerName}</p>
              {p.interviewDate && (
                <p className="text-xs text-muted-foreground">Interview: {new Date(p.interviewDate).toLocaleString()}</p>
              )}
              {p.interviewAttended === true && p.interviewResult && (
                <Badge variant={interviewResultTone(p.interviewResult)} className="w-fit text-[9px]">{enumLabel(p.interviewResult)}</Badge>
              )}
              {p.interviewAttended === false && p.interviewNonAttendanceReason && (
                <Badge variant="critical" className="w-fit text-[9px]">Missed — {enumLabel(p.interviewNonAttendanceReason)}</Badge>
              )}
              {p.generalNotes && <p className="text-xs italic text-muted-foreground">&ldquo;{p.generalNotes}&rdquo;</p>}
              <Link href={`/employee-bank/prospects/${p.id}`} className="text-xs font-medium text-primary hover:underline">
                View Prospect Details →
              </Link>
            </div>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
