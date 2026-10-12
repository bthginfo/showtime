<script lang="ts">
  import { ArrowRight, Clock3, Plus } from "@lucide/svelte";
  import { useWorkspace } from "@/components/workspace-context";
  import { useTheaterTime } from "@/components/theater-time";
  import { PageHeader, Section, Button, Empty } from "@/components/ui";
  import { hasPermission } from "@/platform/access";
  import { moduleById } from "./registry";
  import { tradeGuides } from "@/shared/trade-guides";
  import { ids, value, shiftDate } from "@/shared/client-api";
  import { recordHref } from "@/shared/client-navigation";
  import { expandEvents } from "@/components/modules/calendar";
  import { TimerPanel } from "@/components/modules/time";
  import { AttendanceBalanceCard } from "@/modules/time-tracking/components/attendance-balance";
  import { unreadNotifications } from "@/modules/notifications/unread";
  import DailyPriorities from "./daily-priorities.svelte";
  import WorkTiles from "@/components/work-tiles.svelte";
  import { homeWorkTiles } from "@/shared/workspace-tiles";
  export let navigate: (url: string) => void;
  const store = useWorkspace();
  const { localDate, dateLabel } = useTheaterTime();
  $: workspace = $store.workspace;
  $: manifest = moduleById(workspace.currentModuleId || "");
  $: guide = tradeGuides[workspace.currentModuleId || ""];
  $: subject = { id: workspace.user.id, grants: workspace.user.grants || [] };
  $: scope = { departmentId: workspace.department.id };
  $: primary = manifest?.features.find(
    (feature) => feature.id !== "readiness" && hasPermission(subject, feature.permission, scope),
  );
  $: canTime = hasPermission(subject, "time.own", scope);
  $: tasks = workspace.records.tasks
    .filter(
      (task) =>
        ids(task.data, "assigneeIds").includes(workspace.user.id) &&
        !["done", "cancelled", "archived"].includes(String(task.data.status)),
    )
    .sort((a, b) => String(a.data.due || "9999").localeCompare(String(b.data.due || "9999")));
  $: today = localDate();
  $: events = expandEvents(
    workspace.records.events.filter(
      (event) =>
        !event.data.cancelled && ids(event.data, "participantIds").includes(workspace.user.id),
    ),
    `${today}T00:00:00`,
    `${shiftDate(today, 7)}T23:59:59`,
    workspace.records.productions,
    workspace.records.calendarCategories,
    undefined,
    workspace.timezone,
  )
    .filter((event) => Date.parse(event.end) >= Date.now())
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 5);
  $: notices = unreadNotifications(workspace.records.notifications, workspace.user.id);
  function newEntry() {
    navigate(`/?module=theater&view=trade&featureId=${encodeURIComponent(primary!.id)}&create=1`);
  }
</script>

