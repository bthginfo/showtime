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
import { closeEdited, blockColors, PlanOptions, BlockEditor } from "./plan-editors";
const effects=createEffects();
type ViewProps = {
    lane: MaskPlanLane;
    creating?: boolean;
    blockCount: number;
    onApply: (lane: MaskPlanLane) => void;
    onRemove: () => void;
    onClose: () => void;
};
export let lane: ViewProps["lane"] = undefined as any;
export let creating: NonNullable<ViewProps["creating"]> = false;
export let blockCount: ViewProps["blockCount"] = undefined as any;
export let onApply: ViewProps["onApply"] = undefined as any;
export let onRemove: ViewProps["onRemove"] = undefined as any;
export let onClose: ViewProps["onClose"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace } = $workspaceStore;
$: ({ workspace } = $workspaceStore);
let data = lane;
const setData = (next: typeof data | ((current: typeof data) => typeof data)) => { data = typeof next === "function" ? (next as (current: typeof data) => typeof data)(data) : next; };
let members = workspace.members.filter((member) => member.role !== "superadmin" && (isActiveStaff(member) || data.memberIds.includes(member.id)));
let missing = data.memberIds.filter((id) => !workspace.members.some((member) => member.id === id));

$: members = workspace.members.filter((member) => member.role !== "superadmin" && (isActiveStaff(member) || data.memberIds.includes(member.id)));
$: missing = data.memberIds.filter((id) => !workspace.members.some((member) => member.id === id));

</script>

<Modal title={creating ? "Personalspalte hinzufügen" : "Personalspalte bearbeiten"} onClose={() => closeEdited(lane, data, onClose)} className={styles.modal}>
      <form on:submit={(event) => {
    event.preventDefault();
    onApply(data);
    onClose();
}}>
        <label>
          Spaltenname (optional)
          <input maxLength={200} value={data.label} on:input={(event) => setData({ ...data, label: event.currentTarget.value })} placeholder="Zum Beispiel Platz 1 oder gemeinsam" />
        </label>
        <NamePicker legend="Maskenpersonal" options={[
    ...members.map((member) => ({
        id: member.id,
        name: member.name,
        historical: !isActiveStaff(member),
    })),
    ...missing.map((id) => ({ id, name: "Frühere Maskenperson", historical: true })),
]} selected={data.memberIds} names={data.staffNames} onSelected={(memberIds) => setData({ ...data, memberIds })} onNames={(staffNames) => setData({ ...data, staffNames })}></NamePicker>
        <p class={styles.hint}>
          Mehrere Personen dürfen eine Spalte teilen. Freie Namen benötigen keinen Account.
        </p>
        <footer class={`dialog-footer ${styles.editorFooter}`}>
          {#if !creating}<Button variant="danger-ghost" onClick={() => {
    if (confirm(`Diese Personalspalte und ${blockCount ? `alle ${blockCount} zugehörigen Zeitblöcke` : "ihre Zuordnung"} aus dem Entwurf entfernen? Die Änderung gilt erst nach dem Speichern des Plans.`)) {
        onRemove();
        onClose();
    }
}}>
              <Trash2 size={16}></Trash2>
              Spalte entfernen
            </Button>{/if}
          <Button onClick={() => closeEdited(lane, data, onClose)}>Abbrechen</Button>
          <Button type="submit" variant="primary">
            Übernehmen
          </Button>
        </footer>
      </form>
    </Modal>
