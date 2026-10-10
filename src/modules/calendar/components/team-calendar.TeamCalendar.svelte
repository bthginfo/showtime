<script lang="ts">
import { ChevronRight, Plus } from "@lucide/svelte";
import type { DomainRecord, Member, RecordData } from "@/shared/contracts";
import { ids, instantDate, localDate, value } from "@/shared/client-api";
import { calendarTeamLanes } from "@/shared/calendar-team";
import { bavarianHoliday } from "@/shared/bavarian-holidays";
import type { CalendarBackground } from "@/shared/calendar-categories";
import { Empty } from "@/components/ui";
import { calendarDayIndex } from "./day-details";
import { MobileDaySheet } from "./mobile-day-sheet";
import { TeamCalendarScroll } from "./team-calendar-scroll";
import { HolidayLabel } from "./holiday-label";
import styles from "./mobile-calendar.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { type CalendarInstance, clock, fullDay, shortName } from "./team-calendar";
const effects=createEffects();
type ViewProps = {
    events: CalendarInstance[];
    members: Member[];
    people: string[];
    days: string[];
    month: boolean;
    mobile: boolean;
    canPlan: (person: string) => boolean;
    canEdit: (record: DomainRecord) => boolean;
    suspended: boolean;
    productions: DomainRecord[];
    onOpen: (record: DomainRecord) => void;
    onEdit: (record: DomainRecord) => void;
    onCreate: (data: RecordData) => void;
};
export let events: ViewProps["events"] = undefined as any;
export let members: ViewProps["members"] = undefined as any;
export let people: ViewProps["people"] = undefined as any;
export let days: ViewProps["days"] = undefined as any;
export let month: ViewProps["month"] = undefined as any;
export let mobile: ViewProps["mobile"] = undefined as any;
export let canPlan: ViewProps["canPlan"] = undefined as any;
export let canEdit: ViewProps["canEdit"] = undefined as any;
export let suspended: ViewProps["suspended"] = undefined as any;
export let productions: ViewProps["productions"] = undefined as any;
export let onOpen: ViewProps["onOpen"] = undefined as any;
export let onEdit: ViewProps["onEdit"] = undefined as any;
export let onCreate: ViewProps["onCreate"] = undefined as any;
let selectedDay = days.includes(localDate()) ? localDate() : days[0];
const setSelectedDay = (next: typeof selectedDay | ((current: typeof selectedDay) => typeof selectedDay)) => { selectedDay = typeof next === "function" ? (next as (current: typeof selectedDay) => typeof selectedDay)(selectedDay) : next; };
let daySheetOpen: boolean = false;
const setDaySheetOpen = (next: typeof daySheetOpen | ((current: typeof daySheetOpen) => typeof daySheetOpen)) => { daySheetOpen = typeof next === "function" ? (next as (current: typeof daySheetOpen) => typeof daySheetOpen)(daySheetOpen) : next; };
let mobileCalendar = {current: null as HTMLDivElement | null};
let day = days.includes(selectedDay) ? selectedDay : days[0];
let team = (() => calendarTeamLanes(members, people))();
let entriesByDay = (() => calendarDayIndex(events, days[0], days[days.length - 1]))();
let matches = (person: string, date: string) => (entriesByDay.get(date) || []).filter((event) => person
    ? ids(event.extendedProps.record.data, "participantIds").includes(person)
    : !ids(event.extendedProps.record.data, "participantIds").length);
let selected = team.flatMap((person) => matches(person.id, day).map((event) => ({ person, event })));
let selectedCount = entriesByDay.get(day)?.length || 0;

$: day = days.includes(selectedDay) ? selectedDay : days[0];
$: team = (() => calendarTeamLanes(members, people))();
$: entriesByDay = (() => calendarDayIndex(events, days[0], days[days.length - 1]))();

$: selected = team.flatMap((person) => matches(person.id, day).map((event) => ({ person, event })));
$: selectedCount = entriesByDay.get(day)?.length || 0;

