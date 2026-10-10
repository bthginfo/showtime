<script lang="ts">
import { AlertTriangle, ArrowUpRight } from "@lucide/svelte";
import type { DomainRecord, RecordData } from "@/shared/contracts";
import { value } from "@/shared/client-api";
import { useWorkspace } from "./workspace-context";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
type ViewProps = {
    previous: DomainRecord;
    next: RecordData;
};
export let previous: ViewProps["previous"] = undefined as any;
export let next: ViewProps["next"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace } = $workspaceStore;
$: ({ workspace } = $workspaceStore);
let figure = workspace.records.characters.find((record) => record.id === previous.data.characterId);
let oldActor = workspace.records.actors.find((record) => record.id === previous.data.actorId);
let newActor = workspace.records.actors.find((record) => record.id === next.actorId);
let looks = workspace.records.looks.filter((record) => record.data.productionId === previous.data.productionId &&
    (record.data.characterId === previous.data.characterId ||
        record.data.actorId === previous.data.actorId));
let tasks = workspace.records.tasks.filter((record) => record.data.productionId === previous.data.productionId && record.data.status !== "done");
let events = workspace.records.events.filter((record) => record.data.productionId === previous.data.productionId &&
    String(record.data.end) >= new Date().toISOString());
const links = true;

$: figure = workspace.records.characters.find((record) => record.id === previous.data.characterId);
$: oldActor = workspace.records.actors.find((record) => record.id === previous.data.actorId);
$: newActor = workspace.records.actors.find((record) => record.id === next.actorId);
$: looks = workspace.records.looks.filter((record) => record.data.productionId === previous.data.productionId &&
    (record.data.characterId === previous.data.characterId ||
        record.data.actorId === previous.data.actorId));
$: tasks = workspace.records.tasks.filter((record) => record.data.productionId === previous.data.productionId && record.data.status !== "done");
$: events = workspace.records.events.filter((record) => record.data.productionId === previous.data.productionId &&
    String(record.data.end) >= new Date().toISOString());

</script>
{#if true}
{#snippet render_links(records: any, module: any)}{#if records.length}<ul>
        {#each records.slice(0, 12) as record (record.id)}<li>
            <a href={`/?module=productions&productionId=${value(previous.data, "productionId")}&tab=${module === "documentation" ? "looks" : module}&record=${record.id}`} target="_blank">
              {value(record.data, "title")}
              <ArrowUpRight size={12}></ArrowUpRight>
            </a>
          </li>{/each}
        {#if records.length > 12}<li class="small muted">{records.length - 12} weitere im jeweiligen Bereich</li>{/if}
      </ul>{:else}<p class="small muted">Keine betroffenen Einträge.</p>{/if}{/snippet}
{#if next.actorId === previous.data.actorId &&
    next.characterId === previous.data.characterId &&
    next.productionId === previous.data.productionId}{:else}<section class="casting-impact field-wide">
      <header>
        <AlertTriangle size={18}></AlertTriangle>
        <h3>Besetzungswechsel prüfen</h3>
      </header>
      <p class="small">
        {oldActor ? value(oldActor.data, "name") : "Bisherige Besetzung"} →{" "}
        {newActor ? value(newActor.data, "name") : "Neue Besetzung"} · Figur{" "}
        {figure ? value(figure.data, "name") : "bisherige Figur"}
      </p>
      <p class="small muted">
        Die Besetzung wird geändert. Aufschriebe und Produktionsplanung bleiben erhalten und sollten
        fachlich geprüft werden. Links öffnen in einem neuen Tab.
      </p>
      <h4>Direkt zugeordnete Aufschriebe ({looks.length})</h4>
      {@render render_links(looks, "documentation")}
      <h4>Allgemeine Produktionsaufgaben ({tasks.length})</h4>
      <p class="small muted">
        Diese Aufgaben gehören zum Stück; sie sind keiner einzelnen Schauspielerbesetzung
        zugeordnet.
      </p>
      {@render render_links(tasks, "tasks")}
      <h4>Anstehende Produktionsdienste ({events.length})</h4>
      <p class="small muted">
        Diese Termine gehören zur Produktion; der Wechsel löst keine automatische Dienständerung
        aus.
      </p>
      {@render render_links(events, "calendar")}
    </section>{/if}

{/if}
