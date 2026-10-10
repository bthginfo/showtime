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
import { type RelationshipProps, useRelationshipPeriod, ActorRelationships, CharacterRelationships, SprintRelationships } from "./record-relationships";
const effects=createEffects();
type ViewProps = RelationshipProps;
export let record: ViewProps["record"] = undefined as any;
export let onNavigate: ViewProps["onNavigate"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace } = $workspaceStore;
$: ({ workspace } = $workspaceStore);
const [periodStore, setPeriod] = useRelationshipPeriod(record);
let period=$periodStore; $: period=$periodStore;
let appearances = personProductions(record.id, workspace, period);

$: appearances = personProductions(record.id, workspace, period);

</script>

<section class={styles.section}>
      <h3>Mitwirkende Produktionen</h3>
      <div class={styles.filter}>
        <PeriodPicker records={workspace.records.productions} productions={workspace.records.productions} value={period} onChange={setPeriod} compact></PeriodPicker>
      </div>
      {#if appearances.length}<ul class={styles.list}>
          {#each appearances as { production, roles } (production.id)}<li class={styles.row}>
              <div class={styles.rowHeader}>
                <RecordLink record={production} from={record} onNavigate={onNavigate}>
                  {textValue(production.data.title)}
                </RecordLink>
                <span>{textValue(production.data.season)}</span>
              </div>
              <p class={styles.caption}>{roles.join(" · ") || "Kontakt"}</p>
            </li>{/each}
        </ul>{:else}<p class={styles.empty}>
          In diesem Zeitraum ist keine Produktion verknüpft. Ältere Zuordnungen findest du über die
          Spielzeitauswahl.
        </p>{/if}
    </section>