<div class="trade-home theater-workspace">
  <PageHeader title={manifest?.label || workspace.department.name}>
    <Button
      onClick={() =>
        navigate(`/?module=help&guide=${workspace.currentModuleId || "trade-onboarding"}`)}
      >Hilfe</Button
    >
    {#if primary}<Button variant="primary" onClick={newEntry}
        ><Plus size={16} />{primary.label} anlegen</Button
      >{/if}
  </PageHeader>
  <p class="home-purpose">
    {guide?.purpose || "Deine Termine, Aufgaben und Arbeitsstände an einem Ort."}
  </p>
  <nav aria-label="Schnelleinstieg für dein Gewerk">
    <WorkTiles label="Schnelleinstieg" tiles={homeWorkTiles} />
  </nav>
  <div class="home-columns">
    <Section
      title="Deine nächsten Termine"
      meta="Nächste 7 Tage"
      action={() => navigate("calendar")}
    >
      {#if events.length}<div class="list">
          {#each events as event (event.id)}<button
              class="home-row"
              on:click={() => navigate(recordHref(event.extendedProps.record))}
            >
              <div class="home-date">
                <strong>{localDate(new Date(event.start)).slice(8)}</strong><span
                  >{new Intl.DateTimeFormat("de-DE", {
                    month: "short",
                    timeZone: workspace.timezone || "Europe/Berlin",
                  }).format(new Date(event.start))}</span
                >
              </div>
              <div>
                <strong
                  >{value(event.extendedProps.record.data, "title") || "Termin ohne Titel"}</strong
                >
                <p class="small muted">
                  {event.allDay
                    ? "Ganztägig"
                    : new Intl.DateTimeFormat("de-DE", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: workspace.timezone || "Europe/Berlin",
                      }).format(new Date(event.start))}{value(
                    event.extendedProps.record.data,
                    "location",
                  )
                    ? " · " + value(event.extendedProps.record.data, "location")
                    : ""}
                </p>
              </div>
              <ArrowRight size={16} />
            </button>{/each}
        </div>{:else}<Empty
          title="Keine persönlichen Termine in den nächsten 7 Tagen"
          description="Im Kalender findest du auch den Plan deines Teams."
          action="Kalender öffnen"
          onAction={() => navigate("calendar")}
        />{/if}
    </Section>
    <Section
      title="Deine offenen Aufgaben"
      meta={`${tasks.length} im geladenen Arbeitsbereich`}
      action={() => navigate("tasks")}
    >
      {#if tasks.length}<div class="list">
          {#each tasks.slice(0, 5) as task (task.id)}<button
              class="home-row"
              on:click={() => navigate(recordHref(task))}
              ><div>
                <strong>{value(task.data, "title") || "Aufgabe"}</strong>
                <p class="small muted">
                  {task.data.due ? "Bis " + dateLabel(String(task.data.due)) : "Ohne Frist"}{task
                    .data.productionId
                    ? " · " +
                      String(
                        workspace.records.productions.find(
                          (production) => production.id === task.data.productionId,
                        )?.data.title || "Produktion",
                      )
                    : ""}
                </p>
              </div>
              <ArrowRight size={16} /></button
            >{/each}
        </div>{:else}<Empty
          title="Du hast keine offenen Aufgaben"
          description="Gemeinsame Aufgaben findest du im Teamboard."
          action="Teamboard öffnen"
          onAction={() => navigate("tasks")}
        />{/if}
    </Section>
  </div>
  {#if notices.length}<Section title="Neu für dich" meta={`${notices.length} ungelesen`}>
      <div class="list">
        {#each notices.slice(0, 3) as notice (notice.id)}<button
            class="home-row"
            on:click={async () => {
              try {
                await $store.action("notification-read", notice.id);
                const link = value(notice.data, "link");
                if (link.startsWith("/") && !link.startsWith("//")) navigate(link);
              } catch (error) {
                $store.notify((error as Error).message);
              }
            }}
            ><div>
              <strong>{value(notice.data, "title")}</strong>
              <p class="small muted">{value(notice.data, "body")}</p>
            </div>
            <ArrowRight size={16} /></button
          >{/each}
      </div>
    </Section>{/if}
  <DailyPriorities {navigate} />
  {#if canTime}<details class="surface task-disclosure">
      <summary
        ><span class="home-time-title"><Clock3 size={18} />Meine Zeiten</span><span
          class="small muted">Anwesenheit, Saldo und Tätigkeiten</span
        ></summary
      >
      <div class="disclosure-body home-time">
        <AttendanceBalanceCard compact onOpenSettings={() => navigate("settings")} /><TimerPanel
        /><Button onClick={() => navigate("time")}>Zeiten öffnen und bearbeiten</Button>
      </div>
    </details>{/if}
</div>

<style>
  .trade-home {
    display: grid;
  }
  .home-purpose {
    max-width: 72ch;
    color: var(--muted);
    margin: -8px 0 0;
    line-height: 1.6;
  }
  .home-columns {
    display: grid;
    align-items: start;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 24px;
  }
  .home-row {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    text-align: left;
    padding: 18px 20px;
    border: 0;
    border-bottom: 1px solid var(--border);
    background: none;
    color: var(--text);
  }
  .home-row:last-child {
    border-bottom: 0;
  }
  .home-row:hover {
    background: var(--surface-soft);
  }
  .home-row > div:not(.home-date) {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .home-row > :global(svg) {
    flex: 0 0 auto;
    color: var(--muted);
  }
  .home-row strong {
    font-size: 14px;
  }
  .home-row p {
    margin: 6px 0 0;
  }
  .home-date {
    width: 36px;
    flex: 0 0 auto;
    display: grid;
    gap: 2px;
    text-align: center;
  }
  .home-date strong {
    font-size: 20px;
  }
  .home-date span {
    color: var(--muted);
    font-size: 12px;
  }
  .home-time {
    display: grid;
    gap: 20px;
  }
  .home-time-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  @media (max-width: 760px) {
    .home-columns {
      grid-template-columns: minmax(0, 1fr);
      gap: 20px;
    }
    .home-row {
      padding: 16px 18px;
    }
  }
</style>
