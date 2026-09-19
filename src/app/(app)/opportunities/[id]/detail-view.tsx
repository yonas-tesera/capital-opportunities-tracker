"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import useSWR from "swr";
import type { OpportunityDetailDTO } from "@/domain/dto";
import type { Role } from "@/domain/enums";
import { isError } from "@/domain/result";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StageBadge } from "@/components/ui/stage-badge";
import { fetchOpportunity, keys } from "@/lib/fetchers";
import { formatDate, formatDateTime, formatFullDateTime } from "@/lib/format";
import { ActionsPanel } from "./actions-panel";
import { ActivityTimeline } from "./activity-timeline";
import { CommentForm } from "./comment-form";

interface OpportunityDetailViewProps {
  id: string;
  role: Role;
  initial?: OpportunityDetailDTO;
}

export function OpportunityDetailView({ id, role, initial }: OpportunityDetailViewProps) {
  const { data, error, isValidating, mutate } = useSWR<OpportunityDetailDTO, Error>(
    keys.opportunity(id),
    () => fetchOpportunity(id),
    { fallbackData: initial },
  );

  if (error && !data) {
    if (isError({ success: false, error: error.message }, "NOT_FOUND")) notFound();
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorState message={error.message} onRetry={() => void mutate()} retrying={isValidating} />
      </div>
    );
  }
  if (!data) return <DetailSkeleton />;

  return (
    <div className="space-y-6">
      <BackLink />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="min-w-0 break-words text-2xl font-semibold text-slate-900">{data.companyName}</h1>
        <StageBadge stage={data.stage} />
      </header>

      {data.isArchived && (
        <div role="note" className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-900">
          <p className="font-semibold">This opportunity is archived and read-only.</p>
          <p className="mt-1">
            Its details, reviewer and stage cannot be changed until it is restored. Comments can still be added.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section aria-labelledby="details-heading" className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
            <h2 id="details-heading" className="text-lg font-semibold text-slate-900">
              Details
            </h2>
            <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label="Requested amount">
                <CurrencyAmount amount={data.requestedAmount} currency={data.currency} className="text-base font-semibold" />
                <span className="ml-1 text-slate-600">({data.currency})</span>
              </Field>
              <Field label="Stage">
                <StageBadge stage={data.stage} />
              </Field>
              <Field label="Submission date">{formatDate(data.submissionDate)}</Field>
              <Field label="Status">{data.isArchived ? "Archived" : "Active"}</Field>
              <Field label="Assigned reviewer">
                {data.assignedReviewer ? data.assignedReviewer.name : <span className="text-slate-600">Unassigned</span>}
              </Field>
              <Field label="Created by">{data.createdBy.name}</Field>
              <Field label="Created">
                <time dateTime={data.createdAt} title={formatFullDateTime(data.createdAt)}>
                  {formatDateTime(data.createdAt)}
                </time>
              </Field>
              <Field label="Last updated">
                <time dateTime={data.updatedAt} title={formatFullDateTime(data.updatedAt)}>
                  {formatDateTime(data.updatedAt)}
                </time>
              </Field>
              <Field label="Description" wide>
                {data.description ? (
                  <p className="whitespace-pre-wrap break-words">{data.description}</p>
                ) : (
                  <span className="text-slate-600">No description.</span>
                )}
              </Field>
            </dl>
          </section>

          <ActionsPanel opportunity={data} role={role} />
          <CommentForm opportunityId={data.id} />
        </div>

        <ActivityTimeline opportunity={data} />
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/opportunities" className="inline-block rounded text-sm font-medium text-indigo-800 hover:underline">
      ← All opportunities
    </Link>
  );
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-xs font-medium uppercase text-slate-600">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading opportunity…</span>
      <Skeleton className="h-8 w-2/3" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
