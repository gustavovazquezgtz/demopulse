import { requireSession } from "@/lib/permissions";
import { UNSCOPED } from "@/lib/queries/dashboard";
import { listInsights } from "@/lib/queries/ai-feeds";
import { InsightCard } from "@/components/insights/insight-card";
import Link from "next/link";

export default async function InsightsPage() {
  await requireSession();
  const scope = UNSCOPED; // every manager sees the full org (CEO parity), per explicit product decision
  const insights = await listInsights(scope);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">AI Insights</h1>
        <p className="text-sm text-muted-foreground">Strengths, development opportunities, and trends — every one traceable to source data.</p>
      </div>

      {insights.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No insights yet — they generate automatically as evaluations complete.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {insights.map((i) => (
            <div key={i.id}>
              {i.subjectId && i.subjectType === "PERSON" ? (
                <Link href={`/people/${i.subjectId}`} className="mb-1 block text-xs font-medium text-primary">
                  {i.subjectName}
                </Link>
              ) : i.subjectId && i.subjectType === "TEAM" ? (
                <Link href={`/teams/${i.subjectId}`} className="mb-1 block text-xs font-medium text-primary">
                  {i.subjectName}
                </Link>
              ) : (
                <span className="mb-1 block text-xs font-medium text-primary">Organization</span>
              )}
              <InsightCard type={i.type} title={i.title} body={i.body} evidence={i.evidence as { details?: string[] }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
