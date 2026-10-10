<script lang="ts">
import {memberCan} from "@/shared/access-policy";import { initialState } from '@/shared/svelte-runtime';

import { PeriodPicker, periodExportFilters } from "@/components/period-picker";
import { initialPeriod, seasonBounds, recordMatchesPeriod, type PeriodFilter, } from "@/shared/period-filter";
import FullCalendar from "@/components/full-calendar.svelte";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import deLocale from "@fullcalendar/core/locales/de";
import luxonPlugin from "@fullcalendar/luxon3";
import { occurrences } from "@/modules/calendar/occurrences";
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Plus, SlidersHorizontal, } from "@lucide/svelte";
import type { DomainRecord, Member } from "@/shared/contracts";
import { canManageRecord } from "@/shared/record-permissions";
import { dateLabel, ids, localDate, instantDate, shiftDate, value, weekStart, } from "@/shared/client-api";
import { isActiveStaff } from "@/shared/client-members";
import { calendarEventSelected } from "@/shared/calendar-selection";
import { calendarEventPaint } from "@/shared/calendar-paint";
import { sortCalendarStaff } from "@/shared/calendar-team";
import { bavarianHoliday } from "@/shared/bavarian-holidays";
import { sortProductionsByPremiere } from "@/shared/production-order";
import { useWorkspace } from "../workspace-context";
import { Badge, Button, ErrorMessage, ExportButton, PageHeader } from "../ui";
import { ResourceEditor } from "../resource-editor";
import { RecordDetail } from "../resource-view";
import { ExportDialog } from "../export-dialog";
import { calendarPresentation, calendarCategoryBlocksTime } from "@/shared/calendar-categories";
import { calendarCategories, monthStart, shiftMonth, } from "@/modules/calendar/components/client-calendar";
import { CalendarCategoriesDialog } from "@/modules/calendar/components/categories-dialog";
import { TeamCalendar } from "@/modules/calendar/components/team-calendar";
import { CalendarPresentationControls, useCalendarPresentation, } from "@/modules/calendar/components/calendar-presentation-controls";
import presentationStyles from "@/modules/calendar/components/calendar-presentation.module.css";
import { MobileDaySheet } from "@/modules/calendar/components/mobile-day-sheet";
import { HolidayLabel } from "@/modules/calendar/components/holiday-label";
import { calendarDayIndex, calendarDayLabel } from "@/modules/calendar/components/day-details";
import calendarStyles from "@/modules/calendar/components/mobile-calendar.module.css";
import { statusLabels } from "../resource-fields";
import { useViewState } from "@/shared/view-state";
import { ShiftSwapPanel } from "@/modules/shift-swaps/components/shift-swap-panel";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { calendarClock, expandEvents } from "./calendar";
const effects=createEffects();
let requestedWindow="";
type ViewProps = {
    productionId?: string;
};
export let productionId: NonNullable<ViewProps["productionId"]> = "";
const workspaceStore=useWorkspace();
let { workspace, save, action, busy } = $workspaceStore;
$: ({ workspace, save, action, busy } = $workspaceStore);
let admin = memberCan(workspace.user, 'schedule.manage');
let calendar = {current: null as FullCalendar | null};
let calendarRoot = {current: null as HTMLDivElement | null};
const presentationStore = useCalendarPresentation(()=>(calendarRoot));
let presentation = $presentationStore;
let { exitFullscreen } = presentation;
let actionsMenu = {current: null as HTMLDetailsElement | null};
let mobile: boolean = false;
const setMobile = (next: typeof mobile | ((current: typeof mobile) => typeof mobile)) => { mobile = typeof next === "function" ? (next as (current: typeof mobile) => typeof mobile)(mobile) : next; };
$: effects.run(0, () => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
}, []);
let scope = `calendar:${productionId || "all"}`;
const periodStore = useViewState<PeriodFilter>(workspace.user.id, scope, "period", () => initialPeriod(workspace.records.productions, productionId));
let period: PeriodFilter = $periodStore; $: period = $periodStore;
const setPeriod = periodStore.set;
const viewStore = useViewState<any>(workspace.user.id, scope, "view", "month");
let view: any = $viewStore; $: view = $viewStore;
const setView = viewStore.set;
const teamSpanStore = useViewState<any>(workspace.user.id, scope, "teamSpan", "week");
let teamSpan: any = $teamSpanStore; $: teamSpan = $teamSpanStore;
const setTeamSpan = teamSpanStore.set;
let categoriesOpen: boolean = false;
const setCategoriesOpen = (next: typeof categoriesOpen | ((current: typeof categoriesOpen) => typeof categoriesOpen)) => { categoriesOpen = typeof next === "function" ? (next as (current: typeof categoriesOpen) => typeof categoriesOpen)(categoriesOpen) : next; };
let filtersOpen: boolean = false;
const setFiltersOpen = (next: typeof filtersOpen | ((current: typeof filtersOpen) => typeof filtersOpen)) => { filtersOpen = typeof next === "function" ? (next as (current: typeof filtersOpen) => typeof filtersOpen)(filtersOpen) : next; };
const mobileDayStore = useViewState<any>(workspace.user.id, scope, "mobileDay", localDate());
let mobileDay: any = $mobileDayStore; $: mobileDay = $mobileDayStore;
const setMobileDay = mobileDayStore.set;
let mobileDaySheetOpen: boolean = false;
const setMobileDaySheetOpen = (next: typeof mobileDaySheetOpen | ((current: typeof mobileDaySheetOpen) => typeof mobileDaySheetOpen)) => { mobileDaySheetOpen = typeof next === "function" ? (next as (current: typeof mobileDaySheetOpen) => typeof mobileDaySheetOpen)(mobileDaySheetOpen) : next; };
const filtersId = createId();
let categoryOptions = calendarCategories(workspace);
const peopleStore = useViewState<string[]>(workspace.user.id, scope, "people", workspace.user.role === "superadmin" ? [] : [workspace.user.id]);
let people: string[] = $peopleStore; $: people = $peopleStore;
const setPeople = peopleStore.set;
const showAllStore = useViewState<any>(workspace.user.id, scope, "showAll", false);
let showAll: any = $showAllStore; $: showAll = $showAllStore;
const setShowAll = showAllStore.set;
let personalSelection = {current: null as {
    people: string[];
    showAll: boolean;
} | null | null};
const savedPersonalSelectionStore = useViewState<{
    people: string[];
    showAll: boolean;
} | null>(workspace.user.id, scope, "personalSelection", null);
let savedPersonalSelection: {
    people: string[];
    showAll: boolean;
} | null = $savedPersonalSelectionStore; $: savedPersonalSelection = $savedPersonalSelectionStore;
const setSavedPersonalSelection = savedPersonalSelectionStore.set;
let staff = (() => sortCalendarStaff(workspace.members.filter(isActiveStaff)))();
let productions = (() => sortProductionsByPremiere(workspace.records.productions))();
let visiblePeople = (() => showAll
    ? staff.map((member) => member.id)
    : people.filter((id) => staff.some((member) => member.id === id)))();
