"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { saveEvaluation } from "@/lib/actions/demos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";
import { Check, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface Criterion {
  id: string;
  text: string;
  dimension: string;
}

interface TeamRef {
  id: string;
  name: string;
}

interface DeveloperState {
  id: string;
  name: string;
  title: string | null;
  teams: TeamRef[];
  attendanceStatus: "PRESENT" | "ABSENT" | "EXCUSED" | null;
  completed: boolean;
  overallComment: string;
  strengths: string;
  areasForImprovement: string;
  answers: Record<string, boolean>;
  comments: Record<string, string>;
}

export function EvaluateClient({
  demoId,
  demoTitle,
  teams,
  criteria,
  developers: initialDevelopers,
}: {
  demoId: string;
  demoTitle: string;
  teams: TeamRef[];
  criteria: Criterion[];
  developers: DeveloperState[];
}) {
  const [developers, setDevelopers] = useState(initialDevelopers);
  const [index, setIndex] = useState(0);
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = developers[index];
  const completedCount = developers.filter((d) => d.completed).length;
  const allAnswered = criteria.every((c) => current.answers[c.id] !== undefined);

  const visibleDevelopers = teamFilter === "ALL" ? developers : developers.filter((d) => d.teams.some((t) => t.id === teamFilter));

  function selectTeamFilter(id: string) {
    setTeamFilter(id);
    const stillVisible = id === "ALL" || current.teams.some((t) => t.id === id);
    if (!stillVisible) {
      const firstMatch = developers.findIndex((d) => id === "ALL" || d.teams.some((t) => t.id === id));
      if (firstMatch >= 0) setIndex(firstMatch);
    }
  }

  function updateCurrent(patch: Partial<DeveloperState>) {
    setDevelopers((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function scheduleAutosave() {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(false), 900);
  }

  async function doSave(complete: boolean) {
    const dev = developers[index];
    try {
      await saveEvaluation(demoId, {
        developerId: dev.id,
        answers: criteria
          .filter((c) => dev.answers[c.id] !== undefined)
          .map((c) => ({ criterionId: c.id, answer: dev.answers[c.id], comment: dev.comments[c.id] || undefined })),
        overallComment: dev.overallComment || undefined,
        strengths: dev.strengths || undefined,
        areasForImprovement: dev.areasForImprovement || undefined,
        complete,
      });
      setSaveState("saved");
      if (complete) {
        setDevelopers((prev) => prev.map((d, i) => (i === index ? { ...d, completed: true } : d)));
        toast.success(`Evaluation for ${dev.name} completed`);
      }
    } catch (e) {
      setSaveState("idle");
      toast.error(e instanceof Error ? e.message : "Could not save evaluation");
    }
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  async function completeAndNext() {
    await doSave(true);
    if (index < developers.length - 1) setIndex(index + 1);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <Link href={`/demos/${demoId}`} className="text-xs text-muted-foreground hover:underline">
          ← Back to demo
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-foreground">Evaluate Team — {demoTitle}</h1>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={(completedCount / developers.length) * 100} className="flex-1" />
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {completedCount} / {developers.length} developers evaluated
          </span>
        </div>
      </div>

      {teams.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => selectTeamFilter("ALL")}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              teamFilter === "ALL" ? "border-primary bg-primary-muted text-primary" : "border-border text-muted-foreground hover:bg-surface-muted"
            )}
          >
            All Teams
          </button>
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTeamFilter(t.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                teamFilter === t.id ? "border-primary bg-primary-muted text-primary" : "border-border text-muted-foreground hover:bg-surface-muted"
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {visibleDevelopers.map((d) => {
          const i = developers.findIndex((dev) => dev.id === d.id);
          return (
            <button
              key={d.id}
              onClick={() => setIndex(i)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                i === index ? "border-primary bg-primary-muted text-primary" : "border-border text-muted-foreground hover:bg-surface-muted"
              )}
            >
              {d.completed && <Check className="h-3 w-3" />}
              {d.name.split(" ")[0]}
              {d.attendanceStatus && d.attendanceStatus !== "PRESENT" && (
                <span className="h-1.5 w-1.5 rounded-full bg-warning" title={d.attendanceStatus} />
              )}
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <Avatar className="h-9 w-9">
            <AvatarFallback>{initials(current.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle>{current.name}</CardTitle>
              {current.attendanceStatus && current.attendanceStatus !== "PRESENT" && (
                <Badge variant="warning" className="text-[10px]">
                  Marked {current.attendanceStatus.charAt(0) + current.attendanceStatus.slice(1).toLowerCase()} — still evaluable
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {current.title ?? "Developer"}
              {current.teams.length > 0 && <> · {current.teams.map((t) => t.name).join(", ")}</>}
            </p>
          </div>
          {current.completed && (
            <div className="flex flex-col items-end gap-0.5">
              <Badge variant="positive">Completed</Badge>
              <span className="text-[10px] text-muted-foreground">Still editable — changes save automatically</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {criteria.map((c) => (
            <div key={c.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
              <p className="text-sm font-medium text-foreground">{c.text}</p>
              <p className="mb-2 text-xs text-muted-foreground">{c.dimension}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    updateCurrent({ answers: { ...current.answers, [c.id]: true } });
                    scheduleAutosave();
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                    current.answers[c.id] === true ? "border-positive bg-positive-muted text-positive" : "border-border text-muted-foreground hover:bg-surface-muted"
                  )}
                >
                  <Check className="h-3.5 w-3.5" /> Yes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateCurrent({ answers: { ...current.answers, [c.id]: false } });
                    scheduleAutosave();
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                    current.answers[c.id] === false ? "border-critical bg-critical-muted text-critical" : "border-border text-muted-foreground hover:bg-surface-muted"
                  )}
                >
                  <X className="h-3.5 w-3.5" /> No
                </button>
              </div>
              <Textarea
                className="mt-2"
                rows={1}
                placeholder="Optional comment"
                value={current.comments[c.id] ?? ""}
                onChange={(e) => {
                  updateCurrent({ comments: { ...current.comments, [c.id]: e.target.value } });
                  scheduleAutosave();
                }}
              />
            </div>
          ))}

          <div className="flex flex-col gap-3">
            <div>
              <Label>Overall comment</Label>
              <Textarea
                rows={2}
                value={current.overallComment}
                onChange={(e) => {
                  updateCurrent({ overallComment: e.target.value });
                  scheduleAutosave();
                }}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Strengths</Label>
                <Textarea
                  rows={2}
                  value={current.strengths}
                  onChange={(e) => {
                    updateCurrent({ strengths: e.target.value });
                    scheduleAutosave();
                  }}
                />
              </div>
              <div>
                <Label>Areas for improvement</Label>
                <Textarea
                  rows={2}
                  value={current.areasForImprovement}
                  onChange={(e) => {
                    updateCurrent({ areasForImprovement: e.target.value });
                    scheduleAutosave();
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {saveState === "saving" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
            </>
          )}
          {saveState === "saved" && "Saved"}
        </span>
        {index < developers.length - 1 ? (
          <Button onClick={completeAndNext} disabled={!allAnswered}>
            {current.completed ? "Save & Next" : "Complete & Next"} <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => doSave(true)} disabled={!allAnswered}>
            {current.completed ? "Save Changes" : "Complete Evaluation"}
          </Button>
        )}
      </div>
    </div>
  );
}
