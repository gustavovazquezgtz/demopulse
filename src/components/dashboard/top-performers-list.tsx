import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "./score-badge";
import { initials } from "@/lib/utils";

const MEDALS = ["🥇", "🥈", "🥉"];

export function TopPerformersList({
  people,
}: {
  people: { id: string; name: string; title: string | null; avgScore: number; evaluationCount: number; confidence: string }[];
}) {
  if (people.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No evaluated people yet.</p>;
  }
  return (
    <div className="flex flex-col divide-y divide-border">
      {people.map((p, i) => (
        <Link
          key={p.id}
          href={`/people/${p.id}`}
          className="flex items-center gap-3 py-2.5 transition-colors hover:bg-surface-muted/60 -mx-2 px-2 rounded-md"
        >
          <span className="w-5 text-center text-sm">{MEDALS[i] ?? i + 1}</span>
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials(p.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
            <p className="truncate text-xs text-muted-foreground">{p.title ?? "Developer"}</p>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {p.confidence} confidence
          </Badge>
          <ScoreBadge score={p.avgScore} />
        </Link>
      ))}
    </div>
  );
}
