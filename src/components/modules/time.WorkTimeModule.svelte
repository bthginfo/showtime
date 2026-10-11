<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel, localDate, weekStart } = useTheaterTime();
  import { memberCan } from "@/shared/access-policy";
  import { initialState } from "@/shared/svelte-runtime";

  import { useViewState } from "@/shared/view-state";
  import { Plus, UploadCloud } from "@lucide/svelte";
  import { PeriodPicker, periodExportFilters, weekForPeriod } from "@/components/period-picker";
  import { dateMatchesPeriod, initialPeriod, type PeriodFilter } from "@/shared/period-filter";
  import { categoriesFor } from "@/shared/domain-categories";
  import { CategoryManager } from "@/modules/categories/components/category-manager";
  import type { DomainRecord, RecordData } from "@/shared/contracts";
  import { hours, post, shiftDate, value } from "@/shared/client-api";
  import { useStoredValue } from "@/shared/client-storage";
  import { isStaff } from "@/shared/client-members";
  import { useWorkspace } from "../workspace-context";
  import { ActionMenu, Button, ErrorMessage, ExportButton, Modal, PageHeader } from "../ui";
  import { ResourceEditor } from "../resource-editor";
  import { RecordDetail } from "../resource-view";
  import { ExportDialog } from "../export-dialog";
  import { TimerPanel } from "@/modules/time-tracking/components/work-timer";
  import { TimeWorkspace } from "@/modules/time-tracking/components/time-workspace";
  import { groupBookingWeeks, isoWeek, periodForWeek } from "@/modules/time-tracking/history";
  import { timeDayMarkers } from "@/modules/time-tracking/day-markers";
  import {
    BookingList,
    WeekNavigator,
    WeeklyHistory,
  } from "@/modules/time-tracking/components/weekly-bookings";
  import { CalendarTimeProposals } from "@/modules/time-tracking/components/calendar-time-proposals";
  import { WeekDayOverview } from "@/modules/time-tracking/components/week-day-overview";
  import styles from "@/modules/time-tracking/components/time-history.module.css";
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
  import { type Draft, TimeModule } from "./time";
  const effects = createEffects();
  type ViewProps = {
    productionId?: string;
    embedded?: boolean;
  };
  export let productionId: NonNullable<ViewProps["productionId"]> = "";
  export let embedded: NonNullable<ViewProps["embedded"]> = false;
  const workspaceStore = useWorkspace();
  let { workspace, refresh, online } = $workspaceStore;
  $: ({ workspace, refresh, online } = $workspaceStore);
  let scope = `time:${productionId || "all"}`;
  const periodStore = useViewState<PeriodFilter>(workspace.user.id, scope, "period", () =>
    initialPeriod(workspace.records.productions, productionId),
  );
  let period: PeriodFilter = $periodStore;
  $: period = $periodStore;
  const setPeriod = periodStore.set;
  let categoriesOpen: boolean = false;
  const setCategoriesOpen = (
    next: typeof categoriesOpen | ((current: typeof categoriesOpen) => typeof categoriesOpen),
  ) => {
    categoriesOpen =
      typeof next === "function"
        ? (next as (current: typeof categoriesOpen) => typeof categoriesOpen)(categoriesOpen)
        : next;
  };
  let categoryOptions = categoriesFor("time", workspace.records.categories);
  const weekStore = useViewState<any>(workspace.user.id, scope, "week", weekStart());
  let week: any = $weekStore;
  $: week = $weekStore;
  const setWeek = weekStore.set;
  const personStore = useViewState<any>(
    workspace.user.id,
    scope,
    "person",
    workspace.user.role === "superadmin"
      ? workspace.members.find(isStaff)?.id || ""
      : workspace.user.id,
  );
  let person: any = $personStore;
  $: person = $personStore;
  const setPerson = personStore.set;
  const projectStore = useViewState<any>(workspace.user.id, scope, "project", productionId);
  let project: any = $projectStore;
  $: project = $projectStore;
  const setProject = projectStore.set;
  let editor: string = "";
  const setEditor = (next: typeof editor | ((current: typeof editor) => typeof editor)) => {
    editor =
      typeof next === "function"
        ? (next as (current: typeof editor) => typeof editor)(editor)
        : next;
  };
  let editing: DomainRecord | null = initialState<DomainRecord | null>(null);
  const setEditing = (
    next: DomainRecord | null | ((current: DomainRecord | null) => DomainRecord | null),
  ) => {
    editing =
      typeof next === "function"
        ? (next as (current: DomainRecord | null) => DomainRecord | null)(editing)
        : next;
  };
  let detail: DomainRecord | null = initialState<DomainRecord | null>(null);
  const setDetail = (
    next: DomainRecord | null | ((current: DomainRecord | null) => DomainRecord | null),
  ) => {
    detail =
      typeof next === "function"
        ? (next as (current: DomainRecord | null) => DomainRecord | null)(detail)
        : next;
  };
  let exporting: boolean = false;
  const setExporting = (
    next: typeof exporting | ((current: typeof exporting) => typeof exporting),
  ) => {
    exporting =
      typeof next === "function"
        ? (next as (current: typeof exporting) => typeof exporting)(exporting)
        : next;
  };
  let error: string = "";
  const setError = (next: typeof error | ((current: typeof error) => typeof error)) => {
    error =
      typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next;
  };
  let draftModal: boolean = false;
  const setDraftModal = (
    next: typeof draftModal | ((current: typeof draftModal) => typeof draftModal),
  ) => {
    draftModal =
      typeof next === "function"
        ? (next as (current: typeof draftModal) => typeof draftModal)(draftModal)
        : next;
  };
  let syncing: boolean = false;
  const setSyncing = (next: typeof syncing | ((current: typeof syncing) => typeof syncing)) => {
    syncing =
      typeof next === "function"
        ? (next as (current: typeof syncing) => typeof syncing)(syncing)
        : next;
  };
  let admin = memberCan(workspace.user, "time.team.read");
  let allPeople = admin && !person;
  let key = `digitalmask-time-drafts:${workspace.user.id}`;
  const draftJsonStore = useStoredValue<any>(key, "[]");
  let draftJson: any = $draftJsonStore;
  $: draftJson = $draftJsonStore;
  const setDraftJson = draftJsonStore.set;
  let drafts: Draft[] = (() => {
    try {
      return JSON.parse(draftJson);
    } catch {
      return [];
    }
  })();
  const inboxJsonStore = useStoredValue<any>("digitalmask-offline-inbox", "[]");
  let inboxJson: any = $inboxJsonStore;
  $: inboxJson = $inboxJsonStore;
  const setInboxJson = inboxJsonStore.set;
  let inbox = (() => {
    try {
      const parsed = JSON.parse(inboxJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  let persist = (next: Draft[]) => setDraftJson(JSON.stringify(next));
  let run = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aktion fehlgeschlagen");
    }
  };
  let sync = async () => {
    setSyncing(true);
    await run(async () => {
      let remaining = [...drafts];
      for (const draft of drafts) {
        await post("/api/records/time", { data: { ...draft.data, idempotencyKey: draft.id } });
        remaining = remaining.filter((x) => x.id !== draft.id);
        persist(remaining);
      }
      await refresh();
    });
    setSyncing(false);
  };
  let until = shiftDate(week, 6);
  let markers = (() => {
    if (allPeople) return [];
    const first =
      workspace.records.events
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
  let weeks = (() =>
    groupBookingWeeks(workspace.records.time, {
      userId: allPeople ? undefined : person,
      productionId: project,
      period,
      markers,
    }))();
  let selected = weeks.find((row) => row.start === week);
  let entries = selected?.entries || [];
  let total = selected?.seconds || 0;
  let selectWeek = (next: string) => {
    setWeek(next);
    setPeriod(periodForWeek(period, next, workspace.records.productions));
  };
  let canBookDay = workspace.user.role !== "superadmin" && person === workspace.user.id;
  let openBooking = (date = localDate()) => {
    setEditor(date);
  };
  const secondaryActions = true;

  $: scope = `time:${productionId || "all"}`;
  $: categoryOptions = categoriesFor("time", workspace.records.categories);
  $: admin = memberCan(workspace.user, "time.team.read");
  $: allPeople = admin && !person;
  $: key = `digitalmask-time-drafts:${workspace.user.id}`;
  $: drafts = (() => {
    try {
      return JSON.parse(draftJson);
    } catch {
      return [];
    }
  })();
  $: inbox = (() => {
    try {
      const parsed = JSON.parse(inboxJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  $: until = shiftDate(week, 6);
  $: markers = (() => {
    if (allPeople) return [];
    const first =
      workspace.records.events
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
  $: weeks = (() =>
    groupBookingWeeks(workspace.records.time, {
      userId: allPeople ? undefined : person,
      productionId: project,
      period,
      markers,
    }))();
  $: selected = weeks.find((row) => row.start === week);
  $: entries = selected?.entries || [];
  $: total = selected?.seconds || 0;

  $: canBookDay = workspace.user.role !== "superadmin" && person === workspace.user.id;

  $: effects.run(
    90,
    () => {
      void $workspaceStore
        .loadWindow("time", week, shiftDate(week, 6))
        .catch((e) => $workspaceStore.notify(e.message));
    },
    [week],
  );
</script>

{#if true}
  {#snippet render_secondaryActions()}
    <ExportButton onClick={() => setExporting(true)}></ExportButton>
    {#if admin}<Button onClick={() => setCategoriesOpen(true)}>Tätigkeitsbereiche verwalten</Button
      >{/if}
    {#if workspace.user.role !== "superadmin" && !online}<Button onClick={() => setDraftModal(true)}
        >Ohne Internet vormerken</Button
      >{/if}
  {/snippet}

  {#if embedded}<header class={styles.moduleHeading}>
      <h2>Produktionsstunden</h2>
      <div class={styles.moduleActions}>
        <ActionMenu>{@render render_secondaryActions()}</ActionMenu>
        {#if workspace.user.role !== "superadmin"}<Button
            variant="primary"
            onClick={() => openBooking()}
          >
            <Plus size={16}></Plus> Nachtragen
          </Button>{/if}
      </div>
    </header>{:else}<PageHeader eyebrow="PRODUKTIONSSTUNDEN" title="Produktionsstunden" compact
      ><svelte:fragment slot="secondaryActions">{@render render_secondaryActions()}</svelte:fragment
      >
      {#if workspace.user.role !== "superadmin"}<Button
          variant="primary"
          onClick={() => openBooking()}
        >
          <Plus size={16}></Plus>
          Zeit nachtragen
        </Button>{/if}
    </PageHeader>{/if}
  <div class={`time-layout ${styles.workLayout} ${embedded ? "embedded-work-summary" : ""}`}>
    {#if !embedded}<TimerPanel {productionId}></TimerPanel>{/if}
    <section class="time-summary">
      <p class="eyebrow">
        {allPeople ? "TEAMWOCHE" : productionId ? "DEINE PRODUKTIONSWOCHE" : "DEINE WOCHE"}
      </p>
      <strong>
        {hours(total)} <span>Stunden</span>
      </strong>
      <div class="week-bars">
        {#each Array.from({ length: 7 }) as _, i}{@const date = shiftDate(week, i)}{@const seconds =
            entries
              .flatMap((entry) => entry.allocations)
              .filter((day) => day.date === date && dateMatchesPeriod(day.date, period))
              .reduce((sum, day) => sum + day.seconds, 0)}<button
            type="button"
            class={styles.weekDayButton}
            disabled={!canBookDay}
            aria-label={canBookDay
              ? `Zeit für ${dateLabel(date)} nachtragen`
              : `${dateLabel(date)} · ${hours(seconds)} Stunden`}
            title={canBookDay ? `Zeit für ${dateLabel(date)} nachtragen` : undefined}
            on:click={() => openBooking(date)}
          >
            <span class="small">{hours(seconds)}h</span>
            <div class="bar-track">
              <span
                style={styleString({ height: `${Math.min(100, (seconds / (8 * 3600)) * 100)}%` })}
              ></span>
            </div>
            <span class="small muted">
              {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][i]}
            </span>
            <span class="small muted">{dateLabel(date)}</span>
          </button>{/each}
      </div>
    </section>
  </div>
  {#if workspace.user.role !== "superadmin" && inbox.length > 0}<div class="offline-banner">
      <div>
        <strong>{inbox.length} unzugeordnete Geräteentwürfe</strong>
        <p class="small">
          Diese Offlinebuchungen gehören noch zu keinem Account. Übernimm nur deine eigenen
          Tätigkeiten als {workspace.user.name} im Theater {workspace.organization.name}.
        </p>
      </div>
      <Button
        onClick={() => {
          persist([
            ...drafts,
            ...inbox.filter((item) => !drafts.some((draft) => draft.id === item.id)),
          ]);
          setInboxJson("[]");
        }}
      >
        In meinen Account übernehmen
      </Button>
      <Button
        variant="ghost"
        onClick={() => {
          if (confirm("Alle unzugeordneten Geräteentwürfe auf diesem Gerät verwerfen?"))
            setInboxJson("[]");
        }}
      >
        Verwerfen
      </Button>
    </div>{/if}
  {#if workspace.user.role !== "superadmin" && drafts.length > 0}<div class="offline-banner">
      <div>
        <strong>{drafts.length} lokale Zeitentwürfe</strong>
        <p class="small">
          Nur auf diesem Gerät gespeichert. Bitte synchronisieren, bevor du dich abmeldest.
        </p>
      </div>
      <Button disabled={!online || syncing} onClick={() => void sync()}>
        <UploadCloud size={16}></UploadCloud>
        {syncing ? "Synchronisiert …" : "Jetzt synchronisieren"}
      </Button>
      <Button
        variant="ghost"
        onClick={() => {
          if (confirm("Alle lokalen Zeitentwürfe verwerfen?")) persist([]);
        }}
      >
        Verwerfen
      </Button>
    </div>{/if}
  <PeriodPicker
    compact
    records={workspace.records.time}
    productions={workspace.records.productions}
    value={period}
    onChange={(next) => {
      setPeriod(next);
      setWeek(
        allPeople && !dateMatchesPeriod(week, next)
          ? groupBookingWeeks(workspace.records.time, {
              userId: undefined,
              productionId: project,
              period: next,
            })[0]?.start || weekForPeriod(workspace.records.time, person, next, week)
          : weekForPeriod(workspace.records.time, person, next, week),
      );
    }}
  ></PeriodPicker>
  <div class={styles.weekToolbar}>
    <WeekNavigator {week} onChange={selectWeek}></WeekNavigator>
    {#if admin}<select
        aria-label="Person"
        value={person}
        on:change={(e) => setPerson(e.currentTarget.value)}
      >
        <option value="">Alle</option>
        {#each workspace.members.filter(isStaff) as x (x.id)}<option value={x.id}>
            {x.name}
            {x.status !== "active" ? " · ehemaliges Teammitglied" : ""}
          </option>{/each}
      </select>{/if}
    <select
      aria-label="Produktion"
      disabled={!!productionId}
      value={project}
      on:change={(e) => setProject(e.currentTarget.value)}
    >
      <option value="">Alle Tätigkeiten</option>
      {#each workspace.records.productions as x (x.id)}<option value={x.id}>
          {value(x.data, "title")}
        </option>{/each}
    </select>
  </div>
  <ErrorMessage message={error}></ErrorMessage>
  {#if entries.length}<section
      class={styles.currentWeek}
      aria-label="Arbeitszeit der ausgewählten Woche"
    >
      <header class={styles.currentHeading}>
        <h3>
          KW {isoWeek(week).number} · {isoWeek(week).year}
        </h3>
        <strong>{hours(total)} h</strong>
      </header>
      <BookingList
        {entries}
        kind="time"
        onEdit={setEditing}
        onDetail={setDetail}
        groupByPerson={allPeople}
      ></BookingList>
    </section>{:else}<section class={styles.emptyWeek}>
      <h3>Noch keine Arbeitszeit in dieser Woche.</h3>
      <p>
        Frühere Buchungen findest du im Wochenverlauf. Allgemeine Arbeit wie Besprechung oder
        Aufräumen lässt sich ohne Produktion buchen.
      </p>
      {#if workspace.user.role !== "superadmin"}<Button onClick={() => openBooking()}
          >Zeit nachtragen</Button
        >{/if}
    </section>{/if}
  {#if !allPeople}<WeekDayOverview
      {week}
      {person}
      {entries}
      markers={selected?.markers || []}
      onDetail={setDetail}
      onBookDay={canBookDay ? openBooking : undefined}
    ></WeekDayOverview>{/if}
  {#key `${person}:${project}:${period.year || ""}:${period.season || ""}`}<WeeklyHistory
      {weeks}
      selectedWeek={week}
      {person}
      kind="time"
      filtered={!!period.year || !!period.season}
      onAllSeasons={() => setPeriod({})}
      onSelectWeek={selectWeek}
      onEdit={setEditing}
      onDetail={setDetail}
      onBookDay={canBookDay ? openBooking : undefined}
      groupByPerson={allPeople}
    ></WeeklyHistory>{/key}
  {#if !allPeople}<CalendarTimeProposals kind="time" {person} {week} {period} productionId={project}
    ></CalendarTimeProposals>{/if}
  {#if editor}<ResourceEditor
      kind="time"
      lockedProductionId={productionId || undefined}
      defaults={{ productionId: project, date: editor }}
      onSaved={(record) => {
        setPerson(workspace.user.id);
        selectWeek(isoWeek(value(record.data, "date")).start);
      }}
      onClose={() => setEditor("")}
    ></ResourceEditor>{/if}
  {#if editing}{@const activeEditing = editing}<ResourceEditor
      kind="time"
      record={workspace.records.time.find((row) => row.id === activeEditing.id) || activeEditing}
      onClose={() => setEditing(null)}
    ></ResourceEditor>{/if}
  {#if detail}<RecordDetail record={detail} onClose={() => setDetail(null)}></RecordDetail>{/if}
  {#if exporting}<ExportDialog
      kind="time"
      filters={{
        ...periodExportFilters(period),
        ...(!allPeople ? { userId: person } : {}),
        from: week,
        to: until,
        ...(project ? { productionId: project } : {}),
      }}
      onClose={() => setExporting(false)}
    ></ExportDialog>{/if}
  {#if categoriesOpen}<CategoryManager scope="time" onClose={() => setCategoriesOpen(false)}
    ></CategoryManager>{/if}
  {#if draftModal}<Modal
      title="Zeit offline als Entwurf speichern"
      onClose={() => setDraftModal(false)}
    >
      <p class="muted">
        Dieser Entwurf bleibt nur in deinem Browser. Er wird erst nach deiner ausdrücklichen
        Synchronisierung im Theater gespeichert.
      </p>
      <form
        on:submit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          persist([
            ...drafts,
            {
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              data: {
                title: form.get("title"),
                date: form.get("date"),
                productionId: productionId || form.get("productionId"),
                category: form.get("category"),
                durationSeconds: Number(form.get("minutes")) * 60,
                pauseSeconds: 0,
              },
            },
          ]);
          setDraftModal(false);
        }}
      >
        <label>
          Tätigkeit
          <input name="title" required />
        </label>
        <div class="form-grid">
          <label>
            Datum
            <input name="date" type="date" defaultValue={localDate()} required />
          </label>
          <label>
            Minuten
            <input name="minutes" type="number" min="1" required />
          </label>
          <label>
            Produktion
            <select name="productionId" defaultValue={productionId} disabled={!!productionId}>
              <option value="">Allgemein</option>
              {#each workspace.records.productions as x (x.id)}<option value={x.id}>
                  {value(x.data, "title")}
                </option>{/each}
            </select>
          </label>
          <label>
            Kategorie
            <select name="category" required>
              {#if !categoryOptions.length}<option value="">Keine Kategorien vorhanden</option>{/if}
              {#each categoryOptions as option (option.key)}<option value={option.key}>
                  {option.name}
                </option>{/each}
            </select>
          </label>
        </div>
        <footer class="dialog-footer">
          <Button onClick={() => setDraftModal(false)}>Abbrechen</Button>
          <Button type="submit" variant="primary">Lokal speichern</Button>
        </footer>
      </form>
    </Modal>{/if}
{/if}
