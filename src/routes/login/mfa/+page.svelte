<script lang="ts">
  import { onMount, tick } from "svelte";
  import { post } from "@/shared/client-api";
  import { Button, ErrorMessage } from "@/components/ui";
  import { BrandMark } from "@/components/brand-mark";
  import type { PageData } from "./$types";
  export let data: PageData;
  let code = "";
  let backup = data.backup;
  let busy = false;
  let error = data.invalid
    ? "Der Code konnte nicht bestätigt werden. Prüfe ihn in deiner Authenticator-App und versuche es erneut."
    : "";
  let codeInput: HTMLInputElement;
  onMount(() => codeInput?.focus());
  async function switchMethod() {
    backup = !backup;
    code = "";
    error = "";
    await tick();
    codeInput?.focus();
  }
  async function submit() {
    busy = true;
    error = "";
    try {
      await post("/api/auth/mfa", { action: backup ? "backup" : "verify", code });
      location.replace("/");
    } catch (e) {
      error = e instanceof Error ? e.message : "Bitte versuche es erneut.";
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head
  ><title>Zweiten Faktor bestätigen · Showtime</title><meta
    name="robots"
    content="noindex"
  /></svelte:head
>
<main class="mfa-page">
  <a class="brand" href="/login"><BrandMark /><span>showtime</span></a>
  <h1>Zugang bestätigen</h1>
  <p class="muted">
    {backup
      ? "Gib einen deiner einmaligen Wiederherstellungscodes ein."
      : "Öffne deine Authenticator-App und gib den sechsstelligen Code für Showtime ein."}
  </p>
  <form
    method="POST"
    action={"/api/auth/mfa?method=" + (backup ? "backup" : "verify")}
    on:submit|preventDefault={submit}
  >
    <input type="hidden" name="action" value={backup ? "backup" : "verify"} />
    <label
      >{backup ? "Wiederherstellungscode" : "Authenticator-Code"}<input
        name="code"
        bind:this={codeInput}
        bind:value={code}
        autocomplete="one-time-code"
        inputmode={backup ? "text" : "numeric"}
        required
        maxlength={100}
      /></label
    >
    <ErrorMessage message={error} />
    <Button type="submit" disabled={busy}>{busy ? "Wird geprüft …" : "Anmelden"}</Button>
    <a
      href={backup ? "/login/mfa" : "/login/mfa?method=backup"}
      class="button ghost"
      on:click|preventDefault={switchMethod}
      >{backup ? "Authenticator verwenden" : "Wiederherstellungscode verwenden"}</a
    >
  </form>
  <a href="/login" class="small">Zurück zur Anmeldung</a>
</main>

<style>
  .mfa-page {
    max-width: 28rem;
    margin: 8vh auto;
    padding: 1.5rem;
    display: grid;
    gap: 1.25rem;
  }
  .mfa-page form {
    display: grid;
    gap: 1rem;
  }
  .mfa-page h1 {
    font-size: 1.65rem;
    line-height: 1.3;
  }
  .mfa-page p {
    line-height: 1.6;
  }
</style>
