<script lang="ts">
  import { useWorkspace } from "../workspace-context";
  import { workspaceHome } from "@/shared/workspace-home";
  import TheaterOverview from "@/modules/theater/theater-overview.svelte";
  import TradeHome from "@/modules/theater/trade-home.svelte";
  import RoleHome from "@/modules/theater/role-home.svelte";
  export let navigate: (url: string) => void;
  const store = useWorkspace();
  $: home = workspaceHome($store.workspace);
</script>

{#key $store.workspace.department.id}
  {#if home === "intendance"}<TheaterOverview
      pageTitle="Intendanz"
      onHelp={() => navigate("/?module=help&guide=intendance")}
      onNavigate={navigate}
      onProduction={(id) =>
        navigate(`/?module=theater&view=readiness&productionId=${encodeURIComponent(id)}`)}
    >
      <nav class="intendance-shortcuts" aria-label="Arbeitsbereiche der Intendanz">
        <a class="button secondary" href="/?module=theater&view=trade&featureId=decision"
          >Entscheidungen</a
        ><a class="button secondary" href="/?module=theater&view=trade&featureId=priority"
          >Ziele & Vorhaben</a
        ><a class="button secondary" href="/?module=theater&view=collaborations"
          >Abstimmungen & Freigaben</a
        >
      </nav>
    </TheaterOverview>
  {:else if home === "personnel" || home === "administration"}<RoleHome role={home} {navigate} />
  {:else}<TradeHome {navigate} />{/if}
{/key}

<style>
  .intendance-shortcuts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  @media (max-width: 760px) {
    .intendance-shortcuts {
      display: grid;
    }
  }
</style>
