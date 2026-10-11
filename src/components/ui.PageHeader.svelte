<script lang="ts">
  import { ArrowUpRight, Download, MoreHorizontal, Plus, X } from "@lucide/svelte";
  import { subscribeMobile } from "@/shared/client-storage";
  import styles from "./ui.module.css";
  import {
    createEffects,
    createId,
    externalStore,
    styleString,
    applyRef,
  } from "@/shared/svelte-runtime";
  import type {
    ReactNode,
    CSSProperties,
    Dispatch,
    SetStateAction,
    FormEvent,
    ChangeEvent,
    KeyboardEvent,
    MouseEvent,
    DragEvent,
    ComponentProps,
    RefObject,
  } from "@/shared/ui-types";
  import {
    Button,
    Empty,
    ActionMenu,
    Badge,
    Section,
    Modal,
    ErrorMessage,
    ExportButton,
  } from "./ui";
  const effects = createEffects();
  type ViewProps = {
    title: string;
    description?: string;
    children?: ReactNode;
    secondaryActions?: ReactNode;
    compact?: boolean;
  };
  export let title: ViewProps["title"] = undefined as any;
  export let description: ViewProps["description"] = undefined;

  export let compact: NonNullable<ViewProps["compact"]> = false;
</script>

<header class={`page-heading ${compact ? styles.compactHeader : ""}`}>
  <div>
    <h1>{title}</h1>
    {#if description}<p class="small muted">{description}</p>{/if}
  </div>
  <div class="heading-actions">
    {#if $$slots.secondaryActions}<ActionMenu><slot name="secondaryActions" /></ActionMenu>{/if}
    <slot />
  </div>
</header>
