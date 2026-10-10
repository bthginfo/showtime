import { FileText, Plus } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { documentSections, sectionName, lookTitle } from "@/shared/document-sections";
import { initialPeriod, recordMatchesPeriod, type PeriodFilter } from "@/shared/period-filter";
import { value } from "@/shared/client-api";
import { useWorkspace } from "@/components/workspace-context";
import { Button, Empty, ExportButton, PageHeader } from "@/components/ui";
import { PeriodPicker, periodExportFilters } from "@/components/period-picker";
import { RecordDetail, ResourceView } from "@/components/resource-view";
import { ResourceEditor } from "@/components/resource-editor";
import { ExportDialog } from "@/components/export-dialog";
import { CategoryManager } from "@/modules/categories/components/category-manager";
import { useViewState } from "@/shared/view-state";

export { default as DocumentationModule } from "./documentation-module.DocumentationModule.svelte";
