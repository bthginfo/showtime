<script lang="ts">
import { ArrowUpRight, Download, MoreHorizontal, Plus, X } from "@lucide/svelte";
import { subscribeMobile } from "@/shared/client-storage";
import styles from "./ui.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { Empty, PageHeader, ActionMenu, Badge, Section, Modal, ErrorMessage, ExportButton } from "./ui";
const effects=createEffects();
type ViewProps = {
    children: ReactNode;
    onClick?: () => void;
    variant?: string;
    disabled?: boolean;
    type?: "button" | "submit";
    title?: string;
};

export let onClick: ViewProps["onClick"] = undefined as any;
export let variant: NonNullable<ViewProps["variant"]> = "secondary";
export let disabled: ViewProps["disabled"] = undefined as any;
export let type: NonNullable<ViewProps["type"]> = "button";
export let title: ViewProps["title"] = undefined as any;


</script>

<button {...$$restProps} title={title} type={type} class={`button ${variant}`} disabled={disabled} on:click={onClick}>
      <slot />
    </button>
