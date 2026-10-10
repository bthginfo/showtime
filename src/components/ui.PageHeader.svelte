<script lang="ts">
import { ArrowUpRight, Download, MoreHorizontal, Plus, X } from "@lucide/svelte";
import { subscribeMobile } from "@/shared/client-storage";
import styles from "./ui.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { Button, Empty, ActionMenu, Badge, Section, Modal, ErrorMessage, ExportButton } from "./ui";
const effects=createEffects();
type ViewProps = {
    eyebrow?: string;
    title: string;
    description?: string;
    children?: ReactNode;
    secondaryActions?: ReactNode;
    compact?: boolean;
};
export let eyebrow: ViewProps["eyebrow"] = undefined as any;
export let title: ViewProps["title"] = undefined as any;



export let compact: NonNullable<ViewProps["compact"]> = false;


</script>

<header class={`page-heading ${compact ? styles.compactHeader : ""}`}>
      <div>
        {#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
        <h1>{title}</h1>
      </div>
      <div class="heading-actions">
        {#if $$slots.secondaryActions}<ActionMenu><slot name="secondaryActions" /></ActionMenu>{/if}
        <slot />
      </div>
    </header>
