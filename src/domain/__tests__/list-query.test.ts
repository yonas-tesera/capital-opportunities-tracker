import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, parseListOpportunitiesQuery } from "../schemas";

const DEFAULTS = {
  search: undefined,
  stage: undefined,
  archived: false,
  sortBy: "submissionDate",
  sortDir: "desc",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

describe("parseListOpportunitiesQuery", () => {
  it("returns defaults for empty params", () => {
    expect(parseListOpportunitiesQuery(new URLSearchParams())).toEqual(DEFAULTS);
    expect(parseListOpportunitiesQuery({})).toEqual(DEFAULTS);
  });

  it("parses valid URL params", () => {
    const params = new URLSearchParams(
      "search=%20atlas%20&stage=APPROVED&archived=true&sortBy=requestedAmount&sortDir=asc&page=3&pageSize=25",
    );
    expect(parseListOpportunitiesQuery(params)).toEqual({
      search: "atlas",
      stage: "APPROVED",
      archived: true,
      sortBy: "requestedAmount",
      sortDir: "asc",
      page: 3,
      pageSize: 25,
    });
  });

  it("falls back to defaults for invalid values", () => {
    const params = new URLSearchParams(
      "stage=NOPE&archived=maybe&sortBy=companyName&sortDir=up&page=abc&pageSize=9999",
    );
    expect(parseListOpportunitiesQuery(params)).toEqual(DEFAULTS);
  });

  it.each(["0", "-2", "1.5", "", "99999999"])("rejects page=%s", (page) => {
    expect(parseListOpportunitiesQuery({ page }).page).toBe(1);
  });

  it("bounds pageSize", () => {
    expect(parseListOpportunitiesQuery({ pageSize: "0" }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(parseListOpportunitiesQuery({ pageSize: String(MAX_PAGE_SIZE) }).pageSize).toBe(MAX_PAGE_SIZE);
    expect(parseListOpportunitiesQuery({ pageSize: String(MAX_PAGE_SIZE + 1) }).pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("treats blank or oversized search as absent", () => {
    expect(parseListOpportunitiesQuery({ search: "   " }).search).toBeUndefined();
    expect(parseListOpportunitiesQuery({ search: "x".repeat(101) }).search).toBeUndefined();
  });

  it("uses the first value of repeated params", () => {
    expect(parseListOpportunitiesQuery({ stage: ["DRAFT", "APPROVED"] }).stage).toBe("DRAFT");
    expect(parseListOpportunitiesQuery(new URLSearchParams("stage=DRAFT&stage=APPROVED")).stage).toBe("DRAFT");
  });
});
