import { describe, it, expect } from "vitest";
import { theaterInstant, theaterDateTime, limitedAvailabilityAllows } from "@/shared/theater-time";
import { workRuleProfilesInput } from "@/shared/work-rule-profiles";
import { workRuleViolation } from "@/shared/theater-planning";
const interval = (day: string, from = 8, to = 16) => ({
  start: new Date(day + "T" + String(from).padStart(2, "0") + ":00:00Z"),
  end: new Date(day + "T" + String(to).padStart(2, "0") + ":00:00Z"),
});
const rules = {
  maxDutyHours: 12,
  minimumRestHours: 0,
  minimumBreakMinutes: 0,
  breakAfterHours: 6,
  maxWeeklyHours: 16,
  maxConsecutiveDays: 3,
  confirmedByTheater: true,
  timezone: "Europe/Berlin",
};
describe("confirmed person-specific planning profiles", () => {
  it("converts theater wall time independent of browser zone and rejects nonexistent DST time", () => {
    expect(theaterInstant("2026-07-10T19:30", "Europe/Berlin")).toBe("2026-07-10T17:30:00.000Z");
    expect(theaterInstant("2026-03-29T02:30", "Europe/Berlin")).toBeUndefined();
    expect(theaterDateTime("2026-10-25T01:30:00Z", "Europe/Berlin")).toBe("2026-10-25T02:30");
  });
  it("checks daily windows across midnight and preserves exclusive end", () => {
    const availability = {
      start: "2026-11-23",
      end: "2026-11-23",
      allowedFrom: "10:00",
      allowedTo: "14:00",
    };
    expect(
      limitedAvailabilityAllows(interval("2026-11-23", 9, 13), availability, "Europe/Berlin"),
    ).toBe(true);
    expect(
      limitedAvailabilityAllows(interval("2026-11-23", 8, 9), availability, "Europe/Berlin"),
    ).toBe(false);
    expect(
      limitedAvailabilityAllows(
        { start: new Date("2026-11-22T20:00Z"), end: new Date("2026-11-22T23:00Z") },
        availability,
        "Europe/Berlin",
      ),
    ).toBe(true);
  });
  it("rejects duplicate people assigned to more than one profile", () => {
    const p = { id: "a", name: "Gruppe", memberIds: ["person"], actorIds: [], rules };
    expect(workRuleProfilesInput.safeParse([p, { ...p, id: "b" }]).success).toBe(false);
  });
  it("checks calendar-week totals without mixing adjacent ISO weeks", () => {
    expect(
      workRuleViolation(
        interval("2026-11-25"),
        [interval("2026-11-23"), interval("2026-11-24")],
        rules,
      ),
    ).toBe("maximum-week");
    expect(
      workRuleViolation(interval("2026-11-23"), [interval("2026-11-22")], {
        ...rules,
        maxWeeklyHours: 8,
      }),
    ).toBeNull();
  });
  it("checks consecutive local workdays and leaves unconfirmed rules inactive", () => {
    const prior = ["2026-11-23", "2026-11-24", "2026-11-25"].map((d) => interval(d));
    expect(
      workRuleViolation(interval("2026-11-26"), prior, { ...rules, maxWeeklyHours: 100 }),
    ).toBe("consecutive-days");
    expect(
      workRuleViolation(interval("2026-11-26"), prior, { ...rules, confirmedByTheater: false }),
    ).toBeNull();
  });
});
