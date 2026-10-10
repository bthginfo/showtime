<script lang="ts">
import { ArrowUpRight, Download, MoreHorizontal, Plus, X } from "@lucide/svelte";
import { subscribeMobile } from "@/shared/client-storage";
import styles from "./ui.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { Button, PageHeader, ActionMenu, Badge, Section, Modal, ErrorMessage, ExportButton } from "./ui";
const effects=createEffects();
type ViewProps = {
    title: string;
    description: string;
    action?: string;
    onAction?: () => void;
};
export let title: ViewProps["title"] = undefined as any;
export let description: ViewProps["description"] = undefined as any;
export let action: ViewProps["action"] = undefined as any;
export let onAction: ViewProps["onAction"] = undefined as any;


</script>

<div class="empty">
      <div class="empty-mark">
        <Plus size={25} strokeWidth={1.3}></Plus>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {#if action}<Button variant="primary" onClick={onAction}>
          <Plus size={16}></Plus>
          {action}
        </Button>{/if}
    </div>
