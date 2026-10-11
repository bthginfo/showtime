<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel } = useTheaterTime();
  import { ArrowRightLeft, Check, ChevronDown, Plus, X } from "@lucide/svelte";
  import type { DomainRecord } from "@/shared/contracts";
  import { listValue, textValue } from "@/shared/contracts";

  import { isActiveStaff } from "@/shared/client-members";
  import { subscribeLocation } from "@/shared/client-storage";
  import { calendarPresentation } from "@/shared/calendar-categories";
  import { occurrences } from "@/modules/calendar/occurrences";
  import { useWorkspace } from "@/components/workspace-context";
  import { Badge, Button, ErrorMessage, ExportButton, Modal } from "@/components/ui";
  import { ExportDialog } from "@/components/export-dialog";
  import { eligibleSwapService, shiftSwapStatusLabels } from "../model";
  import type { ShiftSwapAction, ShiftSwapStatus } from "../schema";
  import styles from "@/modules/workflows/components/workflow.module.css";
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
  import {
    type ServiceOption,
    upcomingServices,
    serviceLabel,
    ShiftSwapEditor,
  } from "./shift-swap-panel";
  const effects = createEffects();
  const workspaceStore = useWorkspace();
  let { workspace, runWorkflow, busy } = $workspaceStore;
  $: ({ workspace, runWorkflow, busy } = $workspaceStore);
  const queryStore = externalStore(
    subscribeLocation,
    () => location.search,
    () => "",
  );
  let query = $queryStore;
  $: query = $queryStore;
  let focusedId = new URLSearchParams(query).get("swapId") || "";
  let creating: boolean = false;
  const setCreating = (next: typeof creating | ((current: typeof creating) => typeof creating)) => {
    creating =
      typeof next === "function"
        ? (next as (current: typeof creating) => typeof creating)(creating)
        : next;
  };
  let showAll: boolean = false;
  const setShowAll = (next: typeof showAll | ((current: typeof showAll) => typeof showAll)) => {
    showAll =
      typeof next === "function"
        ? (next as (current: typeof showAll) => typeof showAll)(showAll)
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
  let admin = workspace.user.role !== "user";
  let requests = [...(workspace.records.shiftSwaps || [])].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id),
  );
  let active = requests.filter((row) =>
    ["awaiting_partner", "awaiting_admin"].includes(textValue(row.data.status)),
  );
  let visible = showAll
    ? requests
    : requests.filter((row) => active.includes(row) || row.id === focusedId);
  let name = (id: unknown) =>
    workspace.members.find((member) => member.id === id)?.name || "Ehemaliges Teammitglied";
  let act = async (record: DomainRecord, action: ShiftSwapAction) => {
    setError("");
    if (
      ["decline", "reject", "withdraw"].includes(action) &&
      !confirm(
        action === "withdraw"
          ? "Diese Tauschanfrage zurückziehen?"
          : "Diese Tauschanfrage ablehnen?",
      )
    )
      return;
    try {
      await runWorkflow(`/api/shift-swaps/${record.id}`, { action, version: record.version });
    } catch (exception) {
      setError(
        exception instanceof Error
          ? exception.message
          : "Die Anfrage konnte nicht bearbeitet werden.",
      );
    }
  };

  $: focusedId = new URLSearchParams(query).get("swapId") || "";
  $: admin = workspace.user.role !== "user";
  $: requests = [...(workspace.records.shiftSwaps || [])].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id),
  );
  $: active = requests.filter((row) =>
    ["awaiting_partner", "awaiting_admin"].includes(textValue(row.data.status)),
  );
  $: visible = showAll
    ? requests
    : requests.filter((row) => active.includes(row) || row.id === focusedId);
</script>

