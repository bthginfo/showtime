<script lang="ts">
import { LinkedText } from "@/components/linked-text";
import { Building2, Pencil, Trash2 } from "@lucide/svelte";
import { Button, ErrorMessage, Modal } from "@/components/ui";
import { PersonRelationships } from "@/components/record-relationships";
import { useWorkspace } from "@/components/workspace-context";
import { textValue, type DomainRecord } from "@/shared/contracts";
import { canManageRecord } from "@/shared/record-permissions";
import { PersonContactLinks } from "./person-contact-links";
import { PersonEditor } from "./person-editor";
import styles from "./people.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
type ViewProps = {
    record: DomainRecord;
    onClose: () => void;
    onNavigate?: () => void;
};
export let record: ViewProps["record"] = undefined as any;
export let onClose: ViewProps["onClose"] = undefined as any;
export let onNavigate: NonNullable<ViewProps["onNavigate"]> = onClose;
const workspaceStore=useWorkspace();
let { workspace, busy, online, remove, notify } = $workspaceStore;
$: ({ workspace, busy, online, remove, notify } = $workspaceStore);
let editing: boolean = false;
const setEditing = (next: typeof editing | ((current: typeof editing) => typeof editing)) => { editing = typeof next === "function" ? (next as (current: typeof editing) => typeof editing)(editing) : next; };
let confirmDelete: boolean = false;
const setConfirmDelete = (next: typeof confirmDelete | ((current: typeof confirmDelete) => typeof confirmDelete)) => { confirmDelete = typeof next === "function" ? (next as (current: typeof confirmDelete) => typeof confirmDelete)(confirmDelete) : next; };
let deleting: boolean = false;
const setDeleting = (next: typeof deleting | ((current: typeof deleting) => typeof deleting)) => { deleting = typeof next === "function" ? (next as (current: typeof deleting) => typeof deleting)(deleting) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let current: any = workspace.records.people.find((person) => person.id === record.id) || record;
let canManage = canManageRecord(workspace.user, "people", current);
let close = () => {
    if (!deleting)
        onClose();
};

$: current = workspace.records.people.find((person) => person.id === record.id) || record;
$: canManage = canManageRecord(workspace.user, "people", current);


</script>

{#if editing}<PersonEditor record={current} onClose={() => setEditing(false)}></PersonEditor>{:else}<Modal title={confirmDelete ? "Kontakt löschen?" : "Kontaktdetails"} onClose={close} wide>
      <article class={styles.detail}>
        {#if confirmDelete}
            <p class={styles.intro}>
              <strong>{textValue(current.data.name)}</strong> wird aus dem Verzeichnis entfernt.
              Kontakte, die einer Produktion zugeordnet sind, bleiben geschützt.
            </p>
            <ErrorMessage message={error}></ErrorMessage>
            <div class={styles.actions}>
              <Button disabled={deleting} onClick={() => setConfirmDelete(false)}>
                Abbrechen
              </Button>
              <Button variant="danger-ghost" disabled={busy || deleting || !online} onClick={async () => {
    setDeleting(true);
    setError("");
    try {
        await remove(current);
        notify("Kontakt gelöscht.");
        onClose();
    }
    catch (failure) {
        setError(failure instanceof Error
            ? failure.message
            : "Der Kontakt konnte nicht gelöscht werden.");
    }
    finally {
        setDeleting(false);
    }
}}>
                {deleting ? "Wird gelöscht …" : "Kontakt löschen"}
              </Button>
            </div>
          {:else}
            <h3 class={styles.detailTitle}>{textValue(current.data.name)}</h3>
            {#if textValue(current.data.position)}<p class="muted">{textValue(current.data.position)}</p>{/if}
            <dl class={styles.details}>
              <div>
                <dt>
                  <Building2 size={13}></Building2> Organisation
                </dt>
                <dd>{textValue(current.data.organization) || "Nicht hinterlegt"}</dd>
              </div>
              {#if textValue(current.data.notes)}<div>
                  <dt>Notizen</dt>
                  <dd>
                    <LinkedText text={textValue(current.data.notes)}></LinkedText>
                  </dd>
                </div>{/if}
            </dl>
            <PersonContactLinks data={current.data}></PersonContactLinks>
            <PersonRelationships record={current} onNavigate={onNavigate}></PersonRelationships>
            <div class={styles.actions}>
              {#if canManage}
                  <Button onClick={() => setEditing(true)} disabled={busy || !online}>
                    <Pencil size={15}></Pencil>
                    Bearbeiten
                  </Button>
                  <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)} disabled={busy || !online}>
                    <Trash2 size={15}></Trash2>
                    Löschen
                  </Button>
                {/if}
              <Button onClick={close}>Schließen</Button>
            </div>
          {/if}
      </article>
    </Modal>{/if}
