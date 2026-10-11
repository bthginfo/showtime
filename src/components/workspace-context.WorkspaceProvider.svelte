<script lang="ts">
  import { onMount } from "svelte";
  import { createWorkspace } from "./workspace-context";
  import { BrandMark } from "./brand-mark";
  import { post } from "@/shared/client-api";
  import { goto } from "$app/navigation";
  import ScopePicker from "./scope-picker.svelte";
  const state = createWorkspace();
  onMount(() => {
    const online = () => state.connectivity(navigator.onLine);
    online();
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    void state.refresh();
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      state.dispose();
    };
  });
</script>

{#if $state.scopeRequired}
  <ScopePicker onSelect={state.switchScope} />
{:else if $state.pending}
  <main class="gate">
    <BrandMark />
    <h1>Dein Zugang wartet auf Freigabe.</h1>
    <p>
      Die Theateradministration prüft deine Registrierung. Sobald dein Zugang aktiv ist, kannst du
      hier starten.
    </p>
    <button class="button primary" on:click={() => void state.refresh()}>Freigabe prüfen</button>
    <button
      class="button ghost"
      on:click={async () => {
        await post("/api/logout", {});
        await goto("/login", { replaceState: true });
      }}>Abmelden</button
    >
  </main>
{:else if !$state.workspace}
  <main class="gate">
    <BrandMark />
    <h1>{$state.error ? "Verbindung unterbrochen" : "Dein Theater wird vorbereitet …"}</h1>
    <p>{$state.error || "Produktionen, Aufgaben und Termine werden geladen."}</p>
    {#if $state.error}<button class="button primary" on:click={() => void state.refresh()}
        >Erneut versuchen</button
      >{:else}<div class="loading-bar"></div>{/if}
  </main>
{:else}
  {#if $state.error}<div class="connectivity-banner" role="alert">
      Die Übersicht konnte nicht aktualisiert werden: {$state.error}. Deine zuletzt geladenen Daten
      bleiben sichtbar.<button class="text-button" on:click={() => void state.refresh()}
        >Erneut laden</button
      >
    </div>{/if}
  {#key $state.workspace.organization.id + ":" + $state.workspace.department.id + ":" + $state.workspace.user.id}<slot
    />{/key}
{/if}
