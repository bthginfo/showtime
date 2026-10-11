import { dateLabel, instantDate, localDate, shiftDate } from "@/shared/client-api";
import type { CalendarInstance } from "./team-calendar";

export const calendarDayLabel = (day: string, zone = "Europe/Berlin") =>
  new Intl.DateTimeFormat("de-DE", {
    timeZone: zone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(instantDate(day, zone));

export function calendarDayEntries(
  events: CalendarInstance[],
  day: string,
  zone = "Europe/Berlin",
) {
  return events
    .filter(
      (event) =>
        localDate(new Date(event.start), zone) <= day &&
        localDate(new Date(new Date(event.end).getTime() - 1), zone) >= day,
    )
    .sort(
      (a, b) =>
        Number(b.allDay) - Number(a.allDay) ||
        a.start.localeCompare(b.start) ||
        a.title.localeCompare(b.title, "de"),
    );
}

export function calendarDayIndex(
  events: CalendarInstance[],
  from: string,
  through: string,
  zone = "Europe/Berlin",
) {
  const days = new Map<string, CalendarInstance[]>();
  for (let day = from; day <= through; day = shiftDate(day, 1)) {
    days.set(day, calendarDayEntries(events, day, zone));
  }
  return days;
}

export function calendarInstanceTime(event: CalendarInstance, zone = "Europe/Berlin") {
  if (event.allDay) return "Ganztägig";
  const clock = (date: string) =>
    new Intl.DateTimeFormat("de-DE", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  return localDate(new Date(event.start), zone) === localDate(new Date(event.end), zone)
    ? `${clock(event.start)}–${clock(event.end)}`
    : `${dateLabel(event.start, true, zone)} – ${dateLabel(event.end, true, zone)}`;
}
