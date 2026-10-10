<script lang="ts">
import {memberCan} from "@/shared/access-policy";
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
import { recordTitle, RecordDetail, GenericRecordDetail } from "./resource-view";
const effects=createEffects();
type ViewProps = {
    kind: RecordKind;
    title?: string;
    description?: string;
    defaults?: RecordData;
    filter?: (record: DomainRecord) => boolean;
    children?: React.ReactNode;
    headerActions?: React.ReactNode;
    canCreate?: boolean;
    lockedProductionId?: string;
    exportFilters?: Record<string, string>;
};
export let kind: ViewProps["kind"] = undefined as any;
export let title: ViewProps["title"] = undefined as any;
export let description: ViewProps["description"] = undefined as any;
export let defaults: NonNullable<ViewProps["defaults"]> = {};
export let filter: ViewProps["filter"] = undefined as any;
export let children = undefined as any;
export let headerActions = undefined as any;
export let canCreate: ViewProps["canCreate"] = undefined as any;
export let lockedProductionId: ViewProps["lockedProductionId"] = undefined as any;
export let exportFilters: NonNullable<ViewProps["exportFilters"]> = {};
const workspaceStore=useWorkspace();
let { workspace } = $workspaceStore;
$: ({ workspace } = $workspaceStore);
let scope = `resource:${kind}:${lockedProductionId || "all"}`;
const searchStore = useViewState<any>(workspace.user.id, scope, "search", "");
let search: any = $searchStore; $: search = $searchStore;
const setSearch = searchStore.set;
let editor: boolean = false;
const setEditor = (next: typeof editor | ((current: typeof editor) => typeof editor)) => { editor = typeof next === "function" ? (next as (current: typeof editor) => typeof editor)(editor) : next; };
let exporting: boolean = false;
const setExporting = (next: typeof exporting | ((current: typeof exporting) => typeof exporting)) => { exporting = typeof next === "function" ? (next as (current: typeof exporting) => typeof exporting)(exporting) : next; };
let importing: boolean = false;
const setImporting = (next: typeof importing | ((current: typeof importing) => typeof importing)) => { importing = typeof next === "function" ? (next as (current: typeof importing) => typeof importing)(importing) : next; };
const lowStore = useViewState<any>(workspace.user.id, scope, "low", false);
let low: any = $lowStore; $: low = $lowStore;
const setLow = lowStore.set;
let categoriesOpen: boolean = false;
const setCategoriesOpen = (next: typeof categoriesOpen | ((current: typeof categoriesOpen) => typeof categoriesOpen)) => { categoriesOpen = typeof next === "function" ? (next as (current: typeof categoriesOpen) => typeof categoriesOpen)(categoriesOpen) : next; };
let admin = memberCan(workspace.user, 'document.manage');
let allowedCreate = canCreate !== false && canManageRecord(workspace.user, kind);
let rows = workspace.records[kind].filter((row) => (!filter || filter(row)) &&
    (!search || JSON.stringify(row.data).toLowerCase().includes(search.toLowerCase())) &&
    (!low || num(row.data, "quantity") <= num(row.data, "minQuantity")));
let exportable = [
    "productions",
    "actors",
    "casting",
    "tasks",
    "time",
    "events",
    "looks",
    "materials",
    "handovers",
].includes(kind);

$: scope = `resource:${kind}:${lockedProductionId || "all"}`;
$: admin = memberCan(workspace.user, 'document.manage');
$: allowedCreate = canCreate !== false && canManageRecord(workspace.user, kind);
$: rows = workspace.records[kind].filter((row) => (!filter || filter(row)) &&
    (!search || JSON.stringify(row.data).toLowerCase().includes(search.toLowerCase())) &&
    (!low || num(row.data, "quantity") <= num(row.data, "minQuantity")));
$: exportable = [
    "productions",
    "actors",
    "casting",
    "tasks",
    "time",
    "events",
    "looks",
    "materials",
    "handovers",
].includes(kind);

</script>

