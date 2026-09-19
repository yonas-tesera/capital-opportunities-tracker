import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as comments from "@/actions/comments";
import * as dashboard from "@/actions/dashboard";
import * as opportunities from "@/actions/opportunities";
import * as mutations from "@/actions/opportunity-mutations";
import * as reviewers from "@/actions/reviewers";
import { isError, type ActionResult } from "@/domain/result";
import { db, resetDatabase, signInAs } from "../../../test/helpers";

type Action = (input?: unknown) => Promise<ActionResult<unknown>>;

// Importing whole modules means a newly added action is covered automatically.
const actions: Array<[string, Action]> = Object.entries({
  ...comments,
  ...dashboard,
  ...opportunities,
  ...mutations,
  ...reviewers,
});

beforeEach(async () => {
  await resetDatabase();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterAll(() => db.$disconnect());

describe("every Server Action checks the session first", () => {
  it("covers all eleven actions", () => {
    expect(actions.map(([name]) => name).sort()).toEqual(
      [
        "addComment",
        "archiveOpportunity",
        "assignReviewer",
        "changeStage",
        "createOpportunity",
        "getDashboardStats",
        "getOpportunity",
        "listOpportunities",
        "listReviewers",
        "restoreOpportunity",
        "updateOpportunity",
      ].sort(),
    );
  });

  it.each(actions)("%s returns UNAUTHENTICATED when signed out, even with invalid input", async (_name, action) => {
    signInAs(null);
    expect(isError(await action({}), "UNAUTHENTICATED")).toBe(true);
    expect(isError(await action(undefined), "UNAUTHENTICATED")).toBe(true);
  });

  it.each(actions)("%s returns UNAUTHENTICATED for a session whose user was deleted", async (_name, action) => {
    signInAs({ id: "deleted-user" });
    expect(isError(await action({}), "UNAUTHENTICATED")).toBe(true);
  });
});
