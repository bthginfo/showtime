import type { DomainRecord } from "@/shared/contracts";
import { shiftDate, timeAllocations } from "@/shared/client-api";
import { currentWorkingSchedule, type WorkingTimeSettings } from "@/shared/working-time";
import { localDay, splitAcrossDays, THEATER_ZONE } from "./rules";
import { timeDayMarkers } from "./day-markers";
import { calendarDayCreditCategory } from "./day-credits";

export function balanceWeekStart(day: string) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return shiftDate(day, -((weekday + 6) % 7));
}

/** Months contain complete weeks whose Monday belongs to that month. */
export function balanceMonthRange(month: string) {
  const firstDay = `${month}-01`;
  const monday = balanceWeekStart(firstDay);
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0))
    .toISOString()
    .slice(0, 10);
  return {
    from: monday < firstDay ? shiftDate(monday, 7) : monday,
    to: shiftDate(balanceWeekStart(lastDay), 6),
  };
}

export interface AttendanceBalance {
  from: string;
  to: string;
  attendanceSeconds: number;
  creditSeconds: number;
  targetSeconds: number;
  openingBalanceSeconds: number;
  balanceSeconds: number;
  inProgress: boolean;
  completedWeekCount: number;
  transitionWeekCount: number;
}

/** Flexible Monday–Sunday targets and credits use only already loaded records. */
export function calculateAttendanceBalance({
  userId,
  settings,
  attendance,
  events = [],
  calendarCategories = [],
  leave = [],
  from,
  to,
  includeOpeningBalance = from === undefined,
  completedWeeksOnly = from === undefined && to === undefined,
  now = new Date(),
  timezone = THEATER_ZONE,
}: {
  userId: string;
  settings: WorkingTimeSettings;
  attendance: DomainRecord[];
  events?: DomainRecord[];
  calendarCategories?: DomainRecord[];
  leave?: DomainRecord[];
  from?: string;
  to?: string;
  includeOpeningBalance?: boolean;
  completedWeeksOnly?: boolean;
  now?: Date;
  timezone?: string;
}): AttendanceBalance {
  const schedules = [...settings.schedules].sort((a, b) =>
    a.effectiveFrom.localeCompare(b.effectiveFrom),
  );
  const today = localDay(now, timezone);
  const accountStart = schedules[0]?.effectiveFrom || today;
  const currentMonday = balanceWeekStart(today);
  const requestedFirst = balanceWeekStart(from || accountStart);
  const first =
    requestedFirst > balanceWeekStart(accountStart)
      ? requestedFirst
      : balanceWeekStart(accountStart);
  const requestedLast = shiftDate(balanceWeekStart(to || today), 6);
  const latest = completedWeeksOnly ? shiftDate(currentMonday, -1) : shiftDate(currentMonday, 6);
  const last = requestedLast < latest ? requestedLast : latest;
  const opening =
    schedules.length && includeOpeningBalance && accountStart <= today
      ? settings.openingBalanceSeconds
      : 0;
  const result: AttendanceBalance = {
    from: first,
    to: last,
    attendanceSeconds: 0,
    creditSeconds: 0,
    targetSeconds: 0,
    openingBalanceSeconds: opening,
    balanceSeconds: opening,
    inProgress: false,
    completedWeekCount: 0,
    transitionWeekCount: 0,
  };
  if (!schedules.length || first > last || accountStart > today) return result;
  const actual = new Map<string, number>();
  for (const record of attendance) {
    if (record.kind !== "attendance" || record.data.userId !== userId) continue;
    let allocations = timeAllocations(record.data);
    const start = String(record.data.start || ""),
      end = String(record.data.end || "");
    if (
      !Array.isArray(record.data.dayAllocations) &&
      Number.isFinite(Date.parse(start)) &&
      Date.parse(end) > Date.parse(start)
    )
      allocations = splitAcrossDays(
        start,
        end,
        Math.max(0, Number(record.data.pauseSeconds) || 0),
        timezone,
      );
    for (const day of allocations) {
      // A saved booking counts fully on its local day, even if today's end time is later.
      if (
        day.date < first ||
        day.date < accountStart ||
        day.date > last ||
        day.date > today ||
        !Number.isFinite(day.seconds) ||
        day.seconds <= 0
      )
        continue;
      actual.set(day.date, (actual.get(day.date) || 0) + day.seconds);
    }
  }
  const approvedLeave = new Set(
    leave
      .filter((row) => row.data.userId === userId && row.data.status === "approved")
      .map((row) => row.id),
  );
  const paidDays = new Set(
    timeDayMarkers({
      events: events.filter(
        (event) =>
          event.kind === "events" &&
          event.data.allDay === true &&
          calendarDayCreditCategory(event, calendarCategories) &&
          (!event.data.leaveId || approvedLeave.has(String(event.data.leaveId))),
      ),
      calendarCategories,
      userId,
      from: first,
      to: last < today ? last : today,
      timezone,
    }).map((marker) => marker.date),
  );
  for (let monday = first; monday <= last; monday = shiftDate(monday, 7)) {
    if (
      accountStart > monday ||
      schedules.some(
        (schedule) =>
          schedule.effectiveFrom > monday && schedule.effectiveFrom <= shiftDate(monday, 6),
      )
    )
      result.transitionWeekCount++;
    let weeklyTarget = 0,
      weeklyActual = 0,
      weeklyCredit = 0;
    for (let offset = 0; offset < 7; offset++) {
      const day = shiftDate(monday, offset);
      if (day < accountStart) continue;
      const schedule = currentWorkingSchedule({ ...settings, schedules }, day);
      if (!schedule) continue;
      // Seventh-day weights exist only to prorate dated transitions; there is no daily quota.
      weeklyTarget += (schedule.weeklyMinutes * 60) / 7;
      weeklyActual += actual.get(day) || 0;
      if (day <= today && paidDays.has(day)) weeklyCredit += (schedule.weeklyMinutes * 60) / 6;
    }
    result.targetSeconds += Math.round(weeklyTarget);
    result.attendanceSeconds += Math.round(weeklyActual);
    result.creditSeconds += Math.round(weeklyCredit);
    if (monday === currentMonday) result.inProgress = true;
    else result.completedWeekCount++;
  }
  result.balanceSeconds =
    result.openingBalanceSeconds +
    result.attendanceSeconds +
    result.creditSeconds -
    result.targetSeconds;
  return result;
}

export function signedHours(seconds: number) {
  return `${seconds > 0 ? "+" : seconds < 0 ? "−" : ""}${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(Math.abs(seconds) / 3600)}`;
}
