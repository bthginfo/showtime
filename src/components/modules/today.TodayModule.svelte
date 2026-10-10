<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { ArrowRight, CalendarDays, CheckCircle2, ChevronRight, Clock3, Sparkles, } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { dateLabel, hours, ids, localDate, shiftDate, timeAllocations, value, weekStart, } from "@/shared/client-api";
import { recordHref } from "@/shared/client-navigation";
import { isStaff } from "@/shared/client-members";
import { useWorkspace } from "../workspace-context";
import { Badge, Button, Empty, PageHeader, Section } from "../ui";
import { RecordDetail } from "../resource-view";
import { TimerPanel } from "./time";
import { expandEvents } from "./calendar";
import { statusLabels } from "../resource-fields";
import { initialPeriod, recordMatchesPeriod } from "@/shared/period-filter";
import { unreadNotifications } from "@/modules/notifications/unread";
import { AttendanceBalanceCard, attendanceBalanceStyles, } from "@/modules/time-tracking/components/attendance-balance";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
type ViewProps = {
    navigate: (module: string) => void;
};
export let navigate: ViewProps["navigate"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace, action, notify } = $workspaceStore;
$: ({ workspace, action, notify } = $workspaceStore);
let showTimer = isStaff(workspace.user);
let detail: DomainRecord | null = initialState<DomainRecord | null>(null);
const setDetail = (next: DomainRecord | null | ((current: DomainRecord | null) => DomainRecord | null)) => { detail = typeof next === "function" ? (next as (current: DomainRecord | null) => DomainRecord | null)(detail) : next; };
let now = (Date.now)();
let today = localDate(new Date(now));
let week = weekStart();
let weekEnd = shiftDate(week, 6);
let myTasks = workspace.records.tasks.filter((x) => ids(x.data, "assigneeIds").includes(workspace.user.id) &&
    x.data.status !== "done" &&
    recordMatchesPeriod(x, initialPeriod(workspace.records.productions), workspace.records.productions));
let upcomingEvents = expandEvents(workspace.records.events.filter((x) => ids(x.data, "participantIds").includes(workspace.user.id)), `${today}T00:00:00`, new Date(now + 7 * 86400000).toISOString(), workspace.records.productions, workspace.records.calendarCategories)
    .sort((a, b) => a.start.localeCompare(b.start))
    .filter((x) => new Date(x.end).getTime() >= now);
let myEvents = upcomingEvents.slice(0, 5);
let performances = upcomingEvents.filter((event) => event.extendedProps.record.data.category === "performance" &&
    new Date(event.start).getTime() >= now);
let attendanceDays = (workspace.records.attendance || [])
    .filter((x) => x.data.userId === workspace.user.id)
    .flatMap((x) => timeAllocations(x.data));
let total = attendanceDays
    .filter((day) => day.date >= week && day.date <= weekEnd)
    .reduce((sum, day) => sum + day.seconds, 0);
let notices = unreadNotifications(workspace.records.notifications, workspace.user.id);
let hour = new Date().getHours();
let greet = hour < 11 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend";

$: showTimer = isStaff(workspace.user);
$: today = localDate(new Date(now));
$: week = weekStart();
$: weekEnd = shiftDate(week, 6);
$: myTasks = workspace.records.tasks.filter((x) => ids(x.data, "assigneeIds").includes(workspace.user.id) &&
    x.data.status !== "done" &&
    recordMatchesPeriod(x, initialPeriod(workspace.records.productions), workspace.records.productions));
$: upcomingEvents = expandEvents(workspace.records.events.filter((x) => ids(x.data, "participantIds").includes(workspace.user.id)), `${today}T00:00:00`, new Date(now + 7 * 86400000).toISOString(), workspace.records.productions, workspace.records.calendarCategories)
    .sort((a, b) => a.start.localeCompare(b.start))
    .filter((x) => new Date(x.end).getTime() >= now);
$: myEvents = upcomingEvents.slice(0, 5);
$: performances = upcomingEvents.filter((event) => event.extendedProps.record.data.category === "performance" &&
    new Date(event.start).getTime() >= now);
$: attendanceDays = (workspace.records.attendance || [])
    .filter((x) => x.data.userId === workspace.user.id)
    .flatMap((x) => timeAllocations(x.data));
$: total = attendanceDays
    .filter((day) => day.date >= week && day.date <= weekEnd)
    .reduce((sum, day) => sum + day.seconds, 0);
$: notices = unreadNotifications(workspace.records.notifications, workspace.user.id);
$: hour = new Date().getHours();
$: greet = hour < 11 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend";

