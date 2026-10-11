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
  import { columns, listColumns, TaskCard, Column, TasksModule } from "./tasks";
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
  let checklist = Array.isArray(task.data.checklist)
    ? (task.data.checklist as {
        done: boolean;
      }[])
    : [];
  let assignees = ids(task.data, "assigneeIds")
    .map((id) => workspace.members.find((person) => person.id === id)?.name)
    .filter(Boolean);

  $: canEdit = canManageRecord(workspace.user, "tasks", task);
  $: checklist = Array.isArray(task.data.checklist)
    ? (task.data.checklist as {
        done: boolean;
      }[])
    : [];
  $: assignees = ids(task.data, "assigneeIds")
    .map((id) => workspace.members.find((person) => person.id === id)?.name)
    .filter(Boolean);
</script>

<article class={styles.taskRow}>
  <button class={styles.openTask} on:click={onOpen}>
    <span class={styles.rowContent}>
      <strong>{value(task.data, "title")}</strong>
      {#if !!value(task.data, "description")}<span class={styles.description}
          >{value(task.data, "description")}</span
        >{/if}
      <span class={styles.rowMeta}>
        {#if task.data.priority === "high"}<span class={styles.highPriority}>
            <Flag size={12}></Flag> Hoch
          </span>{/if}
        {#if !!task.data.due}<span>
            <CalendarDays size={13}></CalendarDays>
            {dateLabel(value(task.data, "due"))}
          </span>{/if}
        {#if !!checklist.length}<span>
            <CheckSquare size={13}></CheckSquare>
            {checklist.filter((item) => item.done).length}/
            {checklist.length}
          </span>{/if}
      </span>
    </span>
    <ChevronRight size={18}></ChevronRight>
  </button>
  <footer class={styles.rowFooter}>
    <span class={styles.assignees}>{assignees.join(", ") || "Noch nicht zugeteilt"}</span>
    <label class={styles.rowStatus}>
      <span class="visually-hidden">Status von {value(task.data, "title")}</span>
      <select
        disabled={!canEdit}
        value={value(task.data, "status")}
        on:change={(event) => onMove(event.currentTarget.value)}
      >
        {#each columns as [id, label] (id)}<option value={id}>
            {label}
          </option>{/each}
      </select>
    </label>
  </footer>
</article>
