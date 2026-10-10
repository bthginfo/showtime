<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { Check, Download, ExternalLink, LoaderCircle, Users } from "@lucide/svelte";
import { ResourceView } from "@/components/resource-view";
import { Badge, Button, ErrorMessage, Modal } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-context";
import { api, initials, post } from "@/shared/client-api";
import { PeriodPicker, periodExportFilters } from "@/components/period-picker";
import { initialPeriod, periodOptions, recordMatchesPeriod, seasonKey, type PeriodFilter, } from "@/shared/period-filter";
import { useViewState } from "@/shared/view-state";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { type Preview, type ImportResult, ActorsModule } from "./actors-module";
const effects=createEffects();
type ViewProps = {
    onClose: () => void;
};
export let onClose: ViewProps["onClose"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace, refresh, notify } = $workspaceStore;
$: ({ workspace, refresh, notify } = $workspaceStore);
const seasonListId = createId();
let targetSeason = initialPeriod(workspace.records.productions).season || "";
const setTargetSeason = (next: typeof targetSeason | ((current: typeof targetSeason) => typeof targetSeason)) => { targetSeason = typeof next === "function" ? (next as (current: typeof targetSeason) => typeof targetSeason)(targetSeason) : next; };
let preview: Preview | null = initialState<Preview | null>(null);
const setPreview = (next: Preview | null | ((current: Preview | null) => Preview | null)) => { preview = typeof next === "function" ? (next as (current: Preview | null) => Preview | null)(preview) : next; };
let selection: string[] = initialState<string[]>([]);
const setSelection = (next: string[] | ((current: string[]) => string[])) => { selection = typeof next === "function" ? (next as (current: string[]) => string[])(selection) : next; };
let loading: boolean = false;
const setLoading = (next: typeof loading | ((current: typeof loading) => typeof loading)) => { loading = typeof next === "function" ? (next as (current: typeof loading) => typeof loading)(loading) : next; };
let importing: boolean = false;
const setImporting = (next: typeof importing | ((current: typeof importing) => typeof importing)) => { importing = typeof next === "function" ? (next as (current: typeof importing) => typeof importing)(importing) : next; };
let progress: number = 0;
const setProgress = (next: typeof progress | ((current: typeof progress) => typeof progress)) => { progress = typeof next === "function" ? (next as (current: typeof progress) => typeof progress)(progress) : next; };
let result: ImportResult | null = initialState<ImportResult | null>(null);
const setResult = (next: ImportResult | null | ((current: ImportResult | null) => ImportResult | null)) => { result = typeof next === "function" ? (next as (current: ImportResult | null) => ImportResult | null)(result) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let load = async () => {
    setLoading(true);
    setError("");
    try {
        const season = seasonKey(targetSeason);
        if (!season)
            throw new Error("Bitte gib die Ziel-Spielzeit als Jahr/Jahr ein, z. B. 2026/2027.");
        const next = await api<Preview>(`/api/ensemble?${new URLSearchParams({ season })}`);
        setPreview(next);
        setSelection(next.entries.filter((entry) => entry.action !== "conflict").map((entry) => entry.sourceId));
    }
    catch (cause) {
        setError(cause instanceof Error ? cause.message : "Das Ensemble konnte nicht geladen werden.");
    }
    finally {
        setLoading(false);
    }
};
let runImport = async () => {
    if (!preview)
        return;
    const importSeason = preview.season;
    setImporting(true);
    setProgress(0);
    setError("");
    try {
        const combined: ImportResult = {
            created: 0,
            updated: 0,
            unchanged: 0,
            images: 0,
            errors: [],
        };
        for (let offset = 0; offset < selection.length; offset += 4) {
            const batch = selection.slice(offset, offset + 4);
            try {
                const next = await post<ImportResult>("/api/ensemble", {
                    sourceIds: batch,
                    season: importSeason,
                });
                combined.created += next.created;
                combined.updated += next.updated;
                combined.unchanged += next.unchanged;
                combined.images += next.images;
                combined.errors.push(...next.errors);
            }
            catch (cause) {
                const message = cause instanceof Error ? cause.message : "Import fehlgeschlagen";
                combined.errors.push(...batch.map((sourceId) => ({
                    name: preview?.entries.find((entry) => entry.sourceId === sourceId)?.name || sourceId,
                    error: message,
                })));
            }
            setProgress(Math.min(offset + batch.length, selection.length));
        }
        setResult(combined);
        await refresh();
        notify("Ensemble-Import abgeschlossen.");
    }
    catch (cause) {
        setError(cause instanceof Error ? cause.message : "Der Import konnte nicht abgeschlossen werden.");
    }
    finally {
        setImporting(false);
    }
};
let selectable = preview?.entries.filter((entry) => entry.action !== "conflict") || [];
let allSelected = selectable.length > 0 && selectable.every((entry) => selection.includes(entry.sourceId));



$: selectable = preview?.entries.filter((entry) => entry.action !== "conflict") || [];
$: allSelected = selectable.length > 0 && selectable.every((entry) => selection.includes(entry.sourceId));

</script>

<Modal title="Ensemble übernehmen" onClose={() => {
    if (!importing)
        onClose();
}} wide className="ensemble-import-dialog">
      <div class="ensemble-import-body">
        <div class="ensemble-source">
          <Users size={24}></Users>
          <div>
            <strong>Stadttheater Ingolstadt · Ensemble & Gäste</strong>
            <a href="https://theater.ingolstadt.de/ensemble/schauspielerinnen.html" target="_blank" rel="noreferrer">
              Schauspiel <ExternalLink size={13}></ExternalLink>
            </a>
            <a href="https://theater.ingolstadt.de/junges-theater/ensemble-jt.html" target="_blank" rel="noreferrer">
              Junges Theater <ExternalLink size={13}></ExternalLink>
            </a>
          </div>
        </div>
        <p class="small muted">
          Ensemble und Gäste aus Schauspiel und Jungem Theater werden gemeinsam geladen. Neue
          Schauspieler werden ergänzt, vorhandene bei eindeutiger Zuordnung aktualisiert. Eure
          zusätzlichen Schauspieler, Maskenhinweise und Produktionszuordnungen bleiben erhalten.
        </p>
        <label>
          Ziel-Spielzeit
          <input value={targetSeason} list={seasonListId} disabled={loading || importing || !!result} placeholder="2026/2027" on:input={(event) => {
    setTargetSeason(event.currentTarget.value);
    setPreview(null);
    setSelection([]);
    setError("");
}} />
          <datalist id={seasonListId}>
            {#each periodOptions(workspace.records.actors, workspace.records.productions).seasons as season (season)}<option value={season}></option>{/each}
          </datalist>
        </label>
        <p class="small muted">
          Die Website zeigt das heutige Ensemble. Die ausgewählten Personen werden dieser Spielzeit
          zugeordnet; frühere Spielzeiten bleiben erhalten.
        </p>
        <ErrorMessage message={error}></ErrorMessage>
        {#if result}<section class="ensemble-result" aria-live="polite">
            <Check size={24}></Check>
            <h3>Import abgeschlossen</h3>
            <p class="small muted">Spielzeit {preview?.season}</p>
            <p>
              {result.created} neu · {result.updated} aktualisiert · {result.unchanged} unverändert
            </p>
            <p class="small muted">{result.images} Bilder übernommen</p>
            {#if result.errors.length > 0}
                <h4>Bitte prüfen</h4>
                <ul>
                  {#each result.errors as item, index (`${item.name}-${index}`)}<li>
                      <strong>{item.name}:</strong> {item.error}
                    </li>{/each}
                </ul>
              {/if}
          </section>{:else}{#if preview}
            <div class="ensemble-summary">
              <Badge>Spielzeit {preview.season}</Badge>
              <Badge tone="green">{preview.summary.create} neu</Badge>
              <Badge>{preview.summary.update} aktualisieren</Badge>
              {#if preview.summary.conflict > 0}<Badge tone="coral">{preview.summary.conflict} unklar</Badge>{/if}
            </div>
            <label class="check-label ensemble-select-all">
              <input type="checkbox" checked={allSelected} disabled={importing || !selectable.length} on:input={(event) => setSelection(event.currentTarget.checked ? selectable.map((entry) => entry.sourceId) : [])} />
              Alle eindeutigen Personen auswählen
            </label>
            <div class="ensemble-preview-list" aria-label="Personen für den Import">
              {#each preview.entries as entry (entry.sourceId)}<label class={`ensemble-preview-row ${entry.action === "conflict" ? "conflict" : ""}`}>
                  <input type="checkbox" checked={selection.includes(entry.sourceId)} disabled={importing || entry.action === "conflict"} on:input={(event) => setSelection((current) => event.currentTarget.checked
    ? [...current, entry.sourceId]
    : current.filter((id) => id !== entry.sourceId))} />
                  <span class="ensemble-initials" aria-hidden="true">
                    {initials(entry.name)}
                  </span>
                  <span class="ensemble-person-name">
                    <strong>{entry.name}</strong>
                    {#if entry.action === "conflict"}<span class="small muted">
                        Mehrere mögliche Einträge. Bitte im Katalog prüfen.
                      </span>{/if}
                  </span>
                  <Badge tone={entry.action === "create"
    ? "green"
    : entry.action === "conflict"
        ? "coral"
        : "neutral"}>
                    {entry.action === "create"
    ? "Neu"
    : entry.action === "update"
        ? "Aktualisieren"
        : "Unklar"}
                  </Badge>
                </label>{/each}
            </div>
            {#if !preview.entries.length}<p class="small muted">
                Die Ensemble-Seite enthält zurzeit keine importierbaren Personen.
              </p>{/if}
          {:else}<div class="ensemble-import-start">
            <Download size={30}></Download>
            <h3>Erst ansehen, dann übernehmen</h3>
            <p class="small muted">
              Lade das Ensemble und die Gäste mit Informationen und Porträts. Anschließend wählst du
              aus, welche Personen übernommen werden.
            </p>
            <Button variant="primary" disabled={loading} onClick={() => void load()}>
              {#if loading}<LoaderCircle size={16} className="spin"></LoaderCircle>{:else}<Download size={16}></Download>{/if}
              {loading ? "Ensemble wird geladen …" : "Vorschau laden"}
            </Button>
          </div>{/if}{/if}
      </div>
      <footer class="dialog-footer ensemble-import-footer">
        <span class="small muted" aria-live="polite">
          {importing
    ? `${progress} von ${selection.length} Personen geprüft …`
    : preview && !result
        ? `${selection.length} Personen ausgewählt`
        : ""}
        </span>
        <Button disabled={importing} onClick={onClose}>
          {result ? "Fertig" : "Abbrechen"}
        </Button>
        {#if preview && !result}<Button variant="primary" disabled={importing || !selection.length} onClick={() => void runImport()}>
            {#if importing}<LoaderCircle size={16} className="spin"></LoaderCircle>{:else}<Download size={16}></Download>{/if}
            {importing ? "Wird übernommen …" : "Importieren"}
          </Button>{/if}
      </footer>
    </Modal>
