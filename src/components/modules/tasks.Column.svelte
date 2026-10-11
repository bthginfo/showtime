<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel } = useTheaterTime();
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
  import { columns, listColumns, TaskListRow, TaskCard, TasksModule } from "./tasks";
  const effects = createEffects();
  type ViewProps = {
    id: string;
    label: string;
    tasks: DomainRecord[];
    onOpen: (record: DomainRecord) => void;
    onMove: (record: DomainRecord, status: string) => void;
    onAdd: () => void;
  };
  export let id: ViewProps["id"] = undefined as any;
  export let label: ViewProps["label"] = undefined as any;
  export let tasks: ViewProps["tasks"] = undefined as any;
  export let onOpen: ViewProps["onOpen"] = undefined as any;
  export let onMove: ViewProps["onMove"] = undefined as any;
  export let onAdd: ViewProps["onAdd"] = undefined as any;
  const useDroppable___setNodeRef__isOver__Store = useDroppable(() => ({ id }));
  let setNodeRef = $useDroppable___setNodeRef__isOver__Store.setNodeRef;
  let isOver = $useDroppable___setNodeRef__isOver__Store.isOver;

  $: ({ setNodeRef, isOver } = $useDroppable___setNodeRef__isOver__Store);
</script>

<section
  use:applyRef={setNodeRef}
  data-column={id}
  class={`kanban-column ${isOver ? "drop-active" : ""}`}
>
  <header>
    <h2>
      <span class={`status-dot ${id}`}></span>
      {label}
      <span class="count">{tasks.length}</span>
    </h2>
    <button class="icon-button" on:click={onAdd} aria-label={`Aufgabe in ${label} anlegen`}>
      <Plus size={16}></Plus>
    </button>
  </header>
  <div class="kanban-stack">
    {#each tasks as task (task.id)}{#key task.id}<TaskCard
          {task}
          onOpen={() => onOpen(task)}
          onMove={(status) => onMove(task, status)}
        ></TaskCard>{/key}{/each}
    {#if !tasks.length}<div class="column-empty">Platz für eure nächsten Schritte.</div>{/if}
  </div>
</section>
