# DemoPulse — Architecture

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.3 (App Router, Turbopack) | Server Components for all data reads; Server Functions (`"use server"`) for mutations |
| Language | TypeScript, strict mode | |
| UI | Tailwind CSS v4 (CSS-first config) + hand-authored Radix primitives (`src/components/ui`) | shadcn-style, no CLI dependency, no network calls at build/dev time |
| Charts | Recharts | Trend area chart, team comparison bars; simple bars (`DimensionBars`) use plain divs for anything that doesn't need a chart |
| Forms | react-hook-form + zod | `zodResolver`; schemas in `src/lib/validations` are the single source of truth for both client validation and server-side re-validation |
| Database | PostgreSQL 16 (local Homebrew instance for dev) | |
| ORM | Prisma 5.22 (pinned — Prisma 8 ships a different, cloud-platform-oriented CLI unsuited to a local Postgres workflow) | |
| Auth | Auth.js / NextAuth v5 (beta), Credentials provider, JWT sessions, bcrypt password hashing | No OAuth adapter needed since only the Credentials flow is used |
| AI | Custom `AIProvider` abstraction (see below) | Zero external dependency by default |
| Testing | Vitest | Pure-function unit tests + read-only integration tests against the seeded dev DB |

## Directory layout

```
prisma/
  schema.prisma        # full data model
  seed.ts               # realistic longitudinal seed data + runs the AI pipeline once
src/
  app/
    login/               # public
    (app)/               # authenticated route group — layout enforces session + renders shell
      dashboard/ people/ teams/ projects/ demos/ calendar/ evaluations/
      insights/ alerts/ recognition/ ranking/ team-comparison/ reports/ settings/ search/
    api/auth/[...nextauth]/route.ts
  components/
    ui/                  # design-system primitives (Button, Card, Table, Dialog, ...)
    layout/               # Sidebar, Topbar, nav config
    charts/               # ScoreTrendChart, TeamComparisonChart, DimensionBars
    dashboard/             # StatCard, TopPerformersList, NeedsAttentionList, ScoreBadge
    demos/                # AttendanceForm
    insights/             # InsightCard ("Why am I seeing this?"), AlertActions
    projects/              # UrlCards
  lib/
    prisma.ts             # singleton client
    auth.ts                # NextAuth config
    permissions.ts          # requireSession/isCeo + scoping helpers (imports next-auth)
    evaluation-rules.ts      # canEvaluate — deliberately isolated from next-auth so it's unit-testable
    scoring.ts               # computeEvaluationScore / computeTrend / computeConfidence / computeAgreement (pure)
    queries/                  # read-only data-access functions, one file per domain area
    actions/                   # "use server" mutations (createDemo, saveEvaluation, recordAttendance, ...)
    validations/                 # zod schemas
    ai/
      types.ts                    # AIProvider interface + structured I/O types
      rule-based-provider.ts        # default provider — deterministic, evidence-only, zero config
      openai-provider.ts             # optional provider, activates only if OPENAI_API_KEY is set
      index.ts                        # provider factory
      gather.ts                        # builds DeveloperAnalysisInput from Prisma
      alert-rules.ts                    # deterministic AIAnalysisOutput -> AlertSpec[] mapping
      services.ts                        # AIInsightService, AIAlertService, AIRecognitionService (persistence)
      team-org-insights.ts                # AITeamSummaryService (team/org aggregate narratives)
```

## Request flow

Every page under `app/(app)/` is a Server Component. It calls `requireSession()` (redirects to `/login` if unauthenticated), computes a `Scope` (CEO = unscoped, Manager = `buildManagerScope(userId)` — the set of team/project/person ids the manager can see), then calls one or more `queries/*` functions and renders. Mutations go through `actions/*` Server Functions, which re-run `requireSession()` and the relevant business-rule check (e.g. `canEvaluate`) before touching the database — the UI never gates behind client-only checks.

## Scoping model (sections 43, 58)

A manager's visible surface is derived, not stored: `managedTeamIds` → `visibleProjectIds` (direct `ProjectManager` rows + projects owned by managed teams) → `visiblePersonIds` (team members + project assignees). The CEO scope is the sentinel `UNSCOPED = { teamIds: null, projectIds: null, personIds: null }`, and every query function treats `null` as "no filter" — so there is exactly one code path for both roles, not a CEO-only branch duplicated across every query.

## AI architecture (sections 22, 47, 48)

The AI layer is split into three concerns so that trust and traceability don't depend on prompt engineering:

1. **Evidence gathering** (`gather.ts`) — pulls every source the spec allows (evaluations + comments, manager opinions, attendance, participation, historical scores) into a typed `DeveloperAnalysisInput`. Nothing else is available to the AI layer.
2. **Analysis** (`AIProvider.analyzeDeveloper`) — turns that input into structured `strengths / growthAreas / riskSignals / recommendations / recognition`, each with an `evidence.details: string[]` array. The default `RuleBasedProvider` computes this with plain arithmetic over the input (dimension yes-rates, trailing streaks, trend deltas) and renders template prose — so every sentence is literally derived from a number in the input; there is no invention possible. `OpenAIProvider` (used only when `OPENAI_API_KEY` is set) sends the same structured input to an LLM with an explicit "use only these facts, never make employment judgments" system prompt, and falls back to the rule-based provider on any failure so a flaky AI call never breaks the page.
3. **Persistence & alerting** (`services.ts`, `alert-rules.ts`) — `AIInsightService.generateForDeveloper` regenerates the `AiInsight` feed for one person (delete-and-replace — insights are a recomputed view, not an audit log). `deriveAlerts` is a **pure, deterministic** function from `AIAnalysisOutput` to `AlertSpec[]` with severity (section 26) — it never touches the LLM, so alert severity is reproducible and explainable regardless of which provider is active. `AIAlertService.syncDeveloperAlerts` upserts active alerts and auto-resolves ones whose underlying signal has cleared, preserving any ACKNOWLEDGED state a manager set. `AIRecognitionService` appends de-duplicated `Recognition` rows.

`AITeamSummaryService` (team-org-insights.ts) runs the same "gather real numbers, template the prose" pattern at the team and organization level for the Executive AI Summary.

The pipeline runs synchronously after `saveEvaluation(..., complete: true)` for the affected developer, team, and organization — so insights/alerts are always current within one request of the last evaluation, with no background job needed at this scale.

## Auth & the Manager/CEO/Developer distinction

`User.role` is `MANAGER | CEO | DEVELOPER`. Only the first two authenticate (`passwordHash` is `null` for developers, and `authorize()` rejects non-manager/CEO roles even if a hash were somehow present). This single-table design lets every relationship in the schema (team membership, project assignment, demo attendance, evaluation) point at one `User` id regardless of whether that person can log in — matching section 3's requirement for proper many-to-many relationships without a parallel "Person" table.

## What's deliberately simplified for this build

- **Calendar** ships a working month view; week/agenda views are represented by the `/demos` list (functions as an agenda) rather than a separate week grid.
- **Manager weighting** (section 37) — the scoring model computes a straight average; the schema (`EvaluationCriterion.weight`, per-criterion) already supports weighting, but a configurable per-evaluator-role weight is not wired into a settings UI yet.
- **Reports/export** — the Reports page links into the live pages (which already carry all the data reporting needs) rather than generating PDFs; no export pipeline is implemented.
- **Notifications** are seeded and rendered, but nothing currently creates new ones from live events (e.g. a "3 evaluations pending" notification is not auto-generated when a demo completes).
- **Settings** is read-only (criteria, users, AI config, org counts) — editing evaluation criteria, users, and roles from the UI is not implemented; it's all controllable via the database/seed today.
