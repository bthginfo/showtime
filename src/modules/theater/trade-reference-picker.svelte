<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "@/shared/client-api";
  import { createId } from "@/shared/svelte-runtime";
  import { Button, ErrorMessage } from "@/components/ui";
  import SelectionList from "@/components/selection-list.svelte";
  import type { Field } from "./registry";
  import type { ReferenceOption, ReferencePage } from "./references";
  export let moduleId: string;
  export let type: string;
  export let field: Field;
  export let productionId = "";
  export let value: unknown;
  export let onChange: (value: unknown) => void;
  export let max = 200;
  export let omitId = "";
  const id = createId();
  let select: HTMLSelectElement;
  let entries: ReferenceOption[] = [],
    chosen: ReferenceOption[] = [],
    nextCursor: string | null = null;
  let search = "",
    busy = true,
    error = "",
    request = 0;
  $: selected = Array.isArray(value) ? (value as string[]) : value ? [String(value)] : [];
  $: options = [...new Map([...entries, ...chosen].map((option) => [option.id, option])).values()];
  $: select?.setCustomValidity(
    busy
      ? "Die Auswahl wird noch geprüft."
      : selected.some((id) => !options.some((option) => option.id === id))
        ? "Diese Zuordnung ist nicht verfügbar. Bitte wähle einen passenden Eintrag."
        : "",
  );
  async function load(more = false) {
    const version = ++request;
    busy = true;
    error = "";
    try {
      const params = new URLSearchParams({ moduleId, type, field: field.key, q: search });
      if (productionId) params.set("productionId", productionId);
      if (more && nextCursor) params.set("cursor", nextCursor);
      selected.forEach((id) => params.append("id", id));
      const result = await api<ReferencePage>("/api/theater/references?" + params);
      if (version !== request) return;
      entries = more ? [...entries, ...result.entries] : result.entries;
      chosen = result.selected;
      nextCursor = result.nextCursor;
    } catch (e) {
      if (version === request) error = (e as Error).message;
    } finally {
      if (version === request) busy = false;
    }
  }
  onMount(() => {
    void load();
  });
</script>

<div class="reference-picker" class:full={field.type === "trades"} aria-busy={busy}>
  {#if field.type === "trades"}
    <SelectionList
      label={field.label}
      options={options.filter((option) => option.id !== omitId)}
      {max}
      {selected}
      required={field.required || false}
      onChange={(ids) => onChange(ids)}
    />
  {:else}
    <label for={id}>{field.label}{field.required ? " · Pflichtfeld" : ""}</label>
    <select
      bind:this={select}
      {id}
      value={String(value || "")}
      required={field.required}
      on:change={(e) => onChange(e.currentTarget.value)}
    >
      <option value="">{busy && !options.length ? "Auswahl wird geladen …" : "Bitte wählen"}</option
      >
      {#each selected.filter((id) => !options.some((option) => option.id === id)) as missing (missing)}
        <option value={missing} disabled
          >{busy
            ? "Zuordnung wird geprüft …"
            : "Zuordnung nicht verfügbar – bitte neu wählen"}</option
        >
      {/each}
      {#each options as option (option.id)}<option value={option.id}
          >{option.label}{option.detail ? " · " + option.detail : ""}</option
        >{/each}
    </select>
  {/if}
  {#if type === "audience-report" && field.type === "performance"}<p class="small muted">
      Gespielte Vorstellungen aus allen Zeiträumen. Suche nach Stück oder Datum (z. B. 2026-09).
    </p>{/if}
  <details class="reference-search">
    <summary>Andere Einträge suchen{nextCursor ? " · weitere vorhanden" : ""}</summary>
    <div class="reference-query">
      <label
        >Gesamten Bestand durchsuchen<input
          type="search"
          bind:value={search}
          placeholder={field.type === "performance" ? "Stück oder JJJJ-MM" : "Name oder Titel"}
          on:keydown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void load();
            }
          }}
        /></label
      >
      <Button disabled={busy} onClick={() => void load()}>Suchen</Button>
    </div>
  </details>
  {#if nextCursor}<Button disabled={busy} onClick={() => void load(true)}
      >Weitere Auswahlmöglichkeiten laden</Button
    >{/if}
  {#if !busy && !options.length && !error}<p class="small muted">
      Keine passenden Einträge. Prüfe die Produktion oder suche nach einem anderen Namen.
    </p>{/if}
  {#if error}<ErrorMessage message={error} /><Button disabled={busy} onClick={() => void load()}
      >Auswahl erneut laden</Button
    >{/if}
</div>

<style>
  .reference-picker {
    display: grid;
    gap: 8px;
    align-content: start;
    min-width: 0;
  }
  .reference-picker > label {
    margin: 0;
  }
  .reference-picker select {
    width: 100%;
    min-width: 0;
  }
  .reference-picker p {
    margin: 0;
  }
  .reference-search summary {
    cursor: pointer;
    min-height: 44px;
    display: flex;
    align-items: center;
    color: var(--muted);
    font-size: 13px;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .reference-query {
    display: flex;
    align-items: end;
    gap: 8px;
    flex-wrap: wrap;
    padding-block: 8px;
  }
  .reference-query label {
    flex: 1;
    min-width: 160px;
    margin: 0;
  }
  .reference-picker > :global(.button) {
    justify-self: start;
  }
</style>
