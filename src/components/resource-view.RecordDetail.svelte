<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel, localDate } = useTheaterTime();
  import { LinkedText } from "./linked-text";
  import {
    ArrowLeft,
    Image as ImageIcon,
    MoreHorizontal,
    Pencil,
    Plus,
    Trash2,
    Upload,
  } from "@lucide/svelte";
  import type { DomainRecord, RecordData, RecordKind, Workspace } from "@/shared/contracts";
  import { api, hours, ids, num, value } from "@/shared/client-api";
  import { imageAccept, prepareUpload } from "@/shared/client-files";
  import { HistoryPanel } from "./history-panel";
  import { fields, labels, statusLabels } from "./resource-fields";
  import { useWorkspace } from "./workspace-context";
  import { Badge, Button, Empty, ErrorMessage, ExportButton, Modal, PageHeader } from "./ui";
  import browseStyles from "./workspace-browse.module.css";
  import { ResourceEditor } from "./resource-editor";
  import { DocumentContent } from "@/modules/documentation/components/document-content";
  import { lookTitle } from "@/shared/document-sections";
  import { CategoryManager } from "@/modules/categories/components/category-manager";
  import { categoryName } from "@/shared/domain-categories";
  import { EventDetail } from "@/modules/calendar/components/event-detail";
  import { canManageRecord } from "@/shared/record-permissions";
  import { ExportDialog, ImportDialog } from "./export-dialog";
  import { DocumentAttachment } from "@/modules/documents/components/document-attachment";
  import { documentAccept, RecordDocuments } from "@/modules/documents/components/record-documents";
  import { RecordLink } from "./record-link";
  import {
    ActorRelationships,
    CharacterRelationships,
    SprintRelationships,
  } from "./record-relationships";
  import { PersonDetails } from "@/modules/people/components/person-details";
  import { navigateRecord, navigationReturn } from "@/shared/client-navigation";
  import relationStyles from "./record-links.module.css";
  import { actorPortrait } from "@/modules/ensemble/portrait-layout";
  import { ActorPortrait } from "@/modules/ensemble/components/actor-portrait";
  import portraitStyles from "@/modules/ensemble/components/actor-portrait.module.css";
  import { initialPeriod, teamTaskSeason } from "@/shared/period-filter";
  import { useViewState } from "@/shared/view-state";
  import { MaterialReservations } from "@/modules/reservations/components/material-reservations";
  import {
    createEffects,
    createId,
    externalStore,
    styleString,
    applyRef,
  } from "@/shared/svelte-runtime";
  import type {
    ReactNode,
    CSSProperties,
    Dispatch,
    SetStateAction,
    FormEvent,
    ChangeEvent,
    KeyboardEvent,
    MouseEvent,
    DragEvent,
    ComponentProps,
    RefObject,
  } from "@/shared/ui-types";
  import { recordTitle, GenericRecordDetail, ResourceView } from "./resource-view";
  const effects = createEffects();
  type ViewProps = {
    record: DomainRecord;
    onClose: () => void;
    onNavigate?: () => void;
  };
  export let record: ViewProps["record"] = undefined as any;
  export let onClose: ViewProps["onClose"] = undefined as any;
  export let onNavigate: NonNullable<ViewProps["onNavigate"]> = onClose;
</script>

{#if record.kind === "events"}<EventDetail {record} {onClose} {onNavigate}
  ></EventDetail>{:else}{#if record.kind === "people"}<PersonDetails {record} {onClose} {onNavigate}
    ></PersonDetails>{:else}{#key record.id}<GenericRecordDetail {record} {onClose} {onNavigate}
      ></GenericRecordDetail>{/key}{/if}{/if}
