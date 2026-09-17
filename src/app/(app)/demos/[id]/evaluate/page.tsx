import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/permissions";
import { getDemoForEvaluation } from "@/lib/queries/demos";
import { EvaluateClient } from "./evaluate-client";

export default async function EvaluateDemoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const data = await getDemoForEvaluation(id, session.user.id);
  if (!data) notFound();

  if (!data.canEvaluate) {
    redirect(`/demos/${id}`);
  }

  if (data.developers.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-lg font-semibold text-foreground">No attendees to evaluate</h1>
        <p className="mt-1 text-sm text-muted-foreground">Record attendance for this demo before starting evaluations.</p>
      </div>
    );
  }

  return (
    <EvaluateClient
      demoId={id}
      demoTitle={data.demo.title}
      criteria={data.criteria.map((c) => ({ id: c.id, text: c.text, dimension: c.dimension }))}
      developers={data.developers.map((d) => {
        const existing = data.existingByDeveloper.get(d.id);
        return {
          id: d.id,
          name: d.name,
          title: d.title,
          completed: existing?.status === "COMPLETED",
          overallComment: existing?.overallComment ?? "",
          strengths: existing?.strengths ?? "",
          areasForImprovement: existing?.areasForImprovement ?? "",
          answers: Object.fromEntries((existing?.answers ?? []).map((a) => [a.criterionId, a.answer])),
          comments: Object.fromEntries((existing?.answers ?? []).map((a) => [a.criterionId, a.comment ?? ""])),
        };
      })}
    />
  );
}
