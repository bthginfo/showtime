<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel, weekStart } = useTheaterTime();
  import { LinkedText } from "@/components/linked-text";
  import { ChevronDown, ChevronLeft, ChevronRight, Pencil, Trash2 } from "@lucide/svelte";
  import type { DomainRecord } from "@/shared/contracts";
  import { hours, num, shiftDate, value } from "@/shared/client-api";
  import { categoryName } from "@/shared/domain-categories";
  import { canManageRecord } from "@/shared/record-permissions";
  import { Button, ErrorMessage } from "@/components/ui";
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
  import { WeekNavigator, WeeklyHistory } from "./weekly-bookings";
  const effects = createEffects();
  type ViewProps = {
    entries: BookingWeekEntry[];
    kind: "time" | "attendance";
    onEdit: (record: DomainRecord) => void;
    onDetail: (record: DomainRecord) => void;
    groupByPerson?: boolean;
  };
  export let entries: ViewProps["entries"] = undefined as any;
  export let kind: ViewProps["kind"] = undefined as any;
  export let onEdit: ViewProps["onEdit"] = undefined as any;
  export let onDetail: ViewProps["onDetail"] = undefined as any;
  export let groupByPerson: NonNullable<ViewProps["groupByPerson"]> = false;
  const workspaceStore = useWorkspace();
  let { workspace, remove, busy } = $workspaceStore;
  let error = "";
  async function removeBooking(record: DomainRecord) {
    if (!confirm("Diese Zeitbuchung endgültig löschen?")) return;
    error = "";
    try {
      await remove(record);
    } catch (e) {
      error = e instanceof Error ? e.message : "Löschen fehlgeschlagen";
    }
  }
  $: ({ workspace, remove, busy } = $workspaceStore);
</script>

<ErrorMessage message={error} />{#if groupByPerson}<div class={styles.personGroups}>
    {#each groupBookingPeople(entries, workspace.members) as person (person.userId)}<section
        aria-label={`Arbeitszeit von ${person.name}`}
      >
        <header class={styles.personHeading}>
          <div>
            <h4>{person.name}</h4>
            <span class="small muted">
              {person.entries.length}
              {person.entries.length === 1 ? "Buchung" : "Buchungen"}
              {person.former ? " · ehemaliges Teammitglied" : ""}
            </span>
          </div>
          <strong>{hours(person.seconds)} h</strong>
        </header>
        <svelte:self entries={person.entries} {kind} {onEdit} {onDetail}></svelte:self>
      </section>{/each}
  </div>{:else}<ul class={styles.bookingList}>
    {#each entries as { record, seconds, allocations } (record.id)}{@const production =
        workspace.records.productions.find(
          (row) => row.id === record.data.productionId,
        )}{@const from = allocations[0]?.date || value(record.data, "date")}{@const to =
        allocations.at(-1)?.date || from}
      <li class={styles.bookingRow}>
        <div class={styles.bookingContent}>
          <span class={styles.bookingDate}>
            {dateLabel(from)}
            {from !== to ? ` – ${dateLabel(to)}` : ""}
          </span>
          <button class={styles.detailLink} on:click={() => onDetail(record)}>
            {value(record.data, "title") || "Anwesenheit"}
          </button>
          <span class="small muted">
            {#if kind === "time"}{`${production ? value(production.data, "title") : "Allgemein"} · ${categoryName("time", value(record.data, "category"), workspace.records.categories)}`}{:else}<LinkedText
                text={value(record.data, "notes")}
              ></LinkedText>{/if}
          </span>
          {#if value(record.data, "start") && value(record.data, "end")}<span
              class={styles.bookingInterval}
            >
              {dateLabel(value(record.data, "start"), true)} –{" "}
              {dateLabel(value(record.data, "end"), true)}
              {#if num(record.data, "pauseSeconds") > 0}
                · {Math.round(num(record.data, "pauseSeconds") / 60)} min Pause
              {/if}
            </span>{/if}
          {#if seconds !== num(record.data, "durationSeconds")}<span class="small muted">
              Anteil im Zeitraum · gesamt {hours(num(record.data, "durationSeconds"))} h
            </span>{/if}
        </div>
        <strong class={styles.bookingHours}>{hours(seconds)} h</strong>
        {#if canManageRecord(workspace.user, kind, record)}<Button
            variant="ghost"
            disabled={busy}
            onClick={() => onEdit(record)}
          >
            <Pencil size={15}></Pencil> Bearbeiten
          </Button>
          <Button variant="danger-ghost" disabled={busy} onClick={() => void removeBooking(record)}
            ><Trash2 size={15} /> Löschen</Button
          >{/if}
      </li>{/each}
  </ul>{/if}
