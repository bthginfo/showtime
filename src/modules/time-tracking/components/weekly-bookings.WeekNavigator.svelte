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
  import { BookingList, WeeklyHistory } from "./weekly-bookings";
  const effects = createEffects();
  type ViewProps = {
    week: string;
    onChange: (week: string) => void;
  };
  export let week: ViewProps["week"] = undefined as any;
  export let onChange: ViewProps["onChange"] = undefined as any;
  let identity = isoWeek(week);

  $: identity = isoWeek(week);
</script>

<div class={styles.weekNavigator} aria-label="Woche auswählen">
  <button
    class="button secondary"
    aria-label="Vorherige Woche"
    on:click={() => onChange(shiftDate(week, -7))}
  >
    <ChevronLeft size={18}></ChevronLeft>
  </button>
  <label>
    <span>
      KW {identity.number} · {identity.year} · Woche ab
    </span>
    <input
      type="date"
      aria-label="Woche ab"
      value={week}
      on:input={(event) => {
        if (event.currentTarget.value) onChange(isoWeek(event.currentTarget.value).start);
      }}
    />
  </label>
  <button
    class="button secondary"
    aria-label="Nächste Woche"
    on:click={() => onChange(shiftDate(week, 7))}
  >
    <ChevronRight size={18}></ChevronRight>
  </button>
  {#if week !== weekStart()}<Button onClick={() => onChange(weekStart())}>Aktuelle Woche</Button
    >{/if}
</div>
