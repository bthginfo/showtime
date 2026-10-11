<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel, localDate } = useTheaterTime();
  import { initialState } from "@/shared/svelte-runtime";

  import { CalendarPlus, Plus } from "@lucide/svelte";
  import type { DomainRecord } from "@/shared/contracts";
  import { Button } from "@/components/ui";
  import { useWorkspace } from "@/components/workspace-context";
  import { hours, shiftDate } from "@/shared/client-api";
  import { isActiveStaff } from "@/shared/client-members";
  import { EventEditor } from "@/modules/calendar/components/event-editor";
  import { calendarCategories } from "@/modules/calendar/components/client-calendar";
  import type { BookingWeekEntry } from "../history";
  import type { TimeDayMarker } from "../day-markers";
  import styles from "./time-history.module.css";
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
  const effects = createEffects();
  type ViewProps = {
    week: string;
    person: string;
    entries: BookingWeekEntry[];
    markers: TimeDayMarker[];
    onDetail: (record: DomainRecord) => void;
    onBookDay?: (date: string) => void;
    bookingLabel?: string;
  };
  export let week: ViewProps["week"] = undefined as any;
  export let person: ViewProps["person"] = undefined as any;
  export let entries: ViewProps["entries"] = undefined as any;
  export let markers: ViewProps["markers"] = undefined as any;
  export let onDetail: ViewProps["onDetail"] = undefined as any;
  export let onBookDay: ViewProps["onBookDay"] = undefined as any;
  export let bookingLabel: NonNullable<ViewProps["bookingLabel"]> = "Zeit";
  const workspaceStore = useWorkspace();
  let { workspace } = $workspaceStore;
  $: ({ workspace } = $workspaceStore);
  let day: string = "";
  const setDay = (next: typeof day | ((current: typeof day) => typeof day)) => {
    day = typeof next === "function" ? (next as (current: typeof day) => typeof day)(day) : next;
  };
  let editing: DomainRecord | null = initialState<DomainRecord | null>(null);
  const setEditing = (
    next: DomainRecord | null | ((current: DomainRecord | null) => DomainRecord | null),
  ) => {
    editing =
      typeof next === "function"
        ? (next as (current: DomainRecord | null) => DomainRecord | null)(editing)
        : next;
  };
  let allDayCategories = calendarCategories(workspace).filter((category) => category.allDay);
  let canMark =
    isActiveStaff(workspace.user) && person === workspace.user.id && allDayCategories.length > 0;
  let defaultDay = localDate() >= week && localDate() <= shiftDate(week, 6) ? localDate() : week;

  $: allDayCategories = calendarCategories(workspace).filter((category) => category.allDay);
  $: canMark =
    isActiveStaff(workspace.user) && person === workspace.user.id && allDayCategories.length > 0;
  $: defaultDay = localDate() >= week && localDate() <= shiftDate(week, 6) ? localDate() : week;
</script>

<section class={styles.dayOverview} aria-label="Tagesübersicht mit Kalenderkennzeichen">
  <header class={styles.sectionHeading}>
    <div>
      <h2>Tagesübersicht</h2>
      <p class="small muted">
        {onBookDay
          ? "Wähle einen Tag, um Zeiten nachzutragen. Freie Tage trägst du über „Tag kennzeichnen“ ein."
          : "ABF, Ruhetag und Abwesenheiten bleiben Kalenderkennzeichen ohne Stunden."}
      </p>
    </div>
    {#if canMark}<Button onClick={() => setDay(defaultDay)}>
        <CalendarPlus size={16}></CalendarPlus> Tag kennzeichnen
      </Button>{/if}
  </header>
  <div class={styles.dayGrid}>
    {#each Array.from({ length: 7 }) as _, index}{@const date = shiftDate(
        week,
        index,
      )}{@const labels = markers.filter((marker) => marker.date === date)}{@const seconds = entries
        .flatMap((entry) => entry.allocations)
        .filter((allocation) => allocation.date === date)
        .reduce((total, allocation) => total + allocation.seconds, 0)}{#snippet render_summary_0()}
        <span class={styles.dayDate}>
          <strong>{["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][index]}</strong>{" "}
          {dateLabel(date)}
        </span>
        <strong class={styles.dayHours}>{seconds ? `${hours(seconds)} h` : "–"}</strong>
      {/snippet}
      <div class={styles.overviewDay}>
        {#if onBookDay}<button
            type="button"
            class={styles.dayBooking}
            aria-label={`${bookingLabel} für ${dateLabel(date)} nachtragen`}
            on:click={() => onBookDay(date)}
          >
            {@render render_summary_0()}
            <span class={styles.dayBookingLabel}>
              <Plus size={13}></Plus> Zeit
            </span>
          </button>{:else}<div class={styles.daySummary}>{@render render_summary_0()}</div>{/if}
        {#each labels as marker (`${marker.event.id}:${date}`)}<button
            class={styles.dayMarker}
            title={marker.title || marker.label}
            on:click={() => {
              if (canMark && !marker.event.data.leaveId) setEditing(marker.event);
              else onDetail(marker.event);
            }}
          >
            {marker.label}
          </button>{/each}
      </div>{/each}
  </div>
</section>
{#if day}<EventEditor
    defaults={{
      category:
        allDayCategories.find((category) => category.key === "abf")?.key ||
        allDayCategories[0]?.key,
      allDay: true,
      start: `${day}T00:00`,
      end: `${day}T00:00`,
      participantIds: [workspace.user.id],
    }}
    onClose={() => setDay("")}
  ></EventEditor>{/if}
{#if editing}{@const activeEditing = editing}<EventEditor
    record={workspace.records.events.find((row) => row.id === activeEditing.id) || activeEditing}
    onClose={() => setEditing(null)}
  ></EventEditor>{/if}
