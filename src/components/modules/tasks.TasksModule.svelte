<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel } = useTheaterTime();
  import { initialState } from "@/shared/svelte-runtime";

  import { LinkedText } from "@/components/linked-text";
  import { useViewState } from "@/shared/view-state";
  import {
    DndContext,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    useDraggable,
    useDroppable,
    type DragEndEvent,
  } from "@/shared/dnd";
  import {
    CalendarDays,
    CheckSquare,
    ChevronDown,
    ChevronRight,
    Columns3,
    Flag,
    List,
    Plus,
  } from "@lucide/svelte";
  import { PeriodPicker, periodExportFilters } from "@/components/period-picker";
  import { initialPeriod, recordMatchesPeriod, type PeriodFilter } from "@/shared/period-filter";
  import type { DomainRecord } from "@/shared/contracts";
  import { ids, initials, value } from "@/shared/client-api";
  import { useWorkspace } from "../workspace-context";
  import { Badge, Button, ErrorMessage, ExportButton, PageHeader } from "../ui";
  import { ResourceEditor } from "../resource-editor";
  import { RecordDetail } from "../resource-view";
  import { canManageRecord } from "@/shared/record-permissions";
  import { ExportDialog } from "../export-dialog";
  import { RecordLink } from "../record-link";
  import { subscribeMobile, useStoredValue } from "@/shared/client-storage";
  import styles from "./task-board.module.css";
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
  import { columns, listColumns, TaskListRow, TaskCard, Column } from "./tasks";
  const effects = createEffects();
  type ViewProps = {
    productionId?: string;
  };
  export let productionId: NonNullable<ViewProps["productionId"]> = "";
  const workspaceStore = useWorkspace();
  let { workspace, save } = $workspaceStore;
  $: ({ workspace, save } = $workspaceStore);
  let project = productionId;
  let scope = `tasks:${productionId || "team"}`;
  const periodStore = useViewState<PeriodFilter>(workspace.user.id, scope, "period", () =>
    initialPeriod(workspace.records.productions, productionId),
  );
  let period: PeriodFilter = $periodStore;
  $: period = $periodStore;
  const setPeriod = periodStore.set;
  const sprintStore = useViewState<any>(workspace.user.id, scope, "sprint", "");
  let sprint: any = $sprintStore;
  $: sprint = $sprintStore;
  const setSprint = sprintStore.set;
  const mineStore = useViewState<any>(workspace.user.id, scope, "mine", false);
  let mine: any = $mineStore;
  $: mine = $mineStore;
  const setMine = mineStore.set;
  const searchStore = useViewState<any>(workspace.user.id, scope, "search", "");
  let search: any = $searchStore;
  $: search = $searchStore;
  const setSearch = searchStore.set;
  const statusStore = useViewState<any>(workspace.user.id, scope, "status", "");
  let status: any = $statusStore;
  $: status = $statusStore;
  const setStatus = statusStore.set;
  const isMobileStore = externalStore(
    subscribeMobile,
    () => window.matchMedia("(max-width: 760px)").matches,
    () => false,
  );
  let isMobile = $isMobileStore;
  $: isMobile = $isMobileStore;
  const desktopViewStore = useStoredValue<string>(
    `digitalmask-task-view:${workspace.user.id}:desktop`,
    "list",
  );
  const mobileViewStore = useStoredValue<string>(
    `digitalmask-task-view:${workspace.user.id}:mobile`,
    "list",
  );
  let preferredView = $desktopViewStore;
  $: preferredView = isMobile ? $mobileViewStore : $desktopViewStore;
  const setView = (value: string) => (isMobile ? mobileViewStore : desktopViewStore).set(value);
  let listView = preferredView === "list";
  let editor: {
    kind: "tasks" | "sprints";
    status?: string;
    parentId?: string;
  } | null = null;
  const setEditor = (
    next:
      | {
          kind: "tasks" | "sprints";
          status?: string;
          parentId?: string;
        }
      | null
      | ((
          current: {
            kind: "tasks" | "sprints";
            status?: string;
            parentId?: string;
          } | null,
        ) => {
          kind: "tasks" | "sprints";
          status?: string;
          parentId?: string;
        } | null),
  ) => {
    editor =
      typeof next === "function"
        ? (
            next as (
              current: {
                kind: "tasks" | "sprints";
                status?: string;
                parentId?: string;
              } | null,
            ) => {
              kind: "tasks" | "sprints";
              status?: string;
              parentId?: string;
            } | null
          )(editor)
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
  let error: string = "";
  const setError = (next: typeof error | ((current: typeof error) => typeof error)) => {
    error =
      typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next;
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
  let board = { current: null as HTMLDivElement | null };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  let filteredTasks = (() =>
    workspace.records.tasks.filter(
      (x) =>
        value(x.data, "productionId") === project &&
        recordMatchesPeriod(x, period, workspace.records.productions) &&
        (!sprint || x.data.sprintId === sprint) &&
        (!mine || ids(x.data, "assigneeIds").includes(workspace.user.id)) &&
        (!search || value(x.data, "title").toLowerCase().includes(search.toLowerCase())),
    ))();
  let tasks = status ? filteredTasks.filter((task) => task.data.status === status) : filteredTasks;
  let move = async (task: DomainRecord, status: string) => {
    if (task.data.status === status) return;
    setError("");
    try {
      await save("tasks", { status }, task);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verschieben fehlgeschlagen");
    }
  };
  let dragEnd = (event: DragEndEvent) => {
    const task = tasks.find((x) => x.id === event.active.id);
    const status = String(event.over?.id || "");
    if (task && columns.some((x) => x[0] === status)) void move(task, status);
  };
  let selectedSprint = workspace.records.sprints.find((x) => x.id === sprint);

  $: project = productionId;
  $: scope = `tasks:${productionId || "team"}`;
  $: listView = preferredView === "list";
  $: filteredTasks = (() =>
    workspace.records.tasks.filter(
      (x) =>
        value(x.data, "productionId") === project &&
        recordMatchesPeriod(x, period, workspace.records.productions) &&
        (!sprint || x.data.sprintId === sprint) &&
        (!mine || ids(x.data, "assigneeIds").includes(workspace.user.id)) &&
        (!search || value(x.data, "title").toLowerCase().includes(search.toLowerCase())),
    ))();
  $: tasks = status ? filteredTasks.filter((task) => task.data.status === status) : filteredTasks;

  $: selectedSprint = workspace.records.sprints.find((x) => x.id === sprint);
</script>

<section class={styles.taskWorkspace}>
  <PageHeader compact title={project ? "Aufgaben & Sprints" : "Teamboard"}
    ><svelte:fragment slot="secondaryActions">
      <ExportButton onClick={() => setExporting(true)}></ExportButton>
      {#if project}<Button onClick={() => setEditor({ kind: "sprints" })}>Sprint planen</Button
        >{/if}
    </svelte:fragment>
    <Button variant="primary" onClick={() => setEditor({ kind: "tasks" })}>
      <Plus size={16}></Plus>
      Aufgabe
    </Button>
  </PageHeader>
  <PeriodPicker
    compact
    records={workspace.records.tasks.filter((row) => value(row.data, "productionId") === project)}
    productions={workspace.records.productions}
    value={period}
    onChange={setPeriod}
  ></PeriodPicker>
  <div class={`toolbar wrap ${styles.filters}`}>
    {#if project}<select
        aria-label="Sprint"
        value={sprint}
        on:change={(e) => setSprint(e.currentTarget.value)}
      >
        <option value="">Alle Sprints</option>
        {#each workspace.records.sprints.filter((x) => x.data.productionId === project) as x (x.id)}<option
            value={x.id}
          >
            {value(x.data, "title")}
          </option>{/each}
      </select>{/if}
    <input
      class={styles.search}
      placeholder="Aufgaben suchen …"
      aria-label="Aufgaben suchen"
      value={search}
      on:input={(e) => setSearch(e.currentTarget.value)}
    />
    <label class="check-label">
      <input type="checkbox" checked={mine} on:input={(e) => setMine(e.currentTarget.checked)} />
      Meine Aufgaben
    </label>
  </div>
  <div class={styles.viewToolbar}>
    <select
      aria-label="Aufgabenstatus filtern"
      value={status}
      on:change={(event) => setStatus(event.currentTarget.value)}
    >
      <option value="">Alle Status ({filteredTasks.length})</option>
      {#each columns as [id, label] (id)}<option value={id}>
          {label} ({filteredTasks.filter((task) => task.data.status === id).length})
        </option>{/each}
    </select>
    <div class={`segmented ${styles.viewSwitch}`} role="group" aria-label="Aufgabenansicht">
      <button
        class={listView ? "active" : ""}
        aria-pressed={listView}
        on:click={() => setView("list")}
      >
        <List size={15}></List> Liste
      </button>
      <button
        class={!listView ? "active" : ""}
        aria-pressed={!listView}
        on:click={() => setView("board")}
      >
        <Columns3 size={15}></Columns3> Kanban
      </button>
    </div>
  </div>
  {#if selectedSprint}<div class="sprint-banner">
      <div>
        <p class="eyebrow">AKTUELLER SPRINT</p>
        <h3>{value(selectedSprint.data, "title")}</h3>
        <p class="small muted">{value(selectedSprint.data, "goal")}</p>
      </div>
      <span class="small">
        {dateLabel(value(selectedSprint.data, "start"))} –{" "}
        {dateLabel(value(selectedSprint.data, "end"))}
      </span>
      <Button onClick={() => setDetail(selectedSprint)}>Sprint bearbeiten</Button>
    </div>{/if}
  <ErrorMessage message={error}></ErrorMessage>
  {#if listView}<div class={styles.taskGroups}>
      {#each listColumns.filter( ([id]) => tasks.some((task) => task.data.status === id) ) as [id, label] (id)}{@const group =
          tasks.filter((task) => task.data.status === id)}
        <section class={styles.taskGroup} aria-label={`${label}: ${group.length} Aufgaben`}>
          <header>
            <h2>
              <span class={`status-dot ${id}`}></span>
              {label}
              <span class="count">{group.length}</span>
            </h2>
            <button
              class="icon-button"
              aria-label={`Aufgabe in ${label} anlegen`}
              on:click={() => setEditor({ kind: "tasks", status: id })}
            >
              <Plus size={17}></Plus>
            </button>
          </header>
          {#each group as task (task.id)}{#key task.id}<TaskListRow
                {task}
                onOpen={() => setDetail(task)}
                onMove={(next) => void move(task, next)}
              ></TaskListRow>{/key}{/each}
        </section>{/each}
      {#if !tasks.length}<div class={styles.noTasks} role="status">
          <h3>
            {search || mine || sprint || status
              ? "Keine passenden Aufgaben"
              : "Alles im Blick. Noch keine Aufgaben."}
          </h3>
          <p class="small muted">
            {search || mine || sprint || status
              ? "Passe die Filter an oder lege eine neue Aufgabe an."
              : "Mit einer Aufgabe beginnt euer nächster gemeinsamer Schritt."}
          </p>
          {#if search || mine || sprint || status}<Button
              onClick={() => {
                setSearch("");
                setMine(false);
                setSprint("");
                setStatus("");
              }}
            >
              Aufgabenfilter zurücksetzen
            </Button>{/if}
        </div>{/if}
    </div>{:else}
    {#if !status}<div class="mobile-board-nav">
        <span class="small muted">Alle Spalten: horizontal wischen oder auswählen</span>
        <select
          aria-label="Kanban-Spalte anzeigen"
          defaultValue="backlog"
          on:change={(event) =>
            board.current
              ?.querySelector(`[data-column="${event.currentTarget.value}"]`)
              ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" })}
        >
          {#each columns as [id, label] (id)}<option value={id}>
              {label} ({tasks.filter((task) => task.data.status === id).length})
            </option>{/each}
        </select>
      </div>{/if}
    <DndContext {sensors} onDragEnd={dragEnd}>
      <div
        class={`kanban ${styles.board}`}
        use:applyRef={(element) => {
          board.current = element;
        }}
      >
        {#each columns.filter(([id]) => !status || id === status) as [id, label] (id)}{#key id}<Column
              {id}
              {label}
              tasks={tasks.filter((x) => x.data.status === id)}
              onOpen={setDetail}
              onMove={(task, status) => void move(task, status)}
              onAdd={() => setEditor({ kind: "tasks", status: id })}
            ></Column>{/key}{/each}
      </div>
    </DndContext>
  {/if}
  {#if detail}<RecordDetail record={detail} onClose={() => setDetail(null)}></RecordDetail>{/if}
  {#if editor}{@const activeEditor = editor}<ResourceEditor
      kind={activeEditor.kind}
      lockedProductionId={project}
      defaults={{
        productionId: project,
        sprintId: sprint,
        season: period.season || initialPeriod(workspace.records.productions, productionId).season,
        ...(activeEditor.status ? { status: activeEditor.status } : {}),
        ...(activeEditor.parentId
          ? {
              parentId: activeEditor.parentId,
              productionId: workspace.records.tasks.find((x) => x.id === activeEditor.parentId)
                ?.data.productionId,
            }
          : {}),
      }}
      onClose={() => setEditor(null)}
    ></ResourceEditor>{/if}
  {#if exporting}<ExportDialog
      kind="tasks"
      filters={{
        ...periodExportFilters(period),
        ...(project ? { productionId: project } : { teamOnly: "true" }),
      }}
      onClose={() => setExporting(false)}
    ></ExportDialog>{/if}
</section>
