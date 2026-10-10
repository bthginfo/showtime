<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { FileText, Plus } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { documentSections, sectionName, lookTitle } from "@/shared/document-sections";
import { initialPeriod, recordMatchesPeriod, type PeriodFilter } from "@/shared/period-filter";
import { value } from "@/shared/client-api";
import { useWorkspace } from "@/components/workspace-context";
import { Button, Empty, ExportButton, PageHeader } from "@/components/ui";
import { PeriodPicker, periodExportFilters } from "@/components/period-picker";
import { RecordDetail, ResourceView } from "@/components/resource-view";
import { ResourceEditor } from "@/components/resource-editor";
import { ExportDialog } from "@/components/export-dialog";
import { CategoryManager } from "@/modules/categories/components/category-manager";
import { useViewState } from "@/shared/view-state";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
const workspaceStore=useWorkspace();
let { workspace } = $workspaceStore;
$: ({ workspace } = $workspaceStore);
const tabStore = useViewState<any>(workspace.user.id, "documentation", "tab", "looks");
let tab: any = $tabStore; $: tab = $tabStore;
const setTab = tabStore.set;
const productionStore = useViewState<any>(workspace.user.id, "documentation", "production", "");
let production: any = $productionStore; $: production = $productionStore;
const setProduction = productionStore.set;
const searchStore = useViewState<any>(workspace.user.id, "documentation", "search", "");
let search: any = $searchStore; $: search = $searchStore;
const setSearch = searchStore.set;
const periodStore = useViewState<PeriodFilter>(workspace.user.id, "documentation", "period", () => initialPeriod(workspace.records.productions));
let period: PeriodFilter = $periodStore; $: period = $periodStore;
const setPeriod = periodStore.set;
let editing: boolean = false;
const setEditing = (next: typeof editing | ((current: typeof editing) => typeof editing)) => { editing = typeof next === "function" ? (next as (current: typeof editing) => typeof editing)(editing) : next; };
let detail: DomainRecord | null = initialState<DomainRecord | null>(null);
const setDetail = (next: DomainRecord | null | ((current: DomainRecord | null) => DomainRecord | null)) => { detail = typeof next === "function" ? (next as (current: DomainRecord | null) => DomainRecord | null)(detail) : next; };
let exporting: boolean = false;
const setExporting = (next: typeof exporting | ((current: typeof exporting) => typeof exporting)) => { exporting = typeof next === "function" ? (next as (current: typeof exporting) => typeof exporting)(exporting) : next; };
let categoriesOpen: boolean = false;
const setCategoriesOpen = (next: typeof categoriesOpen | ((current: typeof categoriesOpen) => typeof categoriesOpen)) => { categoriesOpen = typeof next === "function" ? (next as (current: typeof categoriesOpen) => typeof categoriesOpen)(categoriesOpen) : next; };
let rows = workspace.records.looks.filter((row) => (!production ||
    (production === "general"
        ? !row.data.productionId
        : row.data.productionId === production)) &&
    recordMatchesPeriod(row, period, workspace.records.productions) &&
    (!search ||
        JSON.stringify({
            ...row.data,
            actorName: lookTitle(row.data, workspace.records.actors),
            characterName: value(workspace.records.characters.find((figure) => figure.id === row.data.characterId)
                ?.data || {}, "name"),
            categories: documentSections(row.data, "looks").map((section) => sectionName(section.key, "looks", workspace.records.categories)),
        })
            .toLowerCase()
            .includes(search.toLowerCase())));
let groupIds = [...new Set(rows.map((row) => value(row.data, "productionId")))].sort((a, b) => !a
    ? -1
    : !b
        ? 1
        : value(workspace.records.productions.find((row) => row.id === a)?.data || {}, "title").localeCompare(value(workspace.records.productions.find((row) => row.id === b)?.data || {}, "title"), "de"));

$: rows = workspace.records.looks.filter((row) => (!production ||
    (production === "general"
        ? !row.data.productionId
        : row.data.productionId === production)) &&
    recordMatchesPeriod(row, period, workspace.records.productions) &&
    (!search ||
        JSON.stringify({
            ...row.data,
            actorName: lookTitle(row.data, workspace.records.actors),
            characterName: value(workspace.records.characters.find((figure) => figure.id === row.data.characterId)
                ?.data || {}, "name"),
            categories: documentSections(row.data, "looks").map((section) => sectionName(section.key, "looks", workspace.records.categories)),
        })
            .toLowerCase()
            .includes(search.toLowerCase())));
