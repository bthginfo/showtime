<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { Save } from "@lucide/svelte";
import { Button, ErrorMessage, Modal } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-context";
import { textValue, type DomainRecord, type RecordData } from "@/shared/contracts";
import { isDirectoryPerson } from "./person-data";
import styles from "./people.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { type PersonEditorProps, fields } from "./person-editor";
const effects=createEffects();
type ViewProps = PersonEditorProps;
export let record: ViewProps["record"] = undefined as any;
export let defaults: ViewProps["defaults"] = undefined as any;
export let onClose: ViewProps["onClose"] = undefined as any;
export let onSaved: ViewProps["onSaved"] = undefined as any;
export let embedded: NonNullable<ViewProps["embedded"]> = false;
export let onSelectExisting: ViewProps["onSelectExisting"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace, save, busy, online, notify } = $workspaceStore;
$: ({ workspace, save, busy, online, notify } = $workspaceStore);
let draft: RecordData = initialState<RecordData>((() => ({ ...defaults, ...record?.data }))());
const setDraft = (next: RecordData | ((current: RecordData) => RecordData)) => { draft = typeof next === "function" ? (next as (current: RecordData) => RecordData)(draft) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let saving: boolean = false;
const setSaving = (next: typeof saving | ((current: typeof saving) => typeof saving)) => { saving = typeof next === "function" ? (next as (current: typeof saving) => typeof saving)(saving) : next; };
let pending = {current: false as any | null};
let container = {current: null as HTMLDivElement | null};
const id = createId();
let disabled = saving || busy || !online;
let duplicates = workspace.records.people.filter((person) => isDirectoryPerson(person) &&
    person.id !== record?.id &&
    textValue(person.data.name).trim().toLocaleLowerCase("de") ===
        textValue(draft.name).trim().toLocaleLowerCase("de"));
let close = () => {
    if (!pending.current)
        onClose();
};
let submit = async (event?: FormEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (disabled || pending.current)
        return;
    const invalid = container.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input:invalid,textarea:invalid");
    if (invalid) {
        invalid.reportValidity();
        invalid.focus();
        return;
    }
    if (!textValue(draft.name).trim()) {
        setError("Bitte einen Namen eintragen.");
        return;
    }
    pending.current = true;
    setSaving(true);
    setError("");
    let person: DomainRecord;
    try {
        person = await save("people", Object.fromEntries([
            ...fields.map((field) => [field.key, textValue(draft[field.key]).trim()]),
            ["notes", textValue(draft.notes).trim()],
        ]), record);
    }
    catch (failure) {
        setError(failure instanceof Error ? failure.message : "Der Kontakt konnte nicht gespeichert werden.");
        pending.current = false;
        setSaving(false);
        return;
    }
    pending.current = false;
    setSaving(false);
    notify(record ? "Kontakt aktualisiert." : "Kontakt angelegt.");
    onSaved?.(person);
    onClose();
};
const content = true;

$: disabled = saving || busy || !online;
$: duplicates = workspace.records.people.filter((person) => isDirectoryPerson(person) &&
    person.id !== record?.id &&
    textValue(person.data.name).trim().toLocaleLowerCase("de") ===
        textValue(draft.name).trim().toLocaleLowerCase("de"));



</script>
{#if true}
{#snippet render_content()}<div class={styles.editor} bind:this={container.current} aria-busy={saving}>
      {#if embedded}<h3>Person anlegen</h3>{/if}
      <p class={styles.intro}>
        Kontaktdaten für die Zusammenarbeit. Diese Person erhält dadurch keinen Benutzerzugang. Nur
        der Name ist erforderlich.
      </p>
      <div class="form-grid">
        {#each fields as field (field.key)}<label for={`${id}-${field.key}`} class={field.key === "name" ? "full" : undefined}>
            {field.label}
            {"required" in field && field.required ? " *" : ""}
            <input id={`${id}-${field.key}`} type={"type" in field ? field.type : "text"} required={"required" in field && field.required} maxLength={field.maxLength} autocomplete={field.autoComplete} value={textValue(draft[field.key])} on:input={(event) => setDraft((current) => ({ ...current, [field.key]: event.currentTarget.value }))} on:keydown={(event) => {
    if (embedded && event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        void submit();
    }
}} disabled={disabled} />
          </label>{/each}
        <label class="full" for={`${id}-notes`}>
          Notizen
          <textarea id={`${id}-notes`} maxLength={20000} rows={5} value={textValue(draft.notes)} on:input={(event) => setDraft((current) => ({ ...current, notes: event.currentTarget.value }))} disabled={disabled}></textarea>
        </label>
      </div>
      {#if duplicates.length > 0}<div class={styles.warning} role="status">
          Ein Kontakt mit diesem Namen ist bereits vorhanden. Prüfe, ob es dieselbe Person ist.
          {#each duplicates as person}{#if onSelectExisting}<button type="button" disabled={disabled} on:click={() => onSelectExisting(person)}>
                Vorhandenen Kontakt wählen: {textValue(person.data.name)}
                {textValue(person.data.organization) && ` · ${textValue(person.data.organization)}`}
              </button>{:else}<p>
                {textValue(person.data.name)}
                {textValue(person.data.organization) && ` · ${textValue(person.data.organization)}`}
                {textValue(person.data.position) && ` · ${textValue(person.data.position)}`}
              </p>{/if}{/each}
        </div>{/if}
      {#if !online}<p class={styles.status} role="status">
          Zum Speichern wird eine Internetverbindung benötigt. Deine Eingaben bleiben hier erhalten.
        </p>{/if}
      <ErrorMessage message={error}></ErrorMessage>
      <div class={styles.actions}>
        <Button onClick={close} disabled={saving}>
          Abbrechen
        </Button>
        <Button type={embedded ? "button" : "submit"} variant="primary" disabled={disabled} onClick={embedded ? () => void submit() : undefined}>
          <Save size={16}></Save>
          {saving ? "Wird gespeichert …" : record ? "Änderungen speichern" : "Kontakt anlegen"}
        </Button>
      </div>
    </div>{/snippet}
{#if embedded}<section class={styles.inline}>
      {@render render_content()}
    </section>{:else}<Modal title={record ? "Kontakt bearbeiten" : "Person anlegen"} onClose={close}>
      <form on:submit={(event) => void submit(event)}>{@render render_content()}</form>
    </Modal>{/if}

{/if}
