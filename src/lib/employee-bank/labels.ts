export function enumLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export const PROSPECT_STATUS_OPTIONS = [
  "IDENTIFIED",
  "PROFILE_BEING_PREPARED",
  "PROFILE_SUBMITTED",
  "CLIENT_REVIEWING",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "PENDING_DECISION",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
  "CANCELLED",
  "ON_HOLD",
] as const;

export const PROSPECT_SOURCE_OPTIONS = [
  "INTERNAL_STAFFING",
  "CLIENT_REQUEST",
  "MANAGER_RECOMMENDATION",
  "SALES_OPPORTUNITY",
  "REPLACEMENT",
  "OTHER",
] as const;

export const PROSPECT_OUTCOME_REASON_OPTIONS = [
  "TECHNICAL_SKILLS",
  "ENGLISH",
  "SENIORITY",
  "SALARY",
  "CLIENT_PREFERENCE",
  "ROLE_MISMATCH",
  "PROJECT_CANCELLED",
  "POSITION_FILLED",
  "AVAILABILITY",
  "EMPLOYEE_DECLINED",
  "INTERVIEW_PERFORMANCE",
  "TIMING",
  "OTHER",
] as const;

export const AVAILABILITY_OPTIONS = ["AVAILABLE", "PARTIALLY_ALLOCATED", "FULLY_ALLOCATED"] as const;

export const INTERVIEW_RESULT_OPTIONS = ["WENT_WELL", "WENT_BADLY"] as const;

export const INTERVIEW_NON_ATTENDANCE_REASON_OPTIONS = [
  "SCHEDULING_CONFLICT",
  "EMPLOYEE_DECLINED",
  "EMPLOYEE_UNAVAILABLE",
  "NO_SHOW",
  "CLIENT_CANCELLED",
  "OTHER",
] as const;

export function interviewResultTone(result: string): "positive" | "critical" {
  return result === "WENT_WELL" ? "positive" : "critical";
}

export const OPERATIONS_TEAM_NAME = "Operaciones";

export const OFFBOARDING_STATUS_OPTIONS = ["NEGOTIATION_IN_PROGRESS", "ESCALATED_TO_LEGAL", "NEGOTIATION_FINISHED"] as const;

const OFFBOARDING_STATUS_LABELS: Record<string, string> = {
  NEGOTIATION_IN_PROGRESS: "Baja - Negociación en proceso",
  ESCALATED_TO_LEGAL: "Baja - Escaló a Legal",
  NEGOTIATION_FINISHED: "Baja - Negociación terminada",
};

export function offboardingStatusLabel(status: string): string {
  return OFFBOARDING_STATUS_LABELS[status] ?? status;
}

export function requiresOutcomeReasonLabel(status: string): string {
  return `Moving to "${enumLabel(status)}" requires an outcome reason — this is how we learn why prospects don't materialize.`;
}

export function statusTone(status: string): "positive" | "critical" | "warning" | "info" | "secondary" {
  if (status === "ACCEPTED") return "positive";
  if (["REJECTED", "WITHDRAWN", "CANCELLED"].includes(status)) return "critical";
  if (["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED", "PENDING_DECISION"].includes(status)) return "info";
  if (status === "ON_HOLD") return "warning";
  return "secondary";
}