$: groupIds = [...new Set(rows.map((row) => value(row.data, "productionId")))].sort((a, b) => !a
    ? -1
    : !b
        ? 1
        : value(workspace.records.productions.find((row) => row.id === a)?.data || {}, "title").localeCompare(value(workspace.records.productions.find((row) => row.id === b)?.data || {}, "title"), "de"));

</script>


      <div class="tabs compact-tabs">
        <button class={tab === "looks" ? "active" : ""} on:click={() => setTab("looks")}>
          Sammelordner
        </button>
        <button class={tab === "templates" ? "active" : ""} on:click={() => setTab("templates")}>
          Vorlagen
        </button>
      </div>
      {#if tab === "templates"}<ResourceView kind="templates" description="Wiederverwendbare Abschnitte und Textfelder. Individuelle Vorlagenfelder bleiben erhalten."></ResourceView>{:else}
          <PageHeader eyebrow="WISSEN FÜR EUER TEAM" title="Aufschriebe" >
            <ExportButton onClick={() => setExporting(true)}></ExportButton>
            {#if workspace.user.role !== "user"}<Button onClick={() => setCategoriesOpen(true)}>Abschnitte verwalten</Button>{/if}
            <Button variant="primary" onClick={() => setEditing(true)}>
              <Plus size={15}></Plus>
              Aufschrieb anlegen
            </Button>
          </PageHeader>
          <div class="toolbar wrap">
            <label class="inline-label">
              Sammelordner
              <select value={production} on:change={(event) => setProduction(event.currentTarget.value)}>
                <option value="">Alle Aufschriebe</option>
                <option value="general">Allgemeine Aufschriebe</option>
                {#each workspace.records.productions as row (row.id)}<option value={row.id}>
                    {value(row.data, "title")}
                    {row.data.status === "archived" ? " · Archiv" : ""}
                  </option>{/each}
              </select>
            </label>
            <input class="search-input" aria-label="Aufschriebe durchsuchen" placeholder="Person, Figur, Kategorie oder Text …" value={search} on:input={(event) => setSearch(event.currentTarget.value)} />
          </div>
          <PeriodPicker records={workspace.records.looks} productions={workspace.records.productions} value={period} onChange={setPeriod}></PeriodPicker>
          {#if groupIds.length}{#each groupIds as id (id || "general")}{@const project = workspace.records.productions.find((row) => row.id === id)}<section class="document-folder">
                  <header>
                    <div>
                      <span class="eyebrow">
                        {project?.data.status === "archived"
    ? "ARCHIVIERTE PRODUKTION"
    : id
        ? "PRODUKTION"
        : "GEMEINSAMER SAMMELORDNER"}
                      </span>
                      <h2>
                        {id
    ? value(project?.data || {}, "title") || "Frühere Produktion"
    : "Allgemeine Aufschriebe"}
                      </h2>
                    </div>
                    <span class="small muted">
                      {rows.filter((row) => value(row.data, "productionId") === id).length}{" "}
                      Aufschriebe
                    </span>
                  </header>
                  <div class="document-folder-records">
                    {#each rows
    .filter((row) => value(row.data, "productionId") === id) as row (row.id)}<button on:click={() => setDetail(row)}>
                          <FileText size={20}></FileText>
                          <div>
                            <h3>{lookTitle(row.data, workspace.records.actors)}</h3>
                            <p class="small muted">
                              {value(workspace.records.characters.find((figure) => figure.id === row.data.characterId)?.data || {}, "name") ||
    value(row.data, "characterName") ||
    "Ohne Figur"}
                            </p>
                          </div>
                          <span class="small muted">
                            {Array.isArray(row.data.imageIds) ? row.data.imageIds.length : 0} Bilder
                          </span>
                        </button>{/each}
                  </div>
                </section>{/each}{:else}<Empty title="Keine Aufschriebe in dieser Auswahl." description="Ändere den Suchtext oder Zeitraum, oder lege einen allgemeinen Aufschrieb an."></Empty>{/if}
        {/if}
      {#if editing}<ResourceEditor kind="looks" defaults={{ productionId: production === "general" ? "" : production }} onClose={() => setEditing(false)} onSaved={setDetail}></ResourceEditor>{/if}{" "}
      {#if detail}<RecordDetail record={detail} onClose={() => setDetail(null)}></RecordDetail>{/if}{" "}
      {#if categoriesOpen}<CategoryManager scope="looks" onClose={() => setCategoriesOpen(false)}></CategoryManager>{/if}{" "}
      {#if exporting}<ExportDialog kind="looks" filters={{
    ...periodExportFilters(period),
    ...(production && production !== "general"
        ? { productionId: production }
        : production === "general"
            ? { generalOnly: "true" }
            : {}),
}} onClose={() => setExporting(false)}></ExportDialog>{/if}
