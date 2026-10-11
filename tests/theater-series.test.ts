import { describe, it, expect } from "vitest";
import { shiftedSeriesDates } from "@/shared/theater-time";
import { occurrences } from "@/modules/calendar/occurrences";
import { splitAcrossDays } from "@/modules/time-tracking/rules";
import type { DomainRecord } from "@/shared/contracts";
import { localDate, weekStart, dateLabel, instantDate } from "@/shared/client-api";
describe("tenant calendar series and local day allocation", () => {
  it("moves series end and exceptions by local calendar days across DST", () => {
    expect(
      shiftedSeriesDates(
        {
          recurrence: "weekly",
          start: "2026-03-22T09:00:00Z",
          until: "2026-04-05",
          exceptions: ["2026-03-29"],
        },
        "2026-03-29T08:00:00Z",
        "Europe/Berlin",
      ),
    ).toEqual({ until: "2026-04-12", exceptions: ["2026-04-05"] });
  });
  it("does not alter one-off event metadata", () => {
    expect(
      shiftedSeriesDates({ recurrence: "none" }, "2026-03-29T08:00Z", "Europe/Berlin"),
    ).toEqual({});
  });
  it("keeps recurring wall times and skipped days in a different theater zone", () => {
    const event = {
      id: "qa",
      kind: "events",
      organizationId: "qa",
      departmentId: "qa",
      createdBy: "qa",
      version: 1,
      createdAt: "2026-03-01T00:00:00Z",
      updatedAt: "2026-03-01T00:00:00Z",
      data: {
        start: "2026-03-01T15:00:00Z",
        end: "2026-03-01T16:00:00Z",
        recurrence: "weekly",
        until: "2026-03-22",
        exceptions: ["2026-03-15"],
        theaterTimezone: "America/New_York",
      },
    } satisfies DomainRecord;
    const rows = occurrences(event, new Date("2026-03-01T00:00Z"), new Date("2026-03-23T00:00Z"));
    expect(rows.map((row) => row.start.toISOString())).toEqual([
      "2026-03-01T15:00:00.000Z",
      "2026-03-08T14:00:00.000Z",
      "2026-03-22T14:00:00.000Z",
    ]);
  });
  it("allocates midnight crossings in the configured theater zone", () => {
    expect(
      splitAcrossDays("2026-11-03T03:00:00Z", "2026-11-03T06:00:00Z", 0, "America/New_York"),
    ).toEqual([
      { date: "2026-11-02", seconds: 7200 },
      { date: "2026-11-03", seconds: 3600 },
    ]);
  });
  it("uses the theater day and ISO week before midnight in a western timezone", () => {
    const instant = new Date("2026-11-02T03:30Z");
    expect(localDate(instant, "America/New_York")).toBe("2026-11-01");
    expect(weekStart(instant, "America/New_York")).toBe("2026-10-26");
    expect(instantDate("2026-11-01T22:30", "America/New_York").toISOString()).toBe(
      "2026-11-02T03:30:00.000Z",
    );
    expect(dateLabel("2026-11-02T03:30Z", true, "America/New_York")).toContain("22:30");
  });
});
