# Requirements checklist

Status: **Met** / **Partial** / **Not met**. Paths are relative to the repo root.

## Stack and standards

| # | Requirement | Status | Implemented in |
| --- | --- | --- | --- |
| 1 | Next.js App Router, React, TypeScript strict | Met | `tsconfig.json` (`strict`), `src/app/` |
| 2 | Prisma + PostgreSQL | Met | `prisma/schema.prisma`, `src/lib/db.ts` |
| 3 | Zod validates every input on the server before any DB query | Met (see note 1) | `src/domain/schemas.ts`; each action in `src/actions/` parses first; `src/lib/auth.ts` (`signInSchema`) |
| 4 | SWR for client queries and cache invalidation | Met | `src/lib/fetchers.ts`, `src/lib/use-action.ts`, `src/app/(app)/*-view.tsx` |
| 5 | Server Actions for ALL reads and mutations; client never imports Prisma | Met | `src/actions/*.ts`; `server-only` in `src/lib/db.ts`; no client file imports Prisma (checked by grep) |
| 6 | NextAuth Credentials, JWT session with user `id` and `role` | Met | `src/lib/auth.ts`, `src/types/next-auth.d.ts` |
| 7 | bcryptjs password hashing | Met | `src/lib/auth.ts`, `prisma/seed.ts` |
| 8 | Tailwind, accessible, responsive | Met | `src/app/globals.css`, `src/components/` (checked at 360px) |
| 9 | Every action returns `{ success, data?, error? }` | Met | `src/domain/result.ts`, `src/domain/run-action.ts`; `src/actions/__tests__/*` |
| 10 | Mutating actions lead to SWR `mutate` on the client | Met | `src/lib/use-action.ts`, `src/app/(app)/opportunities/[id]/use-opportunity-action.ts`, `create-opportunity-dialog.tsx` |
| 11 | Buttons disabled / loading while a submission is in flight | Met | `src/components/ui/loading-button.tsx`, `src/lib/use-action.ts` (ignores overlapping calls) |

## Domain rules

| # | Requirement | Status | Implemented in |
| --- | --- | --- | --- |
| 12 | Roles ADMIN / REVIEWER / VIEWER; stages DRAFT / UNDER_REVIEW / APPROVED / REJECTED; currencies USD / EUR / GBP | Met | `prisma/schema.prisma`, `src/domain/enums.ts` |
| 13 | RBAC matrix enforced in Server Actions from the verified session | Met | `src/domain/rbac.ts`, `src/lib/action-guard.ts`; every role x permission tested in `mutations.test.ts` |
| 14 | View dashboard and list: all roles | Met | `getDashboardStats`, `listOpportunities`, `getOpportunity` (`VIEW`) |
| 15 | Create: Admin only, starts as DRAFT | Met | `createOpportunity` in `src/actions/opportunity-mutations.ts` |
| 16 | Edit details: Admin only, not when archived | Met | `updateOpportunity` |
| 17 | Assign reviewer: Admin only; target must have role REVIEWER (checked in DB); can unassign | Met | `assignReviewer` |
| 18 | Change stage: Admin and Reviewer, only via the state machine | Met | `changeStage`, `src/domain/state-machine.ts` |
| 19 | Any other transition rejected with a descriptive error | Met | `assertTransition`: "Invalid stage transition. Cannot move from APPROVED to DRAFT. Allowed next stages: none." |
| 20 | Archived opportunities cannot be edited or transitioned | Met | `assertNotArchived` in `src/lib/opportunity-guards.ts`; guarded `updateMany` |
| 21 | Add comment: all roles | Met | `addComment` in `src/actions/comments.ts` |
| 22 | Archive / Restore: Admin only | Met | `archiveOpportunity`, `restoreOpportunity` |
| 23 | Stage change and its ActivityLog entry in one `prisma.$transaction` | Met | every mutation; rollback proven in the atomicity tests in `mutations.test.ts` |

## Phase 1: schema

| # | Requirement | Status | Implemented in |
| --- | --- | --- | --- |
| 24 | Config files, scripts (dev, build, typecheck, db:migrate, db:seed, db:reset, db:studio), `.env.example`, optional compose | Met | `package.json`, `.env.example`, `docker-compose.yml` (plus `lint`, `test`) |
| 25 | User, Opportunity, Comment, ActivityLog models with relations, enums, foreign keys | Met | `prisma/schema.prisma` |
| 26 | Description <= 500 and comment 1-1000 enforced at DB level | Met | `VarChar` limits + `CHECK` constraints in `prisma/migrations/*_init/migration.sql` |
| 27 | ActivityLog append-only with no update/delete path | Met | trigger in the initial migration, `onDelete: Restrict`, single writer `src/lib/activity.ts` |
| 28 | Indexes for list filter, sorting, reviewer workload, timeline reads | Met | `@@index` entries in `prisma/schema.prisma` |
| 29 | Header comment listing invariants Prisma cannot enforce | Met | top of `prisma/schema.prisma` |
| 30 | `db.ts` singleton, hot-reload safe, `server-only` | Met | `src/lib/db.ts` |

## Phase 2: seed

| # | Requirement | Status | Implemented in |
| --- | --- | --- | --- |
| 31 | Four users with the given emails and roles, hashed password | Met | `prisma/seed.ts` |
| 32 | 12+ opportunities covering all stages, currencies, both reviewers, unassigned DRAFT, UNDER_REVIEW without reviewer, 3+ archived, archived-then-restored, recent dates, wide amount range | Met | `prisma/seed.ts` (15 opportunities) |
| 33 | Comments from all roles; ActivityLog exactly matches each history; chronological, never in the future | Met | `prisma/seed.ts` (`build`, `verify`) |
| 34 | Idempotent; production guard; in-memory replay check before writing; prints a summary | Met | `prisma/seed.ts` |

