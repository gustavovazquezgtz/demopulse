# DemoPulse — Implementation Plan

> Written retrospectively as accurate documentation of what was built and why, rather than a speculative upfront design — given the size of the spec (72 sections), the fastest path to something real was to scaffold, get one vertical slice working end-to-end against a real database, and expand breadth from there (per the spec's own section 68 guidance), verifying with `next build` + a runtime smoke test after every batch of pages rather than writing 20 screens blind.

## Phases, as actually executed

1. **Inspect** — no existing DemoPulse code; confirmed Postgres 16 available locally (Homebrew), no LLM API keys in the environment, Next.js 16.3 / React 19.2 / Tailwind v4 installed by `create-next-app` (materially different APIs from older training data — read `node_modules/next/dist/docs/` before writing App Router code, per this repo's own `AGENTS.md`).
2. **Schema** — designed the full `prisma/schema.prisma` up front (Section 45's entity list), including a correction mid-build: the spec distinguishes "Users" (Manager/CEO, who log in) from "Developers/Team Members" (who don't) — the schema uses one `User` table with a `DEVELOPER` role and nullable `passwordHash` rather than two parallel person tables, so every relationship (team, project, demo, evaluation) stays uniform. See `DATABASE_SCHEMA.md`.
3. **Auth** — NextAuth v5 (Credentials + JWT), scoping helpers (`permissions.ts`, `evaluation-rules.ts`).
4. **Vertical slice** — Create Demo → Deliverables → Invite → Attendance → Evaluate → Score → Results → AI Insight, built and manually verified against a running dev server (curl + cookie-jar login flow) before expanding.
5. **Breadth** — People, Teams, Projects, Calendar, Ranking, Team Comparison, Insights, Alerts, Recognition, Evaluations queue, Reports, Settings, Search — one query module + one page per area, reusing the same `Scope`/`ScoreBadge`/`InsightCard`/`DimensionBars` primitives throughout for visual and behavioral consistency.
6. **Seed data** — realistic longitudinal dataset (15 developers, 3 teams, 5 projects, 18 demos across ~10 weeks) with deliberately engineered narrative signals (a consistent top performer, a declining/at-risk developer, a cross-team guest-evaluator variance case, dimension-specific strengths/gaps) so the AI layer and dashboards are meaningful immediately, not just structurally present.
7. **AI layer** — built as gather → analyze (swappable provider) → persist/alert, see `ARCHITECTURE.md`.
8. **Verify** — `next build` (typecheck) after every batch of new files, `eslint`, `vitest` (pure-function + real-DB integration tests), and curl-driven runtime smoke tests logging in as both a Manager and the CEO and hitting every route.

## Permissions model

- **CEO**: `UNSCOPED` — every query function treats `scope.teamIds/projectIds/personIds === null` as "no filter."
- **Manager**: `buildManagerScope(userId)` — teams they manage → projects (direct `ProjectManager` rows + projects owned by those teams) → people (team members + project assignees). Computed per-request, not stored, so it can never go stale when team/project assignments change.
- **Evaluation eligibility**: `canEvaluate(demoId, evaluatorId, developerId)` in `evaluation-rules.ts` — both must have `DemoAttendee.status === PRESENT`, the evaluator must have a `DemoInvitee` row with `role: EVALUATOR_MANAGER`, and self-evaluation is rejected. Checked server-side in the `saveEvaluation` Server Function on every save, not just in the UI. Covered by integration tests in `src/lib/__tests__/permissions.test.ts`.

## AI/API design

See `ARCHITECTURE.md` → "AI architecture." Short version: `AIProvider` interface with `RuleBasedProvider` (default, deterministic, zero config) and `OpenAIProvider` (optional, activates on `OPENAI_API_KEY`, falls back to rule-based on any error), a pure `deriveAlerts()` function for reproducible severity, and three persistence services (`AIInsightService`, `AIAlertService`, `AIRecognitionService`) plus `AITeamSummaryService` for team/org narratives.

## UI structure

`app/(app)/layout.tsx` is the single authenticated shell (`Sidebar` + `Topbar`, session-gated); every page under it is a Server Component that fetches its own scoped data. Design system: hand-authored Radix-based primitives in `components/ui` (no external CLI/network dependency), CSS-variable palette in `globals.css` with light/dark support driven by `prefers-color-scheme`.

## Testing strategy actually implemented

- **Pure unit tests** (`scoring.test.ts`): `computeEvaluationScore`, `computeTrend`, `computeConfidence`, `computeAgreement` — 15 cases covering equal/weighted scoring, insufficient-data trend edge cases, and the confidence/agreement thresholds from sections 36/59.
- **Integration tests against the seeded dev DB** (`permissions.test.ts`): the specific scenarios section 69 calls out — a manager cannot evaluate a developer who didn't attend; a manager who didn't attend cannot evaluate; a manager from a different team *can* evaluate when both attended and they were invited as an evaluator; self-evaluation is rejected — plus a data-integrity check that every stored `Evaluation.score` matches its own answers and every evaluation is backed by two PRESENT attendance rows.
- **AI pipeline tests** (`ai-insights.test.ts`): the deliberately-declining seed developer produces a RISK insight and a HIGH-severity alert; the deliberately top-performing developer gets a `Recognition` row; an organization-level `SUMMARY` insight exists. Run with `npm test`.

## What's next (not built — see ARCHITECTURE.md "deliberately simplified")

Per-evaluator-role weighting UI, PDF/export, live notification generation from events, editable Settings (criteria/users/roles), calendar week view, calendar provider integrations.
