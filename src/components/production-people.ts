import { Check, LoaderCircle, Plus, Trash2, Users } from "@lucide/svelte";
import { contactsValue, type DomainRecord, type Member, type ProductionContact, } from "@/shared/contracts";
import { ApiFailure, ids, initials, value } from "@/shared/client-api";
import { PersonPicker } from "@/modules/people/components";
import { hasMakeupResponsibility, productionContactName, toggleMakeupResponsibility, } from "@/shared/production-contacts";
import { isActiveStaff } from "@/shared/client-members";
import { useWorkspace } from "./workspace-context";
import { Badge, Button, Empty, ErrorMessage, Modal, PageHeader } from "./ui";
import { RecordLink } from "./record-link";
import styles from "./production-makeup-choice.module.css";
export const productionChangedMessage = "Die Produktion wurde inzwischen geändert. Deine Zuordnung wurde nicht gespeichert. Lade den aktuellen Stand und versuche es erneut.";
export function saveError(exception: unknown) {
    return exception instanceof ApiFailure && exception.status === 409
        ? productionChangedMessage
        : exception instanceof Error
            ? exception.message
            : "Speichern fehlgeschlagen. Bitte versuche es erneut.";
}
export { default as MakeupChoice } from "./production-people.MakeupChoice.svelte";
export { default as ProductionPeopleFields } from "./production-people.ProductionPeopleFields.svelte";
export { default as ProductionTeamModule } from "./production-people.ProductionTeamModule.svelte";
