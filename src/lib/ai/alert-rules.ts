import type { AIAnalysisOutput, Evidence } from "./types";

export type AlertType =
  | "PERFORMANCE"
  | "DELIVERY"
  | "AI_ADOPTION"
  | "UX"
  | "BUSINESS_UNDERSTANDING"
  | "ATTENDANCE"
  | "TREND"
  | "RECOGNITION";

export type AlertSeverity = "INFORMATIONAL" | "LOW" | "MEDIUM" | "HIGH";

export interface AlertSpec {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  evidence: Evidence;
}

const DIMENSION_ALERT: Record<string, AlertType> = {
  Delivery: "DELIVERY",
  Complexity: "PERFORMANCE",
  Business: "BUSINESS_UNDERSTANDING",
  UX: "UX",
  AI: "AI_ADOPTION",
  English: "PERFORMANCE",
};

/**
 * Deterministic mapping from an AIAnalysisOutput (already evidence-backed) to
 * concrete alerts with severity — section 25/26. This is pure rule logic, not
 * LLM output, so severities stay consistent and explainable.
 */
export function deriveAlerts(output: AIAnalysisOutput): AlertSpec[] {
  const alerts: AlertSpec[] = [];

  for (const risk of output.riskSignals) {
    if (risk.title.includes("below 70")) {
      const streak = risk.evidence.details.length;
      alerts.push({
        type: "PERFORMANCE",
        severity: streak >= 4 ? "HIGH" : "MEDIUM",
        title: "Performance trend requires attention",
        description: risk.body,
        evidence: risk.evidence,
      });
    } else if (risk.title.includes("declining")) {
      alerts.push({
        type: "TREND",
        severity: "HIGH",
        title: "Performance trend declining",
        description: risk.body,
        evidence: risk.evidence,
      });
    } else if (risk.title.includes("Attendance")) {
      alerts.push({
        type: "ATTENDANCE",
        severity: "MEDIUM",
        title: "Repeated absences",
        description: risk.body,
        evidence: risk.evidence,
      });
    } else if (risk.title.includes("Manager concern")) {
      alerts.push({
        type: "PERFORMANCE",
        severity: "MEDIUM",
        title: risk.title,
        description: risk.body,
        evidence: risk.evidence,
      });
    }
  }

  for (const growth of output.growthAreas) {
    const dimension = Object.keys(DIMENSION_ALERT).find((d) => growth.title.includes(d));
    if (dimension) {
      alerts.push({
        type: DIMENSION_ALERT[dimension],
        severity: "MEDIUM",
        title: growth.title,
        description: growth.body,
        evidence: growth.evidence,
      });
    }
  }

  for (const rec of output.recognition) {
    alerts.push({
      type: "RECOGNITION",
      severity: "INFORMATIONAL",
      title: rec.title,
      description: rec.body,
      evidence: rec.evidence,
    });
  }

  return alerts;
}
