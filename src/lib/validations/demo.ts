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

// A single Team selection drives everything else — the manager and project
// are derived from the team server-side, so the client never submits them
// as independent choices. See createDemo() for the derivation.
export const createDemoSchema = z.object({
  title: z.string().min(3, "Session name is required"),
  teamId: z.string().min(1, "Select a team"),
  hostManagerId: z.string().min(1, "Manager is required"),
  additionalManagerIds: z.array(z.string()).default([]),
  engineerIds: z.array(z.string()).min(1, "Select at least one engineer"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  deliverables: z.array(deliverableInputSchema).default([]),
  urls: z.array(urlInputSchema).default([]),
});

export type CreateDemoInput = z.infer<typeof createDemoSchema>;
