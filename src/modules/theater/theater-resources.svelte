<script lang="ts">
  import ResourceWorkspace from "./resource-workspace.svelte";
  import type { Planning, TheaterRun } from "./types";
  import type { Collection } from "./collections";
  export let planning: Planning;
  export let run: TheaterRun;
  export let busy = false;
  export let more: (collection: Collection) => Promise<void>;
  export let productionId = "";
  export let area: "catalog" | "bookings" = "catalog";
</script>

<ResourceWorkspace {planning} {run} {busy} {more} {productionId} bind:area />
