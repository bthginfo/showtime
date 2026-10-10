import { ChevronRight, Plus } from "@lucide/svelte";
import type { DomainRecord, Member, RecordData } from "@/shared/contracts";
import { ids, instantDate, localDate, value } from "@/shared/client-api";
import { calendarTeamLanes } from "@/shared/calendar-team";
import { bavarianHoliday } from "@/shared/bavarian-holidays";
import type { CalendarBackground } from "@/shared/calendar-categories";
import { Empty } from "@/components/ui";
import { calendarDayIndex } from "./day-details";
import { MobileDaySheet } from "./mobile-day-sheet";
import { TeamCalendarScroll } from "./team-calendar-scroll";
import { HolidayLabel } from "./holiday-label";
import styles from "./mobile-calendar.module.css";
export type CalendarInstance = {
    id: string;
    title: string;
    start: string;
    end: string;
    backgroundColor: string;
    borderColor: string;
    textColor: string;
    allDay: boolean;
    categoryName: string;
    background?: CalendarBackground;
    blocksTime?: boolean;
    extendedProps: {
        record: DomainRecord;
    };
};
export const clock = (date: string) => new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
}).format(new Date(date));
export const fullDay = (date: string) => new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "long",
    day: "numeric",
    month: "long",
}).format(instantDate(date));
export const shortName = (name: string, names: string[]) => {
    if (name === "Gäste/Aushilfen")
        return "Gäste / Aushilfen";
    const [first, ...rest] = name.trim().split(/\s+/);
    return rest.length && names.filter((candidate) => candidate.split(/\s+/)[0] === first).length > 1
        ? `${first} ${rest[0][0]}.`
        : first;
};
export { default as TeamCalendar } from "./team-calendar.TeamCalendar.svelte";
