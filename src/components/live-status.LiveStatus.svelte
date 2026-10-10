<script lang="ts">
import { useWorkspace } from "./workspace-context";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { labels, descriptions } from "./live-status";
const effects=createEffects();
type ViewProps = {
    recovery?: boolean;
    compact?: boolean;
};
export let recovery: NonNullable<ViewProps["recovery"]> = false;
export let compact: NonNullable<ViewProps["compact"]> = false;
const workspaceStore=useWorkspace();
let { syncStatus, refresh, busy, online } = $workspaceStore;
$: ({ syncStatus, refresh, busy, online } = $workspaceStore);


</script>

<div class={`live-status is-${syncStatus}${compact ? " is-compact" : ""}`}>
      <span role="status" title={descriptions[syncStatus]}>
        <i aria-hidden="true"></i>
        <span class={compact ? "visually-hidden" : undefined}>{labels[syncStatus]}</span>
      </span>
      {#if recovery && syncStatus === "unavailable"}<button class="text-button" disabled={busy || !online} on:click={() => void refresh()}>
          Erneut versuchen
        </button>{/if}
    </div>
