<script lang="ts">
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
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { closeEdited, blockColors, LaneEditor, BlockEditor } from "./plan-editors";
const effects=createEffects();
type ViewProps = {
    plan: MaskPlanData;
    creating?: boolean;
    onApply: (plan: MaskPlanData) => void;
    onClose: () => void;
};
export let plan: ViewProps["plan"] = undefined as any;
export let creating: NonNullable<ViewProps["creating"]> = false;
export let onApply: ViewProps["onApply"] = undefined as any;
export let onClose: ViewProps["onClose"] = undefined as any;
let data = plan;
const setData = (next: typeof data | ((current: typeof data) => typeof data)) => { data = typeof next === "function" ? (next as (current: typeof data) => typeof data)(data) : next; };
let windowMinutes = numberDraft(plan.windowMinutes);
const setWindowMinutes = (next: typeof windowMinutes | ((current: typeof windowMinutes) => typeof windowMinutes)) => { windowMinutes = typeof next === "function" ? (next as (current: typeof windowMinutes) => typeof windowMinutes)(windowMinutes) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let close = () => closeEdited({ data: plan, windowMinutes: numberDraft(plan.windowMinutes) }, { data, windowMinutes }, onClose);



</script>

<Modal title={creating ? "Maskenplan anlegen" : "Name & Vorlauf"} onClose={close} className={styles.modal}>
      <form on:submit={(event) => {
    event.preventDefault();
    try {
        onApply({
            ...data,
            windowMinutes: parseNumberDraft(windowMinutes, {
                label: "Vorlauf in Minuten",
                required: true,
                min: 5,
                max: 720,
                integer: true,
            })!,
        });
        onClose();
    }
    catch (exception) {
        setError(exception instanceof Error ? exception.message : "Bitte prüfe den Vorlauf.");
    }
}}>
        <label>
          Planname
          <input required maxLength={200} value={data.title} on:input={(event) => setData({ ...data, title: event.currentTarget.value })} placeholder="Zum Beispiel AMA / HP1+2 / GP / Premiere" />
        </label>
        <div class={styles.formGrid}>
          <label>
            Vorlauf in Minuten
            <input type="number" required min={5} max={720} value={windowMinutes} on:input={(event) => {
    setWindowMinutes(event.currentTarget.value);
    setError("");
}} />
          </label>
          <label>
            Zeitraster
            <select value={data.stepMinutes} on:change={(event) => setData({
    ...data,
    stepMinutes: Number(event.currentTarget.value) as MaskPlanData["stepMinutes"],
})}>
              {#each [1, 5, 10, 15] as step (step)}<option value={step}>
                  {step} {step === 1 ? "Minute" : "Minuten"}
                </option>{/each}
            </select>
          </label>
        </div>
        <p class={styles.hint}>
          Die Tabelle endet bei 0: Vorstellungsbeginn. Frühere Zeitblöcke verlängern den Vorlauf
          automatisch. Ihre Dauer darf vom Raster abweichen.
        </p>
        <label>
          Hinweise zum Plan (optional)
          <textarea maxLength={4000} rows={3} value={data.notes} on:input={(event) => setData({ ...data, notes: event.currentTarget.value })}></textarea>
        </label>
        <ErrorMessage message={error}></ErrorMessage>
        <footer class="dialog-footer">
          <Button onClick={close}>Abbrechen</Button>
          <Button type="submit" variant="primary">
            {creating ? "Plan anlegen" : "Übernehmen"}
          </Button>
        </footer>
      </form>
    </Modal>
