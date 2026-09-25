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
