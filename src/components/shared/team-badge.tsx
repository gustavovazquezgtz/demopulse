import { Badge } from "@/components/ui/badge";
import { OPERATIONS_TEAM_NAME } from "@/lib/employee-bank/labels";

/** A team badge that renders green (the same "positive" token used
 * everywhere else for good/placed outcomes) when it's the "Operaciones"
 * team — making it visually obvious at a glance that someone has been
 * placed on a client account and is no longer on their internal team. */
export function TeamBadge({ name, className }: { name: string; className?: string }) {
  const isOperations = name === OPERATIONS_TEAM_NAME;
  return (
    <Badge variant={isOperations ? "positive" : "secondary"} className={className}>
      {name}
    </Badge>
  );
}
