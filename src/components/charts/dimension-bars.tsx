import { Progress } from "@/components/ui/progress";
import { formatScore, scoreTone } from "@/lib/utils";

export function DimensionBars({ dimensions }: { dimensions: { label: string; value: number }[] }) {
  return (
    <div className="flex flex-col gap-3">
      {dimensions.map((d) => {
        const tone = scoreTone(d.value);
        return (
          <div key={d.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{d.label}</span>
              <span className="text-muted-foreground">{formatScore(d.value)}%</span>
            </div>
            <Progress
              value={d.value}
              indicatorClassName={
                tone === "positive" ? "bg-positive" : tone === "warning" ? "bg-warning" : tone === "critical" ? "bg-critical" : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}
