import { describe, expect, it } from "vitest";
import {
  continuousPlanningBlocks,
  planningDateWindow,
  workRuleViolation,
} from "@/shared/theater-planning";
const interval = (start: string, end: string) => ({ start: new Date(start), end: new Date(end) });
const hours = (start: number, end: number) =>
  interval(
    `2026-10-26T${String(start).padStart(2, "0")}:00:00Z`,
    `2026-10-26T${String(end).padStart(2, "0")}:00:00Z`,
  );
const rules = { confirmedByTheater: true, maxDutyHours: 8, minimumRestHours: 11 };

describe("theater-local availability", () => {
  it("blocks the local absence date shortly after midnight even on the previous UTC date", () => {
    expect(
      planningDateWindow(interval("2026-10-22T22:30:00Z", "2026-10-22T23:00:00Z"), "Europe/Berlin"),
    ).toEqual({ from: "2026-10-23", to: "2026-10-23" });
  });
  it("does not include tomorrow when the service ends exactly at local midnight", () => {
    expect(
      planningDateWindow(interval("2026-10-22T20:00:00Z", "2026-10-22T22:00:00Z"), "Europe/Berlin"),
    ).toEqual({ from: "2026-10-22", to: "2026-10-22" });
  });
  it("follows the configured theater timezone rather than the server timezone", () => {
    expect(
      planningDateWindow(
        interval("2026-10-23T01:00:00Z", "2026-10-23T02:00:00Z"),
        "America/New_York",
      ),
    ).toEqual({ from: "2026-10-22", to: "2026-10-22" });
  });
  it("covers local dates correctly through the autumn clock change", () => {
    expect(
      planningDateWindow(interval("2026-10-24T22:30:00Z", "2026-10-25T02:30:00Z"), "Europe/Berlin"),
    ).toEqual({ from: "2026-10-25", to: "2026-10-25" });
  });
});

describe("confirmed continuous duty rules", () => {
  it("rejects an eight-hour service appended to an existing eight-hour service", () => {
    expect(
      workRuleViolation(
        interval("2026-10-26T16:00:00Z", "2026-10-27T00:00:00Z"),
        [hours(8, 16)],
        rules,
      ),
    ).toBe("maximum-duty");
  });
  it("joins a chain of three fragments before checking the maximum", () => {
    expect(workRuleViolation(hours(14, 17), [hours(11, 14), hours(8, 11)], rules)).toBe(
      "maximum-duty",
    );
  });
  it("permits a continuous duty exactly at the configured maximum", () => {
    expect(workRuleViolation(hours(12, 16), [hours(8, 12)], rules)).toBeNull();
  });
  it("keeps the confirmation requirement", () => {
    expect(workRuleViolation(hours(8, 23), [], { ...rules, confirmedByTheater: false })).toBeNull();
  });
  it("rejects inadequate rest before the entire connected block", () => {
    const previous = interval("2026-10-25T17:00:00Z", "2026-10-25T22:00:00Z");
    expect(workRuleViolation(hours(12, 16), [hours(8, 12), previous], rules)).toBe("minimum-rest");
  });
  it("permits exactly the configured rest duration", () => {
    const previous = interval("2026-10-25T17:00:00Z", "2026-10-25T21:00:00Z");
    expect(workRuleViolation(hours(8, 16), [previous], rules)).toBeNull();
  });
  it("does not mutate the caller's dates or combine disjoint blocks", () => {
    const a = hours(8, 12),
      b = hours(12, 16),
      c = hours(18, 20);
    const result = continuousPlanningBlocks([c, b, a]);
    expect(result).toEqual([hours(8, 16), c]);
    expect(a).toEqual(hours(8, 12));
  });
});
