<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

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
import { laneTitle, colorStyle, type Props, type DragSource, type DropTarget, type Point, NEW_BLOCK, eventPoint, PlaceControl, DraggableBlock, PlanAgenda } from "./timetable";
import { scrollRegion } from "@/shared/interaction-actions";
const effects=createEffects();
type ViewProps = Props;
export let plan: ViewProps["plan"] = undefined as any;
export let compact: NonNullable<ViewProps["compact"]> = false;
export let members: ViewProps["members"] = undefined as any;
export let actors: ViewProps["actors"] = undefined as any;
export let performanceTime: ViewProps["performanceTime"] = undefined as any;
export let productionColor: ViewProps["productionColor"] = undefined as any;
export let onEditLane: ViewProps["onEditLane"] = undefined as any;
export let onEditBlock: ViewProps["onEditBlock"] = undefined as any;
export let onAddBlock: ViewProps["onAddBlock"] = undefined as any;
export let onMoveBlock: ViewProps["onMoveBlock"] = undefined as any;
export let onDragStart: ViewProps["onDragStart"] = undefined as any;
export let onDragCancel: ViewProps["onDragCancel"] = undefined as any;
let board = {current: null as HTMLDivElement | null};
let point = {current: null as Point | null | null};
let suppressClick = {current: { id: "", until: 0 } as any | null};
let placing: boolean = false;
const setPlacing = (next: typeof placing | ((current: typeof placing) => typeof placing)) => { placing = typeof next === "function" ? (next as (current: typeof placing) => typeof placing)(placing) : next; };
let drag: DragSource | null = initialState<DragSource | null>(null);
const setDrag = (next: DragSource | null | ((current: DragSource | null) => DragSource | null)) => { drag = typeof next === "function" ? (next as (current: DragSource | null) => DragSource | null)(drag) : next; };
let target: DropTarget | null = initialState<DropTarget | null>(null);
const setTarget = (next: DropTarget | null | ((current: DropTarget | null) => DropTarget | null)) => { target = typeof next === "function" ? (next as (current: DropTarget | null) => DropTarget | null)(target) : next; };
let displayPlan = drag?.plan || plan;
let window = maskPlanWindow(displayPlan);
let smallest = Math.min(displayPlan.stepMinutes, ...displayPlan.blocks.map((block) => block.durationMinutes));
let minuteHeight = compact
    ? Math.max(44 / 15, ...displayPlan.blocks.map((block) => (block.title && (block.actorIds.length || block.actorNames.length) ? 64 : 44) /
        block.durationMinutes))
    : 44 / Math.max(1, smallest);
let tickStride = compact
    ? Math.max(1, Math.ceil((performanceTime ? 32 : 22) / (displayPlan.stepMinutes * minuteHeight)))
    : 1;
