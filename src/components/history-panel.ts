import { History } from "@lucide/svelte";
import type { DomainRecord, RecordData } from "@/shared/contracts";
import { api, dateLabel } from "@/shared/client-api";
import { Button, ErrorMessage } from "./ui";
import { fields } from "./resource-fields";
import { useWorkspace } from "./workspace-context";
export type Version = {
    id: string;
    recordId: string;
    version: number;
    data: RecordData;
    createdBy: string;
    createdAt: string;
};
export { default as HistoryPanel } from "./history-panel.HistoryPanel.svelte";