const categoryStore = useViewState<any>(workspace.user.id, scope, "category", "");
let category: any = $categoryStore; $: category = $categoryStore;
const setCategory = categoryStore.set;
let leaveCategories: Record<string, string> = initialState<Record<string, string>>({});
const setLeaveCategories = (next: Record<string, string> | ((current: Record<string, string>) => Record<string, string>)) => { leaveCategories = typeof next === "function" ? (next as (current: Record<string, string>) => Record<string, string>)(leaveCategories) : next; };
let absenceCategories = categoryOptions.filter((option) => option.allDay);
let defaultLeaveCategory = absenceCategories.find((option) => option.key === "absence")?.key ||
    absenceCategories.find((option) => option.key === "vacation")?.key ||
    "";
const projectStore = useViewState<any>(workspace.user.id, scope, "project", productionId);
let project: any = $projectStore; $: project = $projectStore;
const setProject = projectStore.set;
let range = (() => ({
    start: weekStart(),
    end: localDate(new Date(Date.now() + 42 * 86400000)),
}))();
const setRange = (next: typeof range | ((current: typeof range) => typeof range)) => { range = typeof next === "function" ? (next as (current: typeof range) => typeof range)(range) : next; };
let exportDates = (() => ({ from: localDate(), to: localDate() }))();
const setExportDates = (next: typeof exportDates | ((current: typeof exportDates) => typeof exportDates)) => { exportDates = typeof next === "function" ? (next as (current: typeof exportDates) => typeof exportDates)(exportDates) : next; };
let title: string = "";
const setTitle = (next: typeof title | ((current: typeof title) => typeof title)) => { title = typeof next === "function" ? (next as (current: typeof title) => typeof title)(title) : next; };
const teamDateStore = useViewState<any>(workspace.user.id, scope, "teamDate", localDate());
let teamDate: any = $teamDateStore; $: teamDate = $teamDateStore;
const setTeamDate = teamDateStore.set;
const calendarDateStore = useViewState<any>(workspace.user.id, scope, "date", localDate());
let calendarDate: any = $calendarDateStore; $: calendarDate = $calendarDateStore;
const setCalendarDate = calendarDateStore.set;
let editor: {
    kind: "events" | "leave";
    defaults?: Record<string, unknown>;
    record?: DomainRecord;
} | null = null;
const setEditor = (next: {
    kind: "events" | "leave";
    defaults?: Record<string, unknown>;
    record?: DomainRecord;
} | null | ((current: {
    kind: "events" | "leave";
    defaults?: Record<string, unknown>;
    record?: DomainRecord;
} | null) => {
    kind: "events" | "leave";
    defaults?: Record<string, unknown>;
    record?: DomainRecord;
} | null)) => { editor = typeof next === "function" ? (next as (current: {
    kind: "events" | "leave";
    defaults?: Record<string, unknown>;
    record?: DomainRecord;
} | null) => {
    kind: "events" | "leave";
    defaults?: Record<string, unknown>;
    record?: DomainRecord;
} | null)(editor) : next; };
let detail: DomainRecord | null = initialState<DomainRecord | null>(null);
const setDetail = (next: DomainRecord | null | ((current: DomainRecord | null) => DomainRecord | null)) => { detail = typeof next === "function" ? (next as (current: DomainRecord | null) => DomainRecord | null)(detail) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let exporting: boolean = false;
const setExporting = (next: typeof exporting | ((current: typeof exporting) => typeof exporting)) => { exporting = typeof next === "function" ? (next as (current: typeof exporting) => typeof exporting)(exporting) : next; };
$: effects.run(1, () => {
    if (mobile && !editor && !detail && !exporting && !categoriesOpen)
        exitFullscreen();
}, [mobile, editor, detail, exporting, categoriesOpen, exitFullscreen]);
$: effects.run(2, () => {
    const frame = requestAnimationFrame(() => calendar.current?.getApi().updateSize());
    return () => cancelAnimationFrame(frame);
}, [presentation.collapsed, presentation.fullscreen, view]);
$: effects.run(3, () => {
    const root = calendarRoot.current;
    if (!root)
        return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => calendar.current?.getApi().updateSize());
    });
    observer.observe(root);
    return () => {
        observer.disconnect();
        cancelAnimationFrame(frame);
    };
}, []);
let teamStart = teamSpan === "month" ? monthStart(teamDate) : weekStart(instantDate(teamDate));
let teamEnd = teamSpan === "month" ? shiftMonth(teamStart, 1) : shiftDate(teamStart, 7);
let filtered = (() => workspace.records.events.filter((x) => (!project || x.data.productionId === project) &&
    recordMatchesPeriod(x, { season: period.season }, workspace.records.productions) &&
    (!category || x.data.category === category) &&
    calendarEventSelected(x.data, visiblePeople, showAll)))();
