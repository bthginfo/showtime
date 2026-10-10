<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { Plus } from "@lucide/svelte";
import type { DomainRecord, RecordData } from "@/shared/contracts";
import { value, ids } from "@/shared/client-api";
import { useWorkspace } from "@/components/workspace-context";
import { Button, ErrorMessage, Modal } from "@/components/ui";
import { ResourceEditor } from "@/components/resource-editor";
import { CastingImpact } from "@/components/casting-impact";
import { initialPeriod } from "@/shared/period-filter";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
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
const workspaceStore=useWorkspace();
let { workspace, save, busy } = $workspaceStore;
$: ({ workspace, save, busy } = $workspaceStore);
let initial = { ...defaults, ...record?.data };
let production = lockedProductionId ?? value(initial, "productionId");
const setProduction = (next: typeof production | ((current: typeof production) => typeof production)) => { production = typeof next === "function" ? (next as (current: typeof production) => typeof production)(production) : next; };
let actorId = value(initial, "actorId");
const setActorId = (next: typeof actorId | ((current: typeof actorId) => typeof actorId)) => { actorId = typeof next === "function" ? (next as (current: typeof actorId) => typeof actorId)(actorId) : next; };
let actorName = value(initial, "actorName");
const setActorName = (next: typeof actorName | ((current: typeof actorName) => typeof actorName)) => { actorName = typeof next === "function" ? (next as (current: typeof actorName) => typeof actorName)(actorName) : next; };
let characterId = value(initial, "characterId");
const setCharacterId = (next: typeof characterId | ((current: typeof characterId) => typeof characterId)) => { characterId = typeof next === "function" ? (next as (current: typeof characterId) => typeof characterId)(characterId) : next; };
let characterName = value(initial, "characterName");
const setCharacterName = (next: typeof characterName | ((current: typeof characterName) => typeof characterName)) => { characterName = typeof next === "function" ? (next as (current: typeof characterName) => typeof characterName)(characterName) : next; };
let actorFree = !!initial.actorName && !initial.actorId;
const setActorFree = (next: typeof actorFree | ((current: typeof actorFree) => typeof actorFree)) => { actorFree = typeof next === "function" ? (next as (current: typeof actorFree) => typeof actorFree)(actorFree) : next; };
let characterFree = !!initial.characterName && !initial.characterId;
const setCharacterFree = (next: typeof characterFree | ((current: typeof characterFree) => typeof characterFree)) => { characterFree = typeof next === "function" ? (next as (current: typeof characterFree) => typeof characterFree)(characterFree) : next; };
let alternate = initial.alternate === true;
const setAlternate = (next: typeof alternate | ((current: typeof alternate) => typeof alternate)) => { alternate = typeof next === "function" ? (next as (current: typeof alternate) => typeof alternate)(alternate) : next; };
let notes = value(initial, "notes");
const setNotes = (next: typeof notes | ((current: typeof notes) => typeof notes)) => { notes = typeof next === "function" ? (next as (current: typeof notes) => typeof notes)(notes) : next; };
let creating: "actors" | "characters" | null = initialState<"actors" | "characters" | null>(null);
const setCreating = (next: "actors" | "characters" | null | ((current: "actors" | "characters" | null) => "actors" | "characters" | null)) => { creating = typeof next === "function" ? (next as (current: "actors" | "characters" | null) => "actors" | "characters" | null)(creating) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let data = {
    productionId: production,
    actorId: actorFree ? "" : actorId,
    actorName: actorFree ? actorName.trim() : "",
    characterId: characterFree ? "" : characterId,
    characterName: characterFree ? characterName.trim() : "",
    alternate,
    notes,
    imageIds: ids(record?.data || {}, "imageIds"),
};

$: initial = { ...defaults, ...record?.data };
$: data = {
    productionId: production,
    actorId: actorFree ? "" : actorId,
    actorName: actorFree ? actorName.trim() : "",
    characterId: characterFree ? "" : characterId,
    characterName: characterFree ? characterName.trim() : "",
    alternate,
    notes,
    imageIds: ids(record?.data || {}, "imageIds"),
};

</script>


      <Modal title={`Besetzung ${record ? "bearbeiten" : "anlegen"}`} onClose={onClose} wide>
        <form on:submit={async (event) => {
    event.preventDefault();
    setError("");
    try {
        const saved = await save("casting", data, record);
        onSaved?.(saved);
        onClose();
    }
    catch (exception) {
        setError(exception instanceof Error ? exception.message : "Speichern fehlgeschlagen");
    }
}}>
          <label>
            Produktion
            <select required disabled={lockedProductionId !== undefined || !!record} value={production} on:change={(event) => {
    setProduction(event.currentTarget.value);
    setCharacterId("");
}}>
              <option value="">Stück auswählen</option>
              {#each workspace.records.productions as row (row.id)}<option value={row.id}>
                  {value(row.data, "title")}
                </option>{/each}
            </select>
          </label>
          <div class="form-grid">
            {#each (["character", "actor"] as const) as kind (kind)}{@const figure = kind === "character"}{@const free = figure ? characterFree : actorFree}{@const label = figure ? "Figur" : "Schauspielperson"}{@const rows = figure
    ? workspace.records.characters.filter((row) => row.data.productionId === production)
    : workspace.records.actors}<fieldset class="casting-choice">
                  <legend>{label}</legend>
                  <label class="check-label">
                    <input type="checkbox" checked={free} on:input={(event) => (figure ? setCharacterFree : setActorFree)(event.currentTarget.checked)} />
                    Namen frei eintragen
                  </label>
                  {#if free}<label>
                      {label} · Name
                      <input required maxLength={200} value={figure ? characterName : actorName} on:input={(event) => (figure ? setCharacterName : setActorName)(event.currentTarget.value)} />
                    </label>{:else}
                      <label>
                        {label} auswählen
                        <select required value={figure ? characterId : actorId} on:change={(event) => (figure ? setCharacterId : setActorId)(event.currentTarget.value)}>
                          <option value="">Bitte auswählen</option>
                          {#each rows as row (row.id)}<option value={row.id}>
                              {value(row.data, "name")}
                            </option>{/each}
                        </select>
                      </label>
                      <Button disabled={figure && !production} onClick={() => setCreating(figure ? "characters" : "actors")}>
                          <Plus size={15}></Plus>
                          {figure ? "Figur" : "Schauspielperson"} direkt anlegen
                        </Button>
                    {/if}
                </fieldset>{/each}
          </div>
          <label class="check-label">
            <input type="checkbox" checked={alternate} on:input={(event) => setAlternate(event.currentTarget.checked)} />
            Alternierende Besetzung
          </label>
          <label>
            Hinweise
            <textarea rows={3} value={notes} on:input={(event) => setNotes(event.currentTarget.value)}></textarea>
          </label>
          {#if record}<CastingImpact previous={record} next={data}></CastingImpact>{/if}
          <p class="small muted">
            Fotos lassen sich nach dem Speichern in der Galerie ergänzen. Bestehende Bilder bleiben
            erhalten.
          </p>
          <ErrorMessage message={error}></ErrorMessage>
          <footer class="dialog-footer">
            <Button onClick={onClose}>Abbrechen</Button>
            <Button type="submit" variant="primary" disabled={busy}>
              Speichern
            </Button>
          </footer>
        </form>
      </Modal>
      {#if creating}<ResourceEditor kind={creating} defaults={creating === "characters"
    ? { productionId: production }
    : {
        ensembleSeasons: [
            initialPeriod(workspace.records.productions, production).season,
        ],
    }} lockedProductionId={creating === "characters" ? production : undefined} onClose={() => setCreating(null)} onSaved={(saved) => {
    if (creating === "characters") {
        setCharacterId(saved.id);
        setCharacterFree(false);
    }
    else {
        setActorId(saved.id);
        setActorFree(false);
    }
    setCreating(null);
}}></ResourceEditor>{/if}
