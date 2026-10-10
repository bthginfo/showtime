<script lang="ts">
import { Laptop, Moon, Sun } from "@lucide/svelte";
import { useStoredValue } from "@/shared/client-storage";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
type ViewProps = {
    full?: boolean;
};
export let full: NonNullable<ViewProps["full"]> = false;
const themeStore = useStoredValue<any>("digitalmask-theme", "system");
let theme: any = $themeStore; $: theme = $themeStore;
const setTheme = themeStore.set;
let update = (next: string) => {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next === "system"
        ? matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
        : next);
};
let Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Laptop;


$: Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Laptop;

</script>

{#if full}<div class="segmented">
      {#each [
    ["light", "Hell"],
    ["dark", "Dunkel"],
    ["system", "System"],
] as [key, label] (key)}<button type="button" class={theme === key ? "active" : ""} on:click={() => update(key)}>
          {label}
        </button>{/each}
    </div>{:else}<button type="button" class="icon-button" title={`Darstellung: ${theme === "system" ? "System" : theme === "dark" ? "Dunkel" : "Hell"}`} aria-label="Darstellung wechseln" on:click={() => update(theme === "system" ? "light" : theme === "light" ? "dark" : "system")}>
      <svelte:component this={Icon} size={19}></svelte:component>
    </button>{/if}