let height = -window.start * minuteHeight;
let laneTracks = new Map(displayPlan.lanes.map((lane) => [
    lane.id,
    maskPlanTracks(displayPlan.blocks.filter((block) => block.laneId === lane.id)),
]));
const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 8 } }));
let locateTarget = (source: DragSource | null, location: Point | null): DropTarget | null => {
    const element = board.current;
    if (!element || !location)
        return null;
    const viewport = element.getBoundingClientRect();
    const headerHeight = element.querySelector<HTMLElement>("[data-mask-header]")?.offsetHeight || 96;
    const bottomHeight = element.querySelector<HTMLElement>("[data-mask-zero]")?.offsetHeight || 54;
    if (location.x <= viewport.left ||
        location.x >= viewport.right ||
        location.y < viewport.top + headerHeight ||
        location.y >= viewport.bottom - bottomHeight)
        return null;
    for (const lane of element.querySelectorAll<HTMLElement>("[data-mask-lane]")) {
        const rect = lane.getBoundingClientRect();
        if (location.x < rect.left ||
            location.x >= rect.right ||
            location.y < rect.top ||
            location.y >= rect.bottom)
            continue;
        // A sticky time rail can cover part of a lane after sideways scrolling.
        const rail = element.querySelector<HTMLElement>("[data-mask-rail]")?.getBoundingClientRect();
        if (rail && location.x < rail.right)
            return null;
        const raster = displayPlan.stepMinutes;
        const raw = window.start + (location.y - rect.top - (source?.grabOffset || 0)) / minuteHeight;
        const latestStart = source?.block
            ? -Math.ceil(source.block.durationMinutes / raster) * raster
            : -raster;
        const startMinutes = Math.max(window.start, Math.min(latestStart, Math.round(raw / raster) * raster));
        return {
            laneId: lane.dataset.maskLane!,
            startMinutes,
            durationMinutes: source?.block?.durationMinutes || Math.min(15, -startMinutes),
        };
    }
    return null;
};
let locate = {current: locateTarget as any | null};
$: effects.run(0, () => {
    locate.current = locateTarget;
}, undefined);
$: effects.run(1, () => {
    if (!drag)
        return;
    const update = (event: Event) => {
        point.current = eventPoint(event);
        const next = locate.current(drag, point.current);
        setTarget((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
    };
    document.addEventListener("mousemove", update, true);
    document.addEventListener("touchmove", update, true);
    let frame = 0;
    let edge = { direction: "", since: 0 };
    const scroll = () => {
        const element = board.current, location = point.current;
        if (element && location) {
            const rect = element.getBoundingClientRect();
            if (location.x >= rect.left &&
                location.x <= rect.right &&
                location.y >= rect.top &&
                location.y <= rect.bottom) {
                const top = rect.top +
                    (element.querySelector<HTMLElement>("[data-mask-header]")?.offsetHeight || 96);
                const bottom = rect.bottom -
                    (element.querySelector<HTMLElement>("[data-mask-zero]")?.offsetHeight || 54);
                const horizontal = location.x < rect.left + 32 ? -10 : location.x > rect.right - 32 ? 10 : 0;
                const vertical = location.y < top + 24 ? -10 : location.y > bottom - 24 ? 10 : 0;
                const direction = `${horizontal}:${vertical}`;
                if (edge.direction !== direction)
                    edge = { direction, since: Date.now() };
                // Crossing a header or edge should not scroll the table; hovering there should.
                if ((horizontal || vertical) && Date.now() - edge.since > 250) {
                    element.scrollBy(horizontal, vertical);
                    const next = locate.current(drag, location);
                    setTarget((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
                }
            }
            else
                edge = { direction: "", since: 0 };
        }
        frame = requestAnimationFrame(scroll);
    };
    frame = requestAnimationFrame(scroll);
    return () => {
        document.removeEventListener("mousemove", update, true);
        document.removeEventListener("touchmove", update, true);
        cancelAnimationFrame(frame);
    };
}, [drag]);
let startDrag = (event: DragStartEvent) => {
    const block = event.active.data.current?.block as MaskPlanBlock | undefined;
    point.current = eventPoint(event.activatorEvent);
    const next = {
        block,
        plan,
        grabOffset: block && point.current
            ? Math.max(0, point.current.y - (event.active.rect.current.initial?.top || point.current.y))
            : 0,
    };
    onDragStart();
    suppressClick.current = { id: String(event.active.id), until: Infinity };
    setPlacing(false);
    setDrag(next);
    setTarget(locateTarget(next, point.current));
};
let finishDrag = (cancelled = false) => {
    const drop = cancelled ? null : locateTarget(drag, point.current);
    suppressClick.current.until = Date.now() + 500;
    if (drop) {
        if (drag?.block)
            onMoveBlock(drag.block.id, drop.laneId, drop.startMinutes);
        else
            onAddBlock(drop.laneId, drop.startMinutes);
    }
    onDragCancel();
    setDrag(null);
    setTarget(null);
    point.current = null;
};
let mayClick = (id: string) => suppressClick.current.id !== id || Date.now() > suppressClick.current.until;
let beginPress = () => {
    // A new deliberate press is different from the synthetic click following a drop.
    if (Number.isFinite(suppressClick.current.until))
        suppressClick.current = { id: "", until: 0 };
};
let targetLane = displayPlan.lanes.findIndex((lane) => lane.id === target?.laneId);

$: displayPlan = drag?.plan || plan;
$: window = maskPlanWindow(displayPlan);
$: smallest = Math.min(displayPlan.stepMinutes, ...displayPlan.blocks.map((block) => block.durationMinutes));
$: minuteHeight = compact
    ? Math.max(44 / 15, ...displayPlan.blocks.map((block) => (block.title && (block.actorIds.length || block.actorNames.length) ? 64 : 44) /
        block.durationMinutes))
    : 44 / Math.max(1, smallest);
$: tickStride = compact
    ? Math.max(1, Math.ceil((performanceTime ? 32 : 22) / (displayPlan.stepMinutes * minuteHeight)))
    : 1;
$: height = -window.start * minuteHeight;
$: laneTracks = new Map(displayPlan.lanes.map((lane) => [
    lane.id,
    maskPlanTracks(displayPlan.blocks.filter((block) => block.laneId === lane.id)),
]));





$: targetLane = displayPlan.lanes.findIndex((lane) => lane.id === target?.laneId);

</script>

<DndContext sensors={sensors} autoScroll={false} onDragStart={startDrag} onDragEnd={() => finishDrag()} onDragCancel={() => finishDrag(true)} accessibility={{
    screenReaderInstructions: {
        draggable: "Zum Bearbeiten antippen oder Enter drücken. Verschieben ist auch über die Felder Personalspalte und Minuten vor Beginn möglich.",
    },
}}>
      {#if !compact}<div class={styles.placementBar}>
          <PlaceControl active={placing} onPress={beginPress} onClick={() => {
    if (mayClick(NEW_BLOCK))
        setPlacing(!placing);
}}></PlaceControl>
          <p class={styles.scrollHint}>
            {placing
    ? "Tippe auf eine freie Stelle für den neuen Zeitblock."
    : "Blöcke ziehen · auf dem Handy kurz halten und verschieben. Antippen öffnet die Einstellungen."}
          </p>
        </div>{/if}
      <span class={styles.dragAnnouncement} role="status" aria-live="polite">
        {target
    ? `${target.startMinutes} Minuten · ${laneTitle(displayPlan.lanes[targetLane], members, targetLane)}`
    : drag
        ? "Zum Abbrechen außerhalb der Tabelle loslassen."
        : ""}
      </span>
      <div bind:this={board.current} class={`${styles.timelineScroll} ${compact ? styles.compactTable : ""} ${placing ? styles.placing : ""} ${drag ? styles.dragActive : ""}`} data-compact={compact} use:scrollRegion role="region" aria-label="Maskenplan-Zeittabelle, horizontal und vertikal scrollbar">
        <div class={styles.sheet} style={styleString({
    gridTemplateColumns: `var(--time-rail) repeat(${displayPlan.lanes.length}, minmax(var(--lane-width), 1fr))`,
})}>
          <div class={styles.corner}>
            <span>MIN.</span>
            {#if performanceTime}<Clock3 size={15} aria-label="Uhrzeiten"></Clock3>{/if}
          </div>
          {#each displayPlan.lanes as lane, index (lane.id)}<header class={styles.laneHeader} data-mask-header>
              <button type="button" on:click={() => onEditLane(lane)} class={styles.laneTitle} aria-label={`Personalspalte bearbeiten: ${laneTitle(lane, members, index)}`}>
                {#if lane.label && maskPlanStaffNames(lane, members).length > 0}<span>{lane.label}</span>{/if}
                <strong>{laneTitle(lane, members, index)}</strong>
                <Pencil size={14}></Pencil>
              </button>
              {#if !compact}<button type="button" on:click={() => onAddBlock(lane.id)} class={styles.laneAdd} aria-label={`Zeitblock hinzufügen bei ${laneTitle(lane, members, index)}`}>
                  <Plus size={15}></Plus>
                  Zeitblock
                </button>{/if}
            </header>{/each}
          <div class={styles.timeRail} style={styleString({ height })} data-mask-rail>
            {#each window.ticks
    .filter((tick, index) => tick !== 0 && index % tickStride === 0) as tick (tick)}<div class={styles.tick} style={styleString({ top: (tick - window.start) * minuteHeight })}>
                  <strong>{tick}</strong>
                  {#if performanceTime}<span title={maskPlanClock(tick, performanceTime)}>
                      {maskPlanClock(tick, performanceTime)}
                    </span>{/if}
                </div>{/each}
          </div>
          {#each displayPlan.lanes as lane, index (lane.id)}<div class={styles.laneBody} data-mask-lane={lane.id} style={styleString({
    height,
    "--tick-height": `${displayPlan.stepMinutes * minuteHeight}px`,
} as CSSProperties)}>
              {#if placing}<button type="button" class={styles.placementTarget} aria-label={`Neuen Zeitblock platzieren bei ${laneTitle(lane, members, index)}`} on:click={(event) => {
    if (event.detail === 0) {
        setPlacing(false);
        onAddBlock(lane.id);
        return;
    }
    const drop = locateTarget(null, { x: event.clientX, y: event.clientY });
    if (drop) {
        setPlacing(false);
        onAddBlock(drop.laneId, drop.startMinutes);
    }
}}></button>{/if}
              {#if !compact && !displayPlan.blocks.some((block) => block.laneId === lane.id)}<button type="button" class={styles.emptyLane} on:click={() => onAddBlock(lane.id)}>
                  <Plus size={18}></Plus>
                  <span>Ersten Zeitblock hinzufügen</span>
                </button>{/if}
              {#if target?.laneId === lane.id}<div class={styles.dropTarget} aria-hidden="true" style={styleString({
    top: (target.startMinutes - window.start) * minuteHeight,
    height: target.durationMinutes * minuteHeight,
})}>
                  <strong>
                    {target.startMinutes} · {target.durationMinutes} Min.
                  </strong>
                  <span>{drag?.block ? "Hierhin verschieben" : "Hier Zeitblock anlegen"}</span>
                </div>{/if}
              {#each displayPlan.blocks
    .filter((block) => block.laneId === lane.id) as block (block.id)}{@const { track, count } = laneTracks.get(lane.id)!.get(block.id)!}{@const label = maskPlanBlockLabel(block, actors)}{#key block.id}<DraggableBlock block={block} label={label} performanceTime={performanceTime} compact={compact} actors={actors} onClick={() => {
    if (mayClick(block.id))
        onEditBlock(block);
}} onPress={beginPress} style={{
    ...colorStyle(block, productionColor),
    top: (block.startMinutes - window.start) * minuteHeight,
    height: block.durationMinutes * minuteHeight,
    left: `calc(${(track / count) * 100}% + 5px)`,
    width: `calc(${100 / count}% - 10px)`,
}}></DraggableBlock>{/key}{/each}
            </div>{/each}
          <div class={styles.zeroRail} data-mask-zero>
            <strong>0</strong>
            {#if performanceTime}<span>{performanceTime}</span>{/if}
          </div>
          {#each displayPlan.lanes as lane (lane.id)}<div class={styles.begin}>
              <span>BEGINN</span>
            </div>{/each}
        </div>
      </div>
      <DragOverlay style={{ pointerEvents: "none" }}>
        {#if drag}<div class={styles.dragGhost}>
            <GripVertical size={16}></GripVertical>
            <strong>
              {drag.block ? maskPlanBlockLabel(drag.block, actors) : "Neuer Zeitblock"}
            </strong>
            <span>
              {target
    ? `${target.startMinutes} Min. · ${target.durationMinutes} Min.`
    : "In einer Personalspalte ablegen"}
            </span>
          </div>{/if}
      </DragOverlay>
    </DndContext>