## Phase 3: domain layer

| # | Requirement | Status | Implemented in |
| --- | --- | --- | --- |
| 35 | `ActionResult`, `ok`, `fail`, stable error constants | Met | `src/domain/result.ts` |
| 36 | Zod schemas for every action input and the list query (invalid params fall back to defaults); no client user id or role | Met | `src/domain/schemas.ts` |
| 37 | State machine module | Met | `src/domain/state-machine.ts` |
| 38 | RBAC module with `can` and a FORBIDDEN helper | Met | `src/domain/rbac.ts` (`denyUnless`) |
| 39 | DTO types and serialisers (Decimal -> string, Date -> ISO) | Met | `src/domain/dto.ts` |
| 40 | `runAction` wrapper that hides internals | Met | `src/domain/run-action.ts` |
| 41 | Vitest tests for state machine, RBAC, list-query parser | Met | `src/domain/__tests__/` |
| 42 | Domain layer imports no Prisma, next-auth or React | Met | verified by grep |

## Phase 4: authentication

| # | Requirement | Status | Implemented in |
| --- | --- | --- | --- |
| 43 | Credentials login; one generic "Invalid email or password" for both failures | Met | `src/lib/auth.ts`, `src/app/login/login-form.tsx` |
| 44 | `id` and `role` in the JWT and typed on `session.user` | Met | `src/lib/auth.ts`, `src/types/next-auth.d.ts` |
| 45 | `getVerifiedSession()` from the verified session, UNAUTHENTICATED result, DB re-check | Met | `src/lib/session.ts` |
| 46 | Redirect signed-out users to /login; signed-in users away from /login | Met | `src/proxy.ts` |
| 47 | Accessible /login with loading state; sign-out control | Met | `src/app/login/`, `src/components/sign-out-button.tsx` |

## Phases 5-6: Server Actions

| # | Requirement | Status | Implemented in |
| --- | --- | --- | --- |
| 48 | Dashboard stats via groupBy/aggregate; all stage and currency keys present; top 5 recent; reviewer workload incl. zeros | Met | `src/actions/dashboard.ts` |
| 49 | List: search, stage, archived (documented), sort with id tiebreak, pagination, page past the end safe | Met | `src/actions/opportunities.ts` |
| 50 | `getOpportunity` with comments and one chronological timeline; unknown id -> NOT_FOUND | Met | `src/actions/opportunities.ts`, `src/lib/opportunity-detail.ts` |
| 51 | `listReviewers` returns REVIEWER users only | Met | `src/actions/reviewers.ts` |
| 52 | SWR fetchers that throw on failure; stable key builders | Met | `src/lib/fetchers.ts` |
| 53 | Concurrency-safe stage change (conditional update) | Met | `changeStage`; concurrent test in `mutations.test.ts` |
| 54 | Same reviewer again -> descriptive error; already archived / not archived -> clear message | Met | `ERRORS` in `src/domain/result.ts` |
| 55 | `docs/server-actions.md` covers every action and matches the code | Met | `docs/server-actions.md`; `src/actions/__tests__/docs.test.ts` fails on drift |
| 56 | Tests: forbidden roles, invalid transitions, archived blocks, reviewer-role check, atomicity | Met | `src/actions/__tests__/mutations.test.ts` |

## Phases 7-9: UI

| # | Requirement | Status | Implemented in |
| --- | --- | --- | --- |
| 57 | App shell: header, nav, user name + role badge, sign-out, skip link, landmarks | Met | `src/app/(app)/layout.tsx`, `src/components/app-header.tsx` |
| 58 | SWRConfig provider and a `useAction` mutation helper (pending, error, mutate) | Met | `src/components/providers.tsx`, `src/lib/use-action.ts` |
| 59 | StageBadge, CurrencyAmount, Skeleton, EmptyState, ErrorState (retry), ConfirmDialog/Modal (focus trap, Esc), LoadingButton | Met | `src/components/ui/` |
| 60 | Dashboard with skeleton, empty and error states; top 5 link to details | Met | `src/app/(app)/dashboard-view.tsx` |
| 61 | List controls; all state in the URL; page resets on filter change; back/forward | Met | `src/app/(app)/opportunities/opportunities-view.tsx` |
| 62 | Previous data kept while loading; skeleton on first load; table on desktop, cards on mobile | Met | same file |
| 63 | Admin-only "New opportunity" modal with hints, server error, loading, list + dashboard refresh | Met | `create-opportunity-dialog.tsx`, `src/components/opportunity-form.tsx` |
| 64 | Detail page shows all fields and a clear archived banner | Met | `src/app/(app)/opportunities/[id]/detail-view.tsx` |
| 65 | Unknown id -> `notFound()` with a friendly page; other errors -> retryable error state | Met | `[id]/page.tsx`, `[id]/not-found.tsx`, `[id]/detail-view.tsx` |
| 66 | Role- and state-aware actions: edit, assign, stage buttons (confirm on terminal), archive/restore, comment | Met | `[id]/actions-panel.tsx`, `[id]/comment-form.tsx` |
| 67 | Timeline: chronological, icon and label per type, actor, timestamps with full title | Met | `[id]/activity-timeline.tsx` |
| 68 | Long text wraps; everything works at 360px | Met | verified in a browser at 360px |

## Notes

1. `getVerifiedSession()` runs one query (to confirm the signed-in user still exists and to read their current role) before the input is validated. That query uses the id from the signed session, not anything the client sent, so no client-supplied input reaches the database before validation.
2. Route protection is in `src/proxy.ts` because Next.js 16 renamed `middleware.ts` to `proxy.ts`.
