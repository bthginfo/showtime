<script lang="ts">
import { textLinks } from "@/shared/text-links";
import styles from "./linked-text.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
type ViewProps = {
    children: string;
};
export let text: string;


</script>


      {#each textLinks(text) as part, index}{#if part.href}<a href={part.href} class={styles.link} target="_blank" rel="noopener noreferrer" on:click={(event) => event.stopPropagation()}>
            {part.text}
          </a>{:else}{part.text}{/if}{/each}
