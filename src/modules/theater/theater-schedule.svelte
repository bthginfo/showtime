<script lang="ts">
  import ScheduleWorkspace from "./schedule-workspace.svelte";
  import type { Planning, TheaterRun, ScheduleArea } from "./types";
  import type { Collection } from "./collections";
  export let planning: Planning;
  export let run: TheaterRun;
  export let busy = false;
  export let more: (collection: Collection) => Promise<void>;
  export let productionId = "";
  export let onChanged: () => Promise<void>;
  export let area: ScheduleArea = "";
</script>

<ScheduleWorkspace {planning} {run} {busy} {more} {productionId} {onChanged} bind:area />
