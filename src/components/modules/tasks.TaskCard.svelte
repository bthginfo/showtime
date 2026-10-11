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
  import { columns, listColumns, TaskListRow, Column, TasksModule } from "./tasks";
  const effects = createEffects();
  type ViewProps = {
    task: DomainRecord;
    onOpen: () => void;
    onMove: (status: string) => void;
  };
  export let task: ViewProps["task"] = undefined as any;
  export let onOpen: ViewProps["onOpen"] = undefined as any;
  export let onMove: ViewProps["onMove"] = undefined as any;
  const workspaceStore = useWorkspace();
  let { workspace } = $workspaceStore;
  $: ({ workspace } = $workspaceStore);
  let canEdit = canManageRecord(workspace.user, "tasks", task);
  const useDraggable___attributes__listeners__setNodeRef__transform__isDragging__Store =
    useDraggable(() => ({
      id: task.id,
      disabled: !canEdit,
    }));
  let attributes =
    $useDraggable___attributes__listeners__setNodeRef__transform__isDragging__Store.attributes;
  let listeners =
    $useDraggable___attributes__listeners__setNodeRef__transform__isDragging__Store.listeners;
  let setNodeRef =
    $useDraggable___attributes__listeners__setNodeRef__transform__isDragging__Store.setNodeRef;
  let transform =
    $useDraggable___attributes__listeners__setNodeRef__transform__isDragging__Store.transform;
  let isDragging =
    $useDraggable___attributes__listeners__setNodeRef__transform__isDragging__Store.isDragging;
  let list = Array.isArray(task.data.checklist)
    ? (task.data.checklist as {
        done: boolean;
      }[])
    : [];
  let subtasks = workspace.records.tasks.filter((x) => x.data.parentId === task.id);
  let production = workspace.records.productions.find((row) => row.id === task.data.productionId);

  $: canEdit = canManageRecord(workspace.user, "tasks", task);
  $: ({ attributes, listeners, setNodeRef, transform, isDragging } =
    $useDraggable___attributes__listeners__setNodeRef__transform__isDragging__Store);
  $: list = Array.isArray(task.data.checklist)
    ? (task.data.checklist as {
        done: boolean;
      }[])
    : [];
  $: subtasks = workspace.records.tasks.filter((x) => x.data.parentId === task.id);
  $: production = workspace.records.productions.find((row) => row.id === task.data.productionId);
</script>

<article
  class={`task-card ${isDragging ? "dragging" : ""}`}
  use:applyRef={setNodeRef}
  style={styleString(
    transform ? { transform: `translate(${transform.x}px,${transform.y}px)` } : undefined,
  )}
>
  <div class="task-top">
    <span class="small muted">
      {#if production}<RecordLink record={production}>{value(production.data, "title")}</RecordLink
        >{:else}{"Teamboard"}{/if}
    </span>
    <button
      class="drag-handle"
      disabled={!canEdit}
      {...listeners}
      {...attributes}
      aria-label="Aufgabe verschieben"
    >
      ⠿
    </button>
  </div>
  <button class="task-title" on:click={onOpen}>
    {value(task.data, "title")}
  </button>
  <p class="small muted task-description">
    <LinkedText text={value(task.data, "description")}></LinkedText>
  </p>
  <div class="task-meta">
    {#if task.data.priority === "high"}<Badge tone="coral">
        <Flag size={12}></Flag>
        Hoch
      </Badge>{/if}
    {#if !!task.data.due}<span class="small">
        <CalendarDays size={13}></CalendarDays>
        {dateLabel(value(task.data, "due"))}
      </span>{/if}
    {#if list.length > 0}<span class="small">
        <CheckSquare size={13}></CheckSquare>
        {list.filter((x) => x.done).length}/{list.length}
      </span>{/if}
    {#if subtasks.length > 0}<span class="small">{subtasks.length} Unteraufgaben</span>{/if}
  </div>
  <footer class="task-footer">
    <div class="avatar-stack">
      {#each ids(task.data, "assigneeIds") as id (id)}{@const person = workspace.members.find(
          (x) => x.id === id,
        )}<span class="avatar small-avatar" title={person?.name}>
          {initials(person?.name || "?")}
        </span>{/each}
    </div>
    <label class="task-status-label">
      <span class="visually-hidden">Status von {value(task.data, "title")}</span>
      <select
        disabled={!canEdit}
        value={value(task.data, "status")}
        on:change={(e) => onMove(e.currentTarget.value)}
      >
        {#each columns as [id, label] (id)}<option value={id}>
            {label}
          </option>{/each}
      </select>
      <ChevronDown size={12}></ChevronDown>
    </label>
  </footer>
</article>
