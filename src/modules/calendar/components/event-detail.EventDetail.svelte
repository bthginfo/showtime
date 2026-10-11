<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel, instantDate, localDate } = useTheaterTime();
  import { LinkedText } from "@/components/linked-text";
  import { Clock3, MapPin, Pencil, Trash2, Users } from "@lucide/svelte";
  import type { DomainRecord } from "@/shared/contracts";
  import { calendarPresentation } from "@/shared/calendar-categories";
  import { ids, shiftDate, value } from "@/shared/client-api";
  import { useWorkspace } from "@/components/workspace-context";
  import { Badge, Button, ErrorMessage, ExportButton, Modal } from "@/components/ui";
  import { ExportDialog } from "@/components/export-dialog";
  import { TimeBookingEditor } from "@/modules/time-tracking/components/time-booking-editor";
  import { EventEditor } from "./event-editor";
  import { canManageRecord } from "@/shared/record-permissions";
  import { RecordLink } from "@/components/record-link";
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
    record: DomainRecord;
    onClose: () => void;
    onNavigate?: () => void;
  };
  export let record: ViewProps["record"] = undefined as any;
  export let onClose: ViewProps["onClose"] = undefined as any;
  export let onNavigate: NonNullable<ViewProps["onNavigate"]> = onClose;
  const workspaceStore = useWorkspace();
  let { workspace, remove, busy } = $workspaceStore;
  $: ({ workspace, remove, busy } = $workspaceStore);
  let editing: boolean = false;
  const setEditing = (next: typeof editing | ((current: typeof editing) => typeof editing)) => {
    editing =
      typeof next === "function"
        ? (next as (current: typeof editing) => typeof editing)(editing)
        : next;
  };
  let booking: boolean = false;
  const setBooking = (next: typeof booking | ((current: typeof booking) => typeof booking)) => {
    booking =
      typeof next === "function"
        ? (next as (current: typeof booking) => typeof booking)(booking)
        : next;
  };
  let exporting: boolean = false;
  const setExporting = (
    next: typeof exporting | ((current: typeof exporting) => typeof exporting),
  ) => {
    exporting =
      typeof next === "function"
        ? (next as (current: typeof exporting) => typeof exporting)(exporting)
        : next;
  };
  let error: string = "";
  const setError = (next: typeof error | ((current: typeof error) => typeof error)) => {
    error =
      typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next;
  };
  let current: any = workspace.records.events.find((row) => row.id === record.id) || record;
  let presentation = calendarPresentation(
    current,
    workspace.records.productions,
    workspace.records.calendarCategories,
  );
  let canEdit = canManageRecord(workspace.user, "events", current);
  let production = workspace.records.productions.find(
    (row) => row.id === current.data.productionId,
  );
  let endDay = shiftDate(localDate(instantDate(value(current.data, "end"))), -1);

  $: current = workspace.records.events.find((row) => row.id === record.id) || record;
  $: presentation = calendarPresentation(
    current,
    workspace.records.productions,
    workspace.records.calendarCategories,
  );
  $: canEdit = canManageRecord(workspace.user, "events", current);
  $: production = workspace.records.productions.find((row) => row.id === current.data.productionId);
  $: endDay = shiftDate(localDate(instantDate(value(current.data, "end"))), -1);
</script>

{#if editing}<EventEditor record={current} onClose={() => setEditing(false)}
  ></EventEditor>{:else}<Modal title={presentation.title} {onClose} wide>
    <div class="detail-actions">
      <Badge>
        {presentation.categoryName}
        {presentation.allDay ? " · ganztägig" : ""}
      </Badge>
      {#if canEdit}<Button onClick={() => setEditing(true)}>
          <Pencil size={15}></Pencil>
          Bearbeiten
        </Button>{/if}
      <ExportButton onClick={() => setExporting(true)}></ExportButton>
      {#if canEdit}<Button
          variant="danger-ghost"
          disabled={busy}
          onClick={() => {
            if (confirm(`Termin „${presentation.title}“ löschen?`)) {
              setError("");
              void remove(current)
                .then(onClose)
                .catch((exception) =>
                  setError(
                    exception instanceof Error ? exception.message : "Löschen fehlgeschlagen",
                  ),
                );
            }
          }}
        >
          <Trash2 size={15}></Trash2>
          Löschen
        </Button>{/if}
    </div>
    <dl class="detail-grid event-detail-grid">
      <div>
        <dt>
          <Clock3 size={14}></Clock3>
          Zeitraum
        </dt>
        <dd>
          {presentation.allDay
            ? `${dateLabel(localDate(instantDate(value(current.data, "start"))))} – ${dateLabel(endDay)} · ganztägig`
            : `${dateLabel(value(current.data, "start"), true)} – ${dateLabel(value(current.data, "end"), true)}`}
        </dd>
      </div>
      <div>
        <dt>Produktion</dt>
        <dd>
          {#if production}<RecordLink record={production} from={current} {onNavigate}>
              {value(production.data, "title")}
            </RecordLink>{:else}{"Ohne Produktion"}{/if}
        </dd>
      </div>
      <div>
        <dt>
          <MapPin size={14}></MapPin>
          Ort
        </dt>
        <dd>
          <LinkedText text={value(current.data, "location") || "Noch kein Ort eingetragen"}
          ></LinkedText>
        </dd>
      </div>
      <div>
        <dt>
          <Users size={14}></Users>
          Personen
        </dt>
        <dd>
          {ids(current.data, "participantIds")
            .map(
              (id) =>
                workspace.members.find((member) => member.id === id)?.name ||
                "Ehemaliges Teammitglied",
            )
            .join(", ") || "Gäste/Aushilfen"}
        </dd>
      </div>
    </dl>
    {#if presentation.background}<p class="help-note">
        {presentation.background === "service"
          ? "Arbeitszeit im Hintergrund. Weitere Termine können innerhalb dieses Dienstes liegen. Zum Ändern nutze Bearbeiten."
          : "Hinweis auf einen halben freien Tag. Weitere Termine bleiben möglich."}
      </p>{/if}
    {#if !!current.data.recurrence && current.data.recurrence !== "none"}<p class="help-note">
        Terminserie · {current.data.recurrence === "weekly" ? "wöchentlich" : "täglich"} bis{" "}
        {dateLabel(value(current.data, "until"))}. Die Bearbeitung ändert die ganze Serie.
      </p>{/if}
    {#if !!current.data.leaveId}<p class="help-note">
        Dieser Termin gehört zu einem genehmigten Freiwunsch. Änderungen laufen über die
        Freiwunschverwaltung.
      </p>{/if}
    <ErrorMessage message={error}></ErrorMessage>
    <footer class="dialog-footer">
      {#if workspace.user.role !== "superadmin"}<Button onClick={() => setBooking(true)}
          >Tatsächliche Arbeitszeit buchen</Button
        >{/if}
      <Button onClick={onClose}>Schließen</Button>
    </footer>
  </Modal>{/if}
{#if booking}<TimeBookingEditor
    defaults={{
      title: presentation.title,
      productionId: value(current.data, "productionId"),
      date: localDate(),
      category: current.data.productionId ? "production" : "other",
    }}
    onClose={() => setBooking(false)}
  ></TimeBookingEditor>{/if}{" "}
{#if exporting}<ExportDialog
    kind="events"
    filters={{ id: current.id }}
    onClose={() => setExporting(false)}
  ></ExportDialog>{/if}
