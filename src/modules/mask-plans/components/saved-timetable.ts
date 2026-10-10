import { LinkedText } from "@/components/linked-text";
import { Pencil } from "@lucide/svelte";
import { RecordLink } from "@/components/record-link";
import { value } from "@/shared/client-api";
import type { DomainRecord, Member } from "@/shared/contracts";
import { maskPlanTracks } from "../layout";
import { maskPlanBlockLabel, maskPlanClock, maskPlanStaffNames, maskPlanWindow, type MaskPlanBlock, type MaskPlanData, type MaskPlanLane, } from "../model";
import styles from "./mask-plans.module.css";
export type Props = {
    plan: MaskPlanData;
    members: Member[];
    actors: DomainRecord[];
    performanceTime: string;
    productionColor: string;
    onEditLane: (lane: MaskPlanLane) => void;
    onEditBlock: (block: MaskPlanBlock) => void;
};
export { default as SavedAppointment } from "./saved-timetable.SavedAppointment.svelte";
export { default as SavedTimetable } from "./saved-timetable.SavedTimetable.svelte";
