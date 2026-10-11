<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { localDate, weekStart, dateLabel } = useTheaterTime();
  import { initialState } from "@/shared/svelte-runtime";

  import { Check, Clock3, Trash2 } from "@lucide/svelte";
  import type { Member } from "@/shared/contracts";
  import { hours } from "@/shared/client-api";
  import { isStaff } from "@/shared/client-members";
  import { numberDraft, parseNumberDraft } from "@/shared/number-draft";
  import {
    currentWorkingSchedule,
    defaultWorkingDays,
    workingDayLabels,
    type WorkingTimeSchedule,
  } from "@/shared/working-time";
  import { useWorkspace } from "@/components/workspace-context";
  import { Button, ErrorMessage, Modal, Section } from "@/components/ui";
  import { signedHours } from "@/modules/time-tracking/balance";
  import styles from "./working-time-card.module.css";
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
  import { WorkingTimeCard } from "./working-time-card";
  const effects = createEffects();
  type ViewProps = {
    member: Member;
    onSaved: (message: string) => void;
    onSaving: () => void;
  };
  export let member: ViewProps["member"] = undefined as any;
  export let onSaved: ViewProps["onSaved"] = undefined as any;
  export let onSaving: ViewProps["onSaving"] = undefined as any;
  const workspaceStore = useWorkspace();
  let { workspace, action, busy } = $workspaceStore;
  $: ({ workspace, action, busy } = $workspaceStore);
  let admin = workspace.user.role !== "user";
  let saved = member.preferences?.workingTime;
  let configured = Boolean(saved?.schedules.length);
  let schedule = currentWorkingSchedule(saved, localDate()) || saved?.schedules.at(-1);
  let weeklyHours = schedule ? numberDraft(schedule.weeklyMinutes / 60) : "";
  const setWeeklyHours = (
    next: typeof weeklyHours | ((current: typeof weeklyHours) => typeof weeklyHours),
  ) => {
    weeklyHours =
      typeof next === "function"
        ? (next as (current: typeof weeklyHours) => typeof weeklyHours)(weeklyHours)
        : next;
  };
  let days = schedule?.workingDays || [...defaultWorkingDays];
  const setDays = (next: typeof days | ((current: typeof days) => typeof days)) => {
    days =
      typeof next === "function" ? (next as (current: typeof days) => typeof days)(days) : next;
  };
  let effectiveFrom = configured ? localDate() : weekStart();
  const setEffectiveFrom = (
    next: typeof effectiveFrom | ((current: typeof effectiveFrom) => typeof effectiveFrom),
  ) => {
    effectiveFrom =
      typeof next === "function"
        ? (next as (current: typeof effectiveFrom) => typeof effectiveFrom)(effectiveFrom)
        : next;
  };
  let openingHours = numberDraft((saved?.openingBalanceSeconds || 0) / 3600);
  const setOpeningHours = (
    next: typeof openingHours | ((current: typeof openingHours) => typeof openingHours),
  ) => {
    openingHours =
      typeof next === "function"
        ? (next as (current: typeof openingHours) => typeof openingHours)(openingHours)
        : next;
  };
  let error: string = "";
  const setError = (next: typeof error | ((current: typeof error) => typeof error)) => {
    error =
      typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next;
  };
  let deletingSchedule: WorkingTimeSchedule | null = initialState<WorkingTimeSchedule | null>(null);
  const setDeletingSchedule = (
    next:
      | WorkingTimeSchedule
      | null
      | ((current: WorkingTimeSchedule | null) => WorkingTimeSchedule | null),
  ) => {
    deletingSchedule =
      typeof next === "function"
        ? (next as (current: WorkingTimeSchedule | null) => WorkingTimeSchedule | null)(
            deletingSchedule,
          )
        : next;
  };
  let deleteError: string = "";
  const setDeleteError = (
    next: typeof deleteError | ((current: typeof deleteError) => typeof deleteError),
  ) => {
    deleteError =
      typeof next === "function"
        ? (next as (current: typeof deleteError) => typeof deleteError)(deleteError)
        : next;
  };
  let deleting: boolean = false;
  const setDeleting = (next: typeof deleting | ((current: typeof deleting) => typeof deleting)) => {
    deleting =
      typeof next === "function"
        ? (next as (current: typeof deleting) => typeof deleting)(deleting)
        : next;
  };
  let remainingSchedules =
    saved?.schedules
      .filter((row) => row.effectiveFrom !== deletingSchedule?.effectiveFrom)
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)) || [];
  let deletesFirst = Boolean(
    deletingSchedule &&
    saved?.schedules.every((row) => row.effectiveFrom >= (deletingSchedule?.effectiveFrom || "")),
  );

  $: admin = workspace.user.role !== "user";
  $: saved = member.preferences?.workingTime;
  $: configured = Boolean(saved?.schedules.length);
  $: schedule = currentWorkingSchedule(saved, localDate()) || saved?.schedules.at(-1);
  $: remainingSchedules =
    saved?.schedules
      .filter((row) => row.effectiveFrom !== deletingSchedule?.effectiveFrom)
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)) || [];
  $: deletesFirst = Boolean(
    deletingSchedule &&
    saved?.schedules.every((row) => row.effectiveFrom >= (deletingSchedule?.effectiveFrom || "")),
  );
