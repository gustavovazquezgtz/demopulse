"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A clickable <TableHead> label that toggles ascending/descending sort via
 * URL query params (?sort=column&dir=asc|desc) — the page re-renders
 * server-side with the new order, so there's no client-side sort state to
 * keep in sync with the database.
 */
export function SortableHeader({
  column,
  label,
  align = "left",
  defaultDir = "desc",
  sortParam = "sort",
  dirParam = "dir",
}: {
  column: string;
  label: string;
  align?: "left" | "right";
  defaultDir?: "asc" | "desc";
  /** Override when a page embeds more than one independently-sortable table (e.g. the Dashboard). */
  sortParam?: string;
  dirParam?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSort = searchParams.get(sortParam);
  const activeDir = searchParams.get(dirParam) === "asc" ? "asc" : "desc";
  const isActive = activeSort === column;

  const params = new URLSearchParams(searchParams.toString());
  params.set(sortParam, column);
  params.set(dirParam, isActive ? (activeDir === "asc" ? "desc" : "asc") : defaultDir);

  return (
    <Link
      href={`${pathname}?${params.toString()}`}
      className={cn(
        "inline-flex items-center gap-1 hover:text-foreground",
        isActive && "text-foreground",
        align === "right" && "flex-row-reverse"
      )}
    >
      {label}
      {isActive ? (
        activeDir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-30" />
      )}
    </Link>
  );
}
