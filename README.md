# Capital Opportunities Tracker

A small internal tool for tracking capital opportunities through review. Admins create and manage opportunities, reviewers move them through a fixed approval workflow, and everyone can browse, search and comment. Every change is recorded in an append-only activity timeline.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Prisma 6 + PostgreSQL · Zod · SWR · NextAuth v4 (Credentials, JWT) · bcryptjs · Tailwind CSS 4 · Vitest.

## Quick start

Prerequisites: **Node.js 20+** (developed on 22), **npm**, and **Docker** for the bundled PostgreSQL. To use your own PostgreSQL 14+ instead, skip `docker compose` and put its URL in `DATABASE_URL`.

```bash
cp .env.example .env
docker compose up -d          # PostgreSQL on localhost:5434
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev                   # http://localhost:3000
```

`.env.example` ships with a development-only `NEXTAUTH_SECRET` placeholder. Generate a real one (`openssl rand -base64 32`) for anything that is not your laptop.

`npx prisma db seed` is safe to re-run: it wipes and reloads all data. It refuses to run with `NODE_ENV=production` unless `SEED_ALLOW_PRODUCTION=true`.

### Seeded accounts

All passwords are `Password123!`.

| Email | Name | Role | Can do |
| --- | --- | --- | --- |
| `admin@tracker.local` | Alice Morgan | ADMIN | Everything: create, edit, assign reviewer, change stage, archive/restore, comment |
| `reviewer1@tracker.local` | Daniel Okafor | REVIEWER | View, change stage, comment |
| `reviewer2@tracker.local` | Priya Raman | REVIEWER | View, change stage, comment |
| `viewer@tracker.local` | Sam Whitfield | VIEWER | View, comment |

The seed creates 15 opportunities covering every stage, all three currencies (USD, EUR, GBP), both reviewers, unassigned and unreviewed items, 3 archived opportunities and one that was archived and restored, with 49 comments and a matching activity log.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `npm run build` | Development server / production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next.js + TypeScript rules) |
| `npm test` | Vitest: unit tests plus integration tests against a real database (see below) |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | Same as `npx prisma db seed` |
| `npm run db:reset` | Drop, re-migrate (and re-seed) the dev database |
| `npm run db:studio` | Prisma Studio |

**Tests** need PostgreSQL running. They create and migrate a separate `<database>_test` database (for example `capital_tracker_test`) and refuse to run against any database whose name does not end in `_test`, so your dev data is never touched.

## Documentation

- [`docs/server-actions.md`](docs/server-actions.md): every Server Action: purpose, who can call it, inputs and validation rules, success output, and every failure. A test (`src/actions/__tests__/docs.test.ts`) fails if it drifts from the code.
- [`docs/requirements-checklist.md`](docs/requirements-checklist.md): the original requirements mapped to the files that implement them.
- The top of [`prisma/schema.prisma`](prisma/schema.prisma) lists the invariants Prisma cannot express and where each is enforced.

## Folder structure

```
prisma/
  schema.prisma            data model + invariant notes
  migrations/              initial migration, incl. CHECK constraints and the append-only trigger
  seed.ts                  consistent demo data, verified by replaying each opportunity's log
src/
  domain/                  pure logic, no DB / NextAuth / React (unit-tested)
    schemas.ts             Zod schemas + list-query parser/serialiser
    state-machine.ts       allowed stage transitions
    rbac.ts                permission matrix
    result.ts              ActionResult, ok/fail, ERRORS
    run-action.ts          error-handling wrapper for actions
    dto.ts                 DTO types + serialisers (Decimal -> string, Date -> ISO)
  actions/                 "use server" files: the only application API
  lib/                     server helpers (db, auth, session, guards, queries) + client helpers (fetchers, use-action)
  app/
    login/                 sign-in page
    (app)/                 authenticated shell: dashboard, /opportunities, /opportunities/[id]
    api/auth/              NextAuth route handler
  components/              shared UI (header, form, modal, badges, states)
  proxy.ts                 route protection (Next.js 16 name for middleware)
test/                      integration-test setup (test database, session mock)
docs/                      action reference, requirements checklist
```

## Architectural decisions