</script>

<form
  class={styles.form}
  on:submit={async (event) => {
    event.preventDefault();
    setError("");
    onSaving();
    try {
      const weekly = parseNumberDraft(weeklyHours, {
        label: "Wochenstunden",
        required: true,
        min: 0,
        max: 168,
      })!;
      const opening = parseNumberDraft(openingHours, {
        label: "Startsaldo",
        fallback: 0,
        min: -100000,
        max: 100000,
      })!;
      if (!days.length) throw new Error("Wähle mindestens einen Soll-Tag pro Woche.");
      await action("profile-update", undefined, {
        ...(member.id !== workspace.user.id ? { memberId: member.id } : {}),
        workingTime: {
          weeklyMinutes: Math.round(weekly * 60),
          workingDays: days,
          effectiveFrom,
          openingBalanceSeconds: Math.round(opening * 3600),
          expectedVersion: saved?.version || 0,
        },
      });
      onSaved("Wochenstunden und Zeitkonto gespeichert.");
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Speichern fehlgeschlagen");
    }
  }}
>
  <p class="small muted">
    Die Anwesenheit wird mit deinen Sollstunden verglichen. Produktionsbuchungen werden dafür nicht
    zusätzlich gezählt.
  </p>
  <div class="form-grid">
    <label>
      Wochenstunden
      <input
        type="number"
        min={0}
        max={168}
        step="any"
        required
        placeholder="z. B. 40"
        value={weeklyHours}
        on:input={(event) => setWeeklyHours(event.currentTarget.value)}
      />
    </label>
    <label>
      {configured ? "Änderung gilt ab" : "Zeitkonto beginnt am"}
      <input
        type="date"
        required
        min={configured ? localDate() : "2000-01-01"}
        max="2200-12-31"
        value={effectiveFrom}
        on:input={(event) => setEffectiveFrom(event.currentTarget.value)}
      />
    </label>
  </div>
  <fieldset class={styles.days}>
    <legend>
      Soll-Tage pro Woche · {days.length}
      {days.length === 1 ? "Tag" : "Tage"}
    </legend>
    <div>
      {#each [1, 2, 3, 4, 5, 6, 0] as day (day)}<label>
          <input
            type="checkbox"
            checked={days.includes(day)}
            on:input={(event) =>
              setDays((previous) =>
                event.currentTarget.checked
                  ? [...previous, day]
                  : previous.filter((value) => value !== day),
              )}
          />
          {workingDayLabels[day]}
        </label>{/each}
    </div>
  </fieldset>
  <p class="small muted">
    Standard: 6 Tage, Montag bis Samstag. Deine Wochenstunden verteilen sich gleichmäßig auf die
    ausgewählten Tage. Soll zählt nur bis einschließlich heute.
  </p>
  <label>
    Startsaldo in Stunden
    <input
      type="number"
      step="any"
      min={-100000}
      max={100000}
      value={openingHours}
      on:input={(event) => setOpeningHours(event.currentTarget.value)}
    />
  </label>
  <p class="small muted">
    Trage vorhandene Plus- oder Minusstunden ein, z. B. 12 oder -4. Vor dem Beginn des Zeitkontos
    entstehen keine fehlenden Stunden. Eine Änderung des Startsaldos korrigiert den Gesamtstand.
  </p>
  <p class={styles.creditNote}>
    Urlaub und Krank füllen die Sollzeit eines Soll-Tages auf. ABF, Ruhetag, halber freier Tag und
    Feiertage erhalten keine automatische Gutschrift.
  </p>
  {#if saved && configured}<details class={styles.history}>
      <summary>
        Bisherige Sollzeiten · Startsaldo {signedHours(saved.openingBalanceSeconds)} h
      </summary>
      <ul>
        {#each saved.schedules as row (row.effectiveFrom)}<li>
            <div class={styles.historyInfo}>
              <strong>Ab {dateLabel(row.effectiveFrom)}</strong>
              <span>
                {hours(row.weeklyMinutes * 60)} h / Woche ·{" "}
                {row.workingDays.map((day) => workingDayLabels[day]).join(", ")}
              </span>
            </div>
            {#if admin}<Button
                variant="danger-ghost"
                disabled={busy}
                onClick={() => {
                  setDeleteError("");
                  setDeletingSchedule(row);
                }}
              >
                <Trash2 size={15} aria-hidden="true"></Trash2>
                Sollzeit löschen
                <span class="visually-hidden">
                  {" "}
                  für {member.name} ab {dateLabel(row.effectiveFrom)}
                </span>
              </Button>{/if}
          </li>{/each}
      </ul>
      <p class="small muted">
        Neue Sollzeiten gelten ab dem gewählten Datum.{" "}
        {admin
          ? "Gespeicherte Einträge kannst du hier einzeln löschen."
          : "Frühere Sollzeiten bleiben erhalten."}
      </p>
    </details>{/if}
  {#if saved && !configured}<p class="small muted">
      Keine Sollzeiten hinterlegt. Lege neue Wochenstunden und einen Beginn fest. Dein Startsaldo
      bleibt erhalten.
    </p>{/if}
  <ErrorMessage message={error}></ErrorMessage>
  <Button type="submit" variant="primary" disabled={busy}>
    <Clock3 size={16}></Clock3>
    {busy ? "Wird gespeichert …" : "Wochenstunden speichern"}
  </Button>
</form>
{#if admin && deletingSchedule && saved}{@const activeSchedule = deletingSchedule}<Modal
    title="Sollzeit löschen?"
    onClose={() => {
      if (!deleting) setDeletingSchedule(null);
    }}
  >
    <div class={styles.deleteConfirmation} aria-busy={deleting}>
      <dl class={styles.deleteSummary}>
        <div>
          <dt>Person</dt>
          <dd>{member.name}</dd>
        </div>
        <div>
          <dt>Gültig ab</dt>
          <dd>{dateLabel(activeSchedule.effectiveFrom)}</dd>
        </div>
        <div>
          <dt>Wochenstunden</dt>
          <dd>{hours(activeSchedule.weeklyMinutes * 60)} h</dd>
        </div>
      </dl>
      <p>
        Das Zeitkonto wird neu berechnet. Die gespeicherten Anwesenheiten und der Startsaldo bleiben
        erhalten.
      </p>
      <p>
        {!remainingSchedules.length
          ? "Danach sind keine Sollzeiten hinterlegt. Plus- und Minusstunden werden erst wieder angezeigt, wenn neue Wochenstunden festgelegt sind."
          : deletesFirst
            ? `Das Zeitkonto beginnt danach am ${dateLabel(remainingSchedules[0].effectiveFrom)}. Vorher wird keine Sollzeit berechnet.`
            : "Die vorherige Sollzeit gilt dann weiter bis zur nächsten hinterlegten Änderung."}
      </p>
      <ErrorMessage message={deleteError}></ErrorMessage>
      <div class={styles.deleteActions}>
        <Button disabled={deleting} onClick={() => setDeletingSchedule(null)}>Abbrechen</Button>
        <Button
          variant="danger-ghost"
          disabled={busy || deleting}
          onClick={async () => {
            setDeleteError("");
            setDeleting(true);
            onSaving();
            try {
              await action("profile-update", undefined, {
                ...(member.id !== workspace.user.id ? { memberId: member.id } : {}),
                workingTimeDelete: {
                  effectiveFrom: activeSchedule.effectiveFrom,
                  expectedVersion: saved.version,
                },
              });
              setDeletingSchedule(null);
              onSaved("Sollzeit gelöscht. Das Zeitkonto wurde neu berechnet.");
            } catch (exception) {
              setDeleteError(
                exception instanceof Error
                  ? exception.message
                  : "Sollzeit konnte nicht gelöscht werden.",
              );
            } finally {
              setDeleting(false);
            }
          }}
        >
          <Trash2 size={16} aria-hidden="true"></Trash2>
          {deleting ? "Wird gelöscht …" : "Sollzeit löschen"}
        </Button>
      </div>
    </div>
  </Modal>{/if}
