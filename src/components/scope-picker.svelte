<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api, post } from "@/shared/client-api";
  import { BrandMark } from "./brand-mark";
  import { ThemeSwitch } from "./theme-switch";
  import PlatformConsole from "./platform-console.svelte";
  export let onSelect: (organizationId: string, departmentId: string) => Promise<void>;
  export let compact = false;
  export let initialOrganization = "";
  export let initialDepartment = "";
  type Scope = {
    organizationId: string;
    organizationName: string;
    departmentId: string;
    departmentName: string;
    status: string;
  };
  let scopes: Scope[] = [];
  let theater = "";
  let department = "";
  let error = "";
  let busy = false;
  let loading = true;
  let platformAdmin = false;
  $: theaters = [...new Map(scopes.map((s) => [s.organizationId, s.organizationName])).entries()];
  $: departments = scopes.filter((s) => s.organizationId === theater);
  $: if (!departments.some((s) => s.departmentId === department))
    department = departments.length === 1 ? departments[0].departmentId : "";
  async function load() {
    loading = true;
    error = "";
    try {
      const result = await api<{ scopes: Scope[]; platformAdmin: boolean }>("/api/platform/scopes");
      scopes = result.scopes.filter((s) => s.status === "active");
      platformAdmin = result.platformAdmin;
      const organizations = [...new Set(scopes.map((s) => s.organizationId))];
      if (organizations.length === 1) theater = organizations[0];
      if (scopes.some((scope) => scope.organizationId === initialOrganization))
        theater = initialOrganization;
      if (
        scopes.some(
          (scope) => scope.organizationId === theater && scope.departmentId === initialDepartment,
        )
      )
        department = initialDepartment;
    } catch (e) {
      error =
        e instanceof Error ? e.message : "Die Theaterzuordnungen konnten nicht geladen werden.";
    } finally {
      loading = false;
    }
  }
  async function choose() {
    if (!theater || !department) return;
    busy = true;
    error = "";
    try {
      await onSelect(theater, department);
    } catch (e) {
      error = e instanceof Error ? e.message : "Der Arbeitsbereich konnte nicht geöffnet werden.";
    } finally {
      busy = false;
    }
  }
  async function logout() {
    try {
      await post("/api/logout", {});
      await goto("/login");
    } catch (e) {
      error = e instanceof Error ? e.message : "Abmelden fehlgeschlagen.";
    }
  }
  onMount(() => {
    void load();
  });
</script>

{#if platformAdmin && !compact}<PlatformConsole {onSelect} />
{:else}
  <div class={compact ? "scope-control" : "scope-page"}>
    {#if !compact}<header class="scope-header">
        <a class="brand" href="/"><BrandMark /><span>showtime</span></a><ThemeSwitch />
      </header>
      <div class="scope-intro">
        <h1>Dein Arbeitsbereich</h1>
        <p>Wähle dein Theater und das Gewerk, in dem du arbeiten möchtest.</p>
      </div>{/if}
    <form class="scope-form" on:submit|preventDefault={() => void choose()} aria-busy={loading}>
      {#if loading}<p role="status">
          Theaterzuordnungen werden geladen …
        </p>{:else if !scopes.length && !error}<h2>Noch kein Theater zugeordnet</h2>
        <p>
          Bitte deine Theateradministration um eine Einladung. Bereits erhaltene Einladungslinks
          kannst du auch mit deinem bestehenden Konto öffnen.
        </p>
        <button class="button secondary" type="button" on:click={() => void load()}
          >Zuordnung erneut prüfen</button
        >{:else}<label
          >Theater<select bind:value={theater} disabled={busy}
            ><option value="">Theater auswählen …</option>{#each theaters as [id, name] (id)}<option
                value={id}>{name}</option
              >{/each}</select
          ></label
        ><label
          >Gewerk<select bind:value={department} disabled={busy || !theater}
            ><option value="">Gewerk auswählen …</option
            >{#each departments as scope (scope.departmentId)}<option value={scope.departmentId}
                >{scope.departmentName}</option
              >{/each}</select
          ></label
        ><button class="button primary" disabled={busy || !theater || !department}
          >{busy ? "Arbeitsbereich wird geöffnet …" : "Arbeitsbereich öffnen"}</button
        >{/if}
      {#if error}<p role="alert" class="platform-error">{error}</p>
        <button class="button secondary" type="button" on:click={() => void load()}
          >Erneut laden</button
        >{/if}
    </form>
    {#if !compact}<button class="text-button scope-logout" on:click={() => void logout()}
        >Abmelden</button
      >{/if}
  </div>
{/if}