<section class={browseStyles.resourceBrowse}>
      <PageHeader compact eyebrow="DEIN GEMEINSAMER ARBEITSRAUM" title={title || labels[kind][0]} description={description}><svelte:fragment slot="secondaryActions">{#if (headerActions ||
    exportable ||
    (admin &&
        (lockedProductionId === undefined ||
            kind === "materials" ||
            kind === "handovers")))}
              <slot name="headerActions" />
              {#if (kind === "materials" || kind === "handovers") && admin}<Button onClick={() => setCategoriesOpen(true)}>Kategorien verwalten</Button>{/if}
              {#if exportable}<ExportButton onClick={() => setExporting(true)}></ExportButton>{/if}
              {#if admin && lockedProductionId === undefined}<Button onClick={() => setImporting(true)}>
                  <Upload size={16}></Upload>
                  Importieren
                </Button>{/if}
            {/if}</svelte:fragment>
        {#if allowedCreate}<Button variant="primary" onClick={() => setEditor(true)}>
            <Plus size={16}></Plus>
            {labels[kind][1]} anlegen
          </Button>{/if}
      </PageHeader>
      <slot />
      <div class="toolbar">
        <input class="search-input" aria-label={`${labels[kind][0]} durchsuchen`} placeholder={`${labels[kind][0]} durchsuchen …`} value={search} on:input={(e) => setSearch(e.currentTarget.value)} />
        <span class="small muted">{rows.length} Einträge</span>
        {#if kind === "materials"}<label class="check-label">
            <input type="checkbox" checked={low} on:input={(e) => setLow(e.currentTarget.checked)} />
            Nur Einkaufsbedarf
          </label>{/if}
      </div>
      {#if rows.length}{#if ["looks", "actors", "characters", "casting"].includes(kind)}<div class="editorial-grid">
            {#each rows as row (row.id)}{@const displayName = recordTitle(row, workspace)}{@const photo = (kind === "actors" ? actorPortrait(row, workspace.records.files) : undefined) ||
    workspace.records.files.find((file) => file.data.recordId === row.id && value(file.data, "mime").startsWith("image/")) ||
    (kind === "casting"
        ? workspace.records.files.find((file) => file.data.recordKind === "characters" &&
            file.data.recordId === row.data.characterId &&
            value(file.data, "mime").startsWith("image/"))
        : undefined)}{@const imageCount = kind === "casting"
    ? workspace.records.files.filter((file) => file.data.recordId === row.id &&
        value(file.data, "mime").startsWith("image/")).length
    : 0}{#key row.id}<RecordLink record={row} aria-label={`${displayName} · Details und Galerie öffnen`} className="editorial-card" decoration={false}>
                  {#if photo}{#if kind === "actors"}{#key photo.id}<ActorPortrait file={photo} className="editorial-image"></ActorPortrait>{/key}{:else}<img width={1800} height={1800} class="editorial-image" src={`/api/files/${photo.id}`} alt="" loading="lazy" />{/if}{:else}<div class="editorial-placeholder">
                      <span>{displayName.slice(0, 2).toUpperCase()}</span>
                      <span class="small">{labels[kind][1]}</span>
                    </div>{/if}
                  <div class="editorial-body">
                    <p class="eyebrow">
                      {value(row.data, "scene") || value(row.data, "hair") || "MASKE"}
                    </p>
                    <h3>{displayName}</h3>
                    <p class="small muted">
                      {value(row.data, "preparation") ||
    value(row.data, "notes") ||
    (kind === "casting"
        ? "Bilder hinzufügen und Besetzung öffnen"
        : "Details, Bilder und Hinweise öffnen")}
                    </p>
                    <Badge tone={row.data.status === "published" ? "green" : "neutral"}>
                      {kind === "casting"
    ? row.data.alternate
        ? "Alternierende Besetzung"
        : "Besetzung"
    : statusLabels[value(row.data, "status")] ||
        value(row.data, "wigSize") ||
        "Katalog"}
                    </Badge>
                    {#if kind === "casting"}<span class="casting-image-hint">
                        <ImageIcon size={14}></ImageIcon>
                        {imageCount
    ? `${imageCount} ${imageCount === 1 ? "Bild" : "Bilder"}`
    : "Bilder hinzufügen"}
                      </span>{/if}
                  </div>
                </RecordLink>{/key}{/each}
          </div>{:else}<div class="table-scroll panel">
            <table>
              <thead>
                <tr>
                  <th>{kind === "casting" ? "Figur / Schauspieler" : "Bezeichnung"}</th>
                  <th>
                    {kind === "materials"
    ? "Lagerort"
    : kind === "handovers"
        ? "Checkliste"
        : "Produktion / Kategorie"}
                  </th>
                  <th>
                    {kind === "materials"
    ? "Bestand"
    : kind === "handovers"
        ? "Zuletzt geändert"
        : "Status / Datum"}
                  </th>
                  <th>
                    <span class="visually-hidden">Öffnen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {#each rows as row (row.id)}{@const figure = workspace.records.characters.find((x) => x.id === row.data.characterId)}{@const actor = workspace.records.actors.find((x) => x.id === row.data.actorId)}{@const production = workspace.records.productions.find((x) => x.id === row.data.productionId)}<tr>
                      <td>
                        <RecordLink record={row} className="strong">
                          {value(row.data, "title") ||
    value(row.data, "name") ||
    `${figure ? value(figure.data, "name") : "Figur"} · ${actor ? value(actor.data, "name") : "Schauspieler"}`}
                        </RecordLink>
                        {#if row.data.alternate === true}<span class="small muted">Alternierende Besetzung</span>{/if}
                      </td>
                      <td>
                        {#if kind === "handovers"}{Array.isArray(row.data.checklist) && row.data.checklist.length ? (`${(row.data.checklist as {
    done: boolean;
}[]).filter((item) => item.done).length} / ${row.data.checklist.length} erledigt`) : ("Keine Checkliste")}{:else}{#if kind === "materials"}{value(row.data, "location")}{:else}{#if production}<RecordLink record={production}>
                            {value(production.data, "title")}
                          </RecordLink>{:else}{statusLabels[value(row.data, "category")] || "–"}{/if}{/if}{/if}
                      </td>
                      <td>
                        {#if kind === "handovers"}{dateLabel(row.updatedAt)}{:else}{#if kind === "materials"}<Badge tone={num(row.data, "quantity") <= num(row.data, "minQuantity")
    ? "coral"
    : "green"}>
                            {num(row.data, "quantity")} / min. {num(row.data, "minQuantity")}
                          </Badge>{:else}<Badge tone={["active", "complete", "published"].includes(value(row.data, "status"))
    ? "green"
    : "neutral"}>
                            {statusLabels[value(row.data, "status")] ||
    dateLabel(value(row.data, "date") ||
        value(row.data, "start") ||
        row.updatedAt)}
                          </Badge>{/if}{/if}
                      </td>
                      <td>
                        <RecordLink record={row} className="icon-button" aria-label="Details öffnen" decoration={false}>
                          <MoreHorizontal size={18}></MoreHorizontal>
                        </RecordLink>
                      </td>
                    </tr>{/each}
              </tbody>
            </table>
          </div>{/if}{:else}<Empty title={search || (kind === "actors" && filter)
    ? "Keine passenden Einträge"
    : `Hier beginnen eure ${labels[kind][0]}.`} description={search
    ? "Versuche einen anderen Suchbegriff oder passe die Filter an."
    : kind === "actors" && filter
        ? "Für diese Auswahl sind keine Einträge vorhanden. Wähle eine andere Spielzeit oder lege einen Eintrag an."
        : description ||
            "Lege den ersten Eintrag an. Alle freigegebenen Informationen sind dann für euer Team an einem Ort erreichbar."} action={allowedCreate ? `${labels[kind][1]} anlegen` : undefined} onAction={() => setEditor(true)}></Empty>{/if}
      {#if categoriesOpen}<CategoryManager scope={kind === "handovers" ? "handovers" : "materials"} onClose={() => setCategoriesOpen(false)}></CategoryManager>{/if}
      {#if editor}<ResourceEditor kind={kind} defaults={defaults} lockedProductionId={lockedProductionId} onClose={() => setEditor(false)} onSaved={(saved) => {
    if (["characters", "casting", "looks", "actors"].includes(kind))
        navigateRecord(saved);
}}></ResourceEditor>{/if}
      {#if exporting}<ExportDialog kind={kind} filters={{
    ...(typeof defaults.productionId === "string"
        ? { productionId: defaults.productionId }
        : {}),
    ...exportFilters,
}} onClose={() => setExporting(false)}></ExportDialog>{/if}
      {#if importing}<ImportDialog kind={kind} onClose={() => setImporting(false)}></ImportDialog>{/if}
    </section>
