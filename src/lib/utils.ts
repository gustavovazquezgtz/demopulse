import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatScore(score: number | null | undefined) {
  if (score === null || score === undefined) return "—";
  return Math.round(score).toString();
}

export function scoreTone(score: number | null | undefined) {
  if (score === null || score === undefined) return "neutral";
  if (score >= 80) return "positive";
  if (score >= 60) return "warning";
  return "critical";
}
