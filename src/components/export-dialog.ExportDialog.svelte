<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { localDate } = useTheaterTime();
  import Papa from "papaparse";
  import { Download, Upload } from "@lucide/svelte";
  import type { RecordData, RecordKind } from "@/shared/contracts";
  import { post } from "@/shared/client-api";
  import { Button, ErrorMessage, Modal } from "./ui";
  import { isActiveStaff } from "@/shared/client-members";
  import { useWorkspace } from "./workspace-context";
  import { fields, labels } from "./resource-fields";
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
  import { ImportDialog } from "./export-dialog";
  const effects = createEffects();
  type ViewProps = {
    kind: RecordKind;
    filters?: Record<string, string>;
    onClose: () => void;
  };
  export let kind: ViewProps["kind"] = undefined as any;
  export let filters: NonNullable<ViewProps["filters"]> = {};
  export let onClose: ViewProps["onClose"] = undefined as any;
  const workspaceStore = useWorkspace();
  let { workspace } = $workspaceStore;
  $: ({ workspace } = $workspaceStore);
  let contextTitle = filters.productionId
    ? String(
        workspace.records.productions.find((row) => row.id === filters.productionId)?.data.title ||
          "Produktion",
      )
    : filters.teamOnly === "true"
      ? "Teamboard · ohne Produktion"
      : "";
  let format: string = "pdf";
  const setFormat = (next: typeof format | ((current: typeof format) => typeof format)) => {
    format =
      typeof next === "function"
        ? (next as (current: typeof format) => typeof format)(format)
        : next;
  };
  let from = filters.from || "";
  const setFrom = (next: typeof from | ((current: typeof from) => typeof from)) => {
    from =
      typeof next === "function" ? (next as (current: typeof from) => typeof from)(from) : next;
  };
  let to = filters.to || "";
  const setTo = (next: typeof to | ((current: typeof to) => typeof to)) => {
    to = typeof next === "function" ? (next as (current: typeof to) => typeof to)(to) : next;
  };
  let view = filters.view || "agenda";
  const setView = (next: typeof view | ((current: typeof view) => typeof view)) => {
    view =
      typeof next === "function" ? (next as (current: typeof view) => typeof view)(view) : next;
  };
  let busy: boolean = false;
  const setBusy = (next: typeof busy | ((current: typeof busy) => typeof busy)) => {
    busy =
      typeof next === "function" ? (next as (current: typeof busy) => typeof busy)(busy) : next;
  };
  let error: string = "";
  const setError = (next: typeof error | ((current: typeof error) => typeof error)) => {
    error =
      typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next;
  };
  let download = async () => {
    const requestFormat = format,
      requestKind = kind,
      requestFilters = { ...filters };
    setBusy(true);
    setError("");
    try {
      const query = new URLSearchParams({
        ...filters,
        kind,
        format,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        view,
      });
      const response = await fetch(`/api/export?${query}`, { credentials: "same-origin" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Der Export konnte nicht erstellt werden.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `showtime-${requestFilters.teamOnly === "true" ? "teamboard" : requestKind}-${localDate()}.${requestFormat}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  $: contextTitle = filters.productionId
    ? String(
        workspace.records.productions.find((row) => row.id === filters.productionId)?.data.title ||
          "Produktion",
      )
    : filters.teamOnly === "true"
      ? "Teamboard · ohne Produktion"
      : "";
</script>

<Modal title={`${labels[kind][0]} exportieren`} {onClose}>
  {#if contextTitle}<p class="export-context">
      <strong>{contextTitle}</strong>
    </p>{/if}
  <p class="muted">
    PDF für Ausdrucke, Excel für Auswertungen oder offene Formate zur Weiterverarbeitung. Deine
    aktuellen Filter werden übernommen.
  </p>
  {#if filters.year || filters.season}<p class="export-context">
      {filters.year && `Jahr ${filters.year}`}
      {filters.year && filters.season && " · "}
      {filters.season && `Spielzeit ${filters.season}`}
    </p>{/if}
  <div class="form-grid">
    <label>
      Format
      <select value={format} on:change={(event) => setFormat(event.currentTarget.value)}>
        {#each ["pdf", "xlsx", "csv", "json", ...(kind === "events" ? ["ics"] : [])] as x (x)}<option
            value={x}
          >
            {(
              {
                pdf: "PDF · Drucklayout",
                xlsx: "Excel · XLSX",
                csv: "CSV · Tabelle",
                json: "JSON · Daten",
                ics: "ICS · Kalender",
              } as Record<string, string>
            )[x]}
          </option>{/each}
      </select>
    </label>
    {#if kind === "events"}<label>
        Layout
        <select value={view} on:change={(event) => setView(event.currentTarget.value)}>
          {#each [["month", "Monat"], ["week", "Woche"], ["day", "Tag"], ["agenda", "Agenda"], ["team", "Teamübersicht"], ["team-month", "Teammonat"]] as [key, label] (key)}<option
              value={key}
            >
              {label}
            </option>{/each}
        </select>
      </label>{/if}
    <label>
      Von (optional)
      <input type="date" value={from} on:input={(e) => setFrom(e.currentTarget.value)} />
    </label>
    <label>
      Bis (optional)
      <input type="date" value={to} on:input={(e) => setTo(e.currentTarget.value)} />
    </label>
  </div>
  <ErrorMessage message={error}></ErrorMessage>
  <footer class="dialog-footer">
    <Button onClick={onClose}>Schließen</Button>
    <Button variant="primary" onClick={() => void download()} disabled={busy}>
      <Download size={16}></Download>
      {busy ? "Export wird erstellt …" : "Herunterladen"}
    </Button>
  </footer>
</Modal>
