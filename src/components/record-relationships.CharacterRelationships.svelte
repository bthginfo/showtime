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
import { type RelationshipProps, useRelationshipPeriod, ActorRelationships, PersonRelationships, SprintRelationships } from "./record-relationships";
const effects=createEffects();
type ViewProps = RelationshipProps;
export let record: ViewProps["record"] = undefined as any;
export let onNavigate: ViewProps["onNavigate"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace } = $workspaceStore;
$: ({ workspace } = $workspaceStore);
let castings = characterCastings(record.id, workspace);

$: castings = characterCastings(record.id, workspace);

</script>

<section class={styles.section}>
      <h3>Besetzung dieser Figur</h3>
      {#if castings.length}<ul class={styles.list}>
          {#each castings as casting (casting.id)}{@const actor = castingActor(casting, workspace)}<li class={styles.row}>
                <div class={styles.rowHeader}>
                  {#if actor}<RecordLink record={actor} from={record} onNavigate={onNavigate}>
                      {actorName(casting, workspace)}
                    </RecordLink>{:else}<span>{actorName(casting, workspace)}</span>{/if}
                  {#if casting.data.alternate === true}<Badge>Alternierend</Badge>{/if}
                </div>
                <RecordLink record={casting} from={record} onNavigate={onNavigate}>
                  Besetzung & Bilder öffnen
                </RecordLink>
              </li>{/each}
        </ul>{:else}<p class={styles.empty}>Dieser Figur ist noch keine Schauspielperson zugeordnet.</p>{/if}
    </section>
