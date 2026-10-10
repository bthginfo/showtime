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
import { laneTitle, colorStyle, type Props, type DragSource, type DropTarget, type Point, NEW_BLOCK, eventPoint, PlaceControl, Timetable, PlanAgenda } from "./timetable";
const effects=createEffects();
type ViewProps = {
    block: MaskPlanBlock;
    label: string;
    style: CSSProperties;
    performanceTime: string;
    onClick: () => void;
    onPress: () => void;
    compact: boolean;
    actors: DomainRecord[];
};
export let block: ViewProps["block"] = undefined as any;
export let label: ViewProps["label"] = undefined as any;
export let style: ViewProps["style"] = undefined as any;
export let performanceTime: ViewProps["performanceTime"] = undefined as any;
export let onClick: ViewProps["onClick"] = undefined as any;
export let onPress: ViewProps["onPress"] = undefined as any;
export let compact: ViewProps["compact"] = undefined as any;
export let actors: ViewProps["actors"] = undefined as any;
const useDraggable___setNodeRef__attributes__listeners__isDragging__Store = useDraggable(()=>({
    id: block.id,
    data: { block },
    disabled: compact,
}));
let setNodeRef = $useDraggable___setNodeRef__attributes__listeners__isDragging__Store.setNodeRef;
let attributes = $useDraggable___setNodeRef__attributes__listeners__isDragging__Store.attributes;
let listeners = $useDraggable___setNodeRef__attributes__listeners__isDragging__Store.listeners;
let isDragging = $useDraggable___setNodeRef__attributes__listeners__isDragging__Store.isDragging;

$: ({ setNodeRef, attributes, listeners, isDragging } = $useDraggable___setNodeRef__attributes__listeners__isDragging__Store);

</script>

{#if compact}<div use:applyRef={setNodeRef} class={`${styles.block} ${styles.savedBlock}`} data-mask-block={block.id} style={styleString(style)}>
        <span class={styles.blockTime}>
          {block.startMinutes} · {block.durationMinutes} Min.
          {#if performanceTime}<span> · {maskPlanClock(block.startMinutes, performanceTime)}</span>{/if}
        </span>
        <div class={styles.savedBlockNames}>
          {#each block.actorIds as id}{@const actor = actors.find((candidate) => candidate.id === id)}{#if actor}{#key id}<RecordLink record={actor} decoration={false} title={value(actor.data, "name")}>
                {value(actor.data, "name")}
              </RecordLink>{/key}{:else}<span>Frühere Schauspielperson</span>{/if}{/each}
          {#each block.actorNames as name, index (`${index}:${name}`)}<span title={name}>
              {name}
            </span>{/each}
        </div>
        {#if block.title}<strong title={block.title}>{block.title}</strong>{/if}
        <button type="button" class={styles.savedBlockEdit} on:click={onClick} aria-label={`${label}, ${block.startMinutes} Minuten vor Beginn, ${block.durationMinutes} Minuten, bearbeiten`} title={`${label}\n${block.startMinutes} bis ${block.startMinutes + block.durationMinutes} Min.\n${block.notes}`}>
          <Pencil size={13}></Pencil>
        </button>
      </div>{:else}<button type="button" use:applyRef={setNodeRef} {...attributes} {...listeners} class={`${styles.block} ${isDragging ? styles.dragging : ""}`} on:click={onClick} on:pointerdown|capture={onPress} on:contextmenu={(event) => event.preventDefault()} aria-label={`${label}, ${block.startMinutes} Minuten vor Beginn, ${block.durationMinutes} Minuten, bearbeiten`} title={`${label}\n${block.startMinutes} bis ${block.startMinutes + block.durationMinutes} Min.\n${block.notes}\nZiehen zum Verschieben · auf dem Handy kurz halten.`} data-mask-block={block.id} style={styleString(style)}>
      <span class={styles.blockTime}>
        {block.startMinutes} <span>· {block.durationMinutes} Min.</span>
        <GripVertical size={13} aria-hidden="true"></GripVertical>
      </span>
      <strong>{label}</strong>
      {#if performanceTime}<span class={styles.blockClock}>
          {maskPlanClock(block.startMinutes, performanceTime)}
        </span>{/if}
      {#if block.notes}<span class={styles.blockNotes}>{block.notes}</span>{/if}
    </button>{/if}
