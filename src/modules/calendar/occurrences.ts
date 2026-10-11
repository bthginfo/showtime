import { addDays, parseISO, format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { DomainRecord } from "@/shared/contracts";
import { THEATER_ZONE } from "@/modules/time-tracking/rules";
export function occurrences(
  event: DomainRecord,
  from: Date,
  to: Date,
  zone = String(event.data.theaterTimezone || THEATER_ZONE),
) {
  if (event.data.cancelled === true) return [];
  const start = new Date(String(event.data.start)),
    end = new Date(String(event.data.end));
  const period = event.data.recurrence === "daily" ? 1 : event.data.recurrence === "weekly" ? 7 : 0;
  const result: { start: Date; end: Date }[] = [];
  const exceptions = Array.isArray(event.data.exceptions) ? event.data.exceptions : [];
  let date = formatInTimeZone(start, zone, "yyyy-MM-dd");
  const clock = formatInTimeZone(start, zone, "HH:mm:ss");
  const endClock = formatInTimeZone(end, zone, "HH:mm:ss");
  const endDate = formatInTimeZone(end, zone, "yyyy-MM-dd");
  const daySpan = Math.round(
    (Date.parse(`${endDate}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86400000,
  );
  const last = event.data.until ? fromZonedTime(`${event.data.until}T23:59:59`, zone) : to;
  if (period) {
    const fromDay = formatInTimeZone(from, zone, "yyyy-MM-dd");
    const distance = Math.floor(
      (Date.parse(`${fromDay}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86400000,
    );
    const jump = Math.max(0, Math.floor((distance - daySpan) / period) - 1);
    date = format(addDays(parseISO(date), jump * period), "yyyy-MM-dd");
  }
  for (let count = 0; count < 2000; count++) {
    const a = period ? fromZonedTime(`${date}T${clock}`, zone) : start;
    const b = period
      ? fromZonedTime(`${format(addDays(parseISO(date), daySpan), "yyyy-MM-dd")}T${endClock}`, zone)
      : end;
    if (a >= to || a > last) break;
    if (b > from && !exceptions.includes(date)) result.push({ start: a, end: b });
    if (!period) break;
    date = format(addDays(parseISO(date), period), "yyyy-MM-dd");
  }
  return result;
}
