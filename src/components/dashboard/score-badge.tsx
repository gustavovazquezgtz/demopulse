import { Badge } from "@/components/ui/badge";
import { formatScore, scoreTone } from "@/lib/utils";

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  const tone = scoreTone(score);
  const variant = tone === "positive" ? "positive" : tone === "warning" ? "warning" : tone === "critical" ? "critical" : "secondary";
  return <Badge variant={variant}>{formatScore(score)}</Badge>;
}

const TREND_ARROWS: Record<string, string> = {
  IMPROVING: "↑",
  DECLINING: "↓",
  STABLE: "→",
  INSUFFICIENT_DATA: "·",
};

export function TrendIndicator({ trend, delta }: { trend: string; delta?: number | null }) {
  const arrow = TREND_ARROWS[trend] ?? "·";
  const tone = trend === "IMPROVING" ? "text-positive" : trend === "DECLINING" ? "text-critical" : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${tone}`}>
      {arrow}
      {typeof delta === "number" && delta !== 0 ? ` ${delta > 0 ? "+" : ""}${Math.round(delta)}` : ""}
    </span>
  );
}
