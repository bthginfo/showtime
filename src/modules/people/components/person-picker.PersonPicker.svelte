<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { Plus } from "@lucide/svelte";
import { Button } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-context";
import { textValue, type DomainRecord } from "@/shared/contracts";
import { filterPeople, isDirectoryPerson } from "./person-data";
import { PersonEditor } from "./person-editor";
import { PersonContactLinks } from "./person-contact-links";
import styles from "./people.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { type PersonPickerProps } from "./person-picker";
const effects=createEffects();
type ViewProps = PersonPickerProps;
export let value: ViewProps["value"] = undefined as any;
export let onChange: ViewProps["onChange"] = undefined as any;
export let disabled: NonNullable<ViewProps["disabled"]> = false;
export let label: NonNullable<ViewProps["label"]> = "Person aus dem Verzeichnis";
export let onCreated: ViewProps["onCreated"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace, busy, online } = $workspaceStore;
$: ({ workspace, busy, online } = $workspaceStore);
const id = createId();
let query: string = "";
const setQuery = (next: typeof query | ((current: typeof query) => typeof query)) => { query = typeof next === "function" ? (next as (current: typeof query) => typeof query)(query) : next; };
let creating: boolean = false;
const setCreating = (next: typeof creating | ((current: typeof creating) => typeof creating)) => { creating = typeof next === "function" ? (next as (current: typeof creating) => typeof creating)(creating) : next; };
let created: DomainRecord | undefined = initialState<DomainRecord | undefined>(undefined);
const setCreated = (next: DomainRecord | undefined | ((current: DomainRecord | undefined) => DomainRecord | undefined)) => { created = typeof next === "function" ? (next as (current: DomainRecord | undefined) => DomainRecord | undefined)(created) : next; };
let people = (() => created && !workspace.records.people.some((person) => person.id === created?.id)
    ? [...workspace.records.people, created]
    : workspace.records.people)();
let selected = people.find((person) => person.id === value);
let matches = filterPeople(people, query);
let options = selected && !matches.some((person) => person.id === selected?.id)
    ? [selected, ...matches]
    : matches;

$: people = (() => created && !workspace.records.people.some((person) => person.id === created?.id)
    ? [...workspace.records.people, created]
    : workspace.records.people)();
$: selected = people.find((person) => person.id === value);
$: matches = filterPeople(people, query);
$: options = selected && !matches.some((person) => person.id === selected?.id)
    ? [selected, ...matches]
    : matches;

</script>

<div class={styles.picker}>
      <div class={styles.pickerHeading}>
        <label for={`${id}-select`}>{label}</label>
        {#if !creating}<Button onClick={() => setCreating(true)} disabled={disabled || busy || !online}>
            <Plus size={14}></Plus>
            Person anlegen
          </Button>{/if}
      </div>
      <label class={styles.pickerSearch} for={`${id}-search`}>
        <span class="visually-hidden">Kontaktverzeichnis durchsuchen</span>
        <input id={`${id}-search`} type="search" placeholder="Name, Organisation oder Funktion suchen" value={query} disabled={disabled || creating} on:input={(event) => setQuery(event.currentTarget.value)} on:keydown={(event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
    }
}} />
      </label>
      <select id={`${id}-select`} value={value} on:change={(event) => onChange(event.currentTarget.value)} disabled={disabled || creating}>
        <option value="">Person auswählen</option>
        {#if value && !selected}<option value={value} disabled>
            Kontakt nicht mehr verfügbar
          </option>{/if}
        {#each options as person (person.id)}<option value={person.id}>
            {textValue(person.data.name)}
            {textValue(person.data.organization) && ` · ${textValue(person.data.organization)}`}
            {textValue(person.data.position) && ` · ${textValue(person.data.position)}`}
          </option>{/each}
      </select>
      {#if !matches.length}<p class={styles.status} role="status">
          {people.some(isDirectoryPerson)
    ? "Kein Kontakt passt zur Suche."
    : "Noch keine weiteren Personen im Verzeichnis."}
        </p>{/if}
      {#if selected}<div class={styles.selected}>
          <strong>{textValue(selected.data.name)}</strong>
          {#if textValue(selected.data.position)}<span class={styles.secondary}>{textValue(selected.data.position)}</span>{/if}
          <PersonContactLinks data={selected.data} empty=""></PersonContactLinks>
        </div>{/if}
      {#if creating}<PersonEditor embedded defaults={{ name: query.trim() }} onClose={() => setCreating(false)} onSelectExisting={(person) => {
    onChange(person.id);
    setCreating(false);
    setQuery("");
}} onSaved={(person) => {
    setCreated(person);
    onChange(person.id);
    setQuery("");
    onCreated?.(person);
}}></PersonEditor>{/if}
    </div>
