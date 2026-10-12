import { describe, expect, it } from "vitest";
import type { DomainRecord } from "@/shared/contracts";
import type { WorkingTimeSettings } from "@/shared/working-time";
import { calculateAttendanceBalance, balanceMonthRange } from "@/modules/time-tracking/balance";
import { startOfLocalDay } from "@/modules/time-tracking/rules";
import { shiftDate } from "@/shared/client-api";

const H = 3600;
const settings: WorkingTimeSettings = {
  version: 1,
  openingBalanceSeconds: 2 * H,
  schedules: [
    { effectiveFrom: "2026-10-05", weeklyMinutes: 15 * 60, workingDays: [1, 2, 3, 4, 5, 6] },
  ],
};
const record = (
  id: string,
  kind: DomainRecord["kind"],
  data: Record<string, unknown>,
): DomainRecord => ({
  id,
  kind,
  organizationId: "fictional",
  departmentId: "mask",
  createdBy: "mara",
  createdAt: "2026-10-05T08:00:00Z",
  updatedAt: "2026-10-05T08:00:00Z",
  version: 1,
  data: { userId: "mara", ...data },
});
const attendance = (date: string, hours: number) =>
  record("attendance-" + date, "attendance", { date, durationSeconds: hours * H });
const absence = (id: string, date: string, category: string, extra = {}, zone = "Europe/Berlin") =>
  record(id, "events", {
    start: startOfLocalDay(date, zone).toISOString(),
    end: startOfLocalDay(shiftDate(date, 1), zone).toISOString(),
    allDay: true,
    participantIds: ["mara"],
    category,
    ...extra,
  });
const calculate = (input: Partial<Parameters<typeof calculateAttendanceBalance>[0]> = {}) =>
  calculateAttendanceBalance({
    userId: "mara",
    settings,
    attendance: [],
    from: "2026-10-05",
    to: "2026-10-11",
    includeOpeningBalance: false,
    now: new Date("2026-10-12T12:00:00+02:00"),
    ...input,
  });

