import {get} from "svelte/store";
import {replaceWorkspaceLocation} from "@/shared/client-navigation";
import { useViewState } from "@/shared/view-state";
import { Badge } from "./ui";
import { PeriodPicker } from "./period-picker";
import { RecordLink } from "./record-link";
import { useWorkspace } from "./workspace-context";
import { textValue, type DomainRecord } from "@/shared/contracts";
import { actorLooks, actorName, actorProductions, castingActor, castingCharacter, characterCastings, characterName, personProductions, relatedProduction, } from "@/shared/record-relationships";
import { seasonForDate, type PeriodFilter } from "@/shared/period-filter";
import styles from "./record-links.module.css";
export type RelationshipProps = {
    record: DomainRecord;
    onNavigate?: () => void;
};
export function useRelationshipPeriod(record: DomainRecord) {
    const { workspace } = get(useWorkspace());
    const period = useViewState<PeriodFilter>(workspace.user.id, `relationships:${record.id}`, "period", () => {
        const query = new URLSearchParams(typeof location === "undefined" ? "" : location.search);
        const selected = query.get("record") === record.id ? query.get("relatedSeason") : null;
        const year = Number(query.get("relatedYear"));
        return {
            season: selected === "all" ? undefined : selected || seasonForDate(workspace.records.productions),
            year: year >= 1900 && year <= 2100 ? year : undefined,
        };
    });
    const update = (next: PeriodFilter) => {
        period.set(next);
        const url = new URL(location.href);
        if (url.searchParams.get("record") !== record.id)
            return;
        url.searchParams.set("relatedSeason", next.season || "all");
        if (next.year)
            url.searchParams.set("relatedYear", String(next.year));
        else
            url.searchParams.delete("relatedYear");
        replaceWorkspaceLocation(url.pathname + url.search, false);
    };
    return [period, update] as const;
}
export { default as ActorRelationships } from "./record-relationships.ActorRelationships.svelte";
export { default as CharacterRelationships } from "./record-relationships.CharacterRelationships.svelte";
export { default as PersonRelationships } from "./record-relationships.PersonRelationships.svelte";
export { default as SprintRelationships } from "./record-relationships.SprintRelationships.svelte";
