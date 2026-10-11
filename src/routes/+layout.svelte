<script lang="ts">
  import { onMount } from "svelte";
  import "../styles/globals.css";
  import "../modules/documents/documents.css";
  onMount(() => {
    try {
      sessionStorage.removeItem("showtime-offline-return");
    } catch {
      /* Storage can be disabled. */
    }
    // Login pages also need worker updates, especially after an offline fallback.
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .catch(() => undefined);
  });
</script>

<svelte:head
  ><title>Showtime</title><meta
    name="description"
    content="Der gemeinsame Arbeitsraum für dein Theater."
  /></svelte:head
>
<slot />
