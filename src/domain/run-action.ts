import { ZodError } from "zod";
import { ERRORS, fail, type ActionResult } from "./result";

/** Thrown inside an action body to abort with a specific, user-facing failure message. */
export class ActionFailure extends Error {}

export function formatZodError(error: ZodError): string {
  const details = error.issues.map((issue) => {
    const field = issue.path.join(".");
    return field ? `${field}: ${issue.message}` : issue.message;
  });
  return `${ERRORS.VALIDATION} ${details.join(" ")}`;
}

/**
 * Wraps a Server Action body: validation errors become a descriptive failure,
 * anything unexpected is logged on the server and returned as a generic message.
 */
export async function runAction<T>(body: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await body();
  } catch (error) {
    if (error instanceof ActionFailure) return fail(error.message);
    if (error instanceof ZodError) return fail(formatZodError(error));
    console.error("Unhandled server action error:", error);
    return fail(ERRORS.INTERNAL);
  }
}