let expansionStart = view === "team" ? teamStart : range.start;
let expansionEnd = view === "team" ? teamEnd : range.end;
let expanded = (() => expandEvents(filtered, expansionStart, expansionEnd, workspace.records.productions, workspace.records.calendarCategories, workspace.user).filter((event) => {
    const bounds = seasonBounds(period.season);
    return (!bounds ||
        (new Date(event.end).getTime() > instantDate(bounds.from).getTime() &&
            new Date(event.start).getTime() < instantDate(bounds.to).getTime()));
}))();
let dayEntries = (() => calendarDayIndex(expanded, localDate(instantDate(range.start)), shiftDate(localDate(instantDate(range.end)), -1)))();
let selectedDayCount = dayEntries.get(mobileDay)?.length || 0;
let calendarEvents = (() => expanded.map((event) => ({
    ...event,
    display: event.background && !event.allDay && (view === "week" || view === "day")
        ? "background"
        : "block",
    classNames: event.background ? [calendarStyles.backgroundEvent] : [],
})))();
let openMobileDay = (day: string) => {
    setMobileDay(day);
    setMobileDaySheetOpen(true);
};
let overlaps = expanded.filter((event, i) => expanded
    .slice(i + 1)
    .some((other) => calendarCategoryBlocksTime(value(event.extendedProps.record.data, "category"), workspace.records.calendarCategories) &&
    calendarCategoryBlocksTime(value(other.extendedProps.record.data, "category"), workspace.records.calendarCategories) &&
    event.start < other.end &&
    event.end > other.start &&
    ids(event.extendedProps.record.data, "participantIds").some((id) => ids(other.extendedProps.record.data, "participantIds").includes(id))));
let leaves = workspace.records.leave
    .filter((x) => admin || x.data.userId === workspace.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
let changeView = (next: string) => {
    setMobileDaySheetOpen(false);
    if (next === "team" && view !== "team") {
        personalSelection.current = { people, showAll };
        setSavedPersonalSelection({ people, showAll });
        setShowAll(true);
    }
    else if (next !== "team" &&
        view === "team" &&
        (personalSelection.current || savedPersonalSelection)) {
        const previous = personalSelection.current || savedPersonalSelection!;
        setPeople(previous.people);
        setShowAll(previous.showAll);
        personalSelection.current = null;
        setSavedPersonalSelection(null);
    }
    setView(next);
    if (next !== "team")
        calendar.current?.getApi().changeView(({
            month: "dayGridMonth",
            week: "timeGridWeek",
            day: "timeGridDay",
            agenda: "listMonth",
        } as Record<string, string>)[next]);
};
let run = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
        await fn();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Aktion fehlgeschlagen");
    }
};
let teamDays = Array.from({
    length: Math.round((new Date(`${teamEnd}T12:00:00Z`).getTime() -
        new Date(`${teamStart}T12:00:00Z`).getTime()) /
        86400000),
}, (_, i) => shiftDate(teamStart, i));

