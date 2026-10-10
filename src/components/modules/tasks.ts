import { LinkedText } from "@/components/linked-text";
import { useViewState } from "@/shared/view-state";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent, } from "@/shared/dnd";
import { CalendarDays, CheckSquare, ChevronDown, ChevronRight, Columns3, Flag, List, Plus, } from "@lucide/svelte";
import { PeriodPicker, periodExportFilters } from "@/components/period-picker";
import { initialPeriod, recordMatchesPeriod, type PeriodFilter } from "@/shared/period-filter";
import type { DomainRecord } from "@/shared/contracts";
import { dateLabel, ids, initials, value } from "@/shared/client-api";
import { useWorkspace } from "../workspace-context";
import { Badge, Button, ErrorMessage, ExportButton, PageHeader } from "../ui";
import { ResourceEditor } from "../resource-editor";
import { RecordDetail } from "../resource-view";
import { canManageRecord } from "@/shared/record-permissions";
import { ExportDialog } from "../export-dialog";
import { RecordLink } from "../record-link";
import { subscribeMobile, useStoredValue } from "@/shared/client-storage";
import styles from "./task-board.module.css";
export const columns = [
    ["backlog", "Backlog"],
    ["todo", "Offen"],
    ["doing", "In Arbeit"],
    ["review", "Prüfung"],
    ["done", "Erledigt"],
];
export const listColumns = [columns[1], columns[2], columns[3], columns[0], columns[4]];
export { default as TaskListRow } from "./tasks.TaskListRow.svelte";
export { default as TaskCard } from "./tasks.TaskCard.svelte";
export { default as Column } from "./tasks.Column.svelte";
export { default as TasksModule } from "./tasks.TasksModule.svelte";
