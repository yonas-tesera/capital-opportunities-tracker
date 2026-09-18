import { describe, expect, it } from "vitest";
import { STAGES, type Stage } from "../enums";
import { isError } from "../result";
import { assertTransition, canTransition, getAllowedTransitions } from "../state-machine";

const ALLOWED: ReadonlyArray<readonly [Stage, Stage]> = [
  ["DRAFT", "UNDER_REVIEW"],
  ["UNDER_REVIEW", "APPROVED"],
  ["UNDER_REVIEW", "REJECTED"],
];

const isAllowed = (from: Stage, to: Stage): boolean => ALLOWED.some(([f, t]) => f === from && t === to);

const pairs = STAGES.flatMap((from) => STAGES.map((to) => [from, to] as const));

describe("state machine", () => {
  it.each(pairs)("%s -> %s", (from, to) => {
    const expected = isAllowed(from, to);
    expect(canTransition(from, to)).toBe(expected);
    const result = assertTransition(from, to);
    expect(result.success).toBe(expected);
    if (!expected) expect(isError(result, "INVALID_TRANSITION")).toBe(true);
  });

  it("lists allowed next stages", () => {
    expect(getAllowedTransitions("DRAFT")).toEqual(["UNDER_REVIEW"]);
    expect(getAllowedTransitions("UNDER_REVIEW")).toEqual(["APPROVED", "REJECTED"]);
    expect(getAllowedTransitions("APPROVED")).toEqual([]);
    expect(getAllowedTransitions("REJECTED")).toEqual([]);
  });

  it("describes rejected transitions", () => {
    expect(assertTransition("APPROVED", "DRAFT").error).toContain(
      "Cannot move from APPROVED to DRAFT. Allowed next stages: none.",
    );
    expect(assertTransition("DRAFT", "APPROVED").error).toContain("Allowed next stages: UNDER_REVIEW.");
  });
});
