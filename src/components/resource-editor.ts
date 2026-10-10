import { contactsValue, type DomainRecord, type RecordData, type RecordKind, } from "@/shared/contracts";
import { ids, instantDate, localDate, localDateTime, num, value } from "@/shared/client-api";
import { fields, labels, type Field } from "./resource-fields";
import { useWorkspace } from "./workspace-context";
import { Button, ErrorMessage, Modal } from "./ui";
import { ProductionPeopleFields } from "./production-people";
import { isActiveStaff } from "@/shared/client-members";
import { TimeBookingEditor } from "@/modules/time-tracking/components/time-booking-editor";
import { EventEditor } from "@/modules/calendar/components/event-editor";
import { PersonEditor } from "@/modules/people/components";
import { DocumentEditor } from "@/modules/documentation/components/document-editor";
import { CastingEditor } from "@/modules/productions/components/casting-editor";
import { RepeatableList } from "./repeatable-list";
import { categoriesFor } from "@/shared/domain-categories";
import { CastingImpact } from "./casting-impact";
import { numberDraft, parseNumberDraft } from "@/shared/number-draft";
import { actorSeasons, initialPeriod, seasonKey, teamTaskSeason } from "@/shared/period-filter";
export function initialData(kind: RecordKind): RecordData {
    return {
        status: kind === "productions"
            ? "preparation"
            : kind === "looks"
                ? "draft"
                : kind === "tasks"
                    ? "todo"
                    : kind === "sprints"
                        ? "planned"
                        : kind === "leave"
                            ? "pending"
                            : "open",
        priority: "normal",
        category: kind === "time" ? "production" : kind === "events" ? "service" : "other",
        recurrence: "none",
        color: "#16735c",
        date: localDate(),
        version: 1,
        quantity: 1,
        minQuantity: 0,
        pauseSeconds: 0,
        durationSeconds: 1800,
        ...(kind === "templates"
            ? { fields: ["Vorbereitung", "Material", "Arbeitsablauf", "Umbau"] }
            : {}),
    };
}
export type ResourceEditorProps = {
    kind: RecordKind;
    record?: DomainRecord;
    defaults?: RecordData;
    onClose: () => void;
    lockedProductionId?: string;
    onSaved?: (record: DomainRecord) => void;
};
export { default as ResourceEditor } from "./resource-editor.ResourceEditor.svelte";
export { default as GenericResourceEditor } from "./resource-editor.GenericResourceEditor.svelte";
