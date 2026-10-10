import { LinkedText } from "@/components/linked-text";
import { AlertTriangle, Check, Copy, MoreHorizontal, Download, Pencil, Plus, Save, Settings2, Trash2, Undo2, } from "@lucide/svelte";
import { Button, Empty, ErrorMessage, Modal } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-context";
import { ApiFailure, value } from "@/shared/client-api";
import { contactsValue, type DomainRecord } from "@/shared/contracts";
import { isActiveStaff } from "@/shared/client-members";
import { maskPlanSchema } from "../schema";
import { cloneMaskPlan, maskPlanBlockLabel, maskPlanOverlaps, maskPlanValue, newMaskPlan, type MaskPlanBlock, type MaskPlanData, type MaskPlanLane, } from "../model";
import { BlockEditor, LaneEditor, PlanOptions } from "./plan-editors";
import { Timetable } from "./timetable";
import { SavedTimetable } from "./saved-timetable";
import styles from "./mask-plans.module.css";
import { useViewState } from "@/shared/view-state";
import { navigateWorkspace, replaceWorkspaceLocation } from "@/shared/client-navigation";
export type Draft = {
    data: MaskPlanData;
    base?: DomainRecord;
};
export type Editor = (({
    type: "options";
    creating: boolean;
    plan: MaskPlanData;
} | {
    type: "lane";
    creating: boolean;
    lane: MaskPlanLane;
} | {
    type: "block";
    creating: boolean;
    block: MaskPlanBlock;
}) & {
    base?: DomainRecord;
    snapshot?: MaskPlanData;
}) | null;
export function updateLocation(id: string, push = false) {
    const next = new URL(location.href);
    if (id)
        next.searchParams.set("record", id);
    else
        next.searchParams.delete("record");
    if (push)
        navigateWorkspace(next.pathname + next.search);
    else {
        replaceWorkspaceLocation(next.pathname + next.search);
    }
}
export { default as MaskPlansModule } from "./mask-plans-module.MaskPlansModule.svelte";
