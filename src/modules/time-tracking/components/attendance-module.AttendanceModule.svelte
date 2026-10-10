<script lang="ts">
import {memberCan} from "@/shared/access-policy";import { initialState } from '@/shared/svelte-runtime';

import { useViewState } from "@/shared/view-state";
import { DoorOpen, Plus, UploadCloud } from "@lucide/svelte";
import { PeriodPicker, periodExportFilters, weekForPeriod } from "@/components/period-picker";
import { seasonForDate, type PeriodFilter } from "@/shared/period-filter";
import type { DomainRecord, RecordData } from "@/shared/contracts";
import { hours, localDate, post, shiftDate, value, weekStart } from "@/shared/client-api";
import { isStaff } from "@/shared/client-members";
import { useStoredValue } from "@/shared/client-storage";
import { useWorkspace } from "@/components/workspace-context";
import { ActionMenu, Badge, Button, ErrorMessage, ExportButton, PageHeader } from "@/components/ui";
import { ExportDialog } from "@/components/export-dialog";
import { RecordDetail } from "@/components/resource-view";
import { TimeBookingEditor } from "./time-booking-editor";
import { groupBookingWeeks, isoWeek, periodForWeek } from "../history";
import { timeDayMarkers } from "../day-markers";
import { BookingList, WeekNavigator, WeeklyHistory } from "./weekly-bookings";
import { CalendarTimeProposals } from "./calendar-time-proposals";
import { WeekDayOverview } from "./week-day-overview";
import { AttendanceBalanceCard } from "./attendance-balance";
import styles from "./time-history.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { type AttendanceDraft } from "./attendance-module";
const effects=createEffects();
type ViewProps = {
    embedded?: boolean;
};
export let embedded: NonNullable<ViewProps["embedded"]> = false;
const workspaceStore=useWorkspace();
let { workspace, refresh, online, busy } = $workspaceStore;
$: ({ workspace, refresh, online, busy } = $workspaceStore);
let selfBooking = workspace.user.role !== "superadmin";
let admin = memberCan(workspace.user, 'time.team.read');
const periodStore = useViewState<PeriodFilter>(workspace.user.id, "attendance", "period", () => ({
    season: seasonForDate(workspace.records.productions),
}));
let period: PeriodFilter = $periodStore; $: period = $periodStore;
const setPeriod = periodStore.set;
const weekStore = useViewState<any>(workspace.user.id, "attendance", "week", weekStart());
let week: any = $weekStore; $: week = $weekStore;
const setWeek = weekStore.set;
const personStore = useViewState<any>(workspace.user.id, "attendance", "person", selfBooking ? workspace.user.id : workspace.members.find(isStaff)?.id || "");
let person: any = $personStore; $: person = $personStore;
const setPerson = personStore.set;
let creating: string = "";
const setCreating = (next: typeof creating | ((current: typeof creating) => typeof creating)) => { creating = typeof next === "function" ? (next as (current: typeof creating) => typeof creating)(creating) : next; };
let editing: DomainRecord | null = initialState<DomainRecord | null>(null);
const setEditing = (next: DomainRecord | null | ((current: DomainRecord | null) => DomainRecord | null)) => { editing = typeof next === "function" ? (next as (current: DomainRecord | null) => DomainRecord | null)(editing) : next; };
let offline: boolean = false;
const setOffline = (next: typeof offline | ((current: typeof offline) => typeof offline)) => { offline = typeof next === "function" ? (next as (current: typeof offline) => typeof offline)(offline) : next; };
let detail: DomainRecord | null = initialState<DomainRecord | null>(null);
const setDetail = (next: DomainRecord | null | ((current: DomainRecord | null) => DomainRecord | null)) => { detail = typeof next === "function" ? (next as (current: DomainRecord | null) => DomainRecord | null)(detail) : next; };
let exporting: boolean = false;
const setExporting = (next: typeof exporting | ((current: typeof exporting) => typeof exporting)) => { exporting = typeof next === "function" ? (next as (current: typeof exporting) => typeof exporting)(exporting) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let syncing: boolean = false;
const setSyncing = (next: typeof syncing | ((current: typeof syncing) => typeof syncing)) => { syncing = typeof next === "function" ? (next as (current: typeof syncing) => typeof syncing)(syncing) : next; };
const draftJsonStore = useStoredValue<any>(`digitalmask-attendance-drafts:${workspace.user.id}`, "[]");
let draftJson: any = $draftJsonStore; $: draftJson = $draftJsonStore;
const setDraftJson = draftJsonStore.set;
let drafts = (() => {
    try {
        const parsed = JSON.parse(draftJson);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
})();
let until = shiftDate(week, 6);
let markers = (() => {
    const first = workspace.records.events
        .map((event) => value(event.data, "start").slice(0, 10))
        .filter(Boolean)
        .sort()[0] || week;
    return timeDayMarkers({
        events: workspace.records.events,
        calendarCategories: workspace.records.calendarCategories,
        userId: person,
        from: first,
        to: until > shiftDate(weekStart(), 6) ? until : shiftDate(weekStart(), 6),
        period,
    });
})();
let weeks = (() => groupBookingWeeks(workspace.records.attendance || [], { userId: person, period, markers }))();
let selected = weeks.find((row) => row.start === week);
let entries = selected?.entries || [];
let total = selected?.seconds || 0;
let selectWeek = (next: string) => {
    setWeek(next);
    setPeriod(periodForWeek(period, next, workspace.records.productions));
};
let canBookDay = selfBooking && person === workspace.user.id;
let openBooking = (date = localDate()) => {
    setCreating(date);
};
const secondaryActions = true;
let sync = async () => {
    setSyncing(true);
    setError("");
    try {
        let remaining = [...drafts];
        for (const draft of drafts) {
            await post("/api/records/attendance", {
                data: { ...draft.data, idempotencyKey: draft.id },
            });
            remaining = remaining.filter((row) => row.id !== draft.id);
            setDraftJson(JSON.stringify(remaining));
        }
        await refresh();
    }
    catch (exception) {
        setError(exception instanceof Error ? exception.message : "Synchronisierung fehlgeschlagen");
    }
    finally {
        setSyncing(false);
    }
};

$: selfBooking = workspace.user.role !== "superadmin";
$: admin = memberCan(workspace.user, 'time.team.read');
$: drafts = (() => {
    try {
        const parsed = JSON.parse(draftJson);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
})();
$: until = shiftDate(week, 6);
$: markers = (() => {
    const first = workspace.records.events
        .map((event) => value(event.data, "start").slice(0, 10))
        .filter(Boolean)
        .sort()[0] || week;
    return timeDayMarkers({
        events: workspace.records.events,
        calendarCategories: workspace.records.calendarCategories,
        userId: person,
        from: first,
        to: until > shiftDate(weekStart(), 6) ? until : shiftDate(weekStart(), 6),
        period,
    });
})();
$: weeks = (() => groupBookingWeeks(workspace.records.attendance || [], { userId: person, period, markers }))();
$: selected = weeks.find((row) => row.start === week);
$: entries = selected?.entries || [];
$: total = selected?.seconds || 0;

$: canBookDay = selfBooking && person === workspace.user.id;



$: effects.run(90,()=>{void $workspaceStore.loadWindow('attendance',week,shiftDate(week,6)).catch(e=>$workspaceStore.notify(e.message));},[week]);
</script>
{#if true}
{#snippet render_secondaryActions()}
      <ExportButton onClick={() => setExporting(true)}></ExportButton>
      {#if selfBooking && !online}<Button onClick={() => setOffline(true)}>Ohne Internet vormerken</Button>{/if}
    {/snippet}

      {#if embedded}<header class={styles.moduleHeading}>
          <h2>Anwesenheit im Theater</h2>
          <div class={styles.moduleActions}>
            <ActionMenu>{@render render_secondaryActions()}</ActionMenu>
            {#if selfBooking}<Button variant="primary" onClick={() => openBooking()}>
                <Plus size={16}></Plus> Nachtragen
              </Button>{/if}
          </div>
        </header>{:else}<PageHeader eyebrow="DEIN NACHWEIS IM THEATER" title="Anwesenheit im Theater"  compact><svelte:fragment slot="secondaryActions">{@render render_secondaryActions()}</svelte:fragment>
          {#if selfBooking}
              <Button variant="primary" onClick={() => openBooking()}>
                <Plus size={16}></Plus>
                Anwesenheit nachtragen
              </Button>
            {/if}
        </PageHeader>{/if}
      <PeriodPicker compact records={workspace.records.attendance || []} productions={workspace.records.productions} value={period} onChange={(next) => {
    setPeriod(next);
    setWeek(weekForPeriod(workspace.records.attendance || [], person, next, week));
}}></PeriodPicker>
      <div class={styles.weekToolbar}>
        <WeekNavigator week={week} onChange={selectWeek}></WeekNavigator>
        {#if admin}<label class="inline-label">
            Person
            <select value={person} on:change={(event) => setPerson(event.currentTarget.value)}>
              {#each workspace.members.filter(isStaff) as member (member.id)}<option value={member.id}>
                  {member.name}
                  {member.status !== "active" ? " · ehemaliges Teammitglied" : ""}
                </option>{/each}
            </select>
          </label>{/if}
        <Badge>
          <DoorOpen size={13}></DoorOpen>
          {hours(total)} h in dieser Woche
        </Badge>
      </div>
      {#if selfBooking && drafts.length > 0}<div class="offline-banner">
          <div>
            <strong>{drafts.length} lokale Anwesenheitsentwürfe</strong>
            <p class="small">
              Diese Entwürfe werden ausschließlich als Anwesenheit gespeichert.
            </p>
          </div>
          <Button disabled={!online || syncing || busy} onClick={() => void sync()}>
            <UploadCloud size={16}></UploadCloud>
            {syncing ? "Synchronisiert …" : "Anwesenheit synchronisieren"}
          </Button>
          <Button variant="ghost" onClick={() => {
    if (confirm("Lokale Anwesenheitsentwürfe verwerfen?"))
        setDraftJson("[]");
}}>
            Verwerfen
          </Button>
        </div>{/if}
      <ErrorMessage message={error}></ErrorMessage>
      {#key person}<AttendanceBalanceCard person={person} selectedWeek={week} onWeekChange={selectWeek}></AttendanceBalanceCard>{/key}
      {#if entries.length}<section class={styles.currentWeek} aria-label="Anwesenheit der ausgewählten Woche">
          <header class={styles.currentHeading}>
            <h3>
              KW {isoWeek(week).number} · {isoWeek(week).year}
            </h3>
            <strong>{hours(total)} h</strong>
          </header>
          <BookingList entries={entries} kind="attendance" onEdit={setEditing} onDetail={setDetail}></BookingList>
        </section>{:else}<section class={styles.emptyWeek}>
          <h3>Noch keine Anwesenheit in dieser Woche.</h3>
          <p>
            Frühere Buchungen findest du im Wochenverlauf. Kalenderkennzeichen sind keine gebuchten
            Stunden.
          </p>
          {#if selfBooking}<Button onClick={() => openBooking()}>Anwesenheit nachtragen</Button>{/if}
        </section>{/if}
      <WeekDayOverview week={week} person={person} entries={entries} markers={selected?.markers || []} onDetail={setDetail} bookingLabel="Anwesenheit" onBookDay={canBookDay ? openBooking : undefined}></WeekDayOverview>
      {#key `${person}:${period.year || ""}:${period.season || ""}`}<WeeklyHistory weeks={weeks} selectedWeek={week} person={person} kind="attendance" filtered={!!period.year || !!period.season} onAllSeasons={() => setPeriod({})} onSelectWeek={selectWeek} onEdit={setEditing} onDetail={setDetail} onBookDay={canBookDay ? openBooking : undefined}></WeeklyHistory>{/key}
      <CalendarTimeProposals kind="attendance" person={person} week={week} period={period}></CalendarTimeProposals>
      {#if creating}<TimeBookingEditor kind="attendance" defaults={{ date: creating }} onSaved={(record) => {
    setPerson(workspace.user.id);
    selectWeek(isoWeek(value(record.data, "date")).start);
}} onClose={() => setCreating("")}></TimeBookingEditor>{/if}
      {#if editing}{@const activeEditing=editing}<TimeBookingEditor kind="attendance" record={workspace.records.attendance.find((row) => row.id === activeEditing.id) || activeEditing} onClose={() => setEditing(null)}></TimeBookingEditor>{/if}
      {#if offline}<TimeBookingEditor kind="attendance" onClose={() => setOffline(false)} onDraft={(data) => setDraftJson(JSON.stringify([
    ...drafts,
    { id: crypto.randomUUID(), createdAt: new Date().toISOString(), data },
]))}></TimeBookingEditor>{/if}
      {#if detail}<RecordDetail record={detail} onClose={() => setDetail(null)}></RecordDetail>{/if}
      {#if exporting}<ExportDialog kind="attendance" filters={{ ...periodExportFilters(period), userId: person, from: week, to: until }} onClose={() => setExporting(false)}></ExportDialog>{/if}


{/if}
