<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { useViewState } from "@/shared/view-state";
import { ArrowUpRight, Plus, Search, UsersRound } from "@lucide/svelte";
import { Button, Empty, ExportButton, PageHeader } from "@/components/ui";
import { RecordLink } from "@/components/record-link";
import { ExportDialog } from "@/components/export-dialog";
import { useWorkspace } from "@/components/workspace-context";
import { textValue } from "@/shared/contracts";
import { canManageRecord } from "@/shared/record-permissions";
import { PersonEditor } from "./person-editor";
import { PersonContactLinks } from "./person-contact-links";
import { filterPeople, isDirectoryPerson } from "./person-data";
import styles from "./people.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { type Panel } from "./people-module";
const effects=createEffects();
const workspaceStore=useWorkspace();
let { workspace, busy, online } = $workspaceStore;
$: ({ workspace, busy, online } = $workspaceStore);
const queryStore = useViewState<any>(workspace.user.id, "people", "query", "");
let query: any = $queryStore; $: query = $queryStore;
const setQuery = queryStore.set;
const organizationStore = useViewState<any>(workspace.user.id, "people", "organization", "");
let organization: any = $organizationStore; $: organization = $organizationStore;
const setOrganization = organizationStore.set;
let panel: Panel = initialState<Panel>(null);
const setPanel = (next: Panel | ((current: Panel) => Panel)) => { panel = typeof next === "function" ? (next as (current: Panel) => Panel)(panel) : next; };
const id = createId();
let canManage = canManageRecord(workspace.user, "people");
let people = (() => workspace.records.people.filter(isDirectoryPerson))();
let organizations = (() => Array.from(new Set(people.map((person) => textValue(person.data.organization)).filter(Boolean))).sort((a, b) => a.localeCompare(b, "de")))();
let filtered = (() => filterPeople(people, query, organization))();
let open = (next: Panel) => {
    setPanel(next);
};
let close = () => {
    open(null);
};

$: canManage = canManageRecord(workspace.user, "people");
$: people = (() => workspace.records.people.filter(isDirectoryPerson))();
$: organizations = (() => Array.from(new Set(people.map((person) => textValue(person.data.organization)).filter(Boolean))).sort((a, b) => a.localeCompare(b, "de")))();
$: filtered = (() => filterPeople(people, query, organization))();



</script>

<section class={styles.directory}>
      <PageHeader eyebrow="Kontakte" title="Ansprechpersonen" >
        <ExportButton onClick={() => open({ type: "export" })}></ExportButton>
        {#if canManage}<Button variant="primary" onClick={() => open({ type: "create" })} disabled={busy || !online}>
            <Plus size={16}></Plus>
            Person anlegen
          </Button>{/if}
      </PageHeader>
      <div class={styles.toolbar}>
        <div class={styles.search}>
          <label for={`${id}-search`}>Verzeichnis durchsuchen</label>
          <div class={styles.searchField}>
            <Search size={17}></Search>
            <input id={`${id}-search`} type="search" placeholder="Name, Funktion, E-Mail …" value={query} on:input={(event) => setQuery(event.currentTarget.value)} />
          </div>
        </div>
        <div class={styles.filter}>
          <label for={`${id}-organization`}>Organisation</label>
          <select id={`${id}-organization`} value={organization} on:change={(event) => setOrganization(event.currentTarget.value)}>
            <option value="">Alle Organisationen</option>
            {#each organizations as name (name)}<option value={name}>
                {name}
              </option>{/each}
          </select>
        </div>
      </div>
      <p class={styles.count} role="status">
        <UsersRound size={15}></UsersRound>
        {filtered.length === people.length
    ? `${people.length} ${people.length === 1 ? "Person" : "Personen"}`
    : `${filtered.length} von ${people.length} Personen`}
      </p>
      {#if !people.length}<Empty title="Kontakte an einem Ort" description="Lege eure ersten Ansprechpersonen an. Du kannst sie später direkt einer Produktion zuordnen." action={canManage && online ? "Person anlegen" : undefined} onAction={() => open({ type: "create" })}></Empty>{:else}{#if !filtered.length}<Empty title="Keine passenden Kontakte" description="Versuche einen anderen Suchbegriff oder zeige alle Organisationen." action="Filter zurücksetzen" onAction={() => {
    setQuery("");
    setOrganization("");
}}></Empty>{:else}<div class={styles.list}>
          <div class={styles.listHeader} aria-hidden="true">
            <span>Name & Funktion</span>
            <span>Organisation</span>
            <span>Kontakt</span>
            <span></span>
          </div>
          <ul aria-label="Kontaktverzeichnis">
            {#each filtered as person (person.id)}{@const name = textValue(person.data.name)}{@const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toLocaleUpperCase("de")}<li class={styles.row}>
                  <div class={styles.identity}>
                    <span class={styles.avatar} aria-hidden="true">
                      {initials}
                    </span>
                    <div>
                      <RecordLink record={person} className={styles.name}>
                        {name}
                      </RecordLink>
                      <span class={styles.secondary}>
                        {textValue(person.data.position) || "Funktion nicht hinterlegt"}
                      </span>
                    </div>
                  </div>
                  <div class={styles.organization}>
                    {#if textValue(person.data.organization)}{textValue(person.data.organization)}{:else}<span class={styles.secondary}>Organisation nicht hinterlegt</span>{/if}
                  </div>
                  <PersonContactLinks data={person.data}></PersonContactLinks>
                  <RecordLink record={person} className="icon-button" decoration={false} aria-label={`Kontaktdetails: ${name}`}>
                    <ArrowUpRight size={18}></ArrowUpRight>
                  </RecordLink>
                </li>{/each}
          </ul>
        </div>{/if}{/if}
      {#if !online}<p class={styles.status} role="status">
          Die zuletzt geladenen Kontakte bleiben durchsuchbar. Zum Anlegen oder Bearbeiten wird eine
          Internetverbindung benötigt.
        </p>{/if}
      {#if panel?.type === "create"}<PersonEditor onClose={close}></PersonEditor>{/if}
      {#if panel?.type === "export"}<ExportDialog kind="people" onClose={close}></ExportDialog>{/if}
    </section>
