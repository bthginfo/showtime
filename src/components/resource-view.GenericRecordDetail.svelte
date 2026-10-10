<script lang="ts">
import FieldDisplay from "./field-display.svelte";
import { LinkedText } from "./linked-text";
import { ArrowLeft, Image as ImageIcon, MoreHorizontal, Pencil, Plus, Trash2, Upload, } from "@lucide/svelte";
import type { DomainRecord, RecordData, RecordKind, Workspace } from "@/shared/contracts";
import { api, dateLabel, hours, ids, localDate, num, value } from "@/shared/client-api";
import { imageAccept, prepareUpload } from "@/shared/client-files";
import { HistoryPanel } from "./history-panel";
import { fields, labels, statusLabels } from "./resource-fields";
import { useWorkspace } from "./workspace-context";
import { Badge, Button, Empty, ErrorMessage, ExportButton, Modal, PageHeader } from "./ui";
import browseStyles from "./workspace-browse.module.css";
import { ResourceEditor } from "./resource-editor";
import { DocumentContent } from "@/modules/documentation/components/document-content";
import { lookTitle } from "@/shared/document-sections";
import { CategoryManager } from "@/modules/categories/components/category-manager";
import { categoryName } from "@/shared/domain-categories";
import { EventDetail } from "@/modules/calendar/components/event-detail";
import { canManageRecord } from "@/shared/record-permissions";
import { ExportDialog, ImportDialog } from "./export-dialog";
import { DocumentAttachment } from "@/modules/documents/components/document-attachment";
import { documentAccept, RecordDocuments } from "@/modules/documents/components/record-documents";
import { RecordLink } from "./record-link";
import { ActorRelationships, CharacterRelationships, SprintRelationships } from "./record-relationships";
import { PersonDetails } from "@/modules/people/components/person-details";
import { navigateRecord, navigationReturn } from "@/shared/client-navigation";
import relationStyles from "./record-links.module.css";
import { actorPortrait } from "@/modules/ensemble/portrait-layout";
import { ActorPortrait } from "@/modules/ensemble/components/actor-portrait";
import portraitStyles from "@/modules/ensemble/components/actor-portrait.module.css";
import { initialPeriod, teamTaskSeason } from "@/shared/period-filter";
import { useViewState } from "@/shared/view-state";
import { MaterialReservations } from "@/modules/reservations/components/material-reservations";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { recordTitle, RecordDetail, ResourceView } from "./resource-view";
const effects=createEffects();
type ViewProps = {
    record: DomainRecord;
    onClose: () => void;
    onNavigate: () => void;
};
export let record: ViewProps["record"] = undefined as any;
export let onClose: ViewProps["onClose"] = undefined as any;
export let onNavigate: ViewProps["onNavigate"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace, save, remove, removeFile, refresh, action, busy } = $workspaceStore;
$: ({ workspace, save, remove, removeFile, refresh, action, busy } = $workspaceStore);
let editing: boolean = false;
const setEditing = (next: typeof editing | ((current: typeof editing) => typeof editing)) => { editing = typeof next === "function" ? (next as (current: typeof editing) => typeof editing)(editing) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let uploading: boolean = false;
const setUploading = (next: typeof uploading | ((current: typeof uploading) => typeof uploading)) => { uploading = typeof next === "function" ? (next as (current: typeof uploading) => typeof uploading)(uploading) : next; };
let subtask: boolean = false;
const setSubtask = (next: typeof subtask | ((current: typeof subtask) => typeof subtask)) => { subtask = typeof next === "function" ? (next as (current: typeof subtask) => typeof subtask)(subtask) : next; };
let timeBooking: boolean = false;
const setTimeBooking = (next: typeof timeBooking | ((current: typeof timeBooking) => typeof timeBooking)) => { timeBooking = typeof next === "function" ? (next as (current: typeof timeBooking) => typeof timeBooking)(timeBooking) : next; };
let exporting: boolean = false;
const setExporting = (next: typeof exporting | ((current: typeof exporting) => typeof exporting)) => { exporting = typeof next === "function" ? (next as (current: typeof exporting) => typeof exporting)(exporting) : next; };
let current: DomainRecord = workspace.records[record.kind].find((x) => x.id === record.id) || record;
let canEdit = canManageRecord(workspace.user, current.kind, current);
let allLinkedFiles = workspace.records.files.filter((x) => x.data.recordKind === current.kind && x.data.recordId === current.id);
let portrait = current.kind === "actors" ? actorPortrait(current, allLinkedFiles) : undefined;
let linkedFiles = current.kind === "actors"
    ? allLinkedFiles.filter((file) => !value(file.data, "mime").startsWith("image/") || file.id === portrait?.id)
    : allLinkedFiles;
let linkedFigure = current.kind === "casting"
    ? workspace.records.characters.find((row) => row.id === current.data.characterId)
    : undefined;
let figureFiles = linkedFigure
    ? workspace.records.files.filter((row) => row.data.recordKind === "characters" && row.data.recordId === linkedFigure?.id)
    : [];
let title = recordTitle(current, workspace);
let attempt = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
        await fn();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Aktion fehlgeschlagen");
    }
};
let deleteRecord = () => {
    if (window.confirm(`„${title}“ wirklich löschen? Verknüpfte Einträge können betroffen sein.`))
        void attempt(async () => {
            await remove(current);
            onClose();
        });
};
let upload = async (files: FileList | null) => {
    if (!files)
        return;
    setUploading(true);
    await attempt(async () => {
        for (const file of Array.from(files)) {
            const form = new FormData();
            form.append("file", await prepareUpload(file));
            form.append("recordKind", current.kind);
            form.append("recordId", current.id);
            await api<DomainRecord>("/api/files", { method: "POST", body: form });
        }
        await refresh();
    });
    setUploading(false);
};
let checklist = Array.isArray(current.data.checklist)
    ? (current.data.checklist as {
        text: string;
        done: boolean;
    }[])
    : [];

