<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { timezone } = useTheaterTime();
  import { ChevronRight, Pencil } from "@lucide/svelte";
  import type { DomainRecord, Member } from "@/shared/contracts";
  import { ids, value } from "@/shared/client-api";
  import {
    calendarDayEntries as calendarDayEntriesBase,
    calendarInstanceTime as calendarInstanceTimeBase,
  } from "./day-details";
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
  const effects = createEffects();
  const calendarDayEntries = (events: Parameters<typeof calendarDayEntriesBase>[0], day: string) =>
    calendarDayEntriesBase(events, day, timezone());
  const calendarInstanceTime = (event: Parameters<typeof calendarInstanceTimeBase>[0]) =>
    calendarInstanceTimeBase(event, timezone());
  type ViewProps = {
    events: CalendarInstance[];
    day: string;
    members: Pick<Member, "id" | "name">[];
    productions: DomainRecord[];
    canEdit?: (record: DomainRecord) => boolean;
    onOpen: (record: DomainRecord) => void;
    onEdit?: (record: DomainRecord) => void;
  };
  export let events: ViewProps["events"] = undefined as any;
  export let day: ViewProps["day"] = undefined as any;
  export let members: ViewProps["members"] = undefined as any;
  export let productions: ViewProps["productions"] = undefined as any;
  export let canEdit: ViewProps["canEdit"] = undefined as any;
  export let onOpen: ViewProps["onOpen"] = undefined as any;
  export let onEdit: ViewProps["onEdit"] = undefined as any;
  let selected = (() => calendarDayEntries(events, day))();

  $: selected = (() => calendarDayEntries(events, day))();
</script>

<ol class={`calendar-mobile-day-agenda ${styles.agenda}`} aria-live="polite">
  {#if selected.length}{#each selected as event (event.id)}{@const record =
        event.extendedProps.record}{@const names = ids(record.data, "participantIds").map(
        (id) => members.find((person) => person.id === id)?.name || "Ehemaliges Teammitglied",
      )}{@const series = record.data.recurrence && record.data.recurrence !== "none"}
      <li class={styles.event}>
        <button
          type="button"
          class={`team-mobile-service calendar-colored-event ${styles.service}`}
          style={styleString({
            borderLeftColor: event.borderColor,
            backgroundColor: event.backgroundColor,
            color: event.textColor,
          })}
          on:click={() => onOpen(record)}
        >
          <span class={styles.people}>{names.join(", ") || "Gäste/Aushilfen"}</span>
          <strong>{event.title}</strong>
          <span>
            {calendarInstanceTime(event)} · {event.categoryName}
            {event.background
              ? event.background === "service"
                ? " · Arbeitszeit"
                : " · Hinweis"
              : ""}
          </span>
          <span class={styles.location}>
            {value(record.data, "location") || "Ort noch offen"} ·{" "}
            {value(
              productions.find((production) => production.id === record.data.productionId)?.data ||
                {},
              "title",
            ) || "Ohne Produktion"}
          </span>
          <span class={styles.detailsCue}>
            Details ansehen{series ? " · Terminserie" : ""}
            <ChevronRight size={16} aria-hidden="true"></ChevronRight>
          </span>
        </button>
        {#if onEdit && canEdit?.(record)}<button
            type="button"
            class={`text-button ${styles.editAction}`}
            aria-label={`${series ? "Terminserie" : "Termin"} ${event.title} bearbeiten`}
            on:click={() => onEdit(record)}
          >
            <Pencil size={14} aria-hidden="true"></Pencil>
            {series ? "Serie bearbeiten" : "Bearbeiten"}
          </button>{/if}
      </li>{/each}{:else}<li class={`team-mobile-empty ${styles.empty}`}>
      <strong>Keine Termine an diesem Tag.</strong>
      Wähle einen anderen Tag oder blende weitere Kalender ein.
    </li>{/if}
</ol>
