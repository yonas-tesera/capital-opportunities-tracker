"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import useSWR from "swr";
import type { OpportunitySummaryDTO, PaginatedResult } from "@/domain/dto";
import { STAGES } from "@/domain/enums";
import {
  listQueryToSearchParams,
  parseListOpportunitiesQuery,
  type ListOpportunitiesQuery,
} from "@/domain/schemas";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingButton } from "@/components/ui/loading-button";
import { Skeleton } from "@/components/ui/skeleton";
import { STAGE_LABELS, StageBadge } from "@/components/ui/stage-badge";
import { fetchOpportunities, keys } from "@/lib/fetchers";
import { formatDate } from "@/lib/format";
import { CreateOpportunityDialog } from "./create-opportunity-dialog";

const SEARCH_DEBOUNCE_MS = 300;

const controlClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

export function OpportunitiesView({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The URL is the single source of truth: the query is always re-derived from it.
  const query = useMemo(
    () => parseListOpportunitiesQuery(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const { data, error, isValidating, mutate } = useSWR<PaginatedResult<OpportunitySummaryDTO>, Error>(
    keys.opportunities(query),
    () => fetchOpportunities(query),
    { keepPreviousData: true },
  );

  // Controls reflect a change immediately while the navigation is in flight, then settle on the URL's value.
  const [, startTransition] = useTransition();
  const [shownQuery, setShownQuery] = useOptimistic(query);

  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const navigate = useCallback(
    (patch: Partial<ListOpportunitiesQuery>, mode: "push" | "replace" = "push", alsoUpdate?: () => void) => {
      // Built from the live URL, not the render's `query`, so a delayed (debounced) call never overwrites newer changes.
      const current = parseListOpportunitiesQuery(new URLSearchParams(window.location.search));
      // Any change resets to page 1 unless the patch sets a page explicitly.
      const next = { ...current, page: 1, ...patch };
      const queryString = listQueryToSearchParams(next).toString();
      startTransition(() => {
        setShownQuery(next);
        alsoUpdate?.();
        router[mode](queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
      });
    },
    [pathname, router, setShownQuery],
  );

  // The search box is local state so typing is instant. `committedSearch` is the value this box last
  // pushed to the URL; a URL search that differs from it came from elsewhere (back/forward, clear
  // filters) and replaces the text.
  const [searchText, setSearchText] = useState(query.search ?? "");
  const [committedSearch, setCommittedSearch] = useState(query.search ?? "");
  if ((shownQuery.search ?? "") !== committedSearch) {
    setCommittedSearch(shownQuery.search ?? "");
    setSearchText(shownQuery.search ?? "");
  }

  // Input -> URL, debounced. Replaces the history entry so typing does not flood back/forward.
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchText.trim();
      if (trimmed !== committedSearch) {
        navigate({ search: trimmed || undefined }, "replace", () => setCommittedSearch(trimmed));
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText, committedSearch, navigate]);

  // The server clamps a page past the end; reflect the page actually served in the URL.
  useEffect(() => {
    if (data && !isValidating && data.page !== query.page) navigate({ page: data.page }, "replace");
  }, [data, isValidating, query.page, navigate]);

  const filtersActive = Boolean(query.search || query.stage || query.archived);
  const clearFilters = () => navigate({ search: undefined, stage: undefined, archived: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Opportunities</h1>
          <p className="mt-1 text-sm text-slate-600">Search, filter and sort every capital opportunity.</p>
        </div>
        {canCreate && (
          <LoadingButton onClick={() => setCreating(true)}>New opportunity</LoadingButton>
        )}
      </div>

      <p role="status" className="min-h-5 text-sm font-medium text-emerald-800">
        {notice}
      </p>

      <search aria-label="Filter opportunities" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-2">
          <label htmlFor="search" className="mb-1 block text-sm font-medium text-slate-900">
            Search company
          </label>
          <input
            id="search"
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Company name"
            maxLength={100}
            className={controlClass}
          />
        </div>
        <div>
          <label htmlFor="stage" className="mb-1 block text-sm font-medium text-slate-900">
            Stage
          </label>
          <select
            id="stage"
            value={shownQuery.stage ?? ""}
            onChange={(event) => {
              const stage = STAGES.find((s) => s === event.target.value);
              navigate({ stage });
            }}
            className={controlClass}
          >
            <option value="">All stages</option>
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_LABELS[stage]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sortBy" className="mb-1 block text-sm font-medium text-slate-900">
            Sort by
          </label>
          <select
            id="sortBy"
            value={shownQuery.sortBy}
            onChange={(event) =>
              navigate({ sortBy: event.target.value === "requestedAmount" ? "requestedAmount" : "submissionDate" })
            }
            className={controlClass}
          >
            <option value="submissionDate">Submission date</option>
            <option value="requestedAmount">Requested amount</option>
          </select>
        </div>
        <div>
          <label htmlFor="sortDir" className="mb-1 block text-sm font-medium text-slate-900">
            Direction
          </label>
          <select
            id="sortDir"
            value={shownQuery.sortDir}
            onChange={(event) => navigate({ sortDir: event.target.value === "asc" ? "asc" : "desc" })}
            className={controlClass}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:col-span-2 lg:col-span-5">
          <label className="inline-flex items-center gap-2 text-sm text-slate-900">
            <input
              type="checkbox"
              checked={shownQuery.archived}
              onChange={(event) => navigate({ archived: event.target.checked })}
              className="size-4"
            />
            Show archived only
          </label>
          {filtersActive && (
            <LoadingButton variant="secondary" className="py-1" onClick={clearFilters}>
              Clear filters
            </LoadingButton>
          )}
        </div>
      </search>

      {error && !data ? (
        <ErrorState message={error.message} onRetry={() => void mutate()} retrying={isValidating} />
      ) : !data ? (
        <ListSkeleton />
      ) : data.items.length === 0 ? (
        filtersActive ? (
          <EmptyState title="No opportunities match your filters" description="Try a different search or stage, or clear the filters.">
            <LoadingButton variant="secondary" onClick={clearFilters}>
              Clear filters
            </LoadingButton>
          </EmptyState>
        ) : (
          <EmptyState title="No opportunities yet" description="Opportunities will appear here once they are created." />
        )
      ) : (
        <div aria-busy={isValidating} className={isValidating ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <OpportunityTable items={data.items} />
          <OpportunityCards items={data.items} />
          <Pagination data={data} busy={isValidating} onPage={(page) => navigate({ page })} />
        </div>
      )}

      {canCreate && (
        <CreateOpportunityDialog
          open={creating}
          onClose={() => setCreating(false)}
          onCreated={(name) => setNotice(`Created “${name}” as a draft.`)}
        />
      )}
    </div>
  );
}

function ReviewerName({ reviewer }: { reviewer: OpportunitySummaryDTO["assignedReviewer"] }) {
  return reviewer ? <>{reviewer.name}</> : <span className="text-slate-600">Unassigned</span>;
}

function ArchivedIndicator({ archived }: { archived: boolean }) {
  return archived ? (
    <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-white">Archived</span>
  ) : (
    <span className="text-slate-600">Active</span>
  );
}

function OpportunityTable({ items }: { items: OpportunitySummaryDTO[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Capital opportunities</caption>
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Company</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
            <th scope="col" className="px-4 py-3 font-medium">Stage</th>
            <th scope="col" className="px-4 py-3 font-medium">Submitted</th>
            <th scope="col" className="px-4 py-3 font-medium">Reviewer</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((item) => (
            <tr key={item.id} className="relative hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">
                <Link href={`/opportunities/${item.id}`} className="after:absolute after:inset-0 after:content-['']">
                  {item.companyName}
                </Link>
              </td>
              <td className="px-4 py-3 text-right">
                <CurrencyAmount amount={item.requestedAmount} currency={item.currency} />
              </td>
              <td className="px-4 py-3">
                <StageBadge stage={item.stage} />
              </td>
              <td className="px-4 py-3 text-slate-700">{formatDate(item.submissionDate)}</td>
              <td className="px-4 py-3 text-slate-900">
                <ReviewerName reviewer={item.assignedReviewer} />
              </td>
              <td className="px-4 py-3">
                <ArchivedIndicator archived={item.isArchived} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpportunityCards({ items }: { items: OpportunitySummaryDTO[] }) {
  return (
    <ul className="space-y-3 md:hidden">
      {items.map((item) => (
        <li key={item.id} className="relative rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50">
          <div className="flex items-start justify-between gap-3">
            <Link href={`/opportunities/${item.id}`} className="font-medium text-slate-900 after:absolute after:inset-0 after:content-['']">
              {item.companyName}
            </Link>
            <StageBadge stage={item.stage} />
          </div>
          <CurrencyAmount amount={item.requestedAmount} currency={item.currency} className="mt-1 block text-lg font-semibold text-slate-900" />
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
            <dt>Submitted</dt>
            <dd className="text-slate-900">{formatDate(item.submissionDate)}</dd>
            <dt>Reviewer</dt>
            <dd className="text-slate-900">
              <ReviewerName reviewer={item.assignedReviewer} />
            </dd>
            <dt>Status</dt>
            <dd>
              <ArchivedIndicator archived={item.isArchived} />
            </dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function Pagination({ data, busy, onPage }: { data: PaginatedResult<OpportunitySummaryDTO>; busy: boolean; onPage: (page: number) => void }) {
  const first = (data.page - 1) * data.pageSize + 1;
  const last = first + data.items.length - 1;

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p aria-live="polite" className="text-sm text-slate-700">
        Showing {first}–{last} of {data.total} · Page {data.page} of {data.totalPages}
      </p>
      <div className="flex gap-2">
        <LoadingButton variant="secondary" disabled={busy || data.page <= 1} onClick={() => onPage(data.page - 1)}>
          Previous
        </LoadingButton>
        <LoadingButton variant="secondary" disabled={busy || data.page >= data.totalPages} onClick={() => onPage(data.page + 1)}>
          Next
        </LoadingButton>
      </div>
    </nav>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-2">
      <span className="sr-only">Loading opportunities…</span>
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-14" />
      ))}
    </div>
  );
}
