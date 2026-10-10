<script lang="ts">
import { ArrowUpRight } from "@lucide/svelte";
import { recordHref } from "@/shared/client-navigation";
import type { DomainRecord } from "@/shared/contracts";
import { navigateRecord } from "@/shared/client-navigation";
import styles from "./record-links.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
type ViewProps = {
    record: DomainRecord;
    from?: DomainRecord;
    onNavigate?: () => void;
    children: ReactNode;
    decoration?: boolean;
} & Omit<ComponentProps<"a">, "href" | "onClick">;
export let record: ViewProps["record"] = undefined as any;
export let from: ViewProps["from"] = undefined as any;
export let onNavigate: ViewProps["onNavigate"] = undefined as any;
export let children = undefined as any;
export let className: NonNullable<ViewProps["className"]> = "";
export let decoration: NonNullable<ViewProps["decoration"]> = true;
let props = $$restProps;


</script>

<a {...props} href={recordHref(record)} class={`${decoration ? styles.link : styles.plain} ${className}`} on:click={(event) => {
    if (event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        props.target === "_blank" ||
        props.download !== undefined)
        return;
    event.preventDefault();
    navigateRecord(record, { from, beforeNavigate: onNavigate });
}}>
      <slot />
      {#if decoration}<ArrowUpRight size={14} aria-hidden="true"></ArrowUpRight>{/if}
    </a>