</script>


      <div bind:this={mobileCalendar.current} class={styles.teamMatrix}>
        <TeamCalendarScroll month={month}>
          <table>
            <colgroup>
              <col style={styleString({ width: mobile ? 78 : 140 })} />
              {#each days as date (date)}<col />{/each}
            </colgroup>
            <thead>
              <tr>
                <th>Team</th>
                {#each days as date (date)}<th>
                    <button class={`team-day-heading ${day === date ? "selected" : ""}`} data-date={date} aria-label={`${fullDay(date)}${bavarianHoliday(date) ? ` · ${bavarianHoliday(date)}` : ""} · Tagesdetails anzeigen`} aria-haspopup={mobile ? "dialog" : undefined} on:click={() => {
    setSelectedDay(date);
    if (mobile)
        setDaySheetOpen(true);
}}>
                      {new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "short",
    day: "numeric",
    ...(!month ? { month: "numeric" as const } : {}),
}).format(new Date(`${date}T12:00:00Z`))}
                      <HolidayLabel date={date} compact={mobile || month}></HolidayLabel>
                    </button>
                  </th>{/each}
              </tr>
            </thead>
            <tbody>
              {#each team as person (person.id)}<tr>
                  <th scope="row" aria-label={person.name}>
                    <span class={styles.desktopName}>{person.name}</span>
                    <span class={styles.mobileName} title={person.name}>
                      {shortName(person.name, team.map((member) => member.name))}
                    </span>
                  </th>
                  {#each days as date (date)}<td class={day === date ? "selected-day" : ""}>
                      {#each matches(person.id, date) as event (event.id)}<button class={`team-event calendar-colored-event${event.background ? ` ${styles.quietEvent}` : ""}`} style={styleString({
    borderLeftColor: event.borderColor,
    backgroundColor: event.backgroundColor,
    color: event.textColor,
})} aria-label={`${event.title} · ${event.categoryName} · ${event.allDay ? "ganztägig" : `${clock(event.start)} bis ${clock(event.end)}`} · ${person.name}`} on:click={() => {
    setSelectedDay(date);
    onOpen(event.extendedProps.record);
}}>
                          <strong>{event.title}</strong>
                          <span>
                            {event.allDay
    ? "Ganztägig"
    : `${clock(event.start)}–${clock(event.end)}`}
                            {event.background && !mobile
    ? event.background === "service"
        ? " · Arbeitszeit"
        : " · Hinweis"
    : ""}
                          </span>
                        </button>{/each}
                      {#if canPlan(person.id)}<button class="team-add" aria-label={`Termin für ${person.name} am ${date}`} on:click={() => onCreate({
    start: `${date}T09:00`,
    end: `${date}T17:00`,
    participantIds: person.id ? [person.id] : [],
})}>
                          <Plus size={13}></Plus>
                        </button>{/if}
                    </td>{/each}
                </tr>{/each}
            </tbody>
          </table>
        </TeamCalendarScroll>
      </div>
      <section class={styles.daySummary}>
        <button type="button" aria-haspopup="dialog" on:click={() => setDaySheetOpen(true)}>
          <span>
            <strong class={styles.summaryTitle}>{fullDay(day)}</strong>
            <HolidayLabel date={day}></HolidayLabel>
            <span>
              {selectedCount} {selectedCount === 1 ? "Termin" : "Termine"} · Tagesdetails anzeigen
            </span>
          </span>
          <ChevronRight size={18} aria-hidden="true"></ChevronRight>
        </button>
      </section>
      {#if mobile && daySheetOpen && !suspended}<MobileDaySheet events={events} day={day} members={members} productions={productions} contextLabel={`${team.filter((person) => person.id).length} Teamkalender`} minDay={days[0]} maxDay={days[days.length - 1]} createOptions={team
    .filter((person) => canPlan(person.id))
    .map((person) => ({
    id: person.id,
    label: `Termin für ${person.name}`,
    personName: person.name,
    participantIds: person.id ? [person.id] : [],
}))} canEdit={canEdit} onSelect={setSelectedDay} onClose={() => setDaySheetOpen(false)} onRestoreFocus={() => mobileCalendar.current
    ?.querySelector<HTMLButtonElement>(`[data-date="${day}"]`)
    ?.focus({ preventScroll: true })} onOpen={onOpen} onEdit={onEdit} onCreate={onCreate}></MobileDaySheet>{/if}
      <section class={`team-day-detail ${styles.desktopDayDetail}`}>
        <header>
          <div>
            <p class="eyebrow">AUSGEWÄHLTE DIENSTE</p>
            <h3>{fullDay(day)}</h3>
            <HolidayLabel date={day}></HolidayLabel>
          </div>
          <label>
            Tag auswählen
            <input type="date" min={days[0]} max={days[days.length - 1]} value={day} on:input={(event) => setSelectedDay(event.currentTarget.value)} />
          </label>
        </header>
        {#if selected.length}<div class="team-day-services team-desktop-services">
            {#each selected as { person, event } (`${person.id}:${event.id}`)}<button class="calendar-colored-event" style={styleString({
    borderLeftColor: event.borderColor,
    backgroundColor: event.backgroundColor,
    color: event.textColor,
})} on:click={() => onOpen(event.extendedProps.record)}>
                <span class="small muted">
                  {person.name} · {event.categoryName}
                </span>
                <strong>{event.title}</strong>
                <span>
                  {event.allDay ? "Ganztägig" : `${clock(event.start)}–${clock(event.end)}`}
                </span>
                <span class="small muted">
                  {value(event.extendedProps.record.data, "location") || "Ort noch offen"} ·{" "}
                  {value(productions.find((production) => production.id === event.extendedProps.record.data.productionId)?.data || {}, "title") || "Ohne Produktion"}
                </span>
              </button>{/each}
          </div>{:else}<div class="team-desktop-services">
            <Empty title="Keine Dienste an diesem Tag." description="Wähle einen anderen Tag oder blende weitere Teammitglieder ein."></Empty>
          </div>{/if}
      </section>
