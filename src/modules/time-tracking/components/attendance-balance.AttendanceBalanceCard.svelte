<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel, localDate, weekStart } = useTheaterTime();
  import { initialState } from "@/shared/svelte-runtime";

  import { ArrowRight, Scale } from "@lucide/svelte";
  import { useWorkspace } from "@/components/workspace-context";
  import { Button } from "@/components/ui";
  import { hours, shiftDate } from "@/shared/client-api";
  import { calculateAttendanceBalance, signedHours, balanceMonthRange } from "../balance";
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
  let range =
    period === "week"
      ? { from: week, to: shiftDate(week, 6) }
      : period === "month"
        ? balanceMonthRange(validMonth ? month : today.slice(0, 7))
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
          timezone: workspace.timezone,
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
  let status = balance?.inProgress
    ? "Vorläufiger Saldo"
    : seconds > 0
      ? "Plusstunden"
      : seconds < 0
        ? "Minusstunden"
        : "Ausgeglichen";
  let tone = balance?.inProgress
    ? ""
    : seconds > 0
      ? styles.positive
      : seconds < 0
        ? styles.negative
        : "";
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
  $: range =
    period === "week"
      ? { from: week, to: shiftDate(week, 6) }
      : period === "month"
        ? balanceMonthRange(validMonth ? month : today.slice(0, 7))
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
          timezone: workspace.timezone,
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
  $: status = balance?.inProgress
    ? "Vorläufiger Saldo"
    : seconds > 0
      ? "Plusstunden"
      : seconds < 0
        ? "Minusstunden"
        : "Ausgeglichen";
  $: tone = balance?.inProgress
    ? ""
    : seconds > 0
      ? styles.positive
      : seconds < 0
        ? styles.negative
        : "";
  $: currentWeekBalance =
    settings && configured
      ? calculateAttendanceBalance({
          userId: selected,
          settings,
          timezone: workspace.timezone,
          attendance: workspace.records.attendance,
          events: workspace.records.events,
          calendarCategories: workspace.records.calendarCategories,
          leave: workspace.records.leave,
          from: weekStart(),
          to: shiftDate(weekStart(), 6),
          includeOpeningBalance: false,
        })
      : undefined;
  $: currentFulfilled = currentWeekBalance
    ? currentWeekBalance.attendanceSeconds + currentWeekBalance.creditSeconds
    : 0;
  $: currentRemaining = currentWeekBalance
    ? Math.max(0, currentWeekBalance.targetSeconds - currentFulfilled)
    : 0;
</script>

{#if true}
  {#snippet render_breakdown()}{#if balance}<dl class={styles.breakdown}>
        <div>
          <dt>Anwesenheit</dt>
          <dd>{hours(balance.attendanceSeconds)} h</dd>
        </div>
        <div>
          <dt>Tagesgutschriften</dt>
          <dd>{hours(balance.creditSeconds)} h</dd>
        </div>
        <div>
          <dt>Sollstunden</dt>
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
              ? period === "total"
                ? "Noch keine abgeschlossene Woche"
                : "Noch keine auswertbare Woche"
              : `${dateLabel(balance.from)} – ${dateLabel(balance.to)}`}
          </p>
          {#if compact}<details class={styles.details}>
              <summary>Berechnung anzeigen</summary>
              {@render render_breakdown()}
              <p>
                Abgeschlossene Wochen aus Anwesenheit plus Tagesgutschriften minus Wochensoll, dazu
                der Startsaldo.
              </p>
            </details>{:else}
            {@render render_breakdown()}
            <p class={`small muted ${styles.creditDescription}`}>
              {period === "total"
                ? "Gesamt enthält abgeschlossene Wochen und den Startsaldo."
                : balance.inProgress
                  ? "Die laufende Woche ist noch offen; dieser Saldo ist vorläufig."
                  : "Abgeschlossene Kalenderwochen von Montag bis Sonntag."}
              {period === "month"
                ? " Zum Monat gehören die Wochen, deren Montag in diesem Monat liegt."
                : ""}
            </p>
          {/if}
          {#if balance.transitionWeekCount > 0}<p class="small muted">
              Übergangswoche: Beginn oder Änderungen werden anteilig berücksichtigt.
            </p>{/if}
          {#if (period === "total" || balance.inProgress) && currentWeekBalance}
            <div class={styles.currentWeek} aria-label="Laufende Woche">
              <strong>Laufende Woche</strong>
              <div class={styles.currentWeekValues}>
                <span>Erfüllt <strong>{hours(currentFulfilled)} h</strong></span>
                <span>Noch offen <strong>{hours(currentRemaining)} h</strong></span>
              </div>
              <p class="small muted">
                Soll dieser Woche: {hours(currentWeekBalance.targetSeconds)} h · Frei einteilbar von Montag
                bis Sonntag.
              </p>
              {#if currentWeekBalance.transitionWeekCount > 0}<p class="small muted">
                  Übergangswoche mit anteiligem Soll.
                </p>{/if}
            </div>
          {/if}
          {#if !compact}<details class={styles.details}>
              <summary>So wird gerechnet</summary>
              <p class={styles.creditDescription}>
                Anwesenheit nach Pausen plus Tagesgutschriften minus Wochensoll. Urlaub, Feiertag,
                Feiertagsausgleich sowie neutrale Abwesenheiten mit ausdrücklich gesetzter
                Tagesgutschrift zählen bei persönlichen ganztägigen Einträgen mit den damaligen
                Wochenstunden ÷ 6 zusätzlich zur Anwesenheit; pro Datum einmal. Medizinische Gründe
                werden hier nicht erfasst.
              </p>
              <p class={styles.creditDescription}>
                Heute gespeicherte Anwesenheit zählt vollständig, auch bei späterer Endzeit.
                Zukünftige Tage und laufende Timer zählen noch nicht. Übergangswochen werden nach
                sieben Kalendertagen anteilig berechnet. Produktionsstunden bleiben separat; eine
                wöchentliche Freigabe ist nicht erforderlich.
              </p>
            </details>{/if}
        {/if}{/if}
    {/if}
  </section>
{/if}
