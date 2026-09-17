import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

export function NeedsAttentionList({
  people,
}: {
  people: { id: string; name: string; title: string | null; severity: string; alertCount: number; topAlert?: { title: string } }[];
}) {
  if (people.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-positive-muted text-positive">✓</div>
        <p className="text-sm font-medium text-foreground">No active risk signals</p>
        <p className="text-xs text-muted-foreground">Everyone is tracking well right now.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col divide-y divide-border">
      {people.map((p) => (
        <Link
          key={p.id}
          href={`/people/${p.id}`}
          className="flex items-center gap-3 py-2.5 transition-colors hover:bg-surface-muted/60 -mx-2 px-2 rounded-md"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials(p.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
            <p className="truncate text-xs text-muted-foreground">{p.topAlert?.title ?? "Growth opportunity"}</p>
          </div>
          <Badge variant={p.severity === "HIGH" ? "critical" : "warning"} className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {p.severity === "HIGH" ? "Needs attention" : "Growth opportunity"}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
