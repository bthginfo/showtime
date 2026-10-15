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
  import WorkTiles from "@/components/work-tiles.svelte";
  import { tradeStatus } from "@/shared/trade-actions";
  import { tradeChoiceLabel } from "@/shared/trade-labels";
  export let navigate: (url: string) => void;
  const store = useWorkspace();
  let items: Planning["items"] = [],
    error = "",
    partial = false;
  $: workspace = $store.workspace;
  $: attention = items
    .filter(
      (item) =>
        item.moduleId === workspace.currentModuleId &&
        !["workspace", "collaboration"].includes(item.type) &&
        !["done", "ready", "approved", "archived", "cancelled"].includes(item.status) &&
        (item.status === "blocked" ||
          item.ownerId === workspace.user.id ||
          item.createdBy === workspace.user.id ||
          item.data._deputyId === workspace.user.id),
    )
    .sort(
      (a, b) =>
        Number(b.status === "blocked") - Number(a.status === "blocked") ||
        String(a.dueAt || "9999").localeCompare(String(b.dueAt || "9999")) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  $: attentionTiles = attention.slice(0, 4).map((item) => ({
    id: item.id,
    title: item.title,
    description: `${tradeStatus(item) || tradeChoiceLabel(item.status)}${
      item.dueAt
        ? " · fällig " + theaterLabel(item.dueAt, workspace.timezone || "Europe/Berlin")
        : " · ohne Frist"
    }`,
    href:
      "/?" +
      new URLSearchParams({
        module: "theater",
        view: "trade",
        itemId: item.id,
        featureId: item.type,
        tradeModule: item.moduleId,
        ...(item.productionId ? { productionId: item.productionId } : {}),
      }),
  }));
  $: reviews = items
    .filter(
      (item) =>
        item.type === "collaboration" &&
        collaborationOpen(item.status) &&
        (item.departmentId === workspace.department.id ||
          item.data.recipientDepartmentId === workspace.department.id),
    )
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
      .filter(
        (member) =>
          member.status === "active" &&
          (member.id === workspace.user.id ||
            member.activeDepartmentIds?.includes(workspace.department.id) ||
            member.departmentId === workspace.department.id),
      )
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
      const planning = await api<Planning>("/api/theater");
      items = planning.items;
      partial = !!planning.nextCursor;
    } catch (e) {
      error = (e as Error).message;
    }
  });
</script>

{#if attention.length || reviews.length || team.length || partial || error}<div
    class="daily-priorities"
  >
    <ErrorMessage message={error} />
    {#if attention.length}<Section
        title="Deine Facharbeit mit Handlungsbedarf"
        meta={`${attention.length} im geladenen Bestand${partial ? " · weitere vorhanden" : ""}`}
      >
        <WorkTiles label="Arbeitsstände mit Handlungsbedarf" tiles={attentionTiles} />
        {#if partial}<p class="small muted priority-note">
            Die Kacheln zeigen die aktuell geladene Seite. Im Gewerk kannst du weitere Arbeitsstände
            laden.
          </p>{/if}
      </Section>{/if}
    {#if !attention.length && !reviews.length && partial}<Section
        title="Weitere Facharbeit prüfen"
        meta="Weitere Arbeitsstände sind vorhanden"
      >
        <div class="panel-content">
          <p class="muted">
            Auf der geladenen Seite liegt gerade nichts Eigenes oder Blockiertes. Im Gewerk kannst
            du ältere Arbeitsstände nachladen und filtern.
          </p>
          <Button onClick={() => navigate("/?module=theater&view=trade")}
            >Gewerk öffnen und weitere laden</Button
          >
        </div>
      </Section>{/if}
    {#if reviews.length}<Section
        title="Abstimmungen, die Aufmerksamkeit brauchen"
        meta={`Aktuell zugänglich${partial ? " · weitere Arbeitsstände vorhanden" : ""}`}
      >
        <WorkTiles
          label="Abstimmungen mit Handlungsbedarf"
          tiles={reviews.slice(0, 4).map((item) => ({
            id: item.id,
            title: item.title,
            description: `${
              item.data.dueDate
                ? "Frist " +
                  theaterLabel(String(item.data.dueDate), workspace.timezone || "Europe/Berlin")
                : "Ohne Frist"
            } · Rückmeldung oder Entscheidung prüfen`,
            href: "/?module=theater&view=collaborations&requestId=" + encodeURIComponent(item.id),
          }))}
        />
      </Section>{/if}
    {#if team.length}<Section
        title="Teamaufgaben & kommende Dienste"
        meta="Geladene Termine der nächsten sieben Tage"
      >
        <div class="panel-content">
          <div class="table-wrap">
            <table>
              <thead
                ><tr><th>Person</th><th>Offene Aufgaben</th><th>Geplante Stunden</th></tr></thead
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
        </div>
      </Section>{/if}
  </div>{/if}

<style>
  .daily-priorities {
    display: grid;
    gap: 20px;
    margin: 20px 0;
  }
  .priority-note {
    margin: 16px 0 0;
  }
</style>
