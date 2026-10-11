<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel, instantDate, localDate, localDateTime } = useTheaterTime();
  import { CalendarRange, Pencil, Plus, Trash2, X } from "@lucide/svelte";
  import type { DomainRecord } from "@/shared/contracts";
  import { numberValue, textValue } from "@/shared/contracts";
  import { post, shiftDate } from "@/shared/client-api";
  import { numberDraft, parseNumberDraft } from "@/shared/number-draft";
  import { canManageRecord } from "@/shared/record-permissions";
  import { useWorkspace } from "@/components/workspace-context";
  import { Badge, Button, ErrorMessage, ExportButton, Modal } from "@/components/ui";
  import { ExportDialog } from "@/components/export-dialog";
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
  import { MaterialReservations } from "./material-reservations";
  const effects = createEffects();
  type ViewProps = {
    material: DomainRecord;
    record?: DomainRecord;
    onClose: () => void;
  };
  export let material: ViewProps["material"] = undefined as any;
  export let record: ViewProps["record"] = undefined as any;
  export let onClose: ViewProps["onClose"] = undefined as any;
  const workspaceStore = useWorkspace();
  let { workspace, save, busy } = $workspaceStore;
  $: ({ workspace, save, busy } = $workspaceStore);
  let start = record ? localDateTime(textValue(record.data.start)) : `${localDate()}T09:00`;
  const setStart = (next: typeof start | ((current: typeof start) => typeof start)) => {
    start =
      typeof next === "function" ? (next as (current: typeof start) => typeof start)(start) : next;
  };
  let end = record
    ? localDateTime(textValue(record.data.end))
    : `${shiftDate(localDate(), 1)}T18:00`;
  const setEnd = (next: typeof end | ((current: typeof end) => typeof end)) => {
    end = typeof next === "function" ? (next as (current: typeof end) => typeof end)(end) : next;
  };
  let quantity = numberDraft(record?.data.quantity, 1);
  const setQuantity = (next: typeof quantity | ((current: typeof quantity) => typeof quantity)) => {
    quantity =
      typeof next === "function"
        ? (next as (current: typeof quantity) => typeof quantity)(quantity)
        : next;
  };
  let productionId = textValue(record?.data.productionId);
  const setProductionId = (
    next: typeof productionId | ((current: typeof productionId) => typeof productionId),
  ) => {
    productionId =
      typeof next === "function"
        ? (next as (current: typeof productionId) => typeof productionId)(productionId)
        : next;
  };
  let actorId = textValue(record?.data.actorId);
  const setActorId = (next: typeof actorId | ((current: typeof actorId) => typeof actorId)) => {
    actorId =
      typeof next === "function"
        ? (next as (current: typeof actorId) => typeof actorId)(actorId)
        : next;
  };
  let purpose = textValue(record?.data.purpose);
  const setPurpose = (next: typeof purpose | ((current: typeof purpose) => typeof purpose)) => {
    purpose =
      typeof next === "function"
        ? (next as (current: typeof purpose) => typeof purpose)(purpose)
        : next;
  };
  let notes = textValue(record?.data.notes);
  const setNotes = (next: typeof notes | ((current: typeof notes) => typeof notes)) => {
    notes =
      typeof next === "function" ? (next as (current: typeof notes) => typeof notes)(notes) : next;
  };
  let status = textValue(record?.data.status, "reserved");
  const setStatus = (next: typeof status | ((current: typeof status) => typeof status)) => {
    status =
      typeof next === "function"
        ? (next as (current: typeof status) => typeof status)(status)
        : next;
  };
  let preview: {
    available: number;
    sufficient: boolean;
  } | null = null;
  const setPreview = (
    next:
      | {
          available: number;
          sufficient: boolean;
        }
      | null
      | ((
          current: {
            available: number;
            sufficient: boolean;
          } | null,
        ) => {
          available: number;
          sufficient: boolean;
        } | null),
  ) => {
    preview =
      typeof next === "function"
        ? (
            next as (
              current: {
                available: number;
                sufficient: boolean;
              } | null,
            ) => {
              available: number;
              sufficient: boolean;
            } | null
          )(preview)
        : next;
  };
  let checking: boolean = false;
  const setChecking = (next: typeof checking | ((current: typeof checking) => typeof checking)) => {
    checking =
      typeof next === "function"
        ? (next as (current: typeof checking) => typeof checking)(checking)
        : next;
  };
  let error: string = "";
  const setError = (next: typeof error | ((current: typeof error) => typeof error)) => {
    error =
      typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next;
  };
  let data = () => {
    const amount = parseNumberDraft(quantity, {
      label: "die Menge",
      required: true,
      min: 0.001,
      max: 1000000,
    })!;
    if (!start || !end || instantDate(end) <= instantDate(start))
      throw new Error("Bitte prüfe den Zeitraum. Das Ende muss nach dem Beginn liegen.");
    return {
      materialId: material.id,
      quantity: amount,
      start: instantDate(start).toISOString(),
      end: instantDate(end).toISOString(),
      productionId,
      actorId,
      purpose,
      notes,
      status,
    };
  };
  let check = async () => {
    setChecking(true);
    setError("");
    try {
      setPreview(
        await post("/api/reservations/availability", {
          ...data(),
          ...(record ? { excludeId: record.id } : {}),
        }),
      );
    } catch (exception) {
      setError(
        exception instanceof Error
          ? exception.message
          : "Verfügbarkeit konnte nicht geprüft werden.",
      );
    } finally {
      setChecking(false);
    }
  };
  let clearPreview = () => setPreview(null);