$: admin = memberCan(workspace.user, 'schedule.manage');
$: (presentation = $presentationStore);
$: ({ exitFullscreen } = presentation);
$: scope = `calendar:${productionId || "all"}`;
$: categoryOptions = calendarCategories(workspace);
$: staff = (() => sortCalendarStaff(workspace.members.filter(isActiveStaff)))();
$: productions = (() => sortProductionsByPremiere(workspace.records.productions))();
$: visiblePeople = (() => showAll
    ? staff.map((member) => member.id)
    : people.filter((id) => staff.some((member) => member.id === id)))();
$: absenceCategories = categoryOptions.filter((option) => option.allDay);
$: defaultLeaveCategory = absenceCategories.find((option) => option.key === "absence")?.key ||
    absenceCategories.find((option) => option.key === "vacation")?.key ||
    "";
$: teamStart = teamSpan === "month" ? monthStart(teamDate) : weekStart(instantDate(teamDate));
$: teamEnd = teamSpan === "month" ? shiftMonth(teamStart, 1) : shiftDate(teamStart, 7);
$: filtered = (() => workspace.records.events.filter((x) => (!project || x.data.productionId === project) &&
    recordMatchesPeriod(x, { season: period.season }, workspace.records.productions) &&
    (!category || x.data.category === category) &&
    calendarEventSelected(x.data, visiblePeople, showAll)))();
$: expansionStart = view === "team" ? teamStart : range.start;
$: expansionEnd = view === "team" ? teamEnd : range.end;
$: expanded = (() => expandEvents(filtered, expansionStart, expansionEnd, workspace.records.productions, workspace.records.calendarCategories, workspace.user).filter((event) => {
    const bounds = seasonBounds(period.season);
    return (!bounds ||
        (new Date(event.end).getTime() > instantDate(bounds.from).getTime() &&
            new Date(event.start).getTime() < instantDate(bounds.to).getTime()));
}))();
$: dayEntries = (() => calendarDayIndex(expanded, localDate(instantDate(range.start)), shiftDate(localDate(instantDate(range.end)), -1)))();
$: selectedDayCount = dayEntries.get(mobileDay)?.length || 0;
$: calendarEvents = (() => expanded.map((event) => ({
    ...event,
    display: event.background && !event.allDay && (view === "week" || view === "day")
        ? "background"
        : "block",
    classNames: event.background ? [calendarStyles.backgroundEvent] : [],
})))();

$: overlaps = expanded.filter((event, i) => expanded
    .slice(i + 1)
    .some((other) => calendarCategoryBlocksTime(value(event.extendedProps.record.data, "category"), workspace.records.calendarCategories) &&
    calendarCategoryBlocksTime(value(other.extendedProps.record.data, "category"), workspace.records.calendarCategories) &&
    event.start < other.end &&
    event.end > other.start &&
    ids(event.extendedProps.record.data, "participantIds").some((id) => ids(other.extendedProps.record.data, "participantIds").includes(id))));
$: leaves = workspace.records.leave
    .filter((x) => admin || x.data.userId === workspace.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));


$: teamDays = Array.from({
    length: Math.round((new Date(`${teamEnd}T12:00:00Z`).getTime() -
        new Date(`${teamStart}T12:00:00Z`).getTime()) /
        86400000),
}, (_, i) => shiftDate(teamStart, i));

