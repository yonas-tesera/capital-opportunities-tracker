# Server Actions

Every application read and write is a Next.js Server Action. Client code never touches Prisma.

| Action | File | Permission |
| --- | --- | --- |
| [`getDashboardStats`](#getdashboardstats) | `src/actions/dashboard.ts` | `VIEW` |
| [`listOpportunities`](#listopportunities) | `src/actions/opportunities.ts` | `VIEW` |
| [`getOpportunity`](#getopportunity) | `src/actions/opportunities.ts` | `VIEW` |
| [`listReviewers`](#listreviewers) | `src/actions/reviewers.ts` | `VIEW` |
| [`createOpportunity`](#createopportunity) | `src/actions/opportunity-mutations.ts` | `CREATE` |
| [`updateOpportunity`](#updateopportunity) | `src/actions/opportunity-mutations.ts` | `EDIT` |
| [`assignReviewer`](#assignreviewer) | `src/actions/opportunity-mutations.ts` | `ASSIGN_REVIEWER` |
| [`changeStage`](#changestage) | `src/actions/opportunity-mutations.ts` | `CHANGE_STAGE` |
| [`archiveOpportunity`](#archiveopportunity) | `src/actions/opportunity-mutations.ts` | `ARCHIVE` |
| [`restoreOpportunity`](#restoreopportunity) | `src/actions/opportunity-mutations.ts` | `RESTORE` |
| [`addComment`](#addcomment) | `src/actions/comments.ts` | `ADD_COMMENT` |

## Conventions shared by every action

**Result shape.** Every action returns `ActionResult<T> = { success: boolean; data?: T; error?: string }`. On success `data` is set; on failure `error` holds one of the messages below. Actions never throw to the caller.

**Order of checks.** (1) `getVerifiedSession()` reads the signed session and re-reads the user from the database; (2) the role's permission is checked; (3) the input is validated with Zod; (4) the database is queried. The acting user is always the session user. No input schema has a user id or role, and unknown keys in the input are ignored.

**Inputs are `unknown`.** Actions accept `unknown` and validate it themselves.

**Writes.** Each mutation changes the data and writes its `ActivityLog` entry inside one `prisma.$transaction`, so a failure in either rolls back both. The transaction also re-reads the state it validated against, and the update is conditional on that state (see [Concurrency](#concurrency)). Mutations return the state they just wrote. Clients revalidate with SWR `mutate` (`keys` and `isOpportunitiesKey` in `src/lib/fetchers.ts`).

**Roles and permissions** (`src/domain/rbac.ts`):

| Permission | ADMIN | REVIEWER | VIEWER |
| --- | :-: | :-: | :-: |
| `VIEW` | yes | yes | yes |
| `CREATE` | yes | | |
| `EDIT` | yes | | |
| `ASSIGN_REVIEWER` | yes | | |
| `CHANGE_STAGE` | yes | yes | |
| `ADD_COMMENT` | yes | yes | yes |
| `ARCHIVE` | yes | | |
| `RESTORE` | yes | | |

**Stage transitions** (`src/domain/state-machine.ts`), the only ones allowed: `DRAFT → UNDER_REVIEW`, `UNDER_REVIEW → APPROVED`, `UNDER_REVIEW → REJECTED`.

### Error messages

Constants live in `ERRORS` (`src/domain/result.ts`). Use `isError(result, "KIND")` to test for one, because `VALIDATION` and `INVALID_TRANSITION` messages have details appended.

| Kind | Message |
| --- | --- |
| `UNAUTHENTICATED` | `You must be signed in to perform this action.` |
| `FORBIDDEN` | `You do not have permission to perform this action.` |
| `NOT_FOUND` | `Opportunity not found.` |
| `ARCHIVED` | `Archived opportunities are read-only. Restore the opportunity first.` |
| `VALIDATION` | `Validation failed.` followed by `field: message` for each problem, e.g. `Validation failed. companyName: Company name is required.` A bare-string input has no field prefix. |
| `INVALID_TRANSITION` | `Invalid stage transition. Cannot move from <FROM> to <TO>. Allowed next stages: <list or none>.` |
| `CONFLICT` | `The opportunity was changed by someone else. Refresh and try again.` |
| `INVALID_REVIEWER` | `The selected user does not exist or is not a reviewer.` |
| `ALREADY_ASSIGNED` | `That reviewer is already assigned to this opportunity.` |
| `NO_REVIEWER_ASSIGNED` | `This opportunity has no reviewer to unassign.` |
| `ALREADY_ARCHIVED` | `This opportunity is already archived.` |
| `NOT_ARCHIVED` | `This opportunity is not archived.` |
| `INTERNAL` | `Something went wrong. Please try again.` Any unexpected error (details are logged on the server only). |

Every action can also fail with `UNAUTHENTICATED`, `VALIDATION` (where it takes input) and `INTERNAL`. The per-action lists below name only what is specific to each action.

### Validation rules (`src/domain/schemas.ts`)

| Field | Rule | Messages |
| --- | --- | --- |
| `id`, `opportunityId` | string, trimmed, 1–64 chars | `Id is required.` / `Id is invalid.` |
| `reviewerId` | same as an id, or `null` | same |
| `companyName` | string, trimmed, 1–200 chars | `Company name is required.` / `Company name must be at most 200 characters.` |
| `requestedAmount` | string or number; up to 16 digits, optional `.` plus 1–2 decimals; greater than 0. Stored as a decimal string, never a float | `Requested amount is required.` / `Requested amount must be a positive number with at most 2 decimal places.` / `Requested amount must be greater than zero.` |
| `currency` | `USD`, `EUR` or `GBP` | `Currency must be one of USD, EUR or GBP.` |
| `submissionDate` | a `Date`, or a non-empty string parseable as a date | `Submission date is required.` / `Submission date must be a valid date.` |
| `description` | string, trimmed, 0–500 chars (may be empty) | `Description must be text.` / `Description must be at most 500 characters.` |
| `targetStage` | `DRAFT`, `UNDER_REVIEW`, `APPROVED` or `REJECTED` | `Target stage must be a valid stage.` |
| `content` | string, trimmed, 1–1000 chars | `Comment is required.` / `Comment cannot be empty.` / `Comment must be at most 1000 characters.` |

### Concurrency

Guarded writes use `updateMany` with the state that was read (for example `WHERE id AND stage = <current stage> AND isArchived = false`). If another request changed the row first, no row matches and the action fails with `CONFLICT` (or, for `changeStage`, the loser may instead see `INVALID_TRANSITION` if it starts after the winner committed) and nothing is written. Of two concurrent, conflicting stage changes, exactly one succeeds.

---

## Reads

### `getDashboardStats`

**Purpose.** Numbers and lists for the dashboard.

**Who can call it.** ADMIN, REVIEWER, VIEWER (`VIEW`).

**Inputs.** None.

**Success output.** `DashboardStatsDTO`:
- `totalActive`: number of non-archived opportunities.
- `totalArchived`: number of archived opportunities.
- `byStage`: `{ DRAFT, UNDER_REVIEW, APPROVED, REJECTED }`, non-archived counts. All four keys are always present, `0` when empty.
- `requestedAmountByCurrency`: `{ USD, EUR, GBP }` of non-archived opportunities, as decimal strings with 2 decimals (`"0.00"` when none). Currencies are never added together.
- `reviewerWorkload`: `{ reviewer: { id, name }, openCount }[]`, one per user with role REVIEWER (including `0`), ordered by name. `openCount` counts non-archived opportunities assigned to them.
- `recent`: the 5 most recently submitted non-archived opportunities (`OpportunitySummaryDTO[]`, newest `submissionDate` first, ties by id).

**Failures.** `UNAUTHENTICATED`, `FORBIDDEN` (not reachable with the current matrix), `INTERNAL`.

### `listOpportunities`

**Purpose.** Filtered, sorted, paginated list.

**Who can call it.** ADMIN, REVIEWER, VIEWER (`VIEW`).

**Inputs.** `query` (any object; `undefined` is treated as `{}`). Every field falls back to its default when missing or invalid, so this action never returns `VALIDATION`.

| Field | Rule | Default |
| --- | --- | --- |
| `search` | trimmed, at most 100 chars; blank or longer is ignored. Case-insensitive "contains" on `companyName`; `%`, `_` and `\` match literally | none |
| `stage` | one of the four stages | none (all stages) |
| `archived` | `true`, `false`, `"true"` or `"false"` | `false` |
| `sortBy` | `submissionDate` or `requestedAmount` | `submissionDate` |
| `sortDir` | `asc` or `desc` | `desc` |
| `page` | integer 1–10000 | `1` |
| `pageSize` | integer 1–50 (out of range falls back, it is not clamped) | `10` |

`archived: false` hides archived opportunities. `archived: true` shows archived opportunities only. Ties in the sort are broken by `id` ascending, so paging is stable.

**Success output.** `PaginatedResult<OpportunitySummaryDTO>`: `{ items, total, page, pageSize, totalPages }`. `totalPages` is at least 1. A `page` past the last one is clamped to the last page, and the returned `page` is the page actually served. `OpportunitySummaryDTO` is `{ id, companyName, requestedAmount (decimal string), currency, stage, submissionDate (ISO string), isArchived, assignedReviewer: { id, name } | null }`.

**Failures.** `UNAUTHENTICATED`, `FORBIDDEN` (not reachable with the current matrix), `INTERNAL`.

### `getOpportunity`

**Purpose.** Everything needed for the detail view.

**Who can call it.** ADMIN, REVIEWER, VIEWER (`VIEW`).

**Inputs.** `id`: the opportunity id (a bare string).

**Success output.** `OpportunityDetailDTO`: the summary fields plus `description`, `createdBy: { id, name }`, `createdAt`, `updatedAt` (ISO strings), `comments` and `timeline`.
- `comments`: `{ id, content, createdAt, author: { id, name } }[]`, oldest first.
- `timeline`: one chronological list (oldest first) built from `ActivityLog`, each item `{ id, createdAt, actor, type, metadata }`:
  - `CREATION` → `{ stage }`
  - `STAGE_CHANGE` → `{ previousStage, newStage }`
  - `REVIEWER_ASSIGNMENT` → `{ previousReviewer, newReviewer }`, each `{ id, name } | null`
  - `COMMENT_ADDED` → `{ commentId }`
  - `ARCHIVED` and `RESTORED` → `{}`

**Failures.** `UNAUTHENTICATED`, `FORBIDDEN` (not reachable with the current matrix), `VALIDATION` (empty or over-long id), `NOT_FOUND` (unknown id), `INTERNAL` (also if a log entry's stored metadata is malformed).

### `listReviewers`

**Purpose.** Options for the reviewer assignment dropdown.

**Who can call it.** ADMIN, REVIEWER, VIEWER (`VIEW`).

**Inputs.** None.

**Success output.** `{ id, name }[]` for users whose role is REVIEWER, ordered by name.

**Failures.** `UNAUTHENTICATED`, `FORBIDDEN` (not reachable with the current matrix), `INTERNAL`.

---

## Mutations

### `createOpportunity`

**Purpose.** Create a new opportunity.

**Who can call it.** ADMIN only (`CREATE`).

**Inputs.** `{ companyName, requestedAmount, currency, submissionDate, description }` per the validation rules. The stage is always `DRAFT` and `createdById` is the session user; neither can be supplied.

**Success output.** `OpportunityDetailDTO` of the new opportunity. Writes one `CREATION` log entry with metadata `{ stage: "DRAFT" }`.

**Failures.** `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION`, `INTERNAL`. If the log entry cannot be written, no opportunity is created.

### `updateOpportunity`

**Purpose.** Edit an opportunity's details.

**Who can call it.** ADMIN only (`EDIT`).

**Inputs.** `{ id, companyName, requestedAmount, currency, submissionDate, description }`. All five editable fields are required.

**Success output.** Updated `OpportunityDetailDTO`. No `ActivityLog` entry is written (there is no log type for edits).

**Failures.** `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `ARCHIVED`, `CONFLICT`, `INTERNAL`.

### `assignReviewer`

**Purpose.** Assign, change or remove the reviewer.

**Who can call it.** ADMIN only (`ASSIGN_REVIEWER`).

**Inputs.** `{ opportunityId, reviewerId }`. `reviewerId` is a user id, or `null` to unassign. The target user must exist and have role REVIEWER, checked in the database.

Assignment counts as an edit, so it is blocked on archived opportunities. It is allowed in any stage.

**Success output.** Updated `OpportunityDetailDTO`. Writes one `REVIEWER_ASSIGNMENT` entry with metadata `{ previousReviewer, newReviewer, previousReviewerName, newReviewerName }` (ids and names, `null` when there was no reviewer).

**Failures.** `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `ARCHIVED`, `INVALID_REVIEWER` (missing user, or a user whose role is not REVIEWER), `ALREADY_ASSIGNED` (same reviewer again), `NO_REVIEWER_ASSIGNED` (`null` when nobody is assigned), `CONFLICT`, `INTERNAL`.

### `changeStage`

**Purpose.** Move an opportunity to its next stage.

**Who can call it.** ADMIN and REVIEWER (`CHANGE_STAGE`). A reviewer does not have to be the assigned reviewer.

**Inputs.** `{ opportunityId, targetStage }`. The current stage is read inside the transaction and checked against the state machine.

**Success output.** Updated `OpportunityDetailDTO`. Writes one `STAGE_CHANGE` entry with metadata `{ previousStage, newStage }`.

**Failures.** `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `ARCHIVED` (checked before the transition), `INVALID_TRANSITION`, `CONFLICT`, `INTERNAL`.

### `archiveOpportunity`

**Purpose.** Archive an opportunity, which makes it read-only.

**Who can call it.** ADMIN only (`ARCHIVE`).

**Inputs.** `{ opportunityId }`.

**Success output.** Updated `OpportunityDetailDTO` with `isArchived: true`. Writes one `ARCHIVED` entry with metadata `{}`.

**Failures.** `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `ALREADY_ARCHIVED`, `CONFLICT`, `INTERNAL`.

### `restoreOpportunity`

**Purpose.** Restore an archived opportunity.

**Who can call it.** ADMIN only (`RESTORE`).

**Inputs.** `{ opportunityId }`.

**Success output.** Updated `OpportunityDetailDTO` with `isArchived: false`. Writes one `RESTORED` entry with metadata `{}`.

**Failures.** `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `NOT_ARCHIVED`, `CONFLICT`, `INTERNAL`.

### `addComment`

**Purpose.** Add a comment to an opportunity.

**Who can call it.** ADMIN, REVIEWER, VIEWER (`ADD_COMMENT`). Commenting is allowed on archived opportunities.

**Inputs.** `{ opportunityId, content }`. The author is the session user.

**Success output.** The new `CommentDTO`: `{ id, content, createdAt, author: { id, name } }`. Writes one `COMMENT_ADDED` entry with metadata `{ commentId }`, using the comment's `createdAt`.

**Failures.** `UNAUTHENTICATED`, `FORBIDDEN` (not reachable with the current matrix), `VALIDATION`, `NOT_FOUND`, `INTERNAL`. If the log entry cannot be written, the comment is not saved.
