<script lang="ts">
  import { ArrowRight, Check } from "@lucide/svelte";
  import type { CalendarDays } from "@lucide/svelte";

  export let label: string;
  export let tiles: {
    id: string;
    title: string;
    description?: string;
    href?: string;
    icon?: typeof CalendarDays;
    count?: number;
  }[];
  export let onChoose: ((id: string) => void) | undefined = undefined;
  export let selected: string | undefined = undefined;
  export let disabled = false;
  export let compact = false;
  export let controls: string | undefined = undefined;
</script>

<div class:compact class="work-tiles" role="group" aria-label={label}>
  {#each tiles as tile (tile.id)}
    {#if tile.href}
      <a class="work-tile" href={tile.href}>
        {#if tile.icon}<svelte:component this={tile.icon} size={22} aria-hidden="true" />{/if}
        <span class="tile-content">
          <strong>{tile.title}</strong>
          {#if tile.description}<span class="tile-description">{tile.description}</span>{/if}
          {#if tile.count !== undefined}<span class="tile-count"
              >{tile.count.toLocaleString("de-DE")} angezeigt</span
            >{/if}
        </span>
        <ArrowRight class="tile-arrow" size={18} aria-hidden="true" />
      </a>
    {:else}
      <button
        type="button"
        class="work-tile"
        class:selected={selected === tile.id}
        aria-pressed={selected === undefined ? undefined : selected === tile.id}
        aria-controls={controls}
        {disabled}
        on:click={() => onChoose?.(tile.id)}
      >
        {#if tile.icon}<svelte:component this={tile.icon} size={22} aria-hidden="true" />{/if}
        <span class="tile-content">
          <strong>{tile.title}</strong>
          {#if tile.description}<span class="tile-description">{tile.description}</span>{/if}
          {#if tile.count !== undefined}<span class="tile-count"
              >{tile.count.toLocaleString("de-DE")} angezeigt</span
            >{/if}
          {#if selected === tile.id}<span class="tile-selected">Geöffnet</span>{/if}
        </span>
        {#if selected === tile.id}<Check class="tile-arrow" size={18} aria-hidden="true" />
        {:else if selected === undefined}<ArrowRight
            class="tile-arrow"
            size={18}
            aria-hidden="true"
          />{/if}
      </button>
    {/if}
  {/each}
</div>

<style>
  .work-tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
    gap: 16px;
    min-width: 0;
  }
  .work-tile {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    min-width: 0;
    min-height: 112px;
    padding: 22px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    transition:
      border-color 160ms ease-out,
      background 160ms ease-out;
  }
  .work-tile:hover:not(:disabled) {
    border-color: var(--accent);
    background: var(--surface-soft);
  }
  .work-tile:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 3px;
  }
  .work-tile.selected {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .work-tile:disabled {
    cursor: wait;
    opacity: 0.65;
  }
  .tile-content {
    flex: 1;
    display: grid;
    gap: 7px;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  strong {
    font-size: 15px;
    line-height: 1.45;
    font-weight: 600;
    hyphens: auto;
  }
  .tile-description {
    color: var(--muted);
    font-size: 13px;
    line-height: 1.55;
  }
  .tile-count,
  .tile-selected {
    color: var(--muted);
    font-size: 12px;
  }
  .tile-selected {
    color: var(--accent);
    font-weight: 600;
  }
  .work-tile :global(svg) {
    flex: 0 0 auto;
    color: var(--accent);
    margin-top: 2px;
  }
  .work-tile :global(.tile-arrow) {
    color: var(--muted);
  }
  .compact {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
    gap: 12px;
  }
  .compact .work-tile {
    padding: 16px;
    min-height: 80px;
  }
  @media (max-width: 600px) {
    .work-tile {
      padding: 18px;
      min-height: 100px;
    }
    .compact {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .compact .work-tile {
      padding: 14px;
    }
    .compact strong {
      font-size: 14px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .work-tile {
      transition: none;
    }
  }
</style>
