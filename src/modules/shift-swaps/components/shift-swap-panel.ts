import { ArrowRightLeft, Check, ChevronDown, Plus, X } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { listValue, textValue } from "@/shared/contracts";
import { dateLabel } from "@/shared/client-api";
import { isActiveStaff } from "@/shared/client-members";
import { subscribeLocation } from "@/shared/client-storage";
import { calendarPresentation } from "@/shared/calendar-categories";
import { occurrences } from "@/modules/calendar/occurrences";
import { useWorkspace } from "@/components/workspace-context";
import { Badge, Button, ErrorMessage, ExportButton, Modal } from "@/components/ui";
import { ExportDialog } from "@/components/export-dialog";
import { eligibleSwapService, shiftSwapStatusLabels } from "../model";
import type { ShiftSwapAction, ShiftSwapStatus } from "../schema";
import styles from "@/modules/workflows/components/workflow.module.css";
export interface ServiceOption {
    key: string;
    event: DomainRecord;
    start: string;
    end: string;
    title: string;
}
export function upcomingServices(events: DomainRecord[], memberId: string, categories: DomainRecord[], productions: DomainRecord[], now: number): ServiceOption[] {
    const until = new Date(now);
    until.setUTCFullYear(until.getUTCFullYear() + 1);
    return events
        .filter((row) => eligibleSwapService(row, categories) &&
        listValue(row.data.participantIds).includes(memberId))
        .flatMap((event) => occurrences(event, new Date(now), until)
        .filter((occurrence) => occurrence.start.getTime() > now)
        .map((occurrence) => ({
        key: `${event.id}@${occurrence.start.toISOString()}`,
        event,
        start: occurrence.start.toISOString(),
        end: occurrence.end.toISOString(),
        title: calendarPresentation(event, productions, categories).title,
    })))
        .sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || a.key.localeCompare(b.key))
        .slice(0, 200);
}
export const serviceLabel = (service: ServiceOption) => `${dateLabel(service.start, true)} · ${service.title}`;
export { default as ShiftSwapPanel } from "./shift-swap-panel.ShiftSwapPanel.svelte";
export { default as ShiftSwapEditor } from "./shift-swap-panel.ShiftSwapEditor.svelte";
