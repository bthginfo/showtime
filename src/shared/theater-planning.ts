export type PlanningInterval = { start: Date; end: Date };
import { fromZonedTime } from "date-fns-tz";

/** Availability dates belong to the theater's zone. The end of a service is exclusive. */
export function planningDateWindow(interval: PlanningInterval, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  function date(value: Date) {
    const parts = formatter.formatToParts(value);
    return ["year", "month", "day"]
      .map((type) => parts.find((part) => part.type === type)!.value)
      .join("-");
  }
  return {
    from: date(interval.start),
    to: date(new Date(interval.end.getTime() - 1)),
  };
}

/** Merge adjacent services for ONE person; other people's services must stay separate. */
export function continuousPlanningBlocks(intervals: PlanningInterval[]): PlanningInterval[] {
  const sorted = intervals
    .map((interval) => ({ start: new Date(interval.start), end: new Date(interval.end) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const blocks: PlanningInterval[] = [];
  for (const interval of sorted) {
    const last = blocks.at(-1);
    if (last && interval.start <= last.end) {
      if (interval.end > last.end) last.end = interval.end;
    } else blocks.push(interval);
  }
  return blocks;
}

/** Confirmed theater settings only. This is not a tariff or payroll calculation. */
export function workRuleViolation(
  proposed: PlanningInterval,
  existing: PlanningInterval[],
  rules: Record<string, unknown>,
): "maximum-duty" | "minimum-rest" | "maximum-week" | "consecutive-days" | null {
  if (rules.confirmedByTheater !== true) return null;
  const blocks = continuousPlanningBlocks([proposed, ...existing]);
  const duty = blocks.find((block) => block.start <= proposed.start && block.end >= proposed.end)!;
  const maximum = Number(rules.maxDutyHours),
    minimumRest = Number(rules.minimumRestHours);
  if (Number.isFinite(maximum) && (duty.end.getTime() - duty.start.getTime()) / 3600000 > maximum)
    return "maximum-duty";
  for (const block of blocks) {
    if (block === duty) continue;
    const gap =
      block.end <= duty.start
        ? duty.start.getTime() - block.end.getTime()
        : block.start.getTime() - duty.end.getTime();
    if (gap > 0 && gap < minimumRest * 3600000) return "minimum-rest";
  }
  const zone = String(rules.timezone || "Europe/Berlin");
  const proposedDates = planningDateWindow(proposed, zone);
  if (typeof rules.maxWeeklyHours === "number") {
    let day = proposedDates.from;
    const weeks = new Set<string>();
    while (day <= proposedDates.to) {
      const value = new Date(day + "T00:00Z"),
        weekday = (value.getUTCDay() + 6) % 7;
      value.setUTCDate(value.getUTCDate() - weekday);
      weeks.add(value.toISOString().slice(0, 10));
      day = new Date(Date.parse(day + "T00:00Z") + 86400000).toISOString().slice(0, 10);
    }
    for (const monday of weeks) {
      const from = fromZonedTime(monday + "T00:00", zone).getTime(),
        until = fromZonedTime(
          new Date(Date.parse(monday + "T00:00Z") + 7 * 86400000).toISOString().slice(0, 10) +
            "T00:00",
          zone,
        ).getTime();
      const hours = blocks.reduce(
        (sum, b) =>
          sum +
          Math.max(0, Math.min(b.end.getTime(), until) - Math.max(b.start.getTime(), from)) /
            3600000,
        0,
      );
      if (hours > rules.maxWeeklyHours) return "maximum-week";
    }
  }
  if (typeof rules.maxConsecutiveDays === "number") {
    const days = new Set<string>();
    for (const block of blocks) {
      const range = planningDateWindow(block, zone);
      let day = range.from;
      while (day <= range.to) {
        days.add(day);
        day = new Date(Date.parse(day + "T00:00Z") + 86400000).toISOString().slice(0, 10);
      }
    }
    const sorted = [...days].sort();
    let count = 0,
      previous = "",
      first = "";
    for (const day of sorted) {
      if (previous && Date.parse(day) - Date.parse(previous) === 86400000) count++;
      else {
        count = 1;
        first = day;
      }
      if (
        count > rules.maxConsecutiveDays &&
        first <= proposedDates.to &&
        day >= proposedDates.from
      )
        return "consecutive-days";
      previous = day;
    }
  }
  return null;
}
