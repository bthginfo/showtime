<script lang="ts">

import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
type ViewProps = {
    label: string;
    icon: ReactNode;
    children: ReactNode;
    className?: string;
    disabled?: boolean;
};
export let label: ViewProps["label"] = undefined as any;
export let icon = undefined as any;
export let children = undefined as any;
export let className: NonNullable<ViewProps["className"]> = "";
export let disabled: NonNullable<ViewProps["disabled"]> = false;
let open: boolean = false;
const setOpen = (next: typeof open | ((current: typeof open) => typeof open)) => { open = typeof next === "function" ? (next as (current: typeof open) => typeof open)(open) : next; };
let container = {current: null as HTMLDivElement | null};
let trigger = {current: null as HTMLButtonElement | null};
const id = createId();
$: effects.run(0, () => {
    if (!open)
        return;
    const dismiss = (event: PointerEvent) => {
        if (!container.current?.contains(event.target as Node))
            setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
        if (event.key !== "Escape")
            return;
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
        document.removeEventListener("pointerdown", dismiss);
        document.removeEventListener("keydown", escape);
    };
}, [open]);


</script>

<div class={`chat-action-menu ${className}`} bind:this={container.current}>
      <button bind:this={trigger.current} type="button" class="chat-compact-button" aria-label={label} title={label} aria-expanded={open} aria-controls={id} disabled={disabled} on:click={() => setOpen(!open)}>
        <slot name="icon" />
      </button>
      {#if open}<div id={id} class="chat-action-popover" role="group" aria-label={label} on:click={(event) => {
    if ((event.target as HTMLElement).closest("button, a"))
        setOpen(false);
}}>
          <slot />
        </div>{/if}
    </div>
