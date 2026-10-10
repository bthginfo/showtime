<script lang="ts">
import { bavarianHoliday } from "@/shared/bavarian-holidays";
import styles from "./holiday-label.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { shortNames } from "./holiday-label";
const effects=createEffects();
type ViewProps = {
    date: string;
    compact?: boolean;
};
export let date: ViewProps["date"] = undefined as any;
export let compact: NonNullable<ViewProps["compact"]> = false;
let name = bavarianHoliday(date);

$: name = bavarianHoliday(date);

</script>

{#if !name}{:else}<span class={`${styles.label} ${compact ? styles.compact : ""}`} data-calendar-holiday={date} title={name} aria-label={`Feiertag: ${name}`}>
      {compact ? shortNames[name] || name : name}
    </span>{/if}
