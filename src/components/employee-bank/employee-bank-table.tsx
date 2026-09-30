"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown, Settings2, Save, Bookmark, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScoreBadge, TrendIndicator } from "@/components/dashboard/score-badge";
import { ProspectHoverCard } from "./prospect-hover-card";
import { CurrencyCell, InlineEditText, QuickNoteCell, GroupCell } from "./cells";
import { EmployeeDrawer } from "./employee-drawer";
import { createSavedView, deleteSavedView } from "@/lib/actions/prospects";
import { bulkUpdateEmployeeBank } from "@/lib/actions/employee-bank";
import { enumLabel } from "@/lib/employee-bank/labels";
import type { EmployeeBankRow } from "./types";

interface Filters {
  group: string; // "" | A | B | C
  role: string;
  teamId: string;
  projectId: string;
  prospectStatus: string; // "" | PROSPECTED | NOT_PROSPECTED | <enum>
  availability: string;
  action: string;
}

const EMPTY_FILTERS: Filters = { group: "", role: "", teamId: "", projectId: "", prospectStatus: "", availability: "", action: "" };

export function EmployeeBankTable({
  rows,
  allTeams,
  allProjects,
  allManagers,
  savedViews,
}: {
  rows: EmployeeBankRow[];
  allTeams: { id: string; name: string }[];
  allProjects: { id: string; name: string }[];
  allManagers: { id: string; name: string }[];
  savedViews: { id: string; name: string; filters: unknown }[];
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [savingView, setSavingView] = useState(false);
  const [viewName, setViewName] = useState("");
  const [pending, startTransition] = useTransition();

  const roleOptions = useMemo(() => [...new Set(rows.map((r) => r.title).filter((t): t is string => !!t))].sort(), [rows]);
  const actionOptions = useMemo(() => [...new Set(rows.map((r) => r.action).filter((a): a is string => !!a))].sort(), [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (search) {
        const haystack = [r.name, r.title ?? "", ...r.teams.map((t) => t.name), ...r.projects.map((p) => p.name)].join(" ").toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      if (filters.group && r.group !== filters.group) return false;
      if (filters.role && r.title !== filters.role) return false;
      if (filters.teamId && !r.teams.some((t) => t.id === filters.teamId)) return false;
      if (filters.projectId && !r.projects.some((p) => p.id === filters.projectId)) return false;
      if (filters.availability && r.availability !== filters.availability) return false;
      if (filters.action && r.action !== filters.action) return false;
      if (filters.prospectStatus) {
        if (filters.prospectStatus === "PROSPECTED" && r.activeProspects.length === 0) return false;
        if (filters.prospectStatus === "NOT_PROSPECTED" && r.activeProspects.length > 0) return false;
        if (filters.prospectStatus === "ACCEPTED" && r.acceptedProspectCount === 0) return false;
        if (filters.prospectStatus === "REJECTED" && r.rejectedProspectCount === 0) return false;
        if (filters.prospectStatus === "INTERVIEWING" && !r.activeProspects.some((p) => p.status.startsWith("INTERVIEW"))) return false;
      }
      return true;
    });
  }, [rows, search, filters]);

  const columnHelper = createColumnHelper<EmployeeBankRow>();
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} aria-label="Select row" />
          </div>
        ),
        size: 36,
        enableResizing: false,
      }),
      columnHelper.accessor("name", {
        header: "Employee",
        size: 200,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">{row.original.name}</span>
            <ProspectHoverCard prospects={row.original.activeProspects} />
          </div>
        ),
      }),
      columnHelper.accessor("title", { header: "Role", size: 140, cell: (c) => <span className="text-xs text-muted-foreground">{c.getValue() ?? "—"}</span> }),
      columnHelper.accessor("projects", {
        header: "Current Project",
        size: 160,
        enableSorting: false,
        cell: (c) => (
          <div className="flex flex-wrap gap-1">
            {c.getValue().length === 0 ? <span className="text-xs text-muted-foreground">—</span> : c.getValue().map((p) => <Badge key={p.id} variant="secondary" className="text-[10px]">{p.name}</Badge>)}
          </div>
        ),
      }),
      columnHelper.accessor("teams", {
        header: "Current Team",
        size: 160,
        enableSorting: false,
        cell: (c) => (
          <div className="flex flex-wrap gap-1">
            {c.getValue().length === 0 ? <span className="text-xs text-muted-foreground">—</span> : c.getValue().map((t) => <Badge key={t.id} variant="outline" className="text-[10px]">{t.name}</Badge>)}
          </div>
        ),
      }),
      columnHelper.accessor("currentSalary", {
        header: "Current Salary",
        size: 170,
        cell: (c) => <CurrencyCell userId={c.row.original.id} field="currentSalary" value={c.getValue()} />,
      }),
      columnHelper.accessor("rating", {
        header: "Rating",
        size: 80,
        cell: (c) => (
          <span className="px-1.5 text-xs text-foreground" title="Taken from this employee's demo evaluation score — not manually captured.">
            {c.getValue() ?? "—"}
          </span>
        ),
      }),
      columnHelper.accessor("group", {
        header: "Group",
        size: 130,
        cell: (c) => (
          <GroupCell
            userId={c.row.original.id}
            group={c.getValue()}
            suggestedGroup={c.row.original.suggestedGroup}
            groupOverrideNote={c.row.original.groupOverrideNote}
          />
        ),
      }),
      columnHelper.display({
        id: "prospectStatus",
        header: "Prospect Status",
        size: 140,
        cell: ({ row }) => {
          const p = row.original.activeProspects[0];
          if (!p) return <span className="text-xs text-muted-foreground">Not Prospected</span>;
          return <Badge variant="info" className="text-[10px]">{enumLabel(p.status)}</Badge>;
        },
      }),
      columnHelper.display({
        id: "prospectedFor",
        header: "Prospected For",
        size: 150,
        cell: ({ row }) => {
          const { activeProspects } = row.original;
          if (activeProspects.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
          if (activeProspects.length > 1) return <span className="text-xs text-foreground">{activeProspects.length} prospects</span>;
          return <span className="text-xs text-foreground">{activeProspects[0].projectName ?? activeProspects[0].client ?? "—"}</span>;
        },
      }),
      columnHelper.display({
        id: "prospectOwner",
        header: "Prospect Owner",
        size: 140,
        cell: ({ row }) => {
          const p = row.original.activeProspects[0];
          return <span className="text-xs text-muted-foreground">{p ? p.ownerName : "—"}</span>;
        },
      }),
      columnHelper.accessor("action", {
        header: "Action",
        size: 110,
        cell: (c) => <InlineEditText userId={c.row.original.id} field="action" value={c.getValue()} placeholder="—" />,
      }),
      columnHelper.display({
        id: "notes",
        header: "Notes",
        size: 180,
        enableSorting: false,
        cell: ({ row }) => <QuickNoteCell userId={row.original.id} latestNote={row.original.latestNote} />,
      }),
      columnHelper.accessor("score", {
        header: "Score",
        size: 90,
        cell: (c) => <ScoreBadge score={c.getValue()} />,
      }),
      columnHelper.accessor("trend", {
        header: "Trend",
        size: 70,
        cell: (c) => <TrendIndicator trend={c.getValue()} delta={c.row.original.trendDelta} />,
      }),
    ],
    [columnHelper]
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    initialState: { pagination: { pageSize: 25 } },
  });

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

  function applySavedView(view: { id: string; name: string; filters: unknown }) {
    const f = view.filters as { search?: string; filters?: Filters; sorting?: SortingState; columnVisibility?: VisibilityState };
    setSearch(f.search ?? "");
    setFilters({ ...EMPTY_FILTERS, ...(f.filters ?? {}) });
    if (f.sorting) setSorting(f.sorting);
    if (f.columnVisibility) setColumnVisibility(f.columnVisibility);
  }

  function saveCurrentView() {
    if (!viewName.trim()) return;
    startTransition(async () => {
      try {
        await createSavedView(viewName.trim(), { search, filters, sorting, columnVisibility });
        toast.success("View saved");
        setViewName("");
        setSavingView(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save view");
      }
    });
  }

  function bulkAction(patch: Parameters<typeof bulkUpdateEmployeeBank>[1]) {
    startTransition(async () => {
      try {
        await bulkUpdateEmployeeBank(selectedIds, patch);
        toast.success(`Updated ${selectedIds.length} employees`);
        setRowSelection({});
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Bulk update failed");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees..." className="w-56" />

        <Select value={filters.group || "ALL"} onValueChange={(v) => setFilters((f) => ({ ...f, group: v === "ALL" ? "" : v }))}>
          <SelectTrigger className="w-28 text-xs"><SelectValue placeholder="Group" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Groups</SelectItem>
            <SelectItem value="A">Group A</SelectItem>
            <SelectItem value="B">Group B</SelectItem>
            <SelectItem value="C">Group C</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.role || "ALL"} onValueChange={(v) => setFilters((f) => ({ ...f, role: v === "ALL" ? "" : v }))}>
          <SelectTrigger className="w-36 text-xs"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            {roleOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.teamId || "ALL"} onValueChange={(v) => setFilters((f) => ({ ...f, teamId: v === "ALL" ? "" : v }))}>
          <SelectTrigger className="w-36 text-xs"><SelectValue placeholder="Team" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Teams</SelectItem>
            {allTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.projectId || "ALL"} onValueChange={(v) => setFilters((f) => ({ ...f, projectId: v === "ALL" ? "" : v }))}>
          <SelectTrigger className="w-36 text-xs"><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Projects</SelectItem>
            {allProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.prospectStatus || "ALL"} onValueChange={(v) => setFilters((f) => ({ ...f, prospectStatus: v === "ALL" ? "" : v }))}>
          <SelectTrigger className="w-40 text-xs"><SelectValue placeholder="Prospect Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any Prospect Status</SelectItem>
            <SelectItem value="PROSPECTED">Prospected</SelectItem>
            <SelectItem value="NOT_PROSPECTED">Not Prospected</SelectItem>
            <SelectItem value="INTERVIEWING">Interviewing</SelectItem>
            <SelectItem value="ACCEPTED">Ever Accepted</SelectItem>
            <SelectItem value="REJECTED">Ever Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.availability || "ALL"} onValueChange={(v) => setFilters((f) => ({ ...f, availability: v === "ALL" ? "" : v }))}>
          <SelectTrigger className="w-36 text-xs"><SelectValue placeholder="Availability" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any Availability</SelectItem>
            <SelectItem value="AVAILABLE">Available</SelectItem>
            <SelectItem value="PARTIALLY_ALLOCATED">Partially Allocated</SelectItem>
            <SelectItem value="FULLY_ALLOCATED">Fully Allocated</SelectItem>
          </SelectContent>
        </Select>

        {actionOptions.length > 0 && (
          <Select value={filters.action || "ALL"} onValueChange={(v) => setFilters((f) => ({ ...f, action: v === "ALL" ? "" : v }))}>
            <SelectTrigger className="w-32 text-xs"><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Any Action</SelectItem>
              {actionOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {(search || Object.values(filters).some(Boolean)) && (
          <Button size="sm" variant="ghost" onClick={() => { setSearch(""); setFilters(EMPTY_FILTERS); }}>Clear</Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline"><Bookmark className="h-3.5 w-3.5" /> Views</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Saved Views</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {savedViews.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No saved views yet.</p>}
              {savedViews.map((v) => (
                <div key={v.id} className="flex items-center justify-between px-2 py-1.5 text-sm hover:bg-surface-muted">
                  <button className="flex-1 text-left" onClick={() => applySavedView(v)}>{v.name}</button>
                  <button
                    className="text-muted-foreground hover:text-critical"
                    onClick={() => startTransition(async () => { await deleteSavedView(v.id); toast.success("View deleted"); })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <DropdownMenuSeparator />
              {savingView ? (
                <div className="flex items-center gap-1 p-2">
                  <Input value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="View name..." className="h-7 text-xs" />
                  <Button size="sm" disabled={!viewName.trim() || pending} onClick={saveCurrentView}>Save</Button>
                </div>
              ) : (
                <button className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-surface-muted" onClick={() => setSavingView(true)}>
                  <Save className="h-3.5 w-3.5" /> Save current view...
                </button>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline"><Settings2 className="h-3.5 w-3.5" /> Columns</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table.getAllLeafColumns().filter((c) => c.id !== "select").map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(v) => column.toggleVisibility(!!v)}
                >
                  {typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary-muted/40 px-3 py-2 text-sm">
          <span className="font-medium text-foreground">{selectedIds.length} selected</span>
          <Select onValueChange={(v) => bulkAction({ group: v as "A" | "B" | "C" })}>
            <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Set Group..." /></SelectTrigger>
            <SelectContent><SelectItem value="A">Group A</SelectItem><SelectItem value="B">Group B</SelectItem><SelectItem value="C">Group C</SelectItem></SelectContent>
          </Select>
          <Select onValueChange={(v) => bulkAction({ availability: v as "AVAILABLE" | "PARTIALLY_ALLOCATED" | "FULLY_ALLOCATED" })}>
            <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="Set Availability..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="AVAILABLE">Available</SelectItem>
              <SelectItem value="PARTIALLY_ALLOCATED">Partially Allocated</SelectItem>
              <SelectItem value="FULLY_ALLOCATED">Fully Allocated</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={() => setRowSelection({})}>Clear selection</Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table style={{ width: table.getTotalSize() }}>
          <TableHeader className="sticky top-0 z-10 bg-surface">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize(), position: "relative" }}
                    className="select-none"
                  >
                    {header.column.getCanSort() ? (
                      <button className="flex items-center gap-1" onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" ? <ChevronUp className="h-3 w-3" /> : header.column.getIsSorted() === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none bg-border/0 hover:bg-primary/40"
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => setSelectedEmployeeId(row.original.id)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} style={{ width: cell.column.getSize() }} className="py-1.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-12 text-center text-sm text-muted-foreground">
                  No employees match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {table.getRowModel().rows.length} of {filteredRows.length} ({rows.length} total)
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>Previous</Button>
          <span>Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}</span>
          <Button size="sm" variant="outline" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>Next</Button>
        </div>
      </div>

      {selectedEmployeeId && (
        <EmployeeDrawer
          userId={selectedEmployeeId}
          allManagers={allManagers}
          onClose={() => setSelectedEmployeeId(null)}
        />
      )}
    </div>
  );
}
