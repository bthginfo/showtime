<script lang="ts">
import { Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen } from "@lucide/svelte";
import styles from "./calendar-presentation.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { useCalendarPresentation } from "./calendar-presentation-controls";
const effects=createEffects();
type ViewProps = {
    collapsed: boolean;
    fullscreen: boolean;
    filtersId: string;
    onToggleFilters: () => void;
    onToggleFullscreen: () => void;
};
export let collapsed: ViewProps["collapsed"] = undefined as any;
export let fullscreen: ViewProps["fullscreen"] = undefined as any;
export let filtersId: ViewProps["filtersId"] = undefined as any;
export let onToggleFilters: ViewProps["onToggleFilters"] = undefined as any;
export let onToggleFullscreen: ViewProps["onToggleFullscreen"] = undefined as any;
let PanelIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
let ScreenIcon = fullscreen ? Minimize2 : Maximize2;

$: PanelIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
$: ScreenIcon = fullscreen ? Minimize2 : Maximize2;

</script>

<div class={styles.controls} aria-label="Kalenderdarstellung">
      <button type="button" class="button" aria-expanded={!collapsed} aria-controls={filtersId} on:click={onToggleFilters}>
        <svelte:component this={PanelIcon} size={16} aria-hidden="true"/>
        {collapsed ? "Filter einblenden" : "Filter einklappen"}
      </button>
      <button type="button" class="button" aria-pressed={fullscreen} on:click={onToggleFullscreen} title={fullscreen ? "Vollbild verlassen (Escape)" : "Kalender im Vollbild anzeigen"}>
        <svelte:component this={ScreenIcon} size={16} aria-hidden="true"/>
        {fullscreen ? "Vollbild verlassen" : "Vollbild"}
      </button>
    </div>
