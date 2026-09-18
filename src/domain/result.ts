export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Stable messages the UI can recognise. Parametrised errors (validation, transition)
// start with their constant, so use `isError` rather than strict equality for those.
export const ERRORS = {
  UNAUTHENTICATED: "You must be signed in to perform this action.",
  FORBIDDEN: "You do not have permission to perform this action.",
  NOT_FOUND: "Opportunity not found.",
  ARCHIVED: "Archived opportunities are read-only. Restore the opportunity first.",
  VALIDATION: "Validation failed.",
  INVALID_TRANSITION: "Invalid stage transition.",
  INTERNAL: "Something went wrong. Please try again.",
} as const;

export type ErrorKind = keyof typeof ERRORS;

export function ok(): ActionResult<void>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { success: true, data };
}

export function fail(message: string): ActionResult<never> {
  return { success: false, error: message };
}

export function isError(result: ActionResult<unknown>, kind: ErrorKind): boolean {
  return !result.success && (result.error?.startsWith(ERRORS[kind]) ?? false);
}
