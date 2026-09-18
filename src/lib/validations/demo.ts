import { z } from "zod";

export const deliverableInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  expectedOutcome: z.string().optional(),
  ownerIds: z.array(z.string()).default([]),
});

export const urlInputSchema = z.object({
  label: z.string().min(1),
  url: z.string().url("Must be a valid URL"),
  type: z
    .enum(["PRODUCTION", "STAGING", "GITHUB", "DOCUMENTATION", "FIGMA", "DEMO_ENV", "OTHER"])
    .default("OTHER"),
});

// Team selection drives everything else — projects come along for free via
// each team's existing ProjectTeam link(s), so nobody re-selects work
// that's already implied by the team(s). See createDemo() for derivation.
export const createDemoSchema = z.object({
  title: z.string().min(3, "Session name is required"),
  teamIds: z.array(z.string()).min(1, "Select at least one team"),
  hostManagerId: z.string().min(1, "Select a host manager"),
  invitedManagerIds: z.array(z.string()).min(1, "Select at least one manager"),
  engineerIds: z.array(z.string()).min(1, "Select at least one engineer"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  deliverables: z.array(deliverableInputSchema).default([]),
  urls: z.array(urlInputSchema).default([]),
});

export type CreateDemoInput = z.infer<typeof createDemoSchema>;
