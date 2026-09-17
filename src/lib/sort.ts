// Generic in-memory sort for the small, already-aggregated row arrays each
// query module returns (organization sizes here are in the dozens, not
// thousands, so sorting after fetch is simpler and just as correct as
// pushing ORDER BY into Prisma for computed/derived columns).
export function sortRows<T extends Record<string, unknown>>(
  rows: T[],
  sort: string | undefined,
  dir: string | undefined,
  defaultKey: keyof T & string,
  defaultDir: "asc" | "desc" = "desc"
): T[] {
  const key = (sort as keyof T & string) || defaultKey;
  const direction: "asc" | "desc" = dir === "asc" ? "asc" : dir === "desc" ? "desc" : defaultDir;

  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // nulls/empty always sort last, regardless of direction
    if (bv == null) return -1;

    if (typeof av === "string" && typeof bv === "string") {
      return direction === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    if (av instanceof Date && bv instanceof Date) {
      return direction === "asc" ? av.getTime() - bv.getTime() : bv.getTime() - av.getTime();
    }
    const an = Number(av);
    const bn = Number(bv);
    return direction === "asc" ? an - bn : bn - an;
  });
}
