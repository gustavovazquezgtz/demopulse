"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

export function Sidebar({ role }: { role: "MANAGER" | "CEO" }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
          D
        </div>
        <span className="text-sm font-semibold text-foreground">DemoPulse</span>
      </div>
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.filter((item) => !(item.managerOnly && role === "CEO")).map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary-muted text-primary"
                      : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Organization-wide view</div>
    </aside>
  );
}
