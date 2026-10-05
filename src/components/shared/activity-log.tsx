import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History } from "lucide-react";

interface ActivityEntry {
  id: string;
  action: string;
  actorName: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: Date;
}

const ACTION_LABEL: Record<string, string> = {
  CREATE: "Created",
  MOVE_TEAM: "Team changed",
  JOINED_TEAM: "Joined a team",
  LEFT_TEAM: "Left a team",
  MEMBER_JOINED: "Member joined",
  MEMBER_LEFT: "Member left",
  MANAGER_CHANGED: "Manager changed",
  MANAGER_JOINED: "Manager joined",
  MANAGER_LEFT: "Manager left",
  MOVE_MANAGER_TEAMS: "Teams reassigned",
  UPDATE_TEAMS: "Teams updated",
  UPDATE_MANAGERS: "Managers updated",
  UPDATE_PARTICIPANTS: "Participants updated",
  RESCHEDULE: "Rescheduled",
  START: "Started",
  REOPEN: "Reopened",
  UPDATE_BANK_PROFILE: "Bank profile updated",
  STATUS_CHANGE: "Status changed",
  NOTE: "Note added",
  FEEDBACK: "Feedback updated",
  OUTCOME: "Outcome recorded",
  UPDATE: "Updated",
  RECORDING_ADDED: "Recording added",
  RECORDING_REMOVED: "Recording removed",
  SUMMARY_GENERATED: "Summary generated",
  INTERVIEW_OUTCOME: "Interview outcome recorded",
  ASSIGNED_TO_OPERATIONS: "Assigned to Operations",
  UNASSIGNED_FROM_OPERATIONS: "Removed from Operations",
};

function describe(entry: ActivityEntry): string {
  const { action, before, after } = entry;
  if (action === "MEMBER_JOINED" && after?.member) {
    return `${after.member} joined${before?.movedFrom ? ` (from ${before.movedFrom})` : ""}`;
  }
  if (action === "MEMBER_LEFT" && before?.member) {
    return `${before.member} left${after?.movedTo ? ` (to ${after.movedTo})` : ""}`;
  }
  if (action === "MOVE_TEAM" && before?.teams && after?.teams) {
    return `Moved from ${(before.teams as string[]).join(", ") || "no team"} to ${(after.teams as string[]).join(", ")}`;
  }
  if (action === "JOINED_TEAM" && after?.team) {
    return `Joined ${after.team}`;
  }
  if (action === "LEFT_TEAM" && before?.team) {
    return `Left ${before.team}`;
  }
  if (action === "MANAGER_CHANGED" && before?.managers && after?.managers) {
    return `${(before.managers as string[]).join(", ") || "—"} → ${(after.managers as string[]).join(", ")}`;
  }
  if (action === "MANAGER_JOINED" && after?.manager) {
    return `${after.manager} became a manager of this team`;
  }
  if (action === "MANAGER_LEFT" && before?.manager) {
    return `${before.manager} is no longer a manager of this team`;
  }
  if (action === "MOVE_MANAGER_TEAMS" && before?.teams && after?.teams) {
    return `Now manages ${(after.teams as string[]).join(", ") || "no team"} (was ${(before.teams as string[]).join(", ") || "no team"})`;
  }
  if (action === "CREATE" && after?.name) {
    return `"${after.name}" created`;
  }
  if (action === "CREATE" && after?.role) {
    return `Prospect created for ${(after.projectId ? "project" : after.client ? String(after.client) : "role")}: ${after.role}`;
  }
  if (action === "STATUS_CHANGE" && before?.status && after?.status) {
    return `${String(before.status).replaceAll("_", " ")} → ${String(after.status).replaceAll("_", " ")}`;
  }
  if (action === "NOTE" && after?.text) {
    return `"${after.text}"`;
  }
  if (action === "OUTCOME" && after?.outcomeNotes) {
    return `"${after.outcomeNotes}"`;
  }
  if (action === "FEEDBACK") {
    return "Technical/English/client feedback updated";
  }
  if (action === "UPDATE_BANK_PROFILE" && after) {
    return Object.entries(after as Record<string, unknown>)
      .filter(([k]) => k !== "groupOverrideNote")
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  }
  if (action === "UPDATE" && after) {
    return Object.entries(after as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  }
  if (action === "RECORDING_ADDED" && after?.sizeBytes) {
    const kb = Math.round(Number(after.sizeBytes) / 1024);
    return `${kb} KB${after.transcribed ? " · transcribed" : ""}`;
  }
  if (action === "SUMMARY_GENERATED" && after?.source) {
    return `via ${after.source}`;
  }
  if (action === "INTERVIEW_OUTCOME" && after) {
    if (after.attended) return `Attended — ${String(after.result).replaceAll("_", " ")}`;
    return `Did not attend — ${String(after.reason).replaceAll("_", " ")}`;
  }
  if (action === "ASSIGNED_TO_OPERATIONS") {
    return after?.projectId ? "Linked to an account/project" : "No specific account linked yet";
  }
  return ACTION_LABEL[action] ?? action;
}

export function ActivityLog({ entries }: { entries: ActivityEntry[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <History className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-sm">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {entries.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No changes recorded yet.</p>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-3 border-b border-border py-2 text-sm last:border-0">
              <div>
                <span className="font-medium text-foreground">{ACTION_LABEL[e.action] ?? e.action}</span>
                <span className="text-muted-foreground"> — {describe(e)}</span>
              </div>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {e.actorName} · {e.createdAt.toLocaleDateString()}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
