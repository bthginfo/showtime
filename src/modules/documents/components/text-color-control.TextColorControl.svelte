<script lang="ts">
import type {Editor} from "@tiptap/core";
import { Baseline, RotateCcw } from "@lucide/svelte";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { pickerColor } from "./text-color-control";
const effects=createEffects();
type ViewProps = {
    editor: Editor | null;
    editable: boolean;
    color?: string;
};
export let editor: ViewProps["editor"] = undefined as any;
export let editable: ViewProps["editable"] = undefined as any;
export let color: ViewProps["color"] = undefined as any;


</script>

<div class="document-color-controls">
      <label class="document-color-control" title="Schriftfarbe">
        <Baseline size={17} aria-hidden="true"></Baseline>
        <input type="color" aria-label="Schriftfarbe" value={pickerColor(color)} disabled={!editable || !editor} on:input={(event) => editor?.chain().focus().setColor(event.currentTarget.value).run()} />
      </label>
      <button type="button" class="document-tool" title="Schriftfarbe zurücksetzen" aria-label="Schriftfarbe zurücksetzen" disabled={!editable || !editor || !color} on:mousedown={(event) => event.preventDefault()} on:click={() => editor?.chain().focus().unsetColor().run()}>
        <RotateCcw size={16}></RotateCcw>
      </button>
    </div>
