import { prisma } from "@/lib/prisma";
import { getAIProvider } from "./index";
import { buildDeveloperAnalysisInput } from "./gather";
import { deriveAlerts } from "./alert-rules";
import type { AIAnalysisOutput } from "./types";
import type { Prisma } from "@prisma/client";

/**
 * AIInsightService — regenerates the AiInsight feed for one developer from
 * current evidence. Insights are a recomputed view (not an audit log), so we
 * replace the previous batch each time this runs.
 */
export const AIInsightService = {
  async generateForDeveloper(developerId: string) {
    const input = await buildDeveloperAnalysisInput(developerId);
    if (!input) return null;

    const provider = getAIProvider();
    const output = await provider.analyzeDeveloper(input);

    await prisma.aiInsight.deleteMany({ where: { subjectType: "PERSON", subjectId: developerId } });

    const rows: Prisma.AiInsightCreateManyInput[] = [
      {
        subjectType: "PERSON",
        subjectId: developerId,
        type: "SUMMARY",
        title: "Summary",
        body: output.summary,
        evidence: { details: [`${input.evaluations.length} completed evaluations analyzed`] },
      },
      ...output.strengths.map((s) => toRow(developerId, "STRENGTH", s)),
      ...output.growthAreas.map((s) => toRow(developerId, "DEVELOPMENT", s)),
      ...output.riskSignals.map((s) => toRow(developerId, "RISK", s)),
      ...output.recommendations.map((s) => toRow(developerId, "RECOMMENDATION", s)),
      ...output.recognition.map((s) => toRow(developerId, "RECOGNITION", s)),
    ];

    if (rows.length) await prisma.aiInsight.createMany({ data: rows });

    await AIAlertService.syncDeveloperAlerts(developerId, output);
    await AIRecognitionService.syncDeveloperRecognition(developerId, output);

    return output;
  },
};

function toRow(
  subjectId: string,
  type: "STRENGTH" | "DEVELOPMENT" | "RISK" | "RECOMMENDATION" | "RECOGNITION",
  item: { title: string; body: string; evidence: { details: string[] } }
): Prisma.AiInsightCreateManyInput {
  return {
    subjectType: "PERSON",
    subjectId,
    type,
    title: item.title,
    body: item.body,
    evidence: item.evidence as Prisma.InputJsonValue,
  };
}

/**
 * AIAlertService — turns deterministic alert specs into AiAlert rows.
 * Alerts no longer supported by current evidence are auto-resolved; existing
 * ACTIVE alerts are updated in place so ACKNOWLEDGED/RESOLVED state set by a
 * manager elsewhere is preserved for alerts that are still firing.
 */
export const AIAlertService = {
  async syncDeveloperAlerts(developerId: string, output: AIAnalysisOutput) {
    const specs = deriveAlerts(output);

    const existing = await prisma.aiAlert.findMany({
      where: { subjectType: "PERSON", subjectId: developerId, status: "ACTIVE" },
    });

    const stillFiringTypes = new Set(specs.map((s) => s.type));
    const toResolve = existing.filter((e) => !stillFiringTypes.has(e.type));
    if (toResolve.length) {
      await prisma.aiAlert.updateMany({
        where: { id: { in: toResolve.map((e) => e.id) } },
        data: { status: "RESOLVED", resolvedAt: new Date() },
      });
    }

    for (const spec of specs) {
      const match = existing.find((e) => e.type === spec.type);
      if (match) {
        await prisma.aiAlert.update({
          where: { id: match.id },
          data: {
            severity: spec.severity,
            title: spec.title,
            description: spec.description,
            evidence: spec.evidence as Prisma.InputJsonValue,
          },
        });
      } else {
        await prisma.aiAlert.create({
          data: {
            type: spec.type,
            severity: spec.severity,
            subjectType: "PERSON",
            subjectId: developerId,
            title: spec.title,
            description: spec.description,
            evidence: spec.evidence as Prisma.InputJsonValue,
          },
        });
      }
    }
  },
};

/** AIRecognitionService — appends fresh, de-duplicated Recognition entries. */
export const AIRecognitionService = {
  async syncDeveloperRecognition(developerId: string, output: AIAnalysisOutput) {
    for (const rec of output.recognition) {
      const existing = await prisma.recognition.findFirst({
        where: { developerId, title: rec.title, source: "AI" },
      });
      if (existing) continue;
      await prisma.recognition.create({
        data: {
          developerId,
          title: rec.title,
          body: rec.body,
          evidence: rec.evidence as Prisma.InputJsonValue,
          source: "AI",
        },
      });
    }
  },
};