- **Server-only Prisma access.** `src/lib/db.ts` imports `server-only`, so any client component that imports it fails the build. Only Server Actions and server helpers touch the database; client components never see Prisma.
- **Server Actions are the only API.** Every read and write is a Server Action. There are no REST routes apart from NextAuth's. Client code reaches them through SWR fetchers (`src/lib/fetchers.ts`) and the `useAction` hook. Each action follows the same steps: verify session → check permission → validate with Zod → query → return a DTO in an `ActionResult`.
- **Actor and role come from the session.** No input schema has a user id or role, and unknown input keys are dropped. `getVerifiedSession()` reads the signed JWT and re-reads the user from the database, so a deleted user is rejected and a role change takes effect immediately rather than when the token expires.
- **State machine + transactions.** The only transitions are `DRAFT → UNDER_REVIEW → APPROVED | REJECTED`, defined once in `src/domain/state-machine.ts`. Every mutation changes the row and writes its `ActivityLog` entry inside one `prisma.$transaction`. Writes are conditional on the state that was read (`updateMany … WHERE stage = <read stage>`), so of two concurrent stage changes only one wins and the other gets a clear error.
- **Append-only `ActivityLog`.** A database trigger rejects `UPDATE`, `DELETE` and `TRUNCATE`, foreign keys use `onDelete: Restrict`, and the app only ever creates rows (through one helper, `src/lib/activity.ts`). The seed disables the trigger inside its own transaction to wipe data, which is the only bypass.
- **Decimal handling.** Amounts are `Decimal(18,2)` in the database and decimal *strings* everywhere else: Zod accepts up to 16 digits and 2 decimals and never converts to a float, DTOs use `toFixed(2)`, and the UI formats with `Intl.NumberFormat` (which accepts strings), so no precision is lost. Amounts in different currencies are never added together.
- **SWR key strategy.** Keys are tuples built in one place (`keys.dashboard()`, `keys.opportunities(query)`, `keys.opportunity(id)`, `keys.reviewers()`). After any mutation on an opportunity the app revalidates its detail key, **every** list key (matched by `isOpportunitiesKey`, whatever the filters or page) and the dashboard key, so all three views stay in sync without a reload.
- **The URL is the source of truth for list state.** Search, stage, archived, sort and page live in the query string and are parsed by the same Zod parser the server uses, with invalid values falling back to defaults. Reload, share and back/forward all work, and any filter change resets to page 1. The search box is local state, debounced into the URL; the selects update optimistically while navigation is in flight.
- **Archive-filter semantics.** `archived=false` (default) hides archived opportunities; `archived=true` shows *only* archived ones. Archived opportunities are read-only.
- **Defence in depth for data rules.** Length and range limits exist as Zod rules, `VARCHAR` limits and `CHECK` constraints; UI validation is only a hint.
- **No internal detail leaks.** `runAction` returns validation errors and deliberate failures verbatim, and turns anything else into a generic message while logging the details on the server. Sign-in returns one message for unknown email and wrong password.

## Assumptions

Where the requirements were silent I chose the following:

- **Assigning a reviewer counts as an edit**, so it is blocked on archived opportunities. It is allowed at any stage.
- **Commenting is allowed on archived opportunities.** Archiving freezes edits and stage changes only.
- **Reviewers are not restricted to the opportunities assigned to them** when changing stage (the requirements did not say so).
- **Editing writes no activity entry** because there is no edit log type; only the `updatedAt` column changes.
- **`listReviewers` needs only the view permission**, as reviewer names are already visible on every opportunity.
- **A `description` may be empty**; the 500-character maximum is the only rule. Amounts must be greater than zero.
- **`submissionDate` is a full timestamp** in the database. The edit form uses a date input, so saving an edit sets it to midnight UTC of that day. All times are shown in UTC.
- **Dashboard contents:** total active and archived counts, active count per stage, requested amount per currency, the 5 most recently submitted active opportunities, and per-reviewer counts of active assigned opportunities (reviewers with none show 0). All exclude archived opportunities except the archived count.
- **List paging:** a page past the last is clamped to the last page (and the URL corrected); an out-of-range `pageSize` falls back to 10 rather than being clamped. `%` and `_` in the search box match literally.
- **Reviewer-assignment log entries** store both reviewer ids and their names (a snapshot), and older entries without names fall back to a live lookup.
- **Next.js 16 renamed middleware to `proxy.ts`**, so route protection lives there. Prisma is pinned to 6.x, and TypeScript to 6.x because typescript-eslint does not yet support TypeScript 7.
- **Docker Compose maps PostgreSQL to host port 5434** to avoid clashing with a local server on 5432.
- **The seed wipes all users and data**, not only its own rows; it is a development tool.
- **No component library:** plain Tailwind and semantic HTML, with the native `<dialog>` element for modals (focus trap, Esc to close, focus restore).

## Known limitations and next steps

- **No login rate limiting or lockout.** Add throttling (for example by IP and email) before exposing this publicly.
- **No user management.** Accounts exist only through the seed; add an admin screen and password change/reset.
- **No security headers or CSP** beyond the framework defaults; add them at the proxy or hosting layer.
- **Timestamps are UTC only**, with no per-user time zone.
- **Timeline is not paginated**, and the list has no page-size control or CSV export.
- **The row-link "stretched link" pattern and native `<dialog>`** were checked in Chrome only.
- **Optimistic UI is limited** to list controls; mutations wait for the server before refreshing.
- **End-to-end browser tests** are not part of the repo (the UI was checked with a scripted browser during development); adding Playwright would be the next testing step.
- **The session lookup on every action** costs one small query; cache it briefly if that ever matters.
