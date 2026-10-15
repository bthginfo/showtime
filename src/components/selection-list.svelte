<script lang="ts">
  import { Search, X } from "@lucide/svelte";
  import { createId } from "@/shared/svelte-runtime";
  type SelectionOption = { id: string; label: string; detail?: string };
  export let label: string;
  export let options: SelectionOption[] = [];
  export let selected: string[] = [];
  export let onChange: (ids: string[]) => void;
  export let name = "";
  export let max = 200;
  export let disabled = false;
  export let required = false;
  let searchInput: HTMLInputElement;
  $: searchInput?.setCustomValidity(
    required && !selected.length ? `Bitte wähle mindestens einen Eintrag für ${label}.` : "",
  );
  let search = "",
    limit = 8;
  const id = createId();
  $: filtered = options.filter((option) =>
    `${option.label} ${option.detail || ""}`
      .toLocaleLowerCase("de")
      .includes(search.trim().toLocaleLowerCase("de")),
  );
  $: chosen = selected.map(
    (value) =>
      options.find((option) => option.id === value) || { id: value, label: "Nicht mehr verfügbar" },
  );
  function toggle(value: string, checked: boolean) {
    onChange(
      checked ? [...new Set([...selected, value])] : selected.filter((item) => item !== value),
    );
  }
</script>

<fieldset class="selection-list full" {disabled}>
  <legend
    >{label}{required ? " · Pflichtauswahl" : ""}<span class="selection-count"
      >{selected.length} ausgewählt</span
    ></legend
  >
  {#if options.length > 8 || required}<label class="selection-search" for={id}>
      <Search size={16} aria-hidden="true" />
      <input
        {id}
        bind:this={searchInput}
        aria-label={`${label} durchsuchen`}
        placeholder="Suchen …"
        bind:value={search}
        on:input={() => (limit = 8)}
        type="search"
      />
    </label>{/if}
  {#if chosen.length}<div class="selection-chosen" aria-label="Ausgewählte Einträge">
      {#each chosen as option (option.id)}<button
          type="button"
          class="selection-chip"
          {disabled}
          on:click={() => toggle(option.id, false)}
          aria-label={`${option.label} entfernen`}
        >
          {option.label}<X size={14} aria-hidden="true" />
        </button>{/each}
    </div>{/if}
  <div class="selection-options">
    {#each filtered.slice(0, limit) as option (option.id)}<label class="selection-option">
        <input
          type="checkbox"
          checked={selected.includes(option.id)}
          disabled={disabled || (!selected.includes(option.id) && selected.length >= max)}
          on:change={(event) => toggle(option.id, event.currentTarget.checked)}
        />
        <span
          ><strong>{option.label}</strong>{#if option.detail}<span class="small muted"
              >{option.detail}</span
            >{/if}</span
        >
      </label>{:else}<p class="small muted">
        {options.length
          ? "Keine passenden Einträge. Ändere deinen Suchbegriff."
          : "Noch keine Einträge verfügbar."}
      </p>{/each}
  </div>
  {#if filtered.length > limit}<button
      class="text-button selection-more"
      type="button"
      on:click={() => (limit += 12)}
      >Weitere {Math.min(12, filtered.length - limit)} anzeigen ({filtered.length} insgesamt)</button
    >{/if}
  {#if selected.length >= max}<p class="small muted" role="status">
      Maximal {max} Einträge auswählen.
    </p>{/if}
  {#if name}{#each selected as value (value)}<input type="hidden" {name} {value} />{/each}{/if}
</fieldset>

<style>
  .selection-list {
    min-width: 0;
    margin: 0;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  legend {
    font-size: 14px;
    font-weight: 600;
    padding-inline: 6px;
  }
  .selection-count {
    margin-left: 12px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 400;
  }
  .selection-search {
    position: relative;
    display: flex;
    align-items: center;
    margin-bottom: 12px;
  }
  .selection-search :global(svg) {
    position: absolute;
    left: 12px;
    color: var(--muted);
    pointer-events: none;
  }
  .selection-search input {
    width: 100%;
    padding-left: 38px;
  }
  .selection-chosen {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .selection-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    min-height: 36px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--accent-soft);
    color: var(--text);
    text-align: left;
    font-size: 13px;
  }
  .selection-chip:hover {
    border-color: var(--accent);
  }
  .selection-options {
    display: grid;
    max-height: 320px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .selection-option {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
    padding: 10px 8px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
  }
  .selection-option:last-child {
    border-bottom: 0;
  }
  .selection-option:hover {
    background: var(--surface-soft);
  }
  .selection-option input {
    width: 18px;
    height: 18px;
    flex: 0 0 auto;
    margin: 0;
  }
  .selection-option > span {
    display: grid;
    gap: 4px;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .selection-option strong {
    font-size: 14px;
    font-weight: 500;
  }
  .selection-more {
    margin-top: 12px;
    min-height: 44px;
    text-align: left;
  }
  @media (max-width: 760px) {
    .selection-list {
      padding: 12px;
    }
    .selection-search input {
      font-size: 16px;
    }
    .selection-chip {
      min-height: 44px;
    }
    .selection-count {
      display: block;
      margin: 4px 0 0;
    }
  }
</style>
