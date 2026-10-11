<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel, localDate, weekStart } = useTheaterTime();
  import { initialState } from "@/shared/svelte-runtime";

  import { ArrowRight, Scale } from "@lucide/svelte";
  import { useWorkspace } from "@/components/workspace-context";
  import { Button } from "@/components/ui";
  import { hours, shiftDate } from "@/shared/client-api";
  import { calculateAttendanceBalance, signedHours } from "../balance";
  import { isoWeek } from "../history";
  import styles from "./attendance-balance.module.css";
  import {
    createEffects,
    createId,
    externalStore,
    styleString,
    applyRef,
  } from "@/shared/svelte-runtime";
  import type {
    ReactNode,
    CSSProperties,
    Dispatch,
    SetStateAction,
    FormEvent,
    ChangeEvent,
    KeyboardEvent,
    MouseEvent,
    DragEvent,
    ComponentProps,
    RefObject,
  } from "@/shared/ui-types";
  import { type BalancePeriod } from "./attendance-balance";
  const effects = createEffects();
  type ViewProps = {
    person?: string;
    compact?: boolean;
    onOpenSettings?: () => void;
    selectedWeek?: string;
    onWeekChange?: (week: string) => void;
  };
  export let person: ViewProps["person"] = undefined as any;
  export let compact: NonNullable<ViewProps["compact"]> = false;
  export let onOpenSettings: ViewProps["onOpenSettings"] = undefined as any;
  export let selectedWeek: ViewProps["selectedWeek"] = undefined as any;
  export let onWeekChange: ViewProps["onWeekChange"] = undefined as any;
  const workspaceStore = useWorkspace();
  let { workspace } = $workspaceStore;
  $: ({ workspace } = $workspaceStore);
  let selected = person || workspace.user.id;
  let member =
    selected === workspace.user.id
      ? workspace.user
      : workspace.members.find((row) => row.id === selected);
  let settings = member?.preferences?.workingTime;
  let configured = Boolean(settings?.schedules.length);
  let period: BalancePeriod = initialState<BalancePeriod>("total");
  const setPeriod = (next: BalancePeriod | ((current: BalancePeriod) => BalancePeriod)) => {
    period =
      typeof next === "function"
        ? (next as (current: BalancePeriod) => BalancePeriod)(period)
        : next;
  };
  let ownWeek = weekStart();
  const setOwnWeek = (next: typeof ownWeek | ((current: typeof ownWeek) => typeof ownWeek)) => {
    ownWeek =
      typeof next === "function"
        ? (next as (current: typeof ownWeek) => typeof ownWeek)(ownWeek)
        : next;
  };
  let week = selectedWeek || ownWeek;
  let month = localDate().slice(0, 7);
  const setMonth = (next: typeof month | ((current: typeof month) => typeof month)) => {
    month =
      typeof next === "function" ? (next as (current: typeof month) => typeof month)(month) : next;
  };
  let from = `${localDate().slice(0, 7)}-01`;
  const setFrom = (next: typeof from | ((current: typeof from) => typeof from)) => {
    from =
      typeof next === "function" ? (next as (current: typeof from) => typeof from)(from) : next;
  };
  let to = localDate();
  const setTo = (next: typeof to | ((current: typeof to) => typeof to)) => {
    to = typeof next === "function" ? (next as (current: typeof to) => typeof to)(to) : next;
  };
  let today = localDate();
  let validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  let monthEnd = validMonth
    ? new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0))
        .toISOString()
        .slice(0, 10)
    : today;
  let range =
    period === "week"
      ? { from: week, to: shiftDate(week, 6) }
      : period === "month"
        ? { from: `${validMonth ? month : today.slice(0, 7)}-01`, to: monthEnd }
        : period === "custom"
          ? { from, to }
          : {};
  let invalidRange =
    period === "custom" &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to);
  let balance =
    settings && configured && !invalidRange
      ? calculateAttendanceBalance({
          userId: selected,
          settings,
          attendance: workspace.records.attendance,
          events: workspace.records.events,
          calendarCategories: workspace.records.calendarCategories,
          leave: workspace.records.leave,
          ...range,
          includeOpeningBalance: period === "total",
        })
      : undefined;
  let seconds = balance?.balanceSeconds || 0;
  let status = seconds > 0 ? "Plusstunden" : seconds < 0 ? "Minusstunden" : "Ausgeglichen";
  let tone = seconds > 0 ? styles.positive : seconds < 0 ? styles.negative : "";
  const breakdown = true;

  $: selected = person || workspace.user.id;
  $: member =
    selected === workspace.user.id
      ? workspace.user
      : workspace.members.find((row) => row.id === selected);
  $: settings = member?.preferences?.workingTime;
  $: configured = Boolean(settings?.schedules.length);
  $: week = selectedWeek || ownWeek;
  $: today = localDate();
  $: validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  $: monthEnd = validMonth
    ? new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0))
        .toISOString()
        .slice(0, 10)
    : today;
  $: range =
    period === "week"
      ? { from: week, to: shiftDate(week, 6) }
      : period === "month"
        ? { from: `${validMonth ? month : today.slice(0, 7)}-01`, to: monthEnd }
        : period === "custom"
          ? { from, to }
          : {};
  $: invalidRange =
    period === "custom" &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to);
  $: balance =
    settings && configured && !invalidRange
      ? calculateAttendanceBalance({
          userId: selected,
          settings,
          attendance: workspace.records.attendance,
          events: workspace.records.events,
          calendarCategories: workspace.records.calendarCategories,
          leave: workspace.records.leave,
          ...range,
          includeOpeningBalance: period === "total",
        })
      : undefined;
  $: seconds = balance?.balanceSeconds || 0;
  $: status = seconds > 0 ? "Plusstunden" : seconds < 0 ? "Minusstunden" : "Ausgeglichen";
  $: tone = seconds > 0 ? styles.positive : seconds < 0 ? styles.negative : "";
