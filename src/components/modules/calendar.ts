import { PeriodPicker, periodExportFilters } from "@/components/period-picker";
import {
  initialPeriod,
  seasonBounds,
  recordMatchesPeriod,
  type PeriodFilter,
} from "@/shared/period-filter";
import FullCalendar from "@/components/full-calendar.svelte";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import deLocale from "@fullcalendar/core/locales/de";
import luxonPlugin from "@fullcalendar/luxon3";
import { occurrences } from "@/modules/calendar/occurrences";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  SlidersHorizontal,
} from "@lucide/svelte";
import type { DomainRecord, Member } from "@/shared/contracts";
import { canManageRecord } from "@/shared/record-permissions";
import {
  dateLabel,
  ids,
  localDate,
  instantDate,
  shiftDate,
  value,
  weekStart,
} from "@/shared/client-api";
import { isActiveStaff } from "@/shared/client-members";
import { calendarEventSelected } from "@/shared/calendar-selection";
import { calendarEventPaint } from "@/shared/calendar-paint";
import { sortCalendarStaff } from "@/shared/calendar-team";
import { bavarianHoliday } from "@/shared/bavarian-holidays";
import { sortProductionsByPremiere } from "@/shared/production-order";
import { useWorkspace } from "../workspace-context";
import { Badge, Button, ErrorMessage, ExportButton, PageHeader } from "../ui";
import { ResourceEditor } from "../resource-editor";
import { RecordDetail } from "../resource-view";
import { ExportDialog } from "../export-dialog";
import { calendarPresentation, calendarCategoryBlocksTime } from "@/shared/calendar-categories";
import {
  calendarCategories,
  monthStart,
  shiftMonth,
} from "@/modules/calendar/components/client-calendar";
import { CalendarCategoriesDialog } from "@/modules/calendar/components/categories-dialog";
import { TeamCalendar } from "@/modules/calendar/components/team-calendar";
import {
  CalendarPresentationControls,
  useCalendarPresentation,
} from "@/modules/calendar/components/calendar-presentation-controls";
import presentationStyles from "@/modules/calendar/components/calendar-presentation.module.css";
import { MobileDaySheet } from "@/modules/calendar/components/mobile-day-sheet";
import { HolidayLabel } from "@/modules/calendar/components/holiday-label";
import { calendarDayIndex, calendarDayLabel } from "@/modules/calendar/components/day-details";
import calendarStyles from "@/modules/calendar/components/mobile-calendar.module.css";
import { statusLabels } from "../resource-fields";
import { useViewState } from "@/shared/view-state";
import { ShiftSwapPanel } from "@/modules/shift-swaps/components/shift-swap-panel";
export const calendarClock = (date: Date | null, zone = "Europe/Berlin") =>
  date
    ? new Intl.DateTimeFormat("de-DE", {
        timeZone: zone,
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
    : "";
export function expandEvents(
  records: DomainRecord[],
  rangeStart: string,
  rangeEnd: string,
  productions: DomainRecord[] = [],
  categories?: DomainRecord[],
  member?: Member,
  zone = String(records[0]?.data.theaterTimezone || "Europe/Berlin"),
) {
  return records.flatMap((record) => {
    if (
      !Number.isFinite(new Date(value(record.data, "start")).getTime()) ||
      !Number.isFinite(new Date(value(record.data, "end")).getTime())
    )
      return [];
    const presentation = calendarPresentation(record, productions, categories);
    return occurrences(
      record,
      instantDate(rangeStart, zone),
      instantDate(rangeEnd, zone),
      zone,
    ).map((instance) => ({
      id: `${record.id}:${instance.start.toISOString()}`,
      title: presentation.compactTitle,
      allDay: presentation.allDay,
      categoryName: presentation.categoryName,
      background: presentation.background,
      blocksTime: presentation.blocksTime,
      start: instance.start.toISOString(),
      end: instance.end.toISOString(),
      ...calendarEventPaint(presentation.color, presentation.allDay, !!presentation.background),
      editable:
        !record.data.leaveId &&
        !presentation.background &&
        (!record.data.recurrence || record.data.recurrence === "none") &&
        (!member || canManageRecord(member, "events", record)),
      extendedProps: { record },
    }));
  });
}
export { default as CalendarModule } from "./calendar.CalendarModule.svelte";
