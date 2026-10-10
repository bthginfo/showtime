<script lang="ts">
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
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { initialData, type ResourceEditorProps, GenericResourceEditor } from "./resource-editor";
const effects=createEffects();
export let kind: ResourceEditorProps['kind'];
export let record: ResourceEditorProps['record']=undefined;
export let defaults: ResourceEditorProps['defaults']=undefined;
export let onClose: ResourceEditorProps['onClose'];
export let lockedProductionId: ResourceEditorProps['lockedProductionId']=undefined;
export let onSaved: ResourceEditorProps['onSaved']=undefined;
let props: ResourceEditorProps={kind,record,defaults,onClose,lockedProductionId,onSaved};
$: props={kind,record,defaults,onClose,lockedProductionId,onSaved};


</script>

{#if props.kind === "people"}<PersonEditor {...props}></PersonEditor>{:else}{#if props.kind === "casting"}<CastingEditor {...props}></CastingEditor>{:else}{#if props.kind === "looks" || props.kind === "handovers" || props.kind === "templates"}<DocumentEditor {...props} kind={props.kind}></DocumentEditor>{:else}{#if props.kind === "events"}<EventEditor {...props}></EventEditor>{:else}{#if props.kind === "time" || props.kind === "attendance"}<TimeBookingEditor {...props} kind={props.kind}></TimeBookingEditor>{:else}<GenericResourceEditor {...props}></GenericResourceEditor>{/if}{/if}{/if}{/if}{/if}
