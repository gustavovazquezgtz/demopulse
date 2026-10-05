# Employee Bank & Prospect Management — Implementation Plan

## Amendment (post-v1): Rating is derived, not captured

Everywhere below that says "rating" as a manually-entered 0-10 number is
superseded: `EmployeeBankProfile.rating` was removed. Rating is now the
employee's live demo evaluation score (`averageScore` over their COMPLETED
`Evaluation` rows, 0-100 scale) — read at query time, never stored or typed
in. `suggestGroup` and `DEFAULT_GROUP_THRESHOLDS` were updated to match
(90-100 → A, 70-89 → B, 0-69 → C). Everything else in this document
(Group is still manual-only, override notes, audit trail, etc.) is
unchanged.

## Amendment 2: Interview outcomes and "Dar de alta" (Operations assignment)

Two additions, both additive (no existing field/behavior changed):

- **Interview outcome** (`EmployeeProspect.interviewAttended` /
  `interviewResult` / `interviewNonAttendanceReason` /
  `interviewNonAttendanceNotes`): records what happened at a *specific*
  interview — did the person attend, and if so did it go well or badly;
  if not, why not. Deliberately separate from `status`/`outcomeReason`
  (which describe the opportunity's overall fate) — an interview can go
  badly without the opportunity being over, and "didn't show up to this
  interview" has its own reason vocabulary distinct from "why the whole
  thing ultimately failed." Surfaced on the Prospect Detail page, the
  prospect hover card, and the drawer's now-expanded Prospect History
  list (previously just a count — "ver oportunidades y resultados"
  needed the actual list, not a number).
- **"Dar de alta" / Assigned to Operations**
  (`EmployeeBankProfile.assignedToOperations` / `assignedToOperationsAt` /
  `operationsProjectId`): a manager-triggered action meaning "this person
  was placed on a real client account." When a project/account is given,
  `assignToOperations` mirrors a real `ProjectAssignment` the same way
  `addTeamMember` already does (first active assignment becomes primary)
  — this is never a Employee-Bank-only flag; the person shows up as
  actually assigned to that project in People/Ranking/Team rosters too.
  Also sets availability to FULLY_ALLOCATED. New "Operations" column +
  filter in the main grid, and a control in the drawer's Overview tab.

## 0. Scope decisions (read this first)

This spec is large. To ship a working, coherent v1 rather than a half-built
everything, the following scoping calls were made. Each is a deliberate
trade-off, not an oversight:

- **Prospect statuses, sources, and outcome reasons are Prisma enums**, not a
  DB-editable settings table. The spec's initial lists are implemented in
  full and used everywhere (pipeline, filters, funnel, failure analysis).
  Renaming/adding options later means a migration, same as every other enum
  in this schema (`DemoStatus`, `ProjectStatus`, etc.) — consistent with how
  the rest of the app already works, and avoids building a generic
  enum-editor UI that nothing else in the app has either.
- **Group A/B/C rating thresholds ARE configurable**, via a small
  `AppSetting` key-value table (new, reusable for future settings) editable
  from Settings. This is the one piece of "configurability" the spec gives a
  concrete initial value for, so it's the one built as data instead of code.
- **No separate `Employee` entity.** `User` (role `DEVELOPER`) already *is*
  the employee record everywhere else in this app (People, Teams, Rankings,
  Evaluations). Employee Bank adds a 1:1 extension (`EmployeeBankProfile`),
  not a parallel person model.
- **`ProspectFeedback` is fields on `EmployeeProspect`**, not a separate
  table. The spec's own field list for `EmployeeProspect` (section 31)
  doesn't include a feedback relation, and a prospect only ever has one
  "current feedback" snapshot in this v1 — so three nullable text columns
  are simpler than a child table for identical behavior.
- **Saved views are shared/global**, not per-manager. Every manager already
  sees the entire org (an explicit standing decision from earlier work on
  this app — no per-manager data scoping exists anywhere), so a "my views vs
  everyone's views" split would be new, unrequested scoping infrastructure.
- **Side panel is a right-side Sheet** built on the `@radix-ui/react-dialog`
  package already installed (same primitive shadcn's own Sheet uses) —
  no new dependency for that. Two new, small, well-justified packages ARE
  added: `@tanstack/react-table` (column resize/visibility/sort/pagination —
  building that by hand for an "Excel-like" grid is the wrong place to save
  a dependency) and `@radix-ui/react-hover-card` (the spec explicitly asks
  for a hover card, distinct from the existing `Tooltip`).
- **Hover-card-on-mobile**: the prospect icon is a real button with
  controlled open state, so it opens on both hover (desktop) and click/tap
  (mobile) — not two separate implementations.
- **Bulk actions implemented**: Group, Availability, Action, add a Note.
  Bulk prospect creation is explicitly NOT implemented — the spec forbids it
  ("each employee's opportunity must be independently reviewed") and a
  create-prospect flow already exists per-row and from the drawer.

---

## 1. Existing models reused (no duplication)

| Need | Reused from |
|---|---|
| Employee identity, name, title, skills | `User` (role `DEVELOPER`) |
| Current team(s) | `TeamMember` (already supports multiple active + dated join/leave, built in the previous feature) |
| Current project(s) | `ProjectAssignment` (already has `startDate`/`endDate`) |
| Rating source data / Demo score / trend / eval count | `Evaluation`, `lib/scoring.ts` (`averageScore`, `computeTrend`, `dedupeScoresByDemo`) |
| Manager evaluation | `ManagerOpinion` |
| Who can do what | `requireSession()` — any authenticated MANAGER/CEO, org-wide (matches the standing "every manager sees everything" decision — no new scoping) |
| Change history for Group/Rating/Availability edits | `AuditLog` (generic `entityType`/`entityId`/`action`/`before`/`after`, already used by Teams/Demos) |
| Managers list (for Prospect Owner picker) | `User` (role in `MANAGER`/`CEO`) |

## 2. New models

```prisma
enum EmployeeGroup { A B C }
enum EmployeeAvailability { AVAILABLE PARTIALLY_ALLOCATED FULLY_ALLOCATED }

enum ProspectSource {
  INTERNAL_STAFFING CLIENT_REQUEST MANAGER_RECOMMENDATION
  SALES_OPPORTUNITY REPLACEMENT OTHER
}

enum ProspectStatus {
  IDENTIFIED PROFILE_BEING_PREPARED PROFILE_SUBMITTED CLIENT_REVIEWING
  INTERVIEW_SCHEDULED INTERVIEW_COMPLETED PENDING_DECISION
  ACCEPTED REJECTED WITHDRAWN CANCELLED ON_HOLD
}

enum ProspectOutcomeReason {
  TECHNICAL_SKILLS ENGLISH SENIORITY SALARY CLIENT_PREFERENCE
  ROLE_MISMATCH PROJECT_CANCELLED POSITION_FILLED AVAILABILITY
  EMPLOYEE_DECLINED INTERVIEW_PERFORMANCE TIMING OTHER
}

// 1:1 extension of a DEVELOPER User — never duplicates fields User already
// has (name, title, team, project all come from existing relations).
model EmployeeBankProfile {
  id                String               @id @default(cuid())
  userId            String               @unique
  rating            Int?                 // 0-10 manual staffing rating ("Calif.") — distinct from Evaluation.score (0-100)
  group             EmployeeGroup?       // manager's final call — never auto-written
  groupOverrideNote String?              // required by the UI when group != suggested group
  availability      EmployeeAvailability @default(AVAILABLE)
  currentSalary     Float?
  proposedSalary    Float?
  action            String?              // free text: "Place", "Maintain", "Evaluate", "Review", ...
  justification     String?              // "Justificación" from the source spreadsheet
  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt

  user  User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  notes EmployeeNote[]
}

model EmployeeNote {
  id        String   @id @default(cuid())
  userId    String   // the employee this note is about
  authorId  String
  type      String   // GENERAL | STAFFING | PROSPECT | EVALUATION | MANAGER
  text      String
  createdAt DateTime @default(now())

  user   User @relation("EmployeeNoteSubject", fields: [userId], references: [id], onDelete: Cascade)
  author User @relation("EmployeeNoteAuthor", fields: [authorId], references: [id])

  @@index([userId])
}

model EmployeeProspect {
  id                 String                  @id @default(cuid())
  employeeId         String
  client             String?
  projectId          String?
  teamId             String?
  role               String
  ownerManagerId      String
  source             ProspectSource
  status             ProspectStatus          @default(IDENTIFIED)
  interviewDate      DateTime?
  expectedStartDate  DateTime?
  outcomeReason      ProspectOutcomeReason?
  outcomeNotes       String?
  technicalFeedback  String?
  englishFeedback    String?
  clientFeedback     String?
  generalNotes       String?
  createdAt          DateTime                @default(now())
  updatedAt          DateTime                @updatedAt

  employee User     @relation("ProspectEmployee", fields: [employeeId], references: [id], onDelete: Cascade)
  project  Project? @relation(fields: [projectId], references: [id])
  team     Team?    @relation(fields: [teamId], references: [id])
  owner    User     @relation("ProspectOwner", fields: [ownerManagerId], references: [id])

  activity ProspectActivity[]

  @@index([employeeId])
  @@index([status])
  @@index([ownerManagerId])
}

// The permanent timeline — every status change, note, and edit. Never
// deleted, mirroring the Evaluation/TeamMember/TeamManager history pattern
// already used throughout this app.
model ProspectActivity {
  id         String   @id @default(cuid())
  prospectId String
  actorId    String
  action     String   // CREATE | STATUS_CHANGE | NOTE | FEEDBACK | OUTCOME
  before     Json?
  after      Json?
  createdAt  DateTime @default(now())

  prospect EmployeeProspect @relation(fields: [prospectId], references: [id], onDelete: Cascade)
  actor    User             @relation(fields: [actorId], references: [id])

  @@index([prospectId])
}

model EmployeeBankSavedView {
  id        String   @id @default(cuid())
  name      String
  filters   Json     // serialized filter/sort/column-visibility state
  createdById String
  createdAt DateTime @default(now())

  createdBy User @relation(fields: [createdById], references: [id])
}

// Generic key-value settings, starting with group rating thresholds.
model AppSetting {
  key       String   @id
  value     Json
  updatedAt DateTime @updatedAt
}
```

`User` gains four back-relations (`employeeBankProfile`, `employeeNotesReceived`/`Written`, `prospects`, `prospectsOwned`).

## 3. Group A/B/C logic

- **Suggested group** is a pure function of `rating` only, against
  configurable thresholds (default: 9–10 → A, 7–8 → B, 0–6 → C), read from
  `AppSetting["employeeBankGroupThresholds"]`. No evaluation data feeds the
  *suggestion* threshold math (spec section 4 says "based primarily on
  rating"); demo score / trend / eval count are surfaced as supporting
  *context* next to the suggestion (section 22) so a manager can judge it,
  but never change the number themselves.
- **Manual group** (`EmployeeBankProfile.group`) is the only thing ever
  displayed as "the" Group. It defaults to unset (not silently defaulted to
  the suggestion) so a manager has to make one real classification decision
  the first time they touch a new employee.
- When a manager sets `group` to something other than the current
  suggestion, the UI requires a short note (`groupOverrideNote`) before
  saving — "Manual classification differs from suggested classification."
  is shown inline, not as a blocking modal.
- Every group/rating change writes an `AuditLog` row (`entityType: "User"`,
  `action: "UPDATE_BANK_PROFILE"`) with before/after — reusing the existing
  audit pattern, surfaced on the same `ActivityLog` component already built
  for Teams/People.

## 4. Prospect workflow

- `createProspect` — before inserting, checks for any other prospect on the
  same employee with a non-terminal status (`ACCEPTED`/`REJECTED`/
  `WITHDRAWN`/`CANCELLED` are terminal, everything else is active). If one
  exists, the action still creates the new prospect (never blocks) but the
  UI must have shown the "already has an active prospect" collision banner
  before the submit button is enabled — enforced client-side, mirrored by
  the query the drawer/dialog already re-fetches, not by a hard server
  check that could block a manager working under time pressure.
- `updateProspectStatus` — writes a `ProspectActivity(action: STATUS_CHANGE)`
  row on every transition. When the new status is `REJECTED`, `WITHDRAWN`,
  or `CANCELLED`, `outcomeReason` is a required argument — the server
  action throws without it, and the client form only shows the status
  option alongside the reason/notes fields so the two are submitted
  together.
- Prospects are **never deleted**. "Did not materialize" is a status +
  outcome reason, not a removed row — history stays queryable forever
  (`getEmployeeProfile` always returns the full prospect list, active and
  historical, ordered newest first).
- `addProspectActivity` (notes/feedback) appends timeline rows; nothing is
  ever overwritten in place except the prospect's own current-state columns
  (status, feedback text) — the *timeline* is the audit trail for those.

## 5. Table UX (`@tanstack/react-table`)

- Server component fetches the full Employee Bank dataset (org is dozens of
  people, same scale assumption already made by `listPeople`/`getRanking`)
  and hands it to a client component.
- `@tanstack/react-table` provides: column sort, column resize, column
  visibility (a dropdown checklist), pagination, and row selection — all
  client-side over the already-fetched rows. A single search input filters
  across name/role/project/team/prospect client-side (`globalFilter`).
  A filter bar (Group, Rating, Role, Team, Project, Prospect Status,
  Availability, Action) builds a combined `columnFilters` array — AND'd
  together, matching the spec's "Show me Group A Full Stack devs who are
  available and have no active prospect" example.
- Inline edit: Rating, Action, and Notes are editable in-cell (click →
  input, blur/Enter → server action, optimistic update via `useTransition`).
  Group is an in-cell `Select` (A/B/C) that, when it disagrees with the
  suggested group, expands the cell to demand `groupOverrideNote` before
  it will save. Current Project/Current Team are shown as badges (a person
  can have several) with a small "Edit" affordance that opens the same
  add/remove-with-date panels already built for Teams — no duplicate
  editing surface for team/project membership.
- Row click (anywhere except an inline-edit control or the prospect icon)
  opens the `EmployeeDrawer` sheet.
- Saved views: the filter bar's current state (search/filters/sort/column
  visibility) can be saved by name (`EmployeeBankSavedView`) and reloaded
  from a dropdown; the six examples from the spec are seeded once.

## 6. Hover card & side panel

- `🎯` icon appears next to the name only when the employee has ≥1 active
  (non-terminal-status) prospect; a small count badge (`🎯 2`) when >1.
  It's a `<button>` wrapped in `HoverCard` (new Radix package) with
  `openDelay`/an `onClick` toggle, so both hover (desktop) and tap (mobile)
  work through the same open state.
- `EmployeeDrawer` (right-side Sheet): header (name/role/rating/group),
  Active Prospects (list + "Create Prospect" button), Performance (score/
  demo score/manager rating/trend/eval count — all from existing
  `getPersonProfile`-style aggregation, reused not reimplemented), Prospect
  History, Notes (all types, newest first).

## 7. Permissions

No new permission model. `requireSession()` gates every page/action —
consistent with the rest of the app, any authenticated MANAGER/CEO can view
and edit anything in Employee Bank (org-wide, matching Teams/People/Ranking).
Salary fields are visible to any manager for the same reason the rest of
the org's data already is — this app has no per-field visibility layer, and
introducing one only for salary would be new, unrequested scope.

## 8. Audit strategy

Two audit surfaces, both reusing existing patterns:
- `AuditLog` (generic) — Group/Rating/Availability/Action changes on the
  employee's own profile, shown via the existing `ActivityLog` component.
- `ProspectActivity` (dedicated) — every prospect's own timeline
  (create/status-change/note/feedback/outcome), shown on the Prospect
  Detail page and inside the drawer's prospect list.

## 9. Migration plan

1. `prisma db push` locally, verify.
2. Seed: default `AppSetting["employeeBankGroupThresholds"]` row, the six
   spec'd `EmployeeBankSavedView` presets, and default `EmployeeBankProfile`
   rows are created lazily (on first edit) rather than backfilled for every
   existing developer — an employee with no profile row yet simply shows
   "not yet classified" (group unset, availability defaults to AVAILABLE),
   which is correct, not a null-handling bug to patch around.
3. Same production flow as every other feature in this app: `prisma db
   push` against Neon, then `vercel deploy --prod`, both gated by explicit
   user confirmation before touching the live database.

## 10. Navigation

`Employee Bank` inserted into `NAV_ITEMS` between `Teams / Projects` and
`Evaluations`, per the spec's listed order.