</script>


      <PageHeader eyebrow={new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
})
    .format(new Date())
    .toUpperCase()} title={`${greet}, ${workspace.user.name.split(" ")[0]}.`} description="Dein Tag hinter der Bühne. Alles Wichtige an einem Ort.">
        <Button variant="primary" onClick={() => navigate("time")}>
          <Clock3 size={16}></Clock3>
          Zeit buchen
        </Button>
      </PageHeader>
      <div class={`today-summary${showTimer ? ` ${attendanceBalanceStyles.dashboardSummary}` : ""}`}>
        <button on:click={() => navigate(myTasks.some((task) => task.data.productionId) ? "productions" : "tasks")}>
          <span class="summary-icon">
            <CheckCircle2 size={21}></CheckCircle2>
          </span>
          <div>
            <strong>{myTasks.length}</strong>
            <span>offene Aufgaben</span>
          </div>
          <ChevronRight size={17}></ChevronRight>
        </button>
        <button on:click={() => navigate("calendar")}>
          <span class="summary-icon blue">
            <CalendarDays size={21}></CalendarDays>
          </span>
          <div>
            <strong>{performances.length}</strong>
            <span>Vorstellungen (7 Tage)</span>
          </div>
          <ChevronRight size={17}></ChevronRight>
        </button>
        <div class="hours-summary">
          <button class="summary-hours-action" on:click={() => navigate("time")} aria-label={`Anwesenheit diese Woche: ${hours(total)} Stunden. Anwesenheit öffnen`}>
            <span class="summary-icon coral">
              <Clock3 size={21}></Clock3>
            </span>
            <div aria-live="polite">
              <strong>
                {hours(total)} <small>h</small>
              </strong>
              <span>Anwesenheit diese Woche</span>
            </div>
            <ChevronRight size={17}></ChevronRight>
          </button>
        </div>
        {#if showTimer}<AttendanceBalanceCard compact onOpenSettings={() => navigate("settings")}></AttendanceBalanceCard>{/if}
      </div>
      <div class={`today-layout${showTimer ? " today-layout--with-timer" : ""}`}>
        <div class="today-main">
          <div class="today-notifications">
            <Section title="Neu für dich" meta={`${notices.length} ungelesene Mitteilungen`}>
              {#if notices.length}<div class="list">
                  {#each notices.slice(0, 6) as notice (notice.id)}<button class="notification-row" on:click={async () => {
    try {
        await action("notification-read", notice.id);
        const link = value(notice.data, "link");
        if (link.startsWith("/") && !link.startsWith("//"))
            navigate(link);
    }
    catch (e) {
        notify(e instanceof Error ? e.message : "Aktion fehlgeschlagen");
    }
}}>
                      <span class="notice-dot"></span>
                      <div>
                        <strong>{value(notice.data, "title")}</strong>
                        <p class="small muted">{value(notice.data, "body")}</p>
                      </div>
                    </button>{/each}
                </div>{:else}<p class="empty-inline">
                  <Sparkles size={18}></Sparkles>
                  Alles auf dem neuesten Stand.
                </p>{/if}
            </Section>
          </div>
          <Section title="Als Nächstes" meta="Dein persönlicher Kalender" action={() => navigate("calendar")}>
            {#if myEvents.length}<div class="schedule-list">
                {#each myEvents as event (event.id)}<button class="schedule-row" on:click={() => setDetail(event.extendedProps.record)}>
                    <div class="schedule-date">
                      <strong>{Number(localDate(new Date(event.start)).slice(8))}</strong>
                      <span>
                        {new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "short",
}).format(new Date(event.start))}
                      </span>
                    </div>
                    <div class="schedule-info">
                      <Badge tone={event.extendedProps.record.data.category === "performance"
    ? "coral"
    : "green"}>
                        {event.categoryName}
                      </Badge>
                      <h3>{event.title}</h3>
                      <p class="small muted">
                        {event.allDay
    ? "Ganztägig"
    : `${new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(new Date(event.start))}–${new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(new Date(event.end))}`}{" "}
                        · {value(event.extendedProps.record.data, "location") || "Ort noch offen"}
                      </p>
                    </div>
                    <ArrowRight size={17}></ArrowRight>
                  </button>{/each}
              </div>{:else}<Empty title="Dein Kalender hat noch Luft." description="Sobald Dienste oder Termine für dich geplant sind, findest du sie hier." action="Kalender öffnen" onAction={() => navigate("calendar")}></Empty>{/if}
          </Section>
          <Section title="Deine Aufgaben" meta="Was als Nächstes ansteht" action={() => navigate(myTasks.some((task) => task.data.productionId) ? "productions" : "tasks")}>
            {#if myTasks.length}<div class="list">
                {#each myTasks.slice(0, 6) as task (task.id)}<button class="task-list-row" on:click={() => navigate(recordHref(task))}>
                    <span class={`status-dot ${value(task.data, "status")}`}></span>
                    <div>
                      <strong>{value(task.data, "title")}</strong>
                      <p class="small muted">
                        {(workspace.records.productions.find((x) => x.id === task.data.productionId)
    ?.data.title as string) || "Teamboard"}
                        {task.data.due ? ` · bis ${dateLabel(value(task.data, "due"))}` : ""}
                      </p>
                    </div>
                    <Badge tone={task.data.priority === "high" ? "coral" : "neutral"}>
                      {task.data.priority === "high"
    ? "Hoch"
    : statusLabels[value(task.data, "status")]}
                    </Badge>
                  </button>{/each}
              </div>{:else}<Empty title="Aktuell nichts offen." description="Neue Aufgaben, die dir zugeteilt werden, erscheinen hier. Im Board findest du alle Aufgaben eurer Produktionen." action="Zum Aufgabenboard" onAction={() => navigate("tasks")}></Empty>{/if}
          </Section>
        </div>
        {#if showTimer}<aside class="today-aside">
            <TimerPanel compact></TimerPanel>
          </aside>{/if}
      </div>
      {#if detail}<RecordDetail record={detail} onClose={() => setDetail(null)}></RecordDetail>{/if}
