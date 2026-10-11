<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel, weekStart } = useTheaterTime();
  import { LinkedText } from "@/components/linked-text";
  import { ChevronDown, ChevronLeft, ChevronRight, Pencil } from "@lucide/svelte";
  import type { DomainRecord } from "@/shared/contracts";
  import { hours, num, shiftDate, value } from "@/shared/client-api";
  import { categoryName } from "@/shared/domain-categories";
  import { Button } from "@/components/ui";
  import { useWorkspace } from "@/components/workspace-context";
  import { groupBookingPeople, isoWeek, type BookingWeek, type BookingWeekEntry } from "../history";
  import { WeekDayOverview } from "./week-day-overview";
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
  import { WeekNavigator, BookingList } from "./weekly-bookings";
  const effects = createEffects();
  type ViewProps = {
    weeks: BookingWeek[];
    selectedWeek: string;
    kind: "time" | "attendance";
    person: string;
    filtered: boolean;
    onAllSeasons: () => void;
    onSelectWeek: (week: string) => void;
    onEdit: (record: DomainRecord) => void;
    onDetail: (record: DomainRecord) => void;
    onBookDay?: (date: string) => void;
    groupByPerson?: boolean;
  };
  export let weeks: ViewProps["weeks"] = undefined as any;
  export let selectedWeek: ViewProps["selectedWeek"] = undefined as any;
  export let kind: ViewProps["kind"] = undefined as any;
  export let person: ViewProps["person"] = undefined as any;
  export let filtered: ViewProps["filtered"] = undefined as any;
  export let onAllSeasons: ViewProps["onAllSeasons"] = undefined as any;
  export let onSelectWeek: ViewProps["onSelectWeek"] = undefined as any;
  export let onEdit: ViewProps["onEdit"] = undefined as any;
  export let onDetail: ViewProps["onDetail"] = undefined as any;
  export let onBookDay: ViewProps["onBookDay"] = undefined as any;
  export let groupByPerson: NonNullable<ViewProps["groupByPerson"]> = false;
  let visible: number = 6;
  const setVisible = (next: typeof visible | ((current: typeof visible) => typeof visible)) => {
    visible =
      typeof next === "function"
        ? (next as (current: typeof visible) => typeof visible)(visible)
        : next;
  };
  let history = weeks.filter((week) => week.start !== selectedWeek);

  $: history = weeks.filter((week) => week.start !== selectedWeek);
</script>

<section
  class={styles.history}
  aria-label={`${kind === "attendance" ? "Anwesenheit" : "Arbeitszeit"}: Wochenverlauf`}
>
  <header class={styles.sectionHeading}>
    <div>
      <h2>Wochenverlauf</h2>
      <p class="small muted">Woche aufklappen, Buchungen prüfen und bearbeiten.</p>
    </div>
    {#if filtered}<Button onClick={onAllSeasons}>Alle Spielzeiten ansehen</Button>{/if}
  </header>
  {#if history.length}<div class={styles.historyWeeks}>
      {#each history.slice(0, visible) as week (week.start)}<details class={styles.historyWeek}>
          <summary>
            <span>
              <strong>
                KW {week.number} · {week.year}
              </strong>
              <small>
                {dateLabel(week.start)} – {dateLabel(week.end)} · {week.entries.length}{" "}
                {week.entries.length === 1 ? "Buchung" : "Buchungen"}
                {week.markers.length
                  ? ` · ${[...new Set(week.markers.map((marker) => marker.label))].join(", ")}`
                  : ""}
              </small>
            </span>
            <strong class={styles.historyTotal}>{hours(week.seconds)} h</strong>
            <ChevronDown size={18}></ChevronDown>
          </summary>
          <BookingList entries={week.entries} {kind} {onEdit} {onDetail} {groupByPerson}
          ></BookingList>
          {#if week.markers.length > 0 || onBookDay}<WeekDayOverview
              week={week.start}
              {person}
              entries={week.entries}
              markers={week.markers}
              {onDetail}
              {onBookDay}
              bookingLabel={kind === "attendance" ? "Anwesenheit" : "Zeit"}
            ></WeekDayOverview>{/if}
          <div class={styles.historyFooter}>
            <Button onClick={() => onSelectWeek(week.start)}>Diese Woche auswählen</Button>
          </div>
        </details>{/each}
      {#if history.length > visible}<Button onClick={() => setVisible((count) => count + 6)}>
          Ältere Wochen zeigen ({history.length - visible})
        </Button>{/if}
    </div>{:else}<p class={styles.emptyInline}>
      {filtered
        ? "Keine weiteren Wochen in diesem Zeitraum. Frühere Buchungen findest du unter „Alle Spielzeiten ansehen“."
        : "Noch keine weiteren Wochen gebucht."}
    </p>{/if}
</section>
