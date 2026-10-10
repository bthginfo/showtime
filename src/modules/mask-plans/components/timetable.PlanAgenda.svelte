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
import { laneTitle, colorStyle, type Props, type DragSource, type DropTarget, type Point, NEW_BLOCK, eventPoint, PlaceControl, DraggableBlock, Timetable } from "./timetable";
const effects=createEffects();
type ViewProps = Props;
export let plan: ViewProps["plan"] = undefined as any;
export let members: ViewProps["members"] = undefined as any;
export let actors: ViewProps["actors"] = undefined as any;
export let performanceTime: ViewProps["performanceTime"] = undefined as any;
export let productionColor: ViewProps["productionColor"] = undefined as any;
export let onEditLane: ViewProps["onEditLane"] = undefined as any;
export let onEditBlock: ViewProps["onEditBlock"] = undefined as any;
export let onAddBlock: ViewProps["onAddBlock"] = undefined as any;


</script>

<div class={styles.agenda}>
      {#each plan.lanes as lane, laneIndex (lane.id)}{@const blocks = plan.blocks
    .filter((block) => block.laneId === lane.id)
    .sort((left, right) => left.startMinutes - right.startMinutes)}<section class={styles.agendaLane}>
            <header class={styles.agendaHeading}>
              <button type="button" on:click={() => onEditLane(lane)} class={styles.agendaStaff}>
                <strong>{laneTitle(lane, members, laneIndex)}</strong>
                <Pencil size={15}></Pencil>
              </button>
              <button type="button" class="icon-button" aria-label={`Zeitblock hinzufügen bei ${laneTitle(lane, members, laneIndex)}`} on:click={() => onAddBlock(lane.id)}>
                <Plus size={18}></Plus>
              </button>
            </header>
            {#if blocks.length}<ol class={styles.agendaBlocks}>
                {#each blocks as block (block.id)}<li style={styleString(colorStyle(block, productionColor))}>
                    <div class={styles.agendaTime}>
                      <strong>{block.startMinutes}</strong>
                      <span>{block.durationMinutes} Min.</span>
                      {#if performanceTime}<small>{maskPlanClock(block.startMinutes, performanceTime)}</small>{/if}
                    </div>
                    <div class={styles.agendaText}>
                      <div class={styles.actorLinks}>
                        {#each block.actorIds as id}{@const actor = actors.find((actor) => actor.id === id)}{#if actor}{#key id}<RecordLink record={actor}>
                              {value(actor.data, "name")}
                            </RecordLink>{/key}{:else}<span>Frühere Schauspielperson</span>{/if}{/each}
                        {#each block.actorNames as name, index (`${index}:${name}`)}<span>{name}</span>{/each}
                      </div>
                      {#if block.title}<strong>{block.title}</strong>{/if}
                      {#if block.notes}<p>{block.notes}</p>{/if}
                      {#if !maskPlanActorNames(block, actors).length && !block.title}<strong>Zeitblock</strong>{/if}
                    </div>
                    <button type="button" class="icon-button" aria-label={`${maskPlanBlockLabel(block, actors)} bearbeiten`} on:click={() => onEditBlock(block)}>
                      <Pencil size={17}></Pencil>
                    </button>
                  </li>{/each}
              </ol>{:else}<p class={styles.agendaEmpty}>Noch keine Zeitblöcke.</p>{/if}
          </section>{/each}
      <div class={styles.agendaBegin}>
        <strong>0 · Vorstellungsbeginn</strong>
        {#if performanceTime}<span>{performanceTime}</span>{/if}
      </div>
    </div>
