import { ChevronLeft, ChevronRight, Plus, X } from "@lucide/svelte";
import type { DomainRecord, Member, RecordData } from "@/shared/contracts";
import { shiftDate } from "@/shared/client-api";
import { Button } from "@/components/ui";
import { calendarDayEntries, calendarDayLabel } from "./day-details";
import { MobileDayAgenda } from "./mobile-day-agenda";
import { HolidayLabel } from "./holiday-label";
import type { CalendarInstance } from "./team-calendar";
import styles from "./mobile-day-sheet.module.css";
export type DayCreateOption = {
    id: string;
    label: string;
    personName?: string;
    participantIds: string[];
};
export { default as MobileDaySheet } from "./mobile-day-sheet.MobileDaySheet.svelte";
