<script lang="ts">
import { ArrowDown, ArrowUp, Plus, Trash2 } from "@lucide/svelte";
import type { TextSection } from "@/shared/document-sections";
import { sectionName } from "@/shared/document-sections";
import { categoriesFor } from "@/shared/domain-categories";
import { useWorkspace } from "@/components/workspace-context";
import { Button, Empty } from "@/components/ui";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
type ViewProps = {
    kind: "looks" | "handovers";
    sections: TextSection[];
    onChange: (sections: TextSection[]) => void;
};
export let kind: ViewProps["kind"] = undefined as any;
export let sections: ViewProps["sections"] = undefined as any;
export let onChange: ViewProps["onChange"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace } = $workspaceStore;
$: ({ workspace } = $workspaceStore);
let options = categoriesFor(kind, workspace.records.categories);
let available = [
    ...options.map((option) => option.key),
    ...sections
        .map((section) => section.key)
        .filter((key) => !options.some((option) => option.key === key)),
];
let update = (key: string, entries: TextSection["entries"]) => onChange(sections.some((section) => section.key === key)
    ? sections.map((section) => (section.key === key ? { ...section, entries } : section))
    : [...sections, { key, entries }]);

$: options = categoriesFor(kind, workspace.records.categories);
$: available = [
    ...options.map((option) => option.key),
    ...sections
        .map((section) => section.key)
        .filter((key) => !options.some((option) => option.key === key)),
];


</script>

<div class="document-sections">
      {#if !available.length}<Empty title="Noch keine Textabschnitte." description="Ein Admin kann passende Abschnittskategorien anlegen."></Empty>{/if}
      {#each available as key (key)}{@const entries = sections.find((section) => section.key === key)?.entries || []}{@const move = (index: number, offset: number) => {
    const next = [...entries];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    update(key, next);
}}<fieldset class="document-section">
            <legend>{sectionName(key, kind, workspace.records.categories)}</legend>
            {#each entries as entry, index (entry.id)}<div class="document-text-entry">
                <div class="document-entry-header">
                  <label class="entry-label">
                    Kurzes Label (optional)
                    <input value={entry.label || ""} maxLength={200} on:input={(event) => update(key, entries.map((row) => row.id === entry.id ? { ...row, label: event.currentTarget.value } : row))} />
                  </label>
                  <div class="document-entry-actions">
                    <button type="button" class="icon-button" disabled={index === 0} aria-label={`${sectionName(key, kind, workspace.records.categories)} Feld ${index + 1} nach oben`} on:click={() => move(index, -1)}>
                      <ArrowUp size={14}></ArrowUp>
                    </button>
                    <button type="button" class="icon-button" disabled={index === entries.length - 1} aria-label={`${sectionName(key, kind, workspace.records.categories)} Feld ${index + 1} nach unten`} on:click={() => move(index, 1)}>
                      <ArrowDown size={14}></ArrowDown>
                    </button>
                    <button type="button" class="icon-button" aria-label={`${sectionName(key, kind, workspace.records.categories)} Feld ${index + 1} entfernen`} on:click={() => update(key, entries.filter((row) => row.id !== entry.id))}>
                      <Trash2 size={15}></Trash2>
                    </button>
                  </div>
                </div>
                <label for={`section-${entry.id}`} class="visually-hidden">
                  {sectionName(key, kind, workspace.records.categories)} · Text {index + 1}
                </label>
                <textarea id={`section-${entry.id}`} rows={4} value={entry.text} maxLength={20000} on:input={(event) => update(key, entries.map((row) => row.id === entry.id ? { ...row, text: event.currentTarget.value } : row))}></textarea>
              </div>{/each}
            <Button onClick={() => update(key, [...entries, { id: crypto.randomUUID(), text: "" }])}>
              <Plus size={15}></Plus>
              {entries.length ? "Textfeld hinzufügen" : "Textfeld anlegen"}
            </Button>
          </fieldset>{/each}
    </div>
