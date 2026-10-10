<script lang="ts">
import { useViewState } from "@/shared/view-state";
import { Badge } from "./ui";
import { PeriodPicker } from "./period-picker";
import { RecordLink } from "./record-link";
import { useWorkspace } from "./workspace-context";
import { textValue, type DomainRecord } from "@/shared/contracts";
import { actorLooks, actorName, actorProductions, castingActor, castingCharacter, characterCastings, characterName, personProductions, relatedProduction, } from "@/shared/record-relationships";
import { seasonForDate, type PeriodFilter } from "@/shared/period-filter";
import styles from "./record-links.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { type RelationshipProps, useRelationshipPeriod, ActorRelationships, CharacterRelationships, PersonRelationships } from "./record-relationships";
const effects=createEffects();
type ViewProps = RelationshipProps;
export let record: ViewProps["record"] = undefined as any;
export let onNavigate: ViewProps["onNavigate"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace } = $workspaceStore;
$: ({ workspace } = $workspaceStore);
let tasks = workspace.records.tasks.filter((task) => task.data.sprintId === record.id);

$: tasks = workspace.records.tasks.filter((task) => task.data.sprintId === record.id);

</script>

<section class={styles.section}>
      <h3>Aufgaben in diesem Sprint</h3>
      {#if tasks.length}<ul class={styles.list}>
          {#each tasks as task (task.id)}<li class={styles.row}>
              <RecordLink record={task} from={record} onNavigate={onNavigate}>
                {textValue(task.data.title)}
              </RecordLink>
            </li>{/each}
        </ul>{:else}<p class={styles.caption}>Diesem Sprint sind noch keine Aufgaben zugeteilt.</p>{/if}
    </section>
