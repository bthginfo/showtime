<script lang="ts">
import { ArrowUpRight, Download, MoreHorizontal, Plus, X } from "@lucide/svelte";
import { subscribeMobile } from "@/shared/client-storage";
import styles from "./ui.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { Button, Empty, PageHeader, ActionMenu, Badge, Modal, ErrorMessage, ExportButton } from "./ui";
const effects=createEffects();
type ViewProps = {
    title: string;
    meta?: string;
    children: ReactNode;
    action?: () => void;
};
export let title: ViewProps["title"] = undefined as any;
export let meta: ViewProps["meta"] = undefined as any;
export let children = undefined as any;
export let action: ViewProps["action"] = undefined as any;


</script>

<section class="panel">
      <header class="panel-heading">
        <div>
          <h2>{title}</h2>
          {#if meta}<span class="muted small">{meta}</span>{/if}
        </div>
        {#if action}<button class="icon-button" aria-label={`${title} öffnen`} on:click={action}>
            <ArrowUpRight size={18}></ArrowUpRight>
          </button>{/if}
      </header>
      <slot />
    </section>