$: current = workspace.records[record.kind].find((x) => x.id === record.id) || record;
$: canEdit = canManageRecord(workspace.user, current.kind, current);
$: allLinkedFiles = workspace.records.files.filter((x) => x.data.recordKind === current.kind && x.data.recordId === current.id);
$: portrait = current.kind === "actors" ? actorPortrait(current, allLinkedFiles) : undefined;
$: linkedFiles = current.kind === "actors"
    ? allLinkedFiles.filter((file) => !value(file.data, "mime").startsWith("image/") || file.id === portrait?.id)
    : allLinkedFiles;
$: linkedFigure = current.kind === "casting"
    ? workspace.records.characters.find((row) => row.id === current.data.characterId)
    : undefined;
$: figureFiles = linkedFigure
    ? workspace.records.files.filter((row) => row.data.recordKind === "characters" && row.data.recordId === linkedFigure?.id)
    : [];
$: title = recordTitle(current, workspace);



$: checklist = Array.isArray(current.data.checklist)
    ? (current.data.checklist as {
        text: string;
        done: boolean;
    }[])
    : [];

</script>


      {#if editing}<ResourceEditor kind={current.kind} record={current} onClose={() => setEditing(false)}></ResourceEditor>{:else}<Modal title={title} onClose={onClose} wide>
          <div class="detail-actions">
            {#if navigationReturn()}<Button variant="ghost" onClick={onClose}>
                <ArrowLeft size={15}></ArrowLeft>
                Zurück
              </Button>{/if}
            {#if !["looks", "handovers"].includes(current.kind)}<Badge tone={value(current.data, "status") === "published" ||
    value(current.data, "status") === "done"
    ? "green"
    : "neutral"}>
                {statusLabels[value(current.data, "status")] || labels[current.kind][1]}
              </Badge>{/if}
            {#if canEdit}<Button onClick={() => setEditing(true)}>
                <Pencil size={15}></Pencil>
                Bearbeiten
              </Button>{/if}
            {#if ![
    "files",
    "leave",
    "sprints",
    "templates",
    "characters",
    "notifications",
    "timesheets",
    "messages",
].includes(current.kind)}<ExportButton onClick={() => setExporting(true)}></ExportButton>{/if}
            {#if canEdit}<Button variant="danger-ghost" disabled={busy} onClick={deleteRecord}>
                <Trash2 size={15}></Trash2>
                Löschen
              </Button>{/if}
          </div>
          <dl class="detail-grid">
            {#each (fields[current.kind] || [])
    .filter((field) => !["title", "name", "checklist", "imageIds"].includes(field.key) &&
    current.data[field.key] !== undefined &&
    current.data[field.key] !== "") as field (field.key)}<div class={field.type === "textarea" ? "field-wide" : ""}>
                    <dt>{field.label}</dt>
                    <dd>
                      <FieldDisplay {field} record={current} {onNavigate}/>
                    </dd>
                  </div>{/each}
          </dl>
          {#if current.kind === "materials"}<MaterialReservations material={current}></MaterialReservations>{/if}
          {#if current.kind === "actors"}<ActorRelationships record={current} onNavigate={onNavigate}></ActorRelationships>{/if}
          {#if current.kind === "characters"}<CharacterRelationships record={current} onNavigate={onNavigate}></CharacterRelationships>{/if}
          {#if current.kind === "sprints"}<SprintRelationships record={current} onNavigate={onNavigate}></SprintRelationships>{/if}
          {#if ["looks", "handovers", "templates"].includes(current.kind)}<DocumentContent record={current}></DocumentContent>{/if}
          {#if checklist.length > 0}<section class="detail-section">
              <h3>Checkliste</h3>
              {#each checklist as item, i (i)}<label class="check-label checklist-item">
                  <input type="checkbox" disabled={busy || !canEdit} checked={item.done} on:input={(event) => void attempt(() => save(current.kind, {
    checklist: checklist.map((x, j) => j === i ? { ...x, done: event.currentTarget.checked } : x),
}, current))} />
                  <span class={item.done ? "done" : ""}>
                    <LinkedText text={item.text}></LinkedText>
                  </span>
                </label>{/each}
            </section>{/if}
          {#if current.kind === "tasks"}<section class="detail-section">
              <h3>Unteraufgaben</h3>
              {#each workspace.records.tasks
    .filter((x) => x.data.parentId === current.id) as x (x.id)}<p>
                    {#key x.id}<RecordLink record={x} from={current} onNavigate={onNavigate}>
                      {value(x.data, "title")}
                    </RecordLink>{/key}{" "}
                    <Badge>{statusLabels[value(x.data, "status")]}</Badge>
                  </p>{/each}
              <Button onClick={() => setSubtask(true)}>
                <Plus size={15}></Plus>
                Unteraufgabe anlegen
              </Button>
            </section>{/if}
          {#if current.kind === "productions" && canEdit}<div class="detail-actions">
              <Button disabled={busy} onClick={() => {
    const title = prompt("Titel der Wiederaufnahme", `${value(current.data, "title")} · Wiederaufnahme`);
    if (title)
        void attempt(async () => {
            await action("production-copy", current.id, { title });
            onClose();
        });
}}>
                Als Wiederaufnahme kopieren
              </Button>
              <Button disabled={busy} onClick={() => void attempt(() => save("productions", { status: current.data.status === "archived" ? "active" : "archived" }, current))}>
                {current.data.status === "archived" ? "Reaktivieren" : "Archivieren"}
              </Button>
            </div>{/if}
          {#if [
    "looks",
    "characters",
    "casting",
    "actors",
    "handovers",
    "materials",
    "messages",
].includes(current.kind)}<section class="detail-section">
              <header class="panel-heading">
                <h3>
                  {current.kind === "casting"
    ? "Bilder dieser Besetzung"
    : current.kind === "actors"
        ? "Porträt & Dateien"
        : "Bilder & Dateien"}
                </h3>
                {#if canEdit}<label class="button secondary">
                    <Upload size={15}></Upload>
                    {uploading
    ? "Wird hochgeladen …"
    : current.kind === "casting"
        ? "Bilder hinzufügen"
        : current.kind === "actors"
            ? portrait
                ? "Porträt ersetzen / Datei ergänzen"
                : "Porträt / Datei hinzufügen"
            : "Hochladen"}
                    <input type="file" accept={current.kind === "casting" ? imageAccept : documentAccept} multiple={current.kind !== "actors"} class="visually-hidden" disabled={uploading} on:input={(event) => void upload(event.currentTarget.files)} />
                  </label>{/if}
              </header>
              {#if linkedFiles.length}<div class="gallery">
                  {#each linkedFiles as file (file.id)}<div class="gallery-item">
                      {#if value(file.data, "mime").startsWith("image/")}<a href={`/api/files/${file.id}`} target="_blank" rel="noreferrer">
                          {#if current.kind === "actors"}<ActorPortrait file={file} className={portraitStyles.detail} alt={value(current.data, "name")}></ActorPortrait>{:else}<img width={1800} height={1800} src={`/api/files/${file.id}`} alt={value(file.data, "name")} loading="lazy" />{/if}
                        </a>{:else}<DocumentAttachment file={file}></DocumentAttachment>{/if}
                      <div class="gallery-caption">
                        <span>{value(file.data, "name")}</span>
                        {#if canEdit}<button class="icon-button" title="Datei löschen" aria-label={`${value(file.data, "name")} löschen`} on:click={() => {
    if (confirm("Datei löschen?"))
        void attempt(async () => {
            await removeFile(file);
        });
}}>
                            <Trash2 size={14}></Trash2>
                          </button>{/if}
                      </div>
                    </div>{/each}
                </div>{:else}<p class="small muted">
                  <ImageIcon size={15}></ImageIcon> Noch keine Bilder oder Anhänge. Lade Fotos direkt vom
                  Smartphone hoch.
                </p>{/if}
              {#if current.kind === "actors" && value(current.data, "portraitCredit")}<p class="small muted">
                  Ensemble-Porträt: {value(current.data, "portraitCredit")}
                </p>{/if}
            </section>{/if}
          {#if linkedFigure}<section class="detail-section">
              <header class="panel-heading">
                <h3>Figur: {value(linkedFigure.data, "name")}</h3>
                <RecordLink record={linkedFigure} from={current} onNavigate={onNavigate}>
                  Figur öffnen
                </RecordLink>
              </header>
              {#if value(linkedFigure.data, "description")}<p>
                  <LinkedText text={value(linkedFigure.data, "description")}></LinkedText>
                </p>{/if}
              {#if figureFiles.length > 0}
                  <p class="small muted">Vorhandene Bilder der Figur</p>
                  <div class="gallery">
                    {#each figureFiles as file (file.id)}<div class="gallery-item">
                        {#if value(file.data, "mime").startsWith("image/")}<a href={`/api/files/${file.id}`} target="_blank" rel="noreferrer">
                            <img width={1800} height={1800} src={`/api/files/${file.id}`} alt={value(file.data, "name")} loading="lazy" />
                          </a>{:else}<DocumentAttachment file={file}></DocumentAttachment>{/if}
                        <div class="gallery-caption">
                          <span>{value(file.data, "name")}</span>
                        </div>
                      </div>{/each}
                  </div>
                {/if}
            </section>{/if}
          {#if ["tasks", "templates"].includes(current.kind)}<RecordDocuments record={current}></RecordDocuments>{/if}
          {#if current.kind === "materials"}<section class="qr-section">
              <img src={`/api/qr?kind=materials&id=${current.id}`} alt={`QR-Code für ${title}`} width={160} height={160} />
              <div>
                <h3>Direkt zum Fundus-Eintrag</h3>
                <p class="muted small">
                  QR-Code an der Materialbox oder Perücke anbringen. Der Zugriff erfordert einen
                  aktiven Theaterzugang.
                </p>
                <a class="button secondary" href={`/api/qr?kind=materials&id=${current.id}`} download={`${title}-qr.svg`}>
                  QR herunterladen
                </a>
              </div>
            </section>{/if}

            {#if current.kind === "tasks" && workspace.user.role !== "superadmin"}<div class="detail-actions margin-top">
                <Button disabled={busy} onClick={() => void attempt(() => action("timer-start", undefined, {
    title: value(current.data, "title"),
    productionId: value(current.data, "productionId"),
    taskId: current.id,
    category: current.data.productionId ? "production" : "other",
}))}>
                  Timer für diese Aufgabe starten
                </Button>
                <Button onClick={() => setTimeBooking(true)}>Zeit nachtragen</Button>
              </div>{/if}
            {#if current.kind === "events"}<div class="detail-actions margin-top">
                <Button onClick={() => setTimeBooking(true)}>
                  Tatsächliche Arbeitszeit buchen
                </Button>
                <p class="small muted">
                  Ein geplanter Dienst wird erst durch deine Buchung zur tatsächlichen Arbeitszeit.
                </p>
              </div>{/if}
            {#if (current.kind === "looks" || current.kind === "templates")}<HistoryPanel record={current}></HistoryPanel>{/if}

          <ErrorMessage message={error}></ErrorMessage>
          <footer class="dialog-footer">
            <span class="small muted">
              Letzte Änderung {dateLabel(current.updatedAt, true)}
            </span>
            <Button onClick={onClose}>Schließen</Button>
          </footer>
        </Modal>{/if}
      {#if timeBooking}<ResourceEditor kind="time" defaults={{
    title: value(current.data, "title"),
    productionId: value(current.data, "productionId"),
    category: current.data.productionId ? "production" : "other",
    ...(current.kind === "tasks"
        ? { taskId: current.id }
        : current.kind === "events"
            ? {
                start: value(current.data, "start"),
                end: value(current.data, "end"),
                date: localDate(new Date(value(current.data, "start"))),
            }
            : {}),
}} onClose={() => setTimeBooking(false)}></ResourceEditor>{/if}
      {#if subtask}<ResourceEditor kind="tasks" lockedProductionId={value(current.data, "productionId")} defaults={{
    parentId: current.id,
    productionId: current.data.productionId,
    sprintId: current.data.sprintId,
    season: value(current.data, "season") ||
        (current.data.productionId
            ? initialPeriod(workspace.records.productions, value(current.data, "productionId"))
                .season
            : teamTaskSeason(current.data, current.createdAt)),
}} onClose={() => setSubtask(false)}></ResourceEditor>{/if}
      {#if exporting}<ExportDialog kind={current.kind} filters={{ id: current.id }} onClose={() => setExporting(false)}></ExportDialog>{/if}
