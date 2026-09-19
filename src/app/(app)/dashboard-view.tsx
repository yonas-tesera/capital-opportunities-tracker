"use client";

import Link from "next/link";
import useSWR from "swr";
import type { DashboardStatsDTO } from "@/domain/dto";
import { CURRENCIES, STAGES } from "@/domain/enums";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { LineChart } from "@/components/ui/line-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { STAGE_LABELS, StageBadge } from "@/components/ui/stage-badge";
import { fetchDashboard, keys } from "@/lib/fetchers";
import { formatDate } from "@/lib/format";

export function DashboardView() {
  const { data, error, isValidating, mutate } = useSWR<DashboardStatsDTO, Error>(keys.dashboard(), fetchDashboard);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Overview of active capital opportunities.</p>
      </div>
      {error && !data ? (
        <ErrorState message={error.message} onRetry={() => void mutate()} retrying={isValidating} />
      ) : !data ? (
        <DashboardSkeleton />
      ) : data.totalActive === 0 && data.totalArchived === 0 ? (
        <EmptyState
          title="No opportunities yet"
          description="Once opportunities are created, their stages, amounts and reviewer workload will appear here."
        />
      ) : (
        <DashboardContent stats={data} />
      )}
    </div>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-4 ${className}`}>
      <h2 className="text-sm font-medium text-slate-600">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function DashboardContent({ stats }: { stats: DashboardStatsDTO }) {
  const maxWorkload = Math.max(1, ...stats.reviewerWorkload.map((w) => w.openCount));

  return (
    <>
      <section aria-labelledby="stage-heading" className="space-y-3">
        <h2 id="stage-heading" className="text-lg font-semibold text-slate-900">
          Opportunities
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Card title="Total active" className="col-span-2 lg:col-span-1">
            <p className="text-3xl font-semibold tabular-nums text-slate-900">{stats.totalActive}</p>
            <p className="mt-1 text-xs text-slate-600">{stats.totalArchived} archived</p>
          </Card>
          {STAGES.map((stage) => (
            <Card key={stage} title="Stage">
              <StageBadge stage={stage} />
              <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{stats.byStage[stage]}</p>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="amount-heading" className="space-y-3">
        <h2 id="amount-heading" className="text-lg font-semibold text-slate-900">
          Total requested amount
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CURRENCIES.map((currency) => (
            <Card key={currency} title={currency}>
              <CurrencyAmount
                amount={stats.requestedAmountByCurrency[currency]}
                currency={currency}
                className="text-2xl font-semibold text-slate-900"
              />
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="trend-heading" className="space-y-3">
        <h2 id="trend-heading" className="text-lg font-semibold text-slate-900">
          Opportunities by stage
        </h2>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <LineChart
            description="Number of active opportunities in each stage"
            color="#6366f1"
            points={STAGES.map((stage, i) => ({ label: `${i + 1} (${STAGE_LABELS[stage]})`, value: stats.byStage[stage] }))}
          />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <section aria-labelledby="recent-heading" className="space-y-3 lg:col-span-2">
          <h2 id="recent-heading" className="text-lg font-semibold text-slate-900">
            Most recently submitted
          </h2>
          {stats.recent.length === 0 ? (
            <EmptyState title="No active opportunities" description="Restore or create an opportunity to see it here." />
          ) : (
            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
              {stats.recent.map((opportunity) => (
                <li key={opportunity.id}>
                  <Link
                    href={`/opportunities/${opportunity.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">{opportunity.companyName}</span>
                      <span className="block text-xs text-slate-600">Submitted {formatDate(opportunity.submissionDate)}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <CurrencyAmount
                        amount={opportunity.requestedAmount}
                        currency={opportunity.currency}
                        className="text-sm text-slate-900"
                      />
                      <StageBadge stage={opportunity.stage} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="workload-heading" className="space-y-3">
          <h2 id="workload-heading" className="text-lg font-semibold text-slate-900">
            Reviewer workload
          </h2>
          {stats.reviewerWorkload.length === 0 ? (
            <EmptyState title="No reviewers" description="Users with the reviewer role will appear here." />
          ) : (
            <ul className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
              {stats.reviewerWorkload.map(({ reviewer, openCount }) => (
                <li key={reviewer.id}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium text-slate-900">{reviewer.name}</span>
                    <span className="tabular-nums text-slate-700">
                      {openCount} active
                    </span>
                  </div>
                  <div aria-hidden="true" className="mt-1 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${(openCount / maxWorkload) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-8">
      <span className="sr-only">Loading dashboard…</span>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className={`h-24 ${i === 0 ? "col-span-2 lg:col-span-1" : ""}`} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-64" />
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}
