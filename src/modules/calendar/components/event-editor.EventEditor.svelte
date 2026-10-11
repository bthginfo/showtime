<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { localDate } = useTheaterTime();
  import { theaterDateTime, theaterInstant } from "@/shared/theater-time";
  import type { DomainRecord, RecordData } from "@/shared/contracts";
  import { ids, shiftDate, value } from "@/shared/client-api";
  import { isActiveStaff } from "@/shared/client-members";
  import { calendarPresentation } from "@/shared/calendar-categories";
  import { calendarCategoryBehavior } from "@/shared/calendar-categories";
  import { sortCalendarStaff } from "@/shared/calendar-team";
  import { sortProductionsByPremiere } from "@/shared/production-order";
  import { useWorkspace } from "@/components/workspace-context";
  import { Button, ErrorMessage, Modal } from "@/components/ui";
  import { calendarCategories } from "./client-calendar";
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
  const localDateTime = (value: string) =>
    theaterDateTime(value, workspace.timezone || "Europe/Berlin");
  const instantDate = (value: string) => {
    const converted = theaterInstant(value.slice(0, 16), workspace.timezone || "Europe/Berlin");
    if (!converted) throw Error("Diese Ortszeit ist ungültig. Prüfe die Zeitumstellung.");
    return new Date(converted);
  };
  type ViewProps = {
    record?: DomainRecord;
    defaults?: RecordData;
    lockedProductionId?: string;
    onClose: () => void;
    onSaved?: (record: DomainRecord) => void;
  };
  export let record: ViewProps["record"] = undefined as any;
  export let defaults: NonNullable<ViewProps["defaults"]> = {};
  export let lockedProductionId: ViewProps["lockedProductionId"] = undefined as any;
  export let onClose: ViewProps["onClose"] = undefined as any;
  export let onSaved: ViewProps["onSaved"] = undefined as any;
  const workspaceStore = useWorkspace();
  let { workspace, save, busy } = $workspaceStore;
  $: ({ workspace, save, busy } = $workspaceStore);
  let initial = { ...defaults, ...record?.data };
  let options = calendarCategories(workspace);
  let initialCategory = value(initial, "category") || options[0]?.key || "";
  let originalAllDay = record
    ? calendarPresentation(
        record,
        workspace.records.productions,
        workspace.records.calendarCategories,
      ).allDay
    : options.find((option) => option.key === initialCategory)?.allDay;
  let today = localDate();
  let initialStart = initial.start ? localDateTime(String(initial.start)) : `${today}T09:00`;
  let initialEnd = initial.end ? localDateTime(String(initial.end)) : `${today}T17:00`;
  let title = value(initial, "title");
  const setTitle = (next: typeof title | ((current: typeof title) => typeof title)) => {
    title =
      typeof next === "function" ? (next as (current: typeof title) => typeof title)(title) : next;
  };
  let category = initialCategory;
  const setCategory = (next: typeof category | ((current: typeof category) => typeof category)) => {
    category =
      typeof next === "function"
        ? (next as (current: typeof category) => typeof category)(category)
        : next;
  };
  let start = initialStart;
  const setStart = (next: typeof start | ((current: typeof start) => typeof start)) => {
    start =
      typeof next === "function" ? (next as (current: typeof start) => typeof start)(start) : next;
  };
  let end = initialEnd;
  const setEnd = (next: typeof end | ((current: typeof end) => typeof end)) => {
    end = typeof next === "function" ? (next as (current: typeof end) => typeof end)(end) : next;
  };
  let from = initialStart.slice(0, 10);
  const setFrom = (next: typeof from | ((current: typeof from) => typeof from)) => {
    from =
      typeof next === "function" ? (next as (current: typeof from) => typeof from)(from) : next;
  };
  let to =
    originalAllDay && record ? shiftDate(initialEnd.slice(0, 10), -1) : initialEnd.slice(0, 10);
  const setTo = (next: typeof to | ((current: typeof to) => typeof to)) => {
    to = typeof next === "function" ? (next as (current: typeof to) => typeof to)(to) : next;
  };
  let production = lockedProductionId ?? value(initial, "productionId");
  const setProduction = (
    next: typeof production | ((current: typeof production) => typeof production),
  ) => {
    production =
      typeof next === "function"
        ? (next as (current: typeof production) => typeof production)(production)
        : next;
  };
  let admin = workspace.user.role !== "user";
  let people = admin ? ids(initial, "participantIds") : [workspace.user.id];
  const setPeople = (next: typeof people | ((current: typeof people) => typeof people)) => {
    people =
      typeof next === "function"
        ? (next as (current: typeof people) => typeof people)(people)
        : next;
  };
  let location = value(initial, "location");
  const setLocation = (next: typeof location | ((current: typeof location) => typeof location)) => {
    location =
      typeof next === "function"
        ? (next as (current: typeof location) => typeof location)(location)
        : next;
  };
  let recurrence = value(initial, "recurrence") || "none";
  const setRecurrence = (
    next: typeof recurrence | ((current: typeof recurrence) => typeof recurrence),
  ) => {
    recurrence =
      typeof next === "function"
        ? (next as (current: typeof recurrence) => typeof recurrence)(recurrence)
        : next;
  };
  let until = value(initial, "until");
  const setUntil = (next: typeof until | ((current: typeof until) => typeof until)) => {
    until =
      typeof next === "function" ? (next as (current: typeof until) => typeof until)(until) : next;
  };
  let exceptions = ids(initial, "exceptions").join("\n");
  const setExceptions = (
    next: typeof exceptions | ((current: typeof exceptions) => typeof exceptions),
  ) => {
    exceptions =
      typeof next === "function"
        ? (next as (current: typeof exceptions) => typeof exceptions)(exceptions)
        : next;
  };
  let error: string = "";
  const setError = (next: typeof error | ((current: typeof error) => typeof error)) => {
    error =
      typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next;
  };
  let selected = options.find((option) => option.key === category);
  let allDay = selected?.allDay === true;
  let suggestedTitle =
    value(
      workspace.records.productions.find((row) => row.id === production)?.data || {},
      "title",
    ) ||
    selected?.name ||
    "Termin";
  let members = sortCalendarStaff(
    workspace.members.filter(
      (member) =>
        (admin || member.id === workspace.user.id) &&
        (isActiveStaff(member) || people.includes(member.id)),
    ),
  );
  let productions = sortProductionsByPremiere(workspace.records.productions);
  let behavior = calendarCategoryBehavior(category, selected);

  $: initial = { ...defaults, ...record?.data };
  $: options = calendarCategories(workspace);
  $: initialCategory = value(initial, "category") || options[0]?.key || "";
  $: originalAllDay = record
    ? calendarPresentation(
        record,
        workspace.records.productions,
        workspace.records.calendarCategories,
      ).allDay
    : options.find((option) => option.key === initialCategory)?.allDay;
  $: today = localDate();
  $: initialStart = initial.start ? localDateTime(String(initial.start)) : `${today}T09:00`;
  $: initialEnd = initial.end ? localDateTime(String(initial.end)) : `${today}T17:00`;
  $: admin = workspace.user.role !== "user";
  $: selected = options.find((option) => option.key === category);
  $: allDay = selected?.allDay === true;
  $: suggestedTitle =
    value(
      workspace.records.productions.find((row) => row.id === production)?.data || {},
      "title",
    ) ||
    selected?.name ||
    "Termin";
  $: members = sortCalendarStaff(
    workspace.members.filter(
      (member) =>
        (admin || member.id === workspace.user.id) &&
        (isActiveStaff(member) || people.includes(member.id)),
    ),
  );
  $: productions = sortProductionsByPremiere(workspace.records.productions);
  $: behavior = calendarCategoryBehavior(category, selected);
