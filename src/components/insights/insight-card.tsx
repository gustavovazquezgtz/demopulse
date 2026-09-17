import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, TrendingDown, Award, Lightbulb, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_META: Record<string, { icon: typeof Sparkles; label: string; tone: string }> = {
  STRENGTH: { icon: TrendingUp, label: "Strength", tone: "positive" },
  DEVELOPMENT: { icon: Lightbulb, label: "Development opportunity", tone: "warning" },
  RISK: { icon: TrendingDown, label: "Risk signal", tone: "critical" },
  RECOGNITION: { icon: Award, label: "Recognition", tone: "positive" },
  RECOMMENDATION: { icon: Lightbulb, label: "Recommended follow-up", tone: "info" },
  TREND: { icon: TrendingDown, label: "Trend", tone: "warning" },
  SUMMARY: { icon: FileText, label: "Summary", tone: "neutral" },
};

export function InsightCard({
  type,
  title,
  body,
  evidence,
}: {
  type: string;
  title: string;
  body: string;
  evidence?: { details?: string[] } | null;
}) {
  const meta = TYPE_META[type] ?? TYPE_META.SUMMARY;
  const Icon = meta.icon;
  const details = evidence?.details ?? [];

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            meta.tone === "positive" && "bg-positive-muted text-positive",
            meta.tone === "warning" && "bg-warning-muted text-warning",
            meta.tone === "critical" && "bg-critical-muted text-critical",
            meta.tone === "info" && "bg-info-muted text-info",
            meta.tone === "neutral" && "bg-neutral-muted text-muted-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {meta.label}
            </Badge>
          </div>
          <p className="mt-1.5 text-sm font-medium text-foreground">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
          {details.length > 0 && (
            <details className="mt-2 group">
              <summary className="cursor-pointer text-xs font-medium text-primary select-none">
                Why am I seeing this?
              </summary>
              <ul className="mt-1.5 flex flex-col gap-1 rounded-md bg-surface-muted p-2.5 text-xs text-muted-foreground">
                {details.map((d, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-border-strong">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
