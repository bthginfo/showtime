import { Check, Download, ExternalLink, LoaderCircle, Users } from "@lucide/svelte";
import { ResourceView } from "@/components/resource-view";
import { Badge, Button, ErrorMessage, Modal } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-context";
import { api, initials, post } from "@/shared/client-api";
import { PeriodPicker, periodExportFilters } from "@/components/period-picker";
import { initialPeriod, periodOptions, recordMatchesPeriod, seasonKey, type PeriodFilter, } from "@/shared/period-filter";
import { useViewState } from "@/shared/view-state";
export interface Preview {
    season: string;
    fetchedAt: string;
    summary: {
        create: number;
        update: number;
        conflict: number;
    };
    entries: {
        sourceId: string;
        name: string;
        action: "create" | "update" | "conflict";
        recordId?: string;
    }[];
}
export interface ImportResult {
    created: number;
    updated: number;
    unchanged: number;
    images: number;
    errors: {
        name: string;
        error: string;
    }[];
}
export { default as ActorsModule } from "./actors-module.ActorsModule.svelte";
export { default as EnsembleImport } from "./actors-module.EnsembleImport.svelte";
