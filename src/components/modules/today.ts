import { ArrowRight, CalendarDays, CheckCircle2, ChevronRight, Clock3, Sparkles, } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { dateLabel, hours, ids, localDate, shiftDate, timeAllocations, value, weekStart, } from "@/shared/client-api";
import { recordHref } from "@/shared/client-navigation";
import { isStaff } from "@/shared/client-members";
import { useWorkspace } from "../workspace-context";
import { Badge, Button, Empty, PageHeader, Section } from "../ui";
import { RecordDetail } from "../resource-view";
import { TimerPanel } from "./time";
import { expandEvents } from "./calendar";
import { statusLabels } from "../resource-fields";
import { initialPeriod, recordMatchesPeriod } from "@/shared/period-filter";
import { unreadNotifications } from "@/modules/notifications/unread";
import { AttendanceBalanceCard, attendanceBalanceStyles, } from "@/modules/time-tracking/components/attendance-balance";

export { default as TodayModule } from "./today.TodayModule.svelte";
