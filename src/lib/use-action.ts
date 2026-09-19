"use client";

import { useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { ERRORS, type ActionResult } from "@/domain/result";

/** An exact SWR key, or a matcher (e.g. `isOpportunitiesKey`) that revalidates every key it accepts. */
export type RevalidateTarget = readonly unknown[] | ((key: unknown) => boolean);

interface UseActionOptions<T> {
  /** Keys to revalidate after a successful call. */
  revalidate?: (data: T | undefined) => readonly RevalidateTarget[];
  onSuccess?: (data: T | undefined) => void;
}

export interface UseAction<Args extends unknown[], T> {
  run: (...args: Args) => Promise<ActionResult<T>>;
  /** True while a call is in flight: use it to disable the trigger. */
  pending: boolean;
  /** Error string of the last failed call, cleared when the next call starts. */
  error: string | null;
  clearError: () => void;
}

const DUPLICATE = "Please wait for the current request to finish.";

/**
 * Wraps a Server Action for a UI trigger. Overlapping calls are ignored, the
 * ActionResult error is surfaced as a string, and SWR keys are revalidated on success.
 */
export function useAction<Args extends unknown[], T>(
  action: (...args: Args) => Promise<ActionResult<T>>,
  options: UseActionOptions<T> = {},
): UseAction<Args, T> {
  const { mutate } = useSWRConfig();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(...args: Args): Promise<ActionResult<T>> {
    if (inFlight.current) return { success: false, error: DUPLICATE };
    inFlight.current = true;
    setPending(true);
    setError(null);

    try {
      const result = await action(...args);
      if (!result.success) {
        setError(result.error ?? ERRORS.INTERNAL);
        return result;
      }
      const targets = options.revalidate?.(result.data) ?? [];
      await Promise.all(targets.map((target) => (typeof target === "function" ? mutate(target) : mutate(target))));
      options.onSuccess?.(result.data);
      return result;
    } catch {
      // The request itself failed (network, server crash), so there is no ActionResult.
      setError(ERRORS.INTERNAL);
      return { success: false, error: ERRORS.INTERNAL };
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return { run, pending, error, clearError: () => setError(null) };
}