</script>

<Modal
  title={record ? "Reservierung bearbeiten" : "Artikel reservieren"}
  onClose={busy ? () => {} : onClose}
>
  <form
    class={styles.form}
    on:submit={async (event) => {
      event.preventDefault();
      setError("");
      try {
        await save("reservations", data(), record);
        onClose();
      } catch (exception) {
        setError(
          exception instanceof Error
            ? exception.message
            : "Reservierung konnte nicht gespeichert werden.",
        );
      }
    }}
  >
    <p>
      <strong>{textValue(material.data.name)}</strong>
      <br />
      <span class={styles.note}>
        Bestand: {numberValue(material.data.quantity).toLocaleString("de-DE")}
      </span>
    </p>
    <div class="form-grid">
      <label>
        Menge
        <input
          required
          type="number"
          min="0.001"
          step="any"
          inputMode="decimal"
          value={quantity}
          on:input={(event) => {
            setQuantity(event.currentTarget.value);
            clearPreview();
          }}
        />
      </label>
      {#if record?.data.status === "cancelled"}<label>
          Reservierung
          <select
            value={status}
            on:change={(event) => {
              setStatus(event.currentTarget.value);
              clearPreview();
            }}
          >
            <option value="cancelled">Aufgehoben</option>
            <option value="reserved">Wieder reservieren</option>
          </select>
        </label>{/if}
      <label>
        Von
        <input
          required
          type="datetime-local"
          value={start}
          on:input={(event) => {
            const oldDay = start.slice(0, 10);
            const next = event.currentTarget.value;
            setStart(next);
            if (end.slice(0, 10) === oldDay || instantDate(end) <= instantDate(next))
              setEnd(`${next.slice(0, 10)}T${end.slice(11) || "18:00"}`);
            clearPreview();
          }}
        />
      </label>
      <label>
        Bis
        <input
          required
          type="datetime-local"
          value={end}
          on:input={(event) => {
            setEnd(event.currentTarget.value);
            clearPreview();
          }}
        />
      </label>
      <label>
        Produktion · optional
        <select
          value={productionId}
          on:change={(event) => setProductionId(event.currentTarget.value)}
        >
          <option value="">Ohne Produktion</option>
          {#each workspace.records.productions as row (row.id)}<option value={row.id}>
              {textValue(row.data.title)}
            </option>{/each}
        </select>
      </label>
      <label>
        Schauspielperson · optional
        <select value={actorId} on:change={(event) => setActorId(event.currentTarget.value)}>
          <option value="">Keine Person</option>
          {#each workspace.records.actors as row (row.id)}<option value={row.id}>
              {textValue(row.data.name)}
            </option>{/each}
        </select>
      </label>
      <label class="field-wide">
        Verwendung · optional
        <input
          maxLength={200}
          value={purpose}
          on:input={(event) => setPurpose(event.currentTarget.value)}
          placeholder="z. B. Anprobe oder Vorbereitung"
        />
      </label>
      <label class="field-wide">
        Hinweise · optional
        <textarea
          rows={3}
          maxLength={20000}
          value={notes}
          on:input={(event) => setNotes(event.currentTarget.value)}></textarea>
      </label>
    </div>
    <div class={styles.availability}>
      <p class={styles.note}>
        {preview
          ? `Für den Zeitraum verfügbar: ${preview.available.toLocaleString("de-DE")}. ${preview.sufficient ? "Die gewünschte Menge passt." : "Bitte Menge oder Zeitraum anpassen."}`
          : "Prüfe bei Bedarf den verfügbaren Bestand. Beim Speichern wird die Verfügbarkeit erneut geprüft."}
      </p>
      <Button disabled={checking || busy} onClick={() => void check()}>
        {checking ? "Wird geprüft …" : "Verfügbarkeit prüfen"}
      </Button>
    </div>
    <ErrorMessage message={error}></ErrorMessage>
    <footer class="dialog-footer">
      <Button disabled={busy} onClick={onClose}>Abbrechen</Button>
      <Button type="submit" variant="primary" disabled={busy || checking}>
        {busy ? "Wird gespeichert …" : "Speichern"}
      </Button>
    </footer>
  </form>
</Modal>
