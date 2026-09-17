import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  suffix,
  hint,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: "neutral" | "positive" | "warning" | "critical";
  suffix?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md",
              tone === "positive" && "bg-positive-muted text-positive",
              tone === "warning" && "bg-warning-muted text-warning",
              tone === "critical" && "bg-critical-muted text-critical",
              tone === "neutral" && "bg-primary-muted text-primary"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
        {suffix && <span className="ml-0.5 text-sm font-normal text-muted-foreground">{suffix}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
