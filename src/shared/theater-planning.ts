export type PlanningInterval = { start: Date; end: Date };

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
): "maximum-duty" | "minimum-rest" | null {
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
  return null;
}
