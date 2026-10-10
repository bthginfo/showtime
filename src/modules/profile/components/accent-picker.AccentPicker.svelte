<script lang="ts">
import { Check } from "@lucide/svelte";
import { accentPalettes, type AccentPalette } from "@/shared/contracts";
import { useWorkspace } from "@/components/workspace-context";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { paletteNames, ProfileAccent, useAccentPreview } from "./accent-picker";
const effects=createEffects();
type ViewProps = {
    value: AccentPalette;
    onChange: (value: AccentPalette) => void;
};
export let value: ViewProps["value"] = undefined as any;
export let onChange: ViewProps["onChange"] = undefined as any;
const group = createId();


</script>

<fieldset class="accent-picker">
      <legend>Deine Akzentfarbe</legend>
      <p class="small muted">
        Dein Arbeitsraum, deine Farbe. Produktions-, Kalender- und Statusfarben bleiben unverändert.
      </p>
      <div class="accent-options">
        {#each accentPalettes as palette (palette)}<label class={`accent-option ${value === palette ? "selected" : ""}`}>
            <input type="radio" name={group} value={palette} checked={value === palette} on:input={() => onChange(palette)} />
            <span class={`accent-swatch swatch-${palette}`} aria-hidden="true">
              {#if value === palette}<Check size={17}></Check>{/if}
            </span>
            <span>
              {paletteNames[palette]}
              {#if palette === "green"}<span class="small muted">Standard</span>{/if}
            </span>
          </label>{/each}
      </div>
    </fieldset>
