# DemoPulse — Database Schema

Full source of truth: `prisma/schema.prisma`. This document explains the *why* behind the shape of it.

## Entity groups

### People & org structure
- **User** — every person in the system: managers, the CEO, and developers, distinguished by `role: MANAGER | CEO | DEVELOPER`. `passwordHash` is nullable and only ever set for MANAGER/CEO. A single table (rather than a separate `Person`/`Developer` model) is what makes every other many-to-many relationship below uniform, regardless of whether that person can log in.
- **Team**, **TeamManager** (M:N), **TeamMember** (M:N) — a person can manage or belong to multiple teams; a team can have multiple managers.

### Projects
- **Project**, **ProjectManager** (M:N), **ProjectTeam** (M:N) — a project can span multiple teams and have multiple managers.
- **ProjectAssignment** — the M:N between a person and a project, carrying `isPrimary` (a person's *primary* project is just the assignment row with `isPrimary: true`; there's no separate field on `User`) and `startDate`/`endDate` so historical assignment periods survive a project change (rule #7/#8 — evaluations reference the project via `Evaluation.projectId` directly, not derived from current assignment, so they never move if a person's assignment changes later).
- **ProjectUrl** — one-to-many; `type` is an enum (`PRODUCTION | STAGING | GITHUB | DOCUMENTATION | FIGMA | DEMO_ENV | OTHER`) used to pick an icon in `UrlCards`.

### Demos
- **Demo** — `projectId` + `teamId` are both required (a demo is one team's session on one project, even though the project itself may span multiple teams).
- **DemoUrl** — same shape as ProjectUrl, scoped to the demo.
- **DemoInvitee** — the *invitation list* captured at scheduling time, `role: EVALUATOR_MANAGER | ATTENDEE_MEMBER`. Kept separate from `DemoAttendee` deliberately: an invite is a plan, attendance is what actually happened, and `canEvaluate` checks both.
- **DemoAttendee** — one row per invited person per demo, `status: PRESENT | ABSENT | EXCUSED`. Unique on `(demoId, userId)`.
- **ParticipationScore** — the *unofficial* 1–5 indicators (participation/engagement/commitment/communication/preparedness), one row per `(demo, developer, ratedBy)`. Deliberately a separate table from `Evaluation` so it can never leak into the official score unless a future feature explicitly joins them.
- **DemoDeliverable**, **DeliverableOwner** (M:N to `User`) — `status: NOT_STARTED | IN_PROGRESS | COMPLETED | BLOCKED | PARTIALLY_COMPLETED`.

### Evaluations
- **EvaluationCriterion** — the six official questions are *seed data*, not hardcoded logic (`code`, `text`, `dimension`, `order`, `weight`, `active`). Adding a 7th question (e.g. "Code quality") is an insert, not a migration (section 65/66).
- **Evaluation** — one row per `(demo, developer, evaluator)`, unique constraint enforces "a manager evaluates each developer at most once per demo" (rule #3). `projectId` is stored directly (not derived) so a developer on multiple projects gets an unambiguous evaluation record, and so historical evaluations are immune to later project reassignment. `score` is a cached `Float` computed by `computeEvaluationScore` at save time.
- **EvaluationAnswer** — one row per `(evaluation, criterion)`, `answer: Boolean` + optional `comment`.
- **ManagerOpinion** — one evolving row per `(developer, manager)` pair — `strengths/concerns/growthAreas` free text, `confidence: 1-5`, `trend`, `recommendation` enum. Structurally separate from `Evaluation` (section 14): it's about the person over time, not about one demo.

### AI layer
- **AiInsight** — `subjectType: PERSON | TEAM | PROJECT | ORGANIZATION` + nullable `subjectId` (null only for the org-level row) + `type` (`STRENGTH | DEVELOPMENT | RISK | RECOGNITION | RECOMMENDATION | TREND | SUMMARY`) + `evidence: Json`. No FK to `User`/`Team` — subjects are resolved by id at read time — because an insight can point at any of four different entity kinds.
- **AiAlert** — same subject shape, plus `type` (the 8 alert types from section 25), `severity: INFORMATIONAL | LOW | MEDIUM | HIGH`, `status: ACTIVE | ACKNOWLEDGED | RESOLVED`, `evidence: Json`.
- **Recognition** — FK'd to `User` (always about a developer), `source: AI | MANAGER`, `acknowledged: Boolean`.

### Operational
- **Notification** — `userId` FK, `read: Boolean`, generic `type`/`title`/`body`/`link`.
- **AuditLog** — generic `(userId, entityType, entityId, action, before, after)` — used today for demo create/status-change; the shape supports extending to every mutation without a schema change.

## Indexes

Every foreign key column carries an explicit `@@index` (in addition to Postgres auto-indexing the FK itself) for the join patterns the app actually uses: by user, by team, by project, by demo, by evaluator, and `Evaluation.createdAt` / `Demo.date` for time-range queries. Composite unique constraints (`@@unique`) double as the natural lookup index for upserts (`saveEvaluation`, `recordAttendance` both upsert on their unique key).

## Deliberately NOT modeled (yet)

- Per-role evaluator weighting (section 37) — `EvaluationCriterion.weight` exists per-question; a per-evaluator-type weight would need a join table (`EvaluatorRoleWeight`) that isn't built.
- Calendar provider integration (section 39) — no `CalendarEvent`/external-id table; `Demo.date/startTime/endTime` is the only calendar-relevant data today.
