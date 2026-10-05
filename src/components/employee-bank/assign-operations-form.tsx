"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { assignToOperations, unassignFromOperations } from "@/lib/actions/employee-bank";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function AssignOperationsForm({
  userId,
  assignedToOperations,
  assignedToOperationsAt,
  operationsProjectName,
  allProjects,
}: {
  userId: string;
  assignedToOperations: boolean;
  assignedToOperationsAt: Date | null;
  operationsProjectName: string | null;
  allProjects: { id: string; name: string }[];
}) {
  const [projectId, setProjectId] = useState("");
  const [pending, startTransition] = useTransition();

  function assign() {
    startTransition(async () => {
      try {
        await assignToOperations(userId, projectId || undefined);
        toast.success("Marked as assigned to an Operations project");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not assign");
      }
    });
  }

  function unassign() {
    startTransition(async () => {
      try {
        await unassignFromOperations(userId);
        toast.success("Removed from Operations assignment");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update");
      }
    });
  }

  if (assignedToOperations) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-positive/30 bg-positive-muted/30 p-3">
        <div>
          <Badge variant="positive" className="mb-1">Assigned to Operations</Badge>
          <p className="text-xs text-muted-foreground">
            {operationsProjectName ? `Account: ${operationsProjectName}` : "No specific account linked"}
            {assignedToOperationsAt ? ` · since ${new Date(assignedToOperationsAt).toLocaleDateString()}` : ""}
          </p>
        </div>
        <Button size="sm" variant="ghost" disabled={pending} onClick={unassign}>Remove</Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={projectId || undefined} onValueChange={setProjectId}>
        <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="Account / project (optional)..." /></SelectTrigger>
        <SelectContent>
          {allProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button size="sm" disabled={pending} onClick={assign}>{pending ? "Saving..." : "Dar de Alta"}</Button>
    </div>
  );
}