<details class={styles.disclosure} open={focusedId ? true : undefined}>
  <summary class={styles.summary}>
    <ArrowRightLeft size={17}></ArrowRightLeft>
    <span>Diensttausch</span>
    {#if active.length > 0}<Badge>{active.length} offen</Badge>{/if}
    <ChevronDown size={16}></ChevronDown>
  </summary>
  <div class={styles.body}>
    <div class={styles.filters}>
      <label class="small">
        Anfragen{" "}
        <select
          value={showAll ? "all" : "open"}
          on:change={(event) => setShowAll(event.currentTarget.value === "all")}
        >
          <option value="open">Offene Anfragen</option>
          <option value="all">Alle Anfragen</option>
        </select>
      </label>
      <div class={styles.actions}>
        {#if requests.length > 0}<ExportButton onClick={() => setExporting(true)}
          ></ExportButton>{/if}
        {#if workspace.user.role !== "superadmin"}<Button onClick={() => setCreating(true)}>
            <Plus size={15}></Plus>
            Tausch anfragen
          </Button>{/if}
      </div>
    </div>
    {#if !visible.length}<p class={styles.empty}>
        Keine offenen Anfragen. Wähle einen zukünftigen Dienst, frage eine Kollegin an und warte
        anschließend auf die Adminfreigabe.
      </p>{/if}
    <div class={styles.list}>
      {#each visible as record (record.id)}{@const status = textValue(
          record.data.status,
        ) as ShiftSwapStatus}{@const partner =
          record.data.partnerId === workspace.user.id}{@const requester =
          record.data.requesterId === workspace.user.id}
        <article class={`${styles.row} ${record.id === focusedId ? styles.focused : ""}`}>
          <div class={styles.rowHeading}>
            <div>
              <h4>
                {name(record.data.requesterId)} → {name(record.data.partnerId)}
              </h4>
              <span class={styles.note}>{dateLabel(record.createdAt, true)}</span>
            </div>
            <Badge
              tone={status === "approved"
                ? "success"
                : ["declined", "rejected", "withdrawn"].includes(status)
                  ? "neutral"
                  : "warning"}
            >
              {shiftSwapStatusLabels[status] || status}
            </Badge>
          </div>
          <div class={styles.swapTimes}>
            <div>
              <strong>
                {name(record.data.partnerId)} übernimmt: {textValue(record.data.serviceTitle)}
              </strong>
              <time>
                {dateLabel(textValue(record.data.serviceStart), true)} –{" "}
                {dateLabel(textValue(record.data.serviceEnd), true)}
              </time>
            </div>
            {#if !!record.data.counterServiceId}<div>
                <strong>
                  {name(record.data.requesterId)} übernimmt:{" "}
                  {textValue(record.data.counterServiceTitle)}
                </strong>
                <time>
                  {dateLabel(textValue(record.data.counterServiceStart), true)} –{" "}
                  {dateLabel(textValue(record.data.counterServiceEnd), true)}
                </time>
              </div>{/if}
          </div>
          {#if !!record.data.note}<p class={styles.note}>{String(record.data.note)}</p>{/if}
          {#if status === "awaiting_partner"}<p class={styles.note}>
              Der Kalender bleibt unverändert, bis die Kollegin zugestimmt und ein Admin den Tausch
              freigegeben hat.
            </p>{/if}
          {#if status === "awaiting_admin"}<p class={styles.note}>
              Die Kollegin hat zugestimmt. Jetzt fehlt noch die Adminfreigabe.
            </p>{/if}
          {#if status === "approved"}<p class={styles.note}>
              Der Tausch wurde im Kalender eingetragen. Bei Serien wurde nur dieser einzelne Termin
              geändert.
            </p>{/if}
          <div class={styles.actions}>
            {#if partner && status === "awaiting_partner"}
              <Button variant="primary" disabled={busy} onClick={() => void act(record, "accept")}>
                <Check size={14}></Check>
                Zustimmen
              </Button>
              <Button disabled={busy} onClick={() => void act(record, "decline")}>
                <X size={14}></X>
                Ablehnen
              </Button>
            {/if}
            {#if admin && status === "awaiting_admin"}
              <Button variant="primary" disabled={busy} onClick={() => void act(record, "approve")}>
                <Check size={14}></Check>
                Tausch freigeben
              </Button>
              <Button disabled={busy} onClick={() => void act(record, "reject")}>
                <X size={14}></X>
                Nicht freigeben
              </Button>
            {/if}
            {#if requester && ["awaiting_partner", "awaiting_admin"].includes(status)}<Button
                disabled={busy}
                onClick={() => void act(record, "withdraw")}
              >
                Zurückziehen
              </Button>{/if}
          </div>
        </article>{/each}
    </div>
    <ErrorMessage message={error}></ErrorMessage>
  </div>
  {#if creating}<ShiftSwapEditor onClose={() => setCreating(false)}></ShiftSwapEditor>{/if}
  {#if exporting}<ExportDialog kind="shiftSwaps" onClose={() => setExporting(false)}
    ></ExportDialog>{/if}
</details>
