<script lang="ts">
import { Eye, EyeOff } from "@lucide/svelte";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { subscribeHydration, type PasswordInputProps } from "./password-input";
const effects=createEffects();
type ViewProps = PasswordInputProps;
export let label: ViewProps["label"] = undefined as any;
export let id: ViewProps["id"] = undefined as any;
let inputProps = $$restProps;
const generatedId = createId();
let inputId = id || `password-${generatedId}`;
let visible: boolean = false;
const setVisible = (next: typeof visible | ((current: typeof visible) => typeof visible)) => { visible = typeof next === "function" ? (next as (current: typeof visible) => typeof visible)(visible) : next; };
const hydratedStore = externalStore(subscribeHydration, () => true, () => false);
let hydrated = $hydratedStore; $: hydrated = $hydratedStore;
let actionLabel = `${label} ${visible ? "verbergen" : "anzeigen"}`;

$: inputId = id || `password-${generatedId}`;
$: actionLabel = `${label} ${visible ? "verbergen" : "anzeigen"}`;

</script>

<div class="password-field">
      <label for={inputId}>{label}</label>
      <div class="password-input">
        <input {...inputProps} id={inputId} type={visible ? "text" : "password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <button type="button" class="icon-button password-toggle" aria-label={actionLabel} title={actionLabel} aria-controls={inputId} aria-pressed={visible} disabled={!hydrated || inputProps.disabled} on:pointerdown={(event) => {
    // Keep typed and autofilled input focus when revealing with a pointer.
    if (event.pointerType === "mouse" && event.isPrimary)
        event.preventDefault();
}} on:click={() => setVisible((current) => !current)}>
          {#if visible}<EyeOff size={18} aria-hidden="true"></EyeOff>{:else}<Eye size={18} aria-hidden="true"></Eye>{/if}
        </button>
      </div>
    </div>
