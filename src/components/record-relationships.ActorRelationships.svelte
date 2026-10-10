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
import { type RelationshipProps, useRelationshipPeriod, CharacterRelationships, PersonRelationships, SprintRelationships } from "./record-relationships";
const effects=createEffects();
type ViewProps = RelationshipProps;
export let record: ViewProps["record"] = undefined as any;
export let onNavigate: ViewProps["onNavigate"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace } = $workspaceStore;
$: ({ workspace } = $workspaceStore);
const [periodStore, setPeriod] = useRelationshipPeriod(record);
let period=$periodStore; $: period=$periodStore;
let appearances = actorProductions(record.id, workspace, period);
let looks = actorLooks(record.id, workspace, period);
let link = { from: record, onNavigate };

$: appearances = actorProductions(record.id, workspace, period);
$: looks = actorLooks(record.id, workspace, period);
$: link = { from: record, onNavigate };

</script>

<section class={styles.section} aria-label="Produktionen und Aufschriebe dieser Schauspielperson">
      <div class={styles.heading}>
        <h3>Spielt mit in</h3>
        <span class="small muted">
          {appearances.length} {appearances.length === 1 ? "Produktion" : "Produktionen"}
        </span>
      </div>
      <div class={styles.filter}>
        <PeriodPicker records={workspace.records.casting} productions={workspace.records.productions} value={period} onChange={setPeriod} compact></PeriodPicker>
      </div>
      {#if appearances.length}<ul class={styles.list}>
          {#each appearances as { production, castings } (production.id)}<li class={styles.row}>
              <div class={styles.rowHeader}>
                <RecordLink record={production} {...link}>
                  {textValue(production.data.title)}
                </RecordLink>
                <span>{textValue(production.data.season) || "Spielzeit nicht hinterlegt"}</span>
              </div>
              {#each castings as casting (casting.id)}{@const character = castingCharacter(casting, workspace)}<div class={styles.role}>
                    <span class={styles.roleDetails}>
                      {#if character}<RecordLink record={character} {...link}>
                          {characterName(casting, workspace)}
                        </RecordLink>{:else}{characterName(casting, workspace)}{/if}
                      {#if casting.data.alternate === true}<Badge>Alternierend</Badge>{/if}
                    </span>
                    <RecordLink record={casting} {...link}>
                      Besetzung öffnen
                    </RecordLink>
                  </div>{/each}
            </li>{/each}
        </ul>{:else}<p class={styles.empty}>
          Für diesen Zeitraum ist noch keine Besetzung verknüpft. Wähle eine andere oder alle
          Spielzeiten, um ältere Produktionen zu sehen.
        </p>{/if}
      <div class={`${styles.heading} margin-top`}>
        <h3>Aufschriebe</h3>
        <span class="small muted">{looks.length}</span>
      </div>
      {#if looks.length}<ul class={styles.list}>
          {#each looks as look (look.id)}{@const production = relatedProduction(look, workspace)}{@const figure = workspace.records.characters.find((character) => character.id === look.data.characterId)}<li class={styles.row}>
                <RecordLink record={look} {...link}>
                  {production ? textValue(production.data.title) : "Allgemeiner Aufschrieb"}
                  {(!!figure || !!textValue(look.data.characterName)) &&
    ` · ${textValue(figure?.data.name) || textValue(look.data.characterName)}`}
                </RecordLink>
              </li>{/each}
        </ul>{:else}<p class={styles.caption}>Noch keine verknüpften Aufschriebe in diesem Zeitraum.</p>{/if}
    </section>
