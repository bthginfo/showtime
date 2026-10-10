<script lang="ts">
import { ArrowUpRight, Download, MoreHorizontal, Plus, X } from "@lucide/svelte";
import { subscribeMobile } from "@/shared/client-storage";
import styles from "./ui.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { Button, Empty, PageHeader, ActionMenu, Badge, Section, Modal, ExportButton } from "./ui";
const effects=createEffects();
type ViewProps = {
    message: string;
};
export let message: ViewProps["message"] = undefined as any;
let ref = {current: null as HTMLParagraphElement | null};
$: effects.run(0, () => {
    if (message && ref.current?.closest("dialog[open]")) {
        ref.current.focus({ preventScroll: true });
        ref.current.scrollIntoView({ block: "nearest" });
    }
}, [message]);


</script>

{#if message}<p bind:this={ref.current} role="alert" tabindex="-1" class="error-message">
      {message}
    </p>{:else}{/if}
