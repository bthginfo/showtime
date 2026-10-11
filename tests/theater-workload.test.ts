import { describe, it, expect } from "vitest";
import { plannedPersonHours } from "@/shared/planned-person-hours";
import type { DomainRecord } from "@/shared/contracts";
const event = (category: string, start: string, end: string, extra = {}) =>
  ({
    id: category,
    kind: "events",
    organizationId: "qa",
    departmentId: "qa",
    createdBy: "qa",
    version: 1,
    createdAt: start,
    updatedAt: start,
    data: { category, start, end, participantIds: ["qa"], ...extra },
  }) satisfies DomainRecord;
describe("planned person hours", () => {
  it("counts overlapping service and rehearsal once, omits absence and hints", () => {
    const rows = [
      event("service", "2026-11-02T08:00Z", "2026-11-02T16:00Z"),
      event("rehearsal", "2026-11-02T10:00Z", "2026-11-02T12:00Z"),
      event("vacation", "2026-11-02T00:00Z", "2026-11-03T00:00Z"),
      event("half-day-off", "2026-11-02T00:00Z", "2026-11-03T00:00Z"),
    ];
    expect(
      plannedPersonHours(
        rows,
        new Date("2026-11-02T00:00Z"),
        new Date("2026-11-03T00:00Z"),
        "Europe/Berlin",
      ).get("qa"),
    ).toBe(8);
  });
  it("clips the requested period and deducts recorded pauses proportionally", () => {
    expect(
      plannedPersonHours(
        [event("rehearsal", "2026-11-02T08:00Z", "2026-11-02T16:00Z", { pauseMinutes: 60 })],
        new Date("2026-11-02T12:00Z"),
        new Date("2026-11-02T16:00Z"),
        "Europe/Berlin",
      ).get("qa"),
    ).toBe(3.5);
  });
});
