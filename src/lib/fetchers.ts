import { getDashboardStats } from "@/actions/dashboard";
import { getOpportunity, listOpportunities } from "@/actions/opportunities";
import { listReviewers } from "@/actions/reviewers";
import type { ListOpportunitiesQuery } from "@/domain/schemas";
import { ERRORS, type ActionResult } from "@/domain/result";

// SWR fetchers: unwrap the ActionResult and throw on failure so SWR's `error` state is populated.
// The Error message is the action's error string; compare it with `isError`-style prefixes.
async function unwrap<T>(pending: Promise<ActionResult<T>>): Promise<T> {
  const result = await pending;
  if (!result.success || result.data === undefined) throw new Error(result.error ?? ERRORS.INTERNAL);
  return result.data;
}

export const fetchDashboard = () => unwrap(getDashboardStats());
export const fetchOpportunities = (query: ListOpportunitiesQuery) => unwrap(listOpportunities(query));
export const fetchOpportunity = (id: string) => unwrap(getOpportunity(id));
export const fetchReviewers = () => unwrap(listReviewers());

// Stable SWR keys. Mutations revalidate with `isOpportunitiesKey` (every list page/filter)
// and `keys.opportunity(id)` / `keys.dashboard()` (exact entries).
export const keys = {
  dashboard: () => ["dashboard"] as const,
  opportunities: (query: ListOpportunitiesQuery) => ["opportunities", query] as const,
  opportunity: (id: string) => ["opportunity", id] as const,
  reviewers: () => ["reviewers"] as const,
};

export function isOpportunitiesKey(key: unknown): boolean {
  return Array.isArray(key) && key[0] === "opportunities";
}
