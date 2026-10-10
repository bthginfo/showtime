<script lang="ts">
import { LinkedText } from "@/components/linked-text";
import { Pencil } from "@lucide/svelte";
import { RecordLink } from "@/components/record-link";
import { value } from "@/shared/client-api";
import type { DomainRecord, Member } from "@/shared/contracts";
import { maskPlanTracks } from "../layout";
import { maskPlanBlockLabel, maskPlanClock, maskPlanStaffNames, maskPlanWindow, type MaskPlanBlock, type MaskPlanData, type MaskPlanLane, } from "../model";
import styles from "./mask-plans.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { type Props, SavedTimetable } from "./saved-timetable";
const effects=createEffects();
type ViewProps = {
    block: MaskPlanBlock;
    actors: DomainRecord[];
    performanceTime: string;
    onEdit: () => void;
};
export let block: ViewProps["block"] = undefined as any;
export let actors: ViewProps["actors"] = undefined as any;
export let performanceTime: ViewProps["performanceTime"] = undefined as any;
export let onEdit: ViewProps["onEdit"] = undefined as any;
let label = maskPlanBlockLabel(block, actors) || "Zeitblock";

$: label = maskPlanBlockLabel(block, actors) || "Zeitblock";

</script>

<div class={styles.savedAppointment}>
      <div class={styles.savedTiming}>
        <span>
          {block.startMinutes} · {block.durationMinutes} Min.
        </span>
        {#if performanceTime}<span>{maskPlanClock(block.startMinutes, performanceTime)}</span>{/if}
      </div>
      <div class={styles.savedActors}>
        {#each block.actorIds as id}{@const actor = actors.find((candidate) => candidate.id === id)}{#if actor}{#key id}<RecordLink record={actor} decoration={false}>
              {value(actor.data, "name")}
            </RecordLink>{/key}{:else}<span>Frühere Schauspielperson</span>{/if}{/each}
        {#each block.actorNames as name, index (`${index}:${name}`)}<span>{name}</span>{/each}
      </div>
      {#if block.title}<strong>{block.title}</strong>{/if}
      {#if !block.actorIds.length && !block.actorNames.length && !block.title}<strong>Zeitblock</strong>{/if}
      {#if block.notes}<p class={styles.savedNotes}>
          <LinkedText text={block.notes}></LinkedText>
        </p>{/if}
      <button type="button" class={styles.savedAppointmentEdit} on:click={onEdit} aria-label={`${label}, ${block.startMinutes} Minuten vor Beginn, ${block.durationMinutes} Minuten, bearbeiten`} title="Zeitblock bearbeiten">
        <Pencil size={12}></Pencil>
      </button>
    </div>
