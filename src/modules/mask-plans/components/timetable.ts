import type {CSSProperties} from '@/shared/ui-types';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useSensor, useSensors, type DragStartEvent, } from "@/shared/dnd";
import { Pencil, Plus, Clock3, GripVertical, MousePointer2, X } from "@lucide/svelte";
import { RecordLink } from "@/components/record-link";
import { value } from "@/shared/client-api";
import type { DomainRecord, Member } from "@/shared/contracts";
import { maskPlanActorNames, maskPlanBlockLabel, maskPlanClock, maskPlanStaffNames, maskPlanWindow, type MaskPlanBlock, type MaskPlanData, type MaskPlanLane, } from "../model";
import { maskPlanTracks } from "../layout";
import styles from "./mask-plans.module.css";
export function laneTitle(lane: MaskPlanLane, members: Member[], index: number) {
    return maskPlanStaffNames(lane, members).join(" / ") || lane.label || `Spalte ${index + 1}`;
}
export function colorStyle(block: MaskPlanBlock, productionColor: string) {
    const color = block.color || productionColor;
    return {
        "--block-color": /^#[0-9a-f]{6}$/i.test(color) ? color : "#83c6a5",
    } as CSSProperties;
}
export type Props = {
    plan: MaskPlanData;
    compact?: boolean;
    members: Member[];
    actors: DomainRecord[];
    performanceTime: string;
    productionColor: string;
    onEditLane: (lane: MaskPlanLane) => void;
    onEditBlock: (block: MaskPlanBlock) => void;
    onAddBlock: (laneId: string, startMinutes?: number) => void;
    onMoveBlock: (id: string, laneId: string, startMinutes: number) => void;
    onDragStart: () => void;
    onDragCancel: () => void;
};
export type DragSource = {
    block?: MaskPlanBlock;
    plan: MaskPlanData;
    grabOffset: number;
};
export type DropTarget = {
    laneId: string;
    startMinutes: number;
    durationMinutes: number;
};
export type Point = {
    x: number;
    y: number;
};
export const NEW_BLOCK = "new-mask-block";
export function eventPoint(event: Event): Point | null {
    if ("touches" in event) {
        const touch = (event as TouchEvent).touches[0] || (event as TouchEvent).changedTouches[0];
        return touch ? { x: touch.clientX, y: touch.clientY } : null;
    }
    return "clientX" in event
        ? { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY }
        : null;
}
export { default as PlaceControl } from "./timetable.PlaceControl.svelte";
export { default as DraggableBlock } from "./timetable.DraggableBlock.svelte";
export { default as Timetable } from "./timetable.Timetable.svelte";
export { default as PlanAgenda } from "./timetable.PlanAgenda.svelte";
