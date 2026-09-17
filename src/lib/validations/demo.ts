import { z } from "zod";

export const deliverableInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  expectedOutcome: z.string().optional(),
  projectId: z.string().min(1, "Select a project"),
  ownerIds: z.array(z.string()).default([]),
});

export const urlInputSchema = z.object({
  label: z.string().min(1),
  url: z.string().url("Must be a valid URL"),
  type: z
    .enum(["PRODUCTION", "STAGING", "GITHUB", "DOCUMENTATION", "FIGMA", "DEMO_ENV", "OTHER"])
    .default("OTHER"),
});

export const createDemoSchema = z.object({
  title: z.string().min(3, "Title is required"),
  description: z.string().optional(),
  projectIds: z.array(z.string()).min(1, "Select at least one project"),
  teamIds: z.array(z.string()).min(1, "Select at least one team"),
  hostManagerId: z.string().min(1, "Select a host manager"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  invitedManagerIds: z.array(z.string()).default([]),
  invitedMemberIds: z.array(z.string()).min(1, "Invite at least one attendee"),
  deliverables: z.array(deliverableInputSchema).default([]),
  urls: z.array(urlInputSchema).default([]),
});

export type CreateDemoInput = z.infer<typeof createDemoSchema>;
