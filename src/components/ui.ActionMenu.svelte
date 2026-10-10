<script lang="ts">
import { ArrowUpRight, Download, MoreHorizontal, Plus, X } from "@lucide/svelte";
import { subscribeMobile } from "@/shared/client-storage";
import styles from "./ui.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { Button, Empty, PageHeader, Badge, Section, Modal, ErrorMessage, ExportButton } from "./ui";
const effects=createEffects();
type ViewProps = {
    children: ReactNode;
};
export let children = undefined as any;
let ref = {current: null as HTMLDetailsElement | null};
let expanded: boolean = false;
const setExpanded = (next: typeof expanded | ((current: typeof expanded) => typeof expanded)) => { expanded = typeof next === "function" ? (next as (current: typeof expanded) => typeof expanded)(expanded) : next; };
const mobileStore = externalStore(subscribeMobile, () => window.matchMedia("(max-width: 760px)").matches, () => false);
let mobile = $mobileStore; $: mobile = $mobileStore;
$: effects.run(0, () => {
    const dismiss = (event: PointerEvent) => {
        if (mobile && event.target instanceof Node && !ref.current?.contains(event.target)) {
            if (ref.current)
                ref.current.open = false;
            setExpanded(false);
        }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
}, [mobile]);


</script>

<details bind:this={ref.current} class={styles.actionMenu} open={!mobile || expanded} data-expanded={expanded} on:toggle={(event) => {
    if (mobile)
        setExpanded(event.currentTarget.open);
}} on:keydown={(event) => {
    if (mobile && event.key === "Escape" && ref.current?.open) {
        event.preventDefault();
        ref.current.open = false;
        setExpanded(false);
        ref.current.querySelector("summary")?.focus();
    }
}}>
      <summary class="button secondary" aria-label="Weitere Aktionen">
        <MoreHorizontal size={17}></MoreHorizontal>
        Mehr
      </summary>
      <div class={styles.actionMenuItems} on:click|capture={(event) => {
    if (mobile && event.target instanceof Element && event.target.closest("button")) {
        if (ref.current)
            ref.current.open = false;
        setExpanded(false);
        ref.current?.querySelector("summary")?.focus();
    }
}}>
        <slot />
      </div>
    </details>
