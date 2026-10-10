<script lang="ts">

import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { brandMaskPath } from "./brand-mark";
const effects=createEffects();



</script>

<span class="brand-symbol">
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
        <path d={brandMaskPath} stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"></path>
        <path d="M13 19Q16 16 18 19M22 19Q25 16 28 19M16 26Q20 29 24 26" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>
      </svg>
    </span>
