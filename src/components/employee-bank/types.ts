export interface ActiveProspectSummary {
  id: string;
  client: string | null;
  projectName: string | null;
  teamName: string | null;
  role: string;
  status: string;
  ownerName: string;
  interviewDate: Date | null;
  createdAt: Date;
  generalNotes: string | null;
  interviewAttended: boolean | null;
  interviewResult: string | null;
  interviewNonAttendanceReason: string | null;
  interviewNonAttendanceNotes: string | null;
  outcomeReason: string | null;
  outcomeNotes: string | null;
}

export interface EmployeeBankRow {
  id: string;
  name: string;
  title: string | null;
  active: boolean;
  teams: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  rating: number | null;
  group: "A" | "B" | "C" | null;
  suggestedGroup: "A" | "B" | "C" | null;
  groupDiffers: boolean;
  groupOverrideNote: string | null;
  availability: "AVAILABLE" | "PARTIALLY_ALLOCATED" | "FULLY_ALLOCATED";
  currentSalary: number | null;
  proposedSalary: number | null;
  action: string | null;
  justification: string | null;
  assignedToOperations: boolean;
  assignedToOperationsAt: Date | null;
  operationsProjectId: string | null;
  operationsProjectName: string | null;
  offboardingStatus: "NEGOTIATION_IN_PROGRESS" | "ESCALATED_TO_LEGAL" | "NEGOTIATION_FINISHED" | null;
  offboardingSetAt: Date | null;
  score: number;
  trend: string;
  trendDelta: number | null;
  evaluationCount: number;
  confidence: string;
  activeProspects: ActiveProspectSummary[];
  historicalProspectCount: number;
  acceptedProspectCount: number;
  rejectedProspectCount: number;
  latestNote: string | null;
}
