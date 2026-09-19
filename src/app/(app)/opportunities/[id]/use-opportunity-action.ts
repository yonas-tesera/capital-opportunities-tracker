"use client";

import type { ActionResult } from "@/domain/result";
import { isOpportunitiesKey, keys } from "@/lib/fetchers";
import { useAction, type UseAction } from "@/lib/use-action";

/** A mutation on one opportunity: on success refreshes its detail, every list page and the dashboard. */
export function useOpportunityAction<T>(
  id: string,
  action: (input: unknown) => Promise<ActionResult<T>>,
  onSuccess?: () => void,
): UseAction<[unknown], T> {
  return useAction(action, {
    revalidate: () => [keys.opportunity(id), isOpportunitiesKey, keys.dashboard()],
    onSuccess,
  });
}
