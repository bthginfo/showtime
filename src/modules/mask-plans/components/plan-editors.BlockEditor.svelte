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
import { closeEdited, blockColors, PlanOptions, LaneEditor } from "./plan-editors";
const effects=createEffects();
type ViewProps = {
    block: MaskPlanBlock;
    plan: MaskPlanData;
    castActors: DomainRecord[];
    castNames: string[];
    performanceTime: string;
    creating?: boolean;
    onApply: (block: MaskPlanBlock) => void;
    onRemove: () => void;
    onClose: () => void;
};
export let block: ViewProps["block"] = undefined as any;
export let plan: ViewProps["plan"] = undefined as any;
export let castActors: ViewProps["castActors"] = undefined as any;
export let castNames: ViewProps["castNames"] = undefined as any;
export let performanceTime: ViewProps["performanceTime"] = undefined as any;
export let creating: NonNullable<ViewProps["creating"]> = false;
export let onApply: ViewProps["onApply"] = undefined as any;
export let onRemove: ViewProps["onRemove"] = undefined as any;
export let onClose: ViewProps["onClose"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace } = $workspaceStore;
$: ({ workspace } = $workspaceStore);
let data = block;
const setData = (next: typeof data | ((current: typeof data) => typeof data)) => { data = typeof next === "function" ? (next as (current: typeof data) => typeof data)(data) : next; };
let startMinutes = numberDraft(-block.startMinutes);
const setStartMinutes = (next: typeof startMinutes | ((current: typeof startMinutes) => typeof startMinutes)) => { startMinutes = typeof next === "function" ? (next as (current: typeof startMinutes) => typeof startMinutes)(startMinutes) : next; };
let durationMinutes = numberDraft(block.durationMinutes);
const setDurationMinutes = (next: typeof durationMinutes | ((current: typeof durationMinutes) => typeof durationMinutes)) => { durationMinutes = typeof next === "function" ? (next as (current: typeof durationMinutes) => typeof durationMinutes)(durationMinutes) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let actors = [
    ...castActors,
    ...workspace.records.actors.filter((actor) => data.actorIds.includes(actor.id) &&
        !castActors.some((candidate) => candidate.id === actor.id)),
];
let unknown = data.actorIds.filter((id) => !actors.some((actor) => actor.id === id));
let startValue = previewNumberDraft(startMinutes, { min: 1, max: 720, integer: true });
let durationValue = previewNumberDraft(durationMinutes, { min: 1, max: 720, integer: true });
let end = startValue === undefined || durationValue === undefined
    ? undefined
    : -startValue + durationValue;
let clock = startValue === undefined ? "" : maskPlanClock(-startValue, performanceTime);
let close = () => closeEdited({
    data: block,
    startMinutes: numberDraft(-block.startMinutes),
    durationMinutes: numberDraft(block.durationMinutes),
}, { data, startMinutes, durationMinutes }, onClose);

$: actors = [
    ...castActors,
    ...workspace.records.actors.filter((actor) => data.actorIds.includes(actor.id) &&
        !castActors.some((candidate) => candidate.id === actor.id)),
];
$: unknown = data.actorIds.filter((id) => !actors.some((actor) => actor.id === id));
$: startValue = previewNumberDraft(startMinutes, { min: 1, max: 720, integer: true });
$: durationValue = previewNumberDraft(durationMinutes, { min: 1, max: 720, integer: true });
$: end = startValue === undefined || durationValue === undefined
    ? undefined
    : -startValue + durationValue;
$: clock = startValue === undefined ? "" : maskPlanClock(-startValue, performanceTime);


</script>

<Modal title={creating ? "Zeitblock hinzufügen" : "Zeitblock bearbeiten"} onClose={close} wide className={styles.modal}>
      <form on:submit={(event) => {
    event.preventDefault();
    let parsedStart: number, parsedDuration: number;
    try {
        parsedStart = -parseNumberDraft(startMinutes, {
            label: "Minuten vor Beginn",
            required: true,
            min: 1,
            max: 720,
            integer: true,
        })!;
        parsedDuration = parseNumberDraft(durationMinutes, {
            label: "Dauer in Minuten",
            required: true,
            min: 1,
            max: 720,
            integer: true,
        })!;
    }
    catch (exception) {
        setError(exception instanceof Error ? exception.message : "Bitte prüfe Zeit und Dauer.");
        return;
    }
    if (parsedStart + parsedDuration > 0) {
        setError("Der Zeitblock endet nach dem Vorstellungsbeginn. Verkürze die Dauer oder beginne früher.");
        return;
    }
    if (!(data.title.trim() || data.actorIds.length || data.actorNames.length)) {
        setError("Wähle mindestens eine Schauspielperson oder trage eine Tätigkeit ein.");
        return;
    }
    onApply({ ...data, startMinutes: parsedStart, durationMinutes: parsedDuration });
    onClose();
}}>
        <label>
          Personalspalte
          <select required value={data.laneId} on:change={(event) => setData({ ...data, laneId: event.currentTarget.value })}>
            {#each plan.lanes as lane, index (lane.id)}<option value={lane.id}>
                {[
    lane.label,
    ...lane.memberIds.map((id) => workspace.members.find((member) => member.id === id)?.name),
    ...lane.staffNames,
]
    .filter(Boolean)
    .join(" / ") || `Spalte ${index + 1}`}
              </option>{/each}
          </select>
        </label>
        <div class={styles.formGrid}>
          <label>
            Minuten vor Beginn
            <input required type="number" min={1} max={720} value={startMinutes} on:input={(event) => {
    setStartMinutes(event.currentTarget.value);
    setError("");
}} />
          </label>
          <label>
            Dauer in Minuten
            <input required type="number" min={1} max={720} value={durationMinutes} on:input={(event) => {
    setDurationMinutes(event.currentTarget.value);
    setError("");
}} />
          </label>
        </div>
        <p class={styles.timingPreview}>
          {#if end === undefined}{"Bitte Zeit und Dauer eintragen."}{:else}
              Von {-startValue!} bis {end === 0 ? "0 · Beginn" : end} Minuten
              {clock ? ` · ${clock}–${maskPlanClock(end, performanceTime)}` : ""}
            {/if}
        </p>
        <NamePicker legend="Schauspieler aus dieser Besetzung" options={[
    ...actors.map((actor) => ({
        id: actor.id,
        name: value(actor.data, "name"),
        historical: !castActors.some((candidate) => candidate.id === actor.id),
    })),
    ...unknown.map((id) => ({ id, name: "Frühere Schauspielperson", historical: true })),
]} selected={data.actorIds} names={data.actorNames} suggestions={castNames} onSelected={(actorIds) => setData({ ...data, actorIds })} onNames={(actorNames) => setData({ ...data, actorNames })}></NamePicker>
        <label>
          Tätigkeit / Zusatz (optional)
          <input maxLength={500} value={data.title} on:input={(event) => setData({ ...data, title: event.currentTarget.value })} placeholder="Zum Beispiel Ins Studio rüber" />
        </label>
        <label>
          Hinweise (optional)
          <textarea rows={3} maxLength={4000} value={data.notes} on:input={(event) => setData({ ...data, notes: event.currentTarget.value })}></textarea>
        </label>
        <fieldset class={styles.colors}>
          <legend>Blockfarbe</legend>
          {#each blockColors as color, index (color)}<label class={styles.colorChoice} style={styleString(color ? ({ "--choice-color": color } as CSSProperties) : undefined)}>
              <input type="radio" name="block-color" checked={data.color === color} on:input={() => setData({ ...data, color })} />
              <span class={color ? styles.swatch : styles.defaultSwatch} aria-hidden="true"></span>
              <span>
                {["Standard", "Grün", "Lavendel", "Apricot", "Blau", "Rosé", "Sand"][index]}
              </span>
            </label>{/each}
        </fieldset>
        <label>
          Eigene Farbe (optional)
          <input type="color" value={data.color || "#83c6a5"} on:input={(event) => setData({ ...data, color: event.currentTarget.value })} />
        </label>
        <ErrorMessage message={error}></ErrorMessage>
        <footer class={`dialog-footer ${styles.editorFooter}`}>
          {#if !creating}<Button variant="danger-ghost" onClick={() => {
    if (confirm("Diesen Zeitblock aus dem Entwurf entfernen? Die Änderung gilt erst nach dem Speichern des Plans.")) {
        onRemove();
        onClose();
    }
}}>
              <Trash2 size={16}></Trash2>
              Block entfernen
            </Button>{/if}
          <Button onClick={close}>Abbrechen</Button>
          <Button type="submit" variant="primary">
            Übernehmen
          </Button>
        </footer>
      </form>
    </Modal>
