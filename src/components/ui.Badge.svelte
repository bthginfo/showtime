<script lang="ts">
import { ArrowUpRight, Download, MoreHorizontal, Plus, X } from "@lucide/svelte";
import { subscribeMobile } from "@/shared/client-storage";
import styles from "./ui.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { Button, Empty, PageHeader, ActionMenu, Section, Modal, ErrorMessage, ExportButton } from "./ui";
const effects=createEffects();
type ViewProps = {
    children: ReactNode;
    tone?: string;
};
export let children = undefined as any;
export let tone: NonNullable<ViewProps["tone"]> = "neutral";


</script>

<span class={`badge ${tone}`}><slot /></span>
