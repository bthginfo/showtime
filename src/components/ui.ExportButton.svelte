<script lang="ts">
import { ArrowUpRight, Download, MoreHorizontal, Plus, X } from "@lucide/svelte";
import { subscribeMobile } from "@/shared/client-storage";
import styles from "./ui.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { Button, Empty, PageHeader, ActionMenu, Badge, Section, Modal, ErrorMessage } from "./ui";
const effects=createEffects();
type ViewProps = {
    onClick: () => void;
};
export let onClick: ViewProps["onClick"] = undefined as any;


</script>

<Button onClick={onClick}>
      <Download size={16}></Download>
      Exportieren
    </Button>
