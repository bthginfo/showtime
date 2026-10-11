<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel, localDate, weekStart } = useTheaterTime();
  import { useViewState } from "@/shared/view-state";
  import { Plus, UploadCloud } from "@lucide/svelte";
  import { PeriodPicker, periodExportFilters, weekForPeriod } from "@/components/period-picker";
  import { dateMatchesPeriod, initialPeriod, type PeriodFilter } from "@/shared/period-filter";
  import { categoriesFor } from "@/shared/domain-categories";
  import { CategoryManager } from "@/modules/categories/components/category-manager";
  import type { DomainRecord, RecordData } from "@/shared/contracts";
  import { hours, post, shiftDate, value } from "@/shared/client-api";
  import { useStoredValue } from "@/shared/client-storage";
  import { isStaff } from "@/shared/client-members";
  import { useWorkspace } from "../workspace-context";
  import { ActionMenu, Button, ErrorMessage, ExportButton, Modal, PageHeader } from "../ui";
  import { ResourceEditor } from "../resource-editor";
  import { RecordDetail } from "../resource-view";
  import { ExportDialog } from "../export-dialog";
  import { TimerPanel } from "@/modules/time-tracking/components/work-timer";
  import { TimeWorkspace } from "@/modules/time-tracking/components/time-workspace";
  import { groupBookingWeeks, isoWeek, periodForWeek } from "@/modules/time-tracking/history";
  import { timeDayMarkers } from "@/modules/time-tracking/day-markers";
  import {
    BookingList,
    WeekNavigator,
    WeeklyHistory,
  } from "@/modules/time-tracking/components/weekly-bookings";
  import { CalendarTimeProposals } from "@/modules/time-tracking/components/calendar-time-proposals";
  import { WeekDayOverview } from "@/modules/time-tracking/components/week-day-overview";
  import styles from "@/modules/time-tracking/components/time-history.module.css";
  import {
    createEffects,
    createId,
    externalStore,
    styleString,
    applyRef,
  } from "@/shared/svelte-runtime";
  import type {
    ReactNode,
    CSSProperties,
    Dispatch,
    SetStateAction,
    FormEvent,
    ChangeEvent,
    KeyboardEvent,
    MouseEvent,
    DragEvent,
    ComponentProps,
    RefObject,
  } from "@/shared/ui-types";
  import { type Draft, WorkTimeModule } from "./time";
  const effects = createEffects();
  type ViewProps = {
    productionId?: string;
  };
  export let productionId: NonNullable<ViewProps["productionId"]> = "";
</script>

{#if productionId}<WorkTimeModule {productionId}></WorkTimeModule>{:else}<TimeWorkspace
  ></TimeWorkspace>{/if}