$: if(view === "team" && teamStart && teamEnd && requestedWindow !== teamStart+":"+teamEnd){ requestedWindow=teamStart+":"+teamEnd; void $workspaceStore.loadWindow("events",teamStart,shiftDate(teamEnd,-1)).catch(e=>$workspaceStore.notify(e.message)); }
</script>
{#if true}
{#snippet inline_dayHeaderContent_0(info: any)}{#if view === "week" || view === "day"}<span class={calendarStyles.dateHeader}>
                      <span>{info.text}</span>
                      <HolidayLabel date={localDate(info.date)} compact={mobile}></HolidayLabel>
                    </span>{:else}{info.text}{/if}{/snippet}
{#snippet inline_dayCellContent_1(info: any)}{#if view !== "month"}{info.dayNumberText}{:else}{@const day = localDate(info.date)}{@const holiday = bavarianHoliday(day)}{#if !mobile}<span class={calendarStyles.monthDate}><span>{info.dayNumberText}</span><HolidayLabel date={day}></HolidayLabel></span>{:else}{@const count = dayEntries.get(day)?.length || 0}<button type="button" class={calendarStyles.dayButton} data-calendar-day={day} data-holiday={holiday ? "true" : undefined} aria-haspopup="dialog" aria-pressed={day === mobileDay} aria-label={`${calendarDayLabel(day)}${holiday ? ` · ${holiday}` : ""}: ${count} ${count === 1 ? "Termin" : "Termine"}. Details anzeigen`} on:click={(event) => {
    event.stopPropagation();
    openMobileDay(day);
}}>
                      {#if count > 1}<span class={calendarStyles.busyCount} aria-hidden="true">
                          {count}
                        </span>{/if}
                      <span class={calendarStyles.monthDate}>
                        <span>{info.dayNumberText}</span>
                        <HolidayLabel date={day} compact></HolidayLabel>
                      </span>
                    </button>{/if}{/if}{/snippet}
{#snippet inline_eventContent_2(info: any)}{@const hours = `${calendarClock(info.event.start)}–${calendarClock(info.event.end)}`}<button type="button" class={calendarStyles.backgroundLabel} aria-label={`${info.event.title} · ${hours} · Details anzeigen`} on:mousedown={(event) => event.stopPropagation()} on:touchstart={(event) => event.stopPropagation()} on:click={(event) => {
    event.stopPropagation();
    setDetail(info.event.extendedProps.record as DomainRecord);
}}>
                      <strong>{info.event.title}</strong>
                      <span>{hours}</span>
                    </button>{/snippet}
<div bind:this={calendarRoot.current} class={`calendar-module ${calendarStyles.calendar}${presentation.collapsed ? ` ${presentationStyles.collapsed}` : ""}${presentation.fullscreen ? ` ${presentationStyles.focus} calendar-focus-view` : ""}`} data-calendar-fullscreen={presentation.fullscreen || undefined}>
      <PageHeader eyebrow="DEIN DIENSTPLAN. GEMEINSAM GEPLANT." title="Kalender" description="Eigene Dienste, Teamkalender und freie Tage im Überblick.">
        <div class="calendar-desktop-actions">
          <CalendarPresentationControls collapsed={presentation.collapsed} fullscreen={presentation.fullscreen} filtersId={filtersId} onToggleFilters={presentation.toggleFilters} onToggleFullscreen={presentation.toggleFullscreen}></CalendarPresentationControls>
          <ExportButton onClick={() => setExporting(true)}></ExportButton>
          {#if workspace.user.role !== "superadmin"}<Button onClick={() => setEditor({ kind: "leave" })}>Freien Tag wünschen</Button>{/if}
          {#if admin}<Button onClick={() => setCategoriesOpen(true)}>Kalenderarten</Button>{/if}
        </div>
        <Button variant="primary" onClick={() => setEditor({ kind: "events", defaults: { participantIds: visiblePeople } })}>
          <Plus size={16}></Plus>
          Termin
        </Button>
        <details bind:this={actionsMenu.current} class="calendar-mobile-actions" on:keydown={(event) => {
    if (event.key === "Escape") {
        actionsMenu.current?.removeAttribute("open");
        actionsMenu.current?.querySelector("summary")?.focus();
    }
}}>
          <summary class="button">
            Aktionen
            <ChevronDown size={14}></ChevronDown>
          </summary>
          <div class="calendar-action-menu">
            <ExportButton onClick={() => {
    actionsMenu.current?.removeAttribute("open");
    setExporting(true);
}}></ExportButton>
            {#if workspace.user.role !== "superadmin"}<Button onClick={() => {
    actionsMenu.current?.removeAttribute("open");
    setEditor({ kind: "leave" });
}}>
                Freien Tag wünschen
              </Button>{/if}
            {#if admin}<Button onClick={() => {
    actionsMenu.current?.removeAttribute("open");
    setCategoriesOpen(true);
}}>
                Kalenderarten
              </Button>{/if}
          </div>
        </details>
      </PageHeader>
      <div class="calendar-mobile-selection">
        <button class="calendar-filter-toggle" aria-expanded={filtersOpen} aria-controls={filtersId} on:click={() => setFiltersOpen(!filtersOpen)}>
          <SlidersHorizontal size={16}></SlidersHorizontal>
          <span>{showAll ? "Gesamtes Team" : `${visiblePeople.length} Kalender`}</span>
          {#if (category || project)}<span class="calendar-filter-dot" aria-label="Weitere Filter aktiv"></span>{/if}
        </button>
        <button class="calendar-all-toggle" aria-pressed={showAll} on:click={() => {
    setShowAll(!showAll);
    if (showAll)
        setPeople(workspace.user.role === "superadmin" ? [] : [workspace.user.id]);
}}>
          {showAll ? (workspace.user.role === "superadmin" ? "Auswahl" : "Nur ich") : "Alle"}
        </button>
      </div>
      <div class="calendar-layout">
        <aside id={filtersId} class={`calendar-filters${filtersOpen ? " is-open" : ""}`}>
          <h3>Kalender einblenden</h3>
          {#if workspace.user.role !== "superadmin"}<button class="text-button" on:click={() => {
    setShowAll(false);
    setPeople([workspace.user.id]);
}}>
              Nur meinen Kalender
            </button>{/if}
          <button class="text-button" aria-pressed={showAll} on:click={() => {
    setShowAll(!showAll);
    if (showAll)
        setPeople(workspace.user.role === "superadmin" ? [] : [workspace.user.id]);
}}>
            Alle anzeigen
          </button>
          {#each staff as member (member.id)}<label class="check-label">
              <input type="checkbox" checked={visiblePeople.includes(member.id)} on:input={(event) => {
    setShowAll(false);
    setPeople(event.currentTarget.checked
        ? [...visiblePeople, member.id]
        : visiblePeople.filter((x) => x !== member.id));
}} />
              <span class="calendar-person">
                {member.name}
                {#if member.id === workspace.user.id}<span class="small muted"> (ich)</span>{/if}
              </span>
            </label>{/each}
          <p class="small muted" aria-live="polite">
            {showAll
    ? "Gesamtes Team · inklusive Gäste/Aushilfen"
    : visiblePeople.length
        ? `${visiblePeople.length} Kalender ausgewählt`
        : "Kein Kalender ausgewählt. Wähle eine Person oder Alle anzeigen."}
          </p>
          <label>
            Produktion
            <select value={project} disabled={!!productionId} on:change={(e) => setProject(e.currentTarget.value)}>
              <option value="">Alle Produktionen</option>
              {#each productions as x (x.id)}<option value={x.id}>
                  {value(x.data, "title")}
                </option>{/each}
            </select>
          </label>
          <label>
            Kategorie
            <select value={category} on:change={(e) => setCategory(e.currentTarget.value)}>
              <option value="">Alle Kategorien</option>
              {#each categoryOptions as { key, name } (key)}<option value={key}>
                  {name}
                </option>{/each}
            </select>
          </label>
          <PeriodPicker compact records={workspace.records.events} productions={workspace.records.productions} value={period} onChange={(next) => {
    setPeriod(next);
    if (next.year && next.year !== period.year) {
        const bounds = seasonBounds(next.season);
        const date = bounds && Number(bounds.from.slice(0, 4)) === next.year
            ? bounds.from
            : next.year + "-01-01";
        calendar.current?.getApi().gotoDate(date);
        setTeamDate(date);
    }
    else if (next.season && next.season !== period.season) {
        const bounds = seasonBounds(next.season);
        const today = localDate();
        const date = bounds
            ? today >= bounds.from && today < bounds.to
                ? today
                : bounds.from
            : today;
        calendar.current?.getApi().gotoDate(date);
        setTeamDate(date);
    }
}}></PeriodPicker>
          <div class="calendar-legend">
            {#each categoryOptions as { key, color, name } (key)}<span>
                <i style={styleString({ background: color })}></i>
                {name}
              </span>{/each}
          </div>
        </aside>
        <section class="calendar-board">
          <div class="calendar-toolbar">
            <div class="calendar-navigation">
              <button class="icon-button" aria-label="Vorheriger Zeitraum" on:click={() => view === "team"
    ? setTeamDate(teamSpan === "month" ? shiftMonth(teamDate, -1) : shiftDate(teamDate, -7))
    : calendar.current?.getApi().prev()}>
                <ChevronLeft size={18}></ChevronLeft>
              </button>
              <button class="icon-button" aria-label="Nächster Zeitraum" on:click={() => view === "team"
    ? setTeamDate(teamSpan === "month" ? shiftMonth(teamDate, 1) : shiftDate(teamDate, 7))
    : calendar.current?.getApi().next()}>
                <ChevronRight size={18}></ChevronRight>
              </button>
              <Button onClick={() => view === "team" ? setTeamDate(localDate()) : calendar.current?.getApi().today()}>
                Heute
              </Button>
              <h2>
                {view === "team"
    ? teamSpan === "month"
        ? new Intl.DateTimeFormat("de-DE", {
            timeZone: "Europe/Berlin",
            month: "long",
            year: "numeric",
        }).format(new Date(`${teamStart}T12:00:00Z`))
        : `Woche ab ${dateLabel(teamStart)}`
    : title}
              </h2>
            </div>
            <div class="segmented">
              {#each [
    ["month", "Monat"],
    ["week", "Woche"],
    ["day", "Tag"],
    ["agenda", "Agenda"],
    ["team", "Team"],
] as [key, label] (key)}<button class={view === key ? "active" : ""} on:click={() => changeView(key)}>
                  {label}
                </button>{/each}
            </div>
          </div>
          {#if view === "team"}<div class="team-span-controls segmented" aria-label="Teamzeitraum">
              {#each [
    ["week", "Teamwoche"],
    ["month", "Teammonat"],
] as [key, label] (key)}<button class={teamSpan === key ? "active" : ""} on:click={() => {
    setTeamSpan(key);
}}>
                  {label}
                </button>{/each}
            </div>{/if}
          {#if overlaps.length > 0}<div class="conflict-note">
              <AlertTriangle size={16}></AlertTriangle>
              {overlaps.length} Terminüberschneidung(en) im sichtbaren Zeitraum. Prüfe die
              betroffenen Dienste.
            </div>{/if}
          <ErrorMessage message={error}></ErrorMessage>
          {#if view === "team"}<TeamCalendar events={expanded} members={workspace.members} people={visiblePeople} days={teamDays} month={teamSpan === "month"} mobile={mobile} canPlan={(person) => admin || person === workspace.user.id} productions={workspace.records.productions} suspended={!!detail || !!editor} canEdit={(record) => canManageRecord(workspace.user, "events", record)} onOpen={setDetail} onEdit={(record) => setEditor({ kind: "events", record })} onCreate={(defaults) => setEditor({ kind: "events", defaults })}></TeamCalendar>{:else}
              <FullCalendar bind:this={calendar.current} plugins={[
    dayGridPlugin,
    timeGridPlugin,
    listPlugin,
    interactionPlugin,
    luxonPlugin,
]} initialView={view === "week"
    ? "timeGridWeek"
    : view === "day"
        ? "timeGridDay"
        : view === "agenda"
            ? "listMonth"
            : "dayGridMonth"} locale={deLocale} initialDate={calendarDate} timeZone="Europe/Berlin" firstDay={1} slotMinTime="06:00:00" slotMaxTime="25:00:00" scrollTime="06:00:00" headerToolbar={false} height={presentation.fullscreen ? "100%" : "auto"} fixedWeekCount={!mobile} nowIndicator dayMaxEvents={mobile ? 1 : 3} dayCellClassNames={(info: any) => localDate(info.date) === mobileDay ? ["mobile-selected-day"] : []} dayHeaderContent={inline_dayHeaderContent_0} dayCellContent={inline_dayCellContent_1} moreLinkClick={(info: any) => {
    if (!mobile || view !== "month")
        return "popover";
    openMobileDay(localDate(info.date));
    return "dayGridMonth";
}} selectable={true} editable={true} eventStartEditable={true} events={calendarEvents} eventDisplay="block" selectOverlap={true} eventContent={inline_eventContent_2} eventContentWhen={(info: any) => info.event.display === "background"} eventDidMount={(info: any) => {
    if (info.event.display === "background")
        info.el.style.setProperty("--calendar-background-border", info.event.borderColor);
}} datesSet={(info: any) => {
    const query=localDate(info.start)+":"+localDate(info.end);if(requestedWindow!==query){requestedWindow=query;void $workspaceStore.loadWindow("events",localDate(info.start),shiftDate(localDate(info.end),-1)).catch(e=>$workspaceStore.notify(e.message));}
    setCalendarDate(localDate(info.view.currentStart));
    setTitle(info.view.title);
    const firstDay = localDate(info.view.currentStart);
    const afterLastDay = localDate(info.view.currentEnd);
    const today = localDate();
    setMobileDay((current: string) => current >= firstDay && current < afterLastDay
        ? current
        : today >= firstDay && today < afterLastDay
            ? today
            : firstDay);
    setExportDates((current) => {
        const from = localDate(info.view.currentStart), to = shiftDate(localDate(info.view.currentEnd), -1);
        return current.from === from && current.to === to ? current : { from, to };
    });
    setRange((current) => current.start === info.startStr && current.end === info.endStr
        ? current
        : { start: info.startStr, end: info.endStr });
}} eventClick={(info: any) => setDetail(info.event.extendedProps.record as DomainRecord)} dateClick={(info: any) => {
    const day = localDate(info.date);
    if (mobile && view === "month")
        openMobileDay(day);
    else
        setMobileDay(day);
}} select={(info: any) => {
    if (info.view.type === "dayGridMonth" &&
        window.matchMedia("(max-width: 760px)").matches) {
        openMobileDay(localDate(info.start));
        calendar.current?.getApi().unselect();
        return;
    }
    const start = info.allDay ? `${localDate(info.start)}T09:00` : info.startStr;
    const end = info.allDay ? `${localDate(info.start)}T17:00` : info.endStr;
    setEditor({
        kind: "events",
        defaults: { start, end, participantIds: visiblePeople },
    });
}} eventDrop={(info: any) => {
    const record = info.event.extendedProps.record as DomainRecord;
    void run(async () => {
        try {
            await save("events", {
                start: info.event.start?.toISOString(),
                end: info.event.end?.toISOString(),
            }, record);
        }
        catch (e) {
            info.revert();
            throw e;
        }
    });
}} eventResize={(info: any) => {
    const record = info.event.extendedProps.record as DomainRecord;
    void run(async () => {
        try {
            await save("events", { end: info.event.end?.toISOString() }, record);
        }
        catch (e) {
            info.revert();
            throw e;
        }
    });
}}></FullCalendar>
              {#if view === "month"}<section class={`personal-mobile-day-detail ${calendarStyles.daySummary}`}>
                  <button type="button" aria-haspopup="dialog" on:click={() => openMobileDay(mobileDay)}>
                    <span>
                      <strong class={calendarStyles.summaryTitle}>
                        {calendarDayLabel(mobileDay)}
                      </strong>
                      <span>
                        {selectedDayCount} {selectedDayCount === 1 ? "Termin" : "Termine"} ·
                        Tagesdetails anzeigen
                      </span>
                    </span>
                    <ChevronRight size={18} aria-hidden="true"></ChevronRight>
                  </button>
                </section>{/if}
              {#if mobile && view === "month" && mobileDaySheetOpen && !detail && !editor}<MobileDaySheet events={expanded} day={mobileDay} members={workspace.members} productions={workspace.records.productions} contextLabel={showAll
    ? "Gesamtes Team"
    : `${visiblePeople.length} ${visiblePeople.length === 1 ? "Kalender" : "Kalender ausgewählt"}`} minDay={localDate(instantDate(range.start))} maxDay={shiftDate(localDate(instantDate(range.end)), -1)} createOptions={[
    {
        id: "selected-calendars",
        label: "Termin an diesem Tag",
        participantIds: admin ? visiblePeople : [workspace.user.id],
    },
]} canEdit={(record) => canManageRecord(workspace.user, "events", record)} onSelect={setMobileDay} onClose={() => setMobileDaySheetOpen(false)} onRestoreFocus={() => calendarRoot.current
    ?.querySelector<HTMLButtonElement>(`[data-calendar-day="${mobileDay}"]`)
    ?.focus({ preventScroll: true })} onOpen={setDetail} onEdit={(record) => setEditor({ kind: "events", record })} onCreate={(defaults) => setEditor({ kind: "events", defaults })}></MobileDaySheet>{/if}
            {/if}
        </section>
      </div>
      <section class="panel margin-top">
        <header class="panel-heading">
          <h2>{admin ? "Freiwünsche im Team" : "Meine Freiwünsche"}</h2>
          {#if workspace.user.role !== "superadmin"}<Button onClick={() => setEditor({ kind: "leave" })}>Antrag stellen</Button>{/if}
        </header>
        {#if leaves.length}<div class="list">
            {#each leaves as leave (leave.id)}<div class="list-row">
                <div>
                  <strong>
                    {workspace.members.find((x) => x.id === leave.data.userId)?.name ||
    "Teammitglied"}
                  </strong>
                  <p class="small muted">
                    {dateLabel(value(leave.data, "start"))} – {dateLabel(value(leave.data, "end"))}{" "}
                    · {value(leave.data, "reason")}
                  </p>
                </div>
                <Badge tone={leave.data.status === "approved"
    ? "green"
    : leave.data.status === "rejected"
        ? "coral"
        : "neutral"}>
                  {statusLabels[value(leave.data, "status")]}
                </Badge>
                {#if leave.data.status === "pending"}{#if admin}
                      <label class="leave-category-picker">
                        Als Kalenderart
                        <select value={leaveCategories[leave.id] ?? defaultLeaveCategory} on:change={(event) => setLeaveCategories({
    ...leaveCategories,
    [leave.id]: event.currentTarget.value,
})}>
                          <option value="">Ganztägige Art wählen</option>
                          {#each absenceCategories as option (option.key)}<option value={option.key}>
                              {option.name}
                            </option>{/each}
                        </select>
                      </label>
                      <Button disabled={busy || !(leaveCategories[leave.id] ?? defaultLeaveCategory)} onClick={() => void run(() => action("leave-decide", leave.id, {
    status: "approved",
    category: leaveCategories[leave.id] ?? defaultLeaveCategory,
}))}>
                        Genehmigen
                      </Button>
                      <Button disabled={busy} onClick={() => void run(() => action("leave-decide", leave.id, { status: "rejected" }))}>
                        Ablehnen
                      </Button>
                    {:else}<Button disabled={busy} onClick={() => void run(() => save("leave", { status: "withdrawn" }, leave))}>
                      Zurückziehen
                    </Button>{/if}{/if}
              </div>{/each}
          </div>{:else}<p class="empty-inline">
            Noch keine Freiwünsche. Dein nächster freier Tag lässt sich hier anfragen.
          </p>{/if}
      </section>
      {#if categoriesOpen}<CalendarCategoriesDialog onClose={() => setCategoriesOpen(false)}></CalendarCategoriesDialog>{/if}
      {#if editor}<ResourceEditor kind={editor.kind} record={editor.record} lockedProductionId={editor.kind === "events" && productionId ? productionId : undefined} defaults={{ productionId: project, ...editor.defaults }} onClose={() => setEditor(null)}></ResourceEditor>{/if}
      <ShiftSwapPanel></ShiftSwapPanel>
      {#if detail}<RecordDetail record={detail} onClose={() => setDetail(null)}></RecordDetail>{/if}
      {#if exporting}<ExportDialog kind="events" filters={{
    ...periodExportFilters(period),
    view: view === "team" && teamSpan === "month" ? "team-month" : view,
    from: view === "team" ? teamStart : exportDates.from,
    to: view === "team" ? teamDays[teamDays.length - 1] : exportDates.to,
    ...(project ? { productionId: project } : {}),
    ...(!showAll ? { userIds: visiblePeople.join(",") } : {}),
    ...(category ? { category } : {}),
}} onClose={() => setExporting(false)}></ExportDialog>{/if}
    </div>

{/if}