describe("flexible weekly attendance account", () => {
  it.each([
    [15, 2.5],
    [10, -2.5],
  ])("implements the supplied %s attendance hours example", (present, expected) => {
    const result = calculate({
      attendance: [attendance("2026-10-08", present)],
      events: [absence("holiday", "2026-10-08", "holiday")],
    });
    expect(result).toMatchObject({
      attendanceSeconds: present * H,
      creditSeconds: 2.5 * H,
      targetSeconds: 15 * H,
      balanceSeconds: expected * H,
    });
  });
  it.each([
    [15, 9000],
    [20, 12000],
    [39, 23400],
  ])("credits %s weekly hours using the fixed divisor six", (weekly, credit) => {
    const profile = {
      ...settings,
      schedules: [{ ...settings.schedules[0], weeklyMinutes: weekly * 60 }],
    };
    expect(
      calculate({ settings: profile, events: [absence("paid", "2026-10-11", "vacation")] })
        .creditSeconds,
    ).toBe(credit);
  });
  it("allows all hours on Sunday without imposing stored legacy daily quotas", () => {
    const profile = { ...settings, schedules: [{ ...settings.schedules[0], workingDays: [1] }] };
    expect(
      calculate({ settings: profile, attendance: [attendance("2026-10-11", 15)] }).balanceSeconds,
    ).toBe(0);
  });
  it("recognizes all six paid categories and adds credits alongside attendance", () => {
    const keys = [
      "vacation",
      "holiday",
      "holiday-compensation",
      "sick",
      "sick-with-certificate",
      "sick-without-certificate",
    ];
    const events = keys.map((key, i) => absence(key, shiftDate("2026-10-05", i), key));
    expect(calculate({ events, attendance: [attendance("2026-10-05", 15)] })).toMatchObject({
      creditSeconds: 15 * H,
      balanceSeconds: 15 * H,
    });
  });
  it("counts different qualifying entries on one day only once", () => {
    expect(
      calculate({
        events: [absence("a", "2026-10-08", "vacation"), absence("b", "2026-10-08", "holiday")],
      }).creditSeconds,
    ).toBe(2.5 * H);
  });
  it("excludes unassigned hints, partial days, cancelled entries and unpaid categories", () => {
    const events = [
      absence("hint", "2026-10-05", "holiday", { participantIds: [] }),
      absence("partial", "2026-10-06", "sick", { allDay: false }),
      absence("cancelled", "2026-10-07", "vacation", { cancelled: true }),
      ...["abf", "rest", "half-day-off"].map((key, i) =>
        absence(key, shiftDate("2026-10-08", i), key),
      ),
    ];
    expect(calculate({ events }).creditSeconds).toBe(0);
  });
  it("requires approval for a linked leave credit", () => {
    const event = absence("leave-event", "2026-10-08", "vacation", { leaveId: "leave" });
    expect(calculate({ events: [event] }).creditSeconds).toBe(0);
    expect(
      calculate({ events: [event], leave: [record("leave", "leave", { status: "approved" })] })
        .creditSeconds,
    ).toBe(2.5 * H);
  });
  it("matches imported named definitions within their own trade and respects excluded keys", () => {
    const definition = record("category", "calendarCategories", {
      key: "imported-paid",
      name: "Urlaub",
    });
    const event = absence("imported", "2026-10-08", "imported-paid");
    expect(calculate({ events: [event], calendarCategories: [definition] }).creditSeconds).toBe(
      2.5 * H,
    );
    expect(
      calculate({
        events: [event],
        calendarCategories: [{ ...definition, departmentId: "lighting" }],
      }).creditSeconds,
    ).toBe(0);
    expect(
      calculate({
        events: [absence("abf", "2026-10-08", "abf")],
        calendarCategories: [{ ...definition, data: { key: "abf", name: "Urlaub" } }],
      }).creditSeconds,
    ).toBe(0);
  });
  it("prorates a midweek historical rate change by seven calendar days", () => {
    const profile = {
      ...settings,
      schedules: [
        ...settings.schedules,
        { ...settings.schedules[0], effectiveFrom: "2026-10-08", weeklyMinutes: 39 * 60 },
      ],
    };
    const result = calculate({
      settings: profile,
      events: [absence("old", "2026-10-07", "holiday"), absence("new", "2026-10-08", "holiday")],
    });
    expect(result.targetSeconds).toBe(Math.round(((3 * 15 + 4 * 39) * H) / 7));
    expect(result.creditSeconds).toBe(9 * H);
  });
  it("prorates the account's first partial week and excludes days before it begins", () => {
    const profile = {
      ...settings,
      schedules: [{ ...settings.schedules[0], effectiveFrom: "2026-10-08" }],
    };
    const result = calculate({
      settings: profile,
      attendance: [attendance("2026-10-05", 20), attendance("2026-10-08", 3)],
      events: [absence("before", "2026-10-05", "holiday")],
    });
    expect(result).toMatchObject({
      from: "2026-10-05",
      to: "2026-10-11",
      attendanceSeconds: 3 * H,
      creditSeconds: 0,
      targetSeconds: Math.round((15 * H * 4) / 7),
    });
  });
  it("sums only completed weeks plus the opening balance in the total account", () => {
    const result = calculate({
      from: undefined,
      to: undefined,
      includeOpeningBalance: true,
      attendance: [attendance("2026-10-08", 16), attendance("2026-10-12", 45)],
      events: [absence("holiday", "2026-10-08", "holiday")],
    });
    expect(result).toMatchObject({
      to: "2026-10-11",
      balanceSeconds: 5.5 * H,
      inProgress: false,
      completedWeekCount: 1,
    });
  });
  it("keeps the opening balance when no first week has closed yet", () => {
    const profile = {
      ...settings,
      schedules: [{ ...settings.schedules[0], effectiveFrom: "2026-10-12" }],
    };
    expect(
      calculate({ settings: profile, from: undefined, to: undefined, includeOpeningBalance: true }),
    ).toMatchObject({ targetSeconds: 0, balanceSeconds: 2 * H, completedWeekCount: 0 });
  });
  it("exposes the full ongoing weekly target, fulfilled hours and remaining hours separately", () => {
    const result = calculate({
      from: "2026-10-12",
      to: "2026-10-18",
      now: new Date("2026-10-14T12:00:00+02:00"),
      attendance: [attendance("2026-10-12", 8)],
      events: [
        absence("today", "2026-10-14", "holiday"),
        absence("future", "2026-10-15", "holiday"),
      ],
    });
    expect(result).toMatchObject({
      attendanceSeconds: 8 * H,
      creditSeconds: 2.5 * H,
      targetSeconds: 15 * H,
      inProgress: true,
    });
    expect(result.targetSeconds - result.attendanceSeconds - result.creditSeconds).toBe(4.5 * H);
  });
  it("counts a saved booking fully today even when its end time is later, after pauses", () => {
    const booking = record("today", "attendance", {
      date: "2026-10-12",
      start: "2026-10-12T10:00:00+02:00",
      end: "2026-10-12T18:00:00+02:00",
      pauseSeconds: H,
      durationSeconds: 7 * H,
    });
    expect(
      calculate({
        from: "2026-10-12",
        to: "2026-10-18",
        now: new Date("2026-10-12T14:00:00+02:00"),
        attendance: [booking],
      }).attendanceSeconds,
    ).toBe(7 * H);
  });
  it("does not count future days or production bookings as attendance", () => {
    const production = record("production", "time", {
      date: "2026-10-12",
      durationSeconds: 99 * H,
    });
    expect(
      calculate({
        from: "2026-10-12",
        to: "2026-10-18",
        attendance: [attendance("2026-10-13", 20), production],
        events: [absence("future", "2026-10-13", "holiday")],
      }),
    ).toMatchObject({ attendanceSeconds: 0, creditSeconds: 0 });
  });
  it("splits a midnight booking between its two calendar weeks", () => {
    const booking = record("midnight", "attendance", {
      start: "2026-10-11T22:00:00+02:00",
      end: "2026-10-12T02:00:00+02:00",
      durationSeconds: 4 * H,
      pauseSeconds: 0,
    });
    expect(calculate({ attendance: [booking] }).attendanceSeconds).toBe(2 * H);
    expect(
      calculate({ from: "2026-10-12", to: "2026-10-18", attendance: [booking] }).attendanceSeconds,
    ).toBe(2 * H);
  });
  it("expands a custom period to complete Monday–Sunday weeks", () => {
    expect(
      calculate({
        from: "2026-10-08",
        to: "2026-10-09",
        attendance: [attendance("2026-10-11", 15)],
      }),
    ).toMatchObject({
      from: "2026-10-05",
      to: "2026-10-11",
      targetSeconds: 15 * H,
      balanceSeconds: 0,
    });
  });
  it("assigns whole weeks to their Monday's month across month and year boundaries", () => {
    expect(balanceMonthRange("2026-10")).toEqual({ from: "2026-10-05", to: "2026-11-01" });
    expect(balanceMonthRange("2026-09")).toEqual({ from: "2026-09-07", to: "2026-10-04" });
    expect(balanceMonthRange("2025-12")).toEqual({ from: "2025-12-01", to: "2026-01-04" });
  });
  it("includes November's first Sunday in October, but not October days in September's last week", () => {
    const result = calculate({
      ...balanceMonthRange("2026-10"),
      now: new Date("2026-11-02T12:00:00+01:00"),
      attendance: [attendance("2026-10-01", 10), attendance("2026-11-01", 15)],
    });
    expect(result).toMatchObject({
      attendanceSeconds: 15 * H,
      targetSeconds: 60 * H,
      completedWeekCount: 4,
    });
  });
  it("recalculates affected weeks after a booking edit or deletion", () => {
    const events = [absence("credit", "2026-10-08", "holiday")];
    expect(calculate({ events, attendance: [attendance("2026-10-08", 10)] }).balanceSeconds).toBe(
      -2.5 * H,
    );
    expect(calculate({ events, attendance: [attendance("2026-10-08", 15)] }).balanceSeconds).toBe(
      2.5 * H,
    );
    expect(calculate({ events }).balanceSeconds).toBe(-12.5 * H);
  });
  it("uses the theater's local day at UTC midnight", () => {
    const result = calculate({
      timezone: "America/New_York",
      now: new Date("2026-10-12T01:00:00Z"),
      events: [absence("local-sunday", "2026-10-11", "holiday", {}, "America/New_York")],
    });
    expect(result.creditSeconds).toBe(2.5 * H);
    expect(result.inProgress).toBe(true);
  });
});
