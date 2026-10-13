<script lang="ts">
  import type { ProductionPresentation } from "@/shared/calendar-references";

  import { useTheaterTime } from "@/components/theater-time";
  const { timezone } = useTheaterTime();
  import { ChevronLeft, ChevronRight, Plus, X } from "@lucide/svelte";
  import type { DomainRecord, Member, RecordData } from "@/shared/contracts";
  import { shiftDate } from "@/shared/client-api";
  import { Button } from "@/components/ui";
  import {
    calendarDayEntries as calendarDayEntriesBase,
    calendarDayLabel as calendarDayLabelBase,
  } from "./day-details";
  import { MobileDayAgenda } from "./mobile-day-agenda";
  import { HolidayLabel } from "./holiday-label";
  import type { CalendarInstance } from "./team-calendar";
  import styles from "./mobile-day-sheet.module.css";
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
  import { type DayCreateOption } from "./mobile-day-sheet";
  const effects = createEffects();
  const calendarDayEntries = (events: Parameters<typeof calendarDayEntriesBase>[0], day: string) =>
    calendarDayEntriesBase(events, day, timezone());
  const calendarDayLabel = (day: string) => calendarDayLabelBase(day, timezone());
  type ViewProps = {
    events: CalendarInstance[];
    day: string;
    members: Pick<Member, "id" | "name">[];
    productions: ProductionPresentation[];
    contextLabel: string;
    minDay: string;
    maxDay: string;
    createOptions: DayCreateOption[];
    canEdit: (record: DomainRecord) => boolean;
    onSelect: (day: string) => void;
    onClose: () => void;
    onRestoreFocus: () => void;
    onOpen: (record: DomainRecord) => void;
    onEdit: (record: DomainRecord) => void;
    onCreate: (defaults: RecordData) => void;
  };
  export let events: ViewProps["events"] = undefined as any;
  export let day: ViewProps["day"] = undefined as any;
  export let members: ViewProps["members"] = undefined as any;
  export let productions: ViewProps["productions"] = undefined as any;
  export let contextLabel: ViewProps["contextLabel"] = undefined as any;
  export let minDay: ViewProps["minDay"] = undefined as any;
  export let maxDay: ViewProps["maxDay"] = undefined as any;
  export let createOptions: ViewProps["createOptions"] = undefined as any;
  export let canEdit: ViewProps["canEdit"] = undefined as any;
  export let onSelect: ViewProps["onSelect"] = undefined as any;
  export let onClose: ViewProps["onClose"] = undefined as any;
  export let onRestoreFocus: ViewProps["onRestoreFocus"] = undefined as any;
  export let onOpen: ViewProps["onOpen"] = undefined as any;
  export let onEdit: ViewProps["onEdit"] = undefined as any;
  export let onCreate: ViewProps["onCreate"] = undefined as any;
  let dialog = { current: null as HTMLDialogElement | null };
  let restoreFocus = { current: onRestoreFocus as any | null };
  const headingId = createId();
  const summaryId = createId();
  let createPerson = createOptions[0]?.id || "";
  const setCreatePerson = (
    next: typeof createPerson | ((current: typeof createPerson) => typeof createPerson),
  ) => {
    createPerson =
      typeof next === "function"
        ? (next as (current: typeof createPerson) => typeof createPerson)(createPerson)
        : next;
  };
  let createOption = createOptions.find((option) => option.id === createPerson) || createOptions[0];
  let count = (() => calendarDayEntries(events, day).length)();
  $: effects.run(
    0,
    () => {
      restoreFocus.current = onRestoreFocus;
    },
    [onRestoreFocus],
  );
  $: effects.run(
    1,
    () => {
      const element = dialog.current;
      if (!element) return;
      const previousOverflow = document.body.style.overflow;
      element.showModal();
      element
        .querySelector<HTMLButtonElement>('button[aria-label="Tagesdetails schließen"]')
        ?.focus({ preventScroll: true });
      document.body.style.overflow = "hidden";
      return () => {
        element.close();
        document.body.style.overflow = previousOverflow;
        requestAnimationFrame(() => {
          if (document.querySelector("dialog[open]")) return;
          // FullCalendar can retain another control's focus or replace the clicked day button.
          restoreFocus.current();
        });
      };
    },
    [],
  );

  $: createOption = createOptions.find((option) => option.id === createPerson) || createOptions[0];
  $: count = (() => calendarDayEntries(events, day).length)();
</script>

<dialog
  bind:this={dialog.current}
  class={styles.sheet}
  data-calendar-day-sheet
  aria-labelledby={headingId}
  aria-describedby={summaryId}
  on:keydown={(event) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (
      (event.shiftKey && document.activeElement === first) ||
      (!event.shiftKey && document.activeElement === last)
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  }}
  on:cancel={(event) => {
    event.preventDefault();
    onClose();
  }}
  on:click={(event) => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      onClose();
  }}
>
  <header class={styles.heading}>
    <div>
      <p class="eyebrow">TAG IM KALENDER</p>
      <h2 id={headingId}>{calendarDayLabel(day)}</h2>
      <HolidayLabel date={day}></HolidayLabel>
      <p class={styles.summary} id={summaryId}>
        {contextLabel} · {count}
        {count === 1 ? "Termin" : "Termine"}
      </p>
    </div>
    <button
      type="button"
      class={`icon-button ${styles.close}`}
      aria-label="Tagesdetails schließen"
      on:click={onClose}
    >
      <X size={20}></X>
    </button>
  </header>
  <nav class={styles.dayNavigation} aria-label="Tag wechseln">
    <button
      type="button"
      class="text-button"
      disabled={day <= minDay}
      on:click={() => onSelect(shiftDate(day, -1))}
    >
      <ChevronLeft size={16}></ChevronLeft>
      Vorheriger Tag
    </button>
    <button
      type="button"
      class="text-button"
      disabled={day >= maxDay}
      on:click={() => onSelect(shiftDate(day, 1))}
    >
      Nächster Tag
      <ChevronRight size={16}></ChevronRight>
    </button>
  </nav>
  <div class={`team-mobile-services ${styles.body}`}>
    <MobileDayAgenda {events} {day} {members} {productions} {canEdit} {onOpen} {onEdit}
    ></MobileDayAgenda>
  </div>
  {#if !!createOption}<footer class={`team-mobile-create ${styles.footer}`}>
      {#if createOptions.length > 1}<label>
          Termin für
          <select
            value={createOption.id}
            on:change={(event) => setCreatePerson(event.currentTarget.value)}
          >
            {#each createOptions as option (option.id)}<option value={option.id}>
                {option.personName || option.label}
              </option>{/each}
          </select>
        </label>{/if}
      <Button
        variant="primary"
        onClick={() =>
          onCreate({
            start: `${day}T09:00`,
            end: `${day}T17:00`,
            participantIds: createOption.participantIds,
          })}
      >
        <Plus size={16}></Plus>
        {createOptions.length > 1 ? "Termin anlegen" : createOption.label}
      </Button>
    </footer>{/if}
</dialog>
