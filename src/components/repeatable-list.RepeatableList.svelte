<script lang="ts">
import { Plus, Trash2, ArrowUp, ArrowDown } from "@lucide/svelte";
import { Button } from "./ui";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
type ViewProps = {
    label: string;
    items: {
        text: string;
        done?: boolean;
    }[];
    onChange: (items: {
        text: string;
        done?: boolean;
    }[]) => void;
    checklist?: boolean;
};
export let label: ViewProps["label"] = undefined as any;
export let items: ViewProps["items"] = undefined as any;
export let onChange: ViewProps["onChange"] = undefined as any;
export let checklist: NonNullable<ViewProps["checklist"]> = false;
let move = (index: number, offset: number) => {
    const next = [...items];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
};



</script>

<fieldset class="repeatable-list field-wide">
      <legend>{label}</legend>
      {#each items as item, index (index)}<div class="repeatable-row">
          {#if checklist}<input type="checkbox" aria-label={`Punkt ${index + 1} erledigt`} checked={item.done === true} on:input={(event) => onChange(items.map((entry, i) => i === index ? { ...entry, done: event.currentTarget.checked } : entry))} />{/if}
          <input aria-label={`${label} · Eintrag ${index + 1}`} value={item.text} maxLength={checklist ? 1000 : 100} on:input={(event) => onChange(items.map((entry, i) => i === index ? { ...entry, text: event.currentTarget.value } : entry))} />
          <button type="button" class="icon-button" aria-label={`Eintrag ${index + 1} nach oben`} disabled={index === 0} on:click={() => move(index, -1)}>
            <ArrowUp size={14}></ArrowUp>
          </button>
          <button type="button" class="icon-button" aria-label={`Eintrag ${index + 1} nach unten`} disabled={index === items.length - 1} on:click={() => move(index, 1)}>
            <ArrowDown size={14}></ArrowDown>
          </button>
          <button type="button" class="icon-button" aria-label={`Eintrag ${index + 1} entfernen`} on:click={() => onChange(items.filter((_, i) => i !== index))}>
            <Trash2 size={15}></Trash2>
          </button>
        </div>{/each}
      <Button onClick={() => onChange([...items, { text: "", ...(checklist ? { done: false } : {}) }])}>
        <Plus size={15}></Plus>
        Eintrag hinzufügen
      </Button>
    </fieldset>
