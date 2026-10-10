<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { Pencil, Plus, Trash2 } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { categoriesFor, type CategoryScope } from "@/shared/domain-categories";
import { value } from "@/shared/client-api";
import { useWorkspace } from "@/components/workspace-context";
import { Button, Empty, ErrorMessage, Modal } from "@/components/ui";
import { numberDraft, parseNumberDraft } from "@/shared/number-draft";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { scopes, CategoryEditor } from "./category-manager";
const effects=createEffects();
type ViewProps = {
    scope: CategoryScope;
    onClose: () => void;
};
export let scope: ViewProps["scope"] = undefined as any;
export let onClose: ViewProps["onClose"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace, remove, busy } = $workspaceStore;
$: ({ workspace, remove, busy } = $workspaceStore);
let editing: DomainRecord | "new" | null = initialState<DomainRecord | "new" | null>(null);
const setEditing = (next: DomainRecord | "new" | null | ((current: DomainRecord | "new" | null) => DomainRecord | "new" | null)) => { editing = typeof next === "function" ? (next as (current: DomainRecord | "new" | null) => DomainRecord | "new" | null)(editing) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let rows = (workspace.records.categories || []).filter((row) => row.data.scope === scope);

$: rows = (workspace.records.categories || []).filter((row) => row.data.scope === scope);

</script>


      {#if !editing}<Modal title={`${scopes[scope]} verwalten`} onClose={onClose}>
          <p class="muted">
            Bezeichnungen, Reihenfolge und Farben für euren Arbeitsalltag. Verwendete Kategorien
            bleiben geschützt.
          </p>
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus size={15}></Plus>
            Kategorie anlegen
          </Button>
          <ErrorMessage message={error}></ErrorMessage>
          <div class="category-manager-list">
            {#each rows
    .sort((a, b) => Number(a.data.order) - Number(b.data.order)) as row (row.id)}<article>
                  <span class="category-color" style={styleString({ background: value(row.data, "color") })}></span>
                  <div>
                    <strong>{value(row.data, "name")}</strong>
                  </div>
                  <button class="icon-button" aria-label={`${value(row.data, "name")} bearbeiten`} on:click={() => setEditing(row)}>
                    <Pencil size={15}></Pencil>
                  </button>
                  <button class="icon-button" disabled={busy} aria-label={`${value(row.data, "name")} löschen`} on:click={() => {
    if (confirm("Ungenutzte Kategorie löschen?"))
        void remove(row).catch((exception) => setError(exception.message));
}}>
                    <Trash2 size={15}></Trash2>
                  </button>
                </article>{/each}
          </div>
          {#if !rows.length}<Empty title="Noch keine Kategorien." description="Lege die erste passende Bezeichnung an."></Empty>{/if}
        </Modal>{/if}
      {#if editing}<CategoryEditor scope={scope} record={editing === "new" ? undefined : editing} onClose={() => setEditing(null)}></CategoryEditor>{/if}
