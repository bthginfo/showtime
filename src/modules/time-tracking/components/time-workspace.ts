import { ArrowRight, Clock3, DoorOpen } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { hours, shiftDate, timeAllocations, weekStart } from "@/shared/client-api";
import { useWorkspace } from "@/components/workspace-context";
import { PageHeader } from "@/components/ui";
import { WorkTimeModule } from "@/components/modules/time";
import { AttendanceModule } from "./attendance-module";
import { TimerPanel } from "./work-timer";
import { TimeBookingEditor } from "./time-booking-editor";
import styles from "./time-workspace.module.css";
import { useViewState } from "@/shared/view-state";

export { default as TimeWorkspace } from "./time-workspace.TimeWorkspace.svelte";
