import { Trash2 } from "@lucide/svelte";
import { Button, ErrorMessage, Modal } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-context";
import { value } from "@/shared/client-api";
import { isActiveStaff } from "@/shared/client-members";
import type { DomainRecord } from "@/shared/contracts";
import { maskPlanClock, type MaskPlanBlock, type MaskPlanData, type MaskPlanLane } from "../model";
import { NamePicker } from "./name-picker";
import styles from "./mask-plans.module.css";
import { numberDraft, parseNumberDraft, previewNumberDraft } from "@/shared/number-draft";
export function closeEdited(previous: unknown, next: unknown, close: () => void) {
    if (JSON.stringify(previous) === JSON.stringify(next) ||
        confirm("Diese Formulareingaben verwerfen?"))
        close();
}
export const blockColors = ["", "#83c6a5", "#bfaee0", "#f0c791", "#91c8df", "#e9aebc", "#d5c6a1"];
export { default as PlanOptions } from "./plan-editors.PlanOptions.svelte";
export { default as LaneEditor } from "./plan-editors.LaneEditor.svelte";
export { default as BlockEditor } from "./plan-editors.BlockEditor.svelte";