</script>

<Modal title={`Termin ${record ? "bearbeiten" : "anlegen"}`} {onClose} wide>
  <form
    class="event-form"
    on:submit={async (event) => {
      event.preventDefault();
      setError("");
      try {
        if (!selected)
          throw new Error("Bitte lege zuerst eine Kalenderart an oder wähle eine vorhandene aus.");
        if (record?.data.leaveId)
          throw new Error(
            "Dieser Eintrag gehört zu einem genehmigten Freiwunsch. Bitte nutze den Freiwunschablauf.",
          );
        const startDate = instantDate(allDay ? `${from}T00:00:00` : start),
          endDate = instantDate(allDay ? `${shiftDate(to, 1)}T00:00:00` : end);
        if (
          !Number.isFinite(startDate.getTime()) ||
          !Number.isFinite(endDate.getTime()) ||
          endDate <= startDate ||
          (allDay && to < from)
        )
          throw new Error("Das Ende muss nach dem Beginn liegen.");
        const exceptionDays = exceptions
          .split("\n")
          .map((day) => day.trim())
          .filter(Boolean);
        if (exceptionDays.some((day) => !/^\d{4}-\d{2}-\d{2}$/.test(day)))
          throw new Error("Trage Ausnahmen als Datum im Format JJJJ-MM-TT ein.");
        const saved = await save(
          "events",
          {
            title: title.trim(),
            category,
            allDay,
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            productionId: production,
            participantIds: people,
            location: location.trim(),
            recurrence,
            until: recurrence === "none" ? "" : until,
            exceptions: recurrence === "none" ? [] : exceptionDays,
          },
          record,
        );
        onSaved?.(saved);
        onClose();
      } catch (exception) {
        setError(exception instanceof Error ? exception.message : "Speichern fehlgeschlagen");
      }
    }}
  >
    <p class="muted booking-intro">
      Lass den Titel leer, um die Produktion oder Kalenderart anzuzeigen.{" "}
      {record?.data.recurrence && record.data.recurrence !== "none"
        ? "Änderungen betreffen die ganze Terminserie."
        : ""}
    </p>
    <label>
      Titel (optional)
      <input
        maxLength={200}
        value={title}
        placeholder={suggestedTitle}
        on:input={(event) => setTitle(event.currentTarget.value)}
      />
    </label>
    <div class="form-grid">
      <label>
        Kalenderart
        <select
          required
          value={category}
          on:change={(event) => {
            const next = options.find((option) => option.key === event.currentTarget.value);
            if (next?.allDay && !allDay) {
              setFrom(start.slice(0, 10));
              setTo(end.slice(0, 10));
            }
            if (!next?.allDay && allDay) {
              setStart(`${from}T09:00`);
              setEnd(`${to}T17:00`);
            }
            setCategory(event.currentTarget.value);
          }}
        >
          <option value="">Bitte auswählen</option>
          {#if !selected && category}<option value={category} disabled>
              Bisherige Art · bitte neu wählen
            </option>{/if}
          {#each options as option (option.key)}<option value={option.key}>
              {option.name}
              {option.allDay ? " · ganztägig" : ""}
            </option>{/each}
        </select>
      </label>
      <label>
        Produktion
        <select
          aria-label="Produktion"
          disabled={lockedProductionId !== undefined}
          value={production}
          on:change={(event) => setProduction(event.currentTarget.value)}
        >
          <option value="">Ohne Produktion</option>
          {#each productions as row (row.id)}<option value={row.id}>
              {value(row.data, "title")}
            </option>{/each}
        </select>
      </label>
    </div>
    {#if behavior.background}<p class="help-note">
        {behavior.background === "service"
          ? "Arbeitszeit im Hintergrund · weitere Termine können innerhalb dieses Dienstes liegen."
          : "Freier halber Tag als Hinweis · weitere Termine bleiben möglich."}
      </p>{/if}
    {#if allDay}<p class="event-all-day-note">
        <span style={styleString({ background: selected?.color })}></span>
        Ganztägig · keine Uhrzeiten nötig. Der letzte Tag ist eingeschlossen.
      </p>{/if}
    <div class="form-grid">
      {#if allDay}
        <label>
          Von
          <input
            type="date"
            required
            value={from}
            on:input={(event) => setFrom(event.currentTarget.value)}
          />
        </label>
        <label>
          Bis (einschließlich)
          <input
            type="date"
            required
            min={from}
            value={to}
            on:input={(event) => setTo(event.currentTarget.value)}
          />
        </label>
      {:else}
        <label>
          Beginn
          <input
            type="datetime-local"
            required
            value={start}
            on:input={(event) => setStart(event.currentTarget.value)}
          />
        </label>
        <label>
          Ende
          <input
            type="datetime-local"
            required
            min={start}
            value={end}
            on:input={(event) => setEnd(event.currentTarget.value)}
          />
        </label>
      {/if}
    </div>
    <fieldset class="form-multi">
      <legend>Personen</legend>
      {#each members as member (member.id)}<label class="check-label">
          <input
            type="checkbox"
            disabled={!admin}
            checked={people.includes(member.id)}
            on:input={(event) =>
              setPeople(
                event.currentTarget.checked
                  ? [...people, member.id]
                  : people.filter((id) => id !== member.id),
              )}
          />
          {member.name}
          {#if !isActiveStaff(member)}<span class="small muted">
              · historische Zuordnung (entfernen)</span
            >{/if}
        </label>{/each}
      {#if !members.length}<p class="small muted">Keine aktiven Teammitglieder verfügbar.</p>{/if}
      {#if !admin}<p class="small muted">
          Du planst deinen eigenen Kalender. Einträge für andere Personen übernehmen Admins.
        </p>{/if}
      {#if admin}<p class="small muted">
          Ohne ausgewählte Person erscheint der Termin unter Gäste/Aushilfen.
        </p>{/if}
    </fieldset>
    <label>
      Ort
      <input
        maxLength={200}
        value={location}
        on:input={(event) => setLocation(event.currentTarget.value)}
      />
    </label>
    <div class="form-grid">
      <label>
        Wiederholung
        <select value={recurrence} on:change={(event) => setRecurrence(event.currentTarget.value)}>
          <option value="none">Keine</option>
          <option value="daily">Täglich</option>
          <option value="weekly">Wöchentlich</option>
        </select>
      </label>
      {#if recurrence !== "none"}<label>
          Wiederholen bis
          <input
            type="date"
            required
            min={allDay ? from : start.slice(0, 10)}
            value={until}
            on:input={(event) => setUntil(event.currentTarget.value)}
          />
        </label>{/if}
    </div>
    {#if recurrence !== "none"}<label>
        Ausnahmen (ein Datum je Zeile)
        <textarea
          rows={3}
          placeholder="2026-12-24"
          value={exceptions}
          on:input={(event) => setExceptions(event.currentTarget.value)}></textarea>
      </label>{/if}
    <ErrorMessage message={error}></ErrorMessage>
    <footer class="dialog-footer">
      <Button onClick={onClose}>Abbrechen</Button>
      <Button
        type="submit"
        variant="primary"
        disabled={busy || !selected || !!record?.data.leaveId}
      >
        Speichern
      </Button>
    </footer>
  </form>
</Modal>
