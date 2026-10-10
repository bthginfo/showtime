<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { CalendarRange, Pencil, Plus, Trash2, X } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { numberValue, textValue } from "@/shared/contracts";
import { dateLabel, instantDate, localDate, localDateTime, post, shiftDate, } from "@/shared/client-api";
import { numberDraft, parseNumberDraft } from "@/shared/number-draft";
import { canManageRecord } from "@/shared/record-permissions";
import { useWorkspace } from "@/components/workspace-context";
import { Badge, Button, ErrorMessage, ExportButton, Modal } from "@/components/ui";
import { ExportDialog } from "@/components/export-dialog";
import styles from "@/modules/workflows/components/workflow.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { ReservationEditor } from "./material-reservations";
const effects=createEffects();
type ViewProps = {
    material: DomainRecord;
};
export let material: ViewProps["material"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace, save, remove, busy } = $workspaceStore;
$: ({ workspace, save, remove, busy } = $workspaceStore);
let editor: DomainRecord | "new" | null = initialState<DomainRecord | "new" | null>(null);
const setEditor = (next: DomainRecord | "new" | null | ((current: DomainRecord | "new" | null) => DomainRecord | "new" | null)) => { editor = typeof next === "function" ? (next as (current: DomainRecord | "new" | null) => DomainRecord | "new" | null)(editor) : next; };
let history: boolean = false;
const setHistory = (next: typeof history | ((current: typeof history) => typeof history)) => { history = typeof next === "function" ? (next as (current: typeof history) => typeof history)(history) : next; };
let exporting: boolean = false;
const setExporting = (next: typeof exporting | ((current: typeof exporting) => typeof exporting)) => { exporting = typeof next === "function" ? (next as (current: typeof exporting) => typeof exporting)(exporting) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let now = (Date.now)();
let records = (workspace.records.reservations || [])
    .filter((row) => row.data.materialId === material.id)
    .sort((a, b) => Date.parse(String(a.data.start)) - Date.parse(String(b.data.start)) ||
    a.id.localeCompare(b.id));
let current: any = records.filter((row) => row.data.status !== "cancelled" && Date.parse(String(row.data.end)) > now);
let visible = history ? records : current;
let cancel = async (record: DomainRecord) => {
    if (!confirm("Diese Reservierung aufheben? Der Artikel wird für den Zeitraum wieder frei."))
        return;
    setError("");
    try {
        await save("reservations", { status: "cancelled" }, record);
    }
    catch (exception) {
        setError(exception instanceof Error
            ? exception.message
            : "Reservierung konnte nicht aufgehoben werden.");
    }
};

$: records = (workspace.records.reservations || [])
    .filter((row) => row.data.materialId === material.id)
    .sort((a, b) => Date.parse(String(a.data.start)) - Date.parse(String(b.data.start)) ||
    a.id.localeCompare(b.id));
$: current = records.filter((row) => row.data.status !== "cancelled" && Date.parse(String(row.data.end)) > now);
$: visible = history ? records : current;


</script>

<section class={styles.section} aria-label="Reservierungen für diesen Artikel">
      <div class={styles.heading}>
        <div>
          <h3>Reservierungen</h3>
          <span class="small muted">
            {current.length} aktuell · Bestand{" "}
            {numberValue(material.data.quantity).toLocaleString("de-DE")}
          </span>
        </div>
        <Button onClick={() => setEditor("new")}>
          <Plus size={15}></Plus>
          Reservieren
        </Button>
      </div>
      <div class={styles.filters}>
        <label class="small">
          Zeitraum{" "}
          <select value={history ? "all" : "current"} on:change={(event) => setHistory(event.currentTarget.value === "all")}>
            <option value="current">Aktuell und geplant</option>
            <option value="all">Alle Reservierungen</option>
          </select>
        </label>
        {#if records.length > 0}<ExportButton onClick={() => setExporting(true)}></ExportButton>{/if}
      </div>
      {#if !visible.length}<p class={styles.empty}>
          Noch keine Reservierungen in dieser Auswahl. Du kannst diesen Artikel für ein Stück oder
          eine andere Verwendung vormerken.
        </p>{/if}
      <div class={styles.list}>
        {#each visible as record (record.id)}{@const production = workspace.records.productions.find((row) => row.id === record.data.productionId)}{@const actor = workspace.records.actors.find((row) => row.id === record.data.actorId)}{@const owner = workspace.members.find((member) => member.id === record.data.userId)}{@const canEdit = canManageRecord(workspace.user, "reservations", record)}<article class={styles.row}>
              <div class={styles.rowHeading}>
                <h4>
                  {numberValue(record.data.quantity).toLocaleString("de-DE")} ×{" "}
                  {textValue(record.data.purpose) ||
    textValue(production?.data.title) ||
    "Reserviert"}
                </h4>
                <Badge tone={record.data.status === "cancelled" ? "neutral" : "success"}>
                  {record.data.status === "cancelled" ? "Aufgehoben" : "Reserviert"}
                </Badge>
              </div>
              <p class="small">
                <CalendarRange size={13} aria-hidden="true"></CalendarRange>{" "}
                <time>
                  {dateLabel(textValue(record.data.start), true)} –{" "}
                  {dateLabel(textValue(record.data.end), true)}
                </time>
              </p>
              <p class={styles.note}>
                {[
    owner?.name || "Ehemaliges Teammitglied",
    textValue(production?.data.title),
    textValue(actor?.data.name),
]
    .filter(Boolean)
    .join(" · ")}
              </p>
              {#if !!record.data.notes}<p class={styles.note}>{String(record.data.notes)}</p>{/if}
              {#if canEdit}<div class={styles.actions}>
                  <Button disabled={busy} onClick={() => setEditor(record)}>
                    <Pencil size={14}></Pencil>
                    Bearbeiten
                  </Button>
                  {#if record.data.status !== "cancelled"}<Button disabled={busy} onClick={() => void cancel(record)}>
                      <X size={14}></X>
                      Aufheben
                    </Button>{/if}
                  {#if (record.data.status === "cancelled" ||
    Date.parse(String(record.data.end)) <= now)}<Button disabled={busy} onClick={async () => {
    if (!confirm("Diese Reservierung entfernen?"))
        return;
    setError("");
    try {
        await remove(record);
    }
    catch (exception) {
        setError(exception instanceof Error
            ? exception.message
            : "Reservierung konnte nicht entfernt werden.");
    }
}}>
                      <Trash2 size={14}></Trash2>
                      Entfernen
                    </Button>{/if}
                </div>{/if}
            </article>{/each}
      </div>
      <p class={styles.note}>
        Die Verfügbarkeit berücksichtigt auch Reservierungen aus anderen Produktionen. Nur die
        eigenen Reservierungen können von Teammitgliedern geändert werden; Admins können alle
        ändern.
      </p>
      <ErrorMessage message={error}></ErrorMessage>
      {#if editor}<ReservationEditor material={material} record={editor === "new" ? undefined : editor} onClose={() => setEditor(null)}></ReservationEditor>{/if}
      {#if exporting}<ExportDialog kind="reservations" filters={{ materialId: material.id }} onClose={() => setExporting(false)}></ExportDialog>{/if}
    </section>
