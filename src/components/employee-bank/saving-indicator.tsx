"use client";

import { Loader2, Check } from "lucide-react";

/** Small feedback shown next to any inline-edited cell in the Employee Bank
 * grid: a spinner while the save is in flight, then a brief checkmark once
 * it lands. `justSaved` should be cleared by the caller ~1-1.5s later. */
export function SavingIndicator({ pending, justSaved }: { pending: boolean; justSaved: boolean }) {
  if (pending) return <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" aria-label="Saving" />;
  if (justSaved) return <Check className="h-3 w-3 shrink-0 text-positive" aria-label="Saved" />;
  return null;
}

export const SAVED_FLASH_MS = 1200;