</script>

{#if true}
  {#snippet render_breakdown()}{#if balance}<dl class={styles.breakdown}>
        <div>
          <dt>Anwesenheit</dt>
          <dd>{hours(balance.attendanceSeconds)} h</dd>
        </div>
        <div>
          <dt>Urlaub / Krank</dt>
          <dd>{hours(balance.creditSeconds)} h</dd>
        </div>
        <div>
          <dt>Sollzeit</dt>
          <dd>{hours(balance.targetSeconds)} h</dd>
        </div>
        {#if period === "total"}<div>
            <dt>Startsaldo</dt>
            <dd>{signedHours(balance.openingBalanceSeconds)} h</dd>
          </div>{/if}
      </dl>{/if}{/snippet}
  <section
    class={`${styles.card} ${compact ? styles.compact : styles.panel}`}
    aria-label={`Zeitkonto von ${member?.name || "Teammitglied"}`}
  >
    <header class={styles.header}>
      <span class={styles.heading}>
        <Scale size={17}></Scale>
        Zeitkonto{!compact && member ? ` · ${member.name}` : ""}
      </span>
      {#if configured}<select
          aria-label="Zeitraum des Zeitkontos"
          value={period}
          on:change={(event) => setPeriod(event.currentTarget.value as BalancePeriod)}
        >
          <option value="total">Gesamt</option>
          <option value="week">Woche</option>
          <option value="month">Monat</option>
          <option value="custom">Zeitraum</option>
        </select>{/if}
    </header>
    {#if !configured}<div class={styles.unconfigured}>
        <strong>Wochenstunden fehlen</strong>
        <p>Lege Wochenstunden und Beginn fest, damit dein Plus / Minus berechnet wird.</p>
        {#if onOpenSettings}<Button onClick={onOpenSettings}>
            Wochenstunden festlegen <ArrowRight size={14}></ArrowRight>
          </Button>{:else}<a href="/?module=settings">
            In Einstellungen festlegen <ArrowRight size={14}></ArrowRight>
          </a>{/if}
      </div>{:else}
      {#if period === "week"}<label class={styles.datePicker}>
          Woche ab
          <input
            type="date"
            aria-label="Woche für Zeitkonto"
            value={week}
            on:input={(event) => {
              if (event.currentTarget.value) {
                const next = isoWeek(event.currentTarget.value).start;
                if (onWeekChange) onWeekChange(next);
                else setOwnWeek(next);
              }
            }}
          />
        </label>{/if}
      {#if period === "month"}<label class={styles.datePicker}>
          Monat
          <input
            type="month"
            aria-label="Monat für Zeitkonto"
            value={month}
            on:input={(event) => setMonth(event.currentTarget.value)}
          />
        </label>{/if}
      {#if period === "custom"}<div class={styles.dates}>
          <label>
            Von
            <input
              type="date"
              aria-label="Zeitkonto von"
              value={from}
              on:input={(event) => setFrom(event.currentTarget.value)}
            />
          </label>
          <label>
            Bis
            <input
              type="date"
              aria-label="Zeitkonto bis"
              value={to}
              on:input={(event) => setTo(event.currentTarget.value)}
            />
          </label>
        </div>{/if}
      {#if invalidRange}<p class="error-message">
          Bitte prüfe Beginn und Ende des Zeitraums.
        </p>{:else}{#if balance}
          <div class={`${styles.total} ${tone}`} aria-live="polite">
            <strong class={styles.value}>
              {signedHours(seconds)} <small>h</small>
            </strong>
            <span>
              {status}
              {period === "total" ? " gesamt" : " im Zeitraum"}
            </span>
          </div>
          <p class={styles.range}>
            {balance.from > balance.to
              ? `Beginnt am ${dateLabel(balance.from)}`
              : `${dateLabel(balance.from)} – ${dateLabel(balance.to)}`}
          </p>
          {#if compact}<details class={styles.details}>
              <summary>Berechnung anzeigen</summary>
              {@render render_breakdown()}
              <p>Nur gespeicherte Anwesenheit; Sollzeit zählt bis heute.</p>
            </details>{:else}
            {@render render_breakdown()}
            <p class="small muted">
              Sollzeiten zählen bis einschließlich heute. Urlaub und Krank füllen höchstens die noch
              fehlende Tages-Sollzeit auf; Anwesenheit wird dabei nicht doppelt gezählt.
            </p>
          {/if}
        {/if}{/if}
    {/if}
  </section>
{/if}
