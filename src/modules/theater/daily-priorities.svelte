<script lang="ts">
  import { onMount } from "svelte";
  import { useWorkspace } from "@/components/workspace-context";
  import { api } from "@/shared/client-api";
  import { Section, Button, ErrorMessage } from "@/components/ui";
  import { hasPermission } from "@/platform/access";
  import { plannedPersonHours } from "@/shared/planned-person-hours";
  import { collaborationOpen } from "@/shared/collaboration";
  import { theaterLabel } from "@/shared/theater-time";
  import type { Planning } from "./types";
  export let navigate: (url: string) => void;
  const store = useWorkspace();
  let items: Planning["items"] = [],
    error = "";
  $: workspace = $store.workspace;
  $: reviews = items
    .filter((item) => item.type === "collaboration" && collaborationOpen(item.status))
    .sort((a, b) =>
      String(a.dueAt || a.data.dueDate || "9999").localeCompare(
        String(b.dueAt || b.data.dueDate || "9999"),
      ),
    );
  $: mayLead = hasPermission(
    { id: workspace.user.id, grants: workspace.user.grants || [] },
    "task.manage",
    { departmentId: workspace.department.id },
  );
  $: team = mayLead ? workload() : [];
  function workload() {
    const from = new Date(),
      to = new Date(from.getTime() + 7 * 86400000);
    const planned = plannedPersonHours(
      workspace.records.events,
      from,
      to,
      workspace.timezone || "Europe/Berlin",
      workspace.records.calendarCategories,
    );
    return workspace.members
      .filter((member) => member.status === "active")
      .map((member) => {
        const hours = planned.get(member.id) || 0;
        const tasks = workspace.records.tasks.filter(
          (task) =>
            task.data.status !== "done" &&
            Array.isArray(task.data.assigneeIds) &&
            task.data.assigneeIds.includes(member.id),
        ).length;
        return { id: member.id, name: member.name, hours: Math.round(hours * 10) / 10, tasks };
      })
      .filter((member) => member.tasks || member.hours)
      .sort((a, b) => b.tasks - a.tasks || b.hours - a.hours)
      .slice(0, 8);
  }
  onMount(async () => {
    try {
      items = (await api<Planning>("/api/theater")).items;
    } catch (e) {
      error = (e as Error).message;
    }
  });
</script>

{#if reviews.length || team.length || error}<div class="daily-priorities">
    <ErrorMessage message={error} />
    {#if reviews.length}<Section
        title="Abstimmungen, die Aufmerksamkeit brauchen"
        meta="Aktuelle zugängliche Arbeitsstände"
      >
        <div class="list">
          {#each reviews.slice(0, 4) as item (item.id)}<button
              class="notification-row"
              on:click={() =>
                navigate(
                  "/?module=theater&view=collaborations&requestId=" + encodeURIComponent(item.id),
                )}
            >
              <div>
                <strong>{item.title}</strong>
                <p class="small muted">
                  {item.data.dueDate
                    ? "Frist " +
                      theaterLabel(String(item.data.dueDate), workspace.timezone || "Europe/Berlin")
                    : "Ohne Frist"} · Rückmeldung oder nächste Entscheidung prüfen
                </p>
              </div>
            </button>{/each}
        </div>
      </Section>{/if}
    {#if team.length}<Section
        title="Teamaufgaben & kommende Dienste"
        meta="Geladene Termine der nächsten sieben Tage"
      >
        <div class="table-wrap">
          <table>
            <thead><tr><th>Person</th><th>Offene Aufgaben</th><th>Geplante Stunden</th></tr></thead
            ><tbody
              >{#each team as member (member.id)}<tr
                  ><td>{member.name}</td><td>{member.tasks}</td><td
                    >{member.hours.toLocaleString("de-DE")}</td
                  ></tr
                >{/each}</tbody
            >
          </table>
        </div>
        <p class="small muted">
          Die Anzeige umfasst deine zugänglichen, geladenen Aufgaben und Termine. Bestätigte
          Dienstregeln werden bei jeder Planung geprüft.
        </p>
        <Button onClick={() => navigate("calendar")}>Teamplanung öffnen</Button>
      </Section>{/if}
  </div>{/if}

<style>
  .daily-priorities {
    display: grid;
    gap: 20px;
    margin: 20px 0;
  }
  .notification-row {
    text-align: left;
    width: 100%;
  }
</style>
