import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
export function theaterDateTime(instant: string, zone: string) {
  return instant ? formatInTimeZone(new Date(instant), zone, "yyyy-MM-dd'T'HH:mm") : "";
}
export function theaterLabel(value: string, zone: string, withTime = false) {
  if (!value) return "–";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split("-").reverse().join(".");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "–";
  return formatInTimeZone(date, zone, withTime ? "dd.MM.yyyy HH:mm" : "dd.MM.yyyy");
}
export function theaterInstant(local: string, zone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return undefined;
  const instant = fromZonedTime(local, zone);
  if (!Number.isFinite(instant.getTime()) || theaterDateTime(instant.toISOString(), zone) !== local)
    return undefined;
  return instant.toISOString();
}
/** A calendar-day shift keeps series end dates and skipped days aligned across DST. */
export function shiftedSeriesDates(data: Record<string, unknown>, start: string, zone: string) {
  if (!["daily", "weekly"].includes(String(data.recurrence))) return {};
  const oldDay = theaterDateTime(String(data.start), zone).slice(0, 10);
  const newDay = theaterDateTime(start, zone).slice(0, 10);
  const delta = Date.parse(newDay + "T12:00Z") - Date.parse(oldDay + "T12:00Z");
  const shift = (day: string) =>
    new Date(Date.parse(day + "T12:00Z") + delta).toISOString().slice(0, 10);
  return {
    until: data.until ? shift(String(data.until)) : "",
    exceptions: Array.isArray(data.exceptions)
      ? data.exceptions.map((day) => shift(String(day)))
      : [],
  };
}
export function limitedAvailabilityAllows(
  interval: { start: Date; end: Date },
  availability: { start: string; end: string; allowedFrom: string; allowedTo: string },
  zone: string,
) {
  const first = formatInTimeZone(interval.start, zone, "yyyy-MM-dd"),
    last = formatInTimeZone(new Date(interval.end.getTime() - 1), zone, "yyyy-MM-dd");
  let day = first;
  let count = 0;
  while (day <= last && count++ < 367) {
    if (day >= availability.start && day <= availability.end) {
      const dayStart = fromZonedTime(day + "T00:00", zone),
        nextDay = new Date(Date.parse(day + "T00:00Z") + 86400000).toISOString().slice(0, 10),
        dayEnd = fromZonedTime(nextDay + "T00:00", zone);
      const allowedStart = fromZonedTime(day + "T" + availability.allowedFrom, zone),
        allowedEnd = fromZonedTime(day + "T" + availability.allowedTo, zone);
      if (
        Math.max(interval.start.getTime(), dayStart.getTime()) < allowedStart.getTime() ||
        Math.min(interval.end.getTime(), dayEnd.getTime()) > allowedEnd.getTime()
      )
        return false;
    }
    day = new Date(Date.parse(day + "T00:00Z") + 86400000).toISOString().slice(0, 10);
  }
  return count < 367;
}
