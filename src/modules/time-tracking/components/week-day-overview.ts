import { CalendarPlus, Plus } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { Button } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-context";
import { dateLabel, hours, localDate, shiftDate } from "@/shared/client-api";
import { isActiveStaff } from "@/shared/client-members";
import { EventEditor } from "@/modules/calendar/components/event-editor";
import { calendarCategories } from "@/modules/calendar/components/client-calendar";
import type { BookingWeekEntry } from "../history";
import type { TimeDayMarker } from "../day-markers";
import styles from "./time-history.module.css";

export { default as WeekDayOverview } from "./week-day-overview.WeekDayOverview.svelte";
