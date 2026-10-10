<script lang="ts">
import { ArrowUpRight, Download, MoreHorizontal, Plus, X } from "@lucide/svelte";
import { subscribeMobile } from "@/shared/client-storage";
import styles from "./ui.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { Button, Empty, PageHeader, ActionMenu, Badge, Section, ErrorMessage, ExportButton } from "./ui";
const effects=createEffects();
type ViewProps = {
    title: string;
    children: ReactNode;
    onClose: () => void;
    wide?: boolean;
    className?: string;
};
export let title: ViewProps["title"] = undefined as any;
export let children = undefined as any;
export let onClose: ViewProps["onClose"] = undefined as any;
export let wide: NonNullable<ViewProps["wide"]> = false;
export let className: NonNullable<ViewProps["className"]> = "";
let ref = {current: null as HTMLDialogElement | null};
const titleId = createId();
$: effects.run(0, () => {
    const el = ref.current;
    const previousFocus = document.activeElement;
    el?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.setProperty("overflow", "hidden");
    return () => {
        el?.close();
        document.body.style.setProperty("overflow", previous);
        if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
            previousFocus.focus();
    };
}, []);
$: effects.run(1, () => {
    const viewport = window.visualViewport;
    if (!viewport)
        return;
    const update = () => {
        ref.current?.style.setProperty("--dialog-viewport-height", `${viewport.height}px`);
        ref.current?.style.setProperty("--dialog-viewport-top", `${viewport.offsetTop}px`);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
        viewport.removeEventListener("resize", update);
        viewport.removeEventListener("scroll", update);
    };
}, []);


</script>

<dialog bind:this={ref.current} aria-labelledby={titleId} class={`dialog ${styles.modal} ${wide ? "wide" : ""} ${className}`} on:cancel={(event) => {
    event.preventDefault();
    onClose();
}} on:click={(event) => {
    if (event.target === event.currentTarget) {
        const bounds = ref.current?.getBoundingClientRect();
        if (bounds &&
            (event.clientX < bounds.left ||
                event.clientX > bounds.right ||
                event.clientY < bounds.top ||
                event.clientY > bounds.bottom))
            onClose();
    }
}}>
      <header class="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button class="icon-button" on:click={onClose} aria-label="Schließen">
          <X size={20}></X>
        </button>
      </header>
      <slot />
    </dialog>
