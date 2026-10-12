<script lang="ts">
  import { onMount, tick } from "svelte";
  import { goto } from "$app/navigation";
  import { Check, ArrowRight } from "@lucide/svelte";
  import { api, post } from "@/shared/client-api";
  import {
    activeWorkplaceScopes,
    pickerOrganization,
    type WorkplaceScope,
  } from "@/shared/workplace-switch";
  import { BrandMark } from "./brand-mark";
  import { ThemeSwitch } from "./theme-switch";
  import { ErrorMessage } from "./ui";
  import PlatformConsole from "./platform-console.svelte";
  export let onSelect: (organizationId: string, departmentId: string) => Promise<void>;
  export let compact = false;
  export let initialOrganization = "";
  export let initialDepartment = "";
  let scopes: WorkplaceScope[] = [];
  let search = "";
  let theater = "",
    department = "",
    error = "",
    pendingDepartment = "";
  let busy = false,
    loading = true,
    platformAdmin = false;
  let form: HTMLFormElement;
  $: theaters = [
    ...new Map(scopes.map((scope) => [scope.organizationId, scope.organizationName])).entries(),
  ];
  $: departments = scopes.filter((scope) => scope.organizationId === theater);
  $: theaterName = theaters.find(([id]) => id === theater)?.[1] || "";
  $: filteredDepartments = departments.filter((scope) =>
    scope.departmentName
      .toLocaleLowerCase("de-DE")
      .includes(search.trim().toLocaleLowerCase("de-DE")),
  );
  $: if (!departments.some((scope) => scope.departmentId === department))
    department = departments.length === 1 ? departments[0].departmentId : "";
  $: unchanged = compact && theater === initialOrganization && department === initialDepartment;
  async function choose(target = department) {
    if (loading || busy || !theater || !target) return;
    busy = true;
    pendingDepartment = target;
    error = "";
    try {
      await onSelect(theater, target);
    } catch (e) {
      error =
        e instanceof Error
          ? e.message
          : "Der Arbeitsbereich konnte nicht geöffnet werden. Prüfe deine Zuordnung erneut.";
    } finally {
      busy = false;
      pendingDepartment = "";
    }
  }
  async function load() {
    if (busy) return;
    loading = true;
    error = "";
    try {
      const result = await api<{
        scopes: WorkplaceScope[];
        platformAdmin: boolean;
        currentOrganizationId?: string | null;
      }>("/api/platform/scopes");
      platformAdmin = result.platformAdmin === true;
      scopes = activeWorkplaceScopes(result.scopes);
      theater = pickerOrganization(
        scopes,
        platformAdmin,
        initialOrganization,
        result.currentOrganizationId || "",
        theater,
      );
      if (!platformAdmin && !theater && initialOrganization)
        error =
          "Deine Zuordnung zu diesem Theater ist nicht mehr verfügbar. Bitte wende dich an deine Theateradministration.";
      else if (!platformAdmin && !theater && scopes.length)
        error =
          "Deine Theaterzuordnung ist nicht eindeutig. Bitte wende dich an deine Theateradministration.";
      const choices = scopes.filter((scope) => scope.organizationId === theater);
      department = choices.some((scope) => scope.departmentId === initialDepartment)
        ? initialDepartment
        : choices.length === 1
          ? choices[0].departmentId
          : "";
    } catch (e) {
      error =
        e instanceof Error
          ? e.message
          : "Deine Gewerke konnten nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.";
    } finally {
      loading = false;
    }
    await tick();
    if (!error && !compact && !platformAdmin && departments.length === 1) {
      await choose(departments[0].departmentId);
    } else if (compact && form?.isConnected) {
      form
        .querySelector<HTMLElement>("select:not(:disabled),button:not(:disabled)")
        ?.focus({ preventScroll: true });
    }
  }
  async function logout() {
    try {
      await post("/api/logout", {});
      await goto("/login");
    } catch (e) {
      error = e instanceof Error ? e.message : "Abmelden fehlgeschlagen. Versuche es erneut.";
    }
  }
  onMount(() => {
    void load();
  });
</script>

