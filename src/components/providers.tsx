"use client";

import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TooltipProvider delayDuration={150}>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </TooltipProvider>
    </SessionProvider>
  );
}
