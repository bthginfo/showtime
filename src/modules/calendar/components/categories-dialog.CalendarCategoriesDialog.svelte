<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { Pencil, Plus, Trash2 } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { value } from "@/shared/client-api";
import { calendarCategoryBehavior } from "@/shared/calendar-categories";
import { useWorkspace } from "@/components/workspace-context";
import { Badge, Button, Empty, ErrorMessage, Modal } from "@/components/ui";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { CategoryEditor } from "./categories-dialog";
const effects=createEffects();
type ViewProps = {
    onClose: () => void;
};
export let onClose: ViewProps["onClose"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace, remove, busy } = $workspaceStore;
$: ({ workspace, remove, busy } = $workspaceStore);
let editing: DomainRecord | "new" | null = initialState<DomainRecord | "new" | null>(null);
const setEditing = (next: DomainRecord | "new" | null | ((current: DomainRecord | "new" | null) => DomainRecord | "new" | null)) => { editing = typeof next === "function" ? (next as (current: DomainRecord | "new" | null) => DomainRecord | "new" | null)(editing) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let records = workspace.records.calendarCategories || [];

$: records = workspace.records.calendarCategories || [];

</script>


      {#if !editing}<Modal title="Kalenderarten verwalten" onClose={onClose}>
          <p class="muted">
            Eigene Dienste, Proben und freie Tage mit passenden Namen und Farben.
          </p>
          <div class="category-manager-heading">
            <span class="small muted">{records.length} Kalenderarten</span>
            <Button variant="primary" onClick={() => setEditing("new")}>
              <Plus size={15}></Plus>
              Kalenderart anlegen
            </Button>
          </div>
          <ErrorMessage message={error}></ErrorMessage>
          {#if records.length}<div class="category-manager-list">
              {#each records as record (record.id)}<article>
                  <span class="category-color" style={styleString({ background: value(record.data, "color") })}></span>
                  <div>
                    <strong>{value(record.data, "name")}</strong>
                    <Badge>
                      {record.data.allDay ? "Ganztägig" : "Mit Uhrzeiten"}
                      {calendarCategoryBehavior(value(record.data, "key"), record.data)
    .background === "service"
    ? " · Arbeitszeit"
    : calendarCategoryBehavior(value(record.data, "key"), record.data)
        .background === "hint"
        ? " · Hinweis"
        : ""}
                    </Badge>
                  </div>
                  <button class="icon-button" aria-label={`${value(record.data, "name")} bearbeiten`} on:click={() => setEditing(record)}>
                    <Pencil size={16}></Pencil>
                  </button>
                  <button class="icon-button" aria-label={`${value(record.data, "name")} löschen`} disabled={busy} on:click={() => {
    if (confirm(`Kalenderart „${value(record.data, "name")}“ löschen? Bereits verwendete Arten können nicht gelöscht werden.`)) {
        setError("");
        void remove(record).catch((exception) => setError(exception instanceof Error
            ? exception.message
            : "Löschen fehlgeschlagen"));
    }
}}>
                    <Trash2 size={16}></Trash2>
                  </button>
                </article>{/each}
            </div>{:else}<Empty title="Noch keine Kalenderarten." description="Lege eure erste Art an, um Dienste oder ganztägige Termine zu planen."></Empty>{/if}
          <footer class="dialog-footer">
            <Button onClick={onClose}>Schließen</Button>
          </footer>
        </Modal>{/if}
      {#if editing}<CategoryEditor record={editing === "new" ? undefined : editing} onClose={() => setEditing(null)}></CategoryEditor>{/if}