{#if platformAdmin && !compact}
  <PlatformConsole {onSelect} />
{:else}
  <div class={compact ? "scope-control" : "scope-page"}>
    {#if !compact}
      <header class="scope-header">
        <a class="brand" href="/"><BrandMark /><span>showtime</span></a><ThemeSwitch />
      </header>
      <div class="scope-intro">
        <h1>Dein Arbeitsbereich</h1>
        <p>Öffne das Gewerk, in dem du arbeiten möchtest.</p>
      </div>
    {/if}
    <form
      bind:this={form}
      class="scope-form"
      on:submit|preventDefault={() => void choose()}
      aria-busy={loading || busy}
    >
      {#if loading}
        <p role="status" class="muted">Deine Arbeitsbereiche werden geladen …</p>
      {:else if !scopes.length && !error}
        <h2>Noch kein Theater zugeordnet</h2>
        <p>Bitte deine Theateradministration um eine Einladung.</p>
        <button class="button secondary" type="button" on:click={() => void load()}
          >Zuordnung erneut prüfen</button
        >
      {:else if platformAdmin}
        <label
          >Theater<select bind:value={theater} disabled={busy} required>
            <option value="">Theater auswählen …</option>
            {#each theaters as [id, name] (id)}<option value={id}>{name}</option>{/each}
          </select></label
        >
        <label
          >Gewerk<select bind:value={department} disabled={busy || !theater} required>
            <option value="">Gewerk auswählen …</option>
            {#each departments as scope (scope.departmentId)}<option value={scope.departmentId}
                >{scope.departmentName}</option
              >{/each}
          </select></label
        >
        <div class="scope-actions">
          <button
            class="button primary"
            type="submit"
            disabled={busy || !theater || !department || unchanged}
          >
            {busy ? "Arbeitsbereich wird geöffnet …" : "Arbeitsbereich öffnen"}<ArrowRight
              size={17}
            />
          </button>
        </div>
      {:else if theater}
        <p class="scope-theater muted">{theaterName}</p>
        {#if departments.length > 6}<label
            >Gewerk suchen<input
              type="search"
              bind:value={search}
              disabled={busy}
              placeholder="Name des Gewerks"
            /></label
          >{/if}
        <div class="scope-departments" role="group" aria-label="Deine Gewerke">
          {#each filteredDepartments as scope (scope.departmentId)}
            {@const current = compact && scope.departmentId === initialDepartment}
            <button
              type="button"
              class="scope-department"
              class:current
              aria-current={current ? "true" : undefined}
              disabled={busy || current}
              on:click={() => void choose(scope.departmentId)}
            >
              <span
                ><strong>{scope.departmentName}</strong>{#if current}<span class="small"
                    >Aktuelles Gewerk</span
                  >{/if}</span
              >
              {#if pendingDepartment === scope.departmentId}<span class="small"
                  >Wird geöffnet …</span
                >{:else if current}<Check size={19} />{:else}<ArrowRight size={19} />{/if}
            </button>
          {/each}
          {#if !filteredDepartments.length}<p role="status" class="muted">
              Kein passendes Gewerk. Ändere deinen Suchbegriff.
            </p>{/if}
        </div>
      {/if}
      {#if error}<ErrorMessage message={error} /><button
          class="button secondary"
          type="button"
          disabled={busy}
          on:click={() => void load()}>Zuordnung erneut prüfen</button
        >{/if}
    </form>
    {#if !compact}<button class="text-button scope-logout" on:click={() => void logout()}
        >Abmelden</button
      >{/if}
  </div>
{/if}

<style>
  .scope-control {
    display: block;
    width: 100%;
    padding-bottom: 24px;
  }
  .scope-control .scope-form {
    width: 100%;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  .scope-form {
    gap: 20px;
    min-width: 0;
  }
  .scope-form label {
    gap: 8px;
    min-width: 0;
  }
  .scope-form select {
    width: 100%;
    min-height: 44px;
  }
  .scope-actions {
    display: flex;
    gap: 12px;
    margin-top: 4px;
  }
  .scope-actions .button {
    width: 100%;
    min-height: 44px;
  }
  .scope-theater {
    font-size: 13px;
  }
  .scope-departments {
    display: grid;
    gap: 12px;
  }
  .scope-department {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    min-height: 64px;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }
  .scope-department > span:first-child {
    display: grid;
    gap: 4px;
    min-width: 0;
  }
  .scope-department strong {
    font-size: 15px;
    line-height: 1.4;
    overflow-wrap: anywhere;
    hyphens: auto;
  }
  .scope-department .small {
    color: var(--muted);
  }
  .scope-department > :global(svg) {
    flex-shrink: 0;
  }
  .scope-department.current {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .scope-department.current :global(svg) {
    color: var(--accent);
  }
  .scope-department:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .scope-department:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 3px;
  }
  .scope-department:disabled {
    cursor: default;
  }
  .scope-department.current:disabled {
    opacity: 1;
  }
  .scope-department:disabled:not(.current) {
    opacity: 0.65;
    cursor: wait;
  }
</style>
