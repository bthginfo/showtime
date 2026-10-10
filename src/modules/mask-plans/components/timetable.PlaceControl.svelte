<script lang="ts">
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useSensor, useSensors, type DragStartEvent, } from "@/shared/dnd";
import { Pencil, Plus, Clock3, GripVertical, MousePointer2, X } from "@lucide/svelte";
import { RecordLink } from "@/components/record-link";
import { value } from "@/shared/client-api";
import type { DomainRecord, Member } from "@/shared/contracts";
import { maskPlanActorNames, maskPlanBlockLabel, maskPlanClock, maskPlanStaffNames, maskPlanWindow, type MaskPlanBlock, type MaskPlanData, type MaskPlanLane, } from "../model";
import { maskPlanTracks } from "../layout";
import styles from "./mask-plans.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { laneTitle, colorStyle, type Props, type DragSource, type DropTarget, type Point, NEW_BLOCK, eventPoint, DraggableBlock, Timetable, PlanAgenda } from "./timetable";
const effects=createEffects();
type ViewProps = {
    active: boolean;
    onClick: () => void;
    onPress: () => void;
};
export let active: ViewProps["active"] = undefined as any;
export let onClick: ViewProps["onClick"] = undefined as any;
export let onPress: ViewProps["onPress"] = undefined as any;
const useDraggable___setNodeRef__attributes__listeners__isDragging__Store = useDraggable(()=>({ id: NEW_BLOCK }));
let setNodeRef = $useDraggable___setNodeRef__attributes__listeners__isDragging__Store.setNodeRef;
let attributes = $useDraggable___setNodeRef__attributes__listeners__isDragging__Store.attributes;
let listeners = $useDraggable___setNodeRef__attributes__listeners__isDragging__Store.listeners;
let isDragging = $useDraggable___setNodeRef__attributes__listeners__isDragging__Store.isDragging;

$: ({ setNodeRef, attributes, listeners, isDragging } = $useDraggable___setNodeRef__attributes__listeners__isDragging__Store);

</script>

<button use:applyRef={setNodeRef} {...attributes} {...listeners} type="button" class={`button ${styles.placeControl} ${isDragging ? styles.dragging : ""}`} aria-pressed={active} on:click={onClick} on:pointerdown|capture={onPress} title="Ziehen oder antippen und danach eine freie Stelle in der Tabelle wählen.">
      {#if active}<X size={16}></X>{:else}<MousePointer2 size={16}></MousePointer2>{/if}
      {active ? "Platzieren abbrechen" : "Zeitblock platzieren"}
      <GripVertical size={15} aria-hidden="true"></GripVertical>
    </button>
