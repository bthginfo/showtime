<script lang="ts">
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
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { productionChangedMessage, saveError, ProductionPeopleFields, ProductionTeamModule } from "./production-people";
const effects=createEffects();
type ViewProps = {
    member: Member;
    selected: boolean;
    disabled: boolean;
    pending?: boolean;
    onClick: () => void;
};
export let member: ViewProps["member"] = undefined as any;
export let selected: ViewProps["selected"] = undefined as any;
export let disabled: ViewProps["disabled"] = undefined as any;
export let pending: NonNullable<ViewProps["pending"]> = false;
export let onClick: ViewProps["onClick"] = undefined as any;


</script>

<button type="button" class={styles.choice} aria-label={`Maskenbetreuung für ${member.name}`} aria-pressed={selected} disabled={disabled} title={selected
    ? "Betreuung entfernen. Die Person bleibt im Produktionsteam."
    : "Als Maskenbetreuung auswählen"} on:click={onClick}>
      {#if pending}<LoaderCircle size={16} className={styles.spinner} aria-hidden="true"></LoaderCircle>{:else}{#if selected}<Check size={16} aria-hidden="true"></Check>{:else}<Plus size={16} aria-hidden="true"></Plus>{/if}{/if}
      {selected ? "Maskenbetreuung" : "Als Maskenbetreuung"}
    </button>
