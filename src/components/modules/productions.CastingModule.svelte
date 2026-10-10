<script lang="ts">
import { LinkedText } from "@/components/linked-text";
import { ArrowLeft, ArrowUpRight, CalendarDays, Plus, Users } from "@lucide/svelte";
import { PeriodPicker, periodExportFilters } from "@/components/period-picker";
import { recordMatchesPeriod, seasonForDate, type PeriodFilter } from "@/shared/period-filter";
import { contactsValue } from "@/shared/contracts";
import { productionContactName } from "@/shared/production-contacts";
import { productionCastingCounts } from "@/modules/productions/counts";
import { sortProductionsByPremiere } from "@/shared/production-order";
import type { Workspace } from "@/shared/contracts";
import { dateLabel, hours, ids, num, value } from "@/shared/client-api";
import { useWorkspace } from "../workspace-context";
import { Badge, Button, Empty, ExportButton, PageHeader, Section } from "../ui";
import { ResourceEditor } from "../resource-editor";
import { RecordDetail, ResourceView } from "../resource-view";
import { ExportDialog, ImportDialog } from "../export-dialog";
import { ProductionTeamModule } from "../production-people";
import { ChatModule } from "./chat";
import { TasksModule } from "./tasks";
import { CalendarModule } from "./calendar";
import { TimeModule } from "./time";
import { statusLabels } from "../resource-fields";
import { RecordDocuments } from "@/modules/documents/components/record-documents";
import { MaskPlansModule } from "@/modules/mask-plans/components/mask-plans-module";
import { RecordLink } from "../record-link";
import relationStyles from "../record-links.module.css";
import styles from "../workspace-browse.module.css";
import { useViewState } from "@/shared/view-state";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { productionSections, ProductionsModule } from "./productions";
const effects=createEffects();
type ViewProps = {
    productionId?: string;
};
export let productionId: NonNullable<ViewProps["productionId"]> = "";


</script>

<ResourceView kind="casting" title="Besetzung" lockedProductionId={productionId} defaults={{ productionId }} filter={productionId ? (record) => record.data.productionId === productionId : undefined}></ResourceView>
