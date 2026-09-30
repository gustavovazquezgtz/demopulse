import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Group A = positive/high-performance, B = attention/evaluation, C = risk/
// review — same visual language ScoreBadge uses elsewhere, never color-only
// (the letter itself is always shown, section 34).
const GROUP_VARIANT = { A: "positive", B: "warning", C: "critical" } as const;

export function GroupBadge({ group, className }: { group: "A" | "B" | "C" | null; className?: string }) {
  if (!group) return <Badge variant="outline" className={className}>Unclassified</Badge>;
  return (
    <Badge variant={GROUP_VARIANT[group]} className={cn("font-semibold", className)}>
      {group}
    </Badge>
  );
}
