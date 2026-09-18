import type { Stage } from "./enums";
import { ERRORS, fail, ok, type ActionResult } from "./result";

export const ALLOWED_TRANSITIONS: Readonly<Record<Stage, readonly Stage[]>> = {
  DRAFT: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};

export function getAllowedTransitions(stage: Stage): readonly Stage[] {
  return ALLOWED_TRANSITIONS[stage];
}

export function canTransition(from: Stage, to: Stage): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: Stage, to: Stage): ActionResult<void> {
  if (canTransition(from, to)) return ok();
  const allowed = getAllowedTransitions(from);
  return fail(
    `${ERRORS.INVALID_TRANSITION} Cannot move from ${from} to ${to}. Allowed next stages: ${
      allowed.length > 0 ? allowed.join(", ") : "none"
    }.`,
  );
}
